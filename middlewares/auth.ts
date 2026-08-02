import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function authMiddleware(request: NextRequest): NextResponse | null {
    const { pathname } = request.nextUrl;
    
    // Bypass auth redirect for APIs and public pages
    if (pathname.startsWith('/api') || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
        return null; 
    }

    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
        const signInUrl = new URL("/sign-in", request.url);
        signInUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(signInUrl);
    }
    
    return null;
}
