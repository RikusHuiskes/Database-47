'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '../i18n/Language';
import { missionCopy } from '../../lib/mission-copy';
import styles from './mission.module.css';

export default function Mission({ showTravaux }: { showTravaux: boolean }) {
  const { locale } = useLanguage();
  const copy = missionCopy[locale];

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.wrap}>
        <Link href="/" className={styles.brand}>
          <Image src="/cote-de-duras-logo.webp" alt="" width={58} height={48} />
          <span>CÔTE DE DURAS</span>
        </Link>
      </div>
    </header>

    <div className={`${styles.wrap} ${styles.layout}`}>
      <article className={styles.content}>
        <h1>{copy.menu}</h1>
        <section className={styles.mission}>
          <h2>{copy.mission}</h2>
          <blockquote>{copy.quote}</blockquote>
        </section>
        <section className={styles.vision}>
          <h2>{copy.vision}</h2>
          <p>{copy.description}</p>
        </section>
        <nav className={styles.links} aria-label={copy.menu}>
          <Link href="/">{copy.home}</Link>
          {showTravaux && <Link href="/travaux">{copy.travaux}</Link>}
        </nav>
      </article>
      <figure className={styles.figure}>
        <div className={styles.image}>
          <Image src="/mission-network.svg" alt={copy.imageAlt} fill sizes="(max-width: 740px) 90vw, 460px" />
        </div>
      </figure>
    </div>
  </main>;
}
