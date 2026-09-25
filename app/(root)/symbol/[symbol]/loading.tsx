import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SymbolLoading() {
  return (
    <div className="flex min-h-screen p-4 md:p-6 lg:p-8 animate-pulse">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          <Card className="bg-gray-900 border-gray-800 h-[170px]">
            <CardHeader className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500/50" />
            </CardHeader>
          </Card>
          <Card className="bg-gray-900 border-gray-800 h-[600px]">
          </Card>
          <Card className="bg-gray-900 border-gray-800 h-[600px]">
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 h-10">
             <div className="w-32 h-10 bg-gray-800 rounded-md"></div>
             <div className="w-10 h-10 bg-gray-800 rounded-md"></div>
          </div>
          <Card className="bg-gray-900 border-gray-800 h-[400px]">
          </Card>
          <Card className="bg-gray-900 border-gray-800 h-[600px]">
          </Card>
        </div>
      </section>
    </div>
  );
}
