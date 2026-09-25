import { inngest } from "../client";
import { fetchMarketDataForUser, callGeminiAPI } from "@/lib/actions/news.actions";
import { sendEmail } from "@/lib/actions/email.actions";

export const processUserNews = inngest.createFunction(
  { 
    id: "process-user-news",
    concurrency: {
      limit: 5, // Protect Gemini API limits
    },
    retries: 3 
  },
  { event: "app/user.process_news" },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    // 1. Fetch market data for this specific user's watchlist
    const marketData = await step.run("fetch-market-data", async () => {
       // Note: You must ensure fetchMarketDataForUser is implemented
       return await fetchMarketDataForUser(userId);
    });

    if (!marketData || marketData.length === 0) {
       return { success: false, reason: "No market data or watchlist empty" };
    }

    // 2. Call Gemini API
    const aiSummary = await step.run("generate-ai-summary", async () => {
       // Note: You must ensure callGeminiAPI is implemented
       return await callGeminiAPI(marketData);
    });

    // 3. Send the Email via NodeMailer
    await step.run("send-email", async () => {
       // Note: You must ensure sendEmail is implemented
       await sendEmail(email, "Your Daily Market Intelligence", aiSummary);
    });

    return { success: true, email };
  }
);
