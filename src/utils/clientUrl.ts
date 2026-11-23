import type { Request } from "express";

// CLIENT_URL may hold several URLs separated by commas (e.g. "http://localhost:3000,https://my-site.vercel.app")
export function getAllowedOrigins(): string[] {
  return (process.env.CLIENT_URL || "")
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// the client URL to send users back to (Stripe success/cancel pages):
// the site the request came from, if it is allowed - otherwise the last (live) URL
export function getClientUrl(req: Request): string {
  const allowed = getAllowedOrigins();
  const origin = req.headers.origin?.replace(/\/+$/, "");
  if (origin && allowed.includes(origin)) return origin;
  return allowed[allowed.length - 1] || "http://localhost:3000";
}
