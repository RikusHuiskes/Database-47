'use client';

import guide from '../../lib/travaux-guides.json';
import { useLanguage } from '../i18n/Language';
import styles from './travaux.module.css';

export default function Guide({ onContact }: { onContact: () => void }) {
  const { locale } = useLanguage();
  const copy = guide[locale];
  return <section className={styles.card} id="handleiding">
    <h2>{copy.title}</h2>
    {[copy.resident, copy.provider].map(role => <details key={role.title} className={styles.guide}>
      <summary>{role.title}</summary>
      <ol>{role.items.map(step => <li key={step.title}>
        <strong>{step.title}</strong><p>{step.text}</p>
      </li>)}</ol>
    </details>)}
    <p>{copy.help}</p>
    <p><button className={styles.secondary} type="button" onClick={onContact}>{copy.contact}</button></p>
  </section>;
}
