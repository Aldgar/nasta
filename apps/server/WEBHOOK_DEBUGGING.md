# Stripe Webhook Debugging Guide

## How to Check if Webhooks are Working

### 1. Check Server Logs

After making a payment, check your server logs for these messages:

```
📥 Webhook received: payment_intent.succeeded (ID: evt_xxx)
💳 Processing payment_intent.succeeded: pi_xxx, amount: 45 eur, status: succeeded
✅ Found payment record xxx for payment intent pi_xxx
✅ Updated payment xxx to SUCCEEDED with amount 45 cents
✅ Webhook processed successfully: payment_intent.succeeded
```

### 2. Check Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Check the **Events** tab to see:
   - Which events were sent
   - Response codes (should be 200)
   - Response times
   - Any errors

### 3. Verify Webhook Endpoint URL

Your webhook endpoint should be:
- **Local/Development**: `http://localhost:3001/payments/webhook` (use ngrok or similar for testing)
- **Production**: `https://your-domain.com/payments/webhook`

**Important**: Stripe can only send webhooks to publicly accessible URLs. For local development:
- Use [ngrok](https://ngrok.com) or [localtunnel](https://localtunnel.github.io/www/)
- Update webhook URL in Stripe Dashboard to your ngrok URL

### 4. Check Webhook Secret

Ensure `STRIPE_WEBHOOK_SECRET` is set in your `.env` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

You can find this in Stripe Dashboard → Developers → Webhooks → Click your endpoint → **Signing secret**

### 5. Common Issues

#### Webhooks Not Being Received

**Symptoms**: Payments succeed in Stripe but database isn't updated

**Causes**:
- Webhook endpoint URL is incorrect or not accessible
- Server is not running or not accessible from internet
- Firewall blocking webhook requests
- Webhook secret mismatch

**Solutions**:
1. Verify webhook URL in Stripe Dashboard matches your server URL
2. Test webhook endpoint is accessible: `curl -X POST https://your-domain.com/payments/webhook`
3. Check server logs for webhook receipt messages
4. Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard

#### Webhook Signature Verification Failed

**Symptoms**: Error in logs: "Webhook signature verification failed"

**Solutions**:
1. Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
2. Verify the webhook secret matches the one in Stripe Dashboard
3. Check that the raw body is being passed correctly (middleware in main.ts)

#### Payment Succeeds but Database Not Updated

**Symptoms**: Payment shows as succeeded in Stripe but status is still CREATED in database

**Causes**:
- Webhook not received
- Webhook received but payment record not found
- Webhook processing failed silently

**Solutions**:
1. Check server logs for webhook events
2. Verify payment intent ID matches between Stripe and database
3. Check if payment record exists: `stripePaymentIntentId` should match Stripe payment intent ID

### 6. Manual Webhook Testing

You can manually trigger a webhook from Stripe Dashboard:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your endpoint
3. Click **Send test webhook**
4. Select event type: `payment_intent.succeeded`
5. Check server logs to see if it's received

### 7. Webhook Event Types Handled

The system handles these webhook events:
- `payment_intent.succeeded` - Payment completed successfully
- `payment_intent.payment_failed` - Payment failed
- `checkout.session.completed` - Checkout session completed
- `checkout.session.expired` - Checkout session expired

### 8. Debugging Steps

1. **Check if webhook is configured in Stripe**:
   - Stripe Dashboard → Developers → Webhooks
   - Verify endpoint URL is correct
   - Check events are enabled: `payment_intent.succeeded`

2. **Check server logs**:
   ```bash
   # Look for webhook-related logs
   grep -i "webhook\|payment_intent" server.log
   ```

3. **Test webhook endpoint manually**:
   ```bash
   # This should return an error (no signature), but confirms endpoint is accessible
   curl -X POST http://localhost:3001/payments/webhook \
     -H "Content-Type: application/json" \
     -d '{"type":"test"}'
   ```

4. **Check database**:
   ```sql
   -- Check if payments are being updated
   SELECT id, status, amount, "stripePaymentIntentId", "updatedAt" 
   FROM payments 
   ORDER BY "updatedAt" DESC 
   LIMIT 10;
   ```

### 9. Expected Behavior

**When payment succeeds**:
1. Stripe processes payment → `payment_intent.succeeded` event
2. Stripe sends webhook to your server
3. Server receives webhook → logs: `📥 Webhook received: payment_intent.succeeded`
4. Server finds payment record → logs: `✅ Found payment record`
5. Server updates database → logs: `✅ Updated payment to SUCCEEDED`
6. Database now shows payment as `SUCCEEDED`

**Timeline**: Usually happens within 1-5 seconds of payment completion

### 10. If Webhooks Still Don't Work

1. **Use Stripe CLI for local testing**:
   ```bash
   stripe listen --forward-to localhost:3001/payments/webhook
   ```

2. **Check network connectivity**:
   - Ensure your server is accessible from the internet
   - For local dev, use ngrok: `ngrok http 3001`

3. **Verify webhook secret**:
   - Get it from Stripe Dashboard → Webhooks → Your endpoint → Signing secret
   - Update `.env` file with correct secret

4. **Check for rate limiting**:
   - Stripe may throttle webhooks if too many fail
   - Check Stripe Dashboard for webhook delivery status

