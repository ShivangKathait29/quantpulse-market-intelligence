# 🚀 QuantPulse — Last-Minute Interview Cheat Sheet

You have less time, so this guide cuts out the fluff. Use this to quickly memorize your project's core narrative, the "why" behind your technical decisions, and the answers to the most common questions.

---

## 1. The 30-Second Elevator Pitch (Memorize This)
*"QuantPulse is a personalized market intelligence platform I built to solve the problem of generic financial dashboards. It uses **Next.js** for the frontend, **MongoDB** for the database, and integrates the **Finnhub API** for real-time market data. The core feature is an event-driven background system built with **Inngest** that polls stock prices every 5 minutes and triggers email alerts. I also integrated the **Gemini 2.5 Flash Lite** API to generate personalized daily news summaries based on a user's specific watchlist and risk profile, which are delivered via a scheduled cron job."*

---

## 2. Tech Stack Justifications (Why did you choose X?)

* **Next.js (App Router):** Wanted to use Server Actions to simplify data mutations without writing separate API routes. Used Server Components for fast initial data fetching (watchlists) and Client Components for interactivity.
* **MongoDB:** Perfect for rapidly iterating the schema. Used compound indexes for fast lookups.
* **Inngest:** Needed reliable background jobs. Raw `setInterval` or node-cron loses state if the server restarts. Inngest gives me step-level retries and an observability dashboard.
* **Better-Auth:** Lighter and simpler than NextAuth/Auth.js. Native MongoDB adapter and handles session cookies seamlessly.
* **Finnhub API:** Free tier provides exactly what's needed (quotes, news, profiles).

---

## 3. Basic Questions (The "What" and "How")

**Q1: How does your authentication work?**
> "I use Better-Auth with email/password. Sessions are stored in MongoDB. I protect routes at two levels: Next.js middleware checks for a session cookie before the page loads, and if missing, **redirects to the root landing page (`/`)**. The Root Layout also does a server-side session check as a fallback."

**Q2: How does the Watchlist feature work?**
> "Users search for a stock, and when they click 'Add', a Server Action saves it to MongoDB. The database has a compound unique index on `{ userId: 1, symbol: 1 }` to prevent duplicates. For the UI, I use a manual optimistic pattern: I immediately set local state `added = true`, then call the server action inside a React `useTransition` so it doesn't freeze the UI. If the server call fails, I revert the local state."

**Q3: How do you fetch and cache data from the Finnhub API?**
> "Because Finnhub limits me to 60 calls/minute, I rely heavily on Next.js caching (`force-cache` with `revalidate`). I use four different TTLs based on data volatility:
> 1. **Stock quotes:** 60 seconds (changes constantly)
> 2. **Company news:** 300 seconds / 5 mins
> 3. **Search results:** 1800 seconds / 30 mins
> 4. **Company profiles:** 3600 seconds / 1 hour (rarely changes)"

**Q4: How do the AI personalized emails work? (The Event-Driven Flow)**
> "There are two flows:
> 1. **Welcome Email:** It's completely event-driven. When a user signs up, the server action calls Better-Auth, then fires an `app/user.created` Inngest event. An Inngest function picks this up asynchronously, passes the user's profile to the **Gemini 2.5 Flash Lite** model to generate an intro, and sends it via Nodemailer.
> 2. **Daily News:** A cron job fetches news for each user's watchlist, passes it to Gemini to output formatted HTML summaries, and emails them. Inngest handles retries if the AI fails."

**Q5: How do the price alerts work?**
> "When a user sets an alert, it saves to MongoDB. An Inngest cron job runs every 5 minutes (`*/5 * * * *`). It queries all active alerts, fetches the current price from Finnhub, evaluates the threshold, and if crossed, uses Nodemailer to send an HTML email via Gmail SMTP. We use soft-delete (`isActive: false`) when a user deletes an alert."

---

## 4. Advanced / System Design Questions (The "Why" and "What If")

**Q1: What happens if your 5-minute cron job takes longer than 5 minutes to run?**
> "Right now, it processes alerts sequentially to respect the Finnhub rate limit. If it scales up, I would batch the Finnhub API calls. Instead of fetching the price for every *alert*, I would fetch the price once for every *unique symbol*, and then evaluate all alerts related to that symbol. This changes the API calls from O(Alerts) to O(Unique Stocks)."

**Q2: What happens if two users create identical alerts?**
> "Currently, **nothing prevents a user from creating duplicate alerts** because there is no compound unique index on the alert schema (only performance indexes on `{userId, isActive}` and `{symbol, isActive}`). To fix this, I should add a compound unique index or handle deduplication at the application level in `createAlert()`."

**Q3: How do you handle API and DB connections in serverless?**
> "For the database, I use a `global.mongooseCache` pattern with `bufferCommands: false` so it fails fast instead of hanging. This logs `Connected to database in development environment` on the first cold start. For APIs, every external call is wrapped in a try/catch. With Inngest, if an API rate-limits me, it pauses and retries that specific step."

**Q4: How would you scale this to 10,000 active users?**
> "Three main bottlenecks:
> 1. **Finnhub API Limits:** Upgrade to a paid tier (300 calls/sec) and implement a Redis caching layer for stock prices.
> 2. **Email Limits:** Gmail SMTP caps at 500 emails/day. I would migrate to SendGrid, Resend, or AWS SES.
> 3. **Cron Architecture:** A single cron loop would timeout. I would use a fan-out pattern—one cron triggers 10,000 individual Inngest events, allowing parallel processing."

**Q5: Why MongoDB instead of PostgreSQL?**
> "Because the Finnhub API returns varied JSON structures, MongoDB's document model was a natural fit. Additionally, I was iterating rapidly on the Alert schema. If I had to add complex transactional features like paper-trading, I would switch to Postgres for ACID compliance and decimal precision."

---

## 5. The "Roast Round" Survival Guide (Handling Critiques)

If the interviewer gets aggressive or pokes holes in your app, **do not get defensive**. Agree with them, explain why you did it for the MVP, and explain how you'd fix it for production.

*   **Critique:** *"Your `createAlert` and `toggleWatchlist` actions accept an email parameter from the client. Anyone could pass another user's email and create alerts on their behalf!"*
    *   **Response:** "You're exactly right. This is a real security flaw. The fix is to derive identity entirely from the server-side session. Inside the server action, I should call `auth.api.getSession()` and read `session.user.email` from there, ignoring any client-provided identity."
*   **Critique:** *"Your UI is just TradingView iframes. You didn't build much frontend."*
    *   **Response:** "That's a fair point. I focused my engineering effort on the backend orchestration (cron jobs, AI, emails) because that's where the unique value is. Charting is complex, and TradingView handles it well for an MVP. In the future, I plan to build custom charts using Recharts."
*   **Critique:** *"You have zero automated tests."*
    *   **Response:** "You're completely right. I prioritized shipping features over testing discipline for this personal project. If this were a production team, I would absolutely write unit tests for the server actions using Vitest, and use Playwright to E2E test the alert creation flow."
*   **Critique:** *"Using Gmail for sending alerts is a toy setup."*
    *   **Response:** "I agree. Gmail SMTP was a pragmatic choice to prove the pipeline works for free. In production, I would migrate to Resend or AWS SES, set up SPF/DKIM records for deliverability, and implement proper unsubscribe links to comply with CAN-SPAM laws."

---

## 6. How to Direct the Interview
If they ask a vague question like *"Tell me about a challenge you faced,"* **steer them toward your best code**:
> "One of the biggest challenges was the News Aggregation algorithm for the AI emails. If a user follows 10 stocks, a naive approach makes 10 API calls — eating **17%** of Finnhub's 60/min free limit in one request! So I built a round-robin algorithm that deduplicates articles and guarantees diverse coverage without spamming the API. I'd love to walk you through that logic if you're interested."
