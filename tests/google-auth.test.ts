import { test } from "node:test";
import assert from "node:assert/strict";

import { signInWithGoogleAccountPicker } from "../src/lib/google-auth-client";

test("Google sign-in clears the current session before opening the account picker", async () => {
  const calls: Array<[string, unknown[]]> = [];

  const result = await signInWithGoogleAccountPicker("/dashboard", {
    async signOut(...args: unknown[]) {
      calls.push(["signOut", args]);
    },
    async signIn(...args: unknown[]) {
      calls.push(["signIn", args]);
      return "redirected";
    },
  });

  assert.equal(result, "redirected");
  assert.deepEqual(calls, [
    ["signOut", [{ redirect: false }]],
    ["signIn", [
      "google",
      { callbackUrl: "/dashboard" },
      { prompt: "select_account", max_age: "0" },
    ]],
  ]);
});
