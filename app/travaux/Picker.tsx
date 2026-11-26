'use client';

import { useId, useRef, useState } from 'react';
import { useLanguage } from '../i18n/Language';
import { normalizePlaceName } from '../../lib/local-area';
import { travauxCopy } from '../../lib/travaux-copy';
import styles from './travaux.module.css';

export type Choice = { value: string; label: string; detail?: string };
export type ChoiceGroup = { label: string; options: Choice[] };

export default function Picker({ label, placeholder, searchLabel, groups, value, onChoose }: {
  label: string; placeholder: string; searchLabel: string; groups: ChoiceGroup[];
  value: string; onChoose: (value: string) => void;
}) {
  const { locale } = useLanguage();
  const t = travauxCopy(locale);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState('');
  const term = normalizePlaceName(query);
  const selection = groups.flatMap(group => group.options).find(option => option.value === value);
  const results = groups.map(group => ({ ...group, options: group.options.filter(option =>
    normalizePlaceName([group.label, option.label, option.detail].filter(Boolean).join(' ')).includes(term)) }))
    .filter(group => group.options.length);

  function choose(option: string) {
    onChoose(option);
    dialog.current?.close();
  }

  return <div className={styles.picker}>
    <span id={id + '-label'}>{label}</span>
    <button ref={trigger} type="button" className={styles.secondary} aria-haspopup="dialog"
      aria-labelledby={id + '-label ' + id + '-value'} onClick={() => {
        setQuery('');
        setExpanded(groups.find(group => group.options.some(item => item.value === value))?.label ?? '');
        dialog.current?.showModal();
      }}><span id={id + '-value'}>{selection?.label ?? placeholder}</span></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={id + '-title'} onClose={() => trigger.current?.focus()}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.dialogContent}>
        <div className={styles.dialogHeading}><h2 id={id + '-title'}>{label}</h2>
          <button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>{t('Fermer')}</button></div>
        <label>
          <span className="visually-hidden">{searchLabel}</span>
          <input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={searchLabel} />
        </label>
        {results.length === 0 && <p role="status">{t('Aucun résultat.')}</p>}
        {results.map(group => <section key={group.label} className={styles.choiceGroup}>
          <button type="button" className={styles.groupButton} aria-expanded={Boolean(term) || expanded === group.label}
            onClick={() => setExpanded(expanded === group.label ? '' : group.label)}>{group.label}</button>
          {(term || expanded === group.label) && <ul>
            {group.options.map(option => <li key={option.value}><button type="button" className={styles.choice}
              aria-pressed={option.value === value} onClick={() => choose(option.value)}>
              <strong>{option.label}</strong>{option.detail && <span>{option.detail}</span>}
            </button></li>)}
          </ul>}
        </section>)}
      </div>
    </dialog>
  </div>;
}
