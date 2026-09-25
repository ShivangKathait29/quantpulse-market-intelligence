import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendWelcomeEmail, sendEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail, getUserById} from "@/lib/actions/user.actions";
import {getWatchlistSymbolsByEmail} from "@/lib/actions/watchlist.actions";
import {getNews, getQuote} from "@/lib/actions/finnhub.actions";
import {getFormattedTodayDate} from "@/lib/utils";
import {getActiveAlerts} from "@/lib/actions/alert.actions";
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

export const dispatchDailyNews = inngest.createFunction(
    { id: 'dispatch-daily-news' },
    [{ event: 'app/send.daily.news' }, { cron: '0 12 * * *' }],
    async ({ step }) => {
        const users = await step.run('get-all-users', getAllUsersForNewsEmail);

        if (!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        const events = users.map((user: any) => ({
            name: "app/user.process_news" as const,
            data: {
                userId: user.id || user._id?.toString(),
                email: user.email,
                name: user.name
            }
        }));

        await step.sendEvent('fan-out-news', events);

        return { success: true, message: `Dispatched ${events.length} user news events` };
    }
);

export const processUserNews = inngest.createFunction(
    { 
        id: 'process-user-news',
        concurrency: { limit: 5 },
        retries: 3 
    },
    { event: 'app/user.process_news' },
    async ({ event, step }) => {
        const { email } = event.data;

        const articles = await step.run('fetch-user-news', async () => {
            let userArticles: any[] = [];
            try {
                const symbols = await getWatchlistSymbolsByEmail(email);
                userArticles = await getNews(symbols);
                userArticles = (userArticles || []).slice(0, 6);
                
                if (!userArticles || userArticles.length === 0) {
                    userArticles = await getNews();
                    userArticles = (userArticles || []).slice(0, 6);
                }
            } catch (e) {
                console.error('Failed to get news for', email, e);
            }
            return userArticles;
        });

        if (!articles || articles.length === 0) {
            return { success: false, reason: 'No articles found' };
        }

        const newsContent = await step.run('summarize-news', async () => {
            const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

            const response = await step.ai.infer(`summarize-news-${email}`, {
                model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                body: {
                    contents: [{ role: 'user', parts: [{ text: prompt }]}]
                }
            });

            const part = response.candidates?.[0]?.content?.parts?.[0];
            return (part && 'text' in part ? part.text : null) || 'No market news.'
        });

        if (!newsContent) return { success: false, reason: 'AI summarization failed' };

        await step.run('send-news-email', async () => {
            await sendNewsSummaryEmail({ 
                email, 
                date: getFormattedTodayDate(), 
                newsContent 
            });
        });

        return { success: true, email };
    }
);

export const checkPriceAlerts = inngest.createFunction(
    { id: 'check-price-alerts' },
    { cron: '*/5 * * * *' }, // Run every 5 minutes
    async ({ step }) => {
        // Step 1: Get all active alerts
        const alerts = await step.run('get-active-alerts', getActiveAlerts);

        if (!alerts || alerts.length === 0) {
            return { success: true, message: 'No active alerts to check' };
        }

        // Step 2: Check prices and send alerts
        const results = await step.run('check-and-send-alerts', async () => {
            const triggeredAlerts = [];

            for (const alert of alerts) {
                try {
                    // Get current price
                    const quote = await getQuote(alert.symbol);
                    const currentPrice = quote?.c || 0;

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