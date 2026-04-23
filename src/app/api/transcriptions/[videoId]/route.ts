import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSRT, generateVTT } from "@/lib/subtitle-styles";
import type { SubtitleSegment } from "@/types/subtitle";

type Params = { params: Promise<{ videoId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { videoId } = await params;
  const video = await prisma.video.findFirst({
    where: { id: videoId, userId: session.user.id },
    include: { transcription: true },
  });
  const transcription = video?.transcription ?? null;
  return NextResponse.json({ ok: true, data: transcription });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { videoId } = await params;
  const video = await prisma.video.findFirst({
    where: { id: videoId, userId: session.user.id },
    include: { transcription: true },
  });
  if (!video?.transcription) {
    return NextResponse.json({ ok: false, error: "Transcrição não encontrada" }, { status: 404 });
  }
  const body = (await request.json()) as { segments: Prisma.InputJsonValue };
  const transcription = await prisma.transcription.update({
    where: { videoId },
    data: { segments: body.segments },
  });
  return NextResponse.json({ ok: true, data: transcription });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { videoId } = await params;
  const video = await prisma.video.findFirst({
    where: { id: videoId, userId: session.user.id },
  });
  if (!video) {
    return NextResponse.json({ ok: false, error: "Transcrição não encontrada" }, { status: 404 });
  }
  await prisma.transcription.delete({ where: { videoId } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function OPTIONS(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { videoId } = await params;
  const video = await prisma.video.findFirst({
    where: { id: videoId, userId: session.user.id },
    include: { transcription: true },
  });
  const segments = video?.transcription?.segments as SubtitleSegment[] | undefined;
  return NextResponse.json({
    ok: true,
    data: {
      srt: segments ? generateSRT(segments) : "",
      vtt: segments ? generateVTT(segments) : "",
    },
  });
}
