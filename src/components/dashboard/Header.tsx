import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header({
  title,
  description,
  showUploadButton = false,
}: {
  title: string;
  description: string;
  showUploadButton?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      {showUploadButton && (
        <Link href="/upload">
          <Button>Upload novo vídeo</Button>
        </Link>
      )}
    </div>
  );
}
