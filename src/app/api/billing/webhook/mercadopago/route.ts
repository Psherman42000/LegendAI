import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendLimitReachedEmail, sendWebhookNotification } from "@/lib/email";

function validarAssinaturaMP(request: Request, rawBody: string): boolean {
  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? "";

  const parts = xSignature.split(",");
  const ts = parts.find((part) => part.startsWith("ts="))?.split("=")[1];
  const v1 = parts.find((part) => part.startsWith("v1="))?.split("=")[1];
  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto
    .createHmac("sha256", process.env.MP_WEBHOOK_SECRET ?? "")
    .update(manifest)
    .digest("hex");

  return hmac === v1;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validarAssinaturaMP(request, rawBody)) {
    return NextResponse.json({ ok: false, error: "Assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    type?: string;
    topic?: string;
    data?: { id?: string };
    action?: string;
  };

  const topic = payload.topic ?? payload.type ?? "";
  const notificationId = payload.data?.id;

  // Idempotency: notificationId is required
  if (!notificationId) {
    return NextResponse.json(
      { ok: false, error: "payload.data.id is required for idempotency" },
      { status: 400 },
    );
  }

  // Create WebhookLog to deduplicate; if unique constraint collides, treat as duplicate success
  try {
    await prisma.webhookLog.create({
      data: {
        provider: "mercadopago",
        topic,
        notificationId,
        payload: payload as object,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  if (topic === "payment") {
    const paymentId = payload.data?.id ?? "";
    const payment = await prisma.payment.findFirst({ where: { mpPaymentId: paymentId } });
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          mpStatus: "approved",
          paidAt: new Date(),
        },
      });
      await sendWebhookNotification(`Pagamento avulso ${payment.id} aprovado.`);
    }
  }

  if (topic === "preapproval") {
    const subscriptionId = payload.data?.id ?? "";
    const subscription = await prisma.subscription.findFirst({ where: { mpSubscriptionId: subscriptionId } });
    if (subscription) {
      const user = await prisma.user.findUnique({ where: { id: subscription.userId } });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      if (user?.email) {
        await sendWebhookNotification(`Assinatura ${subscription.id} autorizada para ${user.email}.`);
      }
    }
  }

  if (topic === "subscription_authorized_payment") {
    const subscriptionId = payload.data?.id ?? "";
    const subscription = await prisma.subscription.findFirst({ where: { mpSubscriptionId: subscriptionId } });
    if (subscription) {
      const user = await prisma.user.findUnique({ where: { id: subscription.userId } });
      await sendLimitReachedEmail({
        userEmail: user?.email ?? "oi@legendaai.com.br",
        userName: user?.name ?? "Usuário",
        plan: subscription.plan,
        upgradeUrl: "/billing",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
