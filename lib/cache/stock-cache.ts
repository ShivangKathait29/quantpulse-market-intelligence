import { redis } from './redis';
import { fetchJSON } from '@/lib/actions/finnhub.actions';

const QUOTE_TTL = 60; // seconds — matches Next.js fetch cache TTL for getQuote()

/**
 * Cache-aware quote fetcher (Issue 2 fix — Redis distributed cache Layer 4).
 *
 * Strategy (cache-aside):
 *   1. Check Upstash Redis first → cache HIT returns instantly (~5–15ms)
 *   2. Cache MISS → fetch from Finnhub, store in Redis with 60s TTL
 *
 * Benefits over raw getQuote():
 *   - Works across serverless instances (shared Redis, not per-process)
 *   - Cold starts still get cache hits for pre-warmed popular stocks
 *   - Reduces Finnhub API usage dramatically for popular symbols
 */
export async function getCachedQuote(symbol: string): Promise<FinnhubQuote | null> {
    const key = `quote:${symbol.toUpperCase()}`;

    // 1. Try Redis first
    const cached = await redis.get<FinnhubQuote>(key);
    if (cached) return cached;

    // 2. Cache miss — fetch from Finnhub via the central fetchJSON helper
    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${token}`;

    const quote = await fetchJSON<FinnhubQuote>(url, QUOTE_TTL).catch(() => null);
    if (quote) await redis.set(key, quote, { ex: QUOTE_TTL });

    return quote;
}
