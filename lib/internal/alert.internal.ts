import { connectToDatabase } from "@/database/mongoose";
import Alert from "@/database/models/alert.model";
import { DatabaseError } from "@/lib/errors";

export async function getActiveAlerts() {
  try {
    await connectToDatabase();
    const alerts = await Alert.find({ isActive: true });
    return { success: true as const, data: alerts };
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    return { success: false as const, error: 'Failed to fetch active alerts' };
  }
}
