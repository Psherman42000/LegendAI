# MP Production Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Mercado Pago integration from sandbox to production with updated pricing (R$10/R$25/R$50) and an automated setup script for creating PreApprovalPlans.

**Architecture:** Update plan prices in `plans.ts`, create a CLI script (`scripts/setup-mp-plans.ts`) that uses the MP SDK to create and verify PreApprovalPlans, run Prisma migration for the SubscriptionStatus enum, and document the full production migration flow.

**Tech Stack:** TypeScript, Node.js, Mercado Pago SDK (`mercadopago`), Prisma, tsx (for running TS scripts)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/plans.ts` | Modify | Update STARTER/PRO/UNLIMITED prices |
| `scripts/setup-mp-plans.ts` | Create | CLI script to create/verify MP PreApprovalPlans |
| `prisma/schema.prisma` | Already modified | SubscriptionStatus enum + status/cancelledAt fields (needs migration) |
| `docs/superpowers/specs/2026-05-09-mp-production-migration-design.md` | Already created | Design spec |

---

### Task 1: Update Plan Prices

**Files:**
- Modify: `src/lib/plans.ts`

- [ ] **Step 1: Update STARTER price from 2900 to 1000**

In `src/lib/plans.ts`, change the STARTER plan's `price` field:

```typescript
STARTER: {
    id: "STARTER",
    name: "Starter",
    price: 1000, // was 2900 (R$29.90 → R$10.00)
    // ... rest unchanged
```

- [ ] **Step 2: Update PRO price from 5900 to 2500**

In `src/lib/plans.ts`, change the PRO plan's `price` field:

```typescript
PRO: {
    id: "PRO",
    name: "Pro",
    price: 2500, // was 5900 (R$59.90 → R$25.00)
    // ... rest unchanged
```

- [ ] **Step 3: Update UNLIMITED price from 9900 to 5000**

In `src/lib/plans.ts`, change the UNLIMITED plan's `price` field:

```typescript
UNLIMITED: {
    id: "UNLIMITED",
    name: "Ilimitado",
    price: 5000, // was 9900 (R$99.90 → R$50.00)
    // ... rest unchanged
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to plans.ts

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat: update plan prices to R$10/R$25/R$50"
```

---

### Task 2: Create MP Setup Script

**Files:**
- Create: `scripts/setup-mp-plans.ts`

This script creates PreApprovalPlans via the Mercado Pago API and outputs the plan IDs for `.env` configuration. It also has a `verify` command to check existing plans.

- [ ] **Step 1: Create the setup script**

Create `scripts/setup-mp-plans.ts` with the following content:

```typescript
/**
 * MP PreApprovalPlan Setup Script
 * 
 * Usage:
 *   npx tsx scripts/setup-mp-plans.ts create --env=sandbox
 *   npx tsx scripts/setup-mp-plans.ts create --env=production
 *   npx tsx scripts/setup-mp-plans.ts verify --env=sandbox
 *   npx tsx scripts/setup-mp-plans.ts verify --env=production
 * 
 * Reads MP_ACCESS_TOKEN from .env (sandbox or production).
 * Creates PreApprovalPlans and outputs IDs for .env configuration.
 */

import { config } from "dotenv";
import { MercadoPagoConfig, PreApprovalPlan } from "mercadopago";

// Load env vars
config({ path: ".env.local" });
config({ path: ".env" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface PlanConfig {
  id: string;
  name: string;
  reason: string;
  priceInReais: number;
  envVar: string;
}

const PLAN_CONFIGS: PlanConfig[] = [
  {
    id: "STARTER",
    name: "Starter",
    reason: "LegendAI Starter — 30 vídeos por mês",
    priceInReais: 10.0,
    envVar: "MP_PLAN_STARTER_ID",
  },
  {
    id: "PRO",
    name: "Pro",
    reason: "LegendAI Pro — 100 vídeos por mês",
    priceInReais: 25.0,
    envVar: "MP_PLAN_PRO_ID",
  },
  {
    id: "UNLIMITED",
    name: "Ilimitado",
    reason: "LegendAI Ilimitado — vídeos ilimitados",
    priceInReais: 50.0,
    envVar: "MP_PLAN_UNLIMITED_ID",
  },
];

function getAccessToken(envMode: string): string {
  const token = process.env.MP_ACCESS_TOKEN ?? "";
  if (!token) {
    console.error("ERROR: MP_ACCESS_TOKEN not set in .env");
    process.exit(1);
  }

  // Validate that the token matches the expected environment
  if (envMode === "production" && token.startsWith("APP_USR")) {
    console.error("ERROR: MP_ACCESS_TOKEN starts with APP_USR (sandbox token) but --env=production was specified.");
    console.error("  Production tokens start with 'APP_USR-...' but are obtained after homologation.");
    console.error("  If you're sure this is your production token, remove this check.");
    process.exit(1);
  }

  if (envMode === "sandbox" && !token.startsWith("APP_USR")) {
    console.warn("WARNING: MP_ACCESS_TOKEN does not start with APP_USR. This may not be a sandbox token.");
  }

  return token;
}

async function createPlans(envMode: string): Promise<void> {
  const accessToken = getAccessToken(envMode);
  const mpConfig = new MercadoPagoConfig({ accessToken });
  const preApprovalPlanClient = new PreApprovalPlan(mpConfig);

  console.log(`\n🚀 Creating PreApprovalPlans in ${envMode.toUpperCase()} environment...\n`);

  const results: { planId: string; envVar: string; name: string }[] = [];

  for (const plan of PLAN_CONFIGS) {
    // Check if plan already exists for this env var
    const existingId = process.env[plan.envVar];
    if (existingId) {
      console.log(`⏭  ${plan.name}: ${plan.envVar} already set to "${existingId}" — skipping creation.`);
      console.log(`   To recreate, clear ${plan.envVar} from .env first.\n`);
      results.push({ planId: existingId, envVar: plan.envVar, name: plan.name });
      continue;
    }

    try {
      const response = await preApprovalPlanClient.create({
        body: {
          reason: plan.reason,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plan.priceInReais,
            currency_id: "BRL",
          },
          back_url: `${APP_URL}/billing`,
          // PreApprovalPlans are created in "active" status by default
        },
      });

      const planId = String(response.id);
      console.log(`✅ ${plan.name}: Created successfully!`);
      console.log(`   ID: ${planId}`);
      console.log(`   Price: R$${plan.priceInReais.toFixed(2)}/mês`);
      console.log(`   Add to .env: ${plan.envVar}=${planId}\n`);
      results.push({ planId, envVar: plan.envVar, name: plan.name });
    } catch (err) {
      console.error(`❌ ${plan.name}: Failed to create plan.`);
      console.error(`   Error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log("📋 Summary — Add these to your .env file:");
  console.log("─".repeat(50));
  for (const result of results) {
    console.log(`${result.envVar}=${result.planId}`);
  }
  console.log("─".repeat(50));
}

async function verifyPlans(envMode: string): Promise<void> {
  const accessToken = getAccessToken(envMode);
  const mpConfig = new MercadoPagoConfig({ accessToken });
  const preApprovalPlanClient = new PreApprovalPlan(mpConfig);

  console.log(`\n🔍 Verifying PreApprovalPlans in ${envMode.toUpperCase()} environment...\n`);

  let allValid = true;

  for (const plan of PLAN_CONFIGS) {
    const planId = process.env[plan.envVar];

    if (!planId) {
      console.error(`❌ ${plan.name}: ${plan.envVar} not set in .env`);
      allValid = false;
      continue;
    }

    try {
      const response = await preApprovalPlanClient.get({ id: planId });

      const mpReason = response.reason ?? "(unknown)";
      const mpAmount = response.auto_recurring?.transaction_amount;
      const mpFrequency = response.auto_recurring?.frequency;
      const mpFrequencyType = response.auto_recurring?.frequency_type;
      const mpStatus = response.status;

      const amountMatch = mpAmount === plan.priceInReais;
      const frequencyMatch = mpFrequency === 1 && mpFrequencyType === "months";

      if (amountMatch && frequencyMatch) {
        console.log(`✅ ${plan.name}: Valid`);
        console.log(`   ID: ${planId}`);
        console.log(`   Reason: ${mpReason}`);
        console.log(`   Price: R$${mpAmount}/mês`);
        console.log(`   Frequency: ${mpFrequency} ${mpFrequencyType}`);
        console.log(`   Status: ${mpStatus}\n`);
      } else {
        console.error(`⚠️  ${plan.name}: Plan exists but configuration mismatch!`);
        console.error(`   Expected: R$${plan.priceInReais.toFixed(2)}/month`);
        console.error(`   Actual: R$${mpAmount}/${mpFrequencyType}`);
        console.error(`   Status: ${mpStatus}\n`);
        allValid = false;
      }
    } catch (err) {
      console.error(`❌ ${plan.name}: Failed to verify plan ${planId}`);
      console.error(`   Error: ${err instanceof Error ? err.message : String(err)}\n`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log("🎉 All plans verified successfully!");
  } else {
    console.error("⚠️  Some plans have issues. Review the errors above.");
    process.exit(1);
  }
}

// CLI entry point
const args = process.argv.slice(2);
const command = args[0];
const envArg = args.find((a) => a.startsWith("--env="));
const envMode = envArg ? envArg.split("=")[1] : "sandbox";

if (!command || !["create", "verify"].includes(command)) {
  console.log("Usage: npx tsx scripts/setup-mp-plans.ts <create|verify> [--env=sandbox|production]");
  process.exit(1);
}

if (!["sandbox", "production"].includes(envMode)) {
  console.error("ERROR: --env must be 'sandbox' or 'production'");
  process.exit(1);
}

if (command === "create") {
  createPlans(envMode);
} else {
  verifyPlans(envMode);
}
```

- [ ] **Step 2: Install tsx as a dev dependency (if not already installed)**

Run: `npm install -D tsx`
Expected: tsx installed successfully

- [ ] **Step 3: Verify the script compiles**

Run: `npx tsx scripts/setup-mp-plans.ts --help` or `npx tsx scripts/setup-mp-plans.ts verify --env=sandbox`
Expected: Script runs without TypeScript errors (may fail on MP API calls if no token, but should parse args correctly)

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-mp-plans.ts package.json package-lock.json
git commit -m "feat: add MP PreApprovalPlan setup script"
```

---

### Task 3: Run Prisma Migration

The `SubscriptionStatus` enum and `status`/`cancelledAt` fields were added to the schema but migration hasn't been run yet.

- [ ] **Step 1: Create and apply the migration**

Run: `npx prisma migrate dev --name add_subscription_status`
Expected: Migration created and applied successfully

- [ ] **Step 2: Verify the migration was applied**

Run: `npx prisma migrate status`
Expected: All migrations applied, database schema is up to date

- [ ] **Step 3: Commit the migration file**

```bash
git add prisma/migrations/
git commit -m "feat: add SubscriptionStatus enum migration"
```

---

### Task 4: Test Sandbox Flow

This task verifies the full checkout → webhook → subscription activation flow works in sandbox.

- [ ] **Step 1: Create sandbox PreApprovalPlans**

Run: `npx tsx scripts/setup-mp-plans.ts create --env=sandbox`
Expected: 3 plan IDs created and printed. Copy them to `.env`:
```
MP_PLAN_STARTER_ID=<id-from-output>
MP_PLAN_PRO_ID=<id-from-output>
MP_PLAN_UNLIMITED_ID=<id-from-output>
```

- [ ] **Step 2: Verify sandbox plans**

Run: `npx tsx scripts/setup-mp-plans.ts verify --env=sandbox`
Expected: All 3 plans verified with correct prices and frequency

- [ ] **Step 3: Test checkout flow**

1. Start the dev server: `npm run dev`
2. Log in as a test user
3. Click "Starter" plan on the billing page
4. Verify redirect to Mercado Pago sandbox checkout
5. Complete the sandbox payment
6. Verify redirect back to `/billing?checkout=success`

- [ ] **Step 4: Test webhook flow**

1. Use the MP sandbox webhook simulator (or ngrok + manual POST)
2. Send a `preapproval` notification with `status: "authorized"`
3. Verify subscription created in DB with `status: "ACTIVE"`
4. Verify user plan updated to "STARTER"

- [ ] **Step 5: Test FREE plan activation**

1. Click "Grátis" plan on billing page
2. Verify subscription created immediately with `status: "ACTIVE"` and `plan: "FREE"`
3. No redirect to MP checkout

- [ ] **Step 6: Commit any fixes**

If any issues were found and fixed during testing, commit them:
```bash
git add -A
git commit -m "fix: address sandbox testing issues"
```

---

### Task 5: Production Migration Checklist

This is a documentation task — create a production migration checklist for the manual steps that can't be automated.

- [ ] **Step 1: Create production migration guide**

Create `docs/production-migration.md` with the following content:

```markdown
# Production Migration Guide

## Prerequisites

- [ ] MP sandbox flow tested and working
- [ ] Domain `legendai.online` configured and pointing to the app
- [ ] SSL certificate active on `legendai.online`

## Step 1: MP Homologation

1. Go to [Mercado Pago Dashboard](https://www.mercadopago.com.br/developers/panel/app)
2. Submit your application for homologation
3. MP will verify:
   - Checkout flow works correctly
   - Webhook receives and processes notifications
   - Cancellation flow works
4. Wait for approval (usually 1-3 business days)

## Step 2: Production Credentials

1. After homologation approval, go to MP Dashboard → Credentials
2. Copy the **production** Access Token (does NOT start with `APP_USR`)
3. Generate a webhook secret for HMAC validation

## Step 3: Create Production Plans

```bash
# Set production credentials in .env
MP_ACCESS_TOKEN=<production-token>

# Create production PreApprovalPlans
npx tsx scripts/setup-mp-plans.ts create --env=production

# Copy the output IDs to .env
MP_PLAN_STARTER_ID=<id>
MP_PLAN_PRO_ID=<id>
MP_PLAN_UNLIMITED_ID=<id>
```

## Step 4: Configure Webhook

1. In MP Dashboard → Webhooks, add:
   - URL: `https://legendai.online/api/billing/webhook/mercadopago`
   - Events: `preapproval`, `payment`
2. Set `MP_WEBHOOK_SECRET` in production env vars

## Step 5: Deploy

1. Set all production env vars:
   ```
   MP_ACCESS_TOKEN=<production-token>
   MP_PLAN_STARTER_ID=<production-id>
   MP_PLAN_PRO_ID=<production-id>
   MP_PLAN_UNLIMITED_ID=<production-id>
   MP_WEBHOOK_SECRET=<webhook-secret>
   NEXT_PUBLIC_APP_URL=https://legendai.online
   ```
2. Run Prisma migration: `npx prisma migrate deploy`
3. Deploy the application

## Step 6: Verify Production

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
```

- [ ] **Step 2: Commit the guide**

```bash
git add docs/production-migration.md
git commit -m "docs: add production migration guide"
```

---

### Task 6: Final Build Verification

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run production build**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final build verification"
```