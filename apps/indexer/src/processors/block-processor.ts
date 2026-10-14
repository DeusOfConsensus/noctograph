/**
 * Noctograph — Block Processor
 *
 * Takes a raw BlockWithReceipts from the chain adapter and writes all of it
 * to the database in a single transaction. Atomicity is critical here:
 * we never want a block without its transactions, or logs without their block.
 *
 * Write order matters:
 *   1. Block row
 *   2. Transaction rows (reference block)
 *   3. Log rows (reference transaction)
 *   4. Token transfer rows (decoded from logs)
 *   5. Address upserts (seen in this block)
 *
 * All done inside one DB transaction so a crash mid-write leaves no
 * partial state. The indexer can safely retry from the same block number.
 */

import type { Database } from "@noctograph/db";
import {
  blocks,
  transactions,
  logs,
  tokenTransfers,
  addresses,
} from "@noctograph/db";
import type { BlockWithReceipts } from "@noctograph/chains";
import type { ChainSlug } from "@noctograph/types";

export class BlockProcessor {
  constructor(private readonly db: Database) {}

  async process(
    chainSlug: ChainSlug,
    data: BlockWithReceipts
  ): Promise<{ txCount: number; logCount: number; transferCount: number }> {
    const { block, transactions: txs, logs: rawLogs, tokenTransfers: transfers } = data;

    await this.db.transaction(async (tx) => {
      // 1. Insert block
      await tx
        .insert(blocks)
        .values({
          chainSlug,
          hash: block.hash,
          parentHash: block.parentHash,
          number: block.number,
          timestamp: block.timestamp,
          miner: block.miner.toLowerCase(),
          gasUsed: block.gasUsed,
          gasLimit: block.gasLimit,
          baseFeePerGas: block.baseFeePerGas ?? null,
          size: block.size,
          transactionCount: block.transactionCount,
          isOrphaned: false,
        })
        .onConflictDoNothing();

      // 2. Insert transactions
      if (txs.length > 0) {
        await tx
          .insert(transactions)
          .values(
            txs.map((t) => ({
              chainSlug,
              hash: t.hash,
              blockHash: t.blockHash,
              blockNumber: t.blockNumber,
              transactionIndex: t.transactionIndex,
              from: t.from.toLowerCase(),
              to: t.to?.toLowerCase() ?? null,
              contractAddress: t.contractAddress?.toLowerCase() ?? null,
              value: t.value.toString(),
              gas: t.gas,
              gasUsed: t.gasUsed,
              gasPrice: t.gasPrice,
              maxFeePerGas: t.maxFeePerGas ?? null,
              maxPriorityFeePerGas: t.maxPriorityFeePerGas ?? null,
              fee: t.fee,
              input: t.input,
              nonce: t.nonce,
              type: t.type,
              status: t.status,
              timestamp: block.timestamp,
            }))
          )
          .onConflictDoNothing();
      }

      // 3. Insert logs
      if (rawLogs.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < rawLogs.length; i += CHUNK) {
          await tx
            .insert(logs)
            .values(
              rawLogs.slice(i, i + CHUNK).map((l) => ({
                chainSlug,
                transactionHash: l.transactionHash,
                blockNumber: l.blockNumber,
                logIndex: l.logIndex,
                address: l.address.toLowerCase(),
                topic0: l.topics[0] ?? null,
                topic1: l.topics[1] ?? null,
                topic2: l.topics[2] ?? null,
                topic3: l.topics[3] ?? null,
                data: l.data,
                removed: l.removed,
                timestamp: block.timestamp,
              }))
            )
            .onConflictDoNothing();
        }
      }

      // 4. Insert token transfers
      if (transfers.length > 0) {
        await tx
          .insert(tokenTransfers)
          .values(
            transfers.map((t) => ({
              chainSlug,
              transactionHash: t.transactionHash,
              logIndex: t.logIndex,
              blockNumber: t.blockNumber,
              timestamp: block.timestamp,
              tokenAddress: t.tokenAddress.toLowerCase(),
              tokenType: t.tokenType,
              from: t.from.toLowerCase(),
              to: t.to.toLowerCase(),
              value: t.value.toString(),
              amount: t.amount?.toString() ?? null,
            }))
          )
          .onConflictDoNothing();
      }

      // 5. Upsert addresses seen in this block
      const seenAddresses = this.collectAddresses(data);
      if (seenAddresses.size > 0) {
        // Batch upserts to avoid hitting Postgres param limits
        const addressRows = [...seenAddresses].map((addr) => ({
          chainSlug,
          address: addr,
          firstSeenAt: block.timestamp,
          lastSeenAt: block.timestamp,
        }));

        const CHUNK = 200;
        for (let i = 0; i < addressRows.length; i += CHUNK) {
          await tx
            .insert(addresses)
            .values(addressRows.slice(i, i + CHUNK))
            .onConflictDoUpdate({
              target: [addresses.chainSlug, addresses.address],
              set: { lastSeenAt: block.timestamp, updatedAt: new Date() },
            });
        }
      }
    });

    return {
      txCount: txs.length,
      logCount: rawLogs.length,
      transferCount: transfers.length,
    };
  }

  private collectAddresses(data: BlockWithReceipts): Set<string> {
    const seen = new Set<string>();
    seen.add(data.block.miner.toLowerCase());
    for (const tx of data.transactions) {
      seen.add(tx.from.toLowerCase());
      if (tx.to) seen.add(tx.to.toLowerCase());
      if (tx.contractAddress) seen.add(tx.contractAddress.toLowerCase());
    }
    for (const t of data.tokenTransfers) {
      seen.add(t.from.toLowerCase());
      seen.add(t.to.toLowerCase());
    }
    return seen;
  }
}
