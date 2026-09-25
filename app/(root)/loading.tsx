import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        <p className="text-gray-400 font-medium animate-pulse">Loading market data...</p>
      </div>
    </div>
  );
}
