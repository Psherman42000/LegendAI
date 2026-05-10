"use client";

import { UploadZone } from "@/components/upload/UploadZone";
import { UploadLimitBanner } from "@/components/upload/UploadLimitBanner";
import { usePlan } from "@/hooks/usePlan";

export default function UploadPage() {
  const { plan, isAtLimit, isLoading: isPlanLoading } = usePlan();

  return (
    <main className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">Upload</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Envie um arquivo ou cole uma URL. O processamento acontece no worker, fora da Vercel.
        </p>
      </header>
      <UploadLimitBanner />
      <UploadZone />
      
      {!isPlanLoading && isAtLimit && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-sm text-yellow-400">
            Você atingiu o limite do plano {plan}. Faça um pagamento avulso ou upgrade para continuar.
          </p>
        </div>
      )}
    </main>
  );
}
