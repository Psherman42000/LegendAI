"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ExportPanel() {
  return (
    <div className="surface flex flex-wrap items-center gap-3 rounded-[var(--radius)] p-4">
      <Button variant="secondary">Baixar SRT</Button>
      <Button variant="secondary">Baixar VTT</Button>
      <Badge>Legenda e vídeo final são gerados automaticamente</Badge>
    </div>
  );
}
