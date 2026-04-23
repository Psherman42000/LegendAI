import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };
type Body = {
  step: "TRANSCRIBED" | "CORRECTED" | "EXPORTED" | "READY" | "ERROR";
  data?: {
    rawText?: string;
    correctedText?: string;
    audioUrl?: string;
    thumbnailUrl?: string;
    processedUrl?: string;
  };
};

function isWorkerAuthorized(request: Request): boolean {
  const secret = request.headers.get("x-worker-secret") ?? "";
  return secret === process.env.WORKER_SECRET;
}

export async function POST(request: Request, { params }: Params) {
  if (!isWorkerAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized worker" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as Body;

  const update: Prisma.VideoUpdateInput =
    body.step === "TRANSCRIBED"
      ? { status: "TRANSCRIBING" }
      : body.step === "CORRECTED"
        ? { status: "CORRECTING" }
        : body.step === "EXPORTED"
          ? { status: "EXPORTED" }
          : body.step === "READY"
            ? {
                status: "READY",
                processedAt: new Date(),
                audioUrl: body.data?.audioUrl,
                thumbnailUrl: body.data?.thumbnailUrl,
                processedUrl: body.data?.processedUrl,
              }
            : { status: "ERROR", errorMessage: "Processamento interrompido" };

  const video = await prisma.video.update({
    where: { id },
    data: update,
  });

  if (body.step === "TRANSCRIBED") {
    await prisma.transcription.upsert({
      where: { videoId: id },
      create: {
        videoId: id,
        rawText: body.data?.rawText ?? "",
        segments: [],
      },
      update: {
        rawText: body.data?.rawText ?? "",
      },
    });
  }

  if (body.step === "CORRECTED") {
    await prisma.transcription.update({
      where: { videoId: id },
      data: {
        correctedText: body.data?.correctedText ?? null,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, data: video });
}
