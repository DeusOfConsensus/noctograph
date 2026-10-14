/**
 * Noctograph — Addresses Schema
 *
 * Tracks every address we've seen on-chain. This is the "wallet intelligence"
 * table — it grows incrementally as the indexer encounters new addresses.
 *
 * We upsert here rather than insert: first time we see an address we create
 * the row; subsequent times we update activity stats.
 */

import {
  pgTable,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const addresses = pgTable(
  "addresses",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    chainSlug: varchar("chain_slug", { length: 20 }).notNull(),
    address: varchar("address", { length: 42 }).notNull(),

    // ─── Contract detection ───────────────────────────────────────────────────
    isContract: boolean("is_contract").notNull().default(false),
    /** Populated if we successfully fetched and decoded bytecode */
    contractName: varchar("contract_name", { length: 255 }),
    /** ABI source: "verified" (Etherscan/Sourcify), "4byte", "unknown" */
    abiSource: varchar("abi_source", { length: 20 }),

    // ─── Activity stats ───────────────────────────────────────────────────────
    /** Number of txs sent FROM this address (nonce-equivalent) */
    txSentCount: integer("tx_sent_count").notNull().default(0),
    /** Number of txs received by this address */
    txReceivedCount: integer("tx_received_count").notNull().default(0),
    /** Unix timestamp of first ever observed activity */
    firstSeenAt: integer("first_seen_at"),
    /** Unix timestamp of most recent activity */
    lastSeenAt: integer("last_seen_at"),

    // ─── Balance snapshot ─────────────────────────────────────────────────────
    /**
     * Cached native balance in wei (as string). NOT real-time —
     * updated periodically by the indexer. Always fetch from RPC for
     * real-time balance.
     */
    balanceWei: varchar("balance_wei", { length: 78 }).default("0"),
    balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true }),

    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Primary: address lookup
    chainAddressIdx: uniqueIndex("addresses_chain_address_idx").on(
      table.chainSlug,
      table.address
    ),
    // Filter contracts
    isContractIdx: index("addresses_is_contract_idx").on(
      table.chainSlug,
      table.isContract
    ),
    // Activity analytics
    lastSeenIdx: index("addresses_last_seen_idx").on(table.lastSeenAt),
  })
);

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
