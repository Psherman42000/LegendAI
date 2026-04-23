import { Input } from "@/components/ui/input";
import type { SubtitleSegment as SubtitleSegmentType } from "@/types/subtitle";

export function SubtitleSegment({
  segment,
  onJump,
}: {
  segment: SubtitleSegmentType;
  onJump?: (time: number) => void;
}) {
  return (
    <button
      type="button"
      className="surface-soft w-full rounded-xl p-4 text-left transition hover:border-[rgba(170,255,0,0.25)]"
      onClick={() => onJump?.(segment.start)}
    >
      <div className="text-xs text-[var(--text-secondary)]">
        {segment.start.toFixed(1)}s → {segment.end.toFixed(1)}s
      </div>
      <Input defaultValue={segment.text} className="mt-3" />
    </button>
  );
}
