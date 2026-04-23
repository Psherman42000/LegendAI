import { create } from "zustand";
import type { PlanId } from "@/lib/plans";

type UserState = {
  name: string | null;
  email: string | null;
  plan: PlanId;
  setUser: (user: Pick<UserState, "name" | "email" | "plan">) => void;
};

export const useUserStore = create<UserState>((set) => ({
  name: null,
  email: null,
  plan: "FREE",
  setUser: (user) => set(user),
}));
