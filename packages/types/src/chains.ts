/**
 * Noctograph — Chain Types
 *
 * The canonical chain registry. Every other package imports from here.
 * Adding a new chain = adding it here first.
 */

export type ChainId =
  | 1      // Ethereum Mainnet
  | 8453   // Base
  | 42161  // Arbitrum One
  | 137    // Polygon PoS
  | 43114; // Avalanche C-Chain

export const CHAIN_IDS = {
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  POLYGON: 137,
  AVALANCHE: 43114,
} as const satisfies Record<string, ChainId>;

export type ChainSlug = "ethereum" | "base" | "arbitrum" | "polygon" | "avalanche";

export interface ChainConfig {
  /** Numeric chain ID per EIP-155 */
  id: ChainId;
  /** URL-safe lowercase slug used in API paths and DB partition keys */
  slug: ChainSlug;
  /** Display name */
  name: string;
  /** Native currency */
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  /** Average block time in milliseconds */
  blockTimeMs: number;
  /**
   * How many confirmations before a block is considered final.
   * L2s with fraud-proof windows need a higher value.
   */
  finalityDepth: number;
  /** Whether this is an L2 (affects indexer logic for batch/sequencer data) */
  isL2: boolean;
  /** Parent chain ID for L2s */
  parentChainId?: ChainId;
  /** Public block explorer URL (for reference links) */
  explorerUrl: string;
  /** Chain-specific RPC quirks */
  rpcQuirks?: {
    /** Some chains limit eth_getLogs range (blocks per request) */
    maxLogsRange?: number;
    /** Alchemy app name used in RPC URL path */
    alchemyNetwork?: string;
  };
}

export const CHAIN_CONFIGS: Record<ChainSlug, ChainConfig> = {
  ethereum: {
    id: 1,
    slug: "ethereum",
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockTimeMs: 12_000,
    finalityDepth: 64,
    isL2: false,
    explorerUrl: "https://etherscan.io",
    rpcQuirks: {
      maxLogsRange: 2000,
      alchemyNetwork: "eth-mainnet",
    },
  },
  base: {
    id: 8453,
    slug: "base",
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockTimeMs: 2_000,
    finalityDepth: 300, // ~10 min of L2 blocks for soft finality
    isL2: true,
    parentChainId: 1,
    explorerUrl: "https://basescan.org",
    rpcQuirks: {
      maxLogsRange: 5000,
      alchemyNetwork: "base-mainnet",
    },
  },
  arbitrum: {
    id: 42161,
    slug: "arbitrum",
    name: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockTimeMs: 250, // Arbitrum blocks are ~250ms
    finalityDepth: 1000,
    isL2: true,
    parentChainId: 1,
    explorerUrl: "https://arbiscan.io",
    rpcQuirks: {
      maxLogsRange: 10_000,
      alchemyNetwork: "arb-mainnet",
    },
  },
  polygon: {
    id: 137,
    slug: "polygon",
    name: "Polygon PoS",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockTimeMs: 2_000,
    finalityDepth: 128,
    isL2: false, // PoS sidechain, not a true L2
    explorerUrl: "https://polygonscan.com",
    rpcQuirks: {
      maxLogsRange: 3500,
      alchemyNetwork: "polygon-mainnet",
    },
  },
  avalanche: {
    id: 43114,
    slug: "avalanche",
    name: "Avalanche C-Chain",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    blockTimeMs: 2_000,
    finalityDepth: 1, // Avalanche achieves near-instant finality (< 2s)
    isL2: false,
    explorerUrl: "https://snowtrace.io",
    rpcQuirks: {
      maxLogsRange: 2048,
      // Avalanche uses its own public RPC, not Alchemy
      alchemyNetwork: undefined,
    },
  },
};

/** Resolve a chain slug from a chain ID */
export function chainIdToSlug(chainId: number): ChainSlug | undefined {
  return Object.values(CHAIN_CONFIGS).find((c) => c.id === chainId)?.slug;
}

/** Get chain config by chain ID */
export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = Object.values(CHAIN_CONFIGS).find((c) => c.id === chainId);
  if (!config) throw new Error(`No chain config for chain ID ${chainId}`);
  return config;
}
