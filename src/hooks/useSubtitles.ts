"use client";

import { useCallback, useMemo, useState } from "react";
import { generateSRT, generateVTT } from "@/lib/subtitle-styles";
import type { SubtitleSegment } from "@/types/subtitle";

const INITIAL_SEGMENTS: SubtitleSegment[] = [
  { id: "1", start: 0, end: 2.5, text: "esse é o LegendaAI" },
  { id: "2", start: 2.5, end: 5, text: "feito para o português brasileiro" },
];

export function useSubtitles(_transcriptionId: string) {
  const [segments, setSegments] = useState<SubtitleSegment[]>(INITIAL_SEGMENTS);

  const updateSegment = useCallback((id: string, text: string) => {
    setSegments((current) => current.map((segment) => (segment.id === id ? { ...segment, text } : segment)));
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setSegments((current) => current.filter((segment) => segment.id !== id));
  }, []);

  const splitSegment = useCallback((id: string, splitAt: number) => {
    setSegments((current) => {
      const target = current.find((segment) => segment.id === id);
      if (!target || splitAt <= target.start || splitAt >= target.end) {
        return current;
      }

      const first: SubtitleSegment = { ...target, end: splitAt };
      const second: SubtitleSegment = {
        ...target,
        id: `${target.id}-b`,
        start: splitAt,
      };

      return current.flatMap((segment) => (segment.id === id ? [first, second] : [segment]));
    });
  }, []);

  const mergeSegments = useCallback((idA: string, idB: string) => {
    setSegments((current) => {
      const first = current.find((segment) => segment.id === idA);
      const second = current.find((segment) => segment.id === idB);
      if (!first || !second) {
        return current;
      }

      const merged: SubtitleSegment = {
        ...first,
        end: second.end,
        text: `${first.text} ${second.text}`.trim(),
      };

      return current
        .filter((segment) => segment.id !== idA && segment.id !== idB)
        .concat(merged);
    });
  }, []);

  return useMemo(() => ({
    segments,
    updateSegment,
    deleteSegment,
    splitSegment,
    mergeSegments,
    exportSRT: () => generateSRT(segments),
    exportVTT: () => generateVTT(segments),
  }), [deleteSegment, mergeSegments, segments, splitSegment, updateSegment]);
}
