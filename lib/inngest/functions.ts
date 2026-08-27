import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendWelcomeEmail, sendEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail, getUserById} from "@/lib/actions/user.actions";

import {getNews, getQuote} from "@/lib/actions/finnhub.actions";
import { connectToDatabase } from "@/database/mongoose";
import Watchlist from "@/database/models/watchlist.model";
import {getFormattedTodayDate} from "@/lib/utils";
import { getActiveAlerts } from "@/lib/internal/alert.internal";
import {PRICE_ALERT_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";
import PriceAlert from "@/database/models/alert.model";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created' },
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({model: 'gemini-2.5-flash-lite'}),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {text: prompt}
                        ]
                    }]
                }
            })

                await step.run('send-welcome-email', async () => {
                    const part = response.candidates?.[0]?.content?.parts?.[0];
                    const introText = (part && 'text' in part ? part.text : null) || 'Thanks for joining QuantPulse. You now have the tools to track markets and make smarter moves.'
                    const { data: { email, name } } = event;

                    return await sendWelcomeEmail({ email, name, intro: introText })
                })
                return {
                    success: true,
                    message: 'Welcome email sent successfully'
                }
        })

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [{ event: 'app/send.daily.news' }, { cron: '0 12 * * *' }],
    async ({ step }) => {
        // Step #1: Get all users for news delivery
        const users = await step.run('get-all-users', getAllUsersForNewsEmail);

        if (!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        // Step #2: For each user, get watchlist symbols -> fetch news (fallback to general)
        const results = await step.run('fetch-user-news', async () => {
            const perUser: Array<{ user: { id: string; email: string; name: string }; articles: MarketNewsArticle[] }> = [];
            
            const mongooseInstance = await connectToDatabase();
            const db = mongooseInstance.connection.db; 
            if (!db) throw new Error('DB not connected');

            // 1. Fetch all users from DB in one go
            const emails = users.map(u => u.email);
            const dbUsers = await db.collection('user').find({ email: { $in: emails } }).toArray();
            
            // 2. Fetch all watchlists for these users in one go
            const userIds = dbUsers.map(u => u._id.toString());
            const allWatchlists = await Watchlist.find({ userId: { $in: userIds } }).select('userId symbol');

            // 3. Build a map of userId -> symbols[]
            const userSymbolsMap = new Map<string, string[]>();
            for (const item of allWatchlists) {
                const uid = item.userId.toString();
                if (!userSymbolsMap.has(uid)) userSymbolsMap.set(uid, []);
                userSymbolsMap.get(uid)!.push(item.symbol);
            }

            for (const user of users) {
                try {
                    const dbUser = dbUsers.find(u => u.email === user.email);
                    const userId = dbUser?._id?.toString();
                    
                    const symbols: string[] = userId ? (userSymbolsMap.get(userId) || []) : [];
                    
                    let articles = await getNews(symbols);
                    
                    // Enforce max 6 articles per user
                    articles = (articles || []).slice(0, 6);
                    
                    // If still empty, fallback to general
                    if (!articles || articles.length === 0) {
                        articles = await getNews();
                        articles = (articles || []).slice(0, 6);
                    }
                    perUser.push({ user, articles });
                } catch (e) {
                    console.error('daily-news: error preparing user news', user.email, e);
                    perUser.push({ user, articles: [] });
                }
            }
            return perUser;
        });

        // Step #3: (placeholder) Summarize news via AI
        const userNewsSummaries: { user: { id: string; email: string; name: string }; newsContent: string | null }[] = [];

        for (const { user, articles } of results) {
            try {
                const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

                const response = await step.ai.infer(`summarize-news-${user.email}`, {
                    model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                    body: {
                        contents: [{ role: 'user', parts: [{ text: prompt }]}]
                    }
                });

                const part = response.candidates?.[0]?.content?.parts?.[0];
                const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.'

                userNewsSummaries.push({ user, newsContent });
            } catch (e) {
                console.error('Failed to summarize news for : ', user.email, e);
                userNewsSummaries.push({ user, newsContent: null });
            }
        }

        // Step #4: (placeholder) Send the emails
        await step.run('send-news-emails', async () => {
            await Promise.all(
                userNewsSummaries.map(async ({ user, newsContent }) => {
                    if (!newsContent) return false;

                    return await sendNewsSummaryEmail({ 
                      email: user.email, 
                      date: getFormattedTodayDate(), 
                      newsContent 
                    });
                })
            );
        });

        return { success: true, message: 'Daily news summary emails sent successfully' };
    }
);

export const checkPriceAlerts = inngest.createFunction(
    { id: 'check-price-alerts' },
    { cron: '*/5 * * * *' }, // Run every 5 minutes
    async ({ step }) => {
        // Step 1: Get all active alerts
        const result = await step.run('get-active-alerts', getActiveAlerts);

        if (!result.success || result.data.length === 0) {
            return { success: true, message: 'No active alerts to check' };
        }

        const alerts = result.data;

        // Step 2: Fetch quotes for unique symbols only (deduplication)
        // e.g. 10 alerts for [AAPL, AAPL, TSLA, MSFT, MSFT] → 3 API calls, not 10
        const priceCache = await step.run('fetch-unique-prices', async () => {
            const uniqueSymbols = [...new Set(alerts.map((a: any) => a.symbol as string))];

            const entries = await Promise.all(
                uniqueSymbols.map(async (symbol) => {
                    const quote = await getQuote(symbol);
                    return [symbol, quote?.c || 0] as [string, number];
                })
            );

            return Object.fromEntries(entries) as Record<string, number>;
        });

        // Step 3: Evaluate alerts against the cached prices and send notifications
        const results = await step.run('check-and-send-alerts', async () => {
            const triggeredAlerts = [];

            for (const alert of alerts) {
                try {
                    // O(1) dictionary lookup — zero HTTP calls
                    const currentPrice = priceCache[alert.symbol] ?? 0;

                    // Check if alert should trigger
                    let shouldTrigger = false;
                    if (alert.alertType === 'upper' && currentPrice >= alert.targetPrice) {
                        shouldTrigger = true;
                    } else if (alert.alertType === 'lower' && currentPrice <= alert.targetPrice) {
                        shouldTrigger = true;
                    }

                    if (!shouldTrigger) continue;

                    // Check frequency constraints
                    const now = new Date();
                    if (alert.lastTriggered) {
                        const timeSinceLastTrigger = now.getTime() - new Date(alert.lastTriggered).getTime();
                        const hourInMs = 60 * 60 * 1000;

                        if (alert.frequency === 'once' && timeSinceLastTrigger < 24 * hourInMs) {
                            continue; // Already triggered today
                        } else if (alert.frequency === 'hourly' && timeSinceLastTrigger < hourInMs) {
                            continue; // Already triggered this hour
                        }
                    }

                    // Get user email by their ID
                    const user = await getUserById(alert.userId);
                    if (!user?.email) continue;

                    // Send email
                    const emailHtml = PRICE_ALERT_EMAIL_TEMPLATE(
                        alert.symbol,
                        alert.company,
                        currentPrice,
                        alert.targetPrice,
                        alert.alertType
                    );

                    await sendEmail({
                        to: user.email,
                        subject: `🔔 Price Alert: ${alert.symbol} ${alert.alertType === 'upper' ? 'Above' : 'Below'} $${alert.targetPrice}`,
                        html: emailHtml
                    });

                    // Update lastTriggered
                    await PriceAlert.findByIdAndUpdate(alert._id, {
                        lastTriggered: now
                    });

                    triggeredAlerts.push({
                        symbol: alert.symbol,
                        price: currentPrice,
                        target: alert.targetPrice
                    });
                } catch (error) {
                    console.error(`Failed to process alert for ${alert.symbol}:`, error);
                }
            }

            return triggeredAlerts;
        });


        return {
            success: true,
            message: `Checked ${alerts.length} alerts, triggered ${results.length} notifications`
        };
    }
);