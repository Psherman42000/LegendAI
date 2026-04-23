"use client";

import { useQuery } from "@tanstack/react-query";

type Video = {
  id: string;
  status: string;
  progress?: number;
};

async function fetchVideo(videoId: string): Promise<Video> {
  const response = await fetch(`/api/videos/${videoId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar o vídeo");
  }
  return response.json() as Promise<Video>;
}

export function useVideoProcessing(videoId: string) {
  const query = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => fetchVideo(videoId),
    enabled: Boolean(videoId),
    refetchInterval: (queryState) => (queryState.state.data?.status === "READY" ? false : 5000),
  });

  const status = query.data?.status ?? "QUEUED";
  const progress = query.data?.progress ?? 0;

  return {
    ...query,
    video: query.data ?? null,
    status,
    progress,
    isProcessing: ["PROCESSING", "TRANSCRIBING", "CORRECTING", "QUEUED"].includes(status),
    isReady: status === "READY",
    isError: status === "ERROR",
  };
}
