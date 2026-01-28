"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import WatchlistButton from "@/components/WatchlistButton";
import TradingViewWidget from "@/components/TradingViewWidget";
import { 
    CANDLE_CHART_WIDGET_CONFIG, 
    TECHNICAL_ANALYSIS_WIDGET_CONFIG,
    COMPANY_PROFILE_WIDGET_CONFIG 
} from "@/lib/constants";

interface WatchlistDashboardProps {
    symbols: string[];
    userEmail: string;
}

export default function WatchlistDashboard({ symbols, userEmail }: WatchlistDashboardProps) {
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6 text-gray-100">My Watchlist</h1>
            
            {symbols.length === 0 ? (
                <div className="watchlist-empty-container">
                    <p className="watchlist-empty text-gray-500">
                        Your watchlist is empty. Press ⌘K to search and add stocks!
                    </p>
                </div>
            ) : (
                <Tabs defaultValue="grid" className="w-full">
                    <TabsList className="mb-6 bg-gray-800 border border-gray-700">
                        <TabsTrigger value="grid" className="data-[state=active]:bg-gray-700 data-[state=active]:text-yellow-500">
                            Grid View
                        </TabsTrigger>
                        <TabsTrigger value="dashboard" className="data-[state=active]:bg-gray-700 data-[state=active]:text-yellow-500">
                            Dashboard
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="grid">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {symbols.map((symbol) => (
                                <Sheet key={symbol}>
                                    <SheetTrigger asChild>
                                        <Card className="bg-gray-900 border-gray-800 hover:border-yellow-500 transition-colors cursor-pointer">
                                            <CardHeader>
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-yellow-500">{symbol}</CardTitle>
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <WatchlistButton
                                                            symbol={symbol}
                                                            company={symbol}
                                                            isInWatchlist={true}
                                                            userEmail={userEmail}
                                                            type="icon"
                                                        />
                                                    </div>
                                                </div>
                                                <CardDescription className="text-gray-400">
                                                    Click to view detailed dashboard
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <TradingViewWidget
                                                    scriptUrl={`${scriptUrl}mini-symbol-overview.js`}
                                                    config={{
                                                        symbol: symbol,
                                                        width: "100%",
                                                        height: 220,
                                                        locale: "en",
                                                        dateRange: "12M",
                                                        colorTheme: "dark",
                                                        isTransparent: true,
                                                        autosize: false,
                                                        largeChartUrl: ""
                                                    }}
                                                    height={220}
                                                />
                                            </CardContent>
                                        </Card>
                                    </SheetTrigger>
                                    <SheetContent className="w-full sm:max-w-4xl bg-gray-900 border-gray-800 overflow-y-auto">
                                        <SheetHeader>
                                            <SheetTitle className="text-2xl text-yellow-500">{symbol} Dashboard</SheetTitle>
                                            <SheetDescription className="text-gray-400">
                                                Complete analysis and charts for {symbol}
                                            </SheetDescription>
                                        </SheetHeader>
                                        <div className="mt-6 space-y-6">
                                            <TradingViewWidget
                                                scriptUrl={`${scriptUrl}advanced-chart.js`}
                                                config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
                                                className="custom-chart"
                                                height={500}
                                            />
                                            <TradingViewWidget
                                                scriptUrl={`${scriptUrl}technical-analysis.js`}
                                                config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
                                                height={400}
                                            />
                                            <TradingViewWidget
                                                scriptUrl={`${scriptUrl}company-profile.js`}
                                                config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
                                                height={400}
                                            />
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="dashboard">
                        <div className="space-y-6">
                            <Card className="bg-gray-900 border-gray-800">
                                <CardHeader>
                                    <CardTitle className="text-gray-100">Market Overview</CardTitle>
                                    <CardDescription className="text-gray-400">
                                        Select a stock to view detailed analysis
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                                        {symbols.map((symbol) => (
                                            <button
                                                key={symbol}
                                                onClick={() => setSelectedSymbol(symbol)}
                                                className={`p-4 rounded-lg border transition-all ${
                                                    selectedSymbol === symbol
                                                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                                                        : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600"
                                                }`}
                                            >
                                                <div className="font-bold text-lg">{symbol}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {selectedSymbol ? (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-2xl font-bold text-yellow-500">{selectedSymbol}</h3>
                                                <WatchlistButton
                                                    symbol={selectedSymbol}
                                                    company={selectedSymbol}
                                                    isInWatchlist={true}
                                                    userEmail={userEmail}
                                                    showTrashIcon
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <TradingViewWidget
                                                    scriptUrl={`${scriptUrl}advanced-chart.js`}
                                                    config={CANDLE_CHART_WIDGET_CONFIG(selectedSymbol)}
                                                    className="custom-chart"
                                                    height={400}
                                                />
                                                <TradingViewWidget
                                                    scriptUrl={`${scriptUrl}technical-analysis.js`}
                                                    config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(selectedSymbol)}
                                                    height={400}
                                                />
                                            </div>

                                            <TradingViewWidget
                                                scriptUrl={`${scriptUrl}company-profile.js`}
                                                config={COMPANY_PROFILE_WIDGET_CONFIG(selectedSymbol)}
                                                height={440}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500">
                                            Select a stock from above to view its dashboard
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
