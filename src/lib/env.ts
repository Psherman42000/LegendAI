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
    const mpToken = getEnv("MP_ACCESS_TOKEN")!;

    // Log token diagnostic info at startup
    console.log(`[env] MP_ACCESS_TOKEN diagnostic:
  - prefix: ${mpToken.slice(0, 8)}...
  - length: ${mpToken.length}
  - starts with TEST-: ${mpToken.startsWith("TEST-")}
  - starts with APP_USR-: ${mpToken.startsWith("APP_USR-")}
  - NODE_ENV: ${process.env.NODE_ENV ?? "not set"}`);

    // Detect sandbox/test tokens in production — they cause "Both payer and collector must be real or test users"
    if (process.env.NODE_ENV === "production" && mpToken.startsWith("TEST-")) {
      errors.push(
        "MP_ACCESS_TOKEN is a sandbox token (starts with TEST-). " +
        "Real users cannot pay with sandbox credentials. " +
        "Replace with a production token from the Mercado Pago dashboard (Credenciales → Producción)."
      );
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