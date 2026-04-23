import { ExportPanel } from "@/components/editor/ExportPanel";

export default function VideoExportPage() {
  return (
    <main className="space-y-6 p-6 lg:p-10">
      <h1 className="text-display text-3xl font-bold">Exportar vídeo</h1>
      <p className="text-sm text-[var(--text-secondary)]">Baixe SRT/VTT ou inicie o burn-in do vídeo.</p>
      <ExportPanel />
    </main>
  );
}
