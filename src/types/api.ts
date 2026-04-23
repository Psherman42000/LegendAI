import type { VideoStatus } from "@/types/video";

export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type VideoApiResponse = {
  id: string;
  status: VideoStatus;
};
