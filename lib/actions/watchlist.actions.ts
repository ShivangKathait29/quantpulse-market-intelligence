'use server';

import { connectToDatabase } from "@/database/mongoose";
import Watchlist from "@/database/models/watchlist.model";

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
