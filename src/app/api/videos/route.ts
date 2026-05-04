import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueVideoJob, triggerWorker } from "@/lib/queue";
import { PLANS } from "@/lib/plans";
import { getSignedUrlFromAny } from "@/lib/r2";
import type { PaymentType } from "@/types/video";
import type { VideoStatus } from "@/types/video";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

type CreateVideoBody = {
  title: string;
  originalUrl: string;
  duration?: number;
  fileSize?: number;
  paymentType?: PaymentType;
  paymentId?: string;
  mimeType?: string;
  useAiCorrection?: boolean;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const search = searchParams.get("search")?.trim() || undefined;

  const where: Record<string, unknown> = { userId: session.user.id };
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  try {
    const [total, videos] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { transcription: true },
      }),
    ]);

    // Generate fresh signed URLs for READY/EXPORTED videos only
    const signedVideos = await Promise.all(
      videos.map(async (video) => {
        if (video.status === "READY" || video.status === "EXPORTED") {
          const [processedUrl, srtUrl, audioUrl, thumbnailUrl] = await Promise.all([
            getSignedUrlFromAny(video.processedUrl),
            getSignedUrlFromAny(video.srtUrl),
            getSignedUrlFromAny(video.audioUrl),
            getSignedUrlFromAny(video.thumbnailUrl),
          ]);
          return { ...video, processedUrl, srtUrl, audioUrl, thumbnailUrl };
        }
        return video;
      }),
    );

    return NextResponse.json({
      ok: true,
      data: signedVideos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[api/videos GET]", error);
    return NextResponse.json({
      ok: true,
      data: [],
      pagination: { total: 0, page: 1, limit, totalPages: 0 },
    });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  // Debug logging to trace session/user mismatch issues
  if (process.env.NODE_ENV === "development") {
    console.log("[api/videos POST] session:", session?.user
      ? { id: session.user.id, email: session.user.email }
      : "no session");
  }

  // Allow unauthenticated video creation in development for testing
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV === "development") {
    userId = "dev-user";
    console.log("[api/videos POST] using dev-user fallback");
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as CreateVideoBody;
  if (!body.title || !body.originalUrl) {
    return NextResponse.json({ ok: false, error: "title e originalUrl são obrigatórios" }, { status: 400 });
  }

  // Enforce 500MB limit if fileSize is present
  if (body.fileSize && body.fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { ok: false, error: "Arquivo muito grande. O limite é de 500MB." },
      { status: 413 },
    );
  }

  const paymentType = body.paymentType ?? "SUBSCRIPTION";
  if (paymentType === "SUBSCRIPTION") {
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    const plan = subscription?.plan ?? "FREE";
    const limit = PLANS[plan].videosPerMonth;
    const usage = await prisma.monthlyUsage.findUnique({
      where: {
        userId_year_month: {
          userId: userId,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        },
      },
    }).catch(() => null);

    if ((usage?.videosCount ?? 0) >= limit) {
      return NextResponse.json(
        { ok: false, error: "Limite mensal atingido" },
        { status: 402 },
      );
    }
  }

  if (paymentType === "AVULSO" && body.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: body.paymentId } });
    if (!payment || payment.status !== "PAID") {
      return NextResponse.json(
        { ok: false, error: "Pagamento avulso não confirmado" },
        { status: 402 },
      );
    }
  }

  // Create Video and increment/upsert MonthlyUsage in the same transaction
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const video = await prisma.$transaction(async (tx) => {
    const v = await tx.video.create({
      data: {
        userId,
        title: body.title,
        originalUrl: body.originalUrl,
        duration: body.duration ?? null,
        fileSize: body.fileSize ?? null,
        mimeType: body.mimeType ?? null,
        paymentType,
        paymentId: body.paymentId ?? null,
        useAiCorrection: body.useAiCorrection ?? false,
        status: "QUEUED",
      },
    });

    await tx.monthlyUsage.upsert({
      where: {
        userId_year_month: { userId, year, month },
      },
      update: {
        videosCount: { increment: 1 },
        secondsTotal: { increment: body.duration ?? 0 },
      },
      create: {
        userId,
        year,
        month,
        videosCount: 1,
        secondsTotal: body.duration ?? 0,
      },
    });

    return v;
  });

  await enqueueVideoJob({
    videoId: video.id,
    userId,
    originalUrl: body.originalUrl,
    duration: body.duration ?? 0,
    useAiCorrection: body.useAiCorrection ?? false,
  }).catch(() => undefined);

  await prisma.video.update({
    where: { id: video.id },
    data: { jobId: `job-${video.id}` },
  }).catch(() => undefined);

  // Best-effort trigger worker
  await triggerWorker().catch(() => undefined);

  return NextResponse.json({
    ok: true,
    data: {
      videoId: video.id,
      status: "QUEUED" satisfies VideoStatus,
    },
  });
}
