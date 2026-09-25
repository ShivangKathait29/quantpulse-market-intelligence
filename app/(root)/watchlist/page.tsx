import { getWatchlistWithDetails } from "@/lib/actions/watchlist.actions";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WatchlistPageClient from "@/components/WatchlistPageClient";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { getNews } from "@/lib/actions/finnhub.actions";

export default async function WatchlistPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const [stocks, initialStocks, news] = await Promise.all([
        getWatchlistWithDetails(session.user.email),
        searchStocks(),
        getNews()
    ]);

    return <WatchlistPageClient 
        stocks={stocks} 
        userEmail={session.user.email} 
        initialStocks={initialStocks}
        news={news}
    />;
}
