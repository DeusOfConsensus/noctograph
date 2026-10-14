/**
 * Noctograph API — Entry Point
 *
 * REST API built on Hono — lightweight, type-safe, edge-compatible.
 * All routes live under /api/v1/ for clean versioning.
 *
 * Route map:
 *   GET /health
 *   GET /api/v1/chains
 *   GET /api/v1/chains/:chainSlug
 *   GET /api/v1/:chainSlug/blocks
 *   GET /api/v1/:chainSlug/blocks/:numberOrHash
 *   GET /api/v1/:chainSlug/transactions
 *   GET /api/v1/:chainSlug/transactions/:hash
 *   GET /api/v1/:chainSlug/transactions/block/:number
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { getDatabase } from "@noctograph/db";
import { corsMiddleware } from "./middleware/cors.js";
import { createBlocksRouter } from "./routes/blocks.js";
import { createTransactionsRouter } from "./routes/transactions.js";
import { createChainsRouter } from "./routes/chains.js";

// ─── Config ───────────────────────────────────────────────────────────────

const PORT = parseInt(process.env["API_PORT"] ?? "3001", 10);
const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}

const db = getDatabase(DATABASE_URL);

// ─── App ──────────────────────────────────────────────────────────────────

const app = new Hono();

// Global middleware
app.use("*", corsMiddleware);
app.use("*", logger());

// Inject DB into every request context
app.use("*", async (c, next) => {
  c.set("db", db);
  await next();
});

// ─── Health check ─────────────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "noctograph-api",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
  });
});

// ─── V1 routes ────────────────────────────────────────────────────────────

const v1 = new Hono();

v1.route("/chains", createChainsRouter());
v1.route("/:chainSlug/blocks", createBlocksRouter());
v1.route("/:chainSlug/transactions", createTransactionsRouter());

app.route("/api/v1", v1);

// ─── 404 fallback ─────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found.`,
      },
    },
    404
  );
});

// ─── Start ────────────────────────────────────────────────────────────────

console.info("┌─────────────────────────────────────────┐");
console.info("│            Noctograph API                │");
console.info("└─────────────────────────────────────────┘");

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.info(`✓ Listening on http://localhost:${info.port}`);
  console.info(`  Health : http://localhost:${info.port}/health`);
  console.info(`  Chains : http://localhost:${info.port}/api/v1/chains`);
});
