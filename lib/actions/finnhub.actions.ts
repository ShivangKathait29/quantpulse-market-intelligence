'use server';

import { 
  getDateRange, 
  validateArticle, 
  formatArticle, 
  calculateNewsDistribution 
} from "@/lib/utils";

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

async function fetchJSON(url: string, revalidateSeconds?: number) {
  try {
    const options: RequestInit = revalidateSeconds !== undefined
      ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
      : { cache: 'no-store' };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
  try {
    const { from, to } = getDateRange(5);

    if (symbols && symbols.length > 0) {
      const cleanSymbols = symbols
        .map(s => s.trim().toUpperCase())
        .filter(s => s !== '');
      
      if (cleanSymbols.length === 0) return getNews(); // Fallback if all symbols invalid

      const allArticles: MarketNewsArticle[] = [];
      const { itemsPerSymbol } = calculateNewsDistribution(cleanSymbols.length);
      
      // Round-robin approach as requested
      // Loop max 6 times
      for (let i = 0; i < 6; i++) {
        const symbol = cleanSymbols[i % cleanSymbols.length];
        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${NEXT_PUBLIC_FINNHUB_API_KEY}`;
        
        try {
          const rawArticles: RawNewsArticle[] = await fetchJSON(url, 3600); // Cache company news for 1 hour
          
          // Find one valid article not already in allArticles
          const validArticle = rawArticles.find(art => 
            validateArticle(art) && 
            !allArticles.some(existing => existing.headline === art.headline?.trim())
          );

          if (validArticle) {
            allArticles.push(formatArticle(validArticle, true, symbol, i));
          }
        } catch (err) {
          console.error(`Error fetching news for ${symbol}:`, err);
          // Continue to next symbol
        }
      }

      // Sort by datetime descending
      return allArticles.sort((a, b) => b.datetime - a.datetime);
    } else {
      // General market news
      const url = `${FINNHUB_BASE_URL}/news?category=general&token=${NEXT_PUBLIC_FINNHUB_API_KEY}`;
      const rawArticles: RawNewsArticle[] = await fetchJSON(url, 3600);

      const formattedArticles: MarketNewsArticle[] = [];
      const seenItems = new Set<string>();

      for (const art of rawArticles) {
        if (formattedArticles.length >= 6) break;

        if (validateArticle(art)) {
          const dedupeKey = art.id?.toString() || art.url || art.headline;
          if (dedupeKey && !seenItems.has(dedupeKey)) {
            seenItems.add(dedupeKey);
            formattedArticles.push(formatArticle(art, false, undefined, formattedArticles.length));
          }
        }
      }

      return formattedArticles;
    }
  } catch (error) {
    console.error('Failed to fetch news:', error);
    throw new Error('Failed to fetch news');
  }
}
