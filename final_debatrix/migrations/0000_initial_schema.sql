-- Baseline schema for a fresh Debatrix installation.
-- All statements are idempotent so this migration can also be adopted by
-- databases created with the former `drizzle-kit push` workflow.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "personas" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "tone" text NOT NULL,
  "bias" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "debates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "topic" text NOT NULL,
  "persona_a_id" varchar NOT NULL REFERENCES "personas"("id"),
  "persona_b_id" varchar NOT NULL REFERENCES "personas"("id"),
  "status" text NOT NULL DEFAULT 'active',
  "total_rounds" integer NOT NULL DEFAULT 3,
  "current_round" integer NOT NULL DEFAULT 1,
  "winner_id" varchar REFERENCES "personas"("id"),
  "judgment_summary" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "debates_distinct_personas" CHECK ("persona_a_id" <> "persona_b_id")
);

CREATE TABLE IF NOT EXISTS "arguments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "debate_id" varchar NOT NULL REFERENCES "debates"("id"),
  "persona_id" varchar NOT NULL REFERENCES "personas"("id"),
  "content" text NOT NULL,
  "round_number" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "votes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "argument_id" varchar NOT NULL REFERENCES "arguments"("id"),
  "debate_id" varchar NOT NULL REFERENCES "debates"("id"),
  "voter_fingerprint" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "personas_created_at_idx" ON "personas" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "debates_created_at_idx" ON "debates" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "debates_persona_a_id_idx" ON "debates" ("persona_a_id");
CREATE INDEX IF NOT EXISTS "debates_persona_b_id_idx" ON "debates" ("persona_b_id");
CREATE INDEX IF NOT EXISTS "arguments_debate_created_at_idx" ON "arguments" ("debate_id", "created_at");
CREATE INDEX IF NOT EXISTS "arguments_persona_id_idx" ON "arguments" ("persona_id");
CREATE INDEX IF NOT EXISTS "votes_debate_id_idx" ON "votes" ("debate_id");
CREATE INDEX IF NOT EXISTS "votes_argument_id_idx" ON "votes" ("argument_id");
