import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { criarAssinatura } from "@/lib/mercadopago";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { planId: PlanId };
  const planId = body.planId;
  const plan = PLANS[planId];

  if (!plan) {
    return NextResponse.json({ ok: false, error: "Plano inválido" }, { status: 400 });
  }

  // FREE plan: activate immediately, no MP checkout needed
  if (planId === "FREE") {
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        plan: "FREE",
        status: "ACTIVE",
      },
      update: {
        plan: "FREE",
        status: "ACTIVE",
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
    });

    return NextResponse.json({
      ok: true,
      data: { initPoint: `${process.env.PUBLIC_URL ?? "https://legendai.online"}/billing?checkout=success` },
    });
  }

  // Paid plan: redirect to Mercado Pago checkout
  // Do NOT create subscription in DB yet — webhook will handle that after payment confirmation
  try {
    const result = await criarAssinatura({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name ?? "Usuário",
      planId,
      backUrl: `${process.env.PUBLIC_URL ?? "https://legendai.online"}/billing`,
    });

    return NextResponse.json({ ok: true, data: { initPoint: result.initPoint } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar assinatura";
    console.error("[checkout] Error creating MP subscription:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}