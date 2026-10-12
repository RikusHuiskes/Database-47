
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DATABASE 47",
  description: "Regionale activiteitenagenda voor Lot-et-Garonne",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
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
