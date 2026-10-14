/**
 * Noctograph — Indexer Types
 *
 * Shared contracts between the indexer and everything consuming its state.
 */

import type { ChainSlug } from "./chains.js";

export type IndexerStatus = "idle" | "syncing" | "live" | "error" | "stopped";

export interface IndexerState {
  chainSlug: ChainSlug;
  status: IndexerStatus;
  /** Latest block number on the network (from RPC) */
  networkHead: bigint;
  /** Latest block number we have fully indexed */
  indexedHead: bigint;
  /** How far behind we are */
  lag: bigint;
  /** Blocks indexed per second (rolling average) */
  throughput: number;
  lastError: string | undefined;
  lastUpdatedAt: Date;
}

export interface ReorgEvent {
  chainSlug: ChainSlug;
  /** Depth of the reorg (how many blocks were reorganized) */
  depth: number;
  /** The common ancestor block we're rolling back to */
  commonAncestorNumber: bigint;
  commonAncestorHash: string;
  /** Blocks that were in the old canonical chain but are now orphaned */
  orphanedBlocks: Array<{ number: bigint; hash: string }>;
  /** New canonical blocks that replaced them */
  newBlocks: Array<{ number: bigint; hash: string }>;
  detectedAt: Date;
}

export interface IndexerMetrics {
  chainSlug: ChainSlug;
  blocksIndexedTotal: number;
  transactionsIndexedTotal: number;
  logsIndexedTotal: number;
  reorgsDetectedTotal: number;
  rpcCallsTotal: number;
  rpcErrorsTotal: number;
  uptimeSeconds: number;
}
