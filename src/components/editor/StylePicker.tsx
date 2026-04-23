"use client";

import { SUBTITLE_STYLES } from "@/lib/subtitle-styles";
import { useEditorStore } from "@/store/editorStore";

export function StylePicker() {
  const selectedStyle = useEditorStore((state) => state.selectedStyle);
  const setSelectedStyle = useEditorStore((state) => state.setSelectedStyle);

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {Object.values(SUBTITLE_STYLES).map((style) => (
        <button
          key={style.id}
          type="button"
          className={`surface-soft rounded-2xl p-4 text-left transition ${selectedStyle === style.id ? "outline outline-2 outline-[var(--primary)]" : ""}`}
          onClick={() => setSelectedStyle(style.id)}
        >
          <div className="mb-6 aspect-video rounded-xl bg-gradient-to-br from-white/10 to-transparent" />
          <div className="font-semibold">{style.name}</div>
          <div className="text-xs text-[var(--text-secondary)]">{style.position}</div>
        </button>
      ))}
    </div>
  );
}
