import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function StatsGrid({
  videosThisMonth,
  minutesProcessed,
  planName,
  planPrice,
  nextRenewal,
}: {
  videosThisMonth: number;
  minutesProcessed: number;
  planName: string;
  planPrice: number;
  nextRenewal: string;
}) {
  const stats = [
    { label: "Vídeos este mês", value: String(videosThisMonth), detail: "processados" },
    { label: "Minutos processados", value: String(minutesProcessed), detail: "total" },
    { label: "Plano atual", value: planName, detail: formatCurrency(planPrice) + "/mês" },
    { label: "Próxima renovação", value: nextRenewal, detail: "renovação" },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-2xl">{stat.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--text-secondary)]">{stat.detail}</CardContent>
        </Card>
      ))}
    </div>
  );
}
