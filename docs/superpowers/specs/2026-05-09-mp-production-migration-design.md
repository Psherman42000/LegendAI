# MP Production Migration Design

**Date**: 2026-05-09
**Status**: Approved

## Context

LegendAI's Mercado Pago integration is complete in code but running on sandbox credentials. We need to migrate to production with updated pricing and a reproducible setup process.

## Decisions

- **Prices**: R$10 / R$25 / R$50 (was R$29.90 / R$59.90 / R$99.90)
- **Video limits**: Keep current (30 / 100 / unlimited)
- **Domain**: `legendai.online`
- **MP account**: Sandbox only — need to create production app and homologate
- **Database**: Test data only — can reset if needed
- **Approach**: Automated setup script (Approach A)

## Price Changes

| Plan   | Price Before | Price After | Videos/mo | Max Duration |
|--------|-------------|-------------|-----------|--------------|
| FREE   | R$0         | R$0         | 5         | 5 min        |
| STARTER| R$29.90     | R$10.00     | 30        | 30 min       |
| PRO    | R$59.90     | R$25.00     | 100       | 2h           |
| UNLIMITED | R$99.90  | R$50.00     | unlimited | 4h          |

In `plans.ts`, `price` values change from centavos: 2900→1000, 5900→2500, 9900→5000.

## Setup Script: `scripts/setup-mp-plans.ts`

CLI script with two commands:

### `create` command
- Flag `--env=sandbox|production` to select MP credentials
- Creates 3 PreApprovalPlans via MP API with:
  - `reason`: Plan name (e.g., "LegendAI Starter")
  - `auto_recurring`: frequency=1, frequency_type=months, transaction_amount in BRL, currency_id=BRL
  - `back_url`: `https://legendai.online/billing`
- Outputs the 3 generated plan IDs for `.env` configuration
- Also configures webhook URL via MP API

### `verify` command
- Reads plan IDs from `.env`
- Queries each plan via MP API
- Validates price, frequency, status match expectations
- Reports any discrepancies

## Migration Flow

```
1. Run Prisma migrate (create SubscriptionStatus enum + fields)
2. Update plans.ts with new prices
3. Run script: setup-mp-plans create --env=sandbox
4. Copy sandbox plan IDs to .env
5. Test full flow in sandbox (checkout → webhook → subscription activation)
6. Submit app for homologation in MP dashboard
7. Obtain production credentials
8. Run script: setup-mp-plans create --env=production
9. Copy production plan IDs to .env
10. Configure webhook URL in MP dashboard (or via script)
11. Set MP_WEBHOOK_SECRET in production env
12. Deploy to legendai.online
```

## Webhook Configuration

- Production URL: `https://legendai.online/api/billing/webhook/mercadopago`
- `MP_WEBHOOK_SECRET` is required in production (enforced by `env.ts`)
- HMAC validation is mandatory in production, optional in development
- Webhook can be configured via MP dashboard or programmatically via the setup script

## MP Homologation

Mercado Pago requires homologation before production credentials are released:

1. Submit application in MP dashboard for review
2. MP verifies the payment flow (checkout, webhook, cancellation)
3. Upon approval, production credentials are released
4. The setup script helps by documenting and automating what MP will verify

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/plans.ts` | Update prices: 2900→1000, 5900→2500, 9900→5000 |
| `scripts/setup-mp-plans.ts` | **New** — CLI script to create/verify MP PreApprovalPlans |
| `.env.example` | Already has MP_PLAN_*_ID vars (no change needed) |
| `prisma/schema.prisma` | Already has SubscriptionStatus enum (needs migration) |

## Prisma Migration

The `SubscriptionStatus` enum and `status`/`cancelledAt` fields were added to the schema but migration hasn't been run yet. Since there's no production data to preserve:

```bash
npx prisma migrate dev --name add_subscription_status
```

## Risk Mitigation

- **Sandbox testing first**: Full flow tested before production switch
- **Script is idempotent**: Can re-run if plans need to be recreated
- **Verify command**: Catches misconfiguration before going live
- **HMAC validation**: Prevents webhook spoofing in production
- **No DB subscription until webhook confirms**: Prevents free-riding