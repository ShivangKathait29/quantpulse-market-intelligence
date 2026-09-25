import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="rounded-full bg-gray-900 p-6 mb-6">
        <Search className="w-12 h-12 text-yellow-500" />
      </div>
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-gray-400 max-w-md mx-auto mb-8">
        We couldn't find the page you're looking for. The stock symbol may be invalid, or the page may have been moved.
      </p>
      <Link href="/">
        <Button className="bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-semibold px-8 py-2">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
