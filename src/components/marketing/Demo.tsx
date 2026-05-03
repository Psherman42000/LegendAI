import { Button } from "@/components/ui/button";

export function Demo() {
  return (
    <section id="demo" className="border-b border-white/5 px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-7xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
          Demonstração
        </div>
        <h2 className="text-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Veja como funciona
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[var(--text-secondary)]">
          Assista ao vídeo abaixo para ver como o LegendaAI gera legendas precisas em português brasileiro em segundos.
        </p>
        <div className="surface mx-auto mt-10 max-w-4xl overflow-hidden rounded-[24px] p-5">
          <div className="aspect-video flex items-center justify-center rounded-[20px] border border-white/5 bg-[radial-gradient(circle_at_top,rgba(170,255,0,0.12),transparent_60%),linear-gradient(180deg,#111,#050505)]">
            <div className="flex size-20 items-center justify-center rounded-full bg-[var(--primary)]/20 backdrop-blur-sm">
              <svg
                className="ml-1 size-10 text-[var(--primary)]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <Button
            variant="outline"
            onClick={() => {
              const el = document.getElementById("demo");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            Assistir tutorial completo
          </Button>
        </div>
      </div>
    </section>
  );
}
