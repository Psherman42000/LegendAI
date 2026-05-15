import { PlanCard } from "@/components/plans/PlanCard";
import type { PlanId } from "@/lib/plans";

type PlanItem = {
  id: PlanId;
  name: string;
  price: number;
  videosPerMonth: number;
  maxDurationSeconds: number;
  features: readonly string[];
  mpPlanId: string | null;
  highlighted: boolean;
};

export function PricingTable({
  plans,
  currentPlanId,
}: {
  plans: PlanItem[];
  currentPlanId: PlanId;
}) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isCurrentPlan={plan.id === currentPlanId}
          highlighted={plan.highlighted && plan.id !== currentPlanId}
        />
      ))}
    </div>
  );
}
