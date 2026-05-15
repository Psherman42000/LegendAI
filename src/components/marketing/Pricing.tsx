import { PlanCard } from "@/components/billing/PlanCard";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";
import { PLANS } from "@/lib/plans";

export function Pricing() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="space-y-10">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <PlanCard plan="FREE" price={PLANS.FREE.price} features={PLANS.FREE.features} />
          <PlanCard plan="STARTER" price={PLANS.STARTER.price} features={PLANS.STARTER.features} highlighted />
          <PlanCard plan="PRO" price={PLANS.PRO.price} features={PLANS.PRO.features} />
          <PlanCard plan="UNLIMITED" price={PLANS.UNLIMITED.price} features={PLANS.UNLIMITED.features} />
        </div>
        <AvulsoCalculator durationSeconds={600} />
      </div>
    </section>
  );
}
