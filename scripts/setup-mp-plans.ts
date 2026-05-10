/**
 * Mercado Pago PreApprovalPlan setup script.
 *
 * Creates and verifies subscription plans (STARTER, PRO, UNLIMITED)
 * via the Mercado Pago API.
 *
 * Usage:
 *   npx tsx scripts/setup-mp-plans.ts create [--env=sandbox|production]
 *   npx tsx scripts/setup-mp-plans.ts verify [--env=sandbox|production]
 */

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { MercadoPagoConfig, PreApprovalPlan } from "mercadopago";

// ---------------------------------------------------------------------------
// Dotenv: load .env.local first (takes precedence), then .env
// ---------------------------------------------------------------------------
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface PlanConfig {
  key: string;
  reason: string;
  price: number;
  envVar: string;
}

const PLANS: PlanConfig[] = [
  {
    key: "STARTER",
    reason: "LegendAI Starter — 30 vídeos por mês",
    price: 10.0,
    envVar: "MP_PLAN_STARTER_ID",
  },
  {
    key: "PRO",
    reason: "LegendAI Pro — 100 vídeos por mês",
    price: 25.0,
    envVar: "MP_PLAN_PRO_ID",
  },
  {
    key: "UNLIMITED",
    reason: "LegendAI Ilimitado — vídeos ilimitados",
    price: 50.0,
    envVar: "MP_PLAN_UNLIMITED_ID",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvMode(): "sandbox" | "production" {
  const arg = process.argv.find((a) => a.startsWith("--env="));
  if (!arg) return "sandbox";
  const value = arg.split("=")[1];
  if (value !== "sandbox" && value !== "production") {
    console.error(`Invalid --env value "${value}". Use "sandbox" or "production".`);
    process.exit(1);
  }
  return value;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Create command
// ---------------------------------------------------------------------------

async function handleCreate(): Promise<void> {
  const mode = getEnvMode();
  const token = process.env.MP_ACCESS_TOKEN;

  if (!token) {
    console.error("❌ MP_ACCESS_TOKEN is not set in environment.");
    process.exit(1);
  }

  // Validate token prefix against environment
  const trimmed = token.trim();
  if (mode === "sandbox" && !trimmed.startsWith("APP_USR")) {
    console.warn("⚠️  WARNING: MP_ACCESS_TOKEN does not start with APP_USR. Sandbox tokens usually start with APP_USR.");
  }
  if (mode === "production" && trimmed.startsWith("APP_USR")) {
    console.warn("⚠️  WARNING: MP_ACCESS_TOKEN starts with APP_USR, which looks like a sandbox token. Production tokens usually start with a different prefix.");
  }

  const appUrl = getAppUrl();
  const backUrl = `${appUrl}/billing`;

  const mpClient = new MercadoPagoConfig({
    accessToken: trimmed,
    options: { testToken: mode === "sandbox" },
  });

  const planClient = new PreApprovalPlan(mpClient);

  const createdIds: Array<{ key: string; id: string; envVar: string }> = [];

  for (const plan of PLANS) {
    const existingId = process.env[plan.envVar];

    if (existingId && existingId.trim().length > 0) {
      console.log(`⏭️  ${plan.key} (${plan.envVar}) already set, skipping`);
      continue;
    }

    console.log(`🔨 Creating ${plan.key} plan…`);

    try {
      const response = await planClient.create({
        body: {
          reason: plan.reason,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plan.price,
            currency_id: "BRL",
          },
          back_url: backUrl,
        },
      });

      const planId = response.id ?? "";
      console.log(`  ✅ Created: ${plan.reason}`);
      console.log(`     ID: ${planId}`);
      console.log(`     Add to .env: ${plan.envVar}=${planId}`);

      createdIds.push({ key: plan.key, id: planId, envVar: plan.envVar });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed to create ${plan.key}: ${message}`);
    }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  📋 CREATION SUMMARY");
  console.log("═══════════════════════════════════════════");

  if (createdIds.length === 0) {
    console.log("  No plans were created (all were already set or errors occurred).");
  } else {
    for (const item of createdIds) {
      console.log(`  ${item.envVar}=${item.id}`);
    }
    console.log("\n  Add the lines above to your .env file.");
  }

  console.log("═══════════════════════════════════════════\n");
}

// ---------------------------------------------------------------------------
// Verify command
// ---------------------------------------------------------------------------

interface VerifyResult {
  key: string;
  envVar: string;
  ok: boolean;
  issues: string[];
}

async function handleVerify(): Promise<void> {
  const mode = getEnvMode();
  const token = process.env.MP_ACCESS_TOKEN;

  if (!token) {
    console.error("❌ MP_ACCESS_TOKEN is not set in environment.");
    process.exit(1);
  }

  const mpClient = new MercadoPagoConfig({
    accessToken: token.trim(),
    options: { testToken: mode === "sandbox" },
  });

  const planClient = new PreApprovalPlan(mpClient);

  const results: VerifyResult[] = [];

  for (const plan of PLANS) {
    const planId = process.env[plan.envVar];

    if (!planId || planId.trim().length === 0) {
      results.push({
        key: plan.key,
        envVar: plan.envVar,
        ok: false,
        issues: [`${plan.envVar} is empty or not set`],
      });
      continue;
    }

    const trimmedId = planId.trim();

    try {
      const response = await planClient.get({ preApprovalPlanId: trimmedId });

      const issues: string[] = [];

      // Validate transaction_amount
      if (response.auto_recurring?.transaction_amount !== plan.price) {
        issues.push(
          `transaction_amount: expected ${plan.price}, got ${response.auto_recurring?.transaction_amount}`
        );
      }

      // Validate frequency
      if (response.auto_recurring?.frequency !== 1) {
        issues.push(
          `frequency: expected 1, got ${response.auto_recurring?.frequency}`
        );
      }

      // Validate frequency_type
      if (response.auto_recurring?.frequency_type !== "months") {
        issues.push(
          `frequency_type: expected "months", got "${response.auto_recurring?.frequency_type}"`
        );
      }

      results.push({
        key: plan.key,
        envVar: plan.envVar,
        ok: issues.length === 0,
        issues,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        key: plan.key,
        envVar: plan.envVar,
        ok: false,
        issues: [`API error: ${message}`],
      });
    }
  }

  // Report
  console.log("\n═══════════════════════════════════════════");
  console.log("  🔍 VERIFICATION RESULTS");
  console.log("═══════════════════════════════════════════");

  let allOk = true;

  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    console.log(`  ${icon} ${r.key} (${r.envVar})`);

    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        console.log(`     • ${issue}`);
      }
      allOk = false;
    }
  }

  console.log("═══════════════════════════════════════════\n");

  if (!allOk) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command) {
    console.error("Usage:");
    console.error("  npx tsx scripts/setup-mp-plans.ts create [--env=sandbox|production]");
    console.error("  npx tsx scripts/setup-mp-plans.ts verify [--env=sandbox|production]");
    process.exit(1);
  }

  switch (command) {
    case "create":
      await handleCreate();
      break;
    case "verify":
      await handleVerify();
      break;
    default:
      console.error(`Unknown command: "${command}". Use "create" or "verify".`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[setup-mp-plans] Fatal error: ${message}`);
  process.exit(1);
});
