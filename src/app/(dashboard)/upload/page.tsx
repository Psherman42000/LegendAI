import { UploadZone } from "@/components/upload/UploadZone";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";
import { PaymentMethodSelector } from "@/components/billing/PaymentMethodSelector";

export default function UploadPage() {
  return (
    <main className="space-y-8 p-6 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-3xl font-bold">Upload</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Envie um arquivo ou cole uma URL. O processamento acontece no worker, fora da Vercel.
        </p>
      </header>
      <PaymentMethodSelector />
      <UploadZone />
      <AvulsoCalculator durationSeconds={600} />
    </main>
  );
}
