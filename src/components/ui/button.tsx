import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  children: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--primary)] text-black shadow-[0_0_0_1px_rgba(170,255,0,0.12),0_12px_40px_rgba(170,255,0,0.12)] hover:translate-y-[-1px]",
        variant === "secondary" &&
          "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-[rgba(170,255,0,0.22)]",
        variant === "ghost" && "bg-transparent text-[var(--text)] hover:bg-white/5",
        variant === "outline" &&
          "border border-[var(--border)] bg-transparent text-[var(--text)] hover:border-[rgba(170,255,0,0.24)] hover:bg-white/5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
