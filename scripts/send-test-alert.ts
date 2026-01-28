import { sendEmail } from "@/lib/nodemailer";
import { PRICE_ALERT_EMAIL_TEMPLATE } from "@/lib/nodemailer/templates";

const testEmail = process.env.TEST_EMAIL || "your.email@example.com";

const testAlertData = {
    symbol: "AAPL",
    company: "Apple Inc.",
    currentPrice: 185.50,
    targetPrice: 180.00,
    alertType: "upper" as const
};

async function sendTestAlert() {
    try {
        console.log(`Sending test alert email to ${testEmail}...`);
        
        const emailHtml = PRICE_ALERT_EMAIL_TEMPLATE(
            testAlertData.symbol,
            testAlertData.company,
            testAlertData.currentPrice,
            testAlertData.targetPrice,
            testAlertData.alertType
        );

        await sendEmail({
            to: testEmail,
            subject: `🔔 [TEST] Price Alert: ${testAlertData.symbol} Above $${testAlertData.targetPrice}`,
            html: emailHtml
        });

        console.log("✅ Test alert email sent successfully!");
        console.log(`Check your inbox at ${testEmail}`);
    } catch (error) {
        console.error("❌ Failed to send test alert:", error);
    }
}

sendTestAlert();
