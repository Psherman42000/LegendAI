"use client";

import { useState } from "react";

interface UploadedVideo {
  id: string;
  url: string;
  title: string;
  status: string;
}

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);

  async function uploadFile(file: File): Promise<void> {
    setIsUploading(true);
    setError(null);
    setProgress(10);

    try {
      // Create video record via API
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          originalUrl: URL.createObjectURL(file),
          duration: 0, // Will be detected server-side
          fileSize: file.size,
          mimeType: file.type,
          paymentType: "SUBSCRIPTION",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      setUploadedVideo({
        id: data.data.videoId,
        url: URL.createObjectURL(file),
        title: file.name,
        status: data.data.status,
      });
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
    setProgress(50);

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Vídeo remoto",
          originalUrl: url,
          duration: 0,
          paymentType: "SUBSCRIPTION",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      setUploadedVideo({
        id: data.data.videoId,
        url,
        title: "Vídeo remoto",
        status: data.data.status,
      });
      setProgress(100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload");
    } finally {
      setIsUploading(false);
    }
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
