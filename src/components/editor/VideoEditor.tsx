"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function VideoEditor() {
  const params = useParams();
  const videoId = params.id as string;
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideo() {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error ?? "Erro ao carregar vídeo");
        setVideo(data.data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro ao carregar vídeo");
      } finally {
        setLoading(false);
      }
    }
    fetchVideo();
  }, [videoId]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-[var(--text-secondary)]">Carregando vídeo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">Voltar ao dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!video) return null;

  const isReady = video.status === "READY";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold">{video.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Status: <span className={isReady ? "text-green-400" : "text-yellow-400"}>{video.status}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard">
            <Button variant="outline">← Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Video Player */}
      <div className="overflow-hidden rounded-xl bg-black">
        {isReady && video.processedUrl ? (
          <video
            src={video.processedUrl}
            controls
            className="aspect-video w-full"
            poster={video.thumbnailUrl}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <p className="text-[var(--text-secondary)]">
              {isReady ? "Vídeo não disponível" : "Processando vídeo..."}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {isReady && (
        <div className="flex flex-wrap gap-3">
          {video.processedUrl && (
            <a href={video.processedUrl} download>
              <Button>
                <svg className="mr-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Baixar MP4 Legendado
              </Button>
            </a>
          )}
          {video.srtUrl && (
            <a href={video.srtUrl} download>
              <Button variant="outline">
                <svg className="mr-2 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Baixar SRT
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Subtitle Editor Placeholder */}
      <div className="rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold">Editor de Legendas</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          O editor completo de legendas será implementado em breve. Por enquanto, você pode baixar o vídeo legendado e a legenda SRT acima.
        </p>
      </div>
    </div>
  );
}