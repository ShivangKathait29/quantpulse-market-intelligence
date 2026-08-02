import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import {sendDailyNewsSummary, sendSignUpEmail, checkPriceAlerts} from "@/lib/inngest/functions";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendDailyNewsSummary, checkPriceAlerts],
})