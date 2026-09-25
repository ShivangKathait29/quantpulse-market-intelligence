import { Inngest, EventSchemas } from "inngest";

type Events = {
  "app/user.process_news": {
    data: {
      userId: string;
      email: string;
    };
  };
};

export const inngest = new Inngest({ 
    id: "quantpulse", 
    schemas: new EventSchemas().fromRecord<Events>() 
});
