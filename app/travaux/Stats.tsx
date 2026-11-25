'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/Language';
import { travauxCopy } from '../../lib/travaux-copy';
import labels from '../../lib/travaux-stats.json';
import styles from './travaux.module.css';

const traffic = ['visits', 'visitors', 'pageviews'] as const;
const activity = ['projects', 'open', 'requesters', 'replies', 'matched', 'providers', 'active'] as const;
type Metric = typeof traffic[number] | typeof activity[number];

export default function Stats({ token }: { token: string }) {
  const { locale } = useLanguage();
  const copy = labels[locale], t = travauxCopy(locale);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Record<Metric, number> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/travaux/admin?stats=1&days=' + days, {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!controller.signal.aborted) setData(result);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [days, token]);
  function metrics(keys: readonly Metric[]) {
    return <dl className={styles.metrics}>{keys.map(key => <div key={key}>
      <dt>{copy[key]}</dt><dd>{data?.[key]?.toLocaleString(locale) ?? '–'}</dd>
    </div>)}</dl>;
  }
  return <section className={styles.card}>
    <h2>{copy.title}</h2>
    {error && <p role="alert">{t('Le service ne répond pas.')}</p>}
    <label>{copy.period} <select value={days} onChange={event => {
      setData(null); setError(false); setDays(Number(event.target.value));
    }}>{[7,30,90].map(period => <option key={period} value={period}>{period} {copy.days}</option>)}</select></label>
    <h3>{copy.traffic}</h3>{metrics(traffic)}
    <h3>{copy.totals}</h3>{metrics(activity)}
  </section>;
}
