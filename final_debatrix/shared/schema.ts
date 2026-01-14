import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const personas = pgTable("personas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tone: text("tone").notNull(),
  bias: text("bias").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const debates = pgTable("debates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topic: text("topic").notNull(),
  personaAId: varchar("persona_a_id").notNull().references(() => personas.id),
  personaBId: varchar("persona_b_id").notNull().references(() => personas.id),
  status: text("status").notNull().default("active"),
  totalRounds: integer("total_rounds").notNull().default(3),
  currentRound: integer("current_round").notNull().default(1),
  winnerId: varchar("winner_id").references(() => personas.id),
  judgmentSummary: text("judgment_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const debateArguments = pgTable("arguments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debateId: varchar("debate_id").notNull().references(() => debates.id),
  personaId: varchar("persona_id").notNull().references(() => personas.id),
  content: text("content").notNull(),
  roundNumber: integer("round_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  argumentId: varchar("argument_id").notNull().references(() => debateArguments.id),
  debateId: varchar("debate_id").notNull().references(() => debates.id),
  voterFingerprint: text("voter_fingerprint").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const personasRelations = relations(personas, ({ many }) => ({
  debatesAsA: many(debates, { relationName: "personaA" }),
  debatesAsB: many(debates, { relationName: "personaB" }),
  debateArguments: many(debateArguments),
}));

export const debatesRelations = relations(debates, ({ one, many }) => ({
  personaA: one(personas, {
    fields: [debates.personaAId],
    references: [personas.id],
    relationName: "personaA",
  }),
  personaB: one(personas, {
    fields: [debates.personaBId],
    references: [personas.id],
    relationName: "personaB",
  }),
  debateArguments: many(debateArguments),
  votes: many(votes),
}));

export const argumentsRelations = relations(debateArguments, ({ one, many }) => ({
  debate: one(debates, {
    fields: [debateArguments.debateId],
    references: [debates.id],
  }),
  persona: one(personas, {
    fields: [debateArguments.personaId],
    references: [personas.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  argument: one(debateArguments, {
    fields: [votes.argumentId],
    references: [debateArguments.id],
  }),
  debate: one(debates, {
    fields: [votes.debateId],
    references: [debates.id],
  }),
}));

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
  createdAt: true,
});

export const insertDebateSchema = createInsertSchema(debates).omit({
  id: true,
  createdAt: true,
  status: true,
  currentRound: true,
});

export const insertArgumentSchema = createInsertSchema(debateArguments).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

export type Debate = typeof debates.$inferSelect;
export type InsertDebate = z.infer<typeof insertDebateSchema>;

export type Argument = typeof debateArguments.$inferSelect;
export type InsertArgument = z.infer<typeof insertArgumentSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
