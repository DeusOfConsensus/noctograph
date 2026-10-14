import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = (process.env["API_CORS_ORIGINS"] ?? "http://localhost:3000")
      .split(",")
      .map((s) => s.trim());
    return allowed.includes(origin) ? origin : allowed[0] ?? "*";
  },
  allowMethods: ["GET", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});
