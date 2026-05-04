import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFromR2, extractR2Key } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
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
    include: { transcription: true, payment: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Vídeo não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: video });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { title?: string; subtitleStyle?: Prisma.InputJsonValue };
  const existing = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Vídeo não encontrado" }, { status: 404 });
  }

  await prisma.video.updateMany({
    where: { id, userId: session.user.id },
    data: {
      title: body.title,
      subtitleStyle: body.subtitleStyle,
    },
  });
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true, data: video });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch video to get associated R2 URLs before deletion
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Vídeo não encontrado" }, { status: 404 });
  }

  // Delete associated R2 objects (original/processed/srt/audio/thumbnail)
  const r2Fields = [
    video.originalUrl,
    video.processedUrl,
    video.srtUrl,
    video.audioUrl,
    video.thumbnailUrl,
  ];

  await Promise.allSettled(
    r2Fields.map(async (field) => {
      if (!field) return;
      try {
        const key = extractR2Key(field);
        // Only attempt R2 deletion for likely R2 keys (not external URLs)
        if (!key.startsWith("http://") && !key.startsWith("https://")) {
          await deleteFromR2(key);
        }
      } catch {
        // Silently ignore individual R2 deletion failures
      }
    }),
  );

  await prisma.video.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
