// Legacy export worker — kept as a stub for backward compatibility.
// The automatic pipeline handles exports; this file exists only to fail fast
// if someone attempts to start a standalone export process without Redis.

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to start export worker");
}

export { };
