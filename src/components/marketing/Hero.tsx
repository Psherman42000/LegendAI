import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="hero-grid noise relative overflow-hidden border-b border-white/5">
      <div className="mx-auto grid min-h-[92svh] max-w-7xl items-center px-6 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="max-w-2xl">
          <div className="fade-up text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
            LegendaAI
          </div>
          <h1 className="fade-up delay-1 text-display mt-4 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Legendas em português BR. Sem erro. Sem dólar.
          </h1>
          <p className="fade-up delay-2 mt-6 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
            O CapCut ficou pago. As ferramentas gringas erram no sotaque. O LegendaAI entende como o brasileiro fala.
          </p>
          <div className="fade-up delay-3 mt-8 flex flex-wrap gap-3">
            <Link href="/register">
              <Button>Começar grátis</Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline">Ver demo</Button>
            </Link>
          </div>
          <p className="mt-8 text-sm text-[var(--text-secondary)]">
            Funciona com: Instagram · TikTok · YouTube · Kwai
          </p>
        </div>
        <div className="surface relative mt-12 overflow-hidden rounded-[24px] p-5 lg:mt-0">
          <div className="aspect-video rounded-[20px] border border-white/5 bg-[radial-gradient(circle_at_top,rgba(170,255,0,0.2),transparent_40%),linear-gradient(180deg,#111,#050505)] p-5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Upload</span>
              <span>Processando</span>
            </div>
            <div className="mt-6 h-40 rounded-2xl border border-white/5 bg-white/5" />
            <div className="mt-6 space-y-3 text-sm">
              <div className="w-fit rounded-full bg-black/70 px-4 py-2 text-white">eu tava pensando... né</div>
              <div className="ml-auto w-fit rounded-full bg-[var(--primary)] px-4 py-2 font-semibold text-black">
                agora ficou certinho
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
