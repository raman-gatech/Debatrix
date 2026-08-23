import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(scriptDirectory, "..", "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();

if (migrationFiles.length === 0) {
  console.error("No migration files were found.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query("SELECT pg_advisory_lock(87400123)");
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "name" text PRIMARY KEY,
      "applied_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query('SELECT "name" FROM "schema_migrations"');
  const applied = new Set(rows.map((row) => row.name));

  for (const migrationFile of migrationFiles) {
    if (applied.has(migrationFile)) continue;

    const sql = await readFile(join(migrationsDirectory, migrationFile), "utf8");
    await client.query(sql);
    await client.query('INSERT INTO "schema_migrations" ("name") VALUES ($1)', [migrationFile]);
    console.log(`Applied ${migrationFile}`);
  }

  await client.query("COMMIT");
  console.log("Database migrations are current.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Database migration failed.", error);
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock(87400123)").catch(() => undefined);
  client.release();
  await pool.end();
}
