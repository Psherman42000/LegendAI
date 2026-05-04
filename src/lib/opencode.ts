let opencodeClient: any;

export async function getOpencodeClient() {
  if (!opencodeClient) {
    const { createOpencodeClient } = await import("@opencode-ai/sdk");
    opencodeClient = createOpencodeClient({
      baseUrl: process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096",
    });
  }
  return opencodeClient;
}
