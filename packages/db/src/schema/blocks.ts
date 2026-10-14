/**
 * Noctograph — Blocks Schema
 *
 * Stores every block we've indexed, per chain.
 * Orphaned blocks (from reorgs) are kept and flagged rather than deleted —
 * they're valuable data for detecting and analyzing chain reorganizations.
 */

import {
  pgTable,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  text,
} from "drizzle-orm/pg-core";

export const blocks = pgTable(
  "blocks",
  {
    // ─── Identity ───────────────────────────────────────────────────────────
    /** Composite primary key is (chainSlug, hash) — same hash can exist on different chains */
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    chainSlug: varchar("chain_slug", { length: 20 }).notNull(),
    hash: varchar("hash", { length: 66 }).notNull(), // 0x + 64 hex chars

    // ─── Block data ──────────────────────────────────────────────────────────
    parentHash: varchar("parent_hash", { length: 66 }).notNull(),
    /** Stored as bigint — JS number can't safely hold block numbers above 2^53 */
    number: bigint("number", { mode: "bigint" }).notNull(),
    /** Unix timestamp in seconds */
    timestamp: integer("timestamp").notNull(),
    miner: varchar("miner", { length: 42 }).notNull(), // 0x + 40 hex chars

    // ─── Gas ─────────────────────────────────────────────────────────────────
    gasUsed: bigint("gas_used", { mode: "bigint" }).notNull(),
    gasLimit: bigint("gas_limit", { mode: "bigint" }).notNull(),
    /** null before EIP-1559 (London fork) */
    baseFeePerGas: bigint("base_fee_per_gas", { mode: "bigint" }),

    // ─── Stats ───────────────────────────────────────────────────────────────
    size: bigint("size", { mode: "bigint" }).notNull(),
    transactionCount: integer("transaction_count").notNull().default(0),

    // ─── Reorg tracking ──────────────────────────────────────────────────────
    /**
     * When a reorg happens, we mark the orphaned blocks instead of deleting.
     * This preserves reorg history which is analytically valuable.
     */
    isOrphaned: boolean("is_orphaned").notNull().default(false),
    orphanedAt: timestamp("orphaned_at", { withTimezone: true }),

    // ─── Indexer metadata ────────────────────────────────────────────────────
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Primary lookup: get block by chain + number (most common query)
    chainNumberIdx: uniqueIndex("blocks_chain_number_idx").on(
      table.chainSlug,
      table.number
    ),
    // Secondary: get block by chain + hash (used during reorg detection)
    chainHashIdx: uniqueIndex("blocks_chain_hash_idx").on(
      table.chainSlug,
      table.hash
    ),
    // Analytics queries filtering by time range
    timestampIdx: index("blocks_timestamp_idx").on(table.timestamp),
    // Miner/validator analytics
    minerIdx: index("blocks_miner_idx").on(table.miner),
  })
);

export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;
