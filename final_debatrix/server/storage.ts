import {
  debates,
  personas,
  debateArguments,
  votes,
  type Debate,
  type Persona,
  type Argument,
  type Vote,
  type InsertDebate,
  type InsertPersona,
  type InsertArgument,
  type InsertVote,
} from "@shared/schema";
import { db, hasDatabase } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Personas
  createPersona(persona: InsertPersona): Promise<Persona>;
  getPersona(id: string): Promise<Persona | undefined>;
  getAllPersonas(): Promise<Persona[]>;
  updatePersona(id: string, updates: Partial<InsertPersona>): Promise<Persona | undefined>;
  deletePersona(id: string): Promise<boolean>;

  // Debates
  createDebate(debate: InsertDebate): Promise<Debate>;
  getDebate(id: string): Promise<
    | (Debate & {
        personaA: Persona;
        personaB: Persona;
      })
    | undefined
  >;
  getAllDebates(): Promise<
    (Debate & {
      personaA: Persona;
      personaB: Persona;
    })[]
  >;
  updateDebate(
    id: string,
    updates: Partial<Debate>
  ): Promise<Debate | undefined>;

  // Arguments
  createArgument(argument: InsertArgument): Promise<Argument>;
  getArgumentsByDebate(debateId: string): Promise<
    (Argument & {
      persona: Persona;
    })[]
  >;

  // Votes
  createVote(vote: InsertVote): Promise<Vote>;
  getVotesByDebate(debateId: string): Promise<Vote[]>;
  getAllVotes(): Promise<Vote[]>;
  hasVoted(argumentId: string, fingerprint: string): Promise<boolean>;
  
  // Judgment
  setDebateWinner(debateId: string, winnerId: string, judgmentSummary: string): Promise<void>;
  
  // Analytics
  getStats(): Promise<{
    totalDebates: number;
    activeDebates: number;
    completedDebates: number;
    totalArguments: number;
    totalVotes: number;
    totalPersonas: number;
  }>;
  getPersonaStats(personaId: string): Promise<{
    totalDebates: number;
    wins: number;
    totalArguments: number;
    totalVotesReceived: number;
  }>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class MemStorage implements IStorage {
  private personas: Map<string, Persona> = new Map();
  private debates: Map<string, Debate> = new Map();
  private arguments: Map<string, Argument> = new Map();
  private votes: Map<string, Vote> = new Map();

  async createPersona(insertPersona: InsertPersona): Promise<Persona> {
    const persona: Persona = {
      id: generateId(),
      ...insertPersona,
      createdAt: new Date(),
    };
    this.personas.set(persona.id, persona);
    return persona;
  }

  async getPersona(id: string): Promise<Persona | undefined> {
    return this.personas.get(id);
  }

  async getAllPersonas(): Promise<Persona[]> {
    return Array.from(this.personas.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updatePersona(id: string, updates: Partial<InsertPersona>): Promise<Persona | undefined> {
    const persona = this.personas.get(id);
    if (!persona) return undefined;
    const updated = { ...persona, ...updates };
    this.personas.set(id, updated);
    return updated;
  }

  async deletePersona(id: string): Promise<boolean> {
    const hasDebates = Array.from(this.debates.values()).some(
      d => d.personaAId === id || d.personaBId === id
    );
    if (hasDebates) return false;
    return this.personas.delete(id);
  }

  async createDebate(insertDebate: InsertDebate): Promise<Debate> {
    const debate: Debate = {
      id: generateId(),
      topic: insertDebate.topic,
      personaAId: insertDebate.personaAId,
      personaBId: insertDebate.personaBId,
      totalRounds: insertDebate.totalRounds ?? 3,
      status: "active",
      currentRound: 1,
      winnerId: insertDebate.winnerId ?? null,
      judgmentSummary: insertDebate.judgmentSummary ?? null,
      createdAt: new Date(),
    };
    this.debates.set(debate.id, debate);
    return debate;
  }

  async getDebate(id: string): Promise<
    | (Debate & {
        personaA: Persona;
        personaB: Persona;
      })
    | undefined
  > {
    const debate = this.debates.get(id);
    if (!debate) return undefined;

    const personaA = this.personas.get(debate.personaAId);
    const personaB = this.personas.get(debate.personaBId);

    if (!personaA || !personaB) return undefined;

    return {
      ...debate,
      personaA,
      personaB,
    };
  }

  async getAllDebates(): Promise<
    (Debate & {
      personaA: Persona;
      personaB: Persona;
    })[]
  > {
    const debatesArray = Array.from(this.debates.values());
    debatesArray.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const debatesWithPersonas = debatesArray
      .map((debate) => {
        const personaA = this.personas.get(debate.personaAId);
        const personaB = this.personas.get(debate.personaBId);

        if (!personaA || !personaB) return null;

        return {
          ...debate,
          personaA,
          personaB,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    return debatesWithPersonas;
  }

  async updateDebate(
    id: string,
    updates: Partial<Debate>
  ): Promise<Debate | undefined> {
    const debate = this.debates.get(id);
    if (!debate) return undefined;

    const updated = { ...debate, ...updates };
    this.debates.set(id, updated);
    return updated;
  }

  async createArgument(insertArgument: InsertArgument): Promise<Argument> {
    const argument: Argument = {
      id: generateId(),
      ...insertArgument,
      createdAt: new Date(),
    };
    this.arguments.set(argument.id, argument);
    return argument;
  }

  async getArgumentsByDebate(debateId: string): Promise<
    (Argument & {
      persona: Persona;
    })[]
  > {
    const argumentsArray = Array.from(this.arguments.values())
      .filter((arg) => arg.debateId === debateId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const argumentsWithPersonas = argumentsArray
      .map((argument) => {
        const persona = this.personas.get(argument.personaId);
        if (!persona) return null;

        return {
          ...argument,
          persona,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    return argumentsWithPersonas;
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const vote: Vote = {
      id: generateId(),
      ...insertVote,
      createdAt: new Date(),
    };
    this.votes.set(vote.id, vote);
    return vote;
  }

  async getVotesByDebate(debateId: string): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(
      (vote) => vote.debateId === debateId
    );
  }

  async getAllVotes(): Promise<Vote[]> {
    return Array.from(this.votes.values());
  }

  async hasVoted(argumentId: string, fingerprint: string): Promise<boolean> {
    return Array.from(this.votes.values()).some(
      (vote) =>
        vote.argumentId === argumentId &&
        vote.voterFingerprint === fingerprint
    );
  }

  async setDebateWinner(
    debateId: string,
    winnerId: string,
    judgmentSummary: string
  ): Promise<void> {
    const debate = this.debates.get(debateId);
    if (!debate) return;

    const updated: Debate = {
      ...debate,
      winnerId,
      judgmentSummary,
      status: "completed",
    };
    this.debates.set(debateId, updated);
  }

  async getStats(): Promise<{
    totalDebates: number;
    activeDebates: number;
    completedDebates: number;
    totalArguments: number;
    totalVotes: number;
    totalPersonas: number;
  }> {
    const debatesArray = Array.from(this.debates.values());
    return {
      totalDebates: debatesArray.length,
      activeDebates: debatesArray.filter(d => d.status === "active" || d.status === "paused").length,
      completedDebates: debatesArray.filter(d => d.status === "completed").length,
      totalArguments: this.arguments.size,
      totalVotes: this.votes.size,
      totalPersonas: this.personas.size,
    };
  }

  async getPersonaStats(personaId: string): Promise<{
    totalDebates: number;
    wins: number;
    totalArguments: number;
    totalVotesReceived: number;
  }> {
    const debatesArray = Array.from(this.debates.values());
    const argumentsArray = Array.from(this.arguments.values());
    const votesArray = Array.from(this.votes.values());
    
    const personaDebates = debatesArray.filter(
      d => d.personaAId === personaId || d.personaBId === personaId
    );
    const personaArgs = argumentsArray.filter(a => a.personaId === personaId);
    const personaArgIds = new Set(personaArgs.map(a => a.id));
    const personaVotes = votesArray.filter(v => personaArgIds.has(v.argumentId));
    
    return {
      totalDebates: personaDebates.length,
      wins: personaDebates.filter(d => d.winnerId === personaId).length,
      totalArguments: personaArgs.length,
      totalVotesReceived: personaVotes.length,
    };
  }
}

export class DatabaseStorage implements IStorage {
  async createPersona(insertPersona: InsertPersona): Promise<Persona> {
    const [persona] = await db!
      .insert(personas)
      .values(insertPersona)
      .returning();
    return persona;
  }

  async getPersona(id: string): Promise<Persona | undefined> {
    const [persona] = await db!
      .select()
      .from(personas)
      .where(eq(personas.id, id));
    return persona;
  }

  async getAllPersonas(): Promise<Persona[]> {
    return await db!
      .select()
      .from(personas)
      .orderBy(desc(personas.createdAt));
  }

  async updatePersona(id: string, updates: Partial<InsertPersona>): Promise<Persona | undefined> {
    const [updated] = await db!
      .update(personas)
      .set(updates)
      .where(eq(personas.id, id))
      .returning();
    return updated;
  }

  async deletePersona(id: string): Promise<boolean> {
    const debatesUsingPersona = await db!
      .select()
      .from(debates)
      .where(eq(debates.personaAId, id))
      .limit(1);
    
    if (debatesUsingPersona.length > 0) return false;
    
    const debatesUsingPersonaB = await db!
      .select()
      .from(debates)
      .where(eq(debates.personaBId, id))
      .limit(1);
    
    if (debatesUsingPersonaB.length > 0) return false;
    
    await db!.delete(personas).where(eq(personas.id, id));
    return true;
  }

  async createDebate(insertDebate: InsertDebate): Promise<Debate> {
    const [debate] = await db!.insert(debates).values(insertDebate).returning();
    return debate;
  }

  async getDebate(id: string): Promise<
    | (Debate & {
        personaA: Persona;
        personaB: Persona;
      })
    | undefined
  > {
    const [result] = await db!
      .select()
      .from(debates)
      .where(eq(debates.id, id))
      .leftJoin(personas, eq(debates.personaAId, personas.id));

    if (!result) return undefined;

    const [personaB] = await db!
      .select()
      .from(personas)
      .where(eq(personas.id, result.debates.personaBId));

    return {
      ...result.debates,
      personaA: result.personas!,
      personaB: personaB,
    };
  }

  async getAllDebates(): Promise<
    (Debate & {
      personaA: Persona;
      personaB: Persona;
    })[]
  > {
    const results = await db!
      .select()
      .from(debates)
      .orderBy(desc(debates.createdAt));

    const debatesWithPersonas = await Promise.all(
      results.map(async (debate) => {
        const [personaA] = await db!
          .select()
          .from(personas)
          .where(eq(personas.id, debate.personaAId));

        const [personaB] = await db!
          .select()
          .from(personas)
          .where(eq(personas.id, debate.personaBId));

        return {
          ...debate,
          personaA,
          personaB,
        };
      })
    );

    return debatesWithPersonas;
  }

  async updateDebate(
    id: string,
    updates: Partial<Debate>
  ): Promise<Debate | undefined> {
    const [updated] = await db!
      .update(debates)
      .set(updates)
      .where(eq(debates.id, id))
      .returning();
    return updated;
  }

  async createArgument(insertArgument: InsertArgument): Promise<Argument> {
    const [argument] = await db!
      .insert(debateArguments)
      .values(insertArgument)
      .returning();
    return argument;
  }

  async getArgumentsByDebate(debateId: string): Promise<
    (Argument & {
      persona: Persona;
    })[]
  > {
    const results = await db!
      .select()
      .from(debateArguments)
      .where(eq(debateArguments.debateId, debateId))
      .leftJoin(personas, eq(debateArguments.personaId, personas.id))
      .orderBy(debateArguments.createdAt);

    return results.map((r) => ({
      ...r.arguments,
      persona: r.personas!,
    }));
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const [vote] = await db!.insert(votes).values(insertVote).returning();
    return vote;
  }

  async getVotesByDebate(debateId: string): Promise<Vote[]> {
    return await db!.select().from(votes).where(eq(votes.debateId, debateId));
  }

  async hasVoted(argumentId: string, fingerprint: string): Promise<boolean> {
    const [vote] = await db!
      .select()
      .from(votes)
      .where(and(
        eq(votes.argumentId, argumentId),
        eq(votes.voterFingerprint, fingerprint)
      ))
      .limit(1);

    return !!vote;
  }

  async setDebateWinner(debateId: string, winnerId: string, judgmentSummary: string): Promise<void> {
    await db!
      .update(debates)
      .set({ 
        winnerId,
        judgmentSummary,
        status: "completed"
      })
      .where(eq(debates.id, debateId));
  }

  async getAllVotes(): Promise<Vote[]> {
    return await db!.select().from(votes);
  }

  async getStats(): Promise<{
    totalDebates: number;
    activeDebates: number;
    completedDebates: number;
    totalArguments: number;
    totalVotes: number;
    totalPersonas: number;
  }> {
    const allDebates = await db!.select().from(debates);
    const allArgs = await db!.select().from(debateArguments);
    const allVotes = await db!.select().from(votes);
    const allPersonas = await db!.select().from(personas);
    
    return {
      totalDebates: allDebates.length,
      activeDebates: allDebates.filter(d => d.status === "active" || d.status === "paused").length,
      completedDebates: allDebates.filter(d => d.status === "completed").length,
      totalArguments: allArgs.length,
      totalVotes: allVotes.length,
      totalPersonas: allPersonas.length,
    };
  }

  async getPersonaStats(personaId: string): Promise<{
    totalDebates: number;
    wins: number;
    totalArguments: number;
    totalVotesReceived: number;
  }> {
    const allDebates = await db!.select().from(debates);
    const allArgs = await db!.select().from(debateArguments).where(eq(debateArguments.personaId, personaId));
    const allVotes = await db!.select().from(votes);
    
    const personaDebates = allDebates.filter(
      d => d.personaAId === personaId || d.personaBId === personaId
    );
    const personaArgIds = new Set(allArgs.map(a => a.id));
    const personaVotes = allVotes.filter(v => personaArgIds.has(v.argumentId));
    
    return {
      totalDebates: personaDebates.length,
      wins: personaDebates.filter(d => d.winnerId === personaId).length,
      totalArguments: allArgs.length,
      totalVotesReceived: personaVotes.length,
    };
  }
}

export const storage = hasDatabase ? new DatabaseStorage() : new MemStorage();
console.log(`[storage] Using ${hasDatabase ? 'database' : 'in-memory'} storage`);
