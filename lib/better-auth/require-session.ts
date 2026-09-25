import { auth } from './auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';

/**
 * Call this at the top of any Server Action that requires the caller to be
 * authenticated. It does three things in one call:
 *
 *   1. Verifies a valid Better Auth session exists.
 *   2. Connects to MongoDB and resolves the user document.
 *   3. Returns { session, userId } — the two things every action needs.
 *
 * Throws 'Unauthorized' or 'User not found' if any step fails, which
 * Next.js will surface as a server-side error and never reach the DB layer.
 */
export async function requireSession() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error('Unauthorized');

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    const user = await db.collection('user').findOne({ email: session.user.email });
    if (!user) throw new Error('User not found');

    const userId: string = user.id ?? user._id?.toString();

    return { session, userId };
}
