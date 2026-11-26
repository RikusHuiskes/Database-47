'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/Language';
import copy from '../../lib/travaux-owner.json';
import panels from '../../lib/travaux-panels.json';
import { travauxCopy, travauxErrorText } from '../../lib/travaux-copy';
import styles from './travaux.module.css';

type Contact = Record<'name' | 'address' | 'email' | 'phone', string>;
type Row = { id: string; title: string; commune: string; contact: Contact | null };
const endpoint = '/api/travaux/owner/contacts';
const fields = ['name', 'address', 'email', 'phone'] as const;

function Editor({ row, token }: { row: Row; token: string }) {
  const { locale } = useLanguage();
  const labels = copy[locale];
  const [state, setState] = useState({ busy: false, saved: false, error: '' });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setState({ busy: true, saved: false, error: '' });
    try {
      const response = await fetch(endpoint, { method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, id: row.id }),
      });
      if (!response.ok) throw Error((await response.json()).error);
      setState({ busy: false, saved: true, error: '' });
    } catch (error) {
      setState({ busy: false, saved: false, error: error instanceof Error ? error.message : '' });
    }
  }
  return <details className={styles.item}>
    <summary>{row.title} · {row.commune}</summary>
    {row.contact && <form className={styles.form} onSubmit={save}>
      {fields.map(key => <label key={key}>{labels[key]}<input name={key} defaultValue={row.contact?.[key]}
        type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
        maxLength={{ name: 120, address: 350, email: 254, phone: 30 }[key]} required /></label>)}
      <button type="submit" className={styles.button} disabled={state.busy}>{labels.save}</button>
      {state.saved && <p role="status">{labels.saved}</p>}
      {state.error && <p role="alert">{travauxErrorText(state.error, locale)}</p>}
    </form>}
  </details>;
}

export default function OwnerContacts({ token }: { token: string }) {
  const { locale } = useLanguage();
  const labels = copy[locale], t = travauxCopy(locale);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: Row[]; more: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint + '?page=' + page, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [page, token]);
  function move(next: number) { setFailed(false); setData(null); setPage(next); }
  return <section className={styles.card}>
    <h2>{labels.title}</h2><p>{labels.note}</p>
    {failed ? <p role="alert">{t('Le service ne répond pas.')}</p> : !data ? <p role="status">{t('Chargement des demandes…')}</p> : <>
      {!data.rows.length && <p>{labels.empty}</p>}
      {data.rows.map(row => <Editor row={row} token={token} key={row.id} />)}
      <div className={styles.actions}>
        {page > 0 && <button className={styles.secondary} onClick={() => move(page - 1)}>{panels[locale].back}</button>}
        {data.more && <button className={styles.secondary} onClick={() => move(page + 1)}>{panels[locale].more}</button>}
      </div>
    </>}
  </section>;
}
