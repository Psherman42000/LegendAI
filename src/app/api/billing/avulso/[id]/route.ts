import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const payment = await prisma.payment.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!payment) {
    return NextResponse.json({ ok: false, error: "Pagamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: payment,
  });
}
