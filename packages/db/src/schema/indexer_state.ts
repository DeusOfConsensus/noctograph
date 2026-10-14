/**
 * Noctograph — Indexer State Schema
 *
 * Persistent state for the indexer. Survives restarts — the indexer
 * reads this on boot to know where it left off rather than starting
 * from block 0. One row per chain.
 */

import {
  pgTable,
  varchar,
  bigint,
  integer,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

export const indexerState = pgTable("indexer_state", {
  chainSlug: varchar("chain_slug", { length: 20 }).primaryKey(),

  /**
   * The last block number we successfully wrote to the database.
   * On restart, the indexer resumes from indexedHead + 1.
   */
  indexedHead: bigint("indexed_head", { mode: "bigint" }).notNull().default(0n),

  /**
   * The block hash at indexedHead. Used to detect reorgs on restart:
   * if the chain's block at indexedHead no longer has this hash, a reorg
   * happened while we were offline and we need to roll back.
   */
  indexedHeadHash: varchar("indexed_head_hash", { length: 66 })
    .notNull()
    .default("0x"),

  /** Total blocks indexed since creation */
  totalBlocksIndexed: bigint("total_blocks_indexed", { mode: "bigint" })
    .notNull()
    .default(0n),

  /** Total transactions indexed since creation */
  totalTxsIndexed: bigint("total_txs_indexed", { mode: "bigint" })
    .notNull()
    .default(0n),

  /** Total reorgs detected */
  totalReorgsDetected: integer("total_reorgs_detected").notNull().default(0),

  /** "idle" | "syncing" | "live" | "error" | "stopped" */
  status: varchar("status", { length: 20 }).notNull().default("idle"),

  lastError: text("last_error"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type IndexerStateRow = typeof indexerState.$inferSelect;
export type NewIndexerStateRow = typeof indexerState.$inferInsert;
