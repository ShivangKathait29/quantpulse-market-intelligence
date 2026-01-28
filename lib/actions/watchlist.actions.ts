'use server';

import { connectToDatabase } from "@/database/mongoose";
import Watchlist from "@/database/models/watchlist.model";

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    // Find the user by email in the user collection (Better Auth)
    const user = await db.collection('user').findOne({ email });

    if (!user) {
      return [];
    }

    const userId = user.id || user._id?.toString();

    // Query the Watchlist by userId, return just the symbols as strings
    const watchlistItems = await Watchlist.find({ userId }).select('symbol');

    return watchlistItems.map((item) => item.symbol);
  } catch (error) {
    console.error(`Error fetching watchlist for ${email}:`, error);
    return [];
  }
}

export async function getWatchlistWithDetails(email: string): Promise<WatchlistStockDetails[]> {
  try {
    const symbols = await getWatchlistSymbolsByEmail(email);
    
    if (symbols.length === 0) {
      return [];
    }

    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
      console.error('FINNHUB API key not configured');
      return [];
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

    return stockDetails;
  } catch (error) {
    console.error(`Error fetching watchlist details for ${email}:`, error);
    return [];
  }
}

export async function toggleWatchlist(email: string, symbol: string, company: string, isAdded: boolean) {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    const user = await db.collection('user').findOne({ email });
    if (!user) throw new Error('User not found');

    const userId = user.id || user._id?.toString();

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
    console.error(`Error toggling watchlist for ${email}:`, error);
    throw error;
  }
}

export async function isSymbolInWatchlist(email: string, symbol: string): Promise<boolean> {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('Mongoose connection not connected');

        const user = await db.collection('user').findOne({ email });
        if (!user) return false;

        const userId = user.id || user._id?.toString();

        const count = await Watchlist.countDocuments({ userId, symbol });
        return count > 0;
    } catch (error) {
        console.error(`Error checking watchlist for ${email}:`, error);
        return false;
    }
}
