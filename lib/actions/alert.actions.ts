'use server';

import { connectToDatabase } from "@/database/mongoose";
import Alert from "@/database/models/alert.model";
import { requireSession } from "@/lib/better-auth/require-session";

export async function createAlert(
  symbol: string,
  company: string,
  alertType: 'upper' | 'lower',
  targetPrice: number,
  frequency: 'once' | 'hourly' | 'continuous'
) {
  try {
    const { userId } = await requireSession();

    // Check for existing duplicate alert
    const existingAlert = await Alert.findOne({
      userId,
      symbol: symbol.toUpperCase(),
      alertType,
      targetPrice,
      isActive: true,
    });

    if (existingAlert) {
      throw new Error('An identical active alert already exists for this symbol and price threshold.');
    }

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

export async function getUserAlerts() {
  try {
    const { userId } = await requireSession();

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
    const { userId } = await requireSession();

    // Scope the update to BOTH alertId AND userId — this is the ownership check.
    // If the alert belongs to a different user, the query matches nothing and
    // result is null, so we throw instead of silently succeeding.
    const result = await Alert.findOneAndUpdate(
      { _id: alertId, userId },
      { isActive: false }
    );

    if (!result) throw new Error('Alert not found or not owned by this user');

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
