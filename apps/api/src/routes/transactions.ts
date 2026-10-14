/**
 * Noctograph API — Transaction Routes
 *
 * GET /api/v1/:chainSlug/transactions              → latest transactions
 * GET /api/v1/:chainSlug/transactions/:hash        → single transaction
 * GET /api/v1/:chainSlug/transactions/block/:number → txs in a block
 */

import { Hono } from "hono";
import type { Database } from "@noctograph/db";
import {
  getLatestTransactions,
  getTransactionByHash,
  getTransactionsByBlock,
} from "@noctograph/db";
import { validateChain } from "../middleware/chain-validator.js";
import type { ChainSlug } from "@noctograph/types";

type Env = { Variables: { chainSlug: ChainSlug; db: Database } };

export function createTransactionsRouter() {
  const router = new Hono<Env>();

  // GET /api/v1/:chainSlug/transactions
  router.get("/", validateChain, async (c) => {
    const db = c.get("db");
    const chainSlug = c.get("chainSlug");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);

    const rows = await getLatestTransactions(db, chainSlug, limit);

    return c.json({
      success: true,
      data: rows.map(serializeTx),
      meta: { total: rows.length, limit },
    });
  });

  // GET /api/v1/:chainSlug/transactions/block/:number
  router.get("/block/:number", validateChain, async (c) => {
    const db = c.get("db");
    const chainSlug = c.get("chainSlug");
    const blockNumber = BigInt(c.req.param("number"));

    const rows = await getTransactionsByBlock(db, chainSlug, blockNumber);

    return c.json({
      success: true,
      data: rows.map(serializeTx),
      meta: { total: rows.length },
    });
  });

  // GET /api/v1/:chainSlug/transactions/:hash
  router.get("/:hash", validateChain, async (c) => {
    const db = c.get("db");
    const chainSlug = c.get("chainSlug");
    const hash = c.req.param("hash").toLowerCase();

    const tx = await getTransactionByHash(db, chainSlug, hash);

    if (!tx) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: `Transaction ${hash} not found on ${chainSlug}` },
        },
        404
      );
    }

    return c.json({ success: true, data: serializeTx(tx) });
  });

  return router;
}

function serializeTx(t: Record<string, unknown>) {
  return {
    ...t,
    id: String(t["id"]),
    blockNumber: String(t["blockNumber"]),
    gas: String(t["gas"]),
    gasUsed: String(t["gasUsed"]),
    gasPrice: String(t["gasPrice"]),
    maxFeePerGas: t["maxFeePerGas"] != null ? String(t["maxFeePerGas"]) : null,
    maxPriorityFeePerGas:
      t["maxPriorityFeePerGas"] != null ? String(t["maxPriorityFeePerGas"]) : null,
    fee: String(t["fee"]),
  };
}
