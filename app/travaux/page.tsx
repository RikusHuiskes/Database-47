import Image from 'next/image';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, localeFrom } from '../../lib/i18n';
import { travauxCopy } from '../../lib/travaux-copy';
import { ADVERTISING_SELLER } from '../../lib/mollie';
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

export default async function TravauxPage({ searchParams }: { searchParams: Promise<{ espace?: string | string[]; paiement?: string | string[] }> }) {
  const { espace, paiement } = await searchParams;
  const initialPanel = espace === 'contact' || espace === 'admin' ? espace : 'jobs';
  const initialAccount = espace === 'pro' || paiement !== undefined ? 'provider'
    : espace === 'demandeur' ? 'resident' : null;
  const locale = localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = travauxCopy(locale);
  const enabled = travauxEnabled() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return <main className={`visitor-site ${styles.page}`} lang={locale}>
    <Travaux enabled={enabled} communes={enabled ? travauxCommunes : []} initialPanel={initialPanel} initialAccount={initialAccount}
      navigation={<div className="site-nav">
        <a className="brand-lockup" href="/" aria-label={t("Côte de Duras, accueil")}>
          <span className="brand-mark"><Image src="/cote-de-duras-logo.webp" alt="" width={54} height={43} /></span>
          <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
        </a>
        <nav className="primary-nav" aria-label={t("Navigation principale")}>
          <a href="/#agenda">{t("Agenda")}</a><a href="/#gemeenten">{t("Guide local")}</a>
        </nav>
      </div>}
      contactDetails={<aside aria-labelledby="travaux-contact-business">
        <h3 id="travaux-contact-business">{ADVERTISING_SELLER.name}</h3>
        <address className={styles.contactAddress}>
          {ADVERTISING_SELLER.address}<br />
          {ADVERTISING_SELLER.postcode} Savignac-de-Duras<br />
          {locale === 'nl' ? 'Frankrijk' : 'France'}
        </address>
        <p><a href="mailto:info@cotededuras.com">info@cotededuras.com</a></p>
        <p>SIRET {ADVERTISING_SELLER.siret}</p>
      </aside>}
      hero={<div className={`hero-grid ${styles.hero}`}>
        <div className="hero-art" aria-hidden="true"><Image src="/lot-et-garonne-hero.png" alt="" fill sizes="100vw" preload /></div>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-kicker"><span aria-hidden="true" /> {t("Dans un rayon de 50 km autour de Duras")}</p>
          <h1>{t("Travaux et artisans")}</h1>
          <p className="hero-intro">{t("Déposez gratuitement votre projet et recevez jusqu’à trois contacts de professionnels.")}</p>
        </div>
      </div>}
    />
    <footer className="site-footer">
      <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
      <div><a href="/">{t("Accueil")}</a><a href="/travaux?espace=contact#espace">{t("Contact")}</a><a href="/disclaimer">{t("Mentions légales")}</a></div>
    </footer>
  </main>;
}
