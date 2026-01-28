"use server";

import { sendEmail } from "@/lib/nodemailer";
import { PRICE_ALERT_EMAIL_TEMPLATE } from "@/lib/nodemailer/templates";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";

export async function sendTestAlert() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        
        if (!session?.user?.email) {
            return { success: false, error: "Not authenticated" };
        }

        const testAlertData = {
            symbol: "AAPL",
            company: "Apple Inc.",
            currentPrice: 185.50,
            targetPrice: 180.00,
            alertType: "upper" as const
        };

        const emailHtml = PRICE_ALERT_EMAIL_TEMPLATE(
            testAlertData.symbol,
            testAlertData.company,
            testAlertData.currentPrice,
            testAlertData.targetPrice,
            testAlertData.alertType
        );

        await sendEmail({
            to: session.user.email,
            subject: `🔔 [TEST] Price Alert: ${testAlertData.symbol} Above $${testAlertData.targetPrice}`,
            html: emailHtml
        });

        return { 
            success: true, 
            message: `Test alert email sent to ${session.user.email}` 
        };
    } catch (error) {
        console.error("Failed to send test alert:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Failed to send email" 
        };
    }
}
