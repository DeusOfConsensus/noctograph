/**
 * Validates :chainSlug route param and injects the chain config into
 * the Hono context so route handlers don't repeat this logic.
 */

import type { MiddlewareHandler } from "hono";
import { CHAIN_CONFIGS, type ChainSlug } from "@noctograph/types";

export const validateChain: MiddlewareHandler = async (c, next) => {
  const slug = c.req.param("chainSlug") as string;

  if (!(slug in CHAIN_CONFIGS)) {
    return c.json(
      {
        success: false,
        error: {
          code: "CHAIN_NOT_SUPPORTED",
          message: `Chain "${slug}" is not supported. Valid chains: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
        },
      },
      400
    );
  }

  c.set("chainSlug", slug as ChainSlug);
  await next();
};
