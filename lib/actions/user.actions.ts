'use server';

import {connectToDatabase} from "@/database/mongoose";
import {ObjectId} from "mongodb";

export const getAllUsersForNewsEmail = async () => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        const users = await db.collection('user').find(
            { email: { $exists: true, $ne: null }},
            { projection: { _id: 1, id: 1, email: 1, name: 1, country:1 }}
        ).toArray();

        return users.filter((user) => user.email && user.name).map((user) => ({
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name
        }))
    } catch (e) {
        console.error('Error fetching users for news email:', e)
        return []
    }
}

export const getUserByEmail = async (email: string) => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        const user = await db.collection('user').findOne(
            { email },
            { projection: { _id: 1, id: 1, email: 1, name: 1 }}
        );

        if (!user) return null;

        return {
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name
        };
    } catch (e) {
        console.error('Error fetching user by email:', e);
        return null;
    }
}

export const getUserById = async (userId: string) => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        // Better Auth stores the user ID in the `id` field, but also try _id as fallback
        let user = await db.collection('user').findOne(
            { id: userId },
            { projection: { _id: 1, id: 1, email: 1, name: 1 }}
        );

        if (!user) {
            try {
                user = await db.collection('user').findOne(
                    { _id: new ObjectId(userId) },
                    { projection: { _id: 1, id: 1, email: 1, name: 1 }}
                );
            } catch {
                // userId is not a valid ObjectId, that's fine
            }
        }

        if (!user) return null;

        return {
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name
        };
    } catch (e) {
        console.error('Error fetching user by ID:', e);
        return null;
    }
}