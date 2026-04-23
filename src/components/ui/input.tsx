import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[rgba(170,255,0,0.4)]",
        className,
      )}
      {...props}
    />
  );
}
