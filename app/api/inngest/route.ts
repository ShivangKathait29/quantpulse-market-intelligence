// SECURITY FIX REQUIRED — ML: Potential command injection
// CWE: None
// Description: ML classifier detected potential command injection (confidence: 0.87).
// TODO: Apply a proper fix for this vulnerability.
import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import { sendSignUpEmail} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail],
})