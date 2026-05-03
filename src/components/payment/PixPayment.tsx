"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PixData = {
  paymentId: string;
  amount: number;
  amountFormatted: string;
  pixQrCode: string;
  pixQrCodeText: string;
  pixExpiration: string;
};

type Props = {
  durationSeconds: number;
  videoTitle?: string;
  onSuccess?: (data: PixData) => void;
  onBack?: () => void;
};

export function PixPayment({ durationSeconds, videoTitle, onSuccess, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGeneratePix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds, videoTitle }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Erro ao gerar PIX");
        return;
      }
      setPixData(json.data);
      onSuccess?.(json.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [durationSeconds, videoTitle, onSuccess]);

  const handleCopyCode = useCallback(async () => {
    if (!pixData?.pixQrCodeText) return;
    try {
      await navigator.clipboard.writeText(pixData.pixQrCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = pixData.pixQrCodeText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [pixData]);

  if (pixData) {
    const expiresAt = new Date(pixData.pixExpiration);
    const expiresIn = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));

    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagar com PIX</CardTitle>
          <CardDescription>
            Escaneie o QR Code abaixo ou copie o código PIX para pagar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="surface rounded-xl p-4">
              {/* Mock QR Code — a real integration would render a proper QR */}
              <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-white p-4">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <rect width="100" height="100" fill="white" />
                  <g fill="black">
                    {/* Top-left finder */}
                    <rect x="8" y="8" width="28" height="28" rx="4" />
                    <rect x="12" y="12" width="20" height="20" fill="white" rx="2" />
                    <rect x="16" y="16" width="12" height="12" rx="1" />
                    {/* Top-right finder */}
                    <rect x="64" y="8" width="28" height="28" rx="4" />
                    <rect x="68" y="12" width="20" height="20" fill="white" rx="2" />
                    <rect x="72" y="16" width="12" height="12" rx="1" />
                    {/* Bottom-left finder */}
                    <rect x="8" y="64" width="28" height="28" rx="4" />
                    <rect x="12" y="68" width="20" height="20" fill="white" rx="2" />
                    <rect x="16" y="72" width="12" height="12" rx="1" />
                    {/* Random data modules */}
                    {[40, 46, 52, 58].map((x) =>
                      [34, 40, 46, 52, 58, 64].map((y) => (
                        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="0.5" />
                      )),
                    )}
                    {[34, 40, 46, 52].map((x) =>
                      [34, 40, 46, 52].map((y) => (
                        <rect key={`d-${x}-${y}`} x={x} y={y} width="4" height="4" rx="0.5" />
                      )),
                    )}
                  </g>
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--primary)]">{pixData.amountFormatted}</p>
            {expiresIn > 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Código expira em {expiresIn} minuto{expiresIn !== 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-sm text-[var(--destructive)]">Código expirado. Gere um novo.</p>
            )}
          </div>

          <div className="w-full space-y-2">
            <label htmlFor="pix-code" className="text-xs font-medium text-[var(--text-secondary)]">
              Código PIX copia e cola
            </label>
            <div className="flex gap-2">
              <Input
                id="pix-code"
                readOnly
                value={pixData.pixQrCodeText}
                className="flex-1 text-xs"
              />
              <Button variant="outline" onClick={handleCopyCode} className="shrink-0">
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </div>

          {onBack && (
            <Button variant="ghost" onClick={onBack} className="w-full">
              Voltar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagar com PIX</CardTitle>
        <CardDescription>
          Gere um código PIX para pagamento instantâneo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <p className="text-sm text-[var(--text-secondary)]">
          Após gerar o PIX, você terá 30 minutos para realizar o pagamento.
          O processamento é automático e instantâneo.
        </p>
        <div className="flex gap-3">
          <Button onClick={handleGeneratePix} disabled={loading}>
            {loading ? "Gerando..." : "Gerar PIX"}
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack} disabled={loading}>
              Voltar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
