"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoUploadFlowProps {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  duration: number;
}

type ProcessingStep = {
  label: string;
  status: "pending" | "active" | "completed";
};

const PROCESSING_STEPS: ProcessingStep[] = [
  { label: "Fazendo upload", status: "pending" },
  { label: "Transcrevendo áudio", status: "pending" },
  { label: "Corrigindo legendas", status: "pending" },
  { label: "Aplicando estilo", status: "pending" },
  { label: "Gerando vídeo final", status: "pending" },
];

export function VideoUploadFlow({ videoId, videoUrl, videoTitle, duration }: VideoUploadFlowProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [video, setVideo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const fetchVideoStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.ok && data.data) {
        setVideo(data.data);
        updateProgress(data.data.status);
      }
    } catch {
      // Silently fail polling
    }
  }, [videoId]);

  const updateProgress = (status: string) => {
    const stepMap: Record<string, number> = {
      UPLOADING: 0,
      QUEUED: 1,
      PROCESSING: 1,
      TRANSCRIBING: 2,
      CORRECTING: 3,
      BURNING: 4,
      UPLOADING_OUTPUTS: 4,
      READY: 5,
      ERROR: -1,
    };

    const step = stepMap[status] ?? 0;
    setCurrentStep(step);
    setProgress(Math.min((step / 5) * 100, 100));
  };

  useEffect(() => {
    if (!isProcessing) return;

    fetchVideoStatus();
    const interval = setInterval(fetchVideoStatus, 3000);
    return () => clearInterval(interval);
  }, [isProcessing, fetchVideoStatus]);

  useEffect(() => {
    if (video?.status === "READY" || video?.status === "ERROR") {
      setIsProcessing(false);
    }
  }, [video]);

  const handleStartProcessing = () => {
    setIsProcessing(true);
    setCurrentStep(0);
    setProgress(0);
    setError(null);
    fetchVideoStatus();
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Erro ao reprocessar");
      handleStartProcessing();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao reprocessar");
    } finally {
      setIsRetrying(false);
    }
  };

  const isReady = video?.status === "READY";
  const isError = video?.status === "ERROR";

  const getStepStatus = (index: number) => {
    if (index < currentStep) return "completed";
    if (index === currentStep) return "active";
    return "pending";
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{videoTitle}</span>
          {duration > 0 && (
            <span className="text-sm font-normal text-[var(--text-secondary)]">
              {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Preview */}
        <div className="relative overflow-hidden rounded-xl bg-black">
          {isReady && video?.processedUrl ? (
            <video
              src={video.processedUrl}
              controls
              className="aspect-video w-full"
              poster={video.thumbnailUrl}
            />
          ) : (
            <video
              src={videoUrl}
              controls
              className="aspect-video w-full"
            />
          )}
        </div>

        {/* Processing Button or Progress */}
        {!isReady && !isError && (
          <div className="space-y-4">
            {!isProcessing ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm text-[var(--text-secondary)]">
                  Seu vídeo foi enviado com sucesso! Clique abaixo para iniciar o processamento das legendas.
                </p>
                <Button
                  onClick={handleStartProcessing}
                  className="animate-pulse bg-[var(--primary)] px-8 py-6 text-lg font-bold text-black hover:bg-[var(--primary)]/90"
                >
                  <svg className="mr-2 size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Processar legendas
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--primary)]">
                    {PROCESSING_STEPS[currentStep]?.label ?? "Processando..."}
                  </span>
                  <span className="text-[var(--text-secondary)]">{Math.round(progress)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {PROCESSING_STEPS.map((step, index) => (
                    <div
                      key={step.label}
                      className={`h-1 rounded-full transition-colors duration-500 ${
                        getStepStatus(index) === "completed"
                          ? "bg-[var(--primary)]"
                          : getStepStatus(index) === "active"
                            ? "bg-[var(--primary)]/50"
                            : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ready State */}
        {isReady && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--primary)]/10 px-4 py-3 text-center">
              <p className="font-medium text-[var(--primary)]">✓ Legendas geradas com sucesso!</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/videos/${videoId}`} className="flex-1">
                <Button className="w-full">
                  <svg className="mr-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  Editar legendas
                </Button>
              </Link>
              {video?.processedUrl && (
                <a href={video.processedUrl} download className="flex-1">
                  <Button variant="outline" className="w-full">
                    <svg className="mr-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Baixar MP4
                  </Button>
                </a>
              )}
            </div>
            {video?.srtUrl && (
              <a href={video.srtUrl} download className="block text-center">
                <Button variant="ghost" className="text-xs text-[var(--text-secondary)]">
                  <svg className="mr-1 size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Baixar SRT
                </Button>
              </a>
            )}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="space-y-3">
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-center">
              <p className="text-red-400">Erro no processamento.</p>
              {video?.errorMessage && (
                <p className="mt-1 text-xs text-red-400/70">{video.errorMessage}</p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? "Reenfileirando..." : "Tentar novamente"}
            </Button>
            {error && (
              <p className="text-center text-sm text-red-400">{error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}