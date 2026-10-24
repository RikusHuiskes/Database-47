
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ontdek Lot-et-Garonne | Agenda, gemeenten en uitstapjes",
  description: "Ontdek evenementen, gemeenten en lokale uitstapjes in Lot-et-Garonne. Zoek activiteiten in Duras en omgeving.",
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
