import type { SubtitleSegment } from "@/types/subtitle";

export function parseSrt(input: string): SubtitleSegment[] {
  const blocks = input
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);

  return blocks.flatMap((block) => {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) {
      return [];
    }

    const timing = lines[1];
    const match = timing.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})/,
    );
    if (!match?.[1] || !match?.[2]) {
      return [];
    }

    return [
      {
        id: lines[0] ?? cryptoRandomId(),
        start: parseTimestamp(match[1]),
        end: parseTimestamp(match[2]),
        text: lines.slice(2).join(" "),
      },
    ];
  });
}

export function parseVtt(input: string): SubtitleSegment[] {
  const withoutHeader = input.replace(/^WEBVTT[\s\S]*?\n\n/, "").trim();
  return parseSrt(
    withoutHeader
      .split(/\n\n/)
      .map((chunk, index) => `${index + 1}\n${chunk}`)
      .join("\n\n"),
  );
}

function parseTimestamp(value: string): number {
  const [hours, minutes, rest] = value.split(":");
  const [seconds, milliseconds] = rest.replace(",", ".").split(".");
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(`0.${milliseconds ?? "0"}`)
  );
}

function cryptoRandomId(): string {
  return `seg_${Math.random().toString(36).slice(2, 10)}`;
}
