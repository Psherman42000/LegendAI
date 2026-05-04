import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcularPrecoAvulso, AVULSO_PRICE_PER_SECOND } from "@/lib/plans";
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

  // ⚠️ MOCK ONLY - DO NOT USE IN PRODUCTION
  // Handling raw card data (number, CVV, expiry) is a PCI-DSS violation.
  // In production, tokenize card data client-side (e.g., via Stripe Elements)
  // and never send raw PAN to your server.

  // Server-side validation
  if (body.cardHolder && body.cardHolder.trim().length < 2) {
    return NextResponse.json(
      { ok: false, error: "Nome do titular inválido" },
      { status: 400 },
    );
  }
  if (body.cardExpiry && !/^\d{2}\/\d{2}$/.test(body.cardExpiry)) {
    return NextResponse.json(
      { ok: false, error: "Data de validade inválida (use MM/AA)" },
      { status: 400 },
    );
  }

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
      pricePerSecond: AVULSO_PRICE_PER_SECOND * 100,
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
