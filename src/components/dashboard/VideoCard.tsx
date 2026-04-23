import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type VideoCardProps = {
  title: string;
  status: "PROCESSANDO" | "PRONTO" | "ERRO" | "QUEUED";
  duration: string;
};

export function VideoCard({ title, status, duration }: VideoCardProps) {
  const tone = status === "PRONTO" ? "success" : status === "ERRO" ? "danger" : "warning";
  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{duration}</p>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </CardHeader>
      <CardContent className="text-sm text-[var(--text-secondary)]">
        Preview, editar timing e exportar legenda.
      </CardContent>
    </Card>
  );
}
