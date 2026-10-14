/**
 * Noctograph — Transaction Queries
 */

import { eq, and, desc, or } from "drizzle-orm";
import type { Database } from "../client.js";
import { transactions, type NewTransaction } from "../schema/index.js";
import type { ChainSlug } from "@noctograph/types";

export async function insertTransactions(
  db: Database,
  txs: NewTransaction[]
) {
  if (txs.length === 0) return;
  await db.insert(transactions).values(txs).onConflictDoNothing();
}

export async function getTransactionByHash(
  db: Database,
  chainSlug: ChainSlug,
  hash: string
) {
  return db.query.transactions.findFirst({
    where: and(
      eq(transactions.chainSlug, chainSlug),
      eq(transactions.hash, hash)
    ),
  });
}

export async function getTransactionsByBlock(
  db: Database,
  chainSlug: ChainSlug,
  blockNumber: bigint
) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.chainSlug, chainSlug),
      eq(transactions.blockNumber, blockNumber)
    ),
    orderBy: [transactions.transactionIndex],
  });
}

export async function getTransactionsByAddress(
  db: Database,
  chainSlug: ChainSlug,
  address: string,
  limit = 25,
  offset = 0
) {
  const lowerAddress = address.toLowerCase();
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.chainSlug, chainSlug),
      or(
        eq(transactions.from, lowerAddress),
        eq(transactions.to, lowerAddress)
      )
    ),
    orderBy: [desc(transactions.blockNumber)],
    limit,
    offset,
  });
}

export async function getLatestTransactions(
  db: Database,
  chainSlug: ChainSlug,
  limit = 20
) {
  return db.query.transactions.findMany({
    where: eq(transactions.chainSlug, chainSlug),
    orderBy: [desc(transactions.blockNumber), desc(transactions.transactionIndex)],
    limit,
  });
}
