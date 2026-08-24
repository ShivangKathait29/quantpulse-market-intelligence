'use server';

import {auth} from "@/lib/better-auth/auth";
import {inngest} from "@/lib/inngest/client";
import {headers} from "next/headers";

import { signInSchema, signUpSchema } from "@/lib/validations";

export const signUpWithEmail = async (data: SignUpFormData) => {
    try {
        const validated = signUpSchema.safeParse(data);
        if (!validated.success) {
            return { success: false, error: "Invalid data provided" };
        }
        const { email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry } = validated.data;
        const response = await auth.api.signUpEmail({ 
            body: { email, password, name: fullName },
            headers: await headers()
        })

        if(response) {
            await inngest.send({
                name: 'app/user.created',
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry }
            })
        }

        return { success: true, data: response }
    } catch (e: any) {
        console.log('Sign up failed', e)
        return { success: false, error: e?.message || 'Sign up failed' }
    }
}

export const signInWithEmail = async (data: SignInFormData) => {
    try {
        const validated = signInSchema.safeParse(data);
        if (!validated.success) {
            return { success: false, error: "Invalid data provided" };
        }
        const { email, password } = validated.data;
        const response = await auth.api.signInEmail({ 
            body: { email, password },
            headers: await headers()
        })
        return { success: true, data: response }
    } catch (e: any) {
        console.log('Sign in failed', e)
        return { success: false, error: e?.message || 'Sign in failed' }
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
        return { success: true }
    } catch (e: any) {
        console.log('Sign out failed', e)
        return { success: false, error: e?.message || 'Sign out failed' }
    }
}