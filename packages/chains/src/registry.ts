/**
 * Noctograph — Adapter Registry
 *
 * The single place where adapters are instantiated and accessed.
 * The indexer and API both use this registry to get adapters.
 *
 * Usage:
 *   const registry = createAdapterRegistry({ alchemyApiKey: "..." });
 *   const adapter = registry.get("base");
 *   const block = await adapter.getBlock(12345678n);
 */

import type { ChainSlug } from "@noctograph/types";
import { CHAIN_CONFIGS } from "@noctograph/types";
import type { IChainAdapter } from "./adapter.interface.js";
import { EVMAdapter } from "./adapters/evm.adapter.js";
import { buildRPCConfig } from "./rpc.js";

export interface RegistryOptions {
  alchemyApiKey?: string;
  /** Only instantiate adapters for these chains. Defaults to all. */
  activeChains?: ChainSlug[];
}

export class AdapterRegistry {
  private adapters = new Map<ChainSlug, IChainAdapter>();

  constructor(options: RegistryOptions = {}) {
    const chains =
      options.activeChains ?? (Object.keys(CHAIN_CONFIGS) as ChainSlug[]);

    for (const slug of chains) {
      const config = CHAIN_CONFIGS[slug];
      const rpcConfig = buildRPCConfig(slug, options.alchemyApiKey);

      // All 5 chains are EVM-compatible — use the same adapter
      // When Solana is added, it gets its own adapter class here
      const adapter = new EVMAdapter(config, { rpcUrl: rpcConfig.primary });
      this.adapters.set(slug, adapter);
    }
  }

  get(chainSlug: ChainSlug): IChainAdapter {
    const adapter = this.adapters.get(chainSlug);
    if (!adapter) {
      throw new Error(
        `No adapter registered for chain: ${chainSlug}. ` +
          `Active chains: ${[...this.adapters.keys()].join(", ")}`
      );
    }
    return adapter;
  }

  getAll(): Map<ChainSlug, IChainAdapter> {
    return new Map(this.adapters);
  }

  has(chainSlug: ChainSlug): boolean {
    return this.adapters.has(chainSlug);
  }

  activeChains(): ChainSlug[] {
    return [...this.adapters.keys()];
  }

  async healthCheckAll(): Promise<
    Record<ChainSlug, { healthy: boolean; latencyMs: number }>
  > {
    const results = await Promise.all(
      [...this.adapters.entries()].map(async ([slug, adapter]) => {
        const health = await adapter.healthCheck();
        return [slug, health] as const;
      })
    );
    return Object.fromEntries(results) as Record<
      ChainSlug,
      { healthy: boolean; latencyMs: number }
    >;
  }
}

export function createAdapterRegistry(options: RegistryOptions): AdapterRegistry {
  return new AdapterRegistry(options);
}
