import { db, sql } from "@project-e/db/client";

let running = true;

process.on("SIGTERM", async () => {
  console.log("worker: SIGTERM received, shutting down gracefully...");
  running = false;
  await sql.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("worker: SIGINT received, shutting down gracefully...");
  running = false;
  await sql.end();
  process.exit(0);
});

async function main() {
  try {
    // Test DB connection
    await sql`SELECT 1`;
    console.log("worker ready");
  } catch (err) {
    console.error("worker: failed to connect to database:", err);
    process.exit(1);
  }

  // Stub loop: sleep forever, handle signals
  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

main();
