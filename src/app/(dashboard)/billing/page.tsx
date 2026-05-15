import { PricingTable } from "@/components/billing/PricingTable";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";
import { CheckoutStatus } from "@/components/billing/CheckoutStatus";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let currentPlanId = "FREE";
  if (userId) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });
    currentPlanId = subscription?.plan ?? "FREE";
  }

  const plans = Object.values(PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    videosPerMonth: plan.videosPerMonth,
    maxDurationSeconds: plan.maxDurationSeconds,
    features: [...plan.features],
    mpPlanId: plan.mpPlanId,
    highlighted: plan.highlighted,
  }));

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
      <PricingTable plans={plans} currentPlanId={currentPlanId as any} />
      <AvulsoCalculator durationSeconds={300} />
    </main>
  );
}