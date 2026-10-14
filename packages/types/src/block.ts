/**
 * Noctograph — Block Types
 *
 * Normalized block representation across all chains.
 * Chain-specific fields live in `extra`.
 */

import type { ChainSlug } from "./chains.js";

export interface NormalizedBlock {
  /** Block hash (0x-prefixed hex) */
  hash: string;
  /** Parent block hash */
  parentHash: string;
  /** Block number as bigint (blocks > Number.MAX_SAFE_INTEGER on some chains) */
  number: bigint;
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Miner / fee recipient address */
  miner: string;
  /** Gas used in this block */
  gasUsed: bigint;
  /** Gas limit for this block */
  gasLimit: bigint;
  /** Base fee per gas (EIP-1559, undefined on pre-London blocks) */
  baseFeePerGas: bigint | undefined;
  /** Total block size in bytes */
  size: bigint;
  /** Transaction hashes in this block */
  transactionHashes: string[];
  /** Number of transactions */
  transactionCount: number;
  /** Chain this block belongs to */
  chainSlug: ChainSlug;
  /** Whether this block has been reorganized out of the canonical chain */
  isOrphaned: boolean;
}

export interface NormalizedTransaction {
  /** Transaction hash */
  hash: string;
  /** Block hash */
  blockHash: string;
  /** Block number */
  blockNumber: bigint;
  /** Transaction index within block */
  transactionIndex: number;
  /** Sender address */
  from: string;
  /** Recipient address (null for contract deployments) */
  to: string | null;
  /** ETH value transferred in wei */
  value: bigint;
  /** Gas limit set by sender */
  gas: bigint;
  /** Gas actually used */
  gasUsed: bigint;
  /** Gas price (legacy) */
  gasPrice: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas: bigint | undefined;
  /** Max priority fee (EIP-1559) */
  maxPriorityFeePerGas: bigint | undefined;
  /** Transaction fee paid in wei (gasUsed * effectiveGasPrice) */
  fee: bigint;
  /** Input calldata */
  input: string;
  /** Nonce */
  nonce: number;
  /** Transaction type (0=legacy, 1=access list, 2=EIP-1559) */
  type: number;
  /** Status: 1 = success, 0 = reverted */
  status: 0 | 1;
  /** Contract address if this was a deployment */
  contractAddress: string | null;
  /** Unix timestamp (inherited from block) */
  timestamp: number;
  /** Chain */
  chainSlug: ChainSlug;
}

export interface NormalizedLog {
  /** Log index within the transaction */
  logIndex: number;
  /** Transaction hash */
  transactionHash: string;
  /** Block number */
  blockNumber: bigint;
  /** Contract that emitted this log */
  address: string;
  /** Topics array (topic[0] = event signature hash) */
  topics: string[];
  /** ABI-encoded non-indexed data */
  data: string;
  /** Whether this log was removed in a reorg */
  removed: boolean;
  /** Chain */
  chainSlug: ChainSlug;
}

/** ERC-20 / ERC-721 / ERC-1155 transfer, decoded from logs */
export interface TokenTransfer {
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  timestamp: number;
  /** Token contract address */
  tokenAddress: string;
  tokenType: "ERC20" | "ERC721" | "ERC1155";
  from: string;
  to: string;
  /** For ERC-20: amount. For ERC-721/1155: token ID */
  value: bigint;
  /** ERC-1155 batch amount (undefined for ERC-20/721) */
  amount: bigint | undefined;
  chainSlug: ChainSlug;
}
