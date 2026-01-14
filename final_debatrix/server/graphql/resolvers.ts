import { storage } from "../storage";
import { cache } from "../lib/redis";
import { createLogger } from "../lib/logger";
import { withSpan } from "../lib/telemetry";

const logger = createLogger("graphql");

const CACHE_TTL = 60;

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
        const debatesWithCounts = await Promise.all(
          debates.map(async (debate) => {
            const args = await storage.getArgumentsByDebate(debate.id);
            return {
              ...debate,
              argumentCount: args.length,
              spectatorCount: 0,
            };
          })
        );

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
    createDebate: async (_: any, { input }: { input: any }) => {
      return withSpan("mutation.createDebate", async (span) => {
        span.setAttribute("debate.topic", input.topic);

        const personaA = await storage.createPersona({
          name: input.personaAName,
          tone: input.personaATone,
          bias: input.personaABias,
        });

        const personaB = await storage.createPersona({
          name: input.personaBName,
          tone: input.personaBTone,
          bias: input.personaBBias,
        });

        const debate = await storage.createDebate({
          topic: input.topic,
          personaAId: personaA.id,
          personaBId: personaB.id,
          totalRounds: input.totalRounds || 3,
        });

        await cache.invalidatePattern("debates:*");

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

    vote: async (_: any, { input }: { input: any }) => {
      return withSpan("mutation.vote", async (span) => {
        span.setAttribute("argument.id", input.argumentId);

        const hasVoted = await storage.hasVoted(input.argumentId, input.voterFingerprint);
        if (hasVoted) {
          throw new Error("Already voted on this argument");
        }

        const vote = await storage.createVote({
          argumentId: input.argumentId,
          debateId: input.debateId,
          voterFingerprint: input.voterFingerprint,
        });

        await cache.del(`debate:${input.debateId}:arguments`);
        await cache.del(`debate:${input.debateId}`);
        await cache.invalidatePattern("debates:*");

        const args = await storage.getArgumentsByDebate(input.debateId);
        const argument = args.find((a) => a.id === input.argumentId);
        const allVotes = await storage.getVotesByDebate(input.debateId);

        return {
          vote,
          argument: {
            ...argument,
            voteCount: allVotes.filter((v) => v.argumentId === input.argumentId).length,
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
