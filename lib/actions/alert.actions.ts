'use server';

import { connectToDatabase } from "@/database/mongoose";
import Alert from "@/database/models/alert.model";

export async function createAlert(
  email: string,
  symbol: string,
  company: string,
  alertType: 'upper' | 'lower',
  targetPrice: number,
  frequency: 'once' | 'hourly' | 'continuous'
) {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    const user = await db.collection('user').findOne({ email });
    if (!user) throw new Error('User not found');

    const userId = user.id || user._id?.toString();

    const alert = await Alert.create({
      userId,
      symbol: symbol.toUpperCase(),
      company,
      alertType,
      targetPrice,
      frequency,
      isActive: true,
    });

    return { success: true, alertId: alert._id.toString() };
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
}

export async function getUserAlerts(email: string) {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    const user = await db.collection('user').findOne({ email });
    if (!user) return [];

    const userId = user.id || user._id?.toString();

    const alerts = await Alert.find({ userId, isActive: true }).sort({ createdAt: -1 });

    return alerts.map(alert => ({
      id: alert._id.toString(),
      symbol: alert.symbol,
      company: alert.company,
      alertType: alert.alertType,
      threshold: alert.targetPrice,
      frequency: alert.frequency === 'once' ? 'Once per day' : alert.frequency === 'hourly' ? 'Once per hour' : 'Every time',
      currentPrice: 0, // Will be populated by client
    }));
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }
}

export async function deleteAlert(alertId: string) {
  try {
    await connectToDatabase();
    await Alert.findByIdAndUpdate(alertId, { isActive: false });
    return { success: true };
  } catch (error) {
    console.error('Error deleting alert:', error);
    throw error;
  }
}

export async function getActiveAlerts() {
  try {
    await connectToDatabase();
    const alerts = await Alert.find({ isActive: true });
    return alerts;
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    return [];
  }
}
