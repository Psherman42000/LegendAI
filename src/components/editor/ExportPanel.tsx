"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";

export function ExportPanel() {
  const params = useParams();
  const videoId = params.id as string;
  const [exportError, setExportError] = useState<string | null>(null);

  async function downloadSRT() {
    setExportError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "SRT" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Erro ao gerar SRT");

      const blob = new Blob([data.data.content], { type: data.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "legenda.srt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Erro ao baixar SRT");
    }
  }

  async function downloadVTT() {
    setExportError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "VTT" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Erro ao gerar VTT");

      const blob = new Blob([data.data.content], { type: data.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "legenda.vtt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Erro ao baixar VTT");
    }
  }

  return (
    <div className="surface space-y-3 rounded-[var(--radius)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={downloadSRT}>
          Baixar SRT
        </Button>
        <Button variant="secondary" onClick={downloadVTT}>
          Baixar VTT
        </Button>
        <Badge>Legenda e vídeo final são gerados automaticamente</Badge>
      </div>
      {exportError && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {exportError}
        </div>
      )}
    </div>
  );
}
