import { Progress } from "@/components/ui/progress";

export function UsageBar({ used = 0, limit = 100 }: { used?: number; limit?: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
        <span>Uso do mês</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
