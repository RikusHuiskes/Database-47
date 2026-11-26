'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/Language';
import styles from './travaux.module.css';
import { travauxAuthDestination } from './auth-destination';

const words = {
  fr: ['Adresse e-mail', 'Mot de passe', 'Se connecter', 'Mot de passe oublié ?', 'Vérifiez vos identifiants et réessayez.', 'Si votre compte existe, vous recevrez un lien de réinitialisation.', 'Impossible d’envoyer le lien. Réessayez.', 'Nouveau mot de passe', 'Enregistrer le mot de passe', 'Impossible de modifier le mot de passe.'],
  en: ['Email address', 'Password', 'Sign in', 'Forgot your password?', 'Check your credentials and try again.', 'If your account exists, you’ll receive a reset link.', 'The link could not be sent. Try again.', 'New password', 'Save password', 'The password could not be updated.'],
  nl: ['E-mailadres', 'Wachtwoord', 'Inloggen', 'Wachtwoord vergeten?', 'Controleer je inloggegevens en probeer opnieuw.', 'Als je account bestaat, ontvang je een herstellink.', 'De link kon niet worden verstuurd. Probeer opnieuw.', 'Nieuw wachtwoord', 'Wachtwoord opslaan', 'Het wachtwoord kon niet worden gewijzigd.'],
} as const;

export default function AdminLogin({ auth, recovery = false, onSaved }: {
  auth: SupabaseClient; recovery?: boolean; onSaved?: () => void;
}) {
  const { locale } = useLanguage();
  const [emailLabel, password, login, reset, invalid, checkMail, resetError, newPassword, save, saveError] = words[locale];
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'invalid' | 'sent' | 'resetError' | 'saveError' | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true); setFeedback(null);
    try {
      if (recovery) {
        const { error } = await auth.auth.updateUser({ password: value });
        if (error) setFeedback('saveError');
        else onSaved?.();
      } else {
        const { error } = await auth.auth.signInWithPassword({ email: email.trim(), password: value });
        if (error) setFeedback('invalid');
      }
    } catch { setFeedback(recovery ? 'saveError' : 'invalid'); }
    finally { setBusy(false); }
  }
  async function recover() {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setFeedback('invalid'); return; }
    setBusy(true); setFeedback(null);
    try {
      const redirectTo = travauxAuthDestination(window.location.origin, locale, 'admin');
      const { error } = await auth.auth.resetPasswordForEmail(address, { redirectTo });
      setFeedback(error ? 'resetError' : 'sent');
    } catch { setFeedback('resetError'); }
    finally { setBusy(false); }
  }

  return <form className={styles.form} onSubmit={submit}>
    {!recovery && <label>{emailLabel}<input type="email" name="email" autoComplete="username" value={email}
      onChange={event => setEmail(event.target.value)} required /></label>}
    <label>{recovery ? newPassword : password}<input type="password" name="password"
      autoComplete={recovery ? 'new-password' : 'current-password'} minLength={recovery ? 12 : undefined} required /></label>
    <div className={styles.actions}>
      <button type="submit" className={styles.button} disabled={busy}>{recovery ? save : login}</button>
      {!recovery && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void recover()}>{reset}</button>}
    </div>
    {feedback && <p role={feedback === 'sent' ? 'status' : 'alert'}>{({ invalid, sent: checkMail, resetError, saveError })[feedback]}</p>}
  </form>;
}
