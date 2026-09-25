'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="rounded-full bg-red-950/30 p-6 mb-6">
        <AlertCircle className="w-12 h-12 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-gray-400 max-w-md mx-auto mb-8">
        We encountered an unexpected error while trying to load this page. Please try again.
      </p>
      <div className="flex gap-4">
        <Button
          onClick={() => reset()}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-semibold"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
