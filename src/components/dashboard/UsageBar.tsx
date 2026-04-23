import { Progress } from "@/components/ui/progress";

export function UsageBar({ value = 42 }: { value?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
        <span>Uso do mês</span>
        <span>{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}
