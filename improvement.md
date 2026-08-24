# QuantPulse Market Intelligence - Improvement Roadmap

**Goal:** Transform the project from a strong student portfolio piece into a production-minded, scalable, and interview-ready distributed system suitable for SDE-I / Junior Engineering roles.

This document outlines a phased approach to refactoring the architecture, enhancing security, and improving performance.

---

## Phase 1: Security & Correctness (Highest Priority)
**Estimated Time:** 4–6 hours | **Resume Impact:** ⭐⭐⭐⭐⭐

Address critical security vulnerabilities and fix anti-patterns that cause silent failures.

### Objectives
- **End-to-End Validation (Zod):** Implement Zod schemas to validate incoming payloads in all Server Actions, preventing malicious or malformed requests from bypassing client-side React Hook Form validation. Use `@hookform/resolvers/zod` to share these schemas with the frontend for DRY type safety.
- **Session Validation:** Refactor `middlewares/auth.ts` to actually validate the Better Auth session against the database (e.g., using `auth.api.getSession`), rather than just checking for the existence of a cookie.
- **Error Handling (What is Missing / Areas for Improvement):** 
  - Stop swallowing exceptions in server actions (e.g., returning `[]` on API failures). Implement structured error responses (e.g., `{ success: false, error: string }`) and display toast notifications on the client.
  - **No Custom Error Classes:** The project currently throws standard `new Error('message')` instances. There is no centralized error class system (e.g., `class DatabaseError extends Error` or `class ValidationError`) to differentiate between types of failures programmatically.
  - **No Global Error Boundary:** While Next.js App Router supports `error.tsx` files to catch unhandled runtime errors in UI components, the backend API and server actions rely mostly on localized `try...catch` blocks rather than a centralized error processing utility.
- **Authorization Audit:** Ensure every single Server Action explicitly calls `requireSession()` and all database mutations enforce ownership (using `userId` in the query). Specifically, `getActiveAlerts` in `alert.actions.ts` is currently exposed as a public server action with no session guard; it must be moved to an internal helper.
- **Environment Variables:** Replace any remaining `process.env` usages in the codebase with the centralized, typed `env` module from `lib/config/env.ts`.

### Interview Flex
> *"During my security audit, I discovered a potential bypass in the edge middleware where it only verified cookie presence. I refactored it to validate the session signature. I also noticed our Server Actions implicitly trusted client-side forms, so I introduced Zod for strict server-side payload validation and end-to-end type safety."*

---

## Phase 2: Backend Performance
**Estimated Time:** 1–2 days | **Resume Impact:** ⭐⭐⭐⭐⭐

Eliminate performance bottlenecks that would cause the system to fail under load.

### Objectives
- **Finnhub Deduplication:** In `checkPriceAlerts`, extract a `Set` of unique symbols from all active alerts. Fetch quotes for those unique symbols *once*, cache them in a dictionary, and then evaluate the alerts against that dictionary.
- **Eliminate N+1 Queries:** In `sendDailyNewsSummary`, stop querying the database inside the user loop. Fetch all watchlists for all target users in a single query: `Watchlist.find({ userId: { $in: userIds } })`.
- **DRY API Calls:** In `getWatchlistWithDetails`, replace the raw `fetch()` calls to Finnhub with the shared `getQuote()` / `fetchJSON()` helpers to ensure it utilizes the central caching layer and API key fallbacks.
- **Database Connection Pooling:** Unify the MongoDB connection used by Better Auth and the Mongoose connection used by the app to prevent opening double the required connections on serverless cold starts.

---

## Phase 3: Inngest Architecture (The "Crown Jewel")
**Estimated Time:** 2–3 days | **Resume Impact:** ⭐⭐⭐⭐⭐⭐

Transition from sequential loops to a robust, fault-tolerant **Fan-Out** architecture.

### Objectives
- **Fan-Out Pattern for News:** Refactor the `sendDailyNewsSummary` cron job. Instead of doing the work sequentially, it should emit an event (e.g., `app/user.process_news`) for every user. 
- **Fan-In / Workers:** Create a new Inngest function that listens to `app/user.process_news` and handles exactly *one* user (fetching data, calling Gemini, sending email).
- **Concurrency & Retries:** Configure concurrency limits on the new function so the Gemini API isn't overwhelmed. If one email fails, Inngest will retry only that specific user's job.

### Interview Flex
> *"My cron job initially timed out on Vercel because it processed users sequentially. I re-architected it using an event-driven Fan-Out pattern with Inngest, allowing independent retries and horizontal scalability."*

---

## Phase 4: Redis & Caching
**Estimated Time:** 2 days | **Resume Impact:** ⭐⭐⭐⭐⭐

Implement distributed caching to handle external rate limits and protect the application infrastructure.

### Objectives

- **Distributed Rate Limiting:** Replace the in-memory `Map` in `middlewares/fixedWindowRateLimit.ts` (which is useless in serverless) with Upstash Redis and `@upstash/ratelimit`.
- **AI Response Caching:** Hash a user's watchlist symbols. If multiple users have the exact same watchlist, fetch the generated AI summary from Redis instead of calling the Gemini API again, saving massive costs and latency.
- **Learn Fundamentals:** Understand TTL, Cache Invalidation, and Cache Stampedes.

### Known Issues in `middlewares/fixedWindowRateLimit.ts`

#### Issue 1 — No Rate Limiting in Production (Serverless Incompatibility)

**Problem:** The current implementation uses an in-memory `Map` to track request counts per IP. In a serverless/edge environment (Vercel, AWS Lambda), every cold-start spins up a fresh process, resetting the counter on every invocation. This makes the rate limiter completely useless in production — any attacker can bypass it simply by triggering a new function instance.

**Fix:** Replace the `Map` with `@upstash/ratelimit`, which uses serverless Redis as a shared, persistent store across all instances.

```bash
npm install @upstash/ratelimit @upstash/redis
```

Add to `.env`:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Replace `middlewares/fixedWindowRateLimit.ts` with:
```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(100, "60s"),
});

export async function rateLimitMiddleware(request: NextRequest) {
    if (!request.nextUrl.pathname.startsWith("/api")) return null;
    const ip = request.ip ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": "60" } }
        );
    }
    return null;
}
```

> **Note:** Remove the `process.env.NODE_ENV === 'production'` guard once this is implemented — the Redis-backed limiter works correctly in all environments.

---

#### Issue 2 — IP Address Can Be Spoofed via `x-forwarded-for`

**Problem:** `x-forwarded-for` is a plain HTTP header — any client can send a fake value (e.g. `x-forwarded-for: 1.2.3.4`) to impersonate a different IP and bypass per-IP rate limiting entirely.

**Fix:** On Vercel, use `request.ip` — it is injected by Vercel's trusted edge proxy and **cannot be overridden by the client**.

Change line 16 in the current implementation from:
```ts
// ❌ Spoofable by any client
const ip = request.headers.get("x-forwarded-for") ?? "unknown";
```
To:
```ts
// ✅ Set by Vercel's trusted edge proxy, not the client
const ip = request.ip ?? "unknown";
```

> On non-Vercel hosts, only trust `x-forwarded-for` if it is set by a **known, trusted reverse proxy** — not by the end user.

---

### Current Caching Strategies (What Already Exists)

Before adding Redis, it's important to understand the three caching layers already in place:

#### Layer 1 — Next.js Fetch Cache (`lib/actions/finnhub.actions.ts`)

The `fetchJSON<T>()` helper uses Next.js's built-in `fetch` cache with per-call TTLs:

```ts
const options = revalidateSeconds
    ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
    : { cache: 'no-store' };
```

| Function | TTL | Rationale |
|---|---|---|
| `getQuote()` | 60s | Stock prices change frequently |
| `getNews()` (company & general) | 300s (5 min) | News doesn't update per-second |
| `searchStocks()` — popular profiles | 3600s (1 hour) | Company profiles rarely change |
| `searchStocks()` — search queries | 1800s (30 min) | Search results are stable |

**How it works:** Next.js intercepts `fetch()` calls and stores responses in its Data Cache (disk in dev, CDN-backed in prod). On the next call with the same URL within the TTL window, the cached response is returned — no Finnhub API call is made.

#### Layer 2 — React `cache()` (Per-Request Deduplication)

```ts
export const searchStocks = cache(async (query?: string) => { ... });
```

React's `cache()` memoizes `searchStocks` so that if it's called **multiple times with the same argument during a single server render**, the function executes only once. This prevents redundant Finnhub calls if multiple Server Components on the same page both call `searchStocks("AAPL")`.

- **Scope:** Single request/render only — cleared after each response
- **Key difference from fetch cache:** Fetch cache persists across requests; `react.cache` is per-request only

#### Layer 3 — Global Connection Cache (`database/mongoose.ts`)

```ts
let cached = global.mongooseCache; // { conn, promise }

if (cached.conn) return cached.conn; // reuse existing connection
```

Stores the Mongoose connection on `global` so it survives **hot-module reloads** in development. Without this, every file save would open a new DB connection and exhaust the MongoDB connection pool.

- **Scope:** Process lifetime (persists across requests within the same Node process)
- **Why `global`:** Module-level variables reset on hot-reload, but `global` does not

#### What's Missing

- **No distributed cache (Redis)** — no shared cache across serverless instances; each cold-start is a blank slate
- **No AI response caching** — Gemini is called for every user's news summary even if multiple users share the exact same watchlist symbols
- **No MongoDB query caching** — repeated DB reads for the same data (e.g., watchlists) are always fresh queries

#### Layer 4 (Proposed) — Popular Stock Pre-Warming with Upstash Redis

The Next.js fetch cache is per-instance and lost on cold starts. To ensure popular stocks are always served instantly — even on the first request after a cold start — pre-warm them into a shared Redis cache using an Inngest cron job.

**1. Install dependencies:**
```bash
npm install @upstash/redis
```

**2. Create a shared Redis client (`lib/cache/redis.ts`):**
```ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

**3. Cache-aware quote fetcher (`lib/cache/stock-cache.ts`):**
```ts
import { redis } from './redis';
import { fetchJSON } from '@/lib/actions/finnhub.actions';

const QUOTE_TTL = 60; // seconds

export async function getCachedQuote(symbol: string): Promise<FinnhubQuote | null> {
    const key = `quote:${symbol.toUpperCase()}`;

    // Try Redis first
    const cached = await redis.get<FinnhubQuote>(key);
    if (cached) return cached;

    // Cache miss — fetch from Finnhub and store
    const token = process.env.FINNHUB_API_KEY ?? '';
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    const quote = await fetchJSON<FinnhubQuote>(url, QUOTE_TTL);

    if (quote) await redis.set(key, quote, { ex: QUOTE_TTL });
    return quote;
}
```

**4. Inngest cron job to pre-warm popular stocks (`lib/inngest/warm-cache.ts`):**
```ts
import { inngest } from './client';
import { redis } from '@/lib/cache/redis';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';

const QUOTE_TTL = 60;

export const warmPopularStocks = inngest.createFunction(
    { id: 'warm-popular-stock-cache' },
    { cron: '* * * * *' }, // every minute
    async ({ step }) => {
        await step.run('fetch-and-cache-quotes', async () => {
            const token = process.env.FINNHUB_API_KEY ?? '';
            const results = await Promise.allSettled(
                POPULAR_STOCK_SYMBOLS.slice(0, 15).map(async (sym) => {
                    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${token}`;
                    const res = await fetch(url);
                    if (!res.ok) return;
                    const quote = await res.json();
                    await redis.set(`quote:${sym}`, quote, { ex: QUOTE_TTL });
                })
            );
            const failed = results.filter(r => r.status === 'rejected').length;
            return { warmed: results.length - failed, failed };
        });
    }
);
```

**How it works:**
- The Inngest cron runs every minute and pushes fresh quotes for the top 15 popular symbols into Upstash Redis with a 60s TTL.
- When a user requests a quote, `getCachedQuote()` checks Redis first. For popular stocks, it's almost always a cache hit — zero Finnhub latency, zero API usage.
- Because Upstash Redis is shared across all serverless instances, cold starts still get instant cache hits.

| Metric | Without Pre-Warming | With Pre-Warming |
|---|---|---|
| Cold-start latency (popular stock) | ~200-500ms (Finnhub API call) | ~5-15ms (Redis GET) |
| Finnhub API calls for popular stocks | Per-user, per-request | 15/min (cron only) |
| Works across serverless instances | ❌ | ✅ |

---

## Phase 5: AI Improvements
**Estimated Time:** 2 days | **Resume Impact:** ⭐⭐⭐⭐

Optimize token usage and protect against Prompt Injection.

### Objectives
- **Mitigate Prompt Injection:** Wrap the raw Finnhub JSON news in strict XML tags (e.g., `<raw_data>...</raw_data>`) and instruct Gemini to strictly ignore any system instructions hidden within that block.
- **Token Efficiency:** Only send the headline and summary (omitting huge URLs or metadata) to Gemini to reduce token costs and speed up generation time.

---

## Phase 6: Production Readiness
**Estimated Time:** 3 days | **Resume Impact:** ⭐⭐⭐⭐

Add the observability required to run the system in a real-world environment.

### Objectives
- **Monitoring:** Integrate Sentry to catch unhandled promise rejections and UI crashes.
- **Structured Logging:** Add a `requestId` and `userId` to all `console.error` and `console.info` statements so you can trace a specific user's path through the backend.
- **Graceful Failures:** Ensure that if Finnhub is down, the UI gracefully informs the user rather than crashing or showing "$0.00".

---

## Phase 7: Testing
**Estimated Time:** 3–5 days | **Resume Impact:** ⭐⭐⭐⭐⭐

Prove the reliability of your refactored logic.

### Objectives
- **Integration Tests:** Write tests for your Server Actions (e.g., proving that a user cannot delete another user's alert).
- **Inngest Tests:** Write tests for your Fan-Out architecture to ensure events are emitted correctly.
- **E2E Tests:** Use Playwright to write a simple script that logs in, adds a stock to the watchlist, and creates a price alert.

> **Tip:** Write a few of these tests *before* doing the massive Phase 2 and 3 refactors so you know you haven't broken existing functionality!

---

## Phase 8: DevOps
**Estimated Time:** 2 days | **Resume Impact:** ⭐⭐⭐⭐

Automate the development lifecycle.

### Objectives
- **GitHub Actions CI/CD:** Create a workflow that runs `npm run lint`, `tsc --noEmit` (TypeScript checks), and your new test suite automatically on every Pull Request.
- **Deployment Protection:** Configure the CI to block merging into `main` if the build or tests fail.

---

## Phase 9: Documentation
**Estimated Time:** 1 day | **Resume Impact:** ⭐⭐⭐⭐⭐

Make the repository recruiter-ready.

### Objectives
- **Architecture Diagrams:** Update the Mermaid diagrams in the README to reflect the new Fan-Out Inngest architecture and Redis caching layer.
- **Professional README:** Polish the README, highlighting the scalability problems you solved.
- **API/Action Docs:** Briefly document the inputs and outputs of your core Server Actions.

---

## Phase 10: Advanced Architecture & Feature Enhancements
**Estimated Time:** 3–4 days | **Resume Impact:** ⭐⭐⭐⭐⭐

Implement standout features that demonstrate deep system design knowledge.

### Objectives
- **Webhook-Based Price Alerts:** Currently, `checkPriceAlerts` polls Finnhub every 5 minutes. Finnhub offers **WebSocket streaming** for real-time trades. Switching to push-based alerts via webhooks is a compelling architecture upgrade (Finnhub WS → `/api/webhooks/price` → Inngest event → alert evaluation).
- **Server-Side Hydration for Alerts:** `getUserAlerts` currently returns a dummy `currentPrice: 0` and relies on the client to fetch the real price. Hydrate the price server-side using `getQuote()` alongside the DB query to avoid the client-side N+1 fetching anti-pattern.
- **Alert History / Audit Log:** Right now, triggered alerts only update the `lastTriggered` timestamp. Add an `AlertHistory` model to store every trigger event (timestamp, price at trigger, etc.) to power a "History" tab in the UI.
- **Percentage Change Alerts:** Alerts only support absolute price boundaries (`upper`/`lower`). Add a `percentChange` alert type (e.g., "notify me if AAPL moves ±5% in a day") utilizing Finnhub's `quote.dp` field.