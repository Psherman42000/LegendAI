import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { Header } from "@/components/dashboard/Header";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VideoList } from "@/components/dashboard/VideoList";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  let usage = null;
  let subscription = null;
  let videosCount = 0;
  let totalMinutes = 0;
  let error = false;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [usageData, subData, count, totalSeconds] = await Promise.all([
      prisma.monthlyUsage.findUnique({
        where: { userId_year_month: { userId: session.user.id, year, month } },
      }),
      prisma.subscription.findUnique({
        where: { userId: session.user.id },
      }),
      prisma.video.count({
        where: { userId: session.user.id, createdAt: { gte: new Date(year, month - 1, 1) } },
      }),
      prisma.video.aggregate({
        where: { userId: session.user.id },
        _sum: { duration: true },
      }),
    ]);

    usage = usageData;
    subscription = subData;
    videosCount = count;
    totalMinutes = Math.round((totalSeconds._sum.duration ?? 0) / 60);
  } catch {
    error = true;
  }

  const planName = subscription?.plan ?? "FREE";
  const plan = PLANS[planName as keyof typeof PLANS];
  const planPrice = plan?.price ?? 0;

  const wrapperClass = "space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8 lg:p-10";

  if (error) {
    return (
      <main className={wrapperClass}>
        <Header title="Dashboard" description="Não foi possível carregar os dados. Tente novamente mais tarde." />
        <div className="rounded-xl bg-red-500/10 p-6 text-red-400">
          Erro ao carregar dados do dashboard. Verifique sua conexão ou tente novamente.
        </div>
      </main>
    );
  }

  return (
    <main className={wrapperClass}>
      <Header
        title="Dashboard"
        description="Monitore vídeos, minutos processados, renovação e status em um único lugar."
        showUploadButton
      />
      <StatsGrid
        videosThisMonth={usage?.videosCount ?? 0}
        minutesProcessed={totalMinutes}
        planName={planName}
        planPrice={planPrice}
        nextRenewal={
          subscription?.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })
            : "—"
        }
      />
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Últimos vídeos</h2>
          <p className="text-sm text-[var(--text-secondary)]">Acompanhe os últimos trabalhos enviados.</p>
        </div>
        <VideoList />
      </section>
    </main>
  );
}
