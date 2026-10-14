import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import type { Database } from "../client.js";
import { blocks, type NewBlock } from "../schema/index.js";
import type { ChainSlug } from "@noctograph/types";

export async function insertBlock(db: Database, block: NewBlock) {
  await db
    .insert(blocks)
    .values(block)
    .onConflictDoUpdate({
      target: [blocks.chainSlug, blocks.number],
      set: {
        hash: block.hash,
        isOrphaned: block.isOrphaned,
        indexedAt: new Date(),
      },
    });
}

export async function insertBlocks(db: Database, newBlocks: NewBlock[]) {
  if (newBlocks.length === 0) return;
  await db
    .insert(blocks)
    .values(newBlocks)
    .onConflictDoNothing();
}

export async function getBlockByNumber(
  db: Database,
  chainSlug: ChainSlug,
  blockNumber: bigint
) {
  return db.query.blocks.findFirst({
    where: and(
      eq(blocks.chainSlug, chainSlug),
      eq(blocks.number, blockNumber),
      eq(blocks.isOrphaned, false)
    ),
  });
}

export async function getBlockByHash(
  db: Database,
  chainSlug: ChainSlug,
  hash: string
) {
  return db.query.blocks.findFirst({
    where: and(eq(blocks.chainSlug, chainSlug), eq(blocks.hash, hash)),
  });
}

export async function getLatestBlocks(
  db: Database,
  chainSlug: ChainSlug,
  limit = 20
) {
  return db.query.blocks.findMany({
    where: and(
      eq(blocks.chainSlug, chainSlug),
      eq(blocks.isOrphaned, false)
    ),
    orderBy: [desc(blocks.number)],
    limit,
  });
}

/** Mark a range of blocks as orphaned during reorg processing */
export async function orphanBlocks(
  db: Database,
  chainSlug: ChainSlug,
  fromNumber: bigint,
  toNumber: bigint
) {
  await db
    .update(blocks)
    .set({ isOrphaned: true, orphanedAt: new Date() })
    .where(
      and(
        eq(blocks.chainSlug, chainSlug),
        gte(blocks.number, fromNumber),
        lte(blocks.number, toNumber)
      )
    );
}
