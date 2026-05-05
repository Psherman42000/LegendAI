"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/useUpload";
import { VideoUploadFlow } from "./VideoUploadFlow";
import { usePlan } from "@/hooks/usePlan";
import { AvulsoCalculator } from "@/components/billing/AvulsoCalculator";

export function UploadZone() {
  const { uploadFile, uploadUrl, isUploading, progress, error, useAiCorrection, setUseAiCorrection } = useUpload();
  const { canUpload, isLoading: isPlanLoading } = usePlan();
  const [uploadedVideo, setUploadedVideo] = useState<{
    id: string;
    url: string;
    title: string;
    duration: number;
  } | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const isDisabled = isUploading || (!canUpload && !isPlanLoading);

  const handleFileUpload = async (file: File) => {
    const result = await uploadFile(file);
    if (result) {
      setUploadedVideo({
        id: result.id,
        url: result.url,
        title: result.title,
        duration: result.duration ?? 0,
      });
    }
  };

  const handleUrlSubmit = async () => {
    const url = urlInputRef.current?.value;
    if (url) {
      const result = await uploadUrl(url);
      if (result) {
        setUploadedVideo({
          id: result.id,
          url: result.url,
          title: result.title,
          duration: result.duration ?? 0,
        });
      }
    }
  };

  const handleReset = () => {
    setUploadedVideo(null);
  };

  return (
    <div className="space-y-6">
      {!uploadedVideo ? (
        <div className="surface rounded-[var(--radius)] p-6">
          <div className="flex flex-col gap-4">
            <label
              className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 p-8 text-center ${
                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-[rgba(170,255,0,0.35)]"
              }`}
            >
              <div className="text-lg font-semibold">Arraste seu vídeo aqui</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                mp4, mov, webm ou avi. Até 2GB.
              </div>
              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">Enviando... {progress}%</p>
                </div>
              )}
              <input
                className="hidden"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                disabled={isDisabled}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFileUpload(file);
                  }
                }}
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={useAiCorrection}
                onChange={(e) => setUseAiCorrection(e.target.checked)}
                className="size-4 rounded border-[var(--border)] bg-[var(--surface-2)]"
              />
              Usar correção com IA (melhora a qualidade das legendas)
            </label>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                ref={urlInputRef}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none disabled:opacity-50"
                placeholder="Cole uma URL do YouTube ou TikTok"
                disabled={isDisabled}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleUrlSubmit();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleUrlSubmit()}
                disabled={isDisabled}
              >
                Enviar URL
              </Button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <VideoUploadFlow
            videoId={uploadedVideo.id}
            videoUrl={uploadedVideo.url}
            videoTitle={uploadedVideo.title}
            duration={uploadedVideo.duration}
          />
          {uploadedVideo.duration > 0 && (
            <AvulsoCalculator
              durationSeconds={uploadedVideo.duration}
              videoTitle={uploadedVideo.title}
            />
          )}
          <div className="flex justify-center">
            <Button variant="ghost" onClick={handleReset} className="text-sm text-[var(--text-secondary)]">
              ← Enviar outro vídeo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}