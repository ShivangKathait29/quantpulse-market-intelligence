/**
 * Centralised environment variable validation.
 *
 * This module is the SINGLE place that reads process.env.
 * It validates required vars at startup — before any request is served —
 * so a missing secret fails loudly at boot time, not silently at runtime.
 *
 * Usage:
 *   import { env } from "@/lib/config/env";
 *   env.MONGODB_URI   // fully typed, guaranteed to be a string
 */

// ─── Required: app will not start without these ───────────────────────────────
const required = {
    MONGODB_URI:         process.env.MONGODB_URI,
    BETTER_AUTH_SECRET:  process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL:     process.env.BETTER_AUTH_URL,
    GEMINI_API_KEY:      process.env.GEMINI_API_KEY,
    NODEMAILER_EMAIL:    process.env.NODEMAILER_EMAIL,
    NODEMAILER_PASSWORD: process.env.NODEMAILER_PASSWORD,
} as const;

for (const [key, value] of Object.entries(required)) {
    if (!value) {
        throw new Error(
            `[env] Missing required environment variable: ${key}\n` +
            `Check your .env file and make sure it is set.`
        );
    }
}

// ─── Optional ──────────────────────────────────────────────────────────────────
const NODE_ENV = (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test';

// Resolve the Finnhub token from whichever env var is set.
// This stays private — consumers only see env.FINNHUB_TOKEN.
const FINNHUB_TOKEN = process.env.FINNHUB_API_KEY
    || process.env.NEXT_PUBLIC_FINNHUB_API_KEY
    || '';

// Export a single validated, typed env object
export const env = {
    ...required,
    NODE_ENV,
    FINNHUB_TOKEN,
} as {
    MONGODB_URI:        string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL:    string;
    GEMINI_API_KEY:     string;
    NODEMAILER_EMAIL:   string;
    NODEMAILER_PASSWORD:string;
    NODE_ENV:           'development' | 'production' | 'test';
    FINNHUB_TOKEN:      string;
};

