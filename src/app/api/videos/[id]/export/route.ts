import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSRT, generateVTT } from "@/lib/subtitle-styles";
import type { SubtitleSegment } from "@/types/subtitle";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { format: "SRT" | "VTT" | "VIDEO" };
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
    return NextResponse.json({ ok: true, data: { content: generateSRT(segments), mimeType: "application/x-subrip" } });
  }

  if (body.format === "VTT") {
    return NextResponse.json({ ok: true, data: { content: generateVTT(segments), mimeType: "text/vtt" } });
  }

  if (body.format === "VIDEO") {
    return NextResponse.json(
      {
        ok: false,
        error: "Export manual desabilitado no fluxo automático. Aguarde status READY para baixar o MP4 final.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: false, error: "Formato inválido" }, { status: 400 });
}
