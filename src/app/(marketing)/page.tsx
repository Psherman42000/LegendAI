import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { Comparison } from "@/components/marketing/Comparison";
import { Pricing } from "@/components/marketing/Pricing";
import { Testimonials } from "@/components/marketing/Testimonials";
import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="bg-[var(--bg)] text-[var(--text)]">
      <Hero />
      <Features />
      <Comparison />
      <Pricing />
      <Testimonials />
      <footer className="border-t border-white/5 px-6 py-10 text-sm text-[var(--text-secondary)] lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>Feito com 🇧🇷 para criadores brasileiros</p>
          <div className="flex gap-5">
            <Link href="#">Termos</Link>
            <Link href="#">Privacidade</Link>
            <Link href="#">Contato</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
