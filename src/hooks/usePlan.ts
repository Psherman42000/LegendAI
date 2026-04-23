"use client";

import { useMemo } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

export function usePlan() {
  return useMemo(() => {
    const plan: PlanId = "FREE";
    const videosUsed = 0;
    const videosLimit = PLANS[plan].videosPerMonth;
    return {
      plan,
      videosUsed,
      videosLimit,
      isAtLimit: videosUsed >= videosLimit,
      canUpload: videosUsed < videosLimit,
      upgradeUrl: "/billing",
    };
  }, []);
}
