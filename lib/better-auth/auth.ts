import { betterAuth } from "better-auth";
import { mongodbAdapter} from "better-auth/adapters/mongodb";
import { nextCookies} from "better-auth/next-js";
import { mongoClient } from "@/database/mongoose";

const db = mongoClient.db();

export const auth = betterAuth({
    database: mongodbAdapter(db, { client: mongoClient }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
        enabled: true,
        disableSignUp: false,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        autoSignIn: true,
    },
    plugins: [nextCookies()],
});