"use client";

import { useState } from "react";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<{ url: string; title: string } | null>(null);

  async function uploadFile(file: File): Promise<void> {
    setIsUploading(true);
    setError(null);
    setProgress(10);

    try {
      setUploadedVideo({ url: URL.createObjectURL(file), title: file.name });
      setProgress(100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadUrl(url: string): Promise<void> {
    setIsUploading(true);
    setError(null);
    setProgress(100);
    setUploadedVideo({ url, title: "Vídeo remoto" });
    setIsUploading(false);
  }

  return {
    uploadFile,
    uploadUrl,
    isUploading,
    progress,
    error,
    uploadedVideo,
  };
}
