import { PrismaClient, PaymentMethod, PaymentStatus, PaymentType, PlanType, VideoStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "dev@legendaai.com" },
    update: {},
    create: {
      email: "dev@legendaai.com",
      name: "Dev User",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan: PlanType.PRO,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      userId: user.id,
      plan: PlanType.PRO,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const videos = await Promise.all([
    prisma.video.create({
      data: {
        userId: user.id,
        title: "Vídeo pronto",
        originalUrl: "https://r2.example.com/videos/ready.mp4",
        duration: 120,
        fileSize: 10_000_000,
        status: VideoStatus.READY,
        paymentType: PaymentType.SUBSCRIPTION,
      },
    }),
    prisma.video.create({
      data: {
        userId: user.id,
        title: "Processando",
        originalUrl: "https://r2.example.com/videos/processing.mp4",
        duration: 240,
        fileSize: 18_000_000,
        status: VideoStatus.PROCESSING,
        paymentType: PaymentType.SUBSCRIPTION,
      },
    }),
    prisma.video.create({
      data: {
        userId: user.id,
        title: "Com erro",
        originalUrl: "https://r2.example.com/videos/error.mp4",
        duration: 90,
        fileSize: 8_000_000,
        status: VideoStatus.ERROR,
        errorMessage: "Falha simulada",
        paymentType: PaymentType.AVULSO,
      },
    }),
  ]);

  await prisma.transcription.upsert({
    where: { videoId: videos[0].id },
    update: {},
    create: {
      videoId: videos[0].id,
      rawText: "isso é uma transcrição de exemplo",
      correctedText: "isso é uma transcrição de exemplo",
      language: "pt",
      confidence: 0.98,
      segments: Array.from({ length: 20 }).map((_, index) => ({
        id: String(index + 1),
        start: index * 2,
        end: index * 2 + 1.6,
        text: `segmento ${index + 1} em português brasileiro`,
      })),
    },
  });

  await prisma.payment.create({
    data: {
      userId: user.id,
      type: PaymentType.AVULSO,
      method: PaymentMethod.PIX,
      status: PaymentStatus.PAID,
      amount: 900,
      currency: "BRL",
      description: "Compra avulsa seed",
      videoDuration: 600,
      pricePerSecond: 150,
      mpPaymentId: "seed-payment-id",
      mpStatus: "approved",
      paidAt: new Date(),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
