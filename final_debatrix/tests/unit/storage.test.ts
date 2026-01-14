import { describe, it, expect, beforeEach } from "vitest";
import { MemStorage } from "../../server/storage";

describe("MemStorage", () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe("Personas", () => {
    it("should create a persona", async () => {
      const persona = await storage.createPersona({
        name: "Test Persona",
        tone: "aggressive",
        bias: "liberal",
      });

      expect(persona).toBeDefined();
      expect(persona.id).toBeDefined();
      expect(persona.name).toBe("Test Persona");
      expect(persona.tone).toBe("aggressive");
      expect(persona.bias).toBe("liberal");
      expect(persona.createdAt).toBeInstanceOf(Date);
    });

    it("should get a persona by id", async () => {
      const created = await storage.createPersona({
        name: "Test Persona",
        tone: "calm",
        bias: "neutral",
      });

      const found = await storage.getPersona(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("Test Persona");
    });

    it("should return undefined for non-existent persona", async () => {
      const found = await storage.getPersona("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("Debates", () => {
    it("should create a debate with personas", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const debate = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      expect(debate).toBeDefined();
      expect(debate.id).toBeDefined();
      expect(debate.topic).toBe("Test Topic");
      expect(debate.status).toBe("active");
      expect(debate.currentRound).toBe(1);
      expect(debate.totalRounds).toBe(3);
    });

    it("should get a debate with personas", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const created = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      const found = await storage.getDebate(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.personaA.name).toBe("Persona A");
      expect(found?.personaB.name).toBe("Persona B");
    });

    it("should get all debates sorted by creation date", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      await storage.createDebate({
        topic: "First Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await storage.createDebate({
        topic: "Second Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      const debates = await storage.getAllDebates();

      expect(debates).toHaveLength(2);
      expect(debates[0].topic).toBe("Second Topic");
      expect(debates[1].topic).toBe("First Topic");
    });

    it("should update a debate", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const debate = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      const updated = await storage.updateDebate(debate.id, {
        currentRound: 2,
        status: "completed",
      });

      expect(updated).toBeDefined();
      expect(updated?.currentRound).toBe(2);
      expect(updated?.status).toBe("completed");
    });
  });

  describe("Arguments", () => {
    it("should create and retrieve arguments for a debate", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const debate = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      await storage.createArgument({
        debateId: debate.id,
        personaId: personaA.id,
        content: "First argument",
        roundNumber: 1,
      });

      await storage.createArgument({
        debateId: debate.id,
        personaId: personaB.id,
        content: "Second argument",
        roundNumber: 1,
      });

      const args = await storage.getArgumentsByDebate(debate.id);

      expect(args).toHaveLength(2);
      expect(args[0].content).toBe("First argument");
      expect(args[0].persona.name).toBe("Persona A");
      expect(args[1].content).toBe("Second argument");
      expect(args[1].persona.name).toBe("Persona B");
    });
  });

  describe("Votes", () => {
    it("should create and retrieve votes", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const debate = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      const argument = await storage.createArgument({
        debateId: debate.id,
        personaId: personaA.id,
        content: "Test argument",
        roundNumber: 1,
      });

      await storage.createVote({
        argumentId: argument.id,
        debateId: debate.id,
        voterFingerprint: "test-fingerprint",
      });

      const votes = await storage.getVotesByDebate(debate.id);

      expect(votes).toHaveLength(1);
      expect(votes[0].argumentId).toBe(argument.id);
    });

    it("should detect duplicate votes", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const debate = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      const argument = await storage.createArgument({
        debateId: debate.id,
        personaId: personaA.id,
        content: "Test argument",
        roundNumber: 1,
      });

      await storage.createVote({
        argumentId: argument.id,
        debateId: debate.id,
        voterFingerprint: "test-fingerprint",
      });

      const hasVoted = await storage.hasVoted(argument.id, "test-fingerprint");
      const hasNotVoted = await storage.hasVoted(argument.id, "other-fingerprint");

      expect(hasVoted).toBe(true);
      expect(hasNotVoted).toBe(false);
    });
  });

  describe("Judgment", () => {
    it("should set debate winner", async () => {
      const personaA = await storage.createPersona({
        name: "Persona A",
        tone: "aggressive",
        bias: "liberal",
      });

      const personaB = await storage.createPersona({
        name: "Persona B",
        tone: "calm",
        bias: "conservative",
      });

      const debate = await storage.createDebate({
        topic: "Test Topic",
        personaAId: personaA.id,
        personaBId: personaB.id,
        totalRounds: 3,
      });

      await storage.setDebateWinner(debate.id, personaA.id, "Persona A won because...");

      const updated = await storage.getDebate(debate.id);

      expect(updated?.winnerId).toBe(personaA.id);
      expect(updated?.judgmentSummary).toBe("Persona A won because...");
      expect(updated?.status).toBe("completed");
    });
  });
});
