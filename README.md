# Noctograph

A deep, modular, multi-chain blockchain explorer. Built for developers and non-developers alike — two lenses on the same data.

## Supported Chains

| Chain | Chain ID | Type | Status |
|---|---|---|---|
| Ethereum | 1 | L1 | ✓ |
| Base | 8453 | L2 (OP Stack) | ✓ |
| Arbitrum One | 42161 | L2 (Arbitrum) | ✓ |
| Polygon PoS | 137 | Sidechain | ✓ |
| Avalanche C-Chain | 43114 | L1 | ✓ |

### Chain Adapter Pattern

Every chain is accessed through `IChainAdapter`. Adding a new chain = writing a new adapter. The indexer never touches chain SDKs directly.

```
Blockchain → RPC → IChainAdapter → Indexer → PostgreSQL → API → Frontend
```

## Quick Start

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- PostgreSQL Database
- An [Alchemy](https://alchemy.com) API key

### Setup

```bash
# Install dependencies
pnpm install

# Copy env file and fill in your values
cp .env.example .env

# Generate DB migrations
pnpm db:generate

# Run migrations against your Supabase DB
pnpm db:migrate
```

### Development

```bash
# Start the indexer (defaults to Base chain)
pnpm indexer:dev

# Start the API in another terminal
pnpm api:dev
```

The API will be available at `http://localhost:3001`.

## API Reference

```
GET /health
GET /api/v1/chains
GET /api/v1/chains/:chainSlug
GET /api/v1/:chainSlug/blocks?limit=20
GET /api/v1/:chainSlug/blocks/:numberOrHash
GET /api/v1/:chainSlug/transactions?limit=20
GET /api/v1/:chainSlug/transactions/:hash
GET /api/v1/:chainSlug/transactions/block/:number
```

## Environment Variables

See `.env.example` for full documentation of all variables.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript (strict) | Type safety across the whole system |
| Monorepo | Turborepo + pnpm workspaces | Fast builds, shared packages |
| Blockchain | viem | Type-safe, tree-shakeable EVM client |
| Database ORM | Drizzle | Type-safe SQL, no magic, fast inserts |
| Database | PostgreSQL | Relational, indexed |
| API | Hono | Lightweight, edge-compatible, fast |

## License

MIT — build freely.

---

*Built with Passion by [Kenechukwu](https://github.com/DeusOfConsensus)*
