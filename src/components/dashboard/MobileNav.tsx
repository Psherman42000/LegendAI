"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/videos", label: "Meus Vídeos" },
  { href: "/plans", label: "Planos" },
  { href: "/billing", label: "Assinatura" },
  { href: "/payment", label: "Pagamento Avulso" },
  { href: "/settings", label: "Configurações" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="shrink-0 lg:hidden size-10"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] bg-[var(--surface)] p-0">
        <SheetHeader className="border-b border-white/5 p-6 text-left">
          <SheetTitle className="text-display text-xl font-bold tracking-tight text-[var(--primary)]">
            Legendai
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-white/5 hover:text-[var(--primary)]",
                pathname === link.href
                  ? "bg-white/5 text-[var(--primary)]"
                  : "text-[var(--text)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
