import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="hero-grid noise relative overflow-hidden border-b border-white/5">
      <div className="mx-auto grid min-h-[92svh] max-w-7xl items-center px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-14">
        <div className="max-w-2xl">
          <div className="fade-up text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
            Legendai
          </div>
          <h1 className="fade-up delay-1 text-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Legendas em português BR. Sem erro. Sem dólar.
          </h1>
          <p className="fade-up delay-2 mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:mt-6">
            O CapCut ficou pago. As ferramentas gringas erram no sotaque. O Legendai entende como o brasileiro fala.
          </p>
          <div className="fade-up delay-3 mt-6 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/register">
              <Button className="min-h-[44px]">Começar grátis</Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" className="min-h-[44px]">Ver demo</Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-[var(--text-secondary)] sm:mt-8">
            Funciona com: Instagram · TikTok · YouTube · Kwai
          </p>
        </div>
        <div className="surface relative mt-8 overflow-hidden rounded-[24px] p-4 sm:p-5 lg:mt-0">
          <div className="aspect-video rounded-[20px] border border-white/5 bg-[radial-gradient(circle_at_top,rgba(170,255,0,0.2),transparent_40%),linear-gradient(180deg,#111,#050505)] p-3 sm:p-5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Upload</span>
              <span>Processando</span>
            </div>
            <div className="mt-4 h-24 rounded-2xl border border-white/5 bg-white/5 sm:mt-6 sm:h-40" />
            <div className="mt-4 space-y-2 text-sm sm:mt-6 sm:space-y-3">
              <div className="w-fit rounded-full bg-black/70 px-3 py-1.5 text-white sm:px-4 sm:py-2">eu tava pensando... né</div>
              <div className="ml-auto w-fit rounded-full bg-[var(--primary)] px-3 py-1.5 font-semibold text-black sm:px-4 sm:py-2">
                agora ficou certinho
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
