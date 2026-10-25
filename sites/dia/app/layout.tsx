import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dia — anotações e planejamento",
  description: "Seu planejamento diário e semanal.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
