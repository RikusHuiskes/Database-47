
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Côte de Duras | Evenementen en informatie",
  description: "Evenementen en informatie voor elke dag binnen een straal van 50 kilometer rond Duras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#f5f7fa",
          color: "#172033",
        }}
      >
        {children}
      </body>
    </html>
  );
}
