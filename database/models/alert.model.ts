import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface PriceAlert extends Document {
  userId: string;
  symbol: string;
  company: string;
  alertType: 'upper' | 'lower';
  targetPrice: number;
  frequency: 'once' | 'hourly' | 'continuous';
  lastTriggered?: Date;
  isActive: boolean;
  createdAt: Date;
}

const PriceAlertSchema = new Schema<PriceAlert>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  company: {
    type: String,
    required: true,
    trim: true,
  },
  alertType: {
    type: String,
    enum: ['upper', 'lower'],
    required: true,
  },
  targetPrice: {
    type: Number,
    required: true,
  },
  frequency: {
    type: String,
    enum: ['once', 'hourly', 'continuous'],
    default: 'once',
  },
  lastTriggered: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add compound index for efficient queries
PriceAlertSchema.index({ userId: 1, isActive: 1 });
PriceAlertSchema.index({ symbol: 1, isActive: 1 });

const Alert = models?.Alert || model<PriceAlert>('Alert', PriceAlertSchema);

export default Alert;
