# Production Migration Guide

## Prerequisites

- [ ] MP sandbox flow tested and working
- [ ] Domain `legendai.online` configured and pointing to the app
- [ ] SSL certificate active on `legendai.online`
- [ ] PostgreSQL database running and accessible

## Step 1: Database Migration

Run the Prisma migration to add `SubscriptionStatus` enum and `status`/`cancelledAt` fields:

```bash
npx prisma migrate deploy
```

This applies the migration at `prisma/migrations/20260509120000_add_subscription_status/`.

## Step 2: MP Homologation

1. Go to [Mercado Pago Dashboard](https://www.mercadopago.com.br/developers/panel/app)
2. Submit your application for homologation
3. MP will verify:
   - Checkout flow works correctly
   - Webhook receives and processes notifications
   - Cancellation flow works
4. Wait for approval (usually 1-3 business days)

## Step 3: Create Sandbox Plans

```bash
# Make sure MP_ACCESS_TOKEN is set in .env (sandbox token starting with APP_USR)
npx tsx scripts/setup-mp-plans.ts create --env=sandbox
```

Copy the output IDs to `.env`:
```
MP_PLAN_STARTER_ID=<id-from-output>
MP_PLAN_PRO_ID=<id-from-output>
MP_PLAN_UNLIMITED_ID=<id-from-output>
```

Verify:
```bash
npx tsx scripts/setup-mp-plans.ts verify --env=sandbox
```

## Step 4: Test Sandbox Flow

1. Start the dev server: `npm run dev`
2. Log in as a test user
3. Click "Starter" plan on the billing page
4. Verify redirect to Mercado Pago sandbox checkout
5. Complete the sandbox payment
6. Verify redirect back to `/billing?checkout=success`
7. Use MP sandbox webhook simulator to send a `preapproval` notification
8. Verify subscription created in DB with `status: "ACTIVE"`

## Step 5: Production Credentials

1. After homologation approval, go to MP Dashboard → Credentials
2. Copy the **production** Access Token
3. Generate a webhook secret for HMAC validation

## Step 6: Create Production Plans

```bash
# Set production credentials in .env
MP_ACCESS_TOKEN=<production-token>

# Create production PreApprovalPlans
npx tsx scripts/setup-mp-plans.ts create --env=production

# Copy the output IDs to .env
MP_PLAN_STARTER_ID=<production-id>
MP_PLAN_PRO_ID=<production-id>
MP_PLAN_UNLIMITED_ID=<production-id>
```

Verify:
```bash
npx tsx scripts/setup-mp-plans.ts verify --env=production
```

## Step 7: Configure Webhook

1. In MP Dashboard → Webhooks, add:
   - URL: `https://legendai.online/api/billing/webhook/mercadopago`
   - Events: `preapproval`, `payment`
2. Set `MP_WEBHOOK_SECRET` in production env vars

## Step 8: Deploy

Set all production env vars:

```env
MP_ACCESS_TOKEN=<production-token>
MP_PLAN_STARTER_ID=<production-id>
MP_PLAN_PRO_ID=<production-id>
MP_PLAN_UNLIMITED_ID=<production-id>
MP_WEBHOOK_SECRET=<webhook-secret>
NEXT_PUBLIC_APP_URL=https://legendai.online
```

Run migration:
```bash
npx prisma migrate deploy
```

Deploy the application.

## Step 9: Verify Production

1. Test checkout flow with a real payment method
2. Verify webhook receives notifications
3. Verify subscription activates in DB
4. Test cancellation flow
5. Monitor logs for errors

## Rollback

If issues arise:
1. Switch `MP_ACCESS_TOKEN` back to sandbox credentials
2. Plans will redirect to sandbox checkout (safe fallback)
3. Fix issues in sandbox before re-deploying