import Link from "next/link";
import { cn } from "@/lib/utils";

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type VideoPaginationProps = {
  pagination: Pagination;
  search: string;
};

export function VideoPagination({ pagination, search }: VideoPaginationProps) {
  const { page, totalPages, total, limit } = pagination;

  function getPageUrl(targetPage: number): string {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    if (search) params.set("search", search);
    return `/videos?${params.toString()}`;
  }

  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  const visiblePages = Array.from(
    { length: end - start + 1 },
    (_, i) => start + i
  );
  const fromCount = (page - 1) * limit + 1;
  const toCount = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Mostrando {fromCount}–{toCount} de {total} vídeos
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={getPageUrl(page - 1)}
          className={cn(
            "inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition hover:border-[rgba(170,255,0,0.24)] hover:bg-white/5",
            page <= 1 && "pointer-events-none opacity-40"
          )}
        >
          Anterior
        </Link>

        {start > 1 && (
          <>
            <PageLink page={1} current={page} getUrl={getPageUrl} />
            {start > 2 && (
              <span className="px-2 text-sm text-[var(--text-secondary)]">
                ...
              </span>
            )}
          </>
        )}

        {visiblePages.map((p) => (
          <PageLink key={p} page={p} current={page} getUrl={getPageUrl} />
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && (
              <span className="px-2 text-sm text-[var(--text-secondary)]">
                ...
              </span>
            )}
            <PageLink page={totalPages} current={page} getUrl={getPageUrl} />
          </>
        )}

        <Link
          href={getPageUrl(page + 1)}
          className={cn(
            "inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition hover:border-[rgba(170,255,0,0.24)] hover:bg-white/5",
            page >= totalPages && "pointer-events-none opacity-40"
          )}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}

function PageLink({
  page,
  current,
  getUrl,
}: {
  page: number;
  current: number;
  getUrl: (page: number) => string;
}) {
  return (
    <Link
      href={getUrl(page)}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-medium transition",
        page === current
          ? "border-[rgba(170,255,0,0.4)] bg-[rgba(170,255,0,0.08)] text-[var(--primary)]"
          : "border-[var(--border)] hover:border-[rgba(170,255,0,0.24)] hover:bg-white/5"
      )}
    >
      {page}
    </Link>
  );
}
