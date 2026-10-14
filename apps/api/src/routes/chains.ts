/**
 * Noctograph API — Chain Routes
 *
 * GET /api/v1/chains              → list all supported chains + indexer status
 * GET /api/v1/chains/:chainSlug   → single chain info + live stats
 */

import { Hono } from "hono";
import type { Database } from "@noctograph/db";
import { getAllIndexerStates } from "@noctograph/db";
import { CHAIN_CONFIGS, type ChainSlug } from "@noctograph/types";

type Env = { Variables: { db: Database } };

export function createChainsRouter() {
  const router = new Hono<Env>();

  // GET /api/v1/chains
  router.get("/", async (c) => {
    const db = c.get("db");
    const states = await getAllIndexerStates(db);
    const stateMap = Object.fromEntries(states.map((s) => [s.chainSlug, s]));

    const data = Object.values(CHAIN_CONFIGS).map((config) => {
      const state = stateMap[config.slug];
      return {
        ...config,
        indexer: state
          ? {
              status: state.status,
              indexedHead: String(state.indexedHead),
              totalBlocksIndexed: String(state.totalBlocksIndexed),
              totalTxsIndexed: String(state.totalTxsIndexed),
              totalReorgsDetected: state.totalReorgsDetected,
              lastError: state.lastError,
              updatedAt: state.updatedAt,
            }
          : null,
      };
    });

    return c.json({ success: true, data });
  });

  // GET /api/v1/chains/:chainSlug
  router.get("/:chainSlug", async (c) => {
    const slug = c.req.param("chainSlug") as ChainSlug;

    if (!(slug in CHAIN_CONFIGS)) {
      return c.json(
        {
          success: false,
          error: {
            code: "CHAIN_NOT_SUPPORTED",
            message: `Chain "${slug}" is not supported.`,
          },
        },
        404
      );
    }

    const db = c.get("db");
    const states = await getAllIndexerStates(db);
    const state = states.find((s) => s.chainSlug === slug);

    return c.json({
      success: true,
      data: {
        ...CHAIN_CONFIGS[slug],
        indexer: state
          ? {
              status: state.status,
              indexedHead: String(state.indexedHead),
              totalBlocksIndexed: String(state.totalBlocksIndexed),
              totalTxsIndexed: String(state.totalTxsIndexed),
              totalReorgsDetected: state.totalReorgsDetected,
              lastError: state.lastError,
              updatedAt: state.updatedAt,
            }
          : null,
      },
    });
  });

  return router;
}
