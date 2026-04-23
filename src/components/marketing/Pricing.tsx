import { PricingTable } from "@/components/billing/PricingTable";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";

export function Pricing() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="space-y-10">
        <PricingTable />
        <AvulsoCalculator durationSeconds={600} />
      </div>
    </section>
  );
}
