"use client";

import { useState } from "react";

interface UploadedVideo {
  id: string;
  url: string;
  title: string;
}

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);

  async function uploadFile(file: File): Promise<{ id: string; url: string; title: string; duration: number } | null> {
    setIsUploading(true);
    setError(null);
    setProgress(10);

    try {
      // Create video record via API
      const objectUrl = URL.createObjectURL(file);
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          originalUrl: objectUrl,
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
      const result = {
        id: data.data.videoId,
        url: objectUrl,
        title: file.name,
        duration: 0,
      };
      setUploadedVideo({ id: result.id, url: result.url, title: result.title });
      setProgress(100);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadUrl(url: string): Promise<{ id: string; url: string; title: string; duration: number } | null> {
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
      const result = {
        id: data.data.videoId,
        url,
        title: "Vídeo remoto",
        duration: 0,
      };
      setUploadedVideo({ id: result.id, url: result.url, title: result.title });
      setProgress(100);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload");
      return null;
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
