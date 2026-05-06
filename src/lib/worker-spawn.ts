import { spawn, type SpawnOptions } from "node:child_process";
import path from "node:path";

type BuildWorkerSpawnCommandOptions = {
  cwd?: string;
  nodePath?: string;
};

type SpawnedWorkerProcess = {
  pid?: number;
  on(event: "error", listener: (error: Error) => void): unknown;
  unref(): void;
};

type SpawnWorker = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => SpawnedWorkerProcess;

type StartDetachedWorkerOptions = BuildWorkerSpawnCommandOptions & {
  env?: NodeJS.ProcessEnv;
  onError?: (error: Error) => void;
  spawnWorker?: SpawnWorker;
};

export type StartDetachedWorkerResult =
  | { ok: true; pid: number }
  | { ok: false; error: string };

export function buildWorkerSpawnCommand({
  cwd = process.cwd(),
  nodePath = process.execPath,
}: BuildWorkerSpawnCommandOptions = {}): { command: string; args: string[] } {
  return {
    command: nodePath,
    args: [
      path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs"),
      "--env-file=.env.local",
      path.join(cwd, "src", "workers", "videoProcessor.ts"),
    ],
  };
}

export function startDetachedWorker({
  cwd = process.cwd(),
  nodePath = process.execPath,
  env = process.env,
  onError,
  spawnWorker = spawn,
}: StartDetachedWorkerOptions = {}): StartDetachedWorkerResult {
  const { command, args } = buildWorkerSpawnCommand({ cwd, nodePath });
  const child = spawnWorker(command, args, {
    stdio: "ignore",
    env: { ...env },
    detached: true,
  });

  child.on("error", (error) => {
    onError?.(error);
  });

  if (typeof child.pid !== "number") {
    return { ok: false, error: "Worker process did not expose a PID" };
  }

  child.unref();
  return { ok: true, pid: child.pid };
}
