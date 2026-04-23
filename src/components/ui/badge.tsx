import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
};

export function Badge({ className, children, tone = "default", ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "default" && "bg-white/8 text-[var(--text)]",
        tone === "success" && "bg-emerald-500/15 text-emerald-300",
        tone === "warning" && "bg-amber-500/15 text-amber-300",
        tone === "danger" && "bg-red-500/15 text-red-300",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
