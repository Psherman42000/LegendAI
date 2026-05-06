import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildExtractAudioCommand } from "../src/lib/ffmpeg";

test("extract audio command cannot block on an existing WAV output", () => {
  const sourceVideo = path.join(process.cwd(), "tmp", "same-upload.mp4");

  const first = buildExtractAudioCommand(sourceVideo);
  const second = buildExtractAudioCommand(sourceVideo);

  assert.equal(first.args[0], "-y");
  assert.equal(first.args[1], "-nostdin");
  assert.equal(first.args.at(-1), first.audioPath);
  assert.equal(path.extname(first.audioPath), ".wav");
  assert.notEqual(first.audioPath, sourceVideo.replace(/\.[^.]+$/, ".wav"));
  assert.notEqual(first.audioPath, second.audioPath);
});
