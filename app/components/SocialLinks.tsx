'use client';

import {useId, useState} from 'react';
import {useLanguage} from '../i18n/Language';
import profiles from '../../lib/social-profiles.json';
import {SITE_SHARE_URL} from '../../lib/site-sharing';
import styles from './social-links.module.css';

const siteUrl = SITE_SHARE_URL;
const copy = {
  nl: {title: 'Côte de Duras delen', follow: 'Volg Côte de Duras', description: 'Elke twee dagen een idee voor Duras en omgeving: markten, uitjes en handige adressen. Voor inwoners én bezoekers.', share: 'Deel de website', facebook: 'Delen op Facebook', copied: 'Link gekopieerd.', failed: 'Kopiëren lukt niet. Kopieer dit adres:', opened: 'Het deelmenu is geopend.'},
  en: {title: 'Share Côte de Duras', follow: 'Follow Côte de Duras', description: 'A fresh idea every two days: markets, outings and useful addresses around Duras. For residents and visitors.', share: 'Share the website', facebook: 'Share on Facebook', copied: 'Link copied.', failed: 'Unable to copy. Copy this address:', opened: 'The share menu has opened.'},
  fr: {title: 'Partager Côte de Duras', follow: 'Suivez Côte de Duras', description: 'Une idée tous les deux jours : marchés, sorties et bonnes adresses autour de Duras. Pour habitants et visiteurs.', share: 'Partager le site', facebook: 'Partager sur Facebook', copied: 'Lien copié.', failed: 'Copie impossible. Copiez cette adresse :', opened: 'Le menu de partage est ouvert.'},
};

// Only verified profile URLs belong in the configuration. Empty values stay hidden.
function profileUrl(value: string, domain: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      [domain, `www.${domain}`].includes(url.hostname) && url.pathname !== '/'
      ? url.href : null;
  } catch { return null; }
}

export default function SocialLinks({compact = false}: {compact?: boolean}) {
  const headingId = useId();
  const {locale} = useLanguage();
  const text = copy[locale];
  const [message, setMessage] = useState('');
  const facebook = profileUrl(profiles.facebook, 'facebook.com');
  const instagram = profileUrl(profiles.instagram, 'instagram.com');
  async function share() {
    setMessage('');
    try {
      if (navigator.share) {
        await navigator.share({title: 'Côte de Duras', url: siteUrl});
        return;
      }
      await navigator.clipboard.writeText(siteUrl);
      setMessage(text.copied);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessage(`${text.failed} ${siteUrl}`);
    }
  }
  return <section className={`${styles.panel} ${compact ? styles.compact : ''}`} aria-labelledby={headingId}>
    <div><h2 id={headingId}>{facebook || instagram ? text.follow : text.title}</h2><p>{text.description}</p></div>
    <div className={styles.actions}>
      {facebook && <a href={facebook} target="_blank" rel="noopener noreferrer">{locale === 'fr' ? 'Suivre sur Facebook' : locale === 'en' ? 'Follow on Facebook' : 'Volg op Facebook'} ↗</a>}
      {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer">{locale === 'fr' ? 'Suivre sur Instagram' : locale === 'en' ? 'Follow on Instagram' : 'Volg op Instagram'} ↗</a>}
      {!compact && <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`} target="_blank" rel="noopener noreferrer">{text.facebook} ↗</a>}
      {!compact && <button type="button" onClick={share}>{text.share}</button>}
    </div>
    <p role="status" aria-live="polite" className={styles.status}>{message}</p>
  </section>;
}
