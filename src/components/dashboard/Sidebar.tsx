import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { UsageBar } from "./UsageBar";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/videos", label: "Meus Vídeos" },
  { href: "/billing", label: "Assinatura" },
  { href: "/settings", label: "Configurações" },
];

export function Sidebar() {
  return (
    <aside className="surface sticky top-0 flex h-screen w-full max-w-[280px] flex-col border-r border-white/5 p-6">
      <div>
        <div className="text-display text-2xl font-bold tracking-tight text-[var(--primary)]">LegendaAI</div>
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
        <UsageBar />
        <div className="surface-soft rounded-xl p-4">
          <div className="text-sm font-semibold">Dev User</div>
          <p className="text-xs text-[var(--text-secondary)]">dev@legendaai.com</p>
          <Badge className="mt-3">Pro</Badge>
        </div>
      </div>
    </aside>
  );
}
