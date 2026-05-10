import { MercadoPagoConfig, Payment, PreApproval, Preference } from "mercadopago";
import type { PreApprovalResponse } from "mercadopago/dist/clients/preApproval/commonTypes";
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
    throw new Error(
      `Plano ${data.planId} não configurado no Mercado Pago. Configure MP_PLAN_${data.planId}_ID no .env`,
    );
  }

  let preapproval: PreApprovalResponse;
  try {
    preapproval = await preApprovalClient.create({
      body: {
        preapproval_plan_id: plan.mpPlanId,
        payer_email: data.userEmail,
        back_url: data.backUrl,
        external_reference: `${data.userId}:${data.planId}`,
      },
    });
  } catch (err) {
    throw new Error(
      `Erro ao criar assinatura no Mercado Pago: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

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
        description: `Legendai — vídeo avulso (${Math.ceil(data.durationSeconds / 60)} min)`,
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
          title: `Legendai — vídeo avulso (${Math.ceil(data.durationSeconds / 60)} min)`,
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
        success: `${process.env.PUBLIC_URL ?? "https://legendai.online"}/dashboard?payment=success`,
        failure: `${process.env.PUBLIC_URL ?? "https://legendai.online"}/billing?payment=failed`,
        pending: `${process.env.PUBLIC_URL ?? "https://legendai.online"}/billing?payment=pending`,
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

/**
 * Parse the external_reference format "userId:planId" back into its parts.
 * Returns null if the format is invalid.
 */
export function parseExternalReference(
  externalReference: string,
): { userId: string; planId: string } | null {
  const parts = externalReference.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { userId: parts[0], planId: parts[1] };
}

/**
 * Verify a subscription's status directly with the Mercado Pago API.
 * Returns the raw PreApproval response from MP.
 */
export async function verificarAssinaturaMP(mpSubscriptionId: string) {
  return preApprovalClient.get({ id: mpSubscriptionId });
}
