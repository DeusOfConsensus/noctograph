/**
 * Noctograph — EVM Chain Adapter
 *
 * Base implementation for all EVM-compatible chains (Ethereum, Base,
 * Arbitrum, Polygon, Avalanche C-Chain).
 *
 * Uses viem as the transport layer — it's type-safe, tree-shakeable,
 * and battle-tested across all major EVM chains.
 *
 * Key design decisions:
 * - Batch RPC requests wherever possible to minimize round trips
 * - Decode ERC-20/721/1155 transfers inline during block fetch
 * - Gracefully handle missing receipts (some RPCs throttle receipt fetching)
 */

import {
  createPublicClient,
  http,
  parseAbi,
  decodeEventLog,
  type PublicClient,
  type Block,
  type Transaction,
  type TransactionReceipt,
  type Log,
} from "viem";
import type {
  ChainConfig,
  NormalizedBlock,
  NormalizedTransaction,
  NormalizedLog,
  TokenTransfer,
  ChainSlug,
} from "@noctograph/types";
import type {
  IChainAdapter,
  BlockWithReceipts,
  FetchBlocksOptions,
} from "../adapter.interface.js";

// ERC-20 Transfer(address,address,uint256)
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ERC-721 Transfer is the same signature as ERC-20 but has 3 indexed params
// We disambiguate by checking if the log has 3 topics (ERC-721) vs 2 (ERC-20)

// ERC-1155 TransferSingle(address,address,address,uint256,uint256)
const ERC1155_TRANSFER_SINGLE_TOPIC =
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";

// ERC-1155 TransferBatch(address,address,address,uint256[],uint256[])
const ERC1155_TRANSFER_BATCH_TOPIC =
  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";

const ERC20_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const ERC1155_ABI = parseAbi([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
]);

export interface EVMAdapterOptions {
  rpcUrl: string;
  /** Optional fallback RPC URL */
  fallbackRpcUrl?: string;
}

export class EVMAdapter implements IChainAdapter {
  readonly config: ChainConfig;
  private client: PublicClient;

  constructor(config: ChainConfig, options: EVMAdapterOptions) {
    this.config = config;
    this.client = createPublicClient({
      transport: http(options.rpcUrl, {
        retryCount: 3,
        retryDelay: 500,
        timeout: 30_000,
      }),
    });
  }

  async getLatestBlockNumber(): Promise<bigint> {
    return await this.client.getBlockNumber();
  }

  async getBlock(blockNumber: bigint): Promise<BlockWithReceipts> {
    // Fetch block with full tx objects in one RPC call
    const rawBlock = await this.client.getBlock({
      blockNumber,
      includeTransactions: true,
    });

    // Fetch all receipts in parallel (batched by the HTTP transport)
    const receipts = await this.fetchReceiptsBatched(
      rawBlock.transactions.map((tx) => tx.hash)
    );

    return this.normalizeBlockWithReceipts(rawBlock, receipts);
  }

  async getBlockRange(options: FetchBlocksOptions): Promise<BlockWithReceipts[]> {
    const { fromBlock, toBlock } = options;
    const blockNumbers: bigint[] = [];

    for (let n = fromBlock; n <= toBlock; n++) {
      blockNumbers.push(n);
    }

    // Fetch all blocks in parallel — viem batches these automatically
    // when batch is enabled on the transport (we handle rate limiting
    // at the indexer level via INDEXER_BATCH_SIZE)
    const rawBlocks = await Promise.all(
      blockNumbers.map((n) =>
        this.client.getBlock({ blockNumber: n, includeTransactions: true })
      )
    );

    // Collect all tx hashes across all blocks for batch receipt fetch
    const allTxHashes = rawBlocks.flatMap((b) =>
      b.transactions.map((tx) => tx.hash)
    );
    const allReceipts = await this.fetchReceiptsBatched(allTxHashes);

    // Build a receipt lookup map
    const receiptMap = new Map<string, TransactionReceipt>();
    for (const receipt of allReceipts) {
      if (receipt) receiptMap.set(receipt.transactionHash, receipt);
    }

    return rawBlocks.map((rawBlock) => {
      const blockReceipts = rawBlock.transactions
        .map((tx) => receiptMap.get(tx.hash))
        .filter((r): r is TransactionReceipt => r !== undefined);
      return this.normalizeBlockWithReceipts(rawBlock, blockReceipts);
    });
  }

  async getTransaction(txHash: string): Promise<NormalizedTransaction | null> {
    try {
      const [tx, receipt] = await Promise.all([
        this.client.getTransaction({ hash: txHash as `0x${string}` }),
        this.client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
      ]);

      if (!tx.blockNumber || !tx.blockHash) return null;

      return this.normalizeTx(tx, receipt);
    } catch {
      return null;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    return await this.client.getBalance({ address: address as `0x${string}` });
  }

  async getCode(address: string): Promise<string> {
    const code = await this.client.getCode({ address: address as `0x${string}` });
    return code ?? "0x";
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.client.getBlockNumber();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchReceiptsBatched(
    txHashes: string[]
  ): Promise<TransactionReceipt[]> {
    if (txHashes.length === 0) return [];

    // Fetch in chunks of 50 to avoid overwhelming the RPC
    const CHUNK_SIZE = 50;
    const results: TransactionReceipt[] = [];

    for (let i = 0; i < txHashes.length; i += CHUNK_SIZE) {
      const chunk = txHashes.slice(i, i + CHUNK_SIZE);
      const receipts = await Promise.all(
        chunk.map((hash) =>
          this.client
            .getTransactionReceipt({ hash: hash as `0x${string}` })
            .catch(() => null)
        )
      );
      results.push(...receipts.filter((r): r is TransactionReceipt => r !== null));
    }

    return results;
  }

  private normalizeBlockWithReceipts(
    rawBlock: Block<bigint, true>,
    receipts: TransactionReceipt[]
  ): BlockWithReceipts {
    const receiptMap = new Map<string, TransactionReceipt>();
    for (const r of receipts) {
      receiptMap.set(r.transactionHash, r);
    }

    const block: NormalizedBlock = {
      hash: rawBlock.hash ?? "",
      parentHash: rawBlock.parentHash,
      number: rawBlock.number ?? 0n,
      timestamp: Number(rawBlock.timestamp),
      miner: rawBlock.miner,
      gasUsed: rawBlock.gasUsed,
      gasLimit: rawBlock.gasLimit,
      baseFeePerGas: rawBlock.baseFeePerGas ?? undefined,
      size: rawBlock.size,
      transactionHashes: rawBlock.transactions.map((tx) => tx.hash),
      transactionCount: rawBlock.transactions.length,
      chainSlug: this.config.slug,
      isOrphaned: false,
    };

    const transactions: NormalizedTransaction[] = [];
    const logs: NormalizedLog[] = [];
    const tokenTransfers: TokenTransfer[] = [];

    for (const rawTx of rawBlock.transactions) {
      const receipt = receiptMap.get(rawTx.hash);
      if (!receipt) continue;

      transactions.push(this.normalizeTx(rawTx, receipt));

      // Normalize logs and decode token transfers
      for (const rawLog of receipt.logs) {
        logs.push(this.normalizeLog(rawLog));

        const transfer = this.decodeTokenTransfer(rawLog);
        if (transfer) tokenTransfers.push(transfer);
      }
    }

    return { block, transactions, logs, tokenTransfers };
  }

  private normalizeTx(
    tx: Transaction,
    receipt: TransactionReceipt
  ): NormalizedTransaction {
    const effectiveGasPrice =
      receipt.effectiveGasPrice ?? tx.gasPrice ?? 0n;
    const fee = receipt.gasUsed * effectiveGasPrice;

    return {
      hash: tx.hash,
      blockHash: tx.blockHash ?? "",
      blockNumber: tx.blockNumber ?? 0n,
      transactionIndex: tx.transactionIndex ?? 0,
      from: tx.from,
      to: tx.to ?? null,
      value: tx.value,
      gas: tx.gas,
      gasUsed: receipt.gasUsed,
      gasPrice: tx.gasPrice ?? effectiveGasPrice,
      maxFeePerGas: tx.maxFeePerGas ?? undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? undefined,
      fee,
      input: tx.input,
      nonce: tx.nonce,
      type: Number(tx.typeHex ?? "0x0"),
      status: receipt.status === "success" ? 1 : 0,
      contractAddress: receipt.contractAddress ?? null,
      timestamp: 0, // Populated by the block normalizer
      chainSlug: this.config.slug,
    };
  }

  private normalizeLog(rawLog: Log): NormalizedLog {
    return {
      logIndex: rawLog.logIndex ?? 0,
      transactionHash: rawLog.transactionHash ?? "",
      blockNumber: rawLog.blockNumber ?? 0n,
      address: rawLog.address,
      topics: rawLog.topics as string[],
      data: rawLog.data,
      removed: rawLog.removed ?? false,
      chainSlug: this.config.slug,
    };
  }

  private decodeTokenTransfer(log: Log): TokenTransfer | null {
    const topic0 = log.topics[0];
    if (!topic0) return null;

    const chainSlug: ChainSlug = this.config.slug;
    const baseTransfer = {
      transactionHash: log.transactionHash ?? "",
      logIndex: log.logIndex ?? 0,
      blockNumber: log.blockNumber ?? 0n,
      timestamp: 0, // Populated later from block timestamp
      tokenAddress: log.address,
      chainSlug,
    };

    try {
      // ERC-20 Transfer: 3 topics total (sig + 2 indexed)
      if (topic0 === ERC20_TRANSFER_TOPIC && log.topics.length === 3) {
        const decoded = decodeEventLog({
          abi: ERC20_ABI,
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        if (decoded.eventName === "Transfer") {
          return {
            ...baseTransfer,
            tokenType: "ERC20",
            from: decoded.args.from,
            to: decoded.args.to,
            value: decoded.args.value,
            amount: undefined,
          };
        }
      }

      // ERC-721 Transfer: 4 topics (sig + 3 indexed, no data)
      if (topic0 === ERC20_TRANSFER_TOPIC && log.topics.length === 4) {
        const [, fromTopic, toTopic, tokenIdTopic] = log.topics;
        if (!fromTopic || !toTopic || !tokenIdTopic) return null;

        return {
          ...baseTransfer,
          tokenType: "ERC721",
          from: `0x${fromTopic.slice(26)}`,
          to: `0x${toTopic.slice(26)}`,
          value: BigInt(tokenIdTopic),
          amount: undefined,
        };
      }

      // ERC-1155 TransferSingle
      if (topic0 === ERC1155_TRANSFER_SINGLE_TOPIC) {
        const decoded = decodeEventLog({
          abi: ERC1155_ABI,
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          eventName: "TransferSingle",
        });
        if (decoded.eventName === "TransferSingle") {
          return {
            ...baseTransfer,
            tokenType: "ERC1155",
            from: decoded.args.from,
            to: decoded.args.to,
            value: decoded.args.id,
            amount: decoded.args.value,
          };
        }
      }
    } catch {
      // Decoding failures are expected for non-standard tokens — skip silently
      return null;
    }

    return null;
  }
}
