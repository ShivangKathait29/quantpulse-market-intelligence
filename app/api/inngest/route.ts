import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { 
    sendSignUpEmail, 
    dispatchDailyNews, processUserNews, 
    checkPriceAlerts 
} from "@/lib/inngest/functions";
import { warmPopularStocks } from "@/lib/inngest/warm-cache";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendSignUpEmail,
    dispatchDailyNews, processUserNews,
    checkPriceAlerts,
    warmPopularStocks,
  ],
});
