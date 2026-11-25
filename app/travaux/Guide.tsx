'use client';

import guide from '../../lib/travaux-guides.json';
import { useLanguage } from '../i18n/Language';
import styles from './travaux.module.css';

export default function Guide() {
  const { locale } = useLanguage();
  const copy = guide[locale];
  return <section className={styles.card} id="handleiding">
    <h2>{copy.title}</h2>
    {[copy.resident, copy.provider].map(role => <details key={role.title} className={styles.guide}>
      <summary>{role.title}</summary>
      <ol>{role.items.map(item => <li key={item}>{item}</li>)}</ol>
    </details>)}
    <p>{copy.privacy} <a href="/contact">{copy.contact}</a></p>
  </section>;
}
