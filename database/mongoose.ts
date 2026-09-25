import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    };
    var mongoClient: MongoClient | null;
}

let cached = global.mongooseCache;

if (!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}

// Global cached MongoClient for both better-auth and Mongoose
if (!global.mongoClient) {
    if (!MONGODB_URI) throw new Error('MONGODB_URI must be set within .env');
    global.mongoClient = new MongoClient(MONGODB_URI);
}

export const mongoClient = global.mongoClient;

export const connectToDatabase = async () => {
    if (!MONGODB_URI) throw new Error('MONGODB_URI must be set within .env');

    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoClient.connect().then(async (client) => {
            if (mongoose.connection.readyState === 0) {
                mongoose.connection.setClient(client);
            }
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;
        throw err;
    }

    console.log(`Connected to database in ${process.env.NODE_ENV} environment`);
    return cached.conn;
}