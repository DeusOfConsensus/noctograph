/**
 * Noctograph — Logs Schema
 *
 * Raw event logs. This table is append-only and grows fast.
 * Kept separate from transactions because:
 *   1. One tx can emit hundreds of logs
 *   2. Filtering by topic0 (event signature) is the dominant query pattern
 *   3. Partitioning by chain keeps per-chain scans fast
 */

import {
  pgTable,
  varchar,
  integer,
  bigint,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const logs = pgTable(
  "logs",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    chainSlug: varchar("chain_slug", { length: 20 }).notNull(),

    // ─── References ──────────────────────────────────────────────────────────
    transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    logIndex: integer("log_index").notNull(),

    // ─── Emitter ─────────────────────────────────────────────────────────────
    address: varchar("address", { length: 42 }).notNull(),

    // ─── Topics ──────────────────────────────────────────────────────────────
    /** topic[0] = event signature hash. Always present if log is meaningful. */
    topic0: varchar("topic0", { length: 66 }),
    /** topic[1..3] = indexed event parameters */
    topic1: varchar("topic1", { length: 66 }),
    topic2: varchar("topic2", { length: 66 }),
    topic3: varchar("topic3", { length: 66 }),

    /** ABI-encoded non-indexed parameters */
    data: text("data").notNull().default("0x"),

    /** Reorg flag — mirrors the parent block's isOrphaned */
    removed: boolean("removed").notNull().default(false),

    timestamp: integer("timestamp").notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Filter all logs of a specific event type across all contracts
    topic0Idx: index("logs_topic0_idx").on(table.chainSlug, table.topic0),
    // Filter logs emitted by a specific contract
    addressIdx: index("logs_address_idx").on(table.chainSlug, table.address),
    // Filter logs emitted by a specific contract for a specific event
    addressTopic0Idx: index("logs_address_topic0_idx").on(
      table.chainSlug,
      table.address,
      table.topic0
    ),
    // Tx lookup
    txHashIdx: index("logs_tx_hash_idx").on(
      table.chainSlug,
      table.transactionHash
    ),
    // Block lookup
    blockNumberIdx: index("logs_block_number_idx").on(
      table.chainSlug,
      table.blockNumber
    ),
  })
);

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
