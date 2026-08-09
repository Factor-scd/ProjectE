import { db, sql } from "@project-e/db";

export async function healthHandler() {
  const start = Date.now();
  let dbOk = false;
  let dbPingMs = 0;
  try {
    const result = await sql`SELECT 1 AS ok`;
    dbOk = true;
    dbPingMs = Date.now() - start;
  } catch {
    dbOk = false;
    dbPingMs = -1;
  }

  return {
    status: dbOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    runtime: "bun",
    uptime: process.uptime(),
    database: {
      connected: dbOk,
      ping_ms: dbPingMs,
    },
  };
}
