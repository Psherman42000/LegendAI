import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const now = new Date();
  const [usage, subscription] = await Promise.all([
    prisma.monthlyUsage.findUnique({
      where: {
        userId_year_month: {
          userId: session.user.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
    }),
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  const plan = subscription?.plan ?? "FREE";
  const videosUsed = usage?.videosCount ?? 0;
  const videosLimit = PLANS[plan as keyof typeof PLANS]?.videosPerMonth ?? PLANS.FREE.videosPerMonth;

  return NextResponse.json({
    ok: true,
    data: {
      plan,
      videosUsed,
      videosLimit,
      isAtLimit: videosUsed >= videosLimit,
      canUpload: videosUsed < videosLimit,
    },
  });
}
