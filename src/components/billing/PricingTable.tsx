import { PlanCard } from "./PlanCard";
import { PLANS } from "@/lib/plans";

export function PricingTable() {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <PlanCard plan="FREE" price={PLANS.FREE.price} features={PLANS.FREE.features} />
      <PlanCard plan="STARTER" price={PLANS.STARTER.price} features={PLANS.STARTER.features} highlighted />
      <PlanCard plan="PRO" price={PLANS.PRO.price} features={PLANS.PRO.features} />
      <PlanCard plan="UNLIMITED" price={PLANS.UNLIMITED.price} features={PLANS.UNLIMITED.features} />
    </div>
  );
}
