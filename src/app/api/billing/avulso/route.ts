import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcularPrecoAvulso } from "@/lib/plans";
import { criarPagamentoAvulso } from "@/lib/mercadopago";
import type { PaymentMethod, PaymentType } from "@/types/video";

type Body = {
  durationSeconds: number;
  paymentMethod: PaymentMethod;
  videoTitle: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const pricing = calcularPrecoAvulso(body.durationSeconds);

  const payment = await prisma.payment.create({
    data: {
      userId: session.user.id,
      type: "AVULSO" satisfies PaymentType,
      method: body.paymentMethod,
      amount: pricing.priceInCentavos,
      description: body.videoTitle,
      videoDuration: body.durationSeconds,
      pricePerSecond: 150,
      status: "PENDING",
    },
  });

  const checkout = await criarPagamentoAvulso({
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name ?? "Usuário",
    paymentId: payment.id,
    durationSeconds: body.durationSeconds,
    method: body.paymentMethod === "PIX" ? "PIX" : "CARD",
    notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/billing/webhook/mercadopago`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      mpPaymentId: checkout.preferenceId,
      checkoutUrl: checkout.initPoint || null,
      pixQrCode: checkout.pixQrCode ?? null,
      pixQrCodeText: checkout.pixQrCodeText ?? null,
      pixExpiration: checkout.pixExpiration ? new Date(checkout.pixExpiration) : null,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    data: {
      paymentId: payment.id,
      amount: pricing.priceInCentavos,
      method: body.paymentMethod,
      ...checkout,
    },
  });
}
