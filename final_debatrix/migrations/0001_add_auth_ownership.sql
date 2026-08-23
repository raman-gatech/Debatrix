-- Ownership columns are nullable so existing data remains readable after upgrade.
ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "created_by_github_id" text;
ALTER TABLE "debates" ADD COLUMN IF NOT EXISTS "created_by_github_id" text;
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "voter_github_id" text;

-- connect-pg-simple session store
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");

CREATE INDEX IF NOT EXISTS "personas_created_by_github_id_idx" ON "personas" ("created_by_github_id");
CREATE INDEX IF NOT EXISTS "debates_created_by_github_id_idx" ON "debates" ("created_by_github_id");
CREATE UNIQUE INDEX IF NOT EXISTS "votes_argument_voter_github_id_key"
  ON "votes" ("argument_id", "voter_github_id")
  WHERE "voter_github_id" IS NOT NULL;
