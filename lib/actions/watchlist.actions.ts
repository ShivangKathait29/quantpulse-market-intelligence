'use server';

import { connectToDatabase } from "@/database/mongoose";
import Watchlist from "@/database/models/watchlist.model";
import { requireSession } from "@/lib/better-auth/require-session";
import { DatabaseError, toUserMessage } from "@/lib/errors";
import { env } from "@/lib/config/env";

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export async function getWatchlistSymbolsByEmail() {
  try {
    const { userId } = await requireSession();

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new DatabaseError('Mongoose connection not connected');

    // Query the Watchlist by userId, return just the symbols as strings
    const watchlistItems = await Watchlist.find({ userId }).select('symbol');

    return { success: true as const, data: watchlistItems.map((item) => item.symbol) };
  } catch (error) {
    console.error(`Error fetching watchlist for user:`, error);
    return { success: false as const, error: toUserMessage(error) };
  }
}

export async function getWatchlistWithDetails() {
  try {
    const { userId: _ } = await requireSession(); // ensures caller is authenticated

    const symbolsResult = await getWatchlistSymbolsByEmail();
    if (!symbolsResult.success) {
      return { success: false as const, error: symbolsResult.error };
    }
    const symbols = symbolsResult.data;
    
    if (symbols.length === 0) {
      return { success: true as const, data: [] as WatchlistStockDetails[] };
    }

    const token = env.FINNHUB_TOKEN;
    if (!token) {
      console.error('FINNHUB API key not configured');
      return { success: false as const, error: 'API key not configured' };
    }

    // Fetch quote and profile data for each symbol
    const stockDetails = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const [quoteRes, profileRes] = await Promise.all([
            fetch(`${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${token}`, { next: { revalidate: 60 } }),
            fetch(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${token}`, { next: { revalidate: 3600 } })
          ]);

          const quote = quoteRes.ok ? await quoteRes.json() : {};
          const profile = profileRes.ok ? await profileRes.json() : {};

          return {
            symbol,
            company: profile.name || symbol,
            price: quote.c || 0,
            change: quote.d || 0,
            changePercent: quote.dp || 0,
            marketCap: profile.marketCapitalization || 0,
            peRatio: 0, // Finnhub doesn't provide P/E in basic endpoints
          };
        } catch (error) {
          console.error(`Error fetching details for ${symbol}:`, error);
          return {
            symbol,
            company: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            marketCap: 0,
            peRatio: 0,
          };
        }
      })
    );

    return { success: true as const, data: stockDetails };
  } catch (error) {
    console.error(`Error fetching watchlist details for user:`, error);
    return { success: false as const, error: 'Failed to fetch watchlist details' };
  }
}

export async function toggleWatchlist(symbol: string, company: string, isAdded: boolean) {
  try {
    const { userId } = await requireSession();

    if (isAdded) {
      await Watchlist.findOneAndUpdate(
        { userId, symbol },
        { userId, symbol, company },
        { upsert: true, new: true }
      );
    } else {
      await Watchlist.deleteOne({ userId, symbol });
    }
  } catch (error) {
    console.error(`Error toggling watchlist for user:`, error);
    throw error;
  }
}

export async function isSymbolInWatchlist(symbol: string): Promise<boolean> {
  try {
    const { userId } = await requireSession();

    const count = await Watchlist.countDocuments({ userId, symbol });
    return count > 0;
  } catch (error) {
    console.error(`Error checking watchlist for user:`, error);
    return false;
  }
}
