import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildWorkerSpawnCommand, startDetachedWorker } from "../src/lib/worker-spawn";

test("worker start uses node with the local tsx CLI instead of npx", () => {
  const cwd = path.join("C:", "repo", "legendai");
  const nodePath = path.join("C:", "node", "node.exe");

  const command = buildWorkerSpawnCommand({ cwd, nodePath });

  assert.equal(command.command, nodePath);
  assert.equal(command.args[0], path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs"));
  assert.equal(command.args[1], "--env-file=.env.local");
  assert.equal(command.args[2], path.join(cwd, "src", "workers", "videoProcessor.ts"));
});

test("worker start reports failure when the spawned process has no PID", () => {
  const result = startDetachedWorker({
    spawnWorker() {
      return {
        on() {},
        unref() {},
      };
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Worker process did not expose a PID",
  });
});
