"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre-se para gerar legendas automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input placeholder="Nome completo" />
        <Input type="email" placeholder="seu@email.com" />
        <Button className="w-full">Criar conta com Google</Button>
      </CardContent>
    </Card>
  );
}
