"use client";

export default function PlansError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="space-y-8 p-6 lg:p-10">
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h2 className="text-2xl font-bold">Algo deu errado</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Não foi possível carregar a página de planos.
        </p>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-[var(--primary)] px-6 py-2 text-sm font-semibold text-black"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
