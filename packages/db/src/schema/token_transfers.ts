/**
 * Noctograph — Token Transfers Schema
 *
 * Decoded ERC-20, ERC-721, and ERC-1155 transfers.
 * Derived from the logs table but structured for efficient token queries:
 * - "Show me all token movements for this address"
 * - "Show me all holders of this token"
 * - "Show me the transfer history of this NFT"
 */

import {
  pgTable,
  varchar,
  integer,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const tokenTransfers = pgTable(
  "token_transfers",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    chainSlug: varchar("chain_slug", { length: 20 }).notNull(),

    // ─── References ──────────────────────────────────────────────────────────
    transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    timestamp: integer("timestamp").notNull(),

    // ─── Token ───────────────────────────────────────────────────────────────
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    /** "ERC20" | "ERC721" | "ERC1155" */
    tokenType: varchar("token_type", { length: 10 }).notNull(),

    // ─── Transfer ────────────────────────────────────────────────────────────
    from: varchar("from", { length: 42 }).notNull(),
    to: varchar("to", { length: 42 }).notNull(),
    /**
     * For ERC-20: token amount in smallest unit (as string for uint256 safety)
     * For ERC-721: token ID
     * For ERC-1155: token ID
     */
    value: varchar("value", { length: 78 }).notNull(),
    /**
     * ERC-1155 only: the quantity transferred (value = tokenId, amount = qty)
     * null for ERC-20 and ERC-721
     */
    amount: varchar("amount", { length: 78 }),

    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // All transfers for a token (token portfolio, holder list)
    tokenAddressIdx: index("token_transfers_token_address_idx").on(
      table.chainSlug,
      table.tokenAddress
    ),
    // All transfers sent from an address
    fromIdx: index("token_transfers_from_idx").on(table.chainSlug, table.from),
    // All transfers received by an address
    toIdx: index("token_transfers_to_idx").on(table.chainSlug, table.to),
    // All transfers involving an address (union of from + to)
    txHashIdx: index("token_transfers_tx_hash_idx").on(
      table.chainSlug,
      table.transactionHash
    ),
    // NFT history: all transfers of a specific token ID
    tokenValueIdx: index("token_transfers_token_value_idx").on(
      table.chainSlug,
      table.tokenAddress,
      table.value
    ),
  })
);

export type TokenTransfer = typeof tokenTransfers.$inferSelect;
export type NewTokenTransfer = typeof tokenTransfers.$inferInsert;
