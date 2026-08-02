import { NextRequest, NextResponse } from "next/server";

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 100;
const WINDOW_MS = 60_000;

export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
    // DO NOT rely on in-memory maps in production serverless environments.
    if (process.env.NODE_ENV === 'production') {
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
