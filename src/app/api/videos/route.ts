import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueVideoJob } from "@/lib/queue";
import { PLANS } from "@/lib/plans";
import type { PaymentType } from "@/types/video";
import type { VideoStatus } from "@/types/video";

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

const demoVideos = [
  { id: "demo-1", title: "Corte de podcast", status: "READY", duration: 120 },
  { id: "demo-2", title: "Tutorial rápido", status: "PROCESSING", duration: 240 },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const videos = await prisma.video.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { transcription: true },
  }).catch(() => []);

  return NextResponse.json({
    ok: true,
    data: videos.length > 0 ? videos : demoVideos,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  // Allow unauthenticated video creation in development for testing
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV === "development") {
    userId = "dev-user";
  }
  
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as CreateVideoBody;
  if (!body.title || !body.originalUrl) {
    return NextResponse.json({ ok: false, error: "title e originalUrl são obrigatórios" }, { status: 400 });
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

  const video = await prisma.video.create({
    data: {
      userId: userId,
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

  await enqueueVideoJob({
    videoId: video.id,
    userId: userId,
    originalUrl: body.originalUrl,
    duration: body.duration ?? 0,
    useAiCorrection: body.useAiCorrection ?? false,
  }).catch(() => undefined);

  await prisma.video.update({
    where: { id: video.id },
    data: { jobId: `job-${video.id}` },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    data: {
      videoId: video.id,
      status: "QUEUED" satisfies VideoStatus,
    },
  });
}
