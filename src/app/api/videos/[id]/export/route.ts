import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSRT } from "@/lib/subtitle-styles";
import type { SubtitleSegment } from "@/types/subtitle";
import { Queue } from "bullmq";
import type { SubtitleStyleId } from "@/lib/subtitle-styles";

type Params = { params: Promise<{ id: string }> };

type ExportBody = {
  format: "SRT" | "VTT" | "VIDEO";
  styleId?: SubtitleStyleId;
};

function getExportQueue() {
  return new Queue("video-export", {
    connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as ExportBody;
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
    include: { transcription: true },
  });

  if (!video?.transcription) {
    return NextResponse.json({ ok: false, error: "Transcrição indisponível" }, { status: 404 });
  }

  const segments = Array.isArray(video.transcription.segments)
    ? (video.transcription.segments as SubtitleSegment[])
    : [];

  if (body.format === "SRT") {
    return NextResponse.json({
      ok: true,
      data: {
        content: generateSRT(segments),
        mimeType: "application/x-subrip",
      },
    });
  }

  if (body.format === "VTT") {
    const { generateVTT } = await import("@/lib/subtitle-styles");
    return NextResponse.json({
      ok: true,
      data: {
        content: generateVTT(segments),
        mimeType: "text/vtt",
      },
    });
  }

  if (body.format === "VIDEO") {
    const queue = getExportQueue();
    await queue.add(
      "export-video",
      { videoId: id, styleId: body.styleId ?? "classic" },
      {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await prisma.video.update({
      where: { id },
      data: { status: "QUEUED" },
    });

    return NextResponse.json({
      ok: true,
      data: {
        estimatedTimeMinutes: 5,
        message: "Exportação iniciada",
      },
    });
  }

  return NextResponse.json({ ok: false, error: "Formato inválido" }, { status: 400 });
}
