import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 100;
const WINDOW_MS = 60_000;

export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
    // DO NOT rely on in-memory maps in production serverless environments.
    if (env.NODE_ENV === 'production') {
        // TODO: Implement distributed rate limiting (e.g. @upstash/ratelimit)
        return null;
    }

    if (!request.nextUrl.pathname.startsWith("/api")) return null;

    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const entry = requestCounts.get(ip);

    if (!entry || entry.resetAt < now) {
        requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return null;
    }
    
    if (entry.count >= LIMIT) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": "60" } }
        );
    }
    
    entry.count++;
    return null;
}

/*
 * ─── IMPROVEMENTS NEEDED (post caching study) ────────────────────────────────
 *
 * ISSUE 1 — No rate limiting in production
 * ─────────────────────────────────────────
 * Problem:
 *   The in-memory Map above is per-process. In a serverless/edge environment
 *   (Vercel, AWS Lambda), every cold-start spins up a fresh process, so the
 *   counter resets on every invocation. This makes the rate limiter useless
 *   in production — any attacker can bypass it by simply triggering a new
 *   function instance.
 *
 * Fix (after learning Redis / caching):
 *   Replace the Map with @upstash/ratelimit, which uses serverless Redis as a
 *   shared, persistent store across all instances.
 *
 *   Steps:
 *     1. npm install @upstash/ratelimit @upstash/redis
 *     2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env
 *     3. Replace this file with:
 *
 *        import { Ratelimit } from "@upstash/ratelimit";
 *        import { Redis } from "@upstash/redis";
 *
 *        const ratelimit = new Ratelimit({
 *            redis: Redis.fromEnv(),
 *            limiter: Ratelimit.fixedWindow(100, "60s"),
 *        });
 *
 *        export async function rateLimitMiddleware(request: NextRequest) {
 *            if (!request.nextUrl.pathname.startsWith("/api")) return null;
 *            const ip = request.ip ?? "unknown";
 *            const { success } = await ratelimit.limit(ip);
 *            if (!success) {
 *                return NextResponse.json(
 *                    { error: "Too many requests" },
 *                    { status: 429, headers: { "Retry-After": "60" } }
 *                );
 *            }
 *            return null;
 *        }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ISSUE 2 — IP address can be spoofed via x-forwarded-for
 * ────────────────────────────────────────────────────────
 * Problem:
 *   `x-forwarded-for` is a plain HTTP header — any client can send a fake value
 *   (e.g. "x-forwarded-for: 1.2.3.4") to impersonate a different IP and bypass
 *   per-IP rate limiting.
 *
 * Fix:
 *   On Vercel, use `request.ip` — it is injected by Vercel's trusted edge proxy
 *   and cannot be overridden by the client.
 *   On other hosts, only trust `x-forwarded-for` if it is set by a known,
 *   trusted reverse proxy (not by the end user).
 *
 *   Change line 16 from:
 *     const ip = request.headers.get("x-forwarded-for") ?? "unknown";
 *   To (Vercel):
 *     const ip = request.ip ?? "unknown";
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
