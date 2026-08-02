import { NextResponse } from "next/server";

export function applySecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    
    // Using Report-Only to prevent accidental breakage of TradingView embedded scripts/iframes
    response.headers.set(
        "Content-Security-Policy-Report-Only",
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://s3.tradingview.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://finnhub.io",
            "frame-src https://s.tradingview.com",
        ].join("; ")
    );
    return response;
}
