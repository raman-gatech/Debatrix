import { storage } from "../storage";
import { cache } from "../lib/redis";
import { createLogger } from "../lib/logger";
import { queueDebateStep } from "../jobs/debateOrchestrator";
import { isUniqueViolation } from "../lib/databaseErrors";
import { withSpan } from "../lib/telemetry";
import type { GraphQLContext } from "./index";
import { GraphQLError } from "graphql";
import { createDebateRequestSchema, parseGraphQLInput, voteRequestSchema } from "../middleware/validation";

const logger = createLogger("graphql");

const CACHE_TTL = 60;

function requireGraphQLUser(context: GraphQLContext) {
  if (!context.user) {
    throw new GraphQLError("Authentication required", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return context.user;
}

export const resolvers = {
  DateTime: {
    __serialize: (value: Date) => value.toISOString(),
    __parseValue: (value: string) => new Date(value),
    __parseLiteral: (ast: any) => new Date(ast.value),
  },

  Query: {
    debates: async () => {
      return withSpan("query.debates", async () => {
        const cacheKey = "debates:all";
        const cached = await cache.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached debates list");
          return cached;
        }

        const debates = await storage.getAllDebates();
        const argumentCounts = await storage.getArgumentCountsByDebate(debates.map((debate) => debate.id));
        const debatesWithCounts = debates.map((debate) => ({
          ...debate,
          argumentCount: argumentCounts[debate.id] ?? 0,
          spectatorCount: 0,
        }));

        await cache.set(cacheKey, debatesWithCounts, CACHE_TTL);
        return debatesWithCounts;
      });
    },

    debate: async (_: any, { id }: { id: string }) => {
      return withSpan("query.debate", async (span) => {
        span.setAttribute("debate.id", id);

        const cacheKey = `debate:${id}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
          logger.debug({ debateId: id }, "Returning cached debate");
          return cached;
        }

        const debate = await storage.getDebate(id);
        if (!debate) return null;

        const args = await storage.getArgumentsByDebate(id);
        const result = {
          ...debate,
          argumentCount: args.length,
          spectatorCount: 0,
        };

        await cache.set(cacheKey, result, CACHE_TTL);
        return result;
      });
    },

    arguments: async (_: any, { debateId }: { debateId: string }) => {
      return withSpan("query.arguments", async (span) => {
        span.setAttribute("debate.id", debateId);

        const cacheKey = `debate:${debateId}:arguments`;
        const cached = await cache.get(cacheKey);
        if (cached) {
          return cached;
        }

        const args = await storage.getArgumentsByDebate(debateId);
        const allVotes = await storage.getVotesByDebate(debateId);

        const argsWithVotes = args.map((arg) => ({
          ...arg,
          voteCount: allVotes.filter((v) => v.argumentId === arg.id).length,
        }));

        await cache.set(cacheKey, argsWithVotes, 30);
        return argsWithVotes;
      });
    },
  },

  Mutation: {
    createDebate: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      return withSpan("mutation.createDebate", async (span) => {
        const user = requireGraphQLUser(context);
        const validInput = parseGraphQLInput(createDebateRequestSchema, input);
        span.setAttribute("debate.topic", validInput.topic);

        const personaA = await storage.createPersona({
          name: validInput.personaAName,
          tone: validInput.personaATone,
          bias: validInput.personaABias,
          createdByGithubId: user.githubId,
        });

        const personaB = await storage.createPersona({
          name: validInput.personaBName,
          tone: validInput.personaBTone,
          bias: validInput.personaBBias,
          createdByGithubId: user.githubId,
        });

        const debate = await storage.createDebate({
          topic: validInput.topic,
          personaAId: personaA.id,
          personaBId: personaB.id,
          totalRounds: validInput.totalRounds,
          createdByGithubId: user.githubId,
        });

        await cache.invalidatePattern("debates:*");
        await queueDebateStep(debate.id, 2_000);

        logger.info({ debateId: debate.id }, "Debate created via GraphQL");

        return {
          debateId: debate.id,
          debate: {
            ...debate,
            personaA,
            personaB,
            argumentCount: 0,
            spectatorCount: 0,
          },
        };
      });
    },

    vote: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      return withSpan("mutation.vote", async (span) => {
        const user = requireGraphQLUser(context);
        const validInput = parseGraphQLInput(voteRequestSchema, input);
        span.setAttribute("argument.id", validInput.argumentId);

        const debate = await storage.getDebate(validInput.debateId);
        const debateArguments = debate ? await storage.getArgumentsByDebate(validInput.debateId) : [];
        if (!debate || !debateArguments.some((argument) => argument.id === validInput.argumentId)) {
          throw new GraphQLError("Argument not found for this debate", { extensions: { code: "NOT_FOUND" } });
        }

        const hasVoted = await storage.hasVoted(validInput.argumentId, user.githubId);
        if (hasVoted) {
          throw new Error("Already voted on this argument");
        }

        let vote;
        try {
          vote = await storage.createVote({
            argumentId: validInput.argumentId,
            debateId: validInput.debateId,
            voterFingerprint: user.githubId,
            voterGithubId: user.githubId,
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new GraphQLError("Already voted on this argument", { extensions: { code: "ALREADY_VOTED" } });
          }
          throw error;
        }

        await cache.del(`debate:${validInput.debateId}:arguments`);
        await cache.del(`debate:${validInput.debateId}`);
        await cache.invalidatePattern("debates:*");

        const args = await storage.getArgumentsByDebate(validInput.debateId);
        const argument = args.find((a) => a.id === validInput.argumentId)!;
        const allVotes = await storage.getVotesByDebate(validInput.debateId);

        return {
          vote,
          argument: {
            ...argument,
            voteCount: allVotes.filter((v) => v.argumentId === validInput.argumentId).length,
          },
        };
      });
    },
  },

  Debate: {
    arguments: async (debate: any) => {
      const args = await storage.getArgumentsByDebate(debate.id);
      const allVotes = await storage.getVotesByDebate(debate.id);

      return args.map((arg) => ({
        ...arg,
        voteCount: allVotes.filter((v) => v.argumentId === arg.id).length,
      }));
    },

    winner: async (debate: any) => {
      if (!debate.winnerId) return null;
      return storage.getPersona(debate.winnerId);
    },
  },

  Argument: {
    persona: async (argument: any) => {
      if (argument.persona) return argument.persona;
      return storage.getPersona(argument.personaId);
    },
  },
};
