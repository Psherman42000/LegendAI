import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSRT } from "@/lib/subtitle-styles";
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
  const segments = video?.transcription?.segments as SubtitleSegment[] | undefined;
  return NextResponse.json({
    ok: true,
    data: {
      content: segments ? generateSRT(segments) : "",
    },
  });
}
