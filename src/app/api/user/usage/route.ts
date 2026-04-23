import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const now = new Date();
  const usage = await prisma.monthlyUsage.findUnique({
    where: {
      userId_year_month: {
        userId: session.user.id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
    },
  });

  return NextResponse.json({ ok: true, data: usage });
}
