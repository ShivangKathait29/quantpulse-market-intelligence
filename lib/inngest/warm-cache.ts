import { inngest } from './client';
import { redis } from '@/lib/cache/redis';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';

const QUOTE_TTL = 60; // seconds — keep in sync with stock-cache.ts

/**
 * Issue 3 fix — Popular Stock Pre-Warming (Redis Layer 4).
 *
 * Problem this solves:
 *   The Next.js fetch cache is per-instance and lost on cold starts.
 *   First request after a cold start always triggers a Finnhub API call (~200–500ms).
 *
 * Solution:
 *   This cron runs every minute, pushing fresh quotes for the top 15 popular
 *   symbols into Upstash Redis with a 60s TTL. Because Upstash is a shared,
 *   distributed cache, ALL serverless instances benefit — even brand-new cold starts.
 *
 * Result:
 *   Popular stock requests go from ~200–500ms (Finnhub round-trip) → ~5–15ms (Redis GET).
 *   Finnhub API calls for popular stocks collapse from per-user/per-request → 15 calls/min.
 */
export const warmPopularStocks = inngest.createFunction(
    { id: 'warm-popular-stock-cache' },
    { cron: '* * * * *' }, // every minute
    async ({ step }) => {
        return await step.run('fetch-and-cache-quotes', async () => {
            const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

            const results = await Promise.allSettled(
                POPULAR_STOCK_SYMBOLS.slice(0, 15).map(async (sym) => {
                    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${token}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Finnhub ${res.status} for ${sym}`);
                    const quote = await res.json();
                    await redis.set(`quote:${sym}`, quote, { ex: QUOTE_TTL });
                })
            );

            const failed = results.filter((r) => r.status === 'rejected').length;
            const warmed = results.length - failed;
            console.info(`[warm-cache] warmed=${warmed} failed=${failed}`);
            return { warmed, failed };
        });
    }
);
