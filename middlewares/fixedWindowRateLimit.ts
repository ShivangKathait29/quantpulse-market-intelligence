import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(100, "60s"),
});

function getIpAddress(request: NextRequest): string {
    return (
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

export async function rateLimitMiddleware(request: NextRequest) {
    if (!request.nextUrl.pathname.startsWith("/api")) return null;
    const ip = getIpAddress(request);
    const { success } = await ratelimit.limit(ip);
    if (!success) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": "60" } }
        );
    }
    return null;
}
