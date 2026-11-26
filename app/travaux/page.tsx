import Image from 'next/image';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, localeFrom } from '../../lib/i18n';
import { travauxCopy } from '../../lib/travaux-copy';
import { travauxCommunes, travauxEnabled } from '../../lib/travaux-server';
import Travaux from './Travaux';
import styles from './travaux.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Travaux et artisans autour de Duras | Côte de Duras',
    description: 'Déposez gratuitement votre demande de travaux autour de Duras et recevez jusqu’à trois contacts de professionnels.',
    alternates: { canonical: '/travaux' },
    robots: { index: travauxEnabled() },
  };
}

export default async function TravauxPage({ searchParams }: { searchParams: Promise<{ espace?: string | string[] }> }) {
  const initialPanel = (await searchParams).espace === 'contact' ? 'contact' : 'jobs';
  const locale = localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = travauxCopy(locale);
  const enabled = travauxEnabled() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return <main className={`visitor-site ${styles.page}`} lang={locale}>
    <header className="site-header">
      <div className="site-nav">
        <a className="brand-lockup" href="/" aria-label={t("Côte de Duras, accueil")}>
          <span className="brand-mark"><Image src="/cote-de-duras-logo.webp" alt="" width={54} height={43} /></span>
          <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
        </a>
        <nav className="primary-nav" aria-label={t("Navigation principale")}>
          <a href="/#agenda">{t("Agenda")}</a><a href="/#gemeenten">{t("Guide local")}</a>
        </nav>
      </div>
      <div className={`hero-grid ${styles.hero}`}>
        <div className="hero-art" aria-hidden="true"><Image src="/lot-et-garonne-hero.png" alt="" fill sizes="100vw" preload /></div>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-kicker"><span aria-hidden="true" /> {t("Dans un rayon de 50 km autour de Duras")}</p>
          <h1>{t("Travaux et artisans")}</h1>
          <p className="hero-intro">{t("Déposez gratuitement votre projet et recevez jusqu’à trois contacts de professionnels.")}</p>
        </div>
      </div>
    </header>
    <Travaux enabled={enabled} communes={enabled ? travauxCommunes : []} initialPanel={initialPanel} />
    <footer className="site-footer">
      <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
      <div><a href="/">{t("Accueil")}</a><a href="/travaux?espace=contact#espace">{t("Contact")}</a><a href="/disclaimer">{t("Mentions légales")}</a></div>
    </footer>
  </main>;
}
