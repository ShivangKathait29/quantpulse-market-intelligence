import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { dispatchDailyNews } from "../../../inngest/functions/dispatchNews";
import { processUserNews } from "../../../inngest/functions/processUserNews";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dispatchDailyNews,
    processUserNews
  ],
});
