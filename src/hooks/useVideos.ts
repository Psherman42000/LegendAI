"use client";

import { useEffect, useState } from "react";

export type VideoItem = {
  id: string;
  title: string;
  status: string;
  duration: string;
  createdAt: string;
};

export function useVideos() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const res = await fetch("/api/videos");
        if (!res.ok) throw new Error("Falha ao carregar vídeos");
        const data = await res.json();
        setVideos(data.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchVideos();
  }, []);

  return { videos, loading, error };
}
