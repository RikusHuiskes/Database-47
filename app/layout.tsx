import {localizeMetadata} from './i18n/server';

import type { Metadata } from "next";
import {SITE_ORIGIN, SITE_SOCIAL_IMAGE, siteOpenGraph} from "../lib/site-sharing";
import "./globals.css";
import {cookies} from 'next/headers';
import {LanguageProvider} from './i18n/Language';
import {LOCALE_COOKIE,localeFrom} from '../lib/i18n';

const sourceMetadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: siteOpenGraph,
  twitter: {card: "summary_large_image", title: "Côte de Duras — Agenda & guide local", description: "Événements et bonnes adresses autour de Duras.", images: [SITE_SOCIAL_IMAGE]},
  title: "Côte de Duras | Evenementen en informatie",
  description: "Evenementen en informatie voor elke dag binnen een straal van 50 kilometer rond Duras.",
  icons: {
    icon: [{ url: "/cote-de-duras-icon.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/cote-de-duras-apple-icon.png", sizes: "180x180" }],
  },
};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale=localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#f5f7fa",
          color: "#172033",
        }}
      >
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
