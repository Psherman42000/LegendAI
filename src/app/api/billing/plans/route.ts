import { NextResponse } from "next/server";
import { PLANS } from "@/lib/plans";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: Object.values(PLANS).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      videosPerMonth: plan.videosPerMonth,
      maxDurationSeconds: plan.maxDurationSeconds,
      features: plan.features,
    })),
  });
}
