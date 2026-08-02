import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "./auth";
import { rateLimitMiddleware } from "./fixedWindowRateLimit";
import { loggingMiddleware } from "./logging";
import { applySecurityHeaders } from "./securityHeaders";

type MiddlewareFn = (req: NextRequest) => NextResponse | null | Promise<NextResponse | null>;

function composeMiddleware(...fns: MiddlewareFn[]) {
    return async (req: NextRequest): Promise<NextResponse> => {
        for (const fn of fns) {
            const result = await fn(req);
            if (result !== null) return applySecurityHeaders(result);
        }
        return applySecurityHeaders(NextResponse.next());
    };
}

export const middleware = composeMiddleware(
    loggingMiddleware,      // 1. log every request
    rateLimitMiddleware,    // 2. block abusers before auth check
    authMiddleware,         // 3. redirect unauthenticated users
);


