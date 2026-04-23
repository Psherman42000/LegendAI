import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { criarAssinatura } from "@/lib/mercadopago";
import type { PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { planId: PlanId };
  const result = await criarAssinatura({
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name ?? "Usuário",
    planId: body.planId,
    backUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing`,
  });

  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      plan: body.planId,
      mpSubscriptionId: result.subscriptionId,
    },
    update: {
      plan: body.planId,
      mpSubscriptionId: result.subscriptionId,
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, data: { initPoint: result.initPoint } });
}
