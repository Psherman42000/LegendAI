/**
 * Validate critical environment variables at startup.
 * Logs warnings for missing optional vars and throws for missing required ones.
 */

export function getPublicUrl(): string {
  return process.env.PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ─── Required ───
  if (!getEnv("DATABASE_URL")) errors.push("DATABASE_URL is required");
  if (!getEnv("NEXTAUTH_SECRET")) errors.push("NEXTAUTH_SECRET is required");
  if (!getEnv("GOOGLE_CLIENT_ID")) errors.push("GOOGLE_CLIENT_ID is required");
  if (!getEnv("GOOGLE_CLIENT_SECRET")) errors.push("GOOGLE_CLIENT_SECRET is required");

  // ─── Public URL (for MP redirects/webhooks) ───
  if (!getEnv("PUBLIC_URL")) {
    warnings.push("PUBLIC_URL not set — MP redirects and webhook notifications may use localhost URLs");
  }

  // ─── Mercado Pago (optional but warn if missing) ───
  if (!getEnv("MP_ACCESS_TOKEN")) {
    warnings.push("MP_ACCESS_TOKEN not set — subscription checkout will fail");
  } else {
    // If MP is configured, plan IDs should also be set
    if (!getEnv("MP_PLAN_STARTER_ID")) {
      warnings.push("MP_PLAN_STARTER_ID not set — STARTER plan checkout will fail");
    }
    if (!getEnv("MP_PLAN_PRO_ID")) {
      warnings.push("MP_PLAN_PRO_ID not set — PRO plan checkout will fail");
    }
    if (!getEnv("MP_PLAN_UNLIMITED_ID")) {
      warnings.push("MP_PLAN_UNLIMITED_ID not set — UNLIMITED plan checkout will fail");
    }
    if (!getEnv("MP_WEBHOOK_SECRET")) {
      if (process.env.NODE_ENV === "production") {
        errors.push("MP_WEBHOOK_SECRET is required in production when MP is configured");
      } else {
        warnings.push("MP_WEBHOOK_SECRET not set — webhook HMAC validation disabled in development");
      }
    }
  }

  // ─── Log ───
  for (const warning of warnings) {
    console.warn(`[env] ⚠ ${warning}`);
  }
  for (const error of errors) {
    console.error(`[env] ✕ ${error}`);
  }

  if (errors.length > 0) {
    throw new Error(`Missing required environment variables:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}