/**
 * Noctograph — Indexer State Queries
 *
 * The indexer reads/writes these on every cycle. Kept ultra-simple
 * and fast — these are the highest-frequency DB ops in the system.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { indexerState, type NewIndexerStateRow } from "../schema/index.js";
import type { ChainSlug } from "@noctograph/types";

export async function getIndexerState(db: Database, chainSlug: ChainSlug) {
  return db.query.indexerState.findFirst({
    where: eq(indexerState.chainSlug, chainSlug),
  });
}

export async function upsertIndexerState(
  db: Database,
  state: NewIndexerStateRow
) {
  await db
    .insert(indexerState)
    .values(state)
    .onConflictDoUpdate({
      target: indexerState.chainSlug,
      set: {
        indexedHead: state.indexedHead,
        indexedHeadHash: state.indexedHeadHash,
        totalBlocksIndexed: state.totalBlocksIndexed,
        totalTxsIndexed: state.totalTxsIndexed,
        totalReorgsDetected: state.totalReorgsDetected,
        status: state.status,
        lastError: state.lastError,
        updatedAt: new Date(),
      },
    });
}

export async function getAllIndexerStates(db: Database) {
  return db.query.indexerState.findMany();
}
