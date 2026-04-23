import { MercadoPagoConfig, Payment, PreApproval, Preference } from "mercadopago";
import type { PlanId } from "./plans";
import { PLANS, calcularPrecoAvulso } from "./plans";

const accessToken = process.env.MP_ACCESS_TOKEN ?? "";

export const mpConfig = new MercadoPagoConfig({
  accessToken,
});

const preferenceClient = new Preference(mpConfig);
const paymentClient = new Payment(mpConfig);
const preApprovalClient = new PreApproval(mpConfig);

export const mp = {
  preference: preferenceClient,
  payment: paymentClient,
  preApproval: preApprovalClient,
};

export async function criarAssinatura(data: {
  userId: string;
  userEmail: string;
  userName: string;
  planId: PlanId;
  backUrl: string;
}): Promise<{ initPoint: string; subscriptionId: string }> {
  const plan = PLANS[data.planId];
  if (!plan.mpPlanId) {
    return {
      initPoint: data.backUrl,
      subscriptionId: `local-${data.userId}-${data.planId}`,
    };
  }

  const preapproval = await preApprovalClient.create({
    body: {
      preapproval_plan_id: plan.mpPlanId,
      payer_email: data.userEmail,
      back_url: data.backUrl,
      external_reference: data.userId,
    },
  });

  return {
    initPoint: preapproval.init_point ?? data.backUrl,
    subscriptionId: String(preapproval.id ?? `subscription-${data.userId}`),
  };
}

export async function cancelarAssinatura(mpSubscriptionId: string): Promise<void> {
  if (!mpSubscriptionId || !accessToken) {
    return;
  }

  await preApprovalClient.update({
    id: mpSubscriptionId,
    body: { status: "cancelled" },
  });
}

export async function criarPagamentoAvulso(data: {
  userId: string;
  userEmail: string;
  userName: string;
  paymentId: string;
  durationSeconds: number;
  method: "PIX" | "CARD";
  notificationUrl: string;
}): Promise<{
  preferenceId: string;
  initPoint: string;
  pixQrCode?: string;
  pixQrCodeText?: string;
  pixExpiration?: string;
}> {
  const { priceInCentavos } = calcularPrecoAvulso(data.durationSeconds);
  const amount = priceInCentavos / 100;

  if (data.method === "PIX") {
    const payment = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description: `LegendaAI — vídeo avulso (${Math.ceil(data.durationSeconds / 60)} min)`,
        payment_method_id: "pix",
        payer: {
          email: data.userEmail,
          first_name: data.userName.split(" ")[0] ?? data.userName,
        },
        external_reference: data.paymentId,
        notification_url: data.notificationUrl,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });

    return {
      preferenceId: String(payment.id ?? data.paymentId),
      initPoint: "",
      pixQrCode: payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? undefined,
      pixQrCodeText: payment.point_of_interaction?.transaction_data?.qr_code ?? undefined,
      pixExpiration: payment.date_of_expiration ?? undefined,
    };
  }

  const preference = await preferenceClient.create({
    body: {
      items: [
        {
          id: data.paymentId,
          title: `LegendaAI — vídeo avulso (${Math.ceil(data.durationSeconds / 60)} min)`,
          quantity: 1,
          unit_price: amount,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: data.userEmail,
      },
      external_reference: data.paymentId,
      notification_url: data.notificationUrl,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?payment=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing?payment=failed`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing?payment=pending`,
      },
      auto_return: "approved",
    },
  });

  return {
    preferenceId: String(preference.id ?? data.paymentId),
    initPoint: preference.init_point ?? "",
  };
}

export async function consultarPagamento(mpPaymentId: string) {
  return paymentClient.get({ id: Number(mpPaymentId) });
}

export async function consultarAssinatura(mpSubscriptionId: string) {
  return preApprovalClient.get({ id: mpSubscriptionId });
}
