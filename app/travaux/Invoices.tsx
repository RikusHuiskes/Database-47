'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/Language';
import { intlLocale } from '../../lib/i18n';
import styles from './travaux.module.css';

const copy = {
  fr: ['Mes factures', 'Télécharger le PDF', 'Aucune facture disponible.', 'Les factures sont momentanément indisponibles.'],
  en: ['My invoices', 'Download PDF', 'No invoices available.', 'Invoices are temporarily unavailable.'],
  nl: ['Mijn facturen', 'Download pdf', 'Er zijn nog geen facturen.', 'Facturen zijn tijdelijk niet beschikbaar.'],
};
type Invoice = { id: string; invoice_number: string; total_cents: number; issued_at: string };

export default function Invoices({ token }: { token: string }) {
  const { locale } = useLanguage();
  const [title, download, empty, fail] = copy[locale];
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const signal = new AbortController();
    fetch('/api/travaux/invoice', { headers: { Authorization: 'Bearer ' + token }, signal: signal.signal })
      .then(async response => {
        if (!response.ok) throw Error();
        setInvoices(await response.json());
      }).catch(() => { if (!signal.signal.aborted) setError(true); });
    return () => signal.abort();
  }, [token]);
  const date = new Intl.DateTimeFormat(intlLocale[locale], { timeZone: 'Europe/Paris', dateStyle: 'medium' });
  const price = new Intl.NumberFormat(intlLocale[locale], { style: 'currency', currency: 'EUR' });
  async function getPdf(id: string) {
    setError(false);
    try {
      const response = await fetch('/api/travaux/invoice?id=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = 'Facture-Cote-de-Duras.pdf'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError(true); }
  }

  return <section className={styles.card}>
    <h2>{title}</h2>
    {error && <p role="alert">{fail}</p>}
    {!error && !invoices.length && <p>{empty}</p>}
    {invoices.map(invoice => <div className={styles.item} key={invoice.id}>
      <p>{invoice.invoice_number} · {date.format(new Date(invoice.issued_at))} · {price.format(invoice.total_cents / 100)}</p>
      <button className={styles.secondary} type="button" onClick={() => void getPdf(invoice.id)}>{download}</button>
    </div>)}
  </section>;
}
