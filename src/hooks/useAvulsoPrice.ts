"use client";

import { useMemo } from "react";
import { calcularPrecoAvulso } from "@/lib/plans";

export function useAvulsoPrice(durationSeconds: number) {
  return useMemo(() => {
    const price = calcularPrecoAvulso(durationSeconds);
    return {
      priceInCentavos: price.priceInCentavos,
      priceFormatted: price.priceFormatted,
      isMinimumApplied: price.isMinimumApplied,
      minimumPrice: 200,
    };
  }, [durationSeconds]);
}
