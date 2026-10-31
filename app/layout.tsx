
import type { Metadata } from "next";
import "./globals.css";
import {REGION} from '../lib/site-region';

export const metadata: Metadata = {
  title: "Côte de Duras | Evenementen en informatie",
  description: "Evenementen en informatie voor elke dag binnen een straal van 50 kilometer rond Duras.",
  icons: {
    icon: [{ url: "/cote-de-duras-icon.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/cote-de-duras-apple-icon.png", sizes: "180x180" }],
  },
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
        <aside className="regional-site-identity"><strong>{REGION.brand}</strong><span>Afzonderlijke demo-omgeving · {REGION.radius} km</span><a href="/regio-overzicht">Website-overzicht voor de beheerder →</a></aside>
        {children}
      </body>
    </html>
  );
}
