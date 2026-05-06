"use client";

import { signIn, signOut } from "next-auth/react";

type GoogleAuthClient = {
  signOut(options: { redirect: false }): Promise<unknown>;
  signIn(
    provider: "google",
    options: { callbackUrl: string },
    authorizationParams: { prompt: "select_account"; max_age: "0" },
  ): Promise<unknown>;
};

const nextAuthClient: GoogleAuthClient = { signIn, signOut };

export async function signInWithGoogleAccountPicker(
  callbackUrl = "/dashboard",
  authClient: GoogleAuthClient = nextAuthClient,
): Promise<unknown> {
  await authClient.signOut({ redirect: false });
  return authClient.signIn(
    "google",
    { callbackUrl },
    { prompt: "select_account", max_age: "0" },
  );
}
