import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const stats = [
  { label: "Vídeos este mês", value: "12", detail: "3 em processamento" },
  { label: "Minutos processados", value: "48", detail: "média de 4 min por vídeo" },
  { label: "Plano atual", value: "Pro", detail: formatCurrency(5900) + "/mês" },
  { label: "Próxima renovação", value: "18 mai", detail: "renova em 6 dias" },
];

export function StatsGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
