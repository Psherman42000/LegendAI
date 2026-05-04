"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CardResult = {
  paymentId: string;
  amount: number;
  amountFormatted: string;
  status: string;
  paidAt: string;
  message: string;
};

type Props = {
  durationSeconds: number;
  videoTitle?: string;
  onSuccess?: (data: CardResult) => void;
  onBack?: () => void;
};

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

export function CardPayment({ durationSeconds, videoTitle, onSuccess, onBack }: Props) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CardResult | null>(null);

  const isValid =
    cardNumber.replace(/\s/g, "").length === 16 &&
    cardHolder.trim().length > 0 &&
    cardExpiry.replace("/", "").length === 4 &&
    cardCvv.length >= 3;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds,
          videoTitle,
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardHolder,
          cardExpiry,
          cardCvv,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Erro ao processar pagamento");
        return;
      }
      setResult(json.data);
      onSuccess?.(json.data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [isValid, durationSeconds, videoTitle, cardNumber, cardHolder, cardExpiry, cardCvv, onSuccess]);

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagamento confirmado</CardTitle>
          <CardDescription>
            {result.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
            <svg
              className="h-8 w-8 text-[var(--success)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[var(--primary)]">{result.amountFormatted}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Pagamento aprovado em {result.paidAt ? new Date(result.paidAt).toLocaleString("pt-BR") : ""}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagar com Cartão</CardTitle>
        <CardDescription>
          Preencha os dados do cartão de crédito.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ⚠️ MOCK ONLY - DO NOT USE IN PRODUCTION (PCI-DSS violation)
             Handling raw card data (number, CVV, expiry) client-side and
             sending it to your server is a PCI-DSS violation. In production,
             use a tokenization solution (Stripe Elements, etc.) so raw PAN
             never reaches your server. */}
        <div className="space-y-2">
          <label htmlFor="card-number" className="text-xs font-medium text-[var(--text-secondary)]">
            Número do cartão
          </label>
          <Input
            id="card-number"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            inputMode="numeric"
            maxLength={19}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="card-holder" className="text-xs font-medium text-[var(--text-secondary)]">
            Nome do titular
          </label>
          <Input
            id="card-holder"
            placeholder="Como está no cartão"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="card-expiry" className="text-xs font-medium text-[var(--text-secondary)]">
              Validade
            </label>
            <Input
              id="card-expiry"
              placeholder="MM/AA"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
              inputMode="numeric"
              maxLength={5}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="card-cvv" className="text-xs font-medium text-[var(--text-secondary)]">
              CVV
            </label>
            <Input
              id="card-cvv"
              placeholder="123"
              value={cardCvv}
              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSubmit} disabled={loading || !isValid}>
            {loading ? "Processando..." : "Pagar"}
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack} disabled={loading}>
              Voltar
            </Button>
          )}
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          Pagamento processado de forma segura. Seus dados não são armazenados.
        </p>
      </CardContent>
    </Card>
  );
}
