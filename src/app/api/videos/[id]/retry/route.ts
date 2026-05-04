import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueVideoJob, triggerWorker } from "@/lib/queue";
import { getSignedUrlFromAny } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV === "development") {
    userId = "dev-user";
  }
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: { id, userId },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Vídeo não encontrado" }, { status: 404 });
  }

  try {
    // Get a fresh signed URL for the video source
    const originalUrl = await getSignedUrlFromAny(video.originalUrl);
    if (!originalUrl) {
      return NextResponse.json(
        { ok: false, error: "URL do vídeo não disponível" },
        { status: 400 },
      );
    }

    // Enqueue the retry job with the fresh signed URL
    await enqueueVideoJob({
      videoId: video.id,
      userId: video.userId,
      originalUrl,
      duration: video.duration ?? 0,
      useAiCorrection: video.useAiCorrection ?? false,
    });

    // Reset status and clear error
    await prisma.video.update({
      where: { id: video.id },
      data: { status: "QUEUED", errorMessage: null },
    });

    // Best-effort trigger worker
    await triggerWorker().catch(() => undefined);

    return NextResponse.json({ ok: true, data: { videoId: video.id, status: "QUEUED" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao enfileirar vídeo" },
      { status: 500 },
    );
  }
}
