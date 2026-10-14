import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit runs from packages/db/, so ../../.env resolves to the repo root .env
config({ path: "../../.env" });

export default {
  // List schema files individually — drizzle-kit uses its own CJS bundler which
  // can't resolve the .js extensions in the barrel re-exports (index.ts).
  // Listing each file directly bypasses the barrel entirely.
  schema: [
    "./src/schema/blocks.ts",
    "./src/schema/transactions.ts",
    "./src/schema/logs.ts",
    "./src/schema/addresses.ts",
    "./src/schema/token_transfers.ts",
    "./src/schema/indexer_state.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? (() => { throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in."); })(),
  },
  verbose: true,
  strict: true,
} satisfies Config;
