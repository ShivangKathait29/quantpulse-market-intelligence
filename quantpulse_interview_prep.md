# QuantPulse — Interview Preparation Guide

## 30-Second Elevator Pitch

> "QuantPulse is a full-stack market intelligence platform I built with Next.js 16, MongoDB, and the Finnhub API. Users can track real-time stock prices, build personalized watchlists, and set configurable price alerts that trigger email notifications via background cron jobs. I integrated Google Gemini to generate AI-personalized welcome emails and daily news summaries tailored to each user's investment profile. The backend uses Inngest for event-driven job orchestration — one cron polls prices every 5 minutes to check alert thresholds, another sends AI-summarized market news daily at noon."

---

## Architecture Overview (Draw This on a Whiteboard)

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                   │
│  React 19 + Next.js App Router + Radix UI + Tailwind    │
└──────────────┬──────────────────────┬───────────────────┘
               │ RSC / Server Actions │ Client Components
               ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Next.js 16 Server                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Server       │  │ API Routes   │  │ Middleware     │  │
│  │ Actions      │  │ /api/auth    │  │ (session gate) │  │
│  │ (finnhub,    │  │ /api/inngest │  │               │  │
│  │  watchlist,  │  │              │  │               │  │
│  │  alert,      │  │              │  │               │  │
│  │  user)       │  │              │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
└─────────┼─────────────────┼──────────────────────────────┘
          │                 │
    ┌─────▼─────┐    ┌──────▼──────┐    ┌──────────────┐
    │  MongoDB  │    │   Inngest   │    │  Finnhub API │
    │  Atlas    │    │  (Cron)     │    │  (REST)      │
    │           │    │             │    │              │
    │ • user    │    │ • Price     │    │ • /quote     │
    │ • watchlist│   │   alerts    │    │ • /search    │
    │ • alert   │    │   (*/5 min) │    │ • /news      │
    │           │    │ • Daily     │    │ • /profile2  │
    │           │    │   news      │    │              │
    │           │    │   (12:00)   │    │              │
    └───────────┘    └──────┬──────┘    └──────────────┘
                            │
                    ┌───────▼───────┐    ┌──────────────┐
                    │  Gemini AI    │    │  Nodemailer  │
                    │  (2.5 Flash)  │───▶│  (Gmail SMTP)│
                    │               │    │              │
                    │ • Welcome     │    │ • Welcome    │
                    │   emails      │    │ • News       │
                    │ • News        │    │ • Price Alert│
                    │   summaries   │    │              │
                    └───────────────┘    └──────────────┘
```

---

## Questions by Category

---

### 1. Project Overview & Motivation

**Q: Walk me through this project. What does it do?**

> QuantPulse is a market intelligence platform where users can:
> 1. View a real-time market dashboard powered by TradingView widgets
> 2. Search stocks via Finnhub API with debounced input and a command palette (Ctrl+K)
> 3. Build personalized watchlists (stored in MongoDB with compound uniqueness indexes)
> 4. Set configurable price alerts — upper/lower thresholds with once-per-day, hourly, or continuous frequency
> 5. Receive AI-personalized welcome emails on sign-up (Gemini generates the copy based on their investment profile)
> 6. Get daily AI-summarized market news delivered to their inbox at noon via a cron job
>
> The backend coordinates three distinct email pipelines: welcome, news summary, and price alerts — all through Inngest for reliable async execution.

**Q: Why did you build this? What problem does it solve?**

> Most free stock tracking tools give you raw data — price charts, news feeds — but no personalization. I wanted to build something that combines real-time market data with AI-driven personalization: emails that actually reference your risk tolerance and preferred sectors, news summaries that prioritize your watchlist, and alerts that run autonomously even when you're not on the site. The technical challenge I was most interested in was orchestrating background jobs that combine external API calls, AI inference, and email delivery into reliable multi-step workflows.

**Q: What's the tech stack and why did you choose it?**

> - **Next.js 16 App Router** — Server components for data-heavy pages (watchlist, stock detail), server actions to avoid writing separate REST APIs, route groups for auth isolation
> - **MongoDB + Mongoose** — Flexible schema for rapidly iterating on the alert and watchlist models. Used compound indexes for query performance and uniqueness constraints.
> - **Inngest** — Event-driven background job orchestration. Chose it over raw cron or Bull/BeeQueue because it gives me step-level retries, AI model inference as a built-in step type, and a visual dashboard for debugging job runs.
> - **Better Auth** — Lightweight auth library that plays well with Next.js middleware. Email/password with session cookies — simpler than NextAuth for my use case.
> - **Finnhub API** — Free tier gives 60 API calls/minute with real-time quotes, company profiles, and news. Used Next.js revalidation for intelligent caching.
> - **Gemini 2.5 Flash Lite** — Fast, cheap, good at structured HTML generation. I use it through Inngest's `step.ai.infer()` which handles retries.

---

### 2. Authentication & Security

**Q: How does authentication work in your app?**

> I use Better Auth with email/password. The auth config is in `lib/better-auth/auth.ts` — it connects to MongoDB via the `mongodbAdapter`, stores sessions server-side, and issues session cookies. The `nextCookies()` plugin integrates with Next.js cookie handling.
>
> Route protection works at two levels:
> 1. **Middleware** (`middleware/index.ts`) — Checks for a session cookie on every request. If missing, redirects to sign-in. The matcher excludes public paths like `/api`, `/sign-in`, `/sign-up`, and static assets.
> 2. **Layout-level** (`app/(root)/layout.tsx`) — The root layout does a server-side `auth.api.getSession()` call. If no session, it redirects to `/sign-in`. This is a defense-in-depth pattern.
>
> The auth layout (`app/(auth)/layout.tsx`) does the inverse — if a user IS logged in and visits sign-in/sign-up, they get redirected to the dashboard.

**Q: How do you handle sensitive data like API keys?**

> All secrets (MongoDB URI, Finnhub API key, Gemini key, Gmail credentials, auth secret) are stored in `.env` which is in `.gitignore` and has never been committed to the repository. In production, these would be set as environment variables in the hosting platform (Vercel, etc.). I use `process.env` access with fallback checks — every server action that needs an API key validates it exists before making external calls and throws a descriptive error if missing.

**Q: What happens if a user tries to access a protected route without being logged in?**

> Two things catch it:
> 1. The middleware intercepts the request before it hits the page, checks for the session cookie via `getSessionCookie(request)`, and redirects to `/` if absent.
> 2. Even if middleware somehow passes, the `(root)` layout does its own `auth.api.getSession()` server-side check and redirects to `/sign-in`.
>
> This defense-in-depth means even if one layer fails, the other catches it.

---

### 3. Database Design

**Q: Explain your MongoDB schema design.**

> I have three Mongoose models:
>
> **Watchlist** — userId (indexed), symbol (uppercase, trimmed), company, addedAt. Has a compound unique index on `{ userId: 1, symbol: 1 }` to prevent duplicate entries per user.
>
> **PriceAlert** — userId (indexed), symbol, company, alertType (upper/lower enum), targetPrice, frequency (once/hourly/continuous), lastTriggered (optional Date), isActive (boolean for soft delete), createdAt. Has compound indexes on `{ userId: 1, isActive: 1 }` for user queries and `{ symbol: 1, isActive: 1 }` for the cron job that checks prices.
>
> **User** — Managed by Better Auth, not a custom Mongoose model. I query it via raw `db.collection('user')` operations when needed.

**Q: Why did you use a compound index on `{ userId: 1, symbol: 1 }` for the watchlist?**

> Two reasons:
> 1. **Uniqueness** — The `unique: true` constraint ensures a user can't add the same stock twice. The database enforces this even if the application code has a bug.
> 2. **Query performance** — Most watchlist queries filter by userId first, then optionally by symbol. A compound index on both fields means MongoDB can satisfy these queries with an index scan instead of a collection scan. The order matters — userId first because it's the higher-cardinality filter that narrows results most.

**Q: Why soft delete for alerts instead of hard delete?**

> Setting `isActive: false` instead of deleting gives me:
> 1. **Audit trail** — I can see what alerts a user has created historically
> 2. **Easy undo** — Could add "restore alert" functionality later
> 3. **Data integrity** — No cascading delete issues if other parts of the system reference the alert ID
>
> The tradeoff is slightly larger collection size, but with the `{ isActive: 1 }` index, queries that filter on active alerts remain fast.

**Q: How do you handle the MongoDB connection in a serverless environment?**

> In `database/mongoose.ts`, I use a global connection cache pattern. The key insight is that serverless functions (like Next.js API routes on Vercel) can be cold-started, so you can't assume a persistent connection. The pattern:
> 1. Store the connection and connection promise in `global.mongooseCache`
> 2. On each request, check if we already have a connection — if so, return it
> 3. If not, check if we have a pending connection promise — if so, await it
> 4. If neither, create a new connection with `mongoose.connect()` and cache both the promise and the resolved connection
> 5. If the connection fails, clear the promise so the next request retries
>
> Using `global` ensures the cache survives across hot reloads in development and across invocations in serverless.

---

### 4. API Integration & Caching

**Q: How do you fetch data from Finnhub? What's your caching strategy?**

> I have a generic `fetchJSON<T>()` helper that wraps `fetch()` with Next.js revalidation. Different data types get different cache TTLs based on how frequently they change:
> - **Stock quotes** — 60-second revalidation (prices change constantly but the free tier limits us to 60 calls/min)
> - **Search results** — 30-minute revalidation (stock metadata is relatively stable)
> - **Company profiles** — 1-hour revalidation (company info rarely changes)
> - **News articles** — 5-minute revalidation (news is time-sensitive)
>
> For the stock search, I also use React's `cache()` function to deduplicate identical calls within a single server render.

**Q: How does the news aggregation work for watchlist users?**

> The `getNews()` function has a smart aggregation strategy:
> 1. If the user has watchlist symbols, it fetches company-specific news for each symbol in parallel using `Promise.all()`
> 2. It then uses a **round-robin algorithm** to select articles — iterating through symbols and picking one article per symbol per round, up to 6 total. This ensures diverse coverage instead of letting one stock dominate.
> 3. Articles are deduplicated using a composite key of `id + url + headline`
> 4. If company-specific news yields zero results, it falls back to general market news
> 5. All articles pass through a validation function that checks for required fields (headline, summary, url, datetime)

**Q: What happens if the Finnhub API is down or rate-limited?**

> Every API call is wrapped in try/catch blocks. If a call fails:
> - `getQuote()` returns `null` — the UI shows $0.00 or a fallback
> - `searchStocks()` returns `[]` — the search shows "No results"
> - `getNews()` throws, but the caller catches it — the watchlist page still loads, just without news
>
> For rate limiting, I use Next.js `revalidate` to avoid redundant calls. The free tier allows 60 calls/minute. In production, I'd add request queuing or use a Redis-based rate limiter.

---

### 5. Background Jobs & Event Architecture

**Q: Explain how the price alert system works end-to-end.**

> 1. **Alert creation**: User selects a stock from their watchlist, sets a target price, chooses upper/lower threshold and frequency (once/hourly/continuous). The `createAlert()` server action persists it to MongoDB.
> 2. **Price monitoring**: An Inngest cron function `checkPriceAlerts` runs every 5 minutes. It:
>    - Fetches all active alerts from MongoDB
>    - For each alert, queries Finnhub for the current price
>    - Compares against the threshold (upper: price >= target, lower: price <= target)
>    - Checks frequency constraints by comparing `lastTriggered` timestamp against the frequency window (24hr for once, 1hr for hourly, no limit for continuous)
>    - Looks up the user by their ID to get their email
>    - Generates an HTML email from the alert template
>    - Sends via Nodemailer (Gmail SMTP)
>    - Updates `lastTriggered` in MongoDB
> 3. **Deactivation**: User clicks delete → sets `isActive: false` → cron stops checking it

**Q: Why Inngest instead of a simple `setInterval` or node-cron?**

> Three reasons:
> 1. **Step-level reliability** — Each step in an Inngest function is individually retriable. If the Finnhub API call succeeds but the email send fails, Inngest retries from the email step, not from the beginning.
> 2. **Built-in AI inference** — `step.ai.infer()` gives me a first-class way to call Gemini with automatic retries and structured response handling. No manual API client code.
> 3. **Observability** — Inngest provides a visual dashboard showing every function run, step timings, and failure logs. In production, this is invaluable for debugging why a specific user didn't get their alert.
>
> A raw `setInterval` would lose all in-progress work on a server restart and has no built-in retry logic.

**Q: How does the daily news summary pipeline work?**

> It's a multi-step Inngest function triggered by cron at `0 12 * * *` (noon daily):
> 1. **Step 1**: Fetch all users from MongoDB who have email addresses
> 2. **Step 2**: For each user, fetch their watchlist symbols, then fetch company-specific news for those symbols. If they have no watchlist or no news is found, fall back to general market news. Cap at 6 articles per user.
> 3. **Step 3**: For each user, send the news data to Gemini with a detailed prompt. The AI generates structured HTML with sections (Market Overview, Top Gainers, etc.), bullet-point insights in plain English, and "Bottom Line" summaries. Each article gets a "Read Full Story" link.
> 4. **Step 4**: Send personalized emails to all users via Nodemailer using the AI-generated HTML content.
>
> The key design decision was separating each step — if step 3 (AI) fails for one user, it doesn't block other users.

**Q: What happens if the cron job takes too long?**

> The price alert job processes alerts sequentially within the step to avoid overwhelming the Finnhub rate limit (60 calls/min). For a large number of alerts, this could take several minutes. Inngest has a configurable timeout (default 5 minutes). If exceeded, the function fails and retries. For scaling, I'd batch alerts by symbol — fetch each unique symbol's price once, then compare against all alerts for that symbol, reducing API calls from O(alerts) to O(unique_symbols).

---

### 6. Frontend Architecture

**Q: How do you handle the server/client component split?**

> I follow the Next.js 16 pattern of keeping data fetching in server components and interactivity in client components:
> - **Server components**: `app/(root)/watchlist/page.tsx` fetches watchlist data, stocks, and news in parallel via `Promise.all()`, then passes them as props to the client component
> - **Client components**: `WatchlistPageClient.tsx` handles all interactivity — alert creation dialogs, delete actions, local state management
> - **Server actions**: `'use server'` functions in `lib/actions/` are called directly from client components for mutations (toggle watchlist, create alert, delete alert)
>
> This means the initial page load is fast (server-rendered with data already fetched), and subsequent interactions are handled client-side.

**Q: How does the stock search work?**

> The search uses a `CommandDialog` (built on `cmdk`) triggered by Ctrl+K or a button click:
> 1. On open, it shows the top 10 popular stocks (pre-fetched as `initialStocks`)
> 2. As the user types, the input is debounced by 300ms using a custom `useDebouncedValue` hook
> 3. The debounced value triggers a `useEffect` that calls the `searchStocks()` server action
> 4. Results are displayed with the stock name, symbol, exchange, and type
> 5. Each result has a `WatchlistButton` that operates independently — adding/removing from watchlist without closing the dialog
> 6. Clicking a result navigates to `/symbol/[symbol]` for the detail page

**Q: What's the optimistic UI pattern in WatchlistButton?**

> When a user clicks the star icon to add/remove a stock:
> 1. I immediately toggle the local `added` state (optimistic update — UI reflects the change instantly)
> 2. Inside a `useTransition`, I call the `toggleWatchlist()` server action
> 3. If the server action succeeds, I call `router.refresh()` to revalidate server component data
> 4. If it fails, I revert the local state to the previous value
>
> This gives instant feedback without waiting for the network roundtrip. The `useTransition` keeps the UI responsive during the async operation.

---

### 7. AI Integration

**Q: How do you use Gemini AI in this project?**

> Two use cases:
>
> **1. Personalized welcome emails** — On sign-up, the user provides their country, investment goals, risk tolerance, and preferred industry. I build a prompt that includes this profile data and asks Gemini to generate a 2-sentence personalized introduction. The prompt specifies exact HTML formatting, word count (35-50 words), and CSS classes to match the email template. The AI output is inserted into the email template at the `{{intro}}` placeholder.
>
> **2. Daily news summaries** — The cron job feeds up to 6 news articles (JSON) to Gemini with a detailed prompt. The prompt specifies the HTML structure for each article: title, 3+ bullet points in plain English, a "Bottom Line" insight box, and a "Read Full Story" link. I instruct the model to avoid jargon and explain things as if talking to someone new to investing.
>
> Both use `step.ai.infer()` which calls the Gemini API through Inngest's AI gateway — this gives automatic retries and structured response handling.

**Q: How do you handle cases where the AI returns bad output?**

> I have fallbacks at every level:
> - If the Gemini response has no candidates or no text, I use a hardcoded default: `"Thanks for joining QuantPulse. You now have the tools to track markets and make smarter moves."`
> - The prompt itself constrains the output format — I specify exact CSS classes, word counts, and structure. This reduces hallucination probability.
> - For news summaries, if AI summarization fails for one user, we log the error and push `null` as their newsContent. The email sender skips null entries.

---

### 8. Email System

**Q: How is the email system structured?**

> Three email types, each with distinct templates stored in `lib/nodemailer/templates.ts`:
>
> 1. **Welcome email** — Triggered by `app/user.created` event via Inngest. Uses AI-generated personalized intro. Sent through `sendWelcomeEmail()`.
> 2. **Daily news summary** — Triggered by cron at noon. AI-generated HTML content with market news. Sent through `sendNewsSummaryEmail()`.
> 3. **Price alert** — Triggered by the 5-minute price check cron. Template function takes symbol, company, current price, target price, alert type. Sent through the generic `sendEmail()`.
>
> All emails use Nodemailer with Gmail SMTP transport. The templates are professional dark-themed HTML with responsive design and inline CSS (required for email clients).

---

### 9. Challenges & Trade-offs

**Q: What was the hardest technical challenge?**

> Designing the news aggregation algorithm was surprisingly complex. The naive approach — query news for each watchlist symbol — has two problems:
> 1. If a user follows 10 stocks, that's 10 API calls, eating into the 60/min rate limit
> 2. Some stocks get way more news than others, so a simple concat gives unbalanced coverage
>
> I solved it with a round-robin selection algorithm: fetch news for all symbols in parallel, then iterate through symbols picking one article per symbol per round until I have 6 total. This guarantees diversity. If company-specific news yields nothing, I fall back to general market news. The deduplication using a composite key (`id + url + headline`) prevents repeated articles.

**Q: What would you do differently if you started over?**

> 1. **Use Zod for input validation** — Currently, server actions trust client input. I'd add Zod schemas to validate every server action parameter (symbol format, price > 0, valid email).
> 2. **Add error boundaries from day one** — I retrofitted them, but having them from the start would've caught bugs earlier.
> 3. **Separate the email template logic** — The 61KB templates file is too large. I'd use a proper templating engine like MJML or React Email to generate HTML.
> 4. **Build custom charts earlier** — I relied heavily on TradingView embeds. I'd integrate Recharts from the start for portfolio analytics.

**Q: How would you scale this to 10,000 users?**

> The current architecture has two bottlenecks:
>
> **Finnhub rate limit (60 calls/min)**: The price alert cron makes one API call per alert. With 10K users having 3 alerts each = 30K calls per cron run. I'd fix this by:
> - Deduplicating: Group alerts by symbol, fetch each unique symbol once, compare against all matching alerts
> - Upgrading to Finnhub premium (300 calls/sec)
> - Adding a caching layer (Redis) for recently-fetched prices
>
> **Email throughput**: Gmail SMTP has a 500 emails/day limit. I'd switch to a production email service like SendGrid, Amazon SES, or Resend. These handle 100K+ emails/day with proper deliverability.
>
> **Database**: MongoDB Atlas handles this scale well. I'd add read replicas for analytics queries and ensure all hot-path queries hit indexed fields.

---

### 10. 🔥 THE ROAST ROUND — "Prove You Actually Built This"

*These are the questions a skeptical senior engineer or tech lead will ask to see if you understand your own code deeply or just followed tutorials. Don't panic — honest answers with self-awareness beat fake confidence every time.*

---

**Q: Your entire stock detail page is just TradingView iframes. What did YOU actually build here?**

> Fair point — the `/symbol/[symbol]` page is widget-heavy. But the value I built is in the backend orchestration layer, not the charting UI. The original work is:
> 1. The Finnhub API integration layer with tiered caching and error handling
> 2. The watchlist system with compound-indexed MongoDB schemas and optimistic UI
> 3. The 3-pipeline email system with AI personalization
> 4. The price alert cron that combines external API polling, frequency-gated triggers, and email delivery
>
> TradingView handles charting better than I could in a reasonable timeframe — my engineering effort went where it creates unique value. That said, I'm planning to add Recharts-based portfolio analytics to demonstrate custom data visualization.

**Q: You have zero tests. How do you know anything works?**

> I tested manually through the UI and verified email delivery by sending test alerts. That's not sufficient for production — I acknowledge that. If I were in a team environment, I'd add:
> - **Unit tests** for server actions (mock MongoDB, verify return types)
> - **Integration tests** for the Finnhub API layer (mock `fetch`, verify caching behavior)
> - **E2E tests** for critical flows like sign-up → watchlist → alert creation
>
> I prioritized shipping features over testing discipline. In hindsight, testing the `createAlert()` → `checkPriceAlerts()` pipeline would have caught the `getUserByEmail` vs `getUserById` bug much earlier.

**Q: You're using Gmail SMTP for email. That's a toy. How would this work in production?**

> You're right — Gmail SMTP has a 500 emails/day limit and poor deliverability for bulk sends. In production I'd switch to:
> - **Resend** or **SendGrid** for transactional emails (price alerts, welcome)
> - **Amazon SES** for high-volume sends (daily news to all users)
> - Add proper SPF/DKIM records for deliverability
> - Implement unsubscribe links (legally required under CAN-SPAM)
> - Add bounce handling and suppression lists
>
> Gmail was a pragmatic choice to prove the pipeline works without spending money on infrastructure.

**Q: Your `createAlert` server action has no input validation. What if I send `targetPrice: -500`?**

> It would create an alert with a negative target price. That's a bug — the alert would trigger immediately since any real stock price is above -500. I should add:
> ```typescript
> if (targetPrice <= 0) throw new Error('Target price must be positive');
> if (!['upper', 'lower'].includes(alertType)) throw new Error('Invalid alert type');
> if (!symbol.match(/^[A-Z]{1,5}$/)) throw new Error('Invalid symbol format');
> ```
> Ideally I'd use Zod schemas to validate all server action inputs consistently. The client-side has `parseFloat(alertPrice) <= 0` as a disabled check, but server-side validation is non-negotiable — client checks can be bypassed.

**Q: Your `fetchJSON` function uses `any` in some places. Why bother with TypeScript if you're going to escape the type system?**

> The `any` usage in `searchStocks()` for the Finnhub profile response was lazy. The Finnhub API doesn't have official TypeScript types, so I should have defined my own interface:
> ```typescript
> interface FinnhubProfile {
>   name?: string;
>   ticker?: string;
>   exchange?: string;
>   marketCapitalization?: number;
> }
> ```
> The `(r as any).__exchange` pattern was a hack to pass exchange data through the mapping pipeline without modifying the `FinnhubSearchResult` type. The right fix is extending the type or using a separate Map. I chose speed over purity there, but it creates maintainability debt.

**Q: What stops a malicious user from calling your server actions directly with someone else's email?**

> Currently, several server actions accept an `email` parameter from the client (e.g., `toggleWatchlist(email, symbol, ...)`). In theory, a user could call this with someone else's email and modify their watchlist. The fix is to never trust the client for identity:
> ```typescript
> export async function toggleWatchlist(symbol: string, company: string, isAdded: boolean) {
>   const session = await auth.api.getSession({ headers: await headers() });
>   if (!session?.user) throw new Error('Unauthorized');
>   const email = session.user.email; // Get from session, not from client
>   // ... rest of logic
> }
> ```
> Every server action that performs user-specific mutations should derive the user identity from the server-side session, not from a client-supplied parameter.

**Q: Your prompts file is 230 lines of hardcoded HTML in template literals. How is that maintainable?**

> It's not — I'd refactor this using React Email or MJML:
> - **React Email** lets me write email templates as React components with proper props, then render to HTML
> - **MJML** is an email-specific markup language that compiles to responsive HTML
>
> The current approach works but has problems: no syntax highlighting in the template strings, hard to preview changes, and the 61KB `templates.ts` file is unwieldy. I'd also separate the prompt engineering (AI instructions) from the HTML structure.

**Q: You're polling Finnhub every 5 minutes. What if a stock crashes in 30 seconds — your user gets alerted 4.5 minutes too late?**

> Correct — 5-minute polling means worst-case 5-minute delay. For real-time alerting I'd need:
> 1. **Finnhub WebSocket API** — Streams real-time trade data. I'd maintain a WebSocket connection that monitors symbols with active alerts.
> 2. **Event-driven architecture** — Instead of polling, the WebSocket listener pushes price updates to a message queue (Redis Pub/Sub or similar), and alert checking happens on each update.
>
> The polling approach is a pragmatic tradeoff for the free tier. Finnhub's WebSocket has stricter rate limits on the free plan, so I chose polling for reliability. I'd flag this as a "scale-up" improvement.

**Q: What's the time complexity of your round-robin news algorithm? Is it optimal?**

> The outer loop runs `maxArticles` (6) times, and the inner loop runs `cleanSymbols.length` times per round. So it's O(maxArticles × symbols). With both capped at small numbers (6 articles, maybe 10 symbols), it's O(60) worst case — effectively constant.
>
> Could it be more efficient? Yes — I could pre-merge all articles sorted by timestamp and just pick the top 6 with diversity constraints. But for N < 100, the current approach is readable and performant enough. Premature optimization would hurt maintainability.

**Q: Your daily news cron processes users sequentially. What happens with 10K users?**

> It would be extremely slow. The current code loops through every user inside a single `step.run()`, making serial API calls. With 10K users:
> - Fetching watchlists: 10K DB queries
> - Fetching news: up to 60K API calls (6 symbols × 10K users, with duplicates)
> - AI summarization: 10K Gemini calls
>
> I'd fix this with:
> 1. **Fan-out pattern** — The main function emits 10K individual events (`app/send.news.to.user`), each processed by a separate Inngest function invocation. This parallelizes across Inngest's infrastructure.
> 2. **Deduplication** — Fetch news per unique symbol, not per user. If 5K users follow AAPL, fetch AAPL news once.
> 3. **Batch AI calls** — Group users with similar watchlists and share the same summary.

**Q: `connectToDatabase()` logs "Connected to database" on every successful connection. Won't that spam your logs in production?**

> Yes — the `console.log` on line 34 of `mongoose.ts` fires every time the cached connection is first established. In a serverless environment with cold starts, this could log thousands of times per day. I should either:
> - Remove it entirely
> - Gate it behind `process.env.NODE_ENV === 'development'`
> - Use a structured logging library (like Pino) with log levels so I can filter it in production

**Q: You're using `NEXT_PUBLIC_FINNHUB_API_KEY`. That means the API key is exposed to the browser. Is that a security issue?**

> Yes and no. Finnhub's free API key is designed for client-side usage (their widget embeds need it). But I'm also using it in server actions, where a non-public key would be preferable. I have both:
> - `FINNHUB_API_KEY` (server-only, used in server actions)
> - `NEXT_PUBLIC_FINNHUB_API_KEY` (client-exposed fallback)
>
> The server action code tries `process.env.FINNHUB_API_KEY` first and falls back to the public one. Ideally, all server-side Finnhub calls should use the non-public key exclusively, and I'd remove the fallback to avoid accidentally exposing a premium key.

**Q: Your middleware matcher regex is complex. Walk me through exactly what it matches.**

> ```
> '/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|assets).*)'
> ```
> This is a negative lookahead regex that matches **all routes EXCEPT**:
> - `/api/*` — API routes (auth, inngest) need to be publicly accessible
> - `/_next/static/*` — Next.js static assets (JS bundles, CSS)
> - `/_next/image/*` — Next.js image optimization
> - `/favicon.ico` — Browser favicon request
> - `/sign-in`, `/sign-up` — Auth pages (must be accessible without login)
> - `/assets/*` — Public assets (logo, images)
>
> Everything else requires a session cookie. If I added a new public page (like `/pricing`), I'd need to update this regex — that's a maintenance risk. A better pattern would be an allow-list approach or moving public pages outside the `(root)` route group.

**Q: What happens if two users create alerts for the same stock and the cron checks them simultaneously?**

> No race condition — the cron runs as a single Inngest function invocation. It processes alerts sequentially within the `step.run()`, so there's no concurrent access to the same alert document. Each alert is independently checked and updated.
>
> However, there IS an inefficiency: if 100 users have alerts for AAPL, I fetch AAPL's price 100 times. The fix is to group alerts by symbol, fetch once per unique symbol, then iterate over matching alerts.

**Q: What if Gemini generates HTML with an XSS payload in the email? You're injecting raw AI output into templates.**

> That's a legitimate risk. If Gemini returned `<script>alert('xss')</script>`, it would be injected into the email template. However:
> 1. Most email clients (Gmail, Outlook) strip `<script>` tags and event handlers from HTML emails
> 2. The prompt constrains output to specific HTML elements (`<p>`, `<strong>`, `<ul>`)
> 3. But defense-in-depth says I should sanitize the AI output before injection — using a library like `DOMPurify` or `sanitize-html` to strip anything outside the expected allowlist
>
> I haven't implemented this yet — it's a valid improvement.

**Q: Your `WatchlistPageClient` is 408 lines. Isn't that too big for a single component?**

> Yes, it should be decomposed. It currently handles:
> 1. Watchlist table rendering
> 2. Alert creation dialog
> 3. Alert management panel
> 4. News section
> 5. All state management
>
> I'd refactor into: `<WatchlistTable>`, `<AlertPanel>`, `<CreateAlertDialog>`, `<WatchlistNews>`, and a custom `useAlerts()` hook to encapsulate the alert CRUD logic. Each component would be under 100 lines and independently testable.

**Q: Why didn't you use NextAuth? It's the industry standard for Next.js.**

> NextAuth (now Auth.js) is more full-featured but heavier. Better Auth was a deliberate choice because:
> 1. I only need email/password auth — no OAuth providers
> 2. Better Auth has first-class MongoDB adapter support with a simpler API
> 3. The `nextCookies()` plugin handles session cookies without manual cookie management
> 4. Smaller bundle size and fewer configuration options to get wrong
>
> If I needed Google/GitHub OAuth or role-based access control, I'd switch to NextAuth. For a single auth strategy, Better Auth is simpler.

**Q: How do you prevent a user from creating 10,000 alerts and DDoS-ing your cron job?**

> I don't — currently there's no limit. A malicious user could create thousands of alerts, each requiring a Finnhub API call in the cron. Fixes:
> 1. **Server-side limit**: Check `Alert.countDocuments({ userId, isActive: true })` before creating. Reject if > 20.
> 2. **Rate limiting**: Use a middleware or library like `rate-limiter-flexible` to limit alert creation to 10 per hour per user.
> 3. **Cron optimization**: Even with many alerts, grouping by symbol (as discussed) limits API calls to unique symbols, not total alerts.

**Q: You use `router.refresh()` after watchlist changes. What does that actually do, and is it efficient?**

> `router.refresh()` triggers a server-side re-render of the current route's server components without a full page navigation. It:
> 1. Re-runs the server component data fetching (e.g., `getWatchlistWithDetails()`)
> 2. Streams updated RSC payload to the client
> 3. Merges the new server output with existing client state
>
> It's more efficient than a full page reload but heavier than necessary. An alternative would be to update client-side state directly and skip the server re-fetch. But `router.refresh()` ensures the server and client stay in sync after mutations — no stale data.

---

### 11. Behavioral / STAR Method Questions

**Q: Tell me about a bug that was hard to fix in this project.**

> **Situation**: The price alert emails were never being delivered despite alerts being created correctly in the database.
> **Task**: Figure out why the email pipeline was silently failing.
> **Action**: I traced the code path and discovered that `getUserByEmail(alert.userId)` was being called in the Inngest cron job, but `alert.userId` stores a user *ID*, not an email. The `getUserByEmail` function queries `{ email: <value> }`, so it was searching for a user whose email equals a random ID string — which never matches. I created a new `getUserById()` function that queries by the `id` field (with a fallback to `_id` for compatibility with both Better Auth ID formats) and updated the import.
> **Result**: Price alert emails started delivering correctly. This taught me to always verify that data types match across system boundaries — the field name "userId" seemed obvious, but the function accepting it expected a different data type.

**Q: How do you approach learning a new technology? (Example: Inngest)**

> **Situation**: I needed background job orchestration but hadn't used Inngest before.
> **Task**: Evaluate whether it fit my use case and learn it fast.
> **Action**: I started by reading the docs' "Getting Started" guide and built a minimal function first (the welcome email). Once that worked, I added complexity — the multi-step news pipeline with AI inference. When I hit issues with step typing, I checked their GitHub issues and Discord. The key insight was that each `step.run()` creates a checkpoint, so I could reason about failure modes step-by-step.
> **Result**: I shipped three production functions (welcome email, daily news, price alerts) in under a day. The visual dashboard was a huge help for debugging.

**Q: Tell me about a design decision you debated with yourself.**

> **Situation**: When building the news aggregation, I had to decide between fetching all news upfront vs. fetching per-user.
> **Task**: Choose an approach that balanced personalization with API rate limits.
> **Action**: I considered three approaches: (1) Fetch general news once, send same to all users — simple but no personalization. (2) Fetch per-user based on their watchlist — personalized but O(users × symbols) API calls. (3) Fetch per unique symbol across all users, then distribute — optimal but complex. I went with approach 2 for the initial build because user count is small, but designed the code so switching to approach 3 is straightforward.
> **Result**: The per-user approach works fine at current scale. The round-robin algorithm ensures diverse coverage, and the fallback to general news handles edge cases.

**Q: Describe a time you had to make a tradeoff between speed and quality.**

> **Situation**: I needed to ship the email templates with professional design.
> **Task**: Build responsive, dark-themed HTML emails that look good in all email clients.
> **Action**: I considered React Email (component-based, proper tooling) vs. raw HTML template strings. React Email would've been cleaner but required learning a new library and adding build steps. I chose raw HTML template literals — faster to ship, but resulted in a 61KB file that's hard to maintain. I used inline CSS since email clients don't support external stylesheets.
> **Result**: Emails shipped quickly and look professional. But if I add more email types, I'd refactor to React Email to avoid the growing template file.

---

### 12. Additional Technical Deep-Dives

**Q: Explain the difference between `fetch` with `cache: 'force-cache'` vs `cache: 'no-store'` in Next.js server components.**

> - `force-cache` (with `revalidate: N`) — The first request fetches from the API and caches the result. Subsequent requests within N seconds return the cached version. After N seconds, the next request triggers a background revalidation while still serving the stale cache. This is Stale-While-Revalidate (SWR).
> - `no-store` — Every request goes directly to the API. No caching. Used for data that must always be fresh (like creating a new alert where you need the latest state).
>
> In my code, I use `force-cache` for read-heavy endpoints (quotes, profiles) and `no-store` for mutations.

**Q: What is the React Server Component (RSC) payload? How does it differ from HTML?**

> The RSC payload is a JSON-like streaming format that describes the component tree. Unlike HTML:
> - It includes serialized props and component references, not rendered markup
> - Client components are referenced as "holes" that the browser fills in with JavaScript
> - It supports streaming — the server can send partial trees before the full render completes
> - `router.refresh()` fetches a new RSC payload and diffs it against the current tree
>
> This is why server components don't ship their JavaScript to the browser — the browser only needs JS for client components.

**Q: Why did you use `useEffect` for loading alerts instead of fetching in the server component?**

> The watchlist page server component already fetches stocks and news. Alerts could also be fetched server-side, but I chose client-side `useEffect` because:
> 1. Alerts change frequently (user creates/deletes during the session)
> 2. After a create/delete action, I need to refetch without a full page reload
> 3. The `loadAlerts()` function is reused by both the initial load and post-mutation refreshes
>
> The tradeoff is a brief loading flash on page load. A better approach would be server-side initial fetch + client-side refetch on mutations using SWR or React Query.

**Q: How does `useTransition` differ from just using `async/await`?**

> Both handle async operations, but `useTransition` additionally:
> 1. Marks the state update as "non-urgent" — React can interrupt it in favor of more urgent updates (like user typing)
> 2. Provides an `isPending` boolean to show loading states
> 3. Doesn't block the main thread — the UI stays interactive
> 4. Works with React's concurrent features (Suspense, selective hydration)
>
> Raw `async/await` in an event handler blocks that handler's execution path. `useTransition` wraps the async work in a lower-priority lane so the UI remains responsive.

**Q: What is `bufferCommands: false` in your Mongoose connection? Why is it important?**

> By default, Mongoose buffers operations (queries, inserts) if the connection isn't ready yet — it queues them and runs them once connected. With `bufferCommands: false`:
> - Operations fail immediately if there's no connection
> - You get clear error messages instead of silently hanging requests
> - In serverless environments, this prevents requests from hanging indefinitely when the database is unreachable
>
> Without it, a cold-started serverless function that can't connect to MongoDB would hang for 30 seconds (the default timeout) before failing. With it, it fails fast.

---

### 13. Rapid-Fire Technical Questions

| Question | Key Answer |
|---|---|
| What's the difference between `'use server'` and `'use client'`? | `'use server'` marks functions as server actions callable from client components via RPC. `'use client'` marks a component as rendered on the client (enables hooks, event handlers, browser APIs). |
| Why `useTransition` in WatchlistButton? | It marks the server action call as non-urgent, keeping the UI responsive. The button doesn't freeze while the network request is in flight. |
| What's a compound index? | An index on multiple fields. MongoDB can use it for queries that filter on the fields in order. `{ userId: 1, symbol: 1 }` supports queries on userId alone OR userId + symbol, but NOT symbol alone. |
| Why `cache: 'force-cache'` with `revalidate`? | `force-cache` tells Next.js to use the cached version. `revalidate: 60` means after 60 seconds, the next request triggers a background revalidation. Users always get fast responses. |
| What is ISR? | Incremental Static Regeneration. Pages are generated at request time and cached. After the revalidation period, the next visitor triggers a background rebuild. |
| What's `mongoose.models?.Alert \|\| model()` pattern? | Prevents "Cannot overwrite model" error in development. Hot module reloading re-executes the file, so we check if the model already exists before defining it. |
| Why route groups `(auth)` and `(root)`? | They organize routes without affecting the URL structure. `(auth)` has its own layout (no header, redirect if logged in). `(root)` has the main layout with header and auth guard. |
| What's server-side rendering vs. server components? | SSR renders the full component tree on each request. Server components (RSC) render on the server but can stream, don't ship JS to the client, and can be mixed with client components. |
| Why Mongoose over the raw MongoDB driver? | Schema validation, middleware hooks, query building, population, and the connection caching pattern. For a structured app with defined models, Mongoose reduces boilerplate. |
| How does `Promise.all()` help performance? | It runs multiple async operations concurrently instead of sequentially. Fetching watchlist, stocks, and news in parallel means total time = max(individual times) instead of sum. |
| What happens if one `Promise.all()` call fails? | The entire `Promise.all()` rejects immediately. Use `Promise.allSettled()` if you want to continue even when some promises fail — I use this pattern in news fetching where some symbols may return no results. |
| What's the difference between `redirect()` and `router.push()`? | `redirect()` is server-side (used in server components/actions, throws a special Next.js error to trigger navigation). `router.push()` is client-side (used in client components, triggers client-side navigation). |
| What is CORS and does your API need it? | CORS restricts cross-origin requests. My API routes are same-origin (served by Next.js), so CORS isn't needed. If I exposed a public API, I'd add CORS headers. |
| Why inline CSS in emails? | Email clients (Gmail, Outlook) strip `<style>` tags and ignore external stylesheets. Inline styles are the only reliable way to style HTML emails. |
| What's a session cookie vs. a JWT? | Session cookies store a session ID; the server looks up session data in the database. JWTs encode the session data directly in the token (stateless). Better Auth uses session cookies — more secure (server controls session lifetime) but requires database lookup on each request. |

---

### 14. Questions YOU Should Ask the Interviewer

1. "What does your tech stack look like, and how do you handle background job orchestration?"
2. "How does your team handle API rate limiting for third-party integrations?"
3. "What's your testing philosophy — do you lean more toward unit tests or integration tests?"
4. "How do you approach database schema design for features that evolve frequently?"
5. "What does the code review process look like on your team?"
6. "How do you handle incidents in production? Is there an on-call rotation?"
7. "What's the most interesting technical challenge the team has solved recently?"

---

## Quick Reference: Key Code Paths to Know

| Feature | Entry Point | Key Files |
|---|---|---|
| Authentication | `lib/better-auth/auth.ts` | `middleware/index.ts`, `app/(auth)/layout.tsx` |
| Stock Search | `components/SearchCommand.tsx` | `lib/actions/finnhub.actions.ts`, `hooks/useDebouncedValue.ts` |
| Watchlist | `app/(root)/watchlist/page.tsx` | `lib/actions/watchlist.actions.ts`, `components/WatchlistButton.tsx` |
| Price Alerts | `components/WatchlistPageClient.tsx` | `lib/actions/alert.actions.ts`, `lib/inngest/functions.ts` |
| AI Emails | `lib/inngest/functions.ts` | `lib/inngest/prompts.ts`, `lib/nodemailer/` |
| Stock Detail | `app/(root)/symbol/[symbol]/page.tsx` | `lib/constants.ts` (widget configs) |
| DB Connection | `database/mongoose.ts` | `database/models/alert.model.ts`, `watchlist.model.ts` |

---
---

# PART 2 — Advanced Interview Scenarios

*The questions below go beyond your codebase into system design, deployment, security, and "what-if" territory. These are the questions that separate mid-level from senior-level answers.*

---

### 15. 🏗️ System Design Whiteboard Questions

**Q: "Forget your code. Design a price alert notification system from scratch for 1 million users. You have a whiteboard — go."**

> I'd break it into four components:
>
> **1. Alert Storage** — PostgreSQL or DynamoDB for alert definitions. Schema: `userId, symbol, alertType, targetPrice, frequency, lastTriggered, isActive`. Partition key: `symbol` (so all alerts for AAPL are co-located).
>
> **2. Price Ingestion** — Instead of polling, subscribe to a market data WebSocket feed (e.g., Polygon.io, IEX Cloud). A dedicated service receives price ticks and publishes to a message broker (Kafka or Redis Streams) with topic-per-symbol.
>
> **3. Alert Evaluation** — Consumer workers subscribe to symbol topics. On each price update:
>   - Query all active alerts for that symbol (fast — they're partitioned by symbol)
>   - Evaluate thresholds in-memory
>   - Check frequency constraints against `lastTriggered`
>   - Publish triggered alerts to a "notifications" queue
>
> **4. Notification Delivery** — Separate notification workers consume from the notifications queue. They:
>   - Look up user contact info (email, push token, SMS number)
>   - Send via appropriate channel (SendGrid for email, Firebase for push, Twilio for SMS)
>   - Update `lastTriggered` in the database
>   - Dead letter queue for failed deliveries
>
> **Scaling**: The key insight is that alert evaluation is partitioned by symbol, not by user. There are ~8,000 actively traded US stocks but potentially millions of alerts. By grouping alerts per symbol, each price tick only queries a small partition.
>
> **Latency**: End-to-end from price change to notification: ~2-5 seconds (WebSocket tick → Kafka → evaluation → notification send).

**Q: How would you design a pub/sub system for real-time price updates to the browser?**

> **Option 1: Server-Sent Events (SSE)**
> - Client opens an SSE connection to `/api/prices/stream?symbols=AAPL,GOOGL`
> - Server maintains a WebSocket to Finnhub, filters for subscribed symbols
> - On price update, pushes to all connected SSE clients watching that symbol
> - Pros: Simple, works through proxies, auto-reconnect built into EventSource API
> - Cons: Uni-directional, one connection per tab
>
> **Option 2: WebSocket proxy**
> - Client connects to our WebSocket server
> - Server multiplexes Finnhub's WebSocket feed to multiple clients
> - Client sends subscribe/unsubscribe messages
> - Pros: Bi-directional, lower overhead for many updates
> - Cons: More complex, need to handle reconnection logic
>
> **For QuantPulse's scale** (< 1000 users), SSE is simpler and sufficient. For > 10K concurrent users, I'd use WebSockets with Redis Pub/Sub as the message broker between server instances.

**Q: Your watchlist page fetches data with `Promise.all()`. What if one of the three calls takes 10 seconds?**

> The entire page blocks for 10 seconds — `Promise.all()` resolves when ALL promises complete. Options:
>
> 1. **Streaming with Suspense** — Wrap each data section in a `<Suspense>` boundary. The watchlist table loads first, news and stocks stream in as they resolve. This is the Next.js way.
> 2. **`Promise.allSettled()`** — Returns all results including failures. The page renders with whatever data is available and shows "Unable to load news" for the failed section.
> 3. **Timeouts** — Wrap each fetch in a `Promise.race()` with a 3-second timeout. If Finnhub is slow, the page loads without that data and shows a retry button.
>
> I'd go with option 1 for the best UX — it's progressive loading and Next.js supports it natively with `loading.tsx` files and `<Suspense>`.

**Q: Draw the data flow for what happens when a user clicks "Add to Watchlist" — from click to database and back.**

> ```
> 1. User clicks star icon
>       ↓
> 2. WatchlistButton.handleClick()
>    → Optimistic: setAdded(true) immediately
>    → startTransition() begins
>       ↓
> 3. toggleWatchlist(email, symbol, company, true)  [Server Action RPC]
>    → Next.js serializes args, sends POST to /__next/action/...
>       ↓
> 4. Server receives, runs toggleWatchlist()
>    → connectToDatabase() (uses cached connection)
>    → Watchlist.create({ userId, symbol, company })
>    → Returns { success: true }
>       ↓
> 5. Client receives response
>    → onWatchlistChange?.(symbol, true) callback
>    → router.refresh() triggers
>       ↓
> 6. Server re-renders WatchlistPage server component
>    → getWatchlistWithDetails(email) fetches updated list
>    → RSC payload streamed to client
>       ↓
> 7. React diffs RSC payload with current tree
>    → UI updates with new watchlist data
>    → Client state preserved (alert dialog still open, etc.)
> ```
> If step 4 fails: catch block reverts `setAdded(false)`, user sees the star un-toggle.

---

### 16. 🚀 Deployment & DevOps

**Q: How would you deploy this to production?**

> **Platform**: Vercel (purpose-built for Next.js)
>
> **Steps**:
> 1. Push to `main` branch → Vercel auto-deploys via GitHub integration
> 2. Configure environment variables in Vercel dashboard (MONGODB_URI, API keys, etc.)
> 3. Set up Inngest integration — Inngest provides a Vercel integration that auto-configures the webhook URL
> 4. MongoDB Atlas is already cloud-hosted — whitelist Vercel's IP ranges (or use 0.0.0.0/0 with strong auth)
> 5. Custom domain → Configure DNS A/CNAME records
>
> **Preview deployments**: Every PR gets a unique preview URL for testing before merge.

**Q: What's your CI/CD pipeline?**

> Currently none beyond Vercel auto-deploy. I'd add:
> 1. **Pre-commit**: Lint (ESLint) + format (Prettier) via Husky
> 2. **CI on PR**: GitHub Actions running `tsc --noEmit` (type check), `eslint .` (lint), and unit tests
> 3. **Staging**: Auto-deploy PRs to preview URLs for manual testing
> 4. **Production**: Merge to `main` → Vercel builds → automatic deployment
> 5. **Post-deploy**: Health check script that hits `/api/auth/get-session` and verifies 200 response
>
> I'd also add a simple smoke test that creates a test alert, waits for the cron, and verifies the email was sent.

**Q: How do you handle environment variables across dev, staging, and production?**

> - **Development**: `.env` file (gitignored), loaded by Next.js automatically
> - **Staging/Preview**: Vercel "Preview" environment variables — separate values from production (e.g., a test MongoDB database, test email address)
> - **Production**: Vercel "Production" environment variables — real MongoDB cluster, real API keys
>
> Critical rule: Never use production database credentials in development. I'd use separate MongoDB databases (e.g., `quantpulse-dev`, `quantpulse-staging`, `quantpulse-prod`) with different credentials.

**Q: How do you rollback a bad deployment?**

> Vercel maintains deployment history. Rollback options:
> 1. **Instant rollback** — In Vercel dashboard, click "Promote to Production" on a previous deployment. Takes < 10 seconds.
> 2. **Git revert** — `git revert HEAD && git push` → triggers new deployment with reverted code
> 3. **Feature flags** — For gradual rollouts, use flags (e.g., LaunchDarkly, Vercel Edge Config) to disable new features without deploying
>
> For database migrations that can't be rolled back, I'd use a migration system (like `migrate-mongo`) with both `up()` and `down()` functions.

**Q: How would you handle zero-downtime deployments?**

> Vercel handles this natively:
> 1. New deployment builds in the background
> 2. Health checks pass
> 3. Traffic switches atomically to the new deployment
> 4. Old deployment stays warm for a few seconds in case of immediate rollback
>
> The concern in my app is **database schema changes**. If I add a new required field to the Alert schema, the old deployment (still serving requests) might create alerts without it. Solution: make all schema changes additive and optional, backfill later. Never make a breaking schema change in a single deployment.

---

### 17. 📊 Monitoring & Observability

**Q: How do you know if your cron job silently stopped working at 3am?**

> Currently, I wouldn't — that's a gap. I'd add:
> 1. **Inngest monitoring** — Inngest's dashboard shows function run history. If the 5-minute cron hasn't run in 10 minutes, something's wrong.
> 2. **Heartbeat monitoring** — Use a service like Cronitor or Better Uptime. The cron function sends a HTTP ping after each successful run. If the ping stops, the service alerts me.
> 3. **Dead man's switch** — Record the last successful run timestamp in MongoDB. A separate health check endpoint returns unhealthy if `lastRunAt` is > 10 minutes ago. Uptime monitor checks this endpoint.
> 4. **Alert on errors** — Configure Inngest to send a webhook on function failure. Route to Slack or PagerDuty.

**Q: What metrics would you track in production?**

> **Application metrics**:
> - Alert check latency (p50, p95, p99)
> - Alerts triggered per cron run
> - Email send success/failure rate
> - Finnhub API response time and error rate
> - AI inference latency and token usage
>
> **Infrastructure metrics**:
> - MongoDB query latency and connection pool usage
> - Vercel function cold start frequency
> - Memory usage per serverless invocation
>
> **Business metrics**:
> - Daily active users
> - Alerts created per user per day
> - Watchlist size distribution
> - Email open rates (requires tracking pixel)
>
> I'd use Vercel Analytics for web vitals, MongoDB Atlas monitoring for database, and Inngest's built-in dashboard for background jobs.

**Q: How would you implement structured logging?**

> Replace all `console.log` / `console.error` with a logging library like **Pino**:
> ```typescript
> import pino from 'pino';
> const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
>
> // Instead of: console.log('Checking alert for', symbol)
> logger.info({ symbol, alertId, userId }, 'Checking price alert');
>
> // Instead of: console.error('Failed:', error)
> logger.error({ err: error, symbol, alertId }, 'Alert check failed');
> ```
> Benefits:
> - JSON output → parseable by log aggregators (Datadog, Grafana Loki)
> - Log levels → filter noise in production (only WARN and above)
> - Structured fields → search/filter by `symbol`, `userId`, `alertId`
> - Request correlation IDs → trace a single request across multiple logs

**Q: What is a dead letter queue and where would you use one?**

> A DLQ stores messages/events that failed processing after all retry attempts. In QuantPulse:
>
> - **Email delivery failures** — If Nodemailer fails to send an alert email after 3 retries, the alert data goes to a DLQ instead of being lost. I can later inspect the DLQ, fix the issue (e.g., invalid email address), and replay the messages.
> - **Inngest has this built-in** — Failed function runs are visible in the dashboard with full context. I can replay them after fixing the bug.
>
> Without a DLQ, failed messages are silently dropped. With one, no data is lost and I can audit every failure.

---

### 18. 🧪 Edge Cases & Business Logic

**Q: What happens when the stock market is closed? Does your cron job waste resources?**

> Currently, yes — the cron runs every 5 minutes regardless of market hours. Finnhub returns the last known price, so alerts won't trigger on stale data (the price hasn't changed). But it's wasteful. I'd add:
> ```typescript
> const isMarketOpen = () => {
>   const now = new Date();
>   const nyHour = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }));
>   const day = now.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
>   if (['Sat', 'Sun'].includes(day)) return false;
>   return nyHour >= 9 && nyHour < 16; // 9:30 AM - 4 PM ET (simplified)
> };
> ```
> Skip the cron body if the market is closed. For pre/post-market trading, extend the window to 4 AM - 8 PM ET.

**Q: What if a user deletes their account but has active alerts?**

> Currently, nothing — the alerts stay in MongoDB as orphan documents. The cron would try to look up the deleted user, `getUserById()` would return `null`, and the alert would be skipped silently indefinitely.
>
> The fix is cascading cleanup on account deletion:
> ```typescript
> // In account deletion handler:
> await PriceAlert.updateMany({ userId }, { isActive: false });
> await Watchlist.deleteMany({ userId });
> ```
> Or better: use MongoDB change streams to listen for user deletions and automatically clean up related data.

**Q: What if two alerts exist for the same user, same stock, same threshold?**

> Currently, nothing prevents this — a user could create duplicate alerts. The cron would trigger both, sending two identical emails. Fixes:
> 1. **Database constraint** — Add a compound unique index on `{ userId, symbol, alertType, targetPrice, isActive }`. MongoDB rejects duplicates.
> 2. **Application check** — Before creating, query for existing matching alerts: `Alert.findOne({ userId, symbol, alertType, targetPrice, isActive: true })`. If found, return "Alert already exists."
> 3. **Client-side** — Disable the "Create Alert" button if an identical alert already exists in the alerts list.

**Q: Your app only handles USD stocks. What about international markets?**

> Finnhub supports international exchanges, but my current code assumes USD and US market hours. To support international:
> 1. **Currency** — Store the exchange currency per stock (from Finnhub's profile data). Display prices with the correct currency symbol. Alert thresholds would need to specify currency.
> 2. **Market hours** — Each exchange has different trading hours. The market-hours check would need a lookup table per exchange.
> 3. **Symbol format** — International stocks use exchange-prefixed symbols (e.g., `LSE:TSCO` for Tesco on London). The search would need to handle these formats.
> 4. **News** — Finnhub's news API already supports international companies. No change needed.

**Q: What happens if a stock splits? Your alerts would trigger incorrectly.**

> If a user sets an alert for AAPL at $200, and AAPL does a 2:1 split, the price drops to $100. A "lower" alert would trigger incorrectly, and an "upper" alert would never trigger.
>
> Fixes:
> 1. **Detect splits** — Finnhub has a stock splits endpoint. Poll it daily and adjust active alert thresholds proportionally.
> 2. **Notify users** — Send an email: "AAPL did a 2:1 split. Your alert threshold was adjusted from $200 to $100."
> 3. **Manual approach** — Flag alerts for stocks that recently split and notify users to review their thresholds.
>
> Honestly, this is an edge case most retail alert platforms don't handle well either. I'd document it as a known limitation and build the auto-adjust as a v2 feature.

---

### 19. 🗄️ Database Deep-Dives

**Q: Why MongoDB over PostgreSQL? When would PostgreSQL be better?**

> **Why MongoDB fit QuantPulse:**
> - Schema flexibility — I iterated on the alert model several times (adding frequency, lastTriggered, isActive). No migrations needed.
> - JSON-native — Stock data from Finnhub is JSON. Storing and querying it is natural in MongoDB.
> - Serverless-friendly — MongoDB Atlas has a free tier and connection pooling designed for serverless.
>
> **When PostgreSQL would be better:**
> - If I had complex relational queries (e.g., "find all users who follow stocks also followed by user X") — JOINs are native in Postgres, awkward in MongoDB
> - If I needed ACID transactions across multiple collections (e.g., creating an alert AND updating a user's alert count atomically)
> - If I needed strong schema enforcement from day one — PostgreSQL's strict typing catches bugs at the database level
> - Portfolio tracking with financial calculations — Postgres's decimal types and aggregate functions are more precise for financial math than MongoDB

**Q: Explain MongoDB write concern. What does your app use?**

> Write concern controls how many replica set members must acknowledge a write before it's considered successful:
> - `w: 1` (default) — The primary acknowledges the write. If the primary crashes before replicating, the write is lost.
> - `w: "majority"` — The majority of replica set members must acknowledge. Durable but slower.
> - `w: 0` — Fire and forget. Fastest but risky.
>
> My app uses the default (`w: 1`) via Mongoose defaults. For price alerts, I should use `w: "majority"` for the `lastTriggered` update — if that write is lost, the alert could trigger again within the frequency window, sending duplicate emails.

**Q: How does MongoDB sharding work? Would you shard QuantPulse?**

> Sharding distributes data across multiple servers by a shard key. MongoDB routes queries to the relevant shard based on the key.
>
> **For QuantPulse at current scale**: No sharding needed. MongoDB Atlas free tier handles thousands of documents easily.
>
> **At scale (10M+ alerts)**: I'd shard the alerts collection:
> - **Shard key: `{ symbol: "hashed" }`** — Distributes alerts evenly across shards. The cron job can query per-symbol and hit only the relevant shard.
> - Not `userId` — that would scatter one user's alerts across shards, making user-specific queries slow
> - Not `_id` — random distribution, no query locality
>
> Watchlist collection: shard by `userId` (hashed) since most queries filter by user.

**Q: What is a TTL index? Where would you use one?**

> A TTL (Time-To-Live) index auto-deletes documents after a specified time. In QuantPulse:
>
> 1. **AI analysis cache** — If I add AI stock analysis, cache results with a 1-hour TTL:
>    ```javascript
>    analysisSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });
>    ```
>    MongoDB automatically deletes stale analyses without manual cleanup.
>
> 2. **Rate limiting records** — Store rate limit counters with a 1-minute TTL
>
> 3. **Session cleanup** — Better Auth sessions could use TTL indexes to auto-expire old sessions (though Better Auth handles this internally)

**Q: Write a MongoDB aggregation pipeline that finds the top 5 most-watched stocks across all users.**

> ```javascript
> db.watchlists.aggregate([
>   { $group: {
>       _id: "$symbol",
>       count: { $sum: 1 },
>       companies: { $addToSet: "$company" }
>   }},
>   { $sort: { count: -1 } },
>   { $limit: 5 },
>   { $project: {
>       symbol: "$_id",
>       watchCount: "$count",
>       company: { $first: "$companies" },
>       _id: 0
>   }}
> ]);
> ```
> This groups by symbol, counts occurrences, sorts descending, takes top 5. Useful for a "Trending Stocks" feature or for pre-caching popular stock data.

---

### 20. 🔒 Security Deep-Dives

**Q: Walk me through a CSRF attack on your server actions. Are you protected?**

> **CSRF attack**: An attacker creates a page that sends a POST request to my server action endpoint. If the user is logged in and visits the attacker's page, the browser sends the session cookie automatically, and the server action executes with the victim's identity.
>
> **Protection**: Next.js server actions have built-in CSRF protection:
> 1. Server actions use POST requests with a special `Next-Action` header
> 2. The browser won't send this header from cross-origin requests (blocked by CORS)
> 3. Next.js validates the `Origin` header against the app's configured URL
>
> So I'm protected by default. However, if I exposed a raw API route (not a server action) that accepts mutations, I'd need to add CSRF tokens manually.

**Q: Can your app be hit by NoSQL injection?**

> **Traditional SQL injection**: Not applicable — I use MongoDB, not SQL.
>
> **NoSQL injection**: Possible if I pass raw user input to MongoDB query operators. For example, if someone sends `{ "$gt": "" }` as the `symbol` parameter, it could match all documents.
>
> **Am I vulnerable?** Partially:
> - Mongoose schemas with type validation help — `symbol: { type: String }` will reject objects
> - But `getUserByEmail(email)` uses the raw MongoDB driver (`db.collection('user').findOne({ email })`), which doesn't have schema protection
>
> **Fix**: Always validate input types before querying:
> ```typescript
> if (typeof email !== 'string') throw new Error('Invalid email');
> ```
> Or use Zod to validate all inputs at the entry point.

**Q: What is session fixation? Does your app prevent it?**

> **Session fixation**: An attacker obtains a valid session ID, tricks a victim into authenticating with that session ID, and then uses it to access the victim's account.
>
> **Better Auth prevents this** by:
> 1. Generating a new session ID after successful authentication (session regeneration)
> 2. Storing sessions server-side in MongoDB — the attacker can't forge a valid session without access to the database
> 3. Using HttpOnly, Secure, SameSite cookies — the session cookie can't be read by JavaScript or sent cross-site
>
> The key defense is session regeneration: even if an attacker sets a session cookie, it gets replaced with a new one after login.

**Q: How would you rate-limit the sign-up endpoint to prevent brute force?**

> Better Auth has some built-in rate limiting, but I'd add additional layers:
> 1. **Application-level** — Use `rate-limiter-flexible` with a Redis store. Limit to 5 sign-up attempts per IP per hour.
> 2. **Middleware-level** — Add rate limiting in Next.js middleware for the `/api/auth/sign-up` route
> 3. **CAPTCHA** — Add reCAPTCHA or hCaptcha to the sign-up form after 3 failed attempts
> 4. **Email verification** — Require email verification before activating the account (prevents automated account creation)
> 5. **Infrastructure-level** — Vercel/Cloudflare WAF rules to block suspicious IPs

**Q: What's the difference between HTTPS and HSTS? Does your app need both?**

> - **HTTPS**: Encrypts traffic between the browser and server using TLS. Prevents eavesdropping and man-in-the-middle attacks.
> - **HSTS (HTTP Strict Transport Security)**: A response header that tells the browser to ONLY connect via HTTPS in the future. Prevents SSL stripping attacks where an attacker downgrades the connection to HTTP.
>
> **My app needs both**:
> - Vercel provides HTTPS automatically for all deployments
> - HSTS can be added via a `Strict-Transport-Security` response header in `next.config.js`:
>   ```javascript
>   headers: () => [{ source: '/(.*)', headers: [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] }]
>   ```
> - Without HSTS, the first visit could be on HTTP before redirecting to HTTPS — an attacker could intercept that first request.

---

### 21. 💰 Cost & Operations

**Q: How much does this cost to run per month at 10K users?**

> | Service | Free Tier | At 10K Users |
> |---|---|---|
> | **Vercel** (hosting) | 100GB bandwidth | ~$20/mo Pro plan |
> | **MongoDB Atlas** | 512MB storage | ~$57/mo M10 cluster |
> | **Finnhub** | 60 calls/min | ~$49/mo starter plan (300 calls/sec) |
> | **Inngest** | 5K step runs/mo | ~$50/mo Pro (100K runs) |
> | **Email** (SendGrid) | 100 emails/day free | ~$20/mo (50K emails/mo) |
> | **Gemini AI** | Free tier (15 RPM) | ~$10/mo (2.5 Flash Lite is cheap) |
> | **Total** | **$0** | **~$206/mo** |
>
> The biggest cost driver is the Finnhub API if you need higher rate limits. The AI cost is surprisingly low because Gemini 2.5 Flash Lite is cheap for structured output.

**Q: How would you reduce costs?**

> 1. **Cache aggressively** — Redis or Vercel KV to cache Finnhub responses. Most users watch the same popular stocks. Reduce API calls by ~80%.
> 2. **Batch alert checking** — Group alerts by symbol, fetch once per unique symbol. Reduces Finnhub calls from O(alerts) to O(unique_symbols).
> 3. **Smart cron scheduling** — Only run price checks during market hours (6.5 hours/day × 12 runs/hour = 78 runs vs. 288 runs for 24/7).
> 4. **AI caching** — Cache Gemini summaries per symbol, reuse across users with the same watchlist. Don't regenerate identical summaries.
> 5. **Email batching** — Use bulk email APIs instead of individual sends.

**Q: What SLA would you offer for the alert system?**

> For a free product, I'd target:
> - **Uptime**: 99.5% (allows ~3.6 hours downtime/month)
> - **Alert latency**: < 10 minutes from price hitting threshold to email delivery (5-min polling + 5-min processing buffer)
> - **Email delivery**: 99% within 5 minutes of trigger
>
> I'd explicitly exclude:
> - Accuracy during market outages / exchange halts
> - Alerts during planned maintenance windows
> - Guaranteed delivery to spam-filtered inboxes
>
> For a paid tier, I'd tighten to 99.9% uptime and < 1-minute alert latency (requires WebSocket-based architecture).

**Q: How would you roll out a new feature that might break things?**

> 1. **Feature flag** — Gate the feature behind an environment variable or Vercel Edge Config flag. Deploy the code but keep it disabled.
> 2. **Internal testing** — Enable for my own account first. Test all flows.
> 3. **Canary release** — Enable for 5% of users (e.g., users whose ID hash mod 20 === 0). Monitor error rates, latency, user feedback for 24 hours.
> 4. **Gradual rollout** — 5% → 25% → 50% → 100% over a week.
> 5. **Kill switch** — If errors spike, disable the flag instantly without deploying.
>
> For database changes, I'd run the migration first (additive, non-breaking), then deploy the code that uses the new schema, then clean up old fields in a later migration.

---

### 22. 🧩 "Extend This" Design Questions

**Q: How would you add real-time collaborative watchlists (multiple users can share and edit a watchlist)?**

> 1. **Data model change** — Add a `Watchlist` collection (separate from individual items):
>    ```
>    { id, name, ownerId, members: [{ userId, role: 'editor' | 'viewer' }], items: [{ symbol, addedBy }] }
>    ```
> 2. **Permissions** — Editors can add/remove stocks. Viewers can only view. Owner can manage members.
> 3. **Real-time sync** — Use Vercel's AI SDK or Liveblocks for real-time presence and state sync. When one user adds a stock, all connected users see it instantly.
> 4. **Conflict resolution** — Last-write-wins for simple cases. For concurrent adds/removes, use CRDTs (conflict-free replicated data types).
> 5. **Notifications** — When a member adds a stock, send in-app notification to other members.

**Q: How would you add push notifications to mobile browsers?**

> 1. **Service Worker** — Register a service worker that listens for push events
> 2. **Push subscription** — Use the Web Push API to get a push subscription from the browser. Store the subscription in MongoDB.
> 3. **Server-side push** — In the alert pipeline, after sending email, also send a web push notification using the `web-push` library.
> 4. **User preferences** — Add a settings page where users can toggle email vs. push vs. both.
> 5. **Fallback** — If push registration fails (user denied permission), fall back to email-only.
>
> For native mobile, I'd use a React Native wrapper or Expo, with Firebase Cloud Messaging (FCM) for push delivery.

**Q: How would you add support for crypto and forex in addition to stocks?**

> 1. **Data source** — Finnhub supports crypto and forex pairs. Extend `getQuote()` to handle different asset types:
>    - Stocks: `AAPL`
>    - Crypto: `BINANCE:BTCUSDT`
>    - Forex: `OANDA:EUR_USD`
> 2. **Schema change** — Add `assetType: 'stock' | 'crypto' | 'forex'` to Watchlist and Alert models
> 3. **Market hours** — Crypto trades 24/7 (no market-hours filter). Forex trades 24/5. Stocks trade 9:30-4:00 ET.
> 4. **UI** — Add asset type tabs in the search dialog. Show crypto prices with more decimal places (BTC is $67,432.18, not $67,432).
> 5. **Alerts** — Crypto volatility is higher, so allow percentage-based alerts ("notify me when BTC drops 5%") in addition to absolute price alerts.

**Q: How would you build a paper trading feature?**

> 1. **Portfolio model** — `{ userId, balance: 100000 (starting cash), positions: [{ symbol, quantity, avgCost }] }`
> 2. **Trade execution** — User submits buy/sell order. Server fetches current price from Finnhub. Validates sufficient balance/positions. Updates portfolio atomically.
> 3. **P&L calculation** — Current value = Σ(position.quantity × currentPrice). P&L = currentValue - totalCost.
> 4. **Leaderboard** — Rank users by portfolio return percentage. Adds gamification.
> 5. **Charts** — Use Recharts to show portfolio value over time (snapshot portfolio value daily into a `portfolioHistory` collection).
>
> Key challenge: Ensuring price consistency. The price at "trade time" must be the exact price shown to the user, not a price fetched 60 seconds later from cache.

**Q: How would you add a social feed where users share trading ideas?**

> 1. **Post model** — `{ userId, symbol, sentiment: 'bullish' | 'bearish', content: string, likes: number, createdAt }`
> 2. **Feed** — Paginated, sorted by recency. Filter by symbol, user, or sentiment.
> 3. **Following** — Users follow other users. Feed shows posts from followed users + trending posts.
> 4. **Moderation** — AI content filter (Gemini) to flag inappropriate posts. Report button for manual review.
> 5. **Stock page integration** — On the `/symbol/[symbol]` page, show community sentiment: "78% of QuantPulse users are bullish on AAPL."
>
> Key risk: Regulatory compliance. Financial advice/recommendations are regulated. Disclaimer: "QuantPulse does not provide investment advice. Posts are user opinions only."



# QuantPulse Market Intelligence — Resume Bullets

• Architected an event-driven price monitoring system using Inngest background workflows that polls Finnhub API every 5 minutes and evaluates user-defined thresholds to trigger alerts within 5 minutes of a breach

• Optimized MongoDB alert queries by implementing compound indexes on user-stock-threshold fields, reducing query latency from 180ms to 8ms — a 95% improvement under concurrent monitoring loads

• Engineered a fullstack auth and API layer using Better-Auth with Next.js Server Actions and TypeScript, enabling authenticated users to configure custom price thresholds and per-stock alert frequencies stored in MongoDB via Mongoose

• Integrated a personalized email notification pipeline using Nodemailer over Gmail SMTP, delivering HTML-formatted alerts with Gemini API-generated financial summaries tailored to each user's watchlist and threshold configuration

---

# INTERVIEW DEFENCE

## Bullet 1 — Event-driven monitoring architecture

**Likely question:** Why did you choose Inngest with a 5-minute polling interval instead of WebSockets or a push-based approach?

**Answer:** Finnhub's free-tier API is request-based and rate-limited, so a push model wasn't available without a paid WebSocket plan. Inngest gave me durable, retryable cron workflows that run every 5 minutes on Vercel's serverless infrastructure — meaning if a function fails mid-execution, Inngest automatically retries it without me writing recovery logic.

---

## Bullet 2 — Database optimization

**Likely question:** Walk me through how you identified the slow query and chose compound indexing as the fix.

**Answer:** I profiled alert-check queries using MongoDB's `explain()` and saw full collection scans on every 5-minute cycle, averaging 180ms per query. I added a compound index on `{userId, stockSymbol, isActive}` which matched the exact query pattern, dropping latency to 8ms because MongoDB could now satisfy the query entirely from the index without scanning documents.

---

## Bullet 3 — Backend/auth design

**Likely question:** Why Server Actions instead of traditional API routes, and how does Better-Auth fit in?

**Answer:** Server Actions let me colocate mutation logic with the components that call it, eliminating boilerplate API route files while still running server-side with full type safety via TypeScript. Better-Auth handles session management and credential validation, and I call it inside Server Actions to gate write operations like creating or updating alert thresholds in MongoDB.

---

## Bullet 4 — Email/notification pipeline

**Likely question:** How do you personalize each email, and how does the Gemini API integration work?

**Answer:** When a threshold breach is detected, I pass the user's watchlist context and the triggering price data to the Gemini API, which returns a short financial summary specific to that stock's movement. Nodemailer then injects that summary along with the user's name, stock symbol, and threshold details into an HTML email template and sends it via Gmail SMTP.


devops
Better project upgrade

Take your QuantPulse project and:

Dockerize it
Add GitHub Actions CI
Deploy it
Add monitoring/logging basics

Then write:

“Implemented CI/CD pipeline using GitHub Actions and containerized services with Docker for reproducible deployments.”

That sounds much stronger than:

“Know Kubernetes.” 


https://www.youtube.com/watch?v=_Q4pWoKiM5Q&pp=ugUHEgVlbi1VUw%3D%3D screener build with claude code




# QuantPulse Production Hardening & Routing Walkthrough

All tasks from the implementation plan have been completed and verified against a strict production build. Here's a summary of the improvements and security fixes applied to your codebase:

## Security & Identity Refactoring

> [!IMPORTANT]
> The most critical update was moving away from client-side identity passing (`userEmail` props).

1. **Server-Derived Identity**:
   - `lib/actions/watchlist.actions.ts` and `lib/actions/alert.actions.ts` no longer accept user identifiers from the client.
   - All server actions now securely derive the user context directly from the server session via `auth.api.getSession()`.
   - Explicit `if (!session || !session.user) throw new Error('Unauthorized');` checks were added to ensure strong access control.

2. **Component Cleanup**:
   - Cleaned up several Client and Server Components (`WatchlistButton`, `SearchCommand`, `WatchlistPageClient`, `WatchlistDashboard`, `NavItems`, `UserDropdown`, `Header`) by removing the `userEmail` prop.
   - Fixed all TypeScript interfaces (e.g. `WatchlistPageClientProps`) to reflect the cleaner signatures.

3. **Background Jobs (Inngest)**:
   - Modified the daily news summary Inngest job to fetch user watchlist symbols directly from the database, bypassing the now-secured Server Actions that require an active HTTP session.

## Middleware & Routing Stability

> [!TIP]
> The middleware architecture has been aligned with standard Next.js best practices, removing the deployment risks associated with nested middleware structures.

1. **Root-Level Middleware**:
   - Replaced `middleware/index.ts` with standard `middleware.ts` at the root of the project.
   - Configured route matching to properly intercept protected areas while avoiding infinite redirect loops.

2. **Smart Post-Login Redirection**:
   - Upgraded `middleware.ts` to capture the blocked path and pass it as a `callbackUrl` query parameter.
   - The sign-in page `app/(auth)/sign-in/page.tsx` now correctly intercepts this parameter and redirects users back to where they originally tried to go after a successful login.

## Error Handling & Boundaries

Added robust fallbacks to the Next.js `app/` router to ensure the application handles failures gracefully instead of completely crashing the user experience:

- **Global 404** (`app/not-found.tsx`): A stylized page catching invalid paths.
- **Global Error Boundary** (`app/(root)/error.tsx`): Catching unexpected runtime errors inside the main dashboard area.
- **Global Loading State** (`app/(root)/loading.tsx`): A generic loading spinner.
- **Symbol Page Loading State** (`app/(root)/symbol/[symbol]/loading.tsx`): A structured skeleton layout mimicking the TradingView widgets while data loads.

## Dynamic Route Hardening & SEO

> [!NOTE]
> The dynamic stock route (`app/(root)/symbol/[symbol]/page.tsx`) was upgraded with validation and metadata generation.

1. **Input Validation**: Added regex matching (`/^[A-Z0-9.-]+$/i`) to ensure the `[symbol]` parameter is valid before attempting any database or API lookups. Invalid symbols immediately trigger a `notFound()`.
2. **Dynamic SEO**: Implemented `generateMetadata` to ensure page titles dynamically reflect the viewed stock (e.g., `AAPL — QuantPulse`).

## Data Integrity

- Implemented an `existingAlert` check within `createAlert` (`lib/actions/alert.actions.ts`) to prevent the creation of duplicate price alerts for the same user, symbol, price, and type.

## Verification

The entire system passed a strict `npm run build`, ensuring zero type errors or missing dependencies across the client components, server actions, and background jobs. The application is now fully prepared for a robust production deployment.
