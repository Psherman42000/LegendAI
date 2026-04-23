import { create } from "zustand";

type UploadState = {
  progress: number;
  fileName: string | null;
  setProgress: (progress: number) => void;
  setFileName: (fileName: string | null) => void;
};

export const useUploadStore = create<UploadState>((set) => ({
  progress: 0,
  fileName: null,
  setProgress: (progress) => set({ progress }),
  setFileName: (fileName) => set({ fileName }),
}));
