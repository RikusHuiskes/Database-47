
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activiteiten dichtbij — DATABASE 47",
  description: "Ontdek activiteiten en evenementen rond Duras, Monteton, Eymet en omgeving.",
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
