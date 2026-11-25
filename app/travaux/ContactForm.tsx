'use client';

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/Language';
import strings from '../../lib/travaux-contact.json';
import styles from './travaux.module.css';

export default function ContactForm({ email, role }: { email?: string; role: 'requester' | 'professional' }) {
  const { locale } = useLanguage();
  const copy = strings[locale];
  const [state, setState] = useState<'ready' | 'sending' | 'success' | 'invalid' | 'unavailable'>('ready');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;
    const form = event.currentTarget;
    setState('sending');
    try {
      const response = await fetch('/api/travaux/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!response.ok) {
        setState(response.status === 400 || response.status === 413 ? 'invalid' : 'unavailable');
        return;
      }
      form.reset();
      setState('success');
    } catch { setState('unavailable'); }
  }

  return <form className={styles.form} onSubmit={send}>
    <div className={styles.fields}>
      <label>{copy.role}<select name="role" defaultValue={email ? role : ''} required>
        <option value="">{copy.choose}</option>
        <option value="requester">{copy.requester}</option>
        <option value="professional">{copy.professional}</option>
      </select></label>
      <label>{copy.name}<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
    </div>
    <label>{copy.email}<input name="email" type="email" autoComplete="email" defaultValue={email} maxLength={254} required /></label>
    <label>{copy.message}<textarea name="message" rows={5} minLength={10} maxLength={3000} required /></label>
    <input name="website" hidden tabIndex={-1} autoComplete="off" />
    <button type="submit" className={styles.button} disabled={state === 'sending'}>
      {state === 'sending' ? copy.sending : copy.send}
    </button>
    {state === 'success' && <p role="status" className={styles.status}>{copy.success}</p>}
    {(state === 'invalid' || state === 'unavailable') && <p role="alert" className={styles.error}>{copy[state]}</p>}
  </form>;
}
