"use client";

import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/useUpload";

export function UploadZone() {
  const { uploadFile, uploadUrl, isUploading, progress, uploadedVideo } = useUpload();

  return (
    <div className="surface rounded-[var(--radius)] p-6">
      <div className="flex flex-col gap-4">
        <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 p-8 text-center hover:border-[rgba(170,255,0,0.35)]">
          <div className="text-lg font-semibold">Arraste seu vídeo aqui</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">mp4, mov, webm ou avi. Até 2GB.</div>
          <input
            className="hidden"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadFile(file);
              }
            }}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none"
            placeholder="Cole uma URL do YouTube ou TikTok"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void uploadUrl((event.currentTarget as HTMLInputElement).value);
              }
            }}
          />
          <Button type="button" variant="outline">
            Enviar URL
          </Button>
        </div>
        <div className="text-sm text-[var(--text-secondary)]">
          {isUploading ? `Processando ${progress}%` : uploadedVideo ? `Último upload: ${uploadedVideo.title}` : "Aguardando upload"}
        </div>
      </div>
    </div>
  );
}
