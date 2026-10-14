/**
 * Noctograph — IChainAdapter
 *
 * The contract every chain adapter must fulfill.
 * The indexer only talks to this interface — it never touches viem or any
 * chain SDK directly. This is the seam that makes multi-chain painless.
 *
 * Design principle: adapters are pure data translators. They fetch and
 * normalize. They do not write to the database.
 */

import type {
  ChainConfig,
  NormalizedBlock,
  NormalizedTransaction,
  NormalizedLog,
  TokenTransfer,
} from "@noctograph/types";

export interface FetchBlocksOptions {
  fromBlock: bigint;
  toBlock: bigint;
  includeTxs?: boolean;
  includeLogs?: boolean;
}

export interface BlockWithReceipts {
  block: NormalizedBlock;
  transactions: NormalizedTransaction[];
  logs: NormalizedLog[];
  tokenTransfers: TokenTransfer[];
}

export interface IChainAdapter {
  /** Chain config this adapter serves */
  readonly config: ChainConfig;

  /**
   * Fetch the latest finalized block number from the network.
   * Used by the indexer to determine how far behind we are.
   */
  getLatestBlockNumber(): Promise<bigint>;

  /**
   * Fetch a single block by number, with full transaction data.
   * This is the primary method the indexer calls in its hot path.
   */
  getBlock(blockNumber: bigint): Promise<BlockWithReceipts>;

  /**
   * Fetch a batch of blocks. Implementations should use batched
   * RPC calls (eth_getBlockByNumber via multicall or JSON-RPC batch)
   * to minimize round trips.
   */
  getBlockRange(options: FetchBlocksOptions): Promise<BlockWithReceipts[]>;

  /**
   * Fetch a single transaction by hash.
   * Used for on-demand lookups (not the indexer hot path).
   */
  getTransaction(txHash: string): Promise<NormalizedTransaction | null>;

  /**
   * Fetch the current native token balance of an address.
   * Returns value in wei as a bigint.
   */
  getBalance(address: string): Promise<bigint>;

  /**
   * Fetch the deployed bytecode at an address.
   * Empty string = EOA. Non-empty = contract.
   */
  getCode(address: string): Promise<string>;

  /**
   * Check if the adapter is healthy (RPC is reachable and responding).
   */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}
