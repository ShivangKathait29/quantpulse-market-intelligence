import { Redis } from '@upstash/redis';

/**
 * Shared Upstash Redis client.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env
 *
 * Used by:
 *  - middlewares/fixedWindowRateLimit.ts  (distributed rate limiting)
 *  - lib/cache/stock-cache.ts             (quote pre-warming & caching)
 *  - lib/inngest/warm-cache.ts            (Inngest cron pre-warmer)
 */
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
