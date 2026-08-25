import { Inngest} from "inngest";
import { env } from "@/lib/config/env";

export const inngest = new Inngest({
    id: 'signalist',
    ai: { gemini: { apiKey: env.GEMINI_API_KEY }}
})