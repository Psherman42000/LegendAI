"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Use sua conta Google para acessar o LegendaAI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="email" placeholder="seu@email.com" />
        <Button className="w-full">Continuar com Google</Button>
      </CardContent>
    </Card>
  );
}
