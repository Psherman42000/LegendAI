import { createOpencodeClient } from "@opencode-ai/sdk";

export const opencodeClient = createOpencodeClient({
  baseUrl: process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096",
});
