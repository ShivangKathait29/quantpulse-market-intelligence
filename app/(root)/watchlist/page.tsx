import { getWatchlistSymbolsByEmail } from "@/lib/actions/watchlist.actions";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function WatchlistPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const symbols = await getWatchlistSymbolsByEmail(session.user.email);

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6 text-gray-100">My Watchlist</h1>
            {symbols.length === 0 ? (
                <div className="watchlist-empty-container">
                    <p className="watchlist-empty text-gray-500">Your watchlist is empty. Press ⌘K to search and add stocks!</p>
                </div>
            ) : (
                <div className="watchlist-container">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {symbols.map((symbol) => (
                            <div key={symbol} className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                                <h2 className="text-xl font-bold text-yellow-500">{symbol}</h2>
                                <p className="text-gray-400">Stock details coming soon...</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
