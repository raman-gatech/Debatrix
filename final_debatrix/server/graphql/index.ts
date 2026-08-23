import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { createLogger } from "../lib/logger";
import type { Express, Request, Response } from "express";
import cors from "cors";
import express from "express";
import { getAuthenticatedUser, type AuthenticatedUser } from "../auth";
import { getOperationAST, parse } from "graphql";
import { rateLimit } from "../middleware/rateLimit";
import { graphQLRequestSchema, validate } from "../middleware/validation";

export interface GraphQLContext {
  user: AuthenticatedUser | undefined;
}

const logger = createLogger("graphql");
const isProduction = process.env.NODE_ENV === "production";

function getAllowedOrigin(): string {
  const origin = process.env.APP_ORIGIN || "http://localhost:5000";
  return new URL(origin).origin;
}

function isGraphQLMutation(req: Request): boolean {
  const { query, operationName } = req.body ?? {};
  if (typeof query !== "string") return false;
  try {
    return getOperationAST(parse(query), typeof operationName === "string" ? operationName : undefined)?.operation === "mutation";
  } catch {
    return false;
  }
}

export async function setupGraphQL(app: Express): Promise<void> {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: !isProduction,
    formatError: (error) => {
      logger.error({ error: error.message }, "GraphQL error");
      return error;
    },
  });

  await server.start();

  app.use("/graphql", cors({
    origin: getAllowedOrigin(),
    credentials: true,
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
  }), express.json({ limit: "32kb" }));
  
  app.post(
    "/graphql",
    validate({ body: graphQLRequestSchema }),
    rateLimit({
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
      keyPrefix: "graphql-mutation",
      keyGenerator: (req) => getAuthenticatedUser(req)?.githubId || "",
      skip: (req) => !isGraphQLMutation(req),
    }),
    async (req: Request, res: Response) => {
    const { query, variables, operationName } = req.body;
    
    try {
      const result = await server.executeOperation(
        { query, variables, operationName },
        { contextValue: { user: getAuthenticatedUser(req) } satisfies GraphQLContext },
      );
      
      if (result.body.kind === "single") {
        res.json(result.body.singleResult);
      } else {
        res.json({ errors: [{ message: "Subscription not supported over HTTP" }] });
      }
    } catch (error) {
      logger.error({ error }, "GraphQL execution error");
      res.status(500).json({ errors: [{ message: "Internal server error" }] });
    }
    },
  );

  logger.info("GraphQL server started at /graphql");
}
