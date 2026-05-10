import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanId } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";

export function PlanCard({
  plan,
  price,
  features,
  highlighted = false,
}: {
  plan: PlanId;
  price: number;
  features: readonly string[];
  highlighted?: boolean;
}) {
  return (
    <Card className={highlighted ? "glow" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{plan}</CardTitle>
            <CardDescription>{formatCurrency(price)}/mês</CardDescription>
          </div>
          {highlighted ? <Badge>Mais escolhido</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          {features.map((feature) => (
            <li key={feature}>• {feature}</li>
          ))}
        </ul>
        <Button className="w-full min-h-[44px]">{highlighted ? "Assinar agora" : "Selecionar"}</Button>
      </CardContent>
    </Card>
  );
}
