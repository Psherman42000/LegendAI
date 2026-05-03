import { formatCurrency } from "./utils";

export type PlanId = "FREE" | "STARTER" | "PRO" | "UNLIMITED";

export const PLANS = {
  FREE: {
    id: "FREE",
    name: "Grátis",
    price: 0,
    videosPerMonth: 5,
    maxDurationSeconds: 300,
    highlighted: false,
    features: [
      "5 vídeos por mês",
      "Até 5 minutos por vídeo",
      "Exportação SRT/VTT",
      "Marca d'água nas legendas",
    ],
    mpPlanId: null,
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    price: 2900,
    videosPerMonth: 30,
    maxDurationSeconds: 1800,
    highlighted: false,
    features: [
      "30 vídeos por mês",
      "Até 30 minutos por vídeo",
      "Exportação SRT/VTT + Vídeo",
      "Sem marca d'água",
      "5 estilos de legenda",
      "Correção automática PT-BR",
    ],
    mpPlanId: process.env.MP_PLAN_STARTER_ID ?? null,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 5900,
    videosPerMonth: 100,
    maxDurationSeconds: 7200,
    highlighted: true,
    features: [
      "100 vídeos por mês",
      "Até 2 horas por vídeo",
      "Todos os formatos de exportação",
      "Sem marca d'água",
      "Todos os estilos de legenda",
      "Correção IA avançada",
      "Suporte prioritário",
    ],
    mpPlanId: process.env.MP_PLAN_PRO_ID ?? null,
  },
  UNLIMITED: {
    id: "UNLIMITED",
    name: "Ilimitado",
    price: 9900,
    videosPerMonth: 999_999,
    maxDurationSeconds: 14_400,
    highlighted: false,
    features: [
      "Vídeos ilimitados",
      "Até 4 horas por vídeo",
      "API access (em breve)",
      "Todos os recursos Pro",
      "Suporte VIP",
    ],
    mpPlanId: process.env.MP_PLAN_UNLIMITED_ID ?? null,
  },
} as const;

export const AVULSO_PRICE_PER_SECOND = 1.5;
export const AVULSO_MINIMUM_PRICE = 200;

export function calcularPrecoAvulso(durationSeconds: number): {
  seconds: number;
  priceInCentavos: number;
  priceFormatted: string;
  isMinimumApplied: boolean;
} {
  const price = Math.ceil(durationSeconds * AVULSO_PRICE_PER_SECOND);
  const priceInCentavos = Math.max(price, AVULSO_MINIMUM_PRICE);

  return {
    seconds: durationSeconds,
    priceInCentavos,
    priceFormatted: formatCurrency(priceInCentavos),
    isMinimumApplied: priceInCentavos === AVULSO_MINIMUM_PRICE && price < AVULSO_MINIMUM_PRICE,
  };
}

export function getPlanById(planId: PlanId) {
  return PLANS[planId];
}
