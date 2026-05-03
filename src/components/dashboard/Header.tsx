import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header({ title, description }: { title: string; description: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/5 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      {title === "Dashboard" && (
        <Link href="/upload">
          <Button>Upload novo vídeo</Button>
        </Link>
      )}
    </header>
  );
}
