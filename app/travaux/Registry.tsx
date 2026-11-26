'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { localizedJobTitle, type JobTitle } from '../../lib/travaux-job-title';
import { useLanguage } from '../i18n/Language';
import { companyCopy, type CompanyDetails } from '../../lib/travaux-company';
import { travauxCategoryLabel, type TravauxCategory } from '../../lib/travaux';
import panels from '../../lib/travaux-panels.json';
import { intlLocale } from '../../lib/i18n';
import { travauxCopy } from '../../lib/travaux-copy';
import styles from './travaux.module.css';

type Provider = { id: string; name: string; email: string; phone: string; test: boolean; subscription: string | null; details: CompanyDetails | null; termsVersion: string | null; termsAcceptedAt: string | null; cancelled: boolean; active: boolean };
type Reply = { job_id: string; slot: number; message: string | null; quote_cents: number | null; job: (JobTitle & { commune: string; status: string }) | null };
type Result<T> = { rows: T[]; more: boolean };

function List<T>({ token, provider, empty, children }: {
  token: string; provider?: string; empty: string; children: (row: T) => ReactNode;
}) {
  const { locale } = useLanguage();
  const copy = panels[locale];
  const t = travauxCopy(locale);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), ...(provider ? { provider } : {}) });
    fetch('/api/travaux/admin?' + params, {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!controller.signal.aborted) setResult(data);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [page, provider, token]);
  const move = (step: number) => { setFailed(false); setResult(null); setPage(page + step); };

  if (failed) return <p role="alert">{t('Le service ne répond pas.')}</p>;
  if (!result) return <p role="status">{t('Chargement des demandes…')}</p>;
  return <>
    {result.rows.length ? result.rows.map(children) : <p>{empty}</p>}
    <div className={styles.actions}>
      {page > 0 && <button className={styles.secondary} onClick={() => move(-1)}>{copy.back}</button>}
      {result.more && <button className={styles.secondary} onClick={() => move(1)}>{copy.more}</button>}
    </div>
  </>;
}

export default function Registry({ token }: { token: string }) {
  const { locale } = useLanguage();
  const copy = panels[locale];
  const [selected, setSelected] = useState<string | null>(null);
  const company = companyCopy(locale);
  const euros = new Intl.NumberFormat(intlLocale[locale], { style: 'currency', currency: 'EUR' });
  return <section className={styles.card}>
    <h2>{copy.people}</h2>
    <List<Provider> token={token} empty={copy.empty}>{provider => <article className={styles.item} key={provider.id}>
      <h3>{provider.name}</h3>
      <p>{provider.email} · {provider.phone}</p>
      <p>{provider.active ? copy.paid : copy.inactive}{provider.cancelled ? ' · ' + copy.stopped : ''}
        {provider.test ? ' · ' + copy.test : ''}</p>
      {provider.subscription && <p className={styles.meta}>{provider.subscription}</p>}
      {provider.details && <details><summary>{company('company')}</summary>
        <p>{provider.details.representative} · {provider.details.address}{provider.details.complement && ', ' + provider.details.complement}, {provider.details.postcode} {provider.details.city}</p>
        <p>SIRET {provider.details.siret} · {provider.details.legalForm} · {company('size')}: {provider.details.size}</p>
        <p>{provider.details.specialties.map(key => travauxCategoryLabel(key as TravauxCategory, locale)).join(' · ')}</p>
        {provider.details.certifications && <p>{company('cert')}: {provider.details.certifications}</p>}
        {provider.termsAcceptedAt && <p>{company('terms')}: {provider.termsVersion} · {new Date(provider.termsAcceptedAt).toLocaleDateString(intlLocale[locale])}</p>}
      </details>}
      <button className={styles.secondary} aria-expanded={selected === provider.id}
        onClick={() => setSelected(selected === provider.id ? null : provider.id)}>{copy.history}</button>
      {selected === provider.id && <List<Reply> key={provider.id} token={token} provider={provider.id} empty={copy.noHistory}>
        {reply => <div className={styles.reply} key={reply.job_id}>
          <strong>{reply.job && localizedJobTitle(reply.job, locale)} · {reply.job?.commune}</strong>
          <p className={styles.meta}>#{reply.job_id} · {reply.slot}/3</p>
          {reply.message && <p>{reply.message}</p>}
          {reply.quote_cents !== null && <p>{euros.format(reply.quote_cents / 100)}</p>}
        </div>}
      </List>}
    </article>}</List>
  </section>;
}
