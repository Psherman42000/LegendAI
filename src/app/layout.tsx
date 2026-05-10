import type { Metadata } from "next";
import "./globals.css";
import { NextAuthProvider } from "@/components/auth/NextAuthProvider";

export const metadata: Metadata = {
  title: "Legendai",
  description: "Legendas em português BR com IA, pagamento em reais e fluxo pronto para mobile.",
  metadataBase: new URL("https://legendai.com.br"),
  applicationName: "Legendai",
  authors: [{ name: "Legendai" }],
  openGraph: {
    title: "Legendai",
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
      className="h-full antialiased"
    >
      <body className="min-h-screen bg-background text-foreground">
        <NextAuthProvider>{children}</NextAuthProvider>
      </body>
    </html>
  );
}
