import type { PlanId } from "@/lib/plans";

export type BillingSummary = {
  plan: PlanId;
  amountInCentavos: number;
  renewAt?: string;
};
