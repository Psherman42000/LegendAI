import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type VideoCardProps = {
  id: string;
  title: string;
  status: string;
  duration: string;
};

const KNOWN_STATUSES = ["PRONTO", "PROCESSANDO", "ERRO", "QUEUED"] as const;

export function VideoCard({ id, title, status, duration }: VideoCardProps) {
  const normalized = KNOWN_STATUSES.includes(status as typeof KNOWN_STATUSES[number]) ? status : "PROCESSANDO";
  const tone = normalized === "PRONTO" ? "success" : normalized === "ERRO" ? "danger" : "warning";
  const card = (
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

  return (
    <Link href={`/videos/${id}`} className="block transition hover:opacity-80">
      {card}
    </Link>
  );
}
