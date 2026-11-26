'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/Language';
import { intlLocale } from '../../lib/i18n';
import { travauxCategoryLabel, travauxCategories, type TravauxCategory } from '../../lib/travaux';
import { travauxCopy } from '../../lib/travaux-copy';
import { travauxInteractions, type TravauxInteraction } from '../../lib/travaux-interactions';
import labels from '../../lib/travaux-stats.json';
import styles from './travaux.module.css';

const traffic = ['visits', 'visitors', 'pageviews'] as const;
const activity = ['projects', 'open', 'requesters', 'replies', 'matched', 'providers', 'active'] as const;
const operations = ['submitted', 'accepted', 'newProviders', 'paid', 'cancelled'] as const;
const groupKeys = ['navigation', 'discovery', 'requester', 'professional', 'support'] as const;
const columns = ['visits', 'interactions', 'projects', 'replies', 'payments'] as const;
type Metric = typeof traffic[number] | typeof activity[number] | typeof operations[number];
type Breakdown = { key: string; count: number };
type Report = {
  traffic: Record<typeof traffic[number], number>;
  events: Partial<Record<TravauxInteraction, { count: number; visits: number }>>;
  operations: Record<typeof operations[number], number>;
  daily: Array<Record<typeof columns[number], number> & { day: string }>;
  categories: Breakdown[];
  towns: Breakdown[];
  channels: Breakdown[];
};
type StatsData = Record<typeof traffic[number] | typeof activity[number], number> & { report: Report };

export default function Stats({ token }: { token: string }) {
  const { locale } = useLanguage();
  const copy = labels[locale], t = travauxCopy(locale);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsData | null>(null);
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
  const number = (value: number) => value.toLocaleString(intlLocale[locale]);
  const date = new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: 'medium', timeZone: 'Europe/Paris' });
  const report = data?.report;
  function metrics(keys: readonly Metric[], values?: Partial<Record<Metric, number>>) {
    return <dl className={styles.metrics}>{keys.map(key => <div key={key}>
      <dt>{copy[key]}</dt><dd>{typeof values?.[key] === 'number' ? number(values[key]) : '–'}</dd>
    </div>)}</dl>;
  }
  function breakdown(title: string, rows: Breakdown[], name: (key: string) => string) {
    return <section>
      <h3>{title}</h3>
      {rows.length > 0 ? <dl className={styles.analyticsBreakdown}>{rows.map(row => <div key={row.key}>
        <dt>{name(row.key)}</dt><dd>{number(row.count)}</dd>
      </div>)}</dl> : <p>{copy.empty}</p>}
    </section>;
  }
  return <section className={styles.card}>
    <h2>{copy.title}</h2>
    {error && <p role="alert">{t('Le service ne répond pas.')}</p>}
    <label>{copy.period} <select value={days} onChange={event => {
      setData(null); setError(false); setDays(Number(event.target.value));
    }}>{[7,30,90].map(period => <option key={period} value={period}>{period} {copy.days}</option>)}</select></label>
    <h3>{copy.traffic}</h3>{metrics(traffic, report?.traffic ?? data ?? undefined)}
    <h3>{copy.operations}</h3>{metrics(operations, report?.operations)}
    <h3>{copy.totals}</h3>{metrics(activity, data ?? undefined)}
    {report && <>
      <p className={styles.meta}>{copy.historyNote}</p>
      <div className={styles.analyticsColumns}>
        {breakdown(copy.channels, report.channels, key => Object.hasOwn(copy.sources, key) ? copy.sources[key as keyof typeof copy.sources] : copy.sources.unknown)}
        {breakdown(copy.categories, report.categories, key => Object.hasOwn(travauxCategories, key) ? travauxCategoryLabel(key as TravauxCategory, locale) : key)}
        {breakdown(copy.towns, report.towns, key => key)}
      </div>
      <details className={styles.guide}>
        <summary>{copy.daily}</summary>
        <div className={styles.analyticsTable}>
          <table aria-label={copy.daily}>
            <thead><tr><th scope="col">{copy.day}</th>{columns.map(key => <th scope="col" key={key}>
              {key === 'payments' ? copy.paid : key === 'interactions' ? copy.interactionCount : copy[key]}
            </th>)}</tr></thead>
            <tbody>{[...report.daily].reverse().map(row => <tr key={row.day}>
              <th scope="row">{date.format(new Date(row.day + 'T12:00:00Z'))}</th>
              {columns.map(key => <td key={key}>{number(row[key])}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
      <h3>{copy.interactions}</h3>
      <p>{copy.interactionsHelp}</p>
      {groupKeys.map(group => <details className={styles.guide} key={group}>
        <summary>{copy[group]}</summary>
        <div className={styles.analyticsTable}>
          <table aria-label={copy[group]}>
            <thead><tr><th scope="col">{copy.action}</th><th scope="col">{copy.count}</th><th scope="col">{copy.visits}</th></tr></thead>
            <tbody>{travauxInteractions[group].map(key => <tr key={key}>
              <th scope="row">{copy.events[key]}</th>
              <td>{number(report.events[key]?.count ?? 0)}</td>
              <td>{number(report.events[key]?.visits ?? 0)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>)}
    </>}
  </section>;
}
