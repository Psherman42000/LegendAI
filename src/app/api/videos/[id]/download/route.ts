import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedUrlFromAny } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
    include: { transcription: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Vídeo não encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(_request.url);
  const type = searchParams.get("type") ?? "video";

  if (type === "srt") {
    const rawSegments = Array.isArray(video.transcription?.segments)
      ? (video.transcription.segments as Array<{ id?: string; start: number; end: number; text: string }>)
      : [];

    if (rawSegments.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhuma legenda disponível" }, { status: 404 });
    }

    const segments = rawSegments.map((s, i) => ({
      id: s.id ?? `segment-${i}`,
      start: s.start,
      end: s.end,
      text: s.text,
    }));

    const { generateSRT } = await import("@/lib/subtitle-styles");
    const srt = generateSRT(segments);
    return new NextResponse(srt, {
      headers: {
        "Content-Type": "application/x-subrip",
        "Content-Disposition": `attachment; filename="${video.title || "legenda"}.srt"`,
      },
    });
  }

  if (!video.processedUrl) {
    return NextResponse.json({ ok: false, error: "Vídeo processado indisponível" }, { status: 404 });
  }

  // Generate a signed URL with Content-Disposition: attachment so the browser
  // triggers a download instead of playing the video inline.
  const safeTitle = (video.title || "video").replace(/[^a-zA-Z0-9_\-\u00C0-\u00FF ]/g, "_");
  const signedUrl = await getSignedUrlFromAny(video.processedUrl, {
    contentDisposition: `attachment; filename="${safeTitle}.mp4"`,
  });

  if (!signedUrl) {
    return NextResponse.json({ ok: false, error: "Erro ao gerar URL de download" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}
