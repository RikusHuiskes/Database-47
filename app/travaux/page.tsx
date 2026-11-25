import Image from 'next/image';
import type { Metadata } from 'next';
import { travauxEnabled } from '../../lib/travaux-server';
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

export default function TravauxPage() {
  const enabled = travauxEnabled() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return <main className={`visitor-site ${styles.page}`} lang="fr">
    <header className="site-header">
      <div className="site-nav">
        <a className="brand-lockup" href="/" aria-label="Côte de Duras, accueil">
          <span className="brand-mark"><Image src="/cote-de-duras-logo.webp" alt="" width={54} height={43} /></span>
          <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
        </a>
        <nav className="primary-nav" aria-label="Navigation principale">
          <a href="/#agenda">Agenda</a><a href="/gemeentegids">Guide local</a>
        </nav>
      </div>
      <div className={`hero-grid ${styles.hero}`}>
        <div className="hero-art" aria-hidden="true"><Image src="/lot-et-garonne-hero.png" alt="" fill sizes="100vw" preload /></div>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-kicker"><span aria-hidden="true" /> Dans un rayon de 50 km autour de Duras</p>
          <h1>Travaux et artisans</h1>
          <p className="hero-intro">Déposez gratuitement votre projet et recevez jusqu’à trois contacts de professionnels.</p>
        </div>
      </div>
    </header>
    <Travaux enabled={enabled} />
    <footer className="site-footer">
      <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
      <div><a href="/">Accueil</a><a href="/contact">Contact</a><a href="/disclaimer">Mentions légales</a></div>
    </footer>
  </main>;
}
