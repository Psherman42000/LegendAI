import Link from "next/link";

const footerLinks = [
  { href: "/terms", label: "Termos" },
  { href: "/privacy", label: "Privacidade" },
  { href: "/contact", label: "Contato" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-8 text-sm text-[var(--text-secondary)] sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p>Feito com 🇧🇷 para criadores brasileiros</p>
        <div className="flex gap-5">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[var(--text)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
