export function Comparison() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="surface rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[var(--text-secondary)]">
            <tr>
              <th className="px-6 py-4">Feature</th>
              <th className="px-6 py-4">LegendaAI</th>
              <th className="px-6 py-4">CapCut</th>
              <th className="px-6 py-4">Submagic</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Preço", "R$ 29/mês", "R$ 39/mês", "$20/mês"],
              ["Português BR nativo", "✅", "⚠️", "❌"],
              ["PIX / Boleto", "✅", "❌", "❌"],
              ["Editor inline", "✅", "❌", "✅"],
              ["Compra avulsa", "✅", "❌", "❌"],
            ].map((row) => (
              <tr key={row[0]} className="border-t border-white/5">
                {row.map((cell) => (
                  <td key={cell} className="px-6 py-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
