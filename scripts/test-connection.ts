import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function testConnection() {
    if (!MONGODB_URI) {
        console.error('Error: MONGODB_URI is not defined in .env file');
        process.exit(1);
    }

    console.log('Attempting to connect to MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Successfully connected to MongoDB!');
        
        // Print some info about the connection
        if (mongoose.connection.db) {
            console.log('Database Name:', mongoose.connection.db.databaseName);
        }
        
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

testConnection();
