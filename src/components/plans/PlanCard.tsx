"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { PlanId } from "@/lib/plans";

type PlanData = {
  id: PlanId;
  name: string;
  price: number;
  videosPerMonth: number;
  maxDurationSeconds: number;
  features: readonly string[];
  mpPlanId: string | null;
};

export function PlanCard({
  plan,
  isCurrentPlan = false,
  highlighted = false,
}: {
  plan: PlanData;
  isCurrentPlan?: boolean;
  highlighted?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (isCurrentPlan) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erro ao processar assinatura");
        return;
      }

      if (json.ok && json.data?.initPoint) {
        window.location.href = json.data.initPoint;
      } else {
        setError("Resposta inesperada do servidor");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className={`relative flex flex-col ${highlighted ? "ring-2 ring-[var(--primary)]" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>
              {plan.price === 0 ? "Grátis" : `${formatCurrency(plan.price)}/mês`}
            </CardDescription>
          </div>
          {highlighted ? <Badge tone="success">Mais escolhido</Badge> : null}
          {isCurrentPlan && <Badge tone="default">Plano atual</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="flex-1 space-y-2 text-sm text-[var(--text-secondary)]">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--primary)]">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : null}

        <Button
          className="w-full"
          disabled={isLoading || isCurrentPlan}
          onClick={handleSubscribe}
          variant={highlighted ? "primary" : "outline"}
        >
          {isLoading
            ? "Carregando…"
            : isCurrentPlan
              ? "Plano atual"
              : plan.price === 0
                ? "Começar grátis"
                : "Assinar agora"}
        </Button>
      </CardContent>
    </Card>
  );
}
