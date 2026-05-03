"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/useUpload";
import { usePlan } from "@/hooks/usePlan";

export function UploadZone() {
  const { uploadFile, uploadUrl, isUploading, progress, error, uploadedVideo } = useUpload();
  const { canUpload, isLoading: isPlanLoading } = usePlan();
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = () => {
    const url = urlInputRef.current?.value;
    if (url) {
      void uploadUrl(url);
    }
  };

  const isDisabled = isUploading || (!canUpload && !isPlanLoading);

  return (
    <div className="surface rounded-[var(--radius)] p-6">
      <div className="flex flex-col gap-4">
        <label className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 p-8 text-center ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-[rgba(170,255,0,0.35)]"}`}>
          <div className="text-lg font-semibold">Arraste seu vídeo aqui</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">mp4, mov, webm ou avi. Até 2GB.</div>
          <input
            className="hidden"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
            disabled={isDisabled}
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
            ref={urlInputRef}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none disabled:opacity-50"
            placeholder="Cole uma URL do YouTube ou TikTok"
            disabled={isDisabled}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleUrlSubmit();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleUrlSubmit} disabled={isDisabled}>
            Enviar URL
          </Button>
        </div>
        
        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        
        <div className="text-sm text-[var(--text-secondary)]">
          {isUploading ? `Processando ${progress}%` : uploadedVideo ? (
            <span>
              Último upload: <Link href={`/videos/${uploadedVideo.id}`} className="text-[var(--primary)] hover:underline">{uploadedVideo.title}</Link>
            </span>
          ) : "Aguardando upload"}
        </div>
      </div>
    </div>
  );
}
