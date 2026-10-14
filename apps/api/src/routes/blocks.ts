/**
 * Noctograph API — Block Routes
 *
 * GET /api/v1/:chainSlug/blocks              → latest blocks
 * GET /api/v1/:chainSlug/blocks/:numberOrHash → single block
 */

import { Hono } from "hono";
import type { Database } from "@noctograph/db";
import {
  getLatestBlocks,
  getBlockByNumber,
  getBlockByHash,
} from "@noctograph/db";
import { validateChain } from "../middleware/chain-validator.js";
import type { ChainSlug } from "@noctograph/types";

type Env = { Variables: { chainSlug: ChainSlug; db: Database } };

export function createBlocksRouter() {
  const router = new Hono<Env>();

  // GET /api/v1/:chainSlug/blocks
  router.get("/", validateChain, async (c) => {
    const db = c.get("db");
    const chainSlug = c.get("chainSlug");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);

    const rows = await getLatestBlocks(db, chainSlug, limit);

    return c.json({
      success: true,
      data: rows.map(serializeBlock),
      meta: { total: rows.length, limit },
    });
  });

  // GET /api/v1/:chainSlug/blocks/:numberOrHash
  router.get("/:numberOrHash", validateChain, async (c) => {
    const db = c.get("db");
    const chainSlug = c.get("chainSlug");
    const param = c.req.param("numberOrHash");

    let block;

    if (param.startsWith("0x") && param.length === 66) {
      // It's a hash
      block = await getBlockByHash(db, chainSlug, param.toLowerCase());
    } else {
      // It's a block number
      const num = BigInt(param);
      block = await getBlockByNumber(db, chainSlug, num);
    }

    if (!block) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: `Block ${param} not found on ${chainSlug}` },
        },
        404
      );
    }

    return c.json({ success: true, data: serializeBlock(block) });
  });

  return router;
}

function serializeBlock(b: Record<string, unknown>) {
  return {
    ...b,
    number: String(b["number"]),
    gasUsed: String(b["gasUsed"]),
    gasLimit: String(b["gasLimit"]),
    baseFeePerGas: b["baseFeePerGas"] != null ? String(b["baseFeePerGas"]) : null,
    size: String(b["size"]),
    id: String(b["id"]),
  };
}
