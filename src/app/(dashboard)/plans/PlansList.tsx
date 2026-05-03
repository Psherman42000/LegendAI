"use client";

import { PlanCard } from "@/components/plans/PlanCard";
import type { PlanId } from "@/lib/plans";

type PlanItem = {
  id: PlanId;
  name: string;
  price: number;
  videosPerMonth: number;
  maxDurationSeconds: number;
  features: string[];
  mpPlanId: string | null;
};

export function PlansList({
  plans,
  currentPlanId,
}: {
  plans: PlanItem[];
  currentPlanId: PlanId;
}) {
  const highlightedPlan: PlanId = "PRO";

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isCurrentPlan={plan.id === currentPlanId}
          highlighted={plan.id === highlightedPlan && plan.id !== currentPlanId}
        />
      ))}
    </div>
  );
}
