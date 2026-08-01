import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../packages/db/src/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

export const sql = postgres(databaseUrl, { max: 10 });
export const db = drizzle(sql, { schema });
export { schema };
