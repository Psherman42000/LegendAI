import type { SubtitleSegment } from "@/types/subtitle";

export type SubtitleStyleId = keyof typeof SUBTITLE_STYLES;

export const SUBTITLE_STYLES = {
  classic: {
    id: "classic",
    name: "Clássico",
    preview: "/previews/classic.png",
    fontSize: 24,
    fontFamily: "Arial Bold",
    color: "#FFFFFF",
    backgroundColor: "transparent",
    shadowColor: "#000000",
    shadowBlur: 3,
    position: "bottom",
    padding: 8,
    ffmpegFilter:
      "subtitles=FILE:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=30'",
  },
  boxed: {
    id: "boxed",
    name: "Caixa",
    preview: "/previews/boxed.png",
    fontSize: 24,
    fontFamily: "Arial",
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.7)",
    shadowColor: "#000000",
    shadowBlur: 0,
    position: "bottom",
    padding: 10,
    ffmpegFilter:
      "subtitles=FILE:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF,BackColour=&H99000000,BorderStyle=4,Alignment=2,MarginV=30'",
  },
  highlighted: {
    id: "highlighted",
    name: "Destacado",
    preview: "/previews/highlighted.png",
    fontSize: 26,
    fontFamily: "Impact",
    color: "#FFFF00",
    backgroundColor: "transparent",
    shadowColor: "#000000",
    shadowBlur: 4,
    position: "bottom",
    padding: 8,
    ffmpegFilter:
      "subtitles=FILE:force_style='FontName=Impact,FontSize=22,PrimaryColour=&H00FFFF,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=30'",
  },
  minimal: {
    id: "minimal",
    name: "Minimalista",
    preview: "/previews/minimal.png",
    fontSize: 18,
    fontFamily: "Helvetica",
    color: "#FFFFFF",
    backgroundColor: "transparent",
    shadowColor: "transparent",
    shadowBlur: 0,
    position: "bottom",
    padding: 6,
    ffmpegFilter:
      "subtitles=FILE:force_style='FontName=Helvetica,FontSize=14,PrimaryColour=&HFFFFFF,Outline=0,Shadow=0,Alignment=2,MarginV=20'",
  },
  reels: {
    id: "reels",
    name: "Reels",
    preview: "/previews/reels.png",
    fontSize: 24,
    fontFamily: "Arial Black",
    color: "#FFFFFF",
    backgroundColor: "rgba(0,255,0,0.8)",
    shadowColor: "#000000",
    shadowBlur: 4,
    position: "top",
    padding: 10,
    ffmpegFilter:
      "subtitles=FILE:force_style='FontName=Arial Black,FontSize=20,PrimaryColour=&HFFFFFF,BackColour=&HCC00FF00,BorderStyle=4,Alignment=8,MarginV=40'",
  },
} as const;

/** Single formatting source for SRT generation — all SRT output must go through this function */
export function generateSRT(segments: SubtitleSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatTimestamp(segment.start, true);
      const end = formatTimestamp(segment.end, true);
      return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join("\n\n");
}

export function generateVTT(segments: SubtitleSegment[]): string {
  const body = segments
    .map((segment) => {
      const start = formatTimestamp(segment.start, false);
      const end = formatTimestamp(segment.end, false);
      return `${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join("\n\n");

  return `WEBVTT\n\n${body}`;
}

export async function applyStyleToFFmpeg(
  videoPath: string,
  srtPath: string,
  style: (typeof SUBTITLE_STYLES)[SubtitleStyleId],
  outputPath: string,
): Promise<string> {
  const overlayPath = `${videoPath}#${srtPath}`;
  void overlayPath;
  void style;
  return outputPath;
}

function formatTimestamp(seconds: number, useComma: boolean): string {
  const totalMilliseconds = Math.max(0, Math.floor(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const ms = totalMilliseconds % 1000;
  const separator = useComma ? "," : ".";

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
}
