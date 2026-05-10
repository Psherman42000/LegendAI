import { PricingTable } from "@/components/billing/PricingTable";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";
import { CheckoutStatus } from "@/components/billing/CheckoutStatus";
import { Suspense } from "react";

export default function BillingPage() {
  return (
    <main className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">Assinatura e billing</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Escolha um plano ou faça uma compra avulsa para este vídeo.
        </p>
      </header>
      <Suspense fallback={null}>
        <CheckoutStatus />
      </Suspense>
      <PricingTable />
      <AvulsoCalculator durationSeconds={300} />
    </main>
  );
}