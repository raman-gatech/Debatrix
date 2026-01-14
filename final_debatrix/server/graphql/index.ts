import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { createLogger } from "../lib/logger";
import type { Express, Request, Response } from "express";
import cors from "cors";
import express from "express";

const logger = createLogger("graphql");

export async function setupGraphQL(app: Express): Promise<void> {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    formatError: (error) => {
      logger.error({ error: error.message }, "GraphQL error");
      return error;
    },
  });

  await server.start();

  app.use("/graphql", cors(), express.json());
  
  app.post("/graphql", async (req: Request, res: Response) => {
    const { query, variables, operationName } = req.body;
    
    try {
      const result = await server.executeOperation({
        query,
        variables,
        operationName,
      });
      
      if (result.body.kind === "single") {
        res.json(result.body.singleResult);
      } else {
        res.json({ errors: [{ message: "Subscription not supported over HTTP" }] });
      }
    } catch (error) {
      logger.error({ error }, "GraphQL execution error");
      res.status(500).json({ errors: [{ message: "Internal server error" }] });
    }
  });

  logger.info("GraphQL server started at /graphql");
}
