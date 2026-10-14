/**
 * Noctograph — Chain Indexer
 *
 * The indexing engine for a single chain. One ChainIndexer instance runs
 * per active chain. They are completely independent — one chain being slow
 * or erroring never affects another.
 *
 * State machine:
 *   idle → syncing (catching up from stored head)
 *       → live (within FINALITY_DEPTH of network head)
 *       → error (RPC failure, DB failure)
 *       → stopped (graceful shutdown)
 *
 * Batch strategy:
 *   During catch-up: fetch INDEXER_BATCH_SIZE blocks per cycle (fast)
 *   During live:     fetch 1 block per cycle (low latency, low RPC cost)
 */

import type { IChainAdapter } from "@noctograph/chains";
import type { Database } from "@noctograph/db";
import { getIndexerState, upsertIndexerState } from "@noctograph/db";
import type { ChainSlug, IndexerStatus } from "@noctograph/types";
import { BlockProcessor } from "../processors/block-processor.js";
import { ReorgDetector } from "./reorg-detector.js";

export interface ChainIndexerConfig {
  batchSize: number;
  pollIntervalMs: number;
  finalityDepth: number;
}

export class ChainIndexer {
  private status: IndexerStatus = "idle";
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;

  private indexedHead = 0n;
  private indexedHeadHash = "0x";
  private totalBlocksIndexed = 0n;
  private totalTxsIndexed = 0n;
  private totalReorgsDetected = 0;

  private readonly processor: BlockProcessor;
  private readonly reorgDetector: ReorgDetector;

  constructor(
    private readonly chainSlug: ChainSlug,
    private readonly adapter: IChainAdapter,
    private readonly db: Database,
    private readonly config: ChainIndexerConfig
  ) {
    this.processor = new BlockProcessor(db);
    this.reorgDetector = new ReorgDetector(
      db,
      adapter,
      chainSlug,
      config.finalityDepth
    );
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Load persisted state from DB (survives restarts)
    await this.loadState();

    console.info(
      `[${this.chainSlug}] Indexer starting. ` +
        `Resume from block ${this.indexedHead + 1n}.`
    );

    this.scheduleNextCycle(0);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.status = "stopped";
    await this.persistState();
    console.info(`[${this.chainSlug}] Indexer stopped.`);
  }

  getStatus(): IndexerStatus {
    return this.status;
  }

  getIndexedHead(): bigint {
    return this.indexedHead;
  }

  // ─── Core cycle ──────────────────────────────────────────────────────────

  private scheduleNextCycle(delayMs: number): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => void this.runCycle(), delayMs);
  }

  private async runCycle(): Promise<void> {
    if (!this.running) return;

    try {
      const networkHead = await this.adapter.getLatestBlockNumber();
      const lag = networkHead - this.indexedHead;

      if (lag <= 0n) {
        // Fully caught up — wait for next block
        this.status = "live";
        this.scheduleNextCycle(this.config.pollIntervalMs);
        return;
      }

      this.status = lag > 100n ? "syncing" : "live";

      // ── Reorg check ──────────────────────────────────────────────────────
      // Only check for reorgs when we have an indexed head to compare against
      if (this.indexedHead > 0n && this.indexedHeadHash !== "0x") {
        const reorg = await this.reorgDetector.check(
          this.indexedHead,
          this.indexedHeadHash
        );
        if (reorg) {
          this.totalReorgsDetected++;
          // Roll back our local head to the common ancestor
          this.indexedHead = reorg.commonAncestorNumber;
          this.indexedHeadHash = reorg.commonAncestorHash;
          await this.persistState();
          // Re-run cycle from the common ancestor
          this.scheduleNextCycle(0);
          return;
        }
      }

      // ── Fetch & process batch ────────────────────────────────────────────
      const fromBlock = this.indexedHead + 1n;
      const batchEnd = this.indexedHead + BigInt(this.config.batchSize);
      // Don't index beyond finality depth (avoids indexing blocks that might reorg)
      const safeHead = networkHead - BigInt(this.config.finalityDepth);
      const toBlock = batchEnd < safeHead ? batchEnd : safeHead;

      if (fromBlock > toBlock) {
        this.scheduleNextCycle(this.config.pollIntervalMs);
        return;
      }

      const blocks = await this.adapter.getBlockRange({ fromBlock, toBlock });

      for (const blockData of blocks) {
        const stats = await this.processor.process(this.chainSlug, blockData);

        this.indexedHead = blockData.block.number;
        this.indexedHeadHash = blockData.block.hash;
        this.totalBlocksIndexed++;
        this.totalTxsIndexed += BigInt(stats.txCount);

        if (lag > 1000n && this.totalBlocksIndexed % 100n === 0n) {
          console.info(
            `[${this.chainSlug}] Syncing... block ${this.indexedHead} ` +
              `(${networkHead - this.indexedHead} behind)`
          );
        }
      }

      // Persist state after every batch
      await this.persistState();

      // Run next cycle immediately if still catching up, else wait
      const newLag = networkHead - this.indexedHead;
      this.scheduleNextCycle(newLag > 0n ? 0 : this.config.pollIntervalMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${this.chainSlug}] Indexer error: ${message}`);
      this.status = "error";
      await this.persistState(message);
      // Back off on error
      this.scheduleNextCycle(this.config.pollIntervalMs * 5);
    }
  }

  // ─── State persistence ────────────────────────────────────────────────────

  private async loadState(): Promise<void> {
    const stored = await getIndexerState(this.db, this.chainSlug);
    if (stored) {
      this.indexedHead = stored.indexedHead;
      this.indexedHeadHash = stored.indexedHeadHash;
      this.totalBlocksIndexed = stored.totalBlocksIndexed;
      this.totalTxsIndexed = stored.totalTxsIndexed;
      this.totalReorgsDetected = stored.totalReorgsDetected;
    }
  }

  private async persistState(errorMessage?: string): Promise<void> {
    await upsertIndexerState(this.db, {
      chainSlug: this.chainSlug,
      indexedHead: this.indexedHead,
      indexedHeadHash: this.indexedHeadHash,
      totalBlocksIndexed: this.totalBlocksIndexed,
      totalTxsIndexed: this.totalTxsIndexed,
      totalReorgsDetected: this.totalReorgsDetected,
      status: this.status,
      lastError: errorMessage ?? null,
    });
  }
}
