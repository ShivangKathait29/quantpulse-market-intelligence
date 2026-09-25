# Price Alert System - Implementation Summary

## Overview
A complete email alert notification system that monitors stock prices and sends emails when price targets are reached.

## Features Implemented

### 1. Database Layer
**File:** `database/models/alert.model.ts`
- PriceAlert schema with fields:
  - `userId`: User's email address (indexed)
  - `symbol`: Stock ticker symbol (uppercase, indexed)
  - `company`: Company name
  - `alertType`: "upper" or "lower" threshold
  - `targetPrice`: Target price to trigger alert
  - `frequency`: "once", "hourly", or "continuous"
  - `lastTriggered`: Timestamp of last alert (optional)
  - `isActive`: Soft delete flag (default: true)
  - `createdAt`: Creation timestamp

### 2. Server Actions
**File:** `lib/actions/alert.actions.ts`
- `createAlert()`: Create new price alert for authenticated user
- `getUserAlerts()`: Fetch all active alerts for user
- `deleteAlert()`: Soft delete alert by ID
- `getActiveAlerts()`: Get all active alerts (for background job)

### 3. Email Template
**File:** `lib/nodemailer/templates.ts`
- `PRICE_ALERT_EMAIL_TEMPLATE()`: Professional HTML email with:
  - Stock symbol and company name
  - Current price vs target price comparison
  - Alert condition (above/below target)
  - CTA button to view stock details
  - Dark theme matching QuantPulse branding

### 4. Background Price Monitoring
**File:** `lib/inngest/functions.ts`
- `checkPriceAlerts()`: Cron job running every 5 minutes
  - Fetches all active alerts from database
  - Queries Finnhub API for current stock prices
  - Compares prices against thresholds
  - Respects frequency settings (once/hourly/continuous)
  - Sends email notifications when triggered
  - Updates `lastTriggered` timestamp
  - Handles errors gracefully

### 5. UI Integration
**File:** `components/WatchlistPageClient.tsx`
- Alert creation dialog with:
  - Stock selector dropdown
  - Alert type selector (above/below)
  - Target price input
  - Frequency selector (once per day, once per hour, continuous)
- Alert management panel:
  - Displays all user alerts
  - Shows current price, target, and frequency
  - Delete button for each alert
  - Test email button to send sample alert
- Database-backed state:
  - Loads alerts on mount
  - Creates alerts via server action
  - Deletes alerts via server action
  - Toast notifications for feedback

### 6. Test Email Functionality
**File:** `lib/actions/test-email.actions.ts`
- `sendTestAlert()`: Server action to send test email
  - Authenticates user
  - Sends sample AAPL alert email
  - Returns success/error message
- **Test Email Button**: Located in watchlist alerts panel
  - Click to receive sample alert email
  - Verifies email configuration works

## Setup Instructions

### 1. Configure Email (Required)
Add to `.env.local`:
```env
NODEMAILER_EMAIL=your-gmail@gmail.com
NODEMAILER_PASSWORD=your-app-password
```

**Gmail Setup:**
1. Enable 2-Factor Authentication
2. Generate App Password at https://myaccount.google.com/apppasswords
3. Use app password in NODEMAILER_PASSWORD

### 2. Start Development Server
```bash
npm run dev
```

### 3. Test Email Alerts
1. Navigate to `/watchlist`
2. Add stocks to your watchlist
3. Click "Create Alert" button
4. Set target price and alert type
5. Click "Test Email" to verify email configuration
6. Check your inbox for the test alert

### 4. Inngest Setup (Production)
The price monitoring job is registered but requires Inngest to be running:

**Development:**
```bash
npx inngest-cli@latest dev
```

**Production:**
- Deploy to Vercel/Netlify
- Add Inngest webhook URL to your Inngest Cloud dashboard
- Job will run automatically every 5 minutes

## How It Works

### Alert Creation Flow
1. User selects stock from watchlist
2. Sets target price (e.g., $180 for AAPL)
3. Chooses alert type (above/below)
4. Selects frequency (once/hourly/continuous)
5. Alert saved to MongoDB with user email

### Price Monitoring Flow
1. Inngest cron triggers every 5 minutes
2. Fetches all active alerts from database
3. For each alert:
   - Queries Finnhub for current price
   - Checks if price crossed threshold
   - Validates frequency constraints
   - Sends email if conditions met
   - Updates lastTriggered timestamp

### Email Delivery Flow
1. Price alert triggered
2. Generates HTML email from template
3. Sends via Nodemailer (Gmail SMTP)
4. User receives notification with:
   - Current price
   - Target price
   - Alert type (above/below)
   - Link to view stock details

## Frequency Settings Explained

- **Once per day**: Alert sent once, won't trigger again for 24 hours
- **Once per hour**: Alert sent once, won't trigger again for 1 hour
- **Continuous**: Alert sent every 5 minutes while condition is met

## Files Modified/Created

### New Files
- `database/models/alert.model.ts`
- `lib/actions/alert.actions.ts`
- `lib/actions/test-email.actions.ts`
- `scripts/send-test-alert.ts`
- `ALERT_SYSTEM.md` (this file)

### Modified Files
- `components/WatchlistPageClient.tsx` - Integrated alert UI and database
- `lib/inngest/functions.ts` - Added checkPriceAlerts function
- `lib/nodemailer/templates.ts` - Added PRICE_ALERT_EMAIL_TEMPLATE
- `lib/nodemailer/index.ts` - Added sendEmail helper
- `lib/actions/user.actions.ts` - Added getUserByEmail
- `app/api/inngest/route.ts` - Registered checkPriceAlerts

## Testing Checklist

- [ ] Configure NODEMAILER_EMAIL and NODEMAILER_PASSWORD in .env
- [ ] Start dev server with `npm run dev`
- [ ] Navigate to `/watchlist`
- [ ] Add stocks to watchlist
- [ ] Click "Create Alert" and set up an alert
- [ ] Click "Test Email" button
- [ ] Verify email received in inbox
- [ ] Start Inngest dev server with `npx inngest-cli@latest dev`
- [ ] Create alert with threshold close to current price
- [ ] Wait 5 minutes for cron to trigger
- [ ] Verify alert email received when price crosses threshold

## Troubleshooting

### "Missing credentials for PLAIN" Error
- Email environment variables not set
- Check `.env.local` has NODEMAILER_EMAIL and NODEMAILER_PASSWORD
- Restart dev server after adding env vars

### No Email Received
1. Check spam/junk folder
2. Verify Gmail app password is correct
3. Check server logs for email errors
4. Try "Test Email" button first

### Alert Not Triggering
1. Verify Inngest dev server is running
2. Check alert threshold is close to current price
3. Check `lastTriggered` timestamp in database
4. Verify frequency settings
5. Check Inngest logs for errors

## Next Steps (Optional Enhancements)

1. **Alert History**: Track all triggered alerts for user review
2. **Multiple Conditions**: Support "and/or" logic (price + volume)
3. **SMS Alerts**: Add Twilio integration for text notifications
4. **Alert Templates**: Pre-configured alerts (breakout, breakdown, etc.)
5. **Batch Alerts**: Summarize multiple alerts in single daily email
6. **Email Preferences**: Let users choose email frequency globally

## API Reference

### Server Actions

```typescript
// Create alert
await createAlert(
  userEmail: string,
  symbol: string,
  company: string,
  alertType: 'upper' | 'lower',
  targetPrice: number,
  frequency: 'once' | 'hourly' | 'continuous'
)

// Get user's alerts
const alerts = await getUserAlerts(userEmail: string)

// Delete alert
await deleteAlert(alertId: string)

// Get all active alerts (for cron job)
const activeAlerts = await getActiveAlerts()

// Send test email
const result = await sendTestAlert()
```

## Support

For issues or questions:
1. Check console logs for errors
2. Verify all environment variables are set
3. Ensure MongoDB connection is working
4. Test email configuration with "Test Email" button
