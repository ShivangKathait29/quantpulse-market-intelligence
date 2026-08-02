import { NextRequest } from "next/server";

export function loggingMiddleware(request: NextRequest): null {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        method: request.method,
        path: request.nextUrl.pathname,
        ip: request.headers.get("x-forwarded-for") ?? "unknown",
    }));
    return null;
}
