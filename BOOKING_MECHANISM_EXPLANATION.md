# Booking Mechanism Explanation

## How Bookings Are Generated

### Step 1: Application Accepted (Status: CONFIRMED)
When an employer accepts an application:
- **Location**: `applications.service.ts` → `updateStatusAsEmployer()`
- **Action**: Creates a booking with status `CONFIRMED`
- **Booking Fields Set**:
  - `jobId`: The job ID
  - `jobSeekerId`: Service provider's ID
  - `employerId`: Employer's ID
  - `status`: `CONFIRMED`
  - `startTime`: Calculated (default: now)
  - `endTime`: Calculated (default: startTime + 8 hours or from job duration)
  - `agreedRateAmount`: From application or job
  - `agreedCurrency`: From application or job
  - `agreedPayUnit`: Payment type (HOURLY, DAILY, etc.)

**At this stage**: Booking exists but NO payment has been captured yet.

### Step 2: Job Completed (Status: COMPLETED)
When employer marks job as complete:
- **Location**: `payments.service.ts` → `completeApplicationPayment()`
- **Action**: 
  1. Captures payment from employer (Stripe)
  2. Creates Stripe Transfer to service provider's Connect account
  3. **Updates existing booking** (or creates new if none exists)
- **Booking Fields Updated**:
  - `status`: Changed to `COMPLETED`
  - `capturedAmount`: Amount service provider receives (after 10% platform fee)
  - `capturedAt`: Timestamp when payment was captured
  - `finalAmount`: Same as capturedAmount
  - `completedAt`: Timestamp when job was completed
  - `currency`: Payment currency

**At this stage**: Booking is COMPLETED and payment is captured. Funds are transferred to service provider's Stripe Connect account.

### Step 3: Stripe Payout (Within 24 hours)
- **Stripe automatically** transfers funds from Connect account to service provider's bank account
- **Timing**: Usually within 24 hours (Stripe's standard processing time)
- **No code needed**: This is handled by Stripe automatically

## Why Balance Shows 0.00

### Current Situation:
Your logs show 2 bookings with status `CONFIRMED`:
- `6951b5f3e72015e934dc1bfc`
- `69540c4bf246ec0657735780`

### The Problem:
1. **Receipts Screen Filter**: The receipts screen (`/payments/receipts`) only shows bookings where:
   ```typescript
   booking.capturedAmount && booking.capturedAmount > 0
   ```
2. **Your Bookings**: Are still `CONFIRMED`, not `COMPLETED`
3. **No capturedAmount**: Since jobs aren't completed, `capturedAmount` is `null` or `0`

### Solution:
The employer needs to **mark the jobs as complete**:
1. Go to Applicant Details page
2. Click "Mark as Complete" button
3. This triggers `completeApplicationPayment()` which:
   - Captures payment
   - Updates booking to `COMPLETED`
   - Sets `capturedAmount`
   - Creates Stripe Transfer

After completion, the booking will appear in receipts with the correct amount.

## UI Screens for Bookings

### 1. **Tracking Screen** (`/tracking`)
- Shows all bookings (CONFIRMED, IN_PROGRESS, COMPLETED)
- For service providers: Shows their bookings
- For employers: Shows bookings for their jobs
- **Access**: From home screen or menu

### 2. **Agenda Screen** (`/agenda`)
- Shows scheduled bookings
- Sorted by start time
- **Access**: From menu or calendar icon

### 3. **Receipts Screen** (`/payments/receipts`)
- Shows ONLY completed bookings with payments
- Filters: `capturedAmount > 0`
- Shows total earnings
- **Access**: From payments menu

### 4. **Payouts Screen** (`/payments/payouts`)
- Shows Stripe Connect account status
- Shows bank accounts
- Shows payout capability
- **Access**: From payments menu

## Balance Calculation

The balance shown in receipts is calculated from:
```typescript
const totalEarnings = receipts.reduce((sum, receipt) => {
  return sum + (receipt.capturedAmount || 0);
}, 0);
```

**Important**: 
- `capturedAmount` is in **cents** (minor currency units)
- Display converts to currency units: `amount / 100`
- Only `COMPLETED` bookings with `capturedAmount > 0` are included

## Stripe Transfer Flow

1. **Job Completed** → Payment captured from employer
2. **Transfer Created** → Funds moved to service provider's Stripe Connect account
3. **Stripe Processing** → Stripe processes transfer (usually instant)
4. **Bank Payout** → Stripe sends to bank account (within 24 hours)

The balance in the app shows what's been **captured** (step 2), not what's in the bank account (step 4).

## Summary

- **Bookings are created automatically** when applications are accepted
- **Bookings are updated automatically** when jobs are completed
- **No additional UI needed** - existing screens show bookings
- **Balance is 0.00** because jobs aren't completed yet
- **After completion**, balance will show the captured amount
- **Stripe handles** the actual bank transfer (within 24 hours)

