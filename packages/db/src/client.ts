/**
 * Noctograph — Database Client
 *
 * Single Drizzle + postgres.js client instance.
 * Uses the pooled Supabase connection string in production (PgBouncer),
 * direct connection for migrations and drizzle-kit.
 *
 * Why postgres.js over node-postgres (pg)?
 * - Built in TypeScript
 * - Automatic connection pooling
 * - Prepared statements by default
 * - 3x faster for high-throughput insert workloads (relevant for the indexer)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 10,            // Max connection pool size
    idle_timeout: 30,   // Close idle connections after 30s
    connect_timeout: 10,
    prepare: false,     // Required for Supabase PgBouncer (transaction mode)
  });

  return drizzle(sql, {
    schema,
    logger: process.env["NODE_ENV"] === "development",
  });
}

/**
 * Singleton for use within a single process (indexer or API).
 * Each app creates its own instance via createDatabase().
 */
let _db: Database | null = null;

export function getDatabase(databaseUrl?: string): Database {
  if (_db) return _db;

  const url = databaseUrl ?? process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and add your Supabase URL."
    );
  }

  _db = createDatabase(url);
  return _db;
}
