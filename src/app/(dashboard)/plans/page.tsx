import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { redirect } from "next/navigation";
import { PlansList } from "./PlansList";

export const metadata = {
  title: "Planos — LegendaAI",
};

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  const currentPlanId = subscription?.plan ?? "FREE";

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
    <main className="space-y-8 p-6 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-3xl font-bold">Planos</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Escolha o plano ideal para suas legendas automáticas. Altere quando quiser.
        </p>
      </header>

      <PlansList plans={plans} currentPlanId={currentPlanId} />
    </main>
  );
}
