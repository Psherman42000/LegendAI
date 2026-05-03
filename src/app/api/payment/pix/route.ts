import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcularPrecoAvulso, AVULSO_PRICE_PER_SECOND } from "@/lib/plans";
import type { PaymentMethod, PaymentType } from "@/types/video";

type Body = {
  durationSeconds: number;
  videoTitle?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const duration = Math.max(1, body.durationSeconds || 60);
  const pricing = calcularPrecoAvulso(duration);

  const pixKey = process.env.PIX_KEY || "mock-pix-key@email.com";

  const payment = await prisma.payment.create({
    data: {
      userId: session.user.id,
      type: "AVULSO" satisfies PaymentType,
      method: "PIX" satisfies PaymentMethod,
      amount: pricing.priceInCentavos,
      description: body.videoTitle || "Pagamento avulso",
      videoDuration: duration,
      pricePerSecond: AVULSO_PRICE_PER_SECOND * 100,
      status: "PENDING",
      pixQrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
      pixQrCodeText: `00020126580014BR.GOV.BCB.PIX0136+55${pixKey}5204000053039865406${pricing.priceInCentavos}5802BR5925${session.user.name || "Usuario"}6008BRASILIA62070503***6304ABCD`,
      pixExpiration: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      paymentId: payment.id,
      amount: pricing.priceInCentavos,
      amountFormatted: pricing.priceFormatted,
      method: "PIX",
      status: "PENDING",
      pixQrCode: payment.pixQrCode,
      pixQrCodeText: payment.pixQrCodeText,
      pixExpiration: payment.pixExpiration?.toISOString(),
    },
  });
}
