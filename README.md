# Noctograph

**Illuminate the chain.**

Noctograph is a modular, multi-chain blockchain explorer built for depth. Not just a lookup tool — a serious piece of infrastructure for reading, decoding, and analyzing on-chain activity across EVM networks.

Built for developers and non-developers alike through a dual-mode interface: **Arcane View** for raw technical depth, **Common View** for plain English readability. Same data, two lenses.

---

## Supported Chains

- Ethereum
- Base
- Arbitrum
- Polygon
- Avalanche (C-Chain)

All chains are implemented through a pluggable adapter pattern. Adding a new chain is a single module, not a rewrite.

---

## Features

**Transaction Intelligence**
- Plain English transaction decoder powered by ABI registry + AI interpretation
- Internal call trace visualizer — interactive call tree with ETH flow and revert mapping
- MEV detection — flags sandwich attacks, frontrunning, and arbitrage automatically
- Simulation mode — simulate any transaction against current chain state before broadcasting

**Wallet Intelligence**
- Behavioral profiling — classifies wallets by activity pattern (trader, LP, DAO voter, etc.)
- Historical PnL tracking across all tokens for any wallet address
- Wallet relationship graph — visualizes interaction patterns between addresses
- Risk scoring — surfaces interactions with known exploits, mixers, and sanctioned addresses

**Contract Intelligence**
- Live ABI interaction panel — call any contract function directly from the explorer
- Storage slot inspector — read raw contract storage state
- Upgrade history tracker — full implementation changelog for UUPS and Transparent proxies
- Vulnerability surface hints — first-pass flags for common Solidity risk patterns

**Analytics**
- Gas oracle with historical heatmaps and optimal timing recommendations
- Network health dashboard — TPS, block utilization, mempool depth, sequencer behavior
- Cross-chain capital flow tracker — real-time visualization of asset movement between chains
- Token flow analysis — accumulation vs. distribution patterns, whale wallet alerts
- Protocol metrics — auto-aggregated TVL approximation, unique users, and volume trends

---

## Architecture

```
┌──────────────────────────────────────────────┐
│             NOCTOGRAPH FRONTEND              │
│          Next.js · React · TypeScript        │
│   ┌─────────────────┐  ┌──────────────────┐  │
│   │   Arcane View   │  │   Common View    │  │
│   └─────────────────┘  └──────────────────┘  │
└──────────────────┬───────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼───────────────────────────┐
│             NOCTOGRAPH BACKEND               │
│              Node.js · Express               │
│  ┌──────────────────────────────────────┐    │
│  │          Chain Adapter Layer         │    │
│  │   ETH · Base · ARB · POLY · AVAX    │    │
│  └──────────────────────────────────────┘    │
│  ┌─────────────────┐  ┌─────────────────┐    │
│  │     Indexer     │  │ Analytics Engine│    │
│  └─────────────────┘  └─────────────────┘    │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│                 PostgreSQL                   │
│  blocks · transactions · token_transfers     │
│  wallets · contracts · events · analytics    │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│            RPC Infrastructure                │
│       Alchemy (primary) · Infura (fallback)  │
└──────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | Next.js, React, TypeScript, wagmi, viem, Chart.js |
| Backend | Node.js, Express, ethers.js, viem |
| Database | PostgreSQL via Supabase |
| RPC | Alchemy, Infura |
| Hosting | Vercel (frontend), Render (backend) |
| Dev Tools | Hardhat, Git |

---

## Getting Started

> Noctograph is under active development. Setup instructions are updated as the project progresses.

**Prerequisites**
```
node >= 18.0.0
npm >= 9.0.0
PostgreSQL >= 15
```

**Installation**
```bash
git clone https://github.com/DeusOfConsensus/Noctograph.git
cd Noctograph
npm install
cp .env.example .env
npm run dev
```

**Environment Variables**
```env
ALCHEMY_API_KEY=
INFURA_API_KEY=
DATABASE_URL=
DATABASE_ANON_KEY=

ENABLE_ETHEREUM=true
ENABLE_BASE=true
ENABLE_ARBITRUM=false
ENABLE_POLYGON=false
ENABLE_AVALANCHE=false
```

---

## License

MIT
