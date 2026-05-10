"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type CheckoutStatus = "success" | "failure" | "pending" | null;

export function CheckoutStatus() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const payment = searchParams.get("payment");

    if (checkout === "success") {
      setStatus("success");
      setVisible(true);
    } else if (checkout === "mock") {
      // Legacy mock checkout — treat as success for now
      setStatus("success");
      setVisible(true);
    } else if (payment === "failed") {
      setStatus("failure");
      setVisible(true);
    } else if (payment === "pending") {
      setStatus("pending");
      setVisible(true);
    }
  }, [searchParams]);

  if (!visible || !status) return null;

  const config = {
    success: {
      icon: "✓",
      title: "Pagamento confirmado!",
      message: "Sua assinatura foi ativada. Bem-vindo ao Legendai!",
      bgColor: "bg-green-900/20",
      textColor: "text-green-400",
      borderColor: "border-green-800",
    },
    failure: {
      icon: "✕",
      title: "Pagamento recusado",
      message: "Não foi possível processar o pagamento. Tente novamente ou escolha outro método.",
      bgColor: "bg-red-900/20",
      textColor: "text-red-400",
      borderColor: "border-red-800",
    },
    pending: {
      icon: "⏳",
      title: "Pagamento pendente",
      message: "Seu pagamento está sendo processado. Você será notificado quando for confirmado.",
      bgColor: "bg-yellow-900/20",
      textColor: "text-yellow-400",
      borderColor: "border-yellow-800",
    },
  }[status];

  return (
    <div
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 transition-all`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-2xl ${config.textColor}`}>{config.icon}</span>
        <div className="flex-1">
          <h3 className={`font-semibold ${config.textColor}`}>{config.title}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{config.message}</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}