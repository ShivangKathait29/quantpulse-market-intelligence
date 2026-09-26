import { Inngest, EventSchemas } from "inngest";


type Events = {
  "app/user.created": {
    data: {
      email: string;
      name: string;
      country: string;
      investmentGoals: string;
      riskTolerance: string;
      preferredIndustry: string;
    };
  };
  "app/send.daily.news": {
     data: Record<string, unknown>;
  };
  "app/user.process_news": {
    data: {
      userId: string;
      email: string;
      name: string;
    };
  };
};

export const inngest = new Inngest({
    id: 'signalist',
    schemas: new EventSchemas().fromRecord<Events>(),
    ai: { gemini: { apiKey: process.env.GEMINI_API_KEY! }}
})