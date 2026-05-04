export default function PlansLoading() {
  return (
    <main className="space-y-8 p-6 lg:p-10">
      <header className="space-y-3">
        <div className="h-9 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-5 w-80 animate-pulse rounded bg-white/10" />
      </header>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="surface flex flex-col gap-4 rounded-xl p-6"
          >
            <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-32 animate-pulse rounded bg-white/10" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 w-full animate-pulse rounded bg-white/10" />
              ))}
            </div>
            <div className="mt-auto h-10 w-full animate-pulse rounded-xl bg-white/10" />
          </div>
        ))}
      </div>
    </main>
  );
}
