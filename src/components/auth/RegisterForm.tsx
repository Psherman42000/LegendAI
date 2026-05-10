"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogleAccountPicker } from "@/lib/google-auth-client";

export function RegisterForm() {
  return (
    <Card className="mx-auto w-full max-w-md px-4 sm:px-0">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre-se para gerar legendas automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          onClick={() => { void signInWithGoogleAccountPicker(); }}
        >
          Criar conta com Google
        </Button>
      </CardContent>
    </Card>
  );
}
