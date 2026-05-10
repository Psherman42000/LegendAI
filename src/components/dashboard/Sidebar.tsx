"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UsageBar } from "./UsageBar";
import { usePlan } from "@/hooks/usePlan";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/videos", label: "Meus Vídeos" },
  { href: "/plans", label: "Planos" },
  { href: "/billing", label: "Assinatura" },
  { href: "/payment", label: "Pagamento Avulso" },
  { href: "/settings", label: "Configurações" },
];

export function Sidebar() {
  const { data: session } = useSession();
  const user = session?.user;
  const { videosUsed, videosLimit } = usePlan();

  return (
    <aside className="surface sticky top-0 hidden h-screen w-full max-w-[280px] flex-col border-r border-white/5 p-6 lg:flex">
      <div>
        <div className="text-display text-2xl font-bold tracking-tight text-[var(--primary)]">Legendai</div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Legenda automática em português brasileiro.</p>
      </div>
      <nav className="mt-8 flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-white/5 hover:text-[var(--primary)]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-5">
        <UsageBar used={videosUsed} limit={videosLimit} />
        <div className="surface-soft rounded-xl p-4">
          <div className="text-sm font-semibold">{user?.name ?? "Usuário"}</div>
          <p className="text-xs text-[var(--text-secondary)]">{user?.email ?? ""}</p>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
}
