import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseExternalReference, verificarAssinaturaMP, consultarPagamento } from "@/lib/mercadopago";
import { sendLimitReachedEmail, sendWebhookNotification } from "@/lib/email";
import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

function validarAssinaturaMP(request: Request, rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;

  // In development, allow webhooks without HMAC validation (with warning)
  if (!secret && process.env.NODE_ENV === "development") {
    console.warn("[webhook] MP_WEBHOOK_SECRET not set — skipping HMAC validation in development");
    return true;
  }

  if (!secret) {
    console.error("[webhook] MP_WEBHOOK_SECRET not set — rejecting webhook");
    return false;
  }

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
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return hmac === v1;
}

/**
 * Map Mercado Pago preapproval status to our SubscriptionStatus enum.
 */
function mapMPStatusToSubscriptionStatus(mpStatus: string): "PENDING" | "ACTIVE" | "CANCELLED" | "PAUSED" {
  switch (mpStatus) {
    case "authorized":
      return "ACTIVE";
    case "pending":
      return "PENDING";
    case "cancelled":
      return "CANCELLED";
    case "paused":
      return "PAUSED";
    default:
      return "PENDING";
  }
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

  let topic = payload.topic ?? payload.type ?? "";

  // Normalise: MP sends "subscription_preapproval" for new subscriptions
  if (topic === "subscription_preapproval") {
    topic = "preapproval";
  }

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

  // ─── Handle preapproval (subscription) notifications ───
  if (topic === "preapproval") {
    const mpPreapprovalId = notificationId;

    // Verify with MP API before trusting the payload
    let mpStatus: string;
    try {
      const mpSubscription = await verificarAssinaturaMP(mpPreapprovalId);
      mpStatus = mpSubscription.status ?? "pending";
    } catch (err) {
      console.error("[webhook] Failed to verify subscription with MP API:", err);
      // Still process with the payload status as fallback
      mpStatus = "pending";
    }

    const subscriptionStatus = mapMPStatusToSubscriptionStatus(mpStatus);

    // Try to find existing subscription by mpSubscriptionId
    const existing = await prisma.subscription.findFirst({
      where: { mpSubscriptionId: mpPreapprovalId },
    });

    if (existing) {
      // Update existing subscription
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: subscriptionStatus,
          cancelAtPeriodEnd: mpStatus === "cancelled",
          cancelledAt: mpStatus === "cancelled" ? new Date() : null,
          currentPeriodEnd: mpStatus === "authorized"
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : undefined,
        },
      });

      if (subscriptionStatus === "ACTIVE") {
        const user = await prisma.user.findUnique({ where: { id: existing.userId } });
        if (user?.email) {
          await sendWebhookNotification(
            `Assinatura ${existing.id} autorizada para ${user.email} (plano ${existing.plan}).`,
          );
        }
      }
    } else {
      // New subscription — create from external_reference
      // The external_reference was set as "userId:planId" during checkout
      // For preapproval notifications, we need to get the external_reference from MP API
      let userId: string | undefined;
      let planId: PlanId | undefined;

      try {
        const mpSubscription = await verificarAssinaturaMP(mpPreapprovalId);
        const externalRef = mpSubscription.external_reference;
        if (externalRef) {
          const parsed = parseExternalReference(externalRef);
          if (parsed) {
            userId = parsed.userId;
            planId = parsed.planId as PlanId;
          }
        }

        if (userId && planId && PLANS[planId]) {
          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              plan: planId,
              mpSubscriptionId: mpPreapprovalId,
              status: subscriptionStatus,
              currentPeriodEnd: mpStatus === "authorized"
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                : undefined,
            },
            update: {
              plan: planId,
              mpSubscriptionId: mpPreapprovalId,
              status: subscriptionStatus,
              cancelAtPeriodEnd: false,
              cancelledAt: null,
              currentPeriodEnd: mpStatus === "authorized"
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                : undefined,
            },
          });

          if (subscriptionStatus === "ACTIVE") {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user?.email) {
              await sendWebhookNotification(
                `Nova assinatura autorizada para ${user.email} (plano ${planId}).`,
              );
            }
          }
        } else {
          console.error("[webhook] Cannot create subscription: missing or invalid external_reference", {
            mpPreapprovalId,
            externalRef,
          });
        }
      } catch (err) {
        console.error("[webhook] Error processing new preapproval:", err);
      }
    }
  }

  // ─── Handle payment (avulso) notifications ───
  if (topic === "payment") {
    const paymentId = notificationId;

    // Verify with MP API before trusting the payload
    let mpPaymentStatus: string;
    try {
      const mpPayment = await consultarPagamento(paymentId);
      mpPaymentStatus = mpPayment.status ?? "pending";
    } catch (err) {
      console.error("[webhook] Failed to verify payment with MP API:", err);
      mpPaymentStatus = "pending";
    }

    const payment = await prisma.payment.findFirst({ where: { mpPaymentId: paymentId } });
    if (payment) {
      const updateData: Record<string, unknown> = {
        mpStatus: mpPaymentStatus,
      };

      if (mpPaymentStatus === "approved") {
        updateData.status = "PAID";
        updateData.paidAt = new Date();
      } else if (mpPaymentStatus === "rejected" || mpPaymentStatus === "cancelled") {
        updateData.status = "FAILED";
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: updateData as Parameters<typeof prisma.payment.update>[0]["data"],
      });

      if (mpPaymentStatus === "approved") {
        await sendWebhookNotification(`Pagamento avulso ${payment.id} aprovado.`);
      }
    }
  }

  // ─── Handle subscription_authorized_payment (recurring charge confirmation) ───
  if (topic === "subscription_authorized_payment") {
    // This topic confirms a recurring payment was processed for an active subscription
    // We already handle the preapproval status above, so just log it
    console.log("[webhook] subscription_authorized_payment received:", notificationId);
  }

  return NextResponse.json({ ok: true });
}