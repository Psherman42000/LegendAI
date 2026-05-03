"use client";

import { VideoCard } from "./VideoCard";
import { useVideos } from "@/hooks/useVideos";

export function VideoList() {
  const { videos, loading, error } = useVideos();

  if (loading) {
    return <div className="text-sm text-[var(--text-secondary)]">Carregando vídeos...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">Erro: {error}</div>;
  }

  if (videos.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)]">
        Nenhum vídeo ainda.{" "}
        <a href="/upload" className="text-[var(--primary)] underline">Envie seu primeiro vídeo</a>.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          id={video.id}
          title={video.title}
          status={video.status}
          duration={video.duration}
        />
      ))}
    </div>
  );
}
