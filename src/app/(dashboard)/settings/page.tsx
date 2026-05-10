"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <main className="px-4 py-6 md:px-6 md:py-8 lg:p-10">
        <div className="mx-auto max-w-2xl px-0 sm:px-0">
          <div className="h-8 w-48 animate-pulse rounded bg-white/5" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-white/5" />
          <div className="mt-8 space-y-4">
            <div className="h-32 animate-pulse rounded-xl bg-white/5" />
            <div className="h-32 animate-pulse rounded-xl bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  const user = session?.user;

  return (
    <main className="px-4 py-6 md:px-6 md:py-8 lg:p-10">
      <div className="mx-auto max-w-2xl px-0 sm:px-0">
        <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl text-[var(--text)]">Configurações</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Gerencie seu perfil, preferências e notificações.
        </p>

        {/* Profile Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Suas informações pessoais e de conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nome</label>
              <Input
                value={user?.name ?? ""}
                readOnly
                className="cursor-not-allowed opacity-60"
                aria-label="Nome do usuário"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">E-mail</label>
              <Input
                value={user?.email ?? ""}
                readOnly
                className="cursor-not-allowed opacity-60"
                aria-label="E-mail do usuário"
              />
            </div>
          </CardContent>
        </Card>

        {/* Theme Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>Personalize a aparência do aplicativo. (Em breve)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">Tema</p>
                <p className="text-xs text-[var(--text-secondary)]">Escuro / Claro</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" disabled className="pointer-events-none opacity-50">
                  Claro
                </Button>
                <Button variant="primary" disabled className="pointer-events-none opacity-50">
                  Escuro
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>Configure quais notificações você deseja receber. (Em breve)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">Legendas processadas</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Quando um vídeo terminar de ser processado
                </p>
              </div>
              <div className="h-5 w-10 rounded-full border border-white/10 bg-white/5" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">Novidades e atualizações</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Novos recursos e melhorias
                </p>
              </div>
              <div className="h-5 w-10 rounded-full border border-white/10 bg-white/5" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">E-mails promocionais</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Ofertas e conteúdos especiais
                </p>
              </div>
              <div className="h-5 w-10 rounded-full border border-white/10 bg-white/5" />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="mt-6 border-red-500/20">
          <CardHeader>
            <CardTitle>Zona de Perigo</CardTitle>
            <CardDescription>Ações irreversíveis relacionadas à sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled
              className="w-full min-h-[44px] pointer-events-none border-red-500/30 text-red-400 opacity-50 sm:w-auto"
            >
              Excluir conta
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
