"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

export function PaymentMethodSelector() {
  const [method, setMethod] = useState<"PIX" | "CARD">("PIX");

  return (
    <div className="flex gap-3">
      <Button variant={method === "PIX" ? "primary" : "outline"} onClick={() => setMethod("PIX")}>
        PIX
      </Button>
      <Button variant={method === "CARD" ? "primary" : "outline"} onClick={() => setMethod("CARD")}>
        Cartão
      </Button>
    </div>
  );
}
