import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { cache, hasRedis, pubsub } from "./lib/redis";
import { getAuthenticatedUser, requireUser } from "./auth";
import { queueDebateStep } from "./jobs/debateOrchestrator";
import { isUniqueViolation } from "./lib/databaseErrors";
import { createLogger } from "./lib/logger";
import { rateLimit } from "./middleware/rateLimit";
import {
  createDebateRequestSchema,
  debateListQuerySchema,
  personaRequestSchema,
  resourceParamsSchema,
  validate,
  voteRequestSchema,
  webSocketMessageSchema,
} from "./middleware/validation";

interface DebateClient {
  ws: WebSocket;
  debateId: string;
}

const clients = new Map<WebSocket, DebateClient>();
const subscribedDebateTopics = new Set<string>();
const logger = createLogger("routes");
const authenticatedRateLimitKey = (req: Parameters<ReturnType<typeof rateLimit>>[0]) => getAuthenticatedUser(req)?.githubId || "";

function isOwnedBy(userId: string, resource: { createdByGithubId: string | null }): boolean {
  return resource.createdByGithubId === userId;
}

function sendForbidden(res: Response): void {
  res.status(403).json({ error: "You do not have permission to modify this resource", code: "FORBIDDEN" });
}

function broadcastToDebate(
  wss: WebSocketServer,
  debateId: string,
  message: any
) {
  wss.clients.forEach((client) => {
    const clientData = clients.get(client);
    if (
      clientData?.debateId === debateId &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(JSON.stringify(message));
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 32 * 1024 });

  const subscribeToDebate = async (debateId: string) => {
    const topic = `debate:${debateId}`;
    if (!hasRedis || subscribedDebateTopics.has(topic)) return;
    subscribedDebateTopics.add(topic);
    await pubsub.subscribe(topic, (event) => broadcastToDebate(wss, debateId, event));
  };

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const message = webSocketMessageSchema.safeParse(JSON.parse(data.toString()));

        if (message.success) {
          clients.set(ws, { ws, debateId: message.data.debateId });
          void subscribeToDebate(message.data.debateId);
        }
      } catch (error) {
        logger.warn({ err: error }, "WebSocket message handling failed");
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  app.get("/api/debates", validate({ query: debateListQuerySchema }), async (req, res) => {
    try {
      const { search, status, sortBy } = req.query as { 
        search?: string; 
        status?: string;
        sortBy?: string;
      };
      
      let debates = await storage.getAllDebates();
      
      if (search) {
        const searchLower = search.toLowerCase();
        debates = debates.filter(d => 
          d.topic.toLowerCase().includes(searchLower) ||
          d.personaA.name.toLowerCase().includes(searchLower) ||
          d.personaB.name.toLowerCase().includes(searchLower)
        );
      }
      
      if (status && status !== "all") {
        debates = debates.filter(d => d.status === status);
      }
      
      const argumentCounts = await storage.getArgumentCountsByDebate(debates.map((debate) => debate.id));
      const debatesWithCounts = debates.map((debate) => ({
        ...debate,
        argumentCount: argumentCounts[debate.id] ?? 0,
        spectatorCount: 0,
      }));

      if (sortBy === "arguments") {
        debatesWithCounts.sort((a, b) => b.argumentCount - a.argumentCount);
      } else if (sortBy === "oldest") {
        debatesWithCounts.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }

      res.json(debatesWithCounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debates" });
    }
  });

  app.get("/api/debates/:id", validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
      }
      res.json(debate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debate" });
    }
  });

  app.post(
    "/api/debates",
    requireUser,
    rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 3, keyPrefix: "debate-create", keyGenerator: authenticatedRateLimitKey }),
    validate({ body: createDebateRequestSchema }),
    async (req, res) => {
    try {
      const user = getAuthenticatedUser(req)!;
      const {
        topic,
        personaAName,
        personaATone,
        personaABias,
        personaBName,
        personaBTone,
        personaBBias,
        totalRounds,
      } = req.body;

      const personaA = await storage.createPersona({
        name: personaAName,
        tone: personaATone,
        bias: personaABias,
        createdByGithubId: user.githubId,
      });

      const personaB = await storage.createPersona({
        name: personaBName,
        tone: personaBTone,
        bias: personaBBias,
        createdByGithubId: user.githubId,
      });

      const debate = await storage.createDebate({
        topic,
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds,
        createdByGithubId: user.githubId,
      });

      logger.info({ debateId: debate.id }, "Debate created");

      await cache.invalidatePattern("debates:*");
      await queueDebateStep(debate.id, 2_000);
      res.status(201).json({ debateId: debate.id });
    } catch (error) {
      logger.error({ err: error }, "Debate creation failed");
      res.status(500).json({ error: "Failed to create debate" });
    }
    },
  );

  app.get("/api/debates/:id/arguments", validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
      }
      const args = await storage.getArgumentsByDebate(req.params.id);
      const allVotes = await storage.getVotesByDebate(req.params.id);

      const argsWithVotes = args.map((arg) => ({
        ...arg,
        voteCount: allVotes.filter((v) => v.argumentId === arg.id).length,
      }));

      res.json({ debateArguments: argsWithVotes });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch arguments" });
    }
  });

  app.post(
    "/api/votes",
    requireUser,
    rateLimit({ windowMs: 60 * 1000, maxRequests: 20, keyPrefix: "vote", keyGenerator: authenticatedRateLimitKey }),
    validate({ body: voteRequestSchema }),
    async (req, res) => {
    try {
      const { argumentId, debateId } = req.body;
      const user = getAuthenticatedUser(req)!;

      const debate = await storage.getDebate(debateId);
      const debateArguments = debate ? await storage.getArgumentsByDebate(debateId) : [];
      if (!debate || !debateArguments.some((argument) => argument.id === argumentId)) {
        return res.status(404).json({ error: "Argument not found for this debate" });
      }

      const hasVoted = await storage.hasVoted(argumentId, user.githubId);
      if (hasVoted) {
        return res.status(409).json({ error: "Already voted", code: "ALREADY_VOTED" });
      }

      const vote = await storage.createVote({
        argumentId,
        debateId,
        // Retained while older databases still have a NOT NULL fingerprint column.
        // The value is server-derived; clients cannot impersonate another voter.
        voterFingerprint: user.githubId,
        voterGithubId: user.githubId,
      });

      await cache.del(`debate:${debateId}:arguments`);
      await cache.del(`debate:${debateId}`);
      await cache.invalidatePattern("debates:*");

      res.json({
        id: vote.id,
        argumentId: vote.argumentId,
        debateId: vote.debateId,
        createdAt: vote.createdAt,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ error: "Already voted", code: "ALREADY_VOTED" });
      }
      res.status(500).json({ error: "Failed to record vote" });
    }
    },
  );

  // Debate controls
  app.post("/api/debates/:id/pause", requireUser, validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
      }
      if (!isOwnedBy(getAuthenticatedUser(req)!.githubId, debate)) {
        sendForbidden(res);
        return;
      }
      if (debate.status !== "active") {
        return res.status(400).json({ error: "Can only pause active debates" });
      }
      
      await storage.updateDebate(req.params.id, { status: "paused" });
      await cache.del(`debate:${req.params.id}`);
      await cache.invalidatePattern("debates:*");
      
      broadcastToDebate(wss, req.params.id, { type: "status", status: "paused" });
      res.json({ success: true, status: "paused" });
    } catch (error) {
      res.status(500).json({ error: "Failed to pause debate" });
    }
  });

  app.post("/api/debates/:id/resume", requireUser, validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
      }
      if (!isOwnedBy(getAuthenticatedUser(req)!.githubId, debate)) {
        sendForbidden(res);
        return;
      }
      if (debate.status !== "paused" && debate.status !== "error") {
        return res.status(400).json({ error: "Can only resume paused or failed debates" });
      }
      
      await storage.updateDebate(req.params.id, { status: "active" });
      await cache.del(`debate:${req.params.id}`);
      await cache.invalidatePattern("debates:*");
      
      broadcastToDebate(wss, req.params.id, { type: "status", status: "active" });
      
      // An exhausted job may still exist in Redis. Use a fresh job ID so a
      // user-initiated retry can be enqueued after the underlying issue is fixed.
      await queueDebateStep(req.params.id, 1_000, { forceNewJob: true });
      res.json({ success: true, status: "active" });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume debate" });
    }
  });

  app.post("/api/debates/:id/skip", requireUser, validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
      }
      if (!isOwnedBy(getAuthenticatedUser(req)!.githubId, debate)) {
        sendForbidden(res);
        return;
      }
      if (debate.status === "completed") {
        return res.status(400).json({ error: "Debate already completed" });
      }
      
      await storage.updateDebate(req.params.id, { 
        currentRound: debate.totalRounds,
        status: "active"
      });
      await cache.del(`debate:${req.params.id}`);
      await cache.invalidatePattern("debates:*");
      
      await queueDebateStep(req.params.id, 500);
      res.json({ success: true, message: "Skipping to final judgment" });
    } catch (error) {
      res.status(500).json({ error: "Failed to skip debate" });
    }
  });

  // Persona management
  app.get("/api/personas", async (req, res) => {
    try {
      const personasList = await storage.getAllPersonas();
      const personasWithStats = await Promise.all(
        personasList.map(async (persona) => {
          const stats = await storage.getPersonaStats(persona.id);
          return { ...persona, ...stats };
        })
      );
      res.json(personasWithStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch personas" });
    }
  });

  app.post("/api/personas", requireUser, validate({ body: personaRequestSchema }), async (req, res) => {
    try {
      const { name, tone, bias } = req.body;
      const persona = await storage.createPersona({
        name,
        tone,
        bias,
        createdByGithubId: getAuthenticatedUser(req)!.githubId,
      });
      res.json(persona);
    } catch (error) {
      res.status(500).json({ error: "Failed to create persona" });
    }
  });

  app.patch("/api/personas/:id", requireUser, validate({ params: resourceParamsSchema, body: personaRequestSchema }), async (req, res) => {
    try {
      const { name, tone, bias } = req.body;
      const persona = await storage.getPersona(req.params.id);
      if (!persona) {
        return res.status(404).json({ error: "Persona not found" });
      }
      if (!isOwnedBy(getAuthenticatedUser(req)!.githubId, persona)) {
        sendForbidden(res);
        return;
      }
      const updated = await storage.updatePersona(req.params.id, { name, tone, bias });
      if (!updated) {
        return res.status(404).json({ error: "Persona not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update persona" });
    }
  });

  app.delete("/api/personas/:id", requireUser, validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const persona = await storage.getPersona(req.params.id);
      if (!persona) {
        return res.status(404).json({ error: "Persona not found" });
      }
      if (!isOwnedBy(getAuthenticatedUser(req)!.githubId, persona)) {
        sendForbidden(res);
        return;
      }
      const deleted = await storage.deletePersona(req.params.id);
      if (!deleted) {
        return res.status(400).json({ error: "Cannot delete persona used in debates" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete persona" });
    }
  });

  app.get("/api/personas/:id/stats", validate({ params: resourceParamsSchema }), async (req, res) => {
    try {
      const stats = await storage.getPersonaStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch persona stats" });
    }
  });

  // Analytics
  app.get("/api/analytics/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/analytics/trending", async (req, res) => {
    try {
      const allDebates = await storage.getAllDebates();
      const topicCounts: Record<string, number> = {};
      
      allDebates.forEach(debate => {
        const words = debate.topic.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3) {
            topicCounts[word] = (topicCounts[word] || 0) + 1;
          }
        });
      });
      
      const trending = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
      
      res.json(trending);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trending topics" });
    }
  });

  app.get("/api/analytics/activity", async (req, res) => {
    try {
      const debates = await storage.getAllDebates();
      const recentDebates = debates.slice(0, 10).map(d => ({
        id: d.id,
        topic: d.topic,
        status: d.status,
        createdAt: d.createdAt,
        personaA: d.personaA.name,
        personaB: d.personaB.name,
      }));
      res.json(recentDebates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  return httpServer;
}
