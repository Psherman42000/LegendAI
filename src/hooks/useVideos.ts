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
    const controller = new AbortController();

    async function fetchVideos() {
      try {
        const res = await fetch("/api/videos", { signal: controller.signal });
        if (!res.ok) throw new Error("Falha ao carregar vídeos");
        const data = await res.json();
        setVideos(data.data ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();

    return () => controller.abort();
  }, []);

  return { videos, loading, error };
}
