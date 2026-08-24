import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_PATHS = ["/sign-in", "/sign-up"];

/**
 * Sanitizes a callbackUrl to prevent open-redirect attacks and auth-loop redirects.
 * - Must be a relative path (no protocol/host)
 * - Must not point back to an auth page
 * Falls back to "/" if the value is invalid.
 */
function sanitizeCallbackUrl(pathname: string): string {
    // Reject anything that looks like an absolute URL (contains "://", starts with "//", etc.)
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(pathname) || pathname.startsWith("//")) {
        return "/";
    }

    // Reject auth pages to prevent redirect loops
    if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
        return "/";
    }

    return pathname;
}

export function authMiddleware(request: NextRequest): NextResponse | null {
    const { pathname } = request.nextUrl;

    // Bypass auth redirect for APIs and public pages
    if (pathname.startsWith('/api') || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
        return null;
    }

    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
        const signInUrl = new URL("/sign-in", request.url);
        signInUrl.searchParams.set("callbackUrl", sanitizeCallbackUrl(pathname));
        return NextResponse.redirect(signInUrl);
    }

    return null;
}
