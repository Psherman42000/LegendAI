import { MercadoPagoConfig, Payment, PreApproval, Preference } from "mercadopago";
import type { PreApprovalResponse } from "mercadopago/dist/clients/preApproval/commonTypes";
import type { PlanId } from "./plans";
import { PLANS, calcularPrecoAvulso } from "./plans";

const accessToken = process.env.MP_ACCESS_TOKEN ?? "";

// Log token prefix for debugging (safe — only shows first/last few chars)
if (accessToken) {
  console.log(`[mercadopago] Token loaded: ${accessToken.slice(0, 8)}...${accessToken.slice(-4)} (length=${accessToken.length})`);
} else {
  console.error("[mercadopago] MP_ACCESS_TOKEN is empty!");
}

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

/**
 * Extract the full MP error, including the HTTP response body if available.
 * MP SDK errors often have a `.response` with `.status` and `.data`.
 */
function extractMpError(err: unknown): { rawMessage: string; rawJson: string } {
  const rawJson = (() => {
    if (typeof err === "object" && err !== null) {
      try {
        return JSON.stringify(err, (key, value) => {
          // Avoid circular references and truncate large buffers
          if (key === "request" || key === "config") return undefined;
          return value;
        }, 2);
      } catch {
        return String(err);
      }
    }
    return String(err);
  })();

  const rawMessage = (() => {
    if (err instanceof Error) return err.message;
    return rawJson;
  })();

  return { rawMessage, rawJson };
}

export async function criarAssinatura(data: {
  userId: string;
  userEmail: string;
  userName: string;
  planId: PlanId;
  backUrl: string;
}): Promise<{ initPoint: string; subscriptionId: string }> {
  const plan = PLANS[data.planId];
  console.log(`[criarAssinatura] planId=${data.planId}, price=${plan.price}, mpPlanId=${plan.mpPlanId}`);

  const amount = plan.price / 100;
  let preapproval: PreApprovalResponse;
  try {
    preapproval = await preApprovalClient.create({
      body: {
        reason: `LegendAI — ${plan.name}`,
        payer_email: data.userEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL",
        },
        back_url: data.backUrl,
        external_reference: `${data.userId}:${data.planId}`,
      },
    });
    console.log(`[criarAssinatura] MP response id=${preapproval.id}, init_point=${preapproval.init_point}, status=${preapproval.status}`);
  } catch (err) {
    const { rawMessage, rawJson } = extractMpError(err);
    console.error("[criarAssinatura] MP error (message):", rawMessage);
    console.error("[criarAssinatura] MP error (full):", rawJson);

    // Log token diagnostic info (safe — only prefix and length)
    console.error(`[criarAssinatura] Token prefix used: ${accessToken.slice(0, 8)}... (length=${accessToken.length}, starts with TEST-: ${accessToken.startsWith("TEST-")}, starts with APP_USR-: ${accessToken.startsWith("APP_USR-")})`);

    // Throw the raw error so the frontend can see exactly what MP returned
    throw new Error(
      `Erro ao criar assinatura no Mercado Pago: ${rawMessage}\n\n--- Detalhes do erro MP ---\n${rawJson}`,
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
  console.log(`[criarPagamentoAvulso] method=${data.method}, amount=${amount}, paymentId=${data.paymentId}`);

  if (data.method === "PIX") {
    try {
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
      console.log(`[criarPagamentoAvulso] PIX payment id=${payment.id}, status=${payment.status}`);
      console.log(`[criarPagamentoAvulso] PIX point_of_interaction=`, JSON.stringify(payment.point_of_interaction));

      return {
        preferenceId: String(payment.id ?? data.paymentId),
        initPoint: "",
        pixQrCode: payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? undefined,
        pixQrCodeText: payment.point_of_interaction?.transaction_data?.qr_code ?? undefined,
        pixExpiration: payment.date_of_expiration ?? undefined,
      };
    } catch (err) {
      const errorDetail = extractMpError(err);
      console.error("[criarPagamentoAvulso] PIX error:", errorDetail);
      throw new Error(`Erro ao criar PIX no Mercado Pago: ${errorDetail}`);
    }
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
