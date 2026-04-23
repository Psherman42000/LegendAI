import { PricingTable } from "@/components/billing/PricingTable";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";

export default function BillingPage() {
  return (
    <main className="space-y-8 p-6 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-3xl font-bold">Assinatura e billing</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Escolha um plano ou faça uma compra avulsa para este vídeo.
        </p>
      </header>
      <PricingTable />
      <AvulsoCalculator durationSeconds={300} />
    </main>
  );
}
