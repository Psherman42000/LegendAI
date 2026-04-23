"use client";

import { useAvulsoPrice } from "@/hooks/useAvulsoPrice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AvulsoCalculator({ durationSeconds }: { durationSeconds: number }) {
  const { priceFormatted, isMinimumApplied } = useAvulsoPrice(durationSeconds);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compra avulsa</CardTitle>
        <CardDescription>R$ 0,015 por segundo com mínimo de R$ 2,00.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-lg font-semibold">
          Este vídeo tem {durationSeconds}s · Custo {priceFormatted}
        </div>
        {isMinimumApplied ? (
          <p className="text-sm text-[var(--text-secondary)]">
            O mínimo de cobrança foi aplicado para cobrir as taxas.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button>Pagar com PIX</Button>
          <Button variant="outline">Pagar com Cartão</Button>
        </div>
      </CardContent>
    </Card>
  );
}
