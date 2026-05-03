"use client";

import { useState } from "react";
import { PixPayment } from "@/components/payment/PixPayment";
import { CardPayment } from "@/components/payment/CardPayment";
import { Button } from "@/components/ui/button";

type PaymentMethod = "PIX" | "CARD" | null;

export default function PaymentPage() {
  const [method, setMethod] = useState<PaymentMethod>(null);

  return (
    <main className="space-y-8 p-6 lg:p-10">
      <header className="space-y-3">
        <h1 className="text-display text-3xl font-bold">Pagamento Avulso</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Faça um pagamento único para liberar o processamento do seu vídeo.
          Escolha PIX (instantâneo) ou Cartão de Crédito.
        </p>
      </header>

      {!method ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <button
            onClick={() => setMethod("PIX")}
            className="surface group rounded-xl p-8 text-left transition-all hover:border-[rgba(170,255,0,0.3)] hover:shadow-[0_0_0_1px_rgba(170,255,0,0.12),0_12px_40px_rgba(170,255,0,0.06)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-dim)]">
              <svg
                className="h-6 w-6 text-[var(--primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold">PIX</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Pagamento instantâneo. Gere o QR Code e pague pelo app do seu banco.
            </p>
          </button>

          <button
            onClick={() => setMethod("CARD")}
            className="surface group rounded-xl p-8 text-left transition-all hover:border-[rgba(170,255,0,0.3)] hover:shadow-[0_0_0_1px_rgba(170,255,0,0.12),0_12px_40px_rgba(170,255,0,0.06)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-dim)]">
              <svg
                className="h-6 w-6 text-[var(--primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold">Cartão de Crédito</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Pagamento processado na hora. Aceitamos todas as bandeiras.
            </p>
          </button>
        </div>
      ) : (
        <div className="max-w-lg space-y-4">
          <Button variant="ghost" onClick={() => setMethod(null)}>
            ← Escolher outro método
          </Button>

          {method === "PIX" ? (
            <PixPayment
              durationSeconds={60}
              videoTitle="Pagamento avulso"
              onBack={() => setMethod(null)}
            />
          ) : (
            <CardPayment
              durationSeconds={60}
              videoTitle="Pagamento avulso"
              onBack={() => setMethod(null)}
            />
          )}
        </div>
      )}
    </main>
  );
}
