import { ExportPanel } from "@/components/editor/ExportPanel";

export default function VideoExportPage() {
  return (
    <main className="space-y-6 px-4 py-6 md:px-6 md:py-8 lg:p-10">
      <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">Exportar vídeo</h1>
      <p className="text-sm text-[var(--text-secondary)]">Baixe SRT/VTT ou inicie o burn-in do vídeo.</p>
      <ExportPanel />
    </main>
  );
}
