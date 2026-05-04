import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const getQueue = () => new Queue("video-processing", {
  connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
});

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
    const queue = getQueue();
    await queue.add("process-video", {
      videoId: video.id,
      userId: video.userId,
      originalUrl: video.originalUrl,
      duration: video.duration ?? 0,
      useAiCorrection: video.useAiCorrection,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    await prisma.video.update({
      where: { id: video.id },
      data: { status: "QUEUED", errorMessage: null },
    });

    return NextResponse.json({ ok: true, data: { videoId: video.id, status: "QUEUED" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao enfileirar vídeo" },
      { status: 500 }
    );
  }
}