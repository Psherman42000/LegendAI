import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
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
  await prisma.video.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
