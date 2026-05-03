import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/dashboard/Header";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VideoList } from "@/components/dashboard/VideoList";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [usage, subscription, videosCount, totalSeconds] = await Promise.all([
    prisma.monthlyUsage.findUnique({
      where: { userId_year_month: { userId: session.user.id, year, month } },
    }),
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.video.count({ where: { userId: session.user.id, createdAt: { gte: new Date(year, month - 1, 1) } } }),
    prisma.video.aggregate({
      where: { userId: session.user.id },
      _sum: { duration: true },
    }),
  ]);

  const planName = subscription?.plan ?? "FREE";
  const planPrice = subscription
    ? subscription.plan === "STARTER"
      ? 2900
      : subscription.plan === "PRO"
      ? 5900
      : subscription.plan === "UNLIMITED"
      ? 9900
      : 0
    : 0;
  const totalMinutes = Math.round((totalSeconds._sum.duration ?? 0) / 60);

  return (
    <main className="space-y-8 p-6 lg:p-10">
      <Header
        title="Dashboard"
        description="Monitore vídeos, minutos processados, renovação e status em um único lugar."
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
