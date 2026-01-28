"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WatchlistButton from "@/components/WatchlistButton";
import SearchCommand from "@/components/SearchCommand";
import { Trash2 } from "lucide-react";
import { createAlert, getUserAlerts, deleteAlert } from "@/lib/actions/alert.actions";
import { toast } from "sonner";

interface WatchlistPageClientProps {
    stocks: WatchlistStockDetails[];
    userEmail: string;
    initialStocks: StockWithWatchlistStatus[];
    news: MarketNewsArticle[];
}

interface AlertItem {
    id: string;
    symbol: string;
    company: string;
    currentPrice: number;
    threshold: number;
    alertType: "upper" | "lower";
    frequency: string;
}

export default function WatchlistPageClient({ stocks, userEmail, initialStocks, news }: WatchlistPageClientProps) {
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<WatchlistStockDetails | null>(null);
    const [alertPrice, setAlertPrice] = useState("");
    const [alertType, setAlertType] = useState<"upper" | "lower">("upper");
    const [frequency, setFrequency] = useState("once");
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadAlerts();
    }, []);

    const loadAlerts = async () => {
        try {
            const userAlerts = await getUserAlerts(userEmail);
            setAlerts(userAlerts as AlertItem[]);
        } catch (error) {
            console.error('Failed to load alerts:', error);
        }
    };

    const formatPrice = (price: number) => `$${price.toFixed(2)}`;
    const formatMarketCap = (cap: number) => {
        if (cap >= 1000) return `$${(cap / 1000).toFixed(2)}T`;
        return `$${cap.toFixed(2)}B`;
    };

    const handleOpenAlertDialog = (stock: WatchlistStockDetails) => {
        setSelectedStock(stock);
        setAlertPrice(stock.price.toFixed(2));
        setIsAlertDialogOpen(true);
    };

    const handleCreateAlert = () => {
        if (!selectedStock || !alertPrice) return;
        
        const newAlert: AlertItem = {
            id: Date.now().toString(),
            symbol: selectedStock.symbol,
            company: selectedStock.company,
            currentPrice: selectedStock.price,
            threshold: parseFloat(alertPrice),
            alertType,
            frequency: frequency === "once" ? "Once per day" : frequency === "hourly" ? "Once per hour" : "Every time"
        };

        setAlerts([...alerts, newAlert]);

        // Close dialog and reset
        setIsAlertDialogOpen(false);
        setSelectedStock(null);
        setAlertPrice("");
        setAlertType("upper");
        setFrequency("once");
    };

    const handleDeleteAlert = async (alertId: string) => {
        try {
            await deleteAlert(alertId);
            toast.success('Alert deleted successfully!');
            await loadAlerts();
        } catch (error) {
            console.error('Failed to delete alert:', error);
            toast.error('Failed to delete alert');
        }
    };

    const handleOpenCreateAlertDialog = () => {
        if (stocks.length === 0) return;
        // Open dialog with first stock selected, or user can pick from dropdown
        setSelectedStock(stocks[0]);
        setAlertPrice(stocks[0].price.toFixed(2));
        setIsAlertDialogOpen(true);
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Watchlist Table - Left Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold">Watchlist</h1>
                            <SearchCommand
                                renderAs="button"
                                label="Add Stock"
                                initialStocks={initialStocks}
                                userEmail={userEmail}
                            />
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b border-gray-800 hover:bg-gray-900">
                                        <TableHead className="text-gray-400 font-medium">Company</TableHead>
                                        <TableHead className="text-gray-400 font-medium hidden sm:table-cell">Symbol</TableHead>
                                        <TableHead className="text-gray-400 font-medium text-right">Price</TableHead>
                                        <TableHead className="text-gray-400 font-medium text-right">Change</TableHead>
                                        <TableHead className="text-gray-400 font-medium text-right hidden md:table-cell">Market Cap</TableHead>
                                        <TableHead className="text-gray-400 font-medium text-right hidden lg:table-cell">P/E Ratio</TableHead>
                                        <TableHead className="text-gray-400 font-medium text-right">Alert</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stocks.map((stock) => (
                                        <TableRow 
                                            key={stock.symbol} 
                                            className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <WatchlistButton
                                                        symbol={stock.symbol}
                                                        company={stock.company}
                                                        isInWatchlist={true}
                                                        userEmail={userEmail}
                                                        type="icon"
                                                    />
                                                    <Link 
                                                        href={`/symbol/${stock.symbol}`}
                                                    onClick={() => handleOpenAlertDialog(stock)}
                                                        className="text-gray-100 hover:text-yellow-500 transition-colors"
                                                    >
                                                        <span className="hidden sm:inline">{stock.company}</span>
                                                        <span className="sm:hidden">{stock.symbol}</span>
                                                    </Link>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-400 hidden sm:table-cell">{stock.symbol}</TableCell>
                                            <TableCell className="text-right text-gray-100">
                                                {formatPrice(stock.price)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={stock.changePercent >= 0 ? "text-green-500" : "text-red-500"}>
                                                    {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-gray-400 hidden md:table-cell">
                                                {formatMarketCap(stock.marketCap)}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-400 hidden lg:table-cell">
                                                {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm" 
                                                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 sm:px-3 py-1"
                                                    onClick={() => handleOpenAlertDialog(stock)}
                                                >
                                                    <span className="hidden sm:inline">Add Alert</span>
                                                    <span className="sm:hidden">+</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* Alerts Panel - Right Section */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center gap-2">
                        <h2 className="text-xl font-bold">Alerts</h2>
                        <Button 
                            onClick={handleOpenCreateAlertDialog}
                            disabled={stocks.length === 0}
                            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="hidden sm:inline">Create Alert</span>
                            <span className="sm:hidden">+ Alert</span>
                        </Button>
                    </div>

                    {alerts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="mb-2">No alerts yet</p>
                            <p className="text-sm">Click "Add Alert" on any stock to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {alerts.map((alert) => (
                                <Card key={alert.id} className="bg-gray-900 border-gray-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                {alert.symbol.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div>
                                                            <h3 className="font-semibold text-gray-100">{alert.company}</h3>
                                                            <p className="text-xs text-gray-500">{alert.symbol}</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleDeleteAlert(alert.id)}
                                                            className="text-gray-400 hover:text-red-400"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="mt-2 space-y-1">
                                                        <div className="text-sm text-gray-400">
                                                            Alert:
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium text-gray-300">
                                                                Price {alert.alertType === "upper" ? ">" : "<"} ${alert.threshold.toFixed(2)}
                                                            </span>
                                                            <button className="text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-500 border border-yellow-600/30">
                                                                {alert.frequency}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* News Section */}
                <div className="mt-12">
                    <h2 className="text-2xl font-bold mb-6">News</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {news.slice(0, 4).map((article, idx) => (
                            <Card key={idx} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                                <CardContent className="p-4">
                                    <div className="inline-block px-2 py-1 mb-3 rounded bg-gray-700/50 text-green-500 text-xs font-mono font-medium">
                                        {article.related || 'MARKET'}
                                    </div>
                                    <h3 className="text-base font-semibold text-gray-100 mb-2 line-clamp-2 leading-tight">
                                        {article.headline}
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-2">
                                        {article.source} • {new Date(article.datetime * 1000).toLocaleDateString()}
                                    </p>
                                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                                        {article.summary}
                                    </p>
                                    <a
                                        href={article.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-yellow-500 hover:text-yellow-400"
                                    >
                                        Read More →
                                    </a>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>

            {/* Alert Dialog */}
            <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-yellow-500">
                            Create Price Alert
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Set a price alert for your watchlist stocks
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="stock-select" className="text-gray-300">Select Stock</Label>
                            <Select 
                                value={selectedStock?.symbol} 
                                onValueChange={(symbol) => {
                                    const stock = stocks.find(s => s.symbol === symbol);
                                    if (stock) {
                                        setSelectedStock(stock);
                                        setAlertPrice(stock.price.toFixed(2));
                                    }
                                }}
                            >
                                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                                    <SelectValue placeholder="Choose a stock" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                                    {stocks.map((stock) => (
                                        <SelectItem key={stock.symbol} value={stock.symbol}>
                                            {stock.company} ({stock.symbol})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedStock && (
                            <div className="p-3 bg-gray-800 rounded-lg">
                                <div className="text-sm text-gray-400">Current Price</div>
                                <div className="text-2xl font-bold text-gray-100">
                                    ${selectedStock.price.toFixed(2)}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="alert-type" className="text-gray-300">Alert Type</Label>
                            <Select value={alertType} onValueChange={(value: "upper" | "lower") => setAlertType(value)}>
                                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                                    <SelectItem value="upper">Price goes above</SelectItem>
                                    <SelectItem value="lower">Price goes below</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="alert-price" className="text-gray-300">Target Price</Label>
                            <Input
                                id="alert-price"
                                type="number"
                                step="0.01"
                                value={alertPrice}
                                onChange={(e) => setAlertPrice(e.target.value)}
                                placeholder="Enter target price"
                                className="bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="frequency" className="text-gray-300">Notification Frequency</Label>
                            <Select value={frequency} onValueChange={setFrequency}>
                                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                                    <SelectItem value="once">Once per day</SelectItem>
                                    <SelectItem value="continuous">Every time</SelectItem>
                                    <SelectItem value="hourly">Once per hour</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAlertDialogOpen(false)}
                            className="text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateAlert}
                            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                            disabled={!alertPrice || parseFloat(alertPrice) <= 0 || isLoading}
                        >
                            {isLoading ? 'Creating...' : 'Create Alert'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
