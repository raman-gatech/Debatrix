import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export const hasDatabase = !!process.env.DATABASE_URL;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (hasDatabase) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  db = drizzle({ client: pool, schema });
}

export { pool, db };

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!pool) return false;
  await pool.query("SELECT 1");
  return true;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
}
