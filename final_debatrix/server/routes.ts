import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateArgument, judgeDebate } from "./openai";
import { cache } from "./lib/redis";

interface DebateClient {
  ws: WebSocket;
  debateId: string;
}

const clients = new Map<WebSocket, DebateClient>();

async function runDebateOrchestrator(debateId: string, wss: WebSocketServer) {
  const debate = await storage.getDebate(debateId);
  if (!debate || (debate.status !== "active" && debate.status !== "paused")) return;
  if (debate.status === "paused") return;

  const existingArgs = await storage.getArgumentsByDebate(debateId);
  const currentRound = debate.currentRound;
  const roundArgs = existingArgs.filter((a) => a.roundNumber === currentRound);

  let currentPersona = debate.personaA;
  let currentPersonaId = debate.personaAId;

  if (roundArgs.length === 1) {
    currentPersona = debate.personaB;
    currentPersonaId = debate.personaBId;
  } else if (roundArgs.length >= 2) {
    if (currentRound < debate.totalRounds) {
      await storage.updateDebate(debateId, {
        currentRound: currentRound + 1,
      });
      await cache.del(`debate:${debateId}`);
      await cache.invalidatePattern("debates:*");
      setTimeout(() => runDebateOrchestrator(debateId, wss), 2000);
    } else {
      const allArgs = await storage.getArgumentsByDebate(debateId);
      const argsForJudge = allArgs.map(arg => ({
        personaName: arg.persona.name,
        personaId: arg.personaId,
        content: arg.content,
        roundNumber: arg.roundNumber
      }));

      try {
        const judgment = await judgeDebate(
          debate.topic,
          debate.personaA.name,
          debate.personaB.name,
          argsForJudge
        );

        await storage.setDebateWinner(debateId, judgment.winnerId, judgment.judgmentSummary);

        await cache.del(`debate:${debateId}:arguments`);
        await cache.del(`debate:${debateId}`);
        await cache.invalidatePattern("debates:*");

        broadcastToDebate(wss, debateId, {
          type: "judgment",
          winnerId: judgment.winnerId,
          judgmentSummary: judgment.judgmentSummary
        });
      } catch (error) {
        console.error("Error judging debate:", error);
        await storage.updateDebate(debateId, { status: "completed" });
        await cache.del(`debate:${debateId}`);
        await cache.invalidatePattern("debates:*");
      }
    }
    return;
  }

  broadcastToDebate(wss, debateId, {
    type: "typing",
    personaName: currentPersona.name,
  });

  const previousArgs = existingArgs.map(
    (arg) => `${arg.persona.name}: ${arg.content}`
  );

  try {
    const argumentContent = await generateArgument(
      debate.topic,
      currentPersona.name,
      currentPersona.tone,
      currentPersona.bias,
      previousArgs,
      currentRound
    );

    const newArgument = await storage.createArgument({
      debateId,
      personaId: currentPersonaId,
      content: argumentContent,
      roundNumber: currentRound,
    });

    await cache.del(`debate:${debateId}:arguments`);
    await cache.del(`debate:${debateId}`);
    await cache.invalidatePattern("debates:*");

    broadcastToDebate(wss, debateId, {
      type: "argument",
      argument: newArgument,
    });

    setTimeout(() => runDebateOrchestrator(debateId, wss), 3000);
  } catch (error) {
    console.error("Error generating argument:", error);
    await storage.updateDebate(debateId, { status: "error" });
    await cache.del(`debate:${debateId}`);
    await cache.invalidatePattern("debates:*");
    
    broadcastToDebate(wss, debateId, {
      type: "error",
      message: error instanceof Error ? error.message : "Failed to generate argument",
    });
  }
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
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "join" && message.debateId) {
          clients.set(ws, { ws, debateId: message.debateId });
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  app.get("/api/debates", async (req, res) => {
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

  app.get("/api/debates/:id", async (req, res) => {
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

  app.post("/api/debates", async (req, res) => {
    try {
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
      });

      const personaB = await storage.createPersona({
        name: personaBName,
        tone: personaBTone,
        bias: personaBBias,
      });

      const debate = await storage.createDebate({
        topic,
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds,
      });

      console.log("Created debate with ID:", debate.id);

      await cache.invalidatePattern("debates:*");

      res.json({ debateId: debate.id });

      setTimeout(() => runDebateOrchestrator(debate.id, wss), 2000);
    } catch (error) {
      console.error("Error creating debate:", error);
      res.status(500).json({ error: "Failed to create debate" });
    }
  });

  app.get("/api/debates/:id/arguments", async (req, res) => {
    try {
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

  app.post("/api/votes", async (req, res) => {
    try {
      const { argumentId, debateId, voterFingerprint } = req.body;

      const hasVoted = await storage.hasVoted(argumentId, voterFingerprint);
      if (hasVoted) {
        return res.status(400).json({ error: "Already voted" });
      }

      const vote = await storage.createVote({
        argumentId,
        debateId,
        voterFingerprint,
      });

      await cache.del(`debate:${debateId}:arguments`);
      await cache.del(`debate:${debateId}`);
      await cache.invalidatePattern("debates:*");

      res.json(vote);
    } catch (error) {
      res.status(500).json({ error: "Failed to record vote" });
    }
  });

  // Debate controls
  app.post("/api/debates/:id/pause", async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
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

  app.post("/api/debates/:id/resume", async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
      }
      if (debate.status !== "paused") {
        return res.status(400).json({ error: "Can only resume paused debates" });
      }
      
      await storage.updateDebate(req.params.id, { status: "active" });
      await cache.del(`debate:${req.params.id}`);
      await cache.invalidatePattern("debates:*");
      
      broadcastToDebate(wss, req.params.id, { type: "status", status: "active" });
      
      setTimeout(() => runDebateOrchestrator(req.params.id, wss), 1000);
      res.json({ success: true, status: "active" });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume debate" });
    }
  });

  app.post("/api/debates/:id/skip", async (req, res) => {
    try {
      const debate = await storage.getDebate(req.params.id);
      if (!debate) {
        return res.status(404).json({ error: "Debate not found" });
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
      
      setTimeout(() => runDebateOrchestrator(req.params.id, wss), 500);
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

  app.post("/api/personas", async (req, res) => {
    try {
      const { name, tone, bias } = req.body;
      if (!name || !tone || !bias) {
        return res.status(400).json({ error: "Name, tone, and bias are required" });
      }
      const persona = await storage.createPersona({ name, tone, bias });
      res.json(persona);
    } catch (error) {
      res.status(500).json({ error: "Failed to create persona" });
    }
  });

  app.patch("/api/personas/:id", async (req, res) => {
    try {
      const { name, tone, bias } = req.body;
      const updated = await storage.updatePersona(req.params.id, { name, tone, bias });
      if (!updated) {
        return res.status(404).json({ error: "Persona not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update persona" });
    }
  });

  app.delete("/api/personas/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePersona(req.params.id);
      if (!deleted) {
        return res.status(400).json({ error: "Cannot delete persona used in debates" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete persona" });
    }
  });

  app.get("/api/personas/:id/stats", async (req, res) => {
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
