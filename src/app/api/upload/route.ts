import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isR2Configured, uploadBufferToR2, getPublicUrl, extractR2Key } from "@/lib/r2";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  // Allow unauthenticated uploads in development for testing
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV === "development") {
    userId = "dev-user";
  }
  
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const MAX_FILE_SIZE_MB = 500;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB` },
        { status: 413 },
      );
    }

    if (isR2Configured()) {
      // ---- R2 upload path ----
      const key = `uploads/${userId}/${Date.now()}-${file.name}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const rawUrl = await uploadBufferToR2(buffer, key, file.type || "application/octet-stream");
      const r2Key = extractR2Key(rawUrl);
      const presignedUrl = await getPublicUrl(r2Key, 24 * 60 * 60);
      return NextResponse.json({ ok: true, url: presignedUrl });
    }

    // ---- Disk-based fallback ----
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const url = `${baseUrl}/uploads/${fileName}`;
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro no upload" },
      { status: 500 },
    );
  }
}
