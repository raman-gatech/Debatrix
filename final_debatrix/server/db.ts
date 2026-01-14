import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

export const hasDatabase = !!process.env.DATABASE_URL;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (hasDatabase) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  db = drizzle({ client: pool, schema });
}

export { pool, db };
