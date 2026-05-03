import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcularPrecoAvulso } from "@/lib/plans";
import type { PaymentMethod, PaymentType } from "@/types/video";

type Body = {
  durationSeconds: number;
  videoTitle?: string;
  cardNumber?: string;
  cardHolder?: string;
  cardExpiry?: string;
  cardCvv?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const duration = Math.max(1, body.durationSeconds || 60);
  const pricing = calcularPrecoAvulso(duration);

  // Mock validation — in production this would call a payment gateway
  if (body.cardNumber && body.cardNumber.replace(/\s/g, "").length < 16) {
    return NextResponse.json(
      { ok: false, error: "Número de cartão inválido" },
      { status: 400 },
    );
  }

  // Simulate payment processing delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const payment = await prisma.payment.create({
    data: {
      userId: session.user.id,
      type: "AVULSO" satisfies PaymentType,
      method: "CARD" satisfies PaymentMethod,
      amount: pricing.priceInCentavos,
      description: body.videoTitle || "Pagamento avulso",
      videoDuration: duration,
      pricePerSecond: 150,
      status: "PAID",
      paidAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      paymentId: payment.id,
      amount: pricing.priceInCentavos,
      amountFormatted: pricing.priceFormatted,
      method: "CARD",
      status: "PAID",
      paidAt: payment.paidAt?.toISOString(),
      message: "Pagamento confirmado com sucesso!",
    },
  });
}
