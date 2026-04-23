"use client";

import type { SubtitleSegment } from "@/types/subtitle";

export function VideoPreview({ segments }: { segments: SubtitleSegment[] }) {
  return (
    <div className="surface relative overflow-hidden rounded-[var(--radius)]">
      <div className="aspect-video bg-gradient-to-br from-white/10 via-white/5 to-transparent">
        <div className="absolute inset-0 flex items-end justify-center p-6">
          <div className="rounded-xl bg-black/65 px-4 py-3 text-center text-xl font-bold text-white shadow-lg">
            {segments[0]?.text ?? "Legenda em tempo real"}
          </div>
        </div>
      </div>
    </div>
  );
}
