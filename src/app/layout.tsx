import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "LegendaAI",
  description: "Legendas em português BR com IA, pagamento em reais e fluxo pronto para mobile.",
  metadataBase: new URL("https://legendaai.com.br"),
  applicationName: "LegendaAI",
  authors: [{ name: "LegendaAI" }],
  openGraph: {
    title: "LegendaAI",
    description: "Legendas em português BR. Sem erro. Sem dólar.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
