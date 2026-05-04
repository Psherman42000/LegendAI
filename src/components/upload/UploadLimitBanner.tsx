"use client";

import Link from "next/link";
import { usePlan } from "@/hooks/usePlan";
import { Button } from "@/components/ui/button";

export function UploadLimitBanner() {
  const { plan, videosUsed, videosLimit, isAtLimit, canUpload, isLoading } = usePlan();

  if (isLoading) {
    return (
      <div className="surface rounded-[var(--radius)] p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  const percentage = Math.min((videosUsed / videosLimit) * 100, 100);

  return (
    <div className={`surface rounded-[var(--radius)] p-4 ${isAtLimit ? "border border-red-500/20" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">
              {plan === "FREE" ? "Plano Grátis" : `Plano ${plan}`}
            </span>
            <span className={isAtLimit ? "text-red-400" : "text-[var(--primary)]"}>
              {videosUsed} / {videosLimit} vídeos
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all ${
                isAtLimit ? "bg-red-500" : "bg-[var(--primary)]"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        {isAtLimit && (
          <Link href="/plans">
            <Button>Fazer upgrade</Button>
          </Link>
        )}
      </div>
      {isAtLimit && (
        <p className="mt-2 text-xs text-red-400">
          Você atingiu o limite mensal de vídeos. Faça upgrade para continuar.
        </p>
      )}
    </div>
  );
}