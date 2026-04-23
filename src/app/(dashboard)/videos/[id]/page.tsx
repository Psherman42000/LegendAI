import { SubtitleEditor } from "@/components/editor/SubtitleEditor";

export default function VideoEditorPage() {
  return (
    <main className="space-y-6 p-6 lg:p-10">
      <header>
        <h1 className="text-display text-3xl font-bold">Editor de legendas</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Ajuste timing, estilo e exportação com preview em tempo real.
        </p>
      </header>
      <SubtitleEditor />
    </main>
  );
}
