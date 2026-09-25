import { inngest } from "../client";
import { User } from "@/database/mongoose";

export const dispatchDailyNews = inngest.createFunction(
  { id: "dispatch-daily-news" },
  { cron: "0 8 * * *" }, // Runs every day at 8:00 AM
  async ({ step }) => {
    // 1. Get all users from MongoDB who are subscribed
    const users = await step.run("fetch-users", async () => {
      // Return a plain object to avoid Mongoose document serialization issues
      return await User.find({ subscribed: true }).select("_id email").lean();
    });

    // 2. Prepare an event for every single user
    const events = users.map(user => ({
      name: "app/user.process_news" as const,
      data: {
        userId: user._id.toString(),
        email: user.email
      }
    }));

    if (events.length === 0) return { dispatched: 0 };

    // 3. Fire all events to Inngest at once
    await step.sendEvent("fan-out-news-jobs", events);
    
    return { dispatched: events.length };
  }
);
