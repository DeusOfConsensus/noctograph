/**
 * Noctograph Indexer — Entry Point
 *
 * Boots one ChainIndexer per active chain and runs them concurrently.
 * Handles graceful shutdown on SIGTERM/SIGINT (crucial for Render deployments).
 */

import { createAdapterRegistry } from "@noctograph/chains";
import { getDatabase } from "@noctograph/db";
import { CHAIN_CONFIGS, type ChainSlug } from "@noctograph/types";
import { ChainIndexer } from "./core/chain-indexer.js";

// ─── Config from environment ───────────────────────────────────────────────

const DATABASE_URL = process.env["DATABASE_URL"];
const ALCHEMY_API_KEY = process.env["ALCHEMY_API_KEY"];
const BATCH_SIZE = parseInt(process.env["INDEXER_BATCH_SIZE"] ?? "10", 10);
const POLL_INTERVAL_MS = parseInt(
  process.env["INDEXER_POLL_INTERVAL_MS"] ?? "3000",
  10
);
const ACTIVE_CHAINS_RAW = process.env["INDEXER_ACTIVE_CHAINS"] ?? "base";

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

const activeChains = ACTIVE_CHAINS_RAW.split(",")
  .map((s) => s.trim())
  .filter((s) => s in CHAIN_CONFIGS) as ChainSlug[];

if (activeChains.length === 0) {
  console.error("❌  No valid chains in INDEXER_ACTIVE_CHAINS.");
  process.exit(1);
}

// ─── Startup ──────────────────────────────────────────────────────────────

console.info("┌─────────────────────────────────────────┐");
console.info("│           Noctograph Indexer             │");
console.info("└─────────────────────────────────────────┘");
console.info(`Active chains : ${activeChains.join(", ")}`);
console.info(`Batch size    : ${BATCH_SIZE} blocks`);
console.info(`Poll interval : ${POLL_INTERVAL_MS}ms`);
console.info("");

const db = getDatabase(DATABASE_URL);

const registry = createAdapterRegistry({
  alchemyApiKey: ALCHEMY_API_KEY,
  activeChains,
});

// Health-check all RPC endpoints before starting
console.info("Checking RPC connectivity...");
const health = await registry.healthCheckAll();
for (const [chain, result] of Object.entries(health)) {
  const icon = result.healthy ? "✓" : "✗";
  console.info(`  ${icon} ${chain.padEnd(12)} ${result.latencyMs}ms`);
  if (!result.healthy) {
    console.error(`❌  ${chain} RPC is unreachable. Check your API keys.`);
    process.exit(1);
  }
}
console.info("");

// Start one indexer per chain
const indexers = activeChains.map((chainSlug) => {
  const adapter = registry.get(chainSlug);
  const chainConfig = CHAIN_CONFIGS[chainSlug];

  return new ChainIndexer(chainSlug, adapter, db, {
    batchSize: BATCH_SIZE,
    pollIntervalMs: POLL_INTERVAL_MS,
    finalityDepth: chainConfig.finalityDepth,
  });
});

await Promise.all(indexers.map((i) => i.start()));

// ─── Graceful shutdown ────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.info(`\nReceived ${signal}. Stopping indexers gracefully...`);
  await Promise.all(indexers.map((i) => i.stop()));
  console.info("All indexers stopped. Goodbye.");
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Keep process alive
setInterval(() => {}, 1 << 30);
