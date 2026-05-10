"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVideos } from "@/hooks/useVideos";

export type VideoItem = {
  id: string;
  title: string;
  status: string;
  duration: number | null;
  fileSize?: number | null;
  thumbnailUrl?: string | null;
  processedUrl?: string | null;
  srtUrl?: string | null;
  createdAt: string;
  transcription?: { id: string } | null;
};

function formatDuration(seconds: number | null | string): string {
  const num = typeof seconds === "string" ? parseInt(seconds, 10) : seconds;
  if (!num || isNaN(num)) return "—";
  if (num < 60) return `${num}s`;
  const m = Math.floor(num / 60);
  const s = num % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusTone(status: string): "success" | "danger" | "warning" {
  if (status === "READY" || status === "EXPORTED") return "success";
  if (status === "ERROR") return "danger";
  return "warning";
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    UPLOADING: "Enviando",
    QUEUED: "Na fila",
    PROCESSING: "Processando",
    TRANSCRIBING: "Transcrevendo",
    CORRECTING: "Corrigindo",
    BURNING: "Queimando legenda",
    UPLOADING_OUTPUTS: "Finalizando",
    READY: "Pronto",
    EXPORTED: "Exportado",
    ERROR: "Erro",
  };
  return labels[status] ?? status;
}

const primaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(170,255,0,0.12),0_12px_40px_rgba(170,255,0,0.12)] transition-all duration-200 hover:translate-y-[-1px]";

const secondaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-all duration-200 hover:border-[rgba(170,255,0,0.22)]";

const outlineActionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--text)] transition-all duration-200 hover:border-[rgba(170,255,0,0.24)] hover:bg-white/5";

type VideoListProps = {
  videos?: VideoItem[];
  search?: string;
  limit?: number;
  error?: string | null;
  loading?: boolean;
};

export function VideoList(props: VideoListProps) {
  if (
    props.videos !== undefined ||
    props.error !== undefined ||
    props.loading !== undefined
  ) {
    return (
      <VideoListView
        videos={props.videos ?? []}
        search={props.search ?? ""}
        limit={props.limit}
        error={props.error ?? null}
        loading={props.loading ?? false}
        showSearch
      />
    );
  }

  return <ClientFetchedVideoList />;
}

function ClientFetchedVideoList() {
  const { videos, loading, error } = useVideos();
  const normalizedVideos: VideoItem[] = videos.map((video) => ({
    ...video,
    duration: video.duration,
  }));

  return (
    <VideoListView
      videos={normalizedVideos}
      search=""
      error={error}
      loading={loading}
      showSearch={false}
    />
  );
}

function VideoListView({
  videos,
  search,
  limit,
  error,
  loading,
  showSearch,
}: {
  videos: VideoItem[];
  search: string;
  limit?: number;
  error: string | null;
  loading: boolean;
  showSearch: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(search);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (query.trim()) params.set("search", query.trim());
    const queryString = params.toString();
    router.push(queryString ? `/videos?${queryString}` : "/videos");
  }

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse overflow-hidden">
            <div className="aspect-video bg-[var(--surface-2)]" />
            <CardContent className="space-y-3 p-4">
              <div className="h-4 w-3/4 rounded bg-[var(--surface-2)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--surface-2)]" />
              <div className="flex gap-2">
                <div className="h-9 flex-1 rounded bg-[var(--surface-2)]" />
                <div className="h-9 flex-1 rounded bg-[var(--surface-2)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 p-6 text-red-400">
        Erro ao carregar vídeos: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSearch && (
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <Input
            placeholder="Buscar por título..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md text-base"
          />
          <button type="submit" className={secondaryActionClass}>
            Buscar
          </button>
          {search && (
            <Link
              href="/videos"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent px-4 py-2 text-sm font-semibold text-[var(--text)] transition-all duration-200 hover:bg-white/5"
            >
              Limpar
            </Link>
          )}
        </form>
      )}

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--text-secondary)]"
            >
              <path d="m22 8-6 4 6 4V8Z" />
              <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              <path d="M2 10h14" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Nenhum vídeo encontrado</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {search
              ? `Nenhum resultado para "${search}". Tente outro termo.`
              : "Você ainda não enviou nenhum vídeo."}
          </p>
          {!search && (
            <Link href="/upload" className={`mt-4 ${primaryActionClass}`}>
              Enviar primeiro vídeo
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="group overflow-hidden transition-all duration-300 hover:border-[rgba(170,255,0,0.22)] hover:shadow-[0_0_40px_rgba(170,255,0,0.06)]"
            >
              <div className="relative aspect-video bg-[var(--surface-2)]">
                {video.thumbnailUrl ? (
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--text-secondary)] opacity-40"
                    >
                      <path d="m22 8-6 4 6 4V8Z" />
                      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                    </svg>
                  </div>
                )}
                <div className="absolute right-3 top-3">
                  <Badge tone={getStatusTone(video.status)}>
                    {getStatusLabel(video.status)}
                  </Badge>
                </div>
                {video.duration ? (
                  <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {formatDuration(video.duration)}
                  </div>
                ) : null}
              </div>

              <CardContent className="space-y-4 p-4">
                <div>
                  <h3 className="line-clamp-2 text-sm font-semibold text-[var(--text)]">
                    {video.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {new Date(video.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {video.fileSize ? ` · ${formatFileSize(video.fileSize)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/videos/${video.id}`}
                    className={`flex-1 text-xs ${secondaryActionClass}`}
                  >
                    Detalhes
                  </Link>
                  {video.status === "READY" && (
                    <a
                      href={`/api/videos/${video.id}/download?type=video`}
                      className={`flex-1 text-xs ${outlineActionClass}`}
                    >
                      Vídeo
                    </a>
                  )}
                  {video.status === "READY" && video.transcription && (
                    <a
                      href={`/api/videos/${video.id}/download?type=srt`}
                      className={`flex-1 text-xs ${outlineActionClass}`}
                    >
                      SRT
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
