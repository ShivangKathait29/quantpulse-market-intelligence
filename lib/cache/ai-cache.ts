import { redis } from './redis';

/**
 * AI Response Caching (Phase 4 — final piece).
 *
 * Problem this solves:
 *   processUserNews calls Gemini for EVERY user, even when two users have
 *   identical watchlists (e.g. both track AAPL, MSFT, NVDA). Each Gemini
 *   call costs tokens and adds ~2–5s of latency.
 *
 * Strategy (cache-aside):
 *   1. Sort symbols alphabetically → deterministic cache key regardless of
 *      insertion order (["MSFT","AAPL"] === ["AAPL","MSFT"]).
 *   2. Check Redis first — cache HIT returns the summary instantly.
 *   3. Cache MISS → caller runs Gemini → result stored in Redis with a 6h TTL.
 *      News summaries are date-scoped and stale after a day, so 6h is safe.
 *
 * Result:
 *   If 10 users share the same watchlist, Gemini is called once — not 10 times.
 *   Cost reduction: proportional to the number of users with overlapping watchlists.
 */

const AI_SUMMARY_TTL = 60 * 60 * 6; // 6 hours in seconds

/**
 * Builds a deterministic Redis key from a list of stock symbols.
 * Symbols are sorted and uppercased so order doesn't affect the key.
 *
 * Example: ["msft", "aapl"] → "ai-summary:AAPL,MSFT"
 */
function buildSummaryKey(symbols: string[]): string {
    const normalized = [...symbols]
        .map((s) => s.toUpperCase().trim())
        .filter(Boolean)
        .sort()
        .join(',');
    return `ai-summary:${normalized}`;
}

/**
 * Returns a cached AI news summary for the given watchlist symbols,
 * or null if no cached entry exists.
 */
export async function getCachedAISummary(symbols: string[]): Promise<string | null> {
    if (symbols.length === 0) return null;
    const key = buildSummaryKey(symbols);
    return redis.get<string>(key);
}

/**
 * Stores a Gemini-generated news summary in Redis, keyed by watchlist symbols.
 * TTL is 6 hours — summaries are tied to today's news so they go stale by EOD.
 */
export async function setCachedAISummary(symbols: string[], summary: string): Promise<void> {
    if (symbols.length === 0 || !summary) return;
    const key = buildSummaryKey(symbols);
    await redis.set(key, summary, { ex: AI_SUMMARY_TTL });
}
