/**
 * Noctograph — Transactions Schema
 *
 * One row per transaction. References the blocks table via blockHash.
 * We store both the tx and the receipt data denormalized here for
 * query performance — no joins needed for common tx lookups.
 */

import {
  pgTable,
  varchar,
  integer,
  bigint,
  boolean,
  smallint,
  timestamp,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const transactions = pgTable(
  "transactions",
  {
    // ─── Identity ───────────────────────────────────────────────────────────
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    chainSlug: varchar("chain_slug", { length: 20 }).notNull(),
    hash: varchar("hash", { length: 66 }).notNull(),

    // ─── Block reference ─────────────────────────────────────────────────────
    blockHash: varchar("block_hash", { length: 66 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    transactionIndex: integer("transaction_index").notNull(),

    // ─── Addresses ───────────────────────────────────────────────────────────
    from: varchar("from", { length: 42 }).notNull(),
    /** null = contract deployment */
    to: varchar("to", { length: 42 }),
    /** address of deployed contract if this was a deployment */
    contractAddress: varchar("contract_address", { length: 42 }),

    // ─── Value & Gas (stored as text to handle uint256 safely) ───────────────
    /** wei as numeric string */
    value: varchar("value", { length: 78 }).notNull().default("0"),
    gas: bigint("gas", { mode: "bigint" }).notNull(),
    gasUsed: bigint("gas_used", { mode: "bigint" }).notNull(),
    gasPrice: bigint("gas_price", { mode: "bigint" }).notNull(),
    maxFeePerGas: bigint("max_fee_per_gas", { mode: "bigint" }),
    maxPriorityFeePerGas: bigint("max_priority_fee_per_gas", { mode: "bigint" }),
    /** Actual fee paid = gasUsed * effectiveGasPrice */
    fee: bigint("fee", { mode: "bigint" }).notNull(),

    // ─── Transaction data ────────────────────────────────────────────────────
    input: text("input").notNull().default("0x"),
    nonce: integer("nonce").notNull(),
    /** 0 = legacy, 1 = EIP-2930 access list, 2 = EIP-1559 */
    type: smallint("type").notNull().default(0),

    // ─── Receipt data ────────────────────────────────────────────────────────
    /** 1 = success, 0 = reverted */
    status: smallint("status").notNull(),

    // ─── Timing ──────────────────────────────────────────────────────────────
    /** Copied from the parent block for query convenience */
    timestamp: integer("timestamp").notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Primary lookup: tx by hash (most common)
    chainHashIdx: uniqueIndex("txs_chain_hash_idx").on(
      table.chainSlug,
      table.hash
    ),
    // All txs in a block
    blockNumberIdx: index("txs_block_number_idx").on(
      table.chainSlug,
      table.blockNumber
    ),
    // Address history (sent)
    fromIdx: index("txs_from_idx").on(table.chainSlug, table.from),
    // Address history (received)
    toIdx: index("txs_to_idx").on(table.chainSlug, table.to),
    // Time-range queries for analytics
    timestampIdx: index("txs_timestamp_idx").on(table.timestamp),
  })
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
