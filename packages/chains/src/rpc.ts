/**
 * Noctograph — RPC URL Builder
 *
 * Centralizes RPC endpoint construction so switching providers
 * is a one-line change. Supports Alchemy for EVM chains,
 * with public fallbacks for chains Alchemy doesn't cover.
 */

import type { ChainSlug } from "@noctograph/types";
import { CHAIN_CONFIGS } from "@noctograph/types";

export interface RPCConfig {
  primary: string;
  fallback?: string;
}

/**
 * Build RPC URLs for a given chain.
 * Uses Alchemy when an API key is available and the chain is supported.
 * Falls back to public endpoints otherwise.
 */
export function buildRPCConfig(
  chainSlug: ChainSlug,
  alchemyApiKey?: string
): RPCConfig {
  const config = CHAIN_CONFIGS[chainSlug];

  // Avalanche uses its own public RPC — Alchemy doesn't have a free tier for it
  if (chainSlug === "avalanche") {
    return {
      primary: "https://api.avax.network/ext/bc/C/rpc",
      fallback: "https://rpc.ankr.com/avalanche",
    };
  }

  if (alchemyApiKey && config.rpcQuirks?.alchemyNetwork) {
    return {
      primary: `https://${config.rpcQuirks.alchemyNetwork}.g.alchemy.com/v2/${alchemyApiKey}`,
      fallback: getPublicRPC(chainSlug),
    };
  }

  // No Alchemy key — use public RPCs (fine for dev, not for prod)
  return {
    primary: getPublicRPC(chainSlug),
  };
}

function getPublicRPC(chainSlug: ChainSlug): string {
  const publicRPCs: Record<ChainSlug, string> = {
    ethereum: "https://ethereum.publicnode.com",
    base: "https://mainnet.base.org",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    polygon: "https://polygon-rpc.com",
    avalanche: "https://api.avax.network/ext/bc/C/rpc",
  };
  return publicRPCs[chainSlug];
}
