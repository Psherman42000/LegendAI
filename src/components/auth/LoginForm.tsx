"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogleAccountPicker } from "@/lib/google-auth-client";

export function LoginForm() {
  return (
    <Card className="mx-auto w-full max-w-md px-4 sm:px-0">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Use sua conta Google para acessar o Legendai.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          onClick={() => { void signInWithGoogleAccountPicker(); }}
        >
          Continuar com Google
        </Button>
      </CardContent>
    </Card>
  );
}
