"use client";

import { useState } from "react";
import { useAvulsoPrice } from "@/hooks/useAvulsoPrice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AvulsoCalculator({ durationSeconds, videoTitle = "Pagamento avulso" }: { durationSeconds: number; videoTitle?: string }) {
  const { priceFormatted, isMinimumApplied } = useAvulsoPrice(durationSeconds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAvulsoPayment(method: "PIX" | "CARD") {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/avulso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds,
          paymentMethod: method,
          videoTitle,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error ?? "Erro ao processar pagamento");
        return;
      }

      // For CARD: redirect to MP checkout page
      // For PIX: redirect to MP checkout page (which shows PIX option)
      if (json.data?.initPoint) {
        window.location.href = json.data.initPoint;
      } else if (json.data?.pixQrCodeText) {
        // PIX was generated directly — show QR code inline in the future
        // For now, redirect to billing with success status
        window.location.href = `${window.location.origin}/billing?checkout=success`;
      } else {
        setError("Resposta inesperada do servidor");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

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
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button onClick={() => handleAvulsoPayment("PIX")} disabled={loading} className="min-h-[44px] w-full sm:w-auto">
            {loading ? "Processando..." : "Pagar com PIX"}
          </Button>
          <Button variant="outline" onClick={() => handleAvulsoPayment("CARD")} disabled={loading} className="min-h-[44px] w-full sm:w-auto">
            {loading ? "Processando..." : "Pagar com Cartão"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}