import { create } from "zustand";
import type { SubtitleStyle } from "@/types/subtitle";

type EditorState = {
  selectedStyle: SubtitleStyle;
  setSelectedStyle: (style: SubtitleStyle) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  selectedStyle: "classic",
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  currentTime: 0,
  setCurrentTime: (time) => set({ currentTime: time }),
}));
