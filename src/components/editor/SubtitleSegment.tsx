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
    <div className="surface-soft w-full rounded-xl p-4">
      <button
        type="button"
        onClick={() => onJump?.(segment.start)}
        className="w-full text-left min-h-[44px]"
        aria-label={`Jump to ${segment.start.toFixed(1)}s`}
      >
        <div className="text-xs text-[var(--text-secondary)]">
          {segment.start.toFixed(1)}s → {segment.end.toFixed(1)}s
        </div>
      </button>
      <Input defaultValue={segment.text} className="mt-3 w-full text-base" />
    </div>
  );
}
