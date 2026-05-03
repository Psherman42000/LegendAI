import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { planId: PlanId };
  const plan = PLANS[body.planId];

  if (!plan) {
    return NextResponse.json({ ok: false, error: "Plano inválido" }, { status: 400 });
  }

  // Mock MercadoPago checkout — retorna uma URL simulada
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const mockInitPoint = `${baseUrl}/billing?checkout=mock&plan=${body.planId}`;
  const mockSubscriptionId = `mock-sub-${session.user.id}-${body.planId}-${Date.now()}`;

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      plan: body.planId,
      mpSubscriptionId: mockSubscriptionId,
    },
    update: {
      plan: body.planId,
      mpSubscriptionId: mockSubscriptionId,
    },
  });

  return NextResponse.json({
    ok: true,
    data: { initPoint: mockInitPoint },
  });
}


