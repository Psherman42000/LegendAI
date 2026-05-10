import Link from "next/link";
import { MobileNav } from "./MobileNav";

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
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <h1 className="text-display text-xl font-bold md:text-2xl lg:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)] hidden sm:block">{description}</p>
        </div>
      </div>
      {showUploadButton && (
        <Link
          href="/upload"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(170,255,0,0.12),0_12px_40px_rgba(170,255,0,0.12)] transition-all duration-200 hover:translate-y-[-1px] min-h-[44px]"
        >
          Upload novo vídeo
        </Link>
      )}
    </div>
  );
}
