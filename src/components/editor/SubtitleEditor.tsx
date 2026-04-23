"use client";

import { SubtitleSegment } from "./SubtitleSegment";
import { useSubtitles } from "@/hooks/useSubtitles";
import { VideoPreview } from "./VideoPreview";
import { StylePicker } from "./StylePicker";
import { ExportPanel } from "./ExportPanel";

export function SubtitleEditor() {
  const { segments } = useSubtitles("demo");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <VideoPreview segments={segments} />
        <div className="space-y-3">
          {segments.map((segment) => (
            <SubtitleSegment key={segment.id} segment={segment} />
          ))}
        </div>
      </div>
      <StylePicker />
      <ExportPanel />
    </div>
  );
}
