"use client";

import { useEffect, useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

interface PlanData {
  plan: PlanId;
  videosUsed: number;
  videosLimit: number;
  isAtLimit: boolean;
  canUpload: boolean;
  upgradeUrl: string;
}

export function usePlan() {
  const [data, setData] = useState<PlanData>({
    plan: "FREE",
    videosUsed: 0,
    videosLimit: PLANS.FREE.videosPerMonth,
    isAtLimit: false,
    canUpload: true,
    upgradeUrl: "/billing",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const response = await fetch("/api/user/usage");
        if (!response.ok) throw new Error("Failed to fetch plan");
        const result = await response.json();
        
        if (result.ok && result.data) {
          const plan = (result.data.plan ?? "FREE") as PlanId;
          const videosUsed = result.data.videosUsed ?? 0;
          const videosLimit = PLANS[plan]?.videosPerMonth ?? PLANS.FREE.videosPerMonth;
          
          setData({
            plan,
            videosUsed,
            videosLimit,
            isAtLimit: videosUsed >= videosLimit,
            canUpload: videosUsed < videosLimit,
            upgradeUrl: "/billing",
          });
        }
      } catch {
        // Keep defaults on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlan();
  }, []);

  return { ...data, isLoading };
}
