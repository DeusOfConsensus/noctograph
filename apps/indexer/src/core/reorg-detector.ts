/**
 * Noctograph — Reorg Detector
 *
 * Detects and handles chain reorganizations.
 *
 * A reorg happens when a competing chain fork becomes canonical —
 * blocks we already indexed are replaced by different blocks at the
 * same heights. If we ignore reorgs, our data silently lies.
 *
 * Detection strategy (walking back from current head):
 *   1. After indexing a block, store its hash in indexer_state.
 *   2. On the next cycle, compare the stored hash for each block
 *      against what the RPC currently serves at that number.
 *   3. If they diverge, walk backwards until we find the common
 *      ancestor (the last block where hashes still agree).
 *   4. Mark orphaned blocks. Re-index from the common ancestor.
 *
 * This is the same algorithm Ethereum clients use internally.
 */

import type { IChainAdapter } from "@noctograph/chains";
import type { Database } from "@noctograph/db";
import { getBlockByNumber, orphanBlocks } from "@noctograph/db";
import type { ChainSlug, ReorgEvent } from "@noctograph/types";

export class ReorgDetector {
  constructor(
    private readonly db: Database,
    private readonly adapter: IChainAdapter,
    private readonly chainSlug: ChainSlug,
    /** Max blocks to walk back when hunting for common ancestor */
    private readonly maxRollbackDepth = 100
  ) {}

  /**
   * Check if a reorg occurred between our stored head and the current chain.
   * Returns a ReorgEvent if one is detected, null if the chain is consistent.
   *
   * @param storedHead   Block number we think is the canonical tip
   * @param storedHash   Hash we stored for storedHead
   */
  async check(
    storedHead: bigint,
    storedHash: string
  ): Promise<ReorgEvent | null> {
    // Fetch what the chain currently says is at storedHead
    let chainBlock: Awaited<ReturnType<typeof this.adapter.getBlock>>;
    try {
      chainBlock = await this.adapter.getBlock(storedHead);
    } catch {
      // RPC error — can't determine if reorg happened, skip this cycle
      return null;
    }

    // Hashes match — no reorg
    if (chainBlock.block.hash === storedHash) return null;

    console.warn(
      `[${this.chainSlug}] Reorg detected at block ${storedHead}. ` +
        `Expected ${storedHash.slice(0, 10)}… got ${chainBlock.block.hash.slice(0, 10)}…`
    );

    // Find the common ancestor by walking backwards
    const commonAncestor = await this.findCommonAncestor(storedHead);

    if (!commonAncestor) {
      // Couldn't find common ancestor within maxRollbackDepth — something
      // very unusual happened. Log and bail; manual intervention needed.
      console.error(
        `[${this.chainSlug}] Could not find common ancestor within ` +
          `${this.maxRollbackDepth} blocks. Manual recovery required.`
      );
      return null;
    }

    const reorgDepth = Number(storedHead - commonAncestor.number);

    // Mark orphaned blocks in DB
    await orphanBlocks(
      this.db,
      this.chainSlug,
      commonAncestor.number + 1n,
      storedHead
    );

    const reorgEvent: ReorgEvent = {
      chainSlug: this.chainSlug,
      depth: reorgDepth,
      commonAncestorNumber: commonAncestor.number,
      commonAncestorHash: commonAncestor.hash,
      orphanedBlocks: this.buildOrphanList(
        commonAncestor.number + 1n,
        storedHead
      ),
      newBlocks: [], // Will be filled as re-indexing proceeds
      detectedAt: new Date(),
    };

    console.info(
      `[${this.chainSlug}] Reorg resolved. Depth: ${reorgDepth} blocks. ` +
        `Common ancestor: ${commonAncestor.number} (${commonAncestor.hash.slice(0, 10)}…). ` +
        `Re-indexing from ${commonAncestor.number + 1n}.`
    );

    return reorgEvent;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async findCommonAncestor(
    fromBlock: bigint
  ): Promise<{ number: bigint; hash: string } | null> {
    let current = fromBlock - 1n;
    const floor = fromBlock - BigInt(this.maxRollbackDepth);

    while (current > floor && current > 0n) {
      const [dbBlock, chainBlock] = await Promise.all([
        getBlockByNumber(this.db, this.chainSlug, current),
        this.adapter.getBlock(current).catch(() => null),
      ]);

      if (!dbBlock || !chainBlock) {
        current--;
        continue;
      }

      if (dbBlock.hash === chainBlock.block.hash) {
        return { number: current, hash: dbBlock.hash };
      }

      current--;
    }

    return null;
  }

  private buildOrphanList(
    from: bigint,
    to: bigint
  ): Array<{ number: bigint; hash: string }> {
    const list: Array<{ number: bigint; hash: string }> = [];
    for (let n = from; n <= to; n++) {
      list.push({ number: n, hash: "" }); // Hash unknown at this point
    }
    return list;
  }
}
