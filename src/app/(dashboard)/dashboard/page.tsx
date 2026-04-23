import { Header } from "@/components/dashboard/Header";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VideoList } from "@/components/dashboard/VideoList";

export default function DashboardPage() {
  return (
    <main className="space-y-8 p-6 lg:p-10">
      <Header
        title="Dashboard"
        description="Monitore vídeos, minutos processados, renovação e status em um único lugar."
      />
      <StatsGrid />
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
