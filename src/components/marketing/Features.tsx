const items = [
  {
    title: "Entende o Português BR",
    description: "Não confunde 'né' com 'não é'. Não erra Anitta, Flamengo ou Mercado Livre.",
  },
  {
    title: "Pronto em minutos",
    description: "Faça upload, receba a transcrição, ajuste e baixe. Sem instalar nada.",
  },
  {
    title: "Sem assinar em dólar",
    description: "Pague em reais. PIX aceito. Planos a partir de R$ 29/mês.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="surface rounded-[var(--radius)] p-6">
            <div className="text-xl font-semibold">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
