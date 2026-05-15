"use client";

import { useState } from "react";
import { useAvulsoPrice } from "@/hooks/useAvulsoPrice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PixData {
  pixQrCodeText: string;
  pixQrCode?: string; // base64 image
  pixExpiration?: string;
}

export function AvulsoCalculator({ durationSeconds, videoTitle = "Pagamento avulso" }: { durationSeconds: number; videoTitle?: string }) {
  const { priceFormatted, isMinimumApplied } = useAvulsoPrice(durationSeconds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);

  async function handleAvulsoPayment(method: "PIX" | "CARD") {
    setLoading(true);
    setError(null);
    setPixData(null);

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
      if (method === "CARD" && json.data?.initPoint) {
        window.location.href = json.data.initPoint;
        return;
      }

      // For PIX: show QR code inline if available, otherwise redirect
      if (json.data?.pixQrCodeText) {
        setPixData({
          pixQrCodeText: json.data.pixQrCodeText,
          pixQrCode: json.data.pixQrCode,
          pixExpiration: json.data.pixExpiration,
        });
      } else if (json.data?.initPoint) {
        // Fallback: redirect to MP checkout which shows PIX option
        window.location.href = json.data.initPoint;
      } else {
        setError("Resposta inesperada do servidor");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function copyPixCode() {
    if (pixData?.pixQrCodeText) {
      navigator.clipboard.writeText(pixData.pixQrCodeText);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compra avulsa</CardTitle>
        <CardDescription>R$ 0,015 por segundo com mínimo de R$ 2,00.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pixData ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Escaneie o QR Code ou copie o código PIX para pagar:
            </p>
            {pixData.pixQrCode ? (
              <img
                src={`data:image/png;base64,${pixData.pixQrCode}`}
                alt="QR Code PIX"
                className="w-48 h-48 rounded-lg border border-[var(--border)]"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)]">
                <span className="text-sm text-[var(--text-secondary)]">QR Code indisponível</span>
              </div>
            )}
            <div className="w-full">
              <label className="text-xs text-[var(--text-secondary)]">Código PIX &quot;Copia e Cola&quot;:</label>
              <div className="flex gap-2 mt-1">
                <input
                  readOnly
                  value={pixData.pixQrCodeText}
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-mono truncate"
                />
                <Button variant="outline" onClick={copyPixCode}>
                  Copiar
                </Button>
              </div>
            </div>
            {pixData.pixExpiration && (
              <p className="text-xs text-[var(--text-secondary)]">
                Expira em: {new Date(pixData.pixExpiration).toLocaleString("pt-BR")}
              </p>
            )}
            <Button variant="outline" onClick={() => setPixData(null)} className="mt-2">
              Voltar
            </Button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}