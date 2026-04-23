export async function uploadBufferToR2(
  buffer: Uint8Array,
  key: string,
  contentType = "application/octet-stream",
): Promise<string> {
  void buffer;
  void contentType;
  return `${process.env.R2_PUBLIC_URL ?? "https://r2.local"}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  void key;
}
