import { test } from "node:test";
import assert from "node:assert/strict";

import { splitSegmentsByWords } from "../src/lib/segment-splitter";

test("word-level splitting preserves corrected segment text when words came from raw transcription", () => {
  const segments = [
    {
      start: 0,
      end: 3,
      text: "Mandando carniça de tarefa.",
      words: [
        { word: "Mandando", start: 0, end: 0.6 },
        { word: "carnissa", start: 0.6, end: 1.4 },
        { word: "de", start: 1.4, end: 1.8 },
        { word: "tarefa", start: 1.8, end: 2.5 },
      ],
    },
  ];

  const result = splitSegmentsByWords(segments, { speed: "normal" });

  assert.equal(result.map((segment) => segment.text).join(" "), "Mandando carniça de tarefa.");
});

test("word-level splitting falls back to corrected text when correction changes word count", () => {
  const segments = [
    {
      start: 0,
      end: 4,
      text: "O editor digitou e mandou os dados.",
      words: [
        { word: "menino", start: 0, end: 0.5 },
        { word: "de", start: 0.5, end: 0.8 },
        { word: "jitou", start: 0.8, end: 1.4 },
        { word: "e", start: 1.4, end: 1.6 },
        { word: "mandou", start: 1.6, end: 2.2 },
        { word: "de", start: 2.2, end: 2.4 },
        { word: "jitados", start: 2.4, end: 3.2 },
      ],
    },
  ];

  const result = splitSegmentsByWords(segments, { speed: "normal" });

  assert.equal(result.map((segment) => segment.text).join(" "), "O editor digitou e mandou os dados.");
});
