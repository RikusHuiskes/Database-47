'use client';

import { createClient, type Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { travauxCategories, travauxCategoryLabel, travauxGroups, travauxText, type TravauxCategory } from '../../lib/travaux';
import { travauxCopy, travauxErrorText } from '../../lib/travaux-copy';
import { intlLocale } from '../../lib/i18n';
import { travauxAuthDestination } from './auth-destination';
import { clearRequestDraft, readRequestDraft, saveRequestDraft } from './request-draft';
import { jobTitleLocales, localizedJobTitle, type JobTitle } from '../../lib/travaux-job-title';
import { useLanguage } from '../i18n/Language';
import guide from '../../lib/travaux-guides.json';
import Guide from './Guide';
import introCopy from '../../lib/travaux-intro.json';
import ContactForm from './ContactForm';
import { travauxMail, travauxMailDraft, travauxMailLink } from '../../lib/travaux-mail';
import Registry from './Registry';
import OwnerContacts from './OwnerContacts';
import AdminLogin from './AdminLogin';
import Stats from './Stats';
import Invoices from './Invoices';
import AnalyticsConsent from '../components/AnalyticsConsent';
import CompanyFields from './CompanyFields';
import type { TravauxPlan } from '../../lib/travaux-plans';
import { companyCopy, termsVersion, type CompanyDetails } from '../../lib/travaux-company';
import panels from '../../lib/travaux-panels.json';
import Picker, { type ChoiceGroup } from './Picker';
import styles from './travaux.module.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiPath = '/api/travaux';
let browserAuth: ReturnType<typeof createClient> | undefined;

function travauxAuth() {
  if (typeof window === 'undefined' || !url || !key) return null;
  return browserAuth ??= createClient(url, key, { auth: { storageKey: 'cdd-travaux-auth' } });
}

type Commune = { code: string; name: string; postcode: string; featured: boolean };
type Contact = { name: string; email: string; phone: string };
type Reply = { company: string; email: string; phone: string; message: string | null; quote_cents: number | null; slot: number };
type PublicJob = JobTitle & {
  id: string; description: string; description_translations?: Partial<Record<(typeof jobTitleLocales)[number], string>>; commune: string; category: TravauxCategory; responseCount?: number;
};
type Job = PublicJob & {
  status: 'pending' | 'open' | 'rejected' | 'closed';
  responses?: Reply[];
};
type Dashboard = {
  active: boolean; admin: boolean; owner: boolean; provider: { name: string; phone: string; details: CompanyDetails | null; plan: TravauxPlan | null; subscribed: boolean; canResumeCheckout: boolean; noticeUntil: string | null; cancelled: boolean } | null;
  jobs: Job[]; pending: Job[];
  sent: { job_id: string; job: (JobTitle & { commune: string; contact: Contact | null }) | null }[];
};
const jobStatus = { pending: 'En cours de vérification', open: 'En ligne', rejected: 'Refusée', closed: 'Clôturée' } as const;

function Card({ title, children, compact = false }: { title: string; children: ReactNode; compact?: boolean }) {
  return <section className={compact ? styles.accountSection : styles.card}>
    {compact ? <h3>{title}</h3> : <h2>{title}</h2>}
    {children}
  </section>;
}

function ContactDetails({ contact, title }: { contact: Contact; title: string }) {
  const { locale } = useLanguage();
  const copy = travauxMail[locale];
  const initial = travauxMailDraft(locale, contact, title);
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const copyArea = useRef<HTMLTextAreaElement>(null);
  const text = [copy.to + ': ' + contact.email, copy.subjectLabel + ': ' + (subject ?? initial.subject), '', body ?? initial.body].join('\n');
  return <div>
    <div className={styles.actions}>
      <strong>{contact.name}</strong><span>{contact.email}</span>
      <a href={'tel:' + contact.phone}>{contact.phone}</a>
    </div>
    <details className={styles.jobReply}>
      <summary className={styles.secondary}>{copy.label}</summary>
      <div className={styles.form}>
        <label>{copy.to}<input value={contact.email} readOnly /></label>
        <label>{copy.subjectLabel}<input value={subject ?? initial.subject} onChange={e => { setSubject(e.target.value); setStatus(''); }} /></label>
        <label>{copy.bodyLabel}<textarea rows={6} value={body ?? initial.body} onChange={e => { setBody(e.target.value); setStatus(''); }} /></label>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={async () => {
            try { await navigator.clipboard.writeText(text); setStatus('copied'); }
            catch { setStatus('manual'); requestAnimationFrame(() => { copyArea.current?.focus(); copyArea.current?.select(); }); }
          }}>{copy.copy}</button>
          <a className={styles.secondary} href={travauxMailLink(contact.email, subject ?? initial.subject, body ?? initial.body)}>{copy.open}</a>
        </div>
        {status === 'manual' && <textarea ref={copyArea} aria-label={copy.copy} readOnly rows={7} value={text} />}
        {status && <p role="status">{status === 'copied' ? copy.copied : copy.manual}</p>}
      </div>
    </details>
  </div>;
}

function JobSummary({ job, original = false }: { job: PublicJob; original?: boolean }) {
  const { locale } = useLanguage();
  return <>
    <p className={styles.meta}>{travauxCategoryLabel(job.category, locale)} · {job.commune}</p>
    <h3>{original ? job.title : localizedJobTitle(job, locale)}</h3>
    <p className={styles.description}>{original ? job.description : job.description_translations?.[locale] || job.description}</p>
  </>;
}

async function api(token: string, data?: object, signal?: AbortSignal) {
  const res = await fetch(apiPath, {
    method: data ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(data && { 'Content-Type': 'application/json' }) },
    body: data && JSON.stringify(data),
    signal,
    cache: 'no-store',
  });
  const result = await res.json();
  if (!res.ok) throw Error(result.error ?? "Le service ne répond pas.");
  return result;
}

function submit(run: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(new FormData(event.currentTarget));
  };
}

const accountCopy = {
  fr: { resident: 'Connexion demandeur', residentHelp: 'Connectez-vous par e-mail pour déposer une demande, suivre sa publication et consulter les réponses.', provider: 'Connexion artisan', providerHelp: 'Connectez-vous par e-mail pour accéder à votre profil, à votre abonnement et à vos réponses.', myJobs: 'Mes demandes' },
  en: { resident: 'Customer sign-in', residentHelp: 'Sign in by email to post a project, track its status and read replies.', provider: 'Tradesperson sign-in', providerHelp: 'Sign in by email to access your profile, subscription and replies.', myJobs: 'My projects' },
  nl: { resident: 'Inloggen als klusaanvrager', residentHelp: 'Log in via e-mail om een klus te plaatsen, de publicatiestatus te volgen en reacties te bekijken.', provider: 'Inloggen als vakman', providerHelp: 'Log in via e-mail voor je profiel, abonnement en reacties op klussen.', myJobs: 'Mijn klussen' },
};

const requestCopy = {
  fr: { intro: 'Décrivez vos travaux et indiquez vos coordonnées. Confirmez votre adresse par e-mail pour envoyer automatiquement votre demande pour validation.', verify: 'Confirmer mon adresse e-mail', restored: 'Votre e-mail est confirmé. Vous pouvez vérifier votre demande et l’envoyer ci-dessous.', storageError: 'Impossible de conserver votre brouillon dans ce navigateur. Autorisez le stockage du site et réessayez.' },
  en: { intro: 'Describe the work and enter your contact details. Confirm your email to submit your request for review before it goes live.', verify: 'Confirm my email address', restored: 'Your email is confirmed. You can review and submit your request below.', storageError: 'Your draft could not be saved in this browser. Enable site storage and try again.' },
  nl: { intro: 'Beschrijf je klus en vul je contactgegevens in. Bevestig je e-mailadres om je aanvraag in te dienen. We controleren die vóór publicatie.', verify: 'Bevestig mijn e-mailadres', restored: 'Je e-mailadres is bevestigd. Je kunt je aanvraag hieronder controleren en indienen.', storageError: 'Je concept kon niet worden bewaard in deze browser. Sta opslag voor deze site toe en probeer het opnieuw.' },
};

const emailCopy = {
  fr: { sent: 'Merci. Nous vous avons envoyé un lien de connexion. Consultez votre boîte de réception et vos indésirables.', draftSent: 'Merci. Ouvrez le lien reçu par e-mail dans ce même navigateur pour envoyer votre demande.', wait: 'Trop de demandes de lien. Si vous avez déjà reçu un e-mail, utilisez le dernier lien reçu. Sinon, réessayez plus tard.', sending: 'Envoi en cours…' },
  en: { sent: 'Thank you. We’ve sent you a sign-in link. Check your inbox and spam folder.', draftSent: 'Thank you. Open the email link in this same browser to submit your request.', wait: 'Too many link requests. If you already received an email, use the latest link. Otherwise, try again later.', sending: 'Sending…' },
  nl: { sent: 'Bedankt. We hebben je een inloglink gestuurd. Kijk in je inbox en eventueel bij ongewenste e-mail.', draftSent: 'Bedankt. Open de link uit je e-mail in dezezelfde browser om je aanvraag in te dienen.', wait: 'Er zijn te veel inloglinks aangevraagd. Heb je al een mail ontvangen? Gebruik dan de nieuwste link. Probeer het anders later opnieuw.', sending: 'Bezig met versturen…' },
};

type EmailFeedback = 'sent' | 'draftSent' | 'wait' | { error: string };

const submittedCopy = {
  fr: { title: 'Votre demande est en cours de traitement', review: 'Votre demande a été reçue. Elle sera publiée après validation.', signIn: 'Pour revenir, demandez un nouveau lien dans « Mes demandes » avec cette adresse e-mail. Aucun mot de passe n’est nécessaire.' },
  en: { title: 'Your request is being reviewed', review: 'We’ve received your request. It will go live after approval.', signIn: 'To return, request a new link under “My projects” using this email address. You don’t need a password.' },
  nl: { title: 'Je aanvraag is in behandeling', review: 'We hebben je klusaanvraag ontvangen. Na goedkeuring komt die online.', signIn: 'Gebruik dit e-mailadres de volgende keer bij ‘Mijn klussen’. Je ontvangt dan een nieuwe inloglink. Een wachtwoord is niet nodig.' },
};

const titleLanguage = { fr: 'Français', en: 'English', nl: 'Nederlands' };

const listingCopy = {
  fr: { headline: 'Derniers travaux à pourvoir', all: 'Voir toutes les demandes' },
  en: { headline: 'Latest open projects', all: 'Browse all projects' },
  nl: { headline: 'Nieuwste klussen', all: 'Bekijk alle klussen' },
};

type Account = 'resident' | 'provider';
type ProviderAction = 'register' | 'login';

const professionalCopy = {
  fr: { register: 'S’inscrire', login: 'Se connecter', dashboard: 'Mon compte', registerTitle: 'Créer mon compte artisan', registerHelp: 'Confirmez votre adresse e-mail, puis renseignez votre entreprise et choisissez votre abonnement.' },
  en: { register: 'Register', login: 'Sign in', dashboard: 'My account', registerTitle: 'Create a tradesperson account', registerHelp: 'Confirm your email, then enter your business details and choose a subscription.' },
  nl: { register: 'Registreren', login: 'Inloggen als vakman', dashboard: 'Mijn account', registerTitle: 'Registreren als vakman', registerHelp: 'Bevestig je e-mailadres. Vul daarna je bedrijfsgegevens in en kies een abonnement.' },
};

export default function Travaux({ enabled, communes, initialPanel, initialAccount, navigation, heroArt, contactDetails }: {
  enabled: boolean;
  communes: Commune[];
  initialPanel: 'jobs' | 'contact' | 'admin';
  initialAccount: Account | null;
  navigation: ReactNode;
  heroArt: ReactNode;
  contactDetails: ReactNode;
}) {
  const { locale } = useLanguage();
  const t = travauxCopy(locale);
  const copy = panels[locale];
  const intro = introCopy[locale];
  const account = accountCopy[locale];
  const professional = professionalCopy[locale];
  const request = requestCopy[locale];
  const submitted = submittedCopy[locale];
  const listings = listingCopy[locale];
  const emailMessages = emailCopy[locale];
  const company = companyCopy(locale);
  const [panel, setPanel] = useState<'jobs' | 'intro' | 'guide' | 'contact' | 'admin'>(initialPanel);

  const eur = new Intl.NumberFormat(intlLocale[locale], { style: 'currency', currency: 'EUR' });
  const [category, setCategory] = useState('');
  const [commune, setCommune] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [communeFilter, setCommuneFilter] = useState('');
  const [recommended, setRecommended] = useState(false);
  const categoryGroups = useMemo<ChoiceGroup[]>(() => Object.entries(travauxGroups).map(([group, label]) => ({
    label: travauxText(label, locale),
    options: Object.entries(travauxCategories).flatMap(([value, [section, name, example]]) => section === group
      ? [{ value, label: travauxText(name, locale), detail: example && travauxText(example, locale) }] : []),
  })), [locale]);
  const communeGroups = useMemo<ChoiceGroup[]>(() => {
    const translate = travauxCopy(locale);
    return [true, false].map(featured => ({
      label: translate(featured ? 'Communes du guide local' : 'Autres communes dans un rayon de 50 km'),
      options: communes.filter(place => place.featured === featured).map(place => ({
        value: place.code, label: place.name + ' (' + place.postcode + ')',
      })),
    }));
  }, [communes, locale]);
  const [auth] = useState(() => enabled ? travauxAuth() : null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<Account>(initialAccount ?? 'resident');
  const [residentAccountOpen, setResidentAccountOpen] = useState(initialAccount === 'resident');
  const [providerAction, setProviderAction] = useState<ProviderAction | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof readRequestDraft>>(null);
  const [emailFeedback, setEmailFeedback] = useState<{ role: Account; result: EmailFeedback } | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(false);
  const mailRequestInFlight = useRef(false);
  const mailRetryAfter = useRef(0);
  const requestDraftChecked = useRef<string | null>(null);
  const submittedDialog = useRef<HTMLDialogElement>(null);
  const providerAuthDialog = useRef<HTMLDialogElement>(null);
  const providerPanelOpen = Boolean(session && (providerAction || initialAccount === 'provider'));
  const providerAuthOpen = enabled && panel === 'jobs' && !session && providerAction !== null;

  useEffect(() => {
    const dialog = providerAuthDialog.current;
    if (!dialog) return;
    if (providerAuthOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('input')?.focus();
    } else if (!providerAuthOpen && dialog.open) {
      dialog.close();
    }
  }, [providerAuthOpen]);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [sendingDraft, setSendingDraft] = useState(false);

  useEffect(() => {
    if (submittedEmail && !submittedDialog.current?.open) submittedDialog.current?.showModal();
  }, [submittedEmail]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [recentJobs, setRecentJobs] = useState<PublicJob[] | null>(null);
  const [recentJobsError, setRecentJobsError] = useState(false);
  const recentRequest = useRef(0);
  const [jobsPage, setJobsPage] = useState(0);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const latestJobsRequest = useRef(0);
  const [jobsError, setJobsError] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const moreJobs = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const checkoutInFlight = useRef(false);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const token = session?.access_token;
  const currentSession = useRef<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [publishVersion, setPublishVersion] = useState(0);

  useEffect(() => {
    if (!auth) return;
    const { data } = auth.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); setPanel('admin'); }
      if (!next) setPasswordRecovery(false);
      if (currentSession.current?.user.id !== next?.user.id) {
        if (!next) setRecommended(false);
        if (currentSession.current) {
          setDraft(null);
          setProviderAction(null);
          setCategory('');
          setCommune('');
          setEmailFeedback(null);
          setPublishVersion(version => version + 1);
        }
        setDashboard(null);
        if (!next && currentSession.current) setPanel(previous => previous === 'admin' ? 'jobs' : previous);
      }
      currentSession.current = next;
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!emailCooldown) return;
    const timer = window.setTimeout(() => {
      setEmailCooldown(false);
      setEmailFeedback(feedback => feedback?.result === 'wait' ? null : feedback);
    }, Math.max(0, mailRetryAfter.current - Date.now()));
    return () => window.clearTimeout(timer);
  }, [emailCooldown]);

  const refresh = useCallback(async (accessToken: string, signal?: AbortSignal) => {
    const stillCurrent = () => !signal?.aborted && currentSession.current?.access_token === accessToken;
    try {
      const result = await api(accessToken);
      if (stillCurrent()) setDashboard(result);
    } catch (err) {
      if (stillCurrent()) setError(err instanceof Error ? err.message : "Le service ne répond pas.");
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void refresh(token, controller.signal);
    return () => controller.abort();
  }, [token, refresh]);

  const refreshJobs = useCallback(async (signal?: AbortSignal, page = 0) => {
    const revision = ++latestJobsRequest.current;
    const current = () => !signal?.aborted && latestJobsRequest.current === revision;
    setJobsLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (categoryFilter) params.set('category', categoryFilter);
    if (communeFilter) params.set('commune', communeFilter);
    if (recommended && token) params.set('recommended', '1');
    try {
      const result = await fetch(apiPath + '/jobs?' + params, { signal, cache: 'no-store', headers: recommended && token ? { Authorization: 'Bearer ' + token } : undefined });
      if (!result.ok) throw Error();
      const data: { jobs: PublicJob[]; hasMore: boolean } = await result.json();
      if (current()) {
        setJobs(previous => page === 0 ? data.jobs : [...new Map([...(previous ?? []), ...data.jobs]
          .map(job => [job.id, job])).values()]);
        setJobsPage(page);
        setHasMoreJobs(data.hasMore);
        setJobsError(false);
      }
    } catch {
      if (current()) setJobsError(true);
    } finally {
      if (current()) setJobsLoading(false);
    }
  }, [categoryFilter, communeFilter, recommended, token]);

  const refreshRecentJobs = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++recentRequest.current;
    const current = () => !signal?.aborted && recentRequest.current === requestId;
    try {
      const response = await fetch(apiPath + '/jobs?preview=1', { signal, cache: 'no-store' });
      if (!response.ok) throw Error();
      const data: { jobs: PublicJob[] } = await response.json();
      if (current()) {
        setRecentJobs(data.jobs);
        setRecentJobsError(false);
      }
    } catch {
      if (current()) setRecentJobsError(true);
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void refreshRecentJobs(controller.signal);
    return () => controller.abort();
  }, [enabled, refreshRecentJobs]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setJobs(null);
    setJobsError(false);
    setHasMoreJobs(false);
    void refreshJobs(controller.signal);
    return () => controller.abort();
  }, [enabled, refreshJobs]);

  useEffect(() => {
    if (panel !== 'jobs' || jobsLoading || jobsError || !hasMoreJobs ||
      !moreJobs.current || typeof IntersectionObserver === 'undefined') return;
    const revision = latestJobsRequest.current;
    const observer = new IntersectionObserver(entries => {
      if (latestJobsRequest.current !== revision || !entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void refreshJobs(undefined, jobsPage + 1);
    }, { rootMargin: '250px' });
    observer.observe(moreJobs.current);
    return () => observer.disconnect();
  }, [panel, jobsLoading, jobsError, hasMoreJobs, jobsPage, refreshJobs]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Le service ne répond pas."); }
    finally { setBusy(false); }
  }

  async function send(data: { action: string; [key: string]: unknown }, success: string) {
    if (!token) return;
    await run(async () => {
      let result;
      try { result = await api(token, data); }
      catch (error) { if (data.action === 'respond') await refreshJobs(); throw error; }
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (data.action === 'publish') {
        if (userEmail) clearRequestDraft(userEmail);
        if (userEmail) setSubmittedEmail(userEmail);
        setDraft(null);
        setCategory('');
        setCommune('');
        setPublishVersion(version => version + 1);
      }
      setNotice(success);
      await refresh(token);
      if (['respond', 'moderate', 'close', 'save-profile'].includes(data.action)) await refreshJobs();
      if (['respond', 'moderate', 'close'].includes(data.action)) await refreshRecentJobs();
    });
  }

  useEffect(() => {
    function restored(event: PageTransitionEvent) {
      if (event.persisted) {
        checkoutInFlight.current = false;
        setOpeningCheckout(false);
      }
    }
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  async function openCheckout(data?: FormData) {
    if (!token || checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setOpeningCheckout(true);
    setCheckoutError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 50_000);
    let redirecting = false;
    try {
      const result = await api(token, data ? {
        action: 'checkout', ...Object.fromEntries(data), specialties: data.getAll('specialties'),
        locale, termsVersion, consent: data.has('billingConsent'),
      } : { action: 'resume-checkout', locale }, controller.signal);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        redirecting = true;
      } else {
        setNotice(t("Paiement confirmé. Votre accès a été actualisé."));
        await refresh(token);
      }
    } catch (err) {
      setCheckoutError(controller.signal.aborted
        ? 'L’ouverture de Mollie prend trop de temps. Vous pouvez réessayer.'
        : err instanceof Error ? err.message : 'Le service ne répond pas.');
    } finally {
      window.clearTimeout(timer);
      if (!redirecting) {
        checkoutInFlight.current = false;
        setOpeningCheckout(false);
      }
    }
  }

  const userEmail = session?.user.email;
  useEffect(() => {
    if (!userEmail) {
      requestDraftChecked.current = null;
      return;
    }
    if (!token || view !== 'resident' || requestDraftChecked.current === userEmail) return;
    requestDraftChecked.current = userEmail;
    const saved = readRequestDraft(userEmail);
    if (!saved) return;
    function restoreDraft() {
      if (!saved) return;
      setDraft(saved);
      setCategory(saved.category);
      setCommune(saved.commune);
      setPublishVersion(version => version + 1);
      setEmailFeedback(null);
      setRequestOpen(true);
      setResidentAccountOpen(false);
      requestAnimationFrame(() => document.getElementById('klus-aanvraag')?.scrollIntoView());
    }

    // Older drafts were saved with a separate submit step.
    if (initialAccount !== 'resident' || !saved.submissionId) {
      restoreDraft();
      return;
    }
    const userId = session?.user.id;
    setSendingDraft(true);
    void api(token, { action: 'publish', ...saved.fields, category: saved.category, commune: saved.commune,
      consent: saved.consent, submissionId: saved.submissionId }).then(() => {
      clearRequestDraft(userEmail, saved.submissionId);
      if (currentSession.current?.user.id !== userId) return;
      setResidentAccountOpen(true);
      setRequestOpen(false);
      setSubmittedEmail(userEmail);
      return refresh(currentSession.current?.access_token ?? token);
    }).catch(err => {
      if (currentSession.current?.user.id !== userId) return;
      restoreDraft();
      setError(err instanceof Error ? err.message : "Le service ne répond pas.");
    }).finally(() => setSendingDraft(false));
  }, [userEmail, view, initialAccount, token, session?.user.id, refresh]);

  const provider = dashboard?.provider ?? null;
  const jobTown = communes.find(place => place.code === commune);
  const ownJobs = new Set(dashboard?.jobs.map(job => job.id));
  const pendingOwnJobs = dashboard?.jobs.filter(job => job.status === 'pending') ?? [];
  const reviewedOwnJobs = dashboard?.jobs.filter(job => job.status !== 'pending') ?? [];
  const answeredJobs = new Map(dashboard?.sent.map(reply => [reply.job_id, reply.job?.contact]));
  const specialties = new Set(provider?.details?.specialties ?? []);
  const visibleJobs = jobs;
  const categoryPicker = (value: string, onChoose: (next: string) => void) =>
    <Picker label={t("Type de travaux")} placeholder={t("Choisir un type de travaux")}
      searchLabel={t("Rechercher un métier ou un type de travaux")} groups={categoryGroups} value={value} onChoose={onChoose} />;
  const communePicker = (value: string, onChoose: (next: string) => void) =>
    <Picker label={t("Commune des travaux")} placeholder={t("Choisir une commune")}
      searchLabel={t("Rechercher par commune ou code postal")} groups={communeGroups} value={value} onChoose={onChoose} />;

  async function sendSignInLink(email: string, role: Account, data?: FormData) {
    if (mailRequestInFlight.current || Date.now() < mailRetryAfter.current) return;
    mailRequestInFlight.current = true;
    setSendingLink(true);
    setEmailFeedback(null);
    try {
      if (!auth) throw Error("Connexion indisponible.");
      if (data) {
        try { saveRequestDraft(email, data, category, commune); }
        catch { throw Error(request.storageError); }
      }
      const { error: authError } = await auth.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: travauxAuthDestination(window.location.origin, locale, role === 'provider' ? 'pro' : 'demandeur'),
          shouldCreateUser: role === 'resident' || providerAction === 'register',
        },
      });
      if (authError?.code === 'email_address_invalid' || authError?.code === 'validation_failed') {
        throw Error('Vérifiez votre adresse e-mail (ex. nom@exemple.fr).');
      }
      const limited = authError?.status === 429 || authError?.code === 'over_email_send_rate_limit'
        || authError?.code === 'over_request_rate_limit';
      if (authError && !limited) throw Error("Le lien de connexion n’a pas pu être envoyé. Réessayez dans quelques instants.");

      // Supabase enforces an interval between sends. Leave its server-side limit in place.
      mailRetryAfter.current = Date.now() + 60_000;
      setEmailCooldown(true);
      setEmailFeedback({ role, result: limited ? 'wait' : data ? 'draftSent' : 'sent' });
    } catch (err) {
      setEmailFeedback({ role, result: { error: err instanceof Error ? err.message : "Connexion indisponible." } });
    } finally {
      mailRequestInFlight.current = false;
      setSendingLink(false);
    }
  }

  const emailSendingBlocked = sendingLink || emailCooldown;
  function emailStatus(role: Account) {
    const feedback = emailFeedback?.role === role ? emailFeedback.result : null;
    if (!feedback) return null;
    return typeof feedback === 'string'
      ? <p className={styles.status} role="status">{emailMessages[feedback]}</p>
      : <p className={styles.error} role="alert">{travauxErrorText(feedback.error, locale)}</p>;
  }

  function signInForm(role: Account) {
    return <form className={styles.form} onSubmit={submit(data =>
      void sendSignInLink(String(data.get('email') ?? '').trim(), role))}>
      <label>{t("Adresse e-mail")}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <button className={styles.button} disabled={emailSendingBlocked}>
        {sendingLink ? emailMessages.sending : t("Recevoir mon lien de connexion")}
      </button>
      {emailStatus(role)}
    </form>;
  }

  function openResidentAccount() {
    setView('resident');
    setRequestOpen(false);
    setResidentAccountOpen(true);
    setEmailFeedback(null);
  }

  function openProviderAccount(action: ProviderAction) {
    setView('provider');
    setProviderAction(action);
    setEmailFeedback(null);
  }

  function openPlan(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    openProviderAccount(session ? 'login' : 'register');
    if (session) requestAnimationFrame(() => document.getElementById('espace-pro')?.scrollIntoView());
  }

  function accountHeader() {
    return <div className={styles.account}>
      <span>{userEmail}</span>
      <button type="button" className={styles.secondary} disabled={busy}
        onClick={() => void run(async () => { await auth?.auth.signOut({ scope: 'local' }); })}>{t("Se déconnecter")}</button>
    </div>;
  }

  function showListings() {
    document.getElementById('demandes')?.focus();
  }

  function showContact() {
    setPanel('contact');
    document.getElementById('espace')?.scrollIntoView();
  }

  return <>
    <header className="site-header">
      {navigation}
      <nav className={styles.tabs} aria-label={copy.jobs}>
        {(['intro', 'jobs', 'guide', 'contact', ...(enabled ? ['admin'] as const : [])] as const).map(tab =>
          <button type="button" key={tab} className={`${styles.secondary} ${tab === 'admin' ? styles.adminTab : ''}`}
            aria-pressed={panel === tab} onClick={() => setPanel(tab)}>{tab === 'intro' ? intro.tab : copy[tab]}</button>)}
      </nav>
      <div className={`hero-grid ${styles.hero}`}>
        {heroArt}
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-kicker"><span aria-hidden="true" /> {t("Dans un rayon de 50 km autour de Duras")}</p>
          <h1>{t("Travaux et artisans")}</h1>
          <p className="hero-intro">{t("Déposez gratuitement votre projet et recevez jusqu’à trois contacts de professionnels.")}</p>
        </div>
      </div>
    </header>
    <div className={styles.body} id="espace">
    <dialog ref={submittedDialog} className={styles.dialog} aria-labelledby="travaux-submitted-title"
      onClose={() => setSubmittedEmail(null)}>
      {submittedEmail && <div className={styles.dialogContent}>
        <h2 id="travaux-submitted-title">{submitted.title}</h2>
        <p>{submitted.review}</p>
        <p>{submitted.signIn}</p>
        <p><strong>{submittedEmail}</strong></p>
        <button type="button" className={styles.button} onClick={() => submittedDialog.current?.close()}>{t("Fermer")}</button>
      </div>}
    </dialog>
    {sendingDraft && <p className={styles.status} role="status">{emailMessages.sending}</p>}
    {panel === 'intro' && <Card title={intro.title}>
      <p className={styles.introLead}>{intro.lead}</p>
      <div className={styles.benefits}>
        {[intro.resident, intro.provider].map(section => <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>{section.benefits.map(benefit => <li key={benefit}>{benefit}</li>)}</ul>
        </section>)}
      </div>
    </Card>}
    {panel === 'guide' && <Guide onContact={showContact} />}
    {panel === 'contact' && <Card title={copy.contact}>
      <p>{copy.help}</p>
      <div className={styles.contactGrid}>
        <ContactForm email={userEmail} role={view === 'provider' ? 'professional' : 'requester'} />
        {contactDetails}
      </div>
      <div className={styles.contactTerms}>
        <h3>{copy.legal}</h3><p>{copy.market}</p><p>{copy.guarantees}</p><p>{copy.liability}</p>
      </div>
    </Card>}
    {panel === 'admin' && !dashboard?.admin && <Card title={t("Connexion à l’administration")}>
      {error && <p className={styles.error} role="alert">{travauxErrorText(error, locale)}</p>}
      {notice && <p className={styles.status} role="status">{notice}</p>}
      {loading || (session && !dashboard && !error) ? <p>{t("Chargement de votre espace…")}</p> :
        session ? <>
          <p>{t("Ce compte n’a pas accès à l’administration.")}</p>
          <button className={styles.secondary} type="button" disabled={busy}
            onClick={() => void run(async () => { await auth?.auth.signOut({ scope: 'local' }); setPanel('admin'); })}>{t("Se déconnecter")}</button>
        </> : auth && <AdminLogin auth={auth} />}
    </Card>}
    {panel === 'admin' && dashboard?.admin && passwordRecovery && auth && <Card title={t("Connexion à l’administration")}>
      <AdminLogin auth={auth} recovery onSaved={() => setPasswordRecovery(false)} />
    </Card>}
    {panel === 'admin' && dashboard?.admin && token && !passwordRecovery && <>
      <div className={styles.account}><span>{userEmail}</span>
        <button type="button" className={styles.secondary} disabled={busy}
          onClick={() => void run(async () => { await auth?.auth.signOut({ scope: 'local' }); })}>{t("Se déconnecter")}</button>
      </div>
      {error && <p className={styles.error} role="alert">{travauxErrorText(error, locale)}</p>}
      {notice && <p className={styles.status} role="status">{notice}</p>}
      <Stats token={token} />
      <Registry token={token} />
      {dashboard.owner && <OwnerContacts token={token} />}
      {Boolean(dashboard?.pending.length) && <Card title={t("Demandes à modérer")}>
          <p>{t("Vérifiez que le titre et la description préservent l’anonymat du demandeur avant de publier.")}</p>
          {dashboard?.pending.map(job => <article key={job.id} className={styles.item}>
            <JobSummary job={job} original />
            <form className={styles.form} onSubmit={submit(data => {
              const titles = Object.fromEntries(jobTitleLocales.map(language => [language, data.get(`title-${language}`)]));
              const descriptions = Object.fromEntries(jobTitleLocales.map(language => [language, data.get(`description-${language}`)]));
              void send({ action: 'moderate', id: job.id, status: 'open', titles, descriptions }, t("Demande publiée."));
            })}>
              {jobTitleLocales.map(language => <fieldset key={language}>
                <legend lang={language}>{titleLanguage[language]}</legend>
                <label>{t("Titre")}
                  <input name={`title-${language}`} lang={language} defaultValue={job.title_translations?.[language]} maxLength={100} required />
                </label>
                <label>{t("Description")}
                  <textarea name={`description-${language}`} lang={language} defaultValue={job.description_translations?.[language]} maxLength={2000} rows={4} required />
                </label>
              </fieldset>)}
              <div className={styles.actions}>
                <button className={styles.button} disabled={busy}>{t("Publier")}</button>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => void send({ action: 'moderate', id: job.id, status: 'rejected' }, t("Demande refusée."))}>{t("Refuser")}</button>
              </div>
            </form>
          </article>)}
        </Card>}
    </>}
    {panel === 'jobs' && <>
      {error && <p className={styles.error} role="alert">{travauxErrorText(error, locale)}</p>}
      {notice && <p className={styles.status} role="status">{notice}</p>}
    </>}
    {enabled && <dialog ref={providerAuthDialog} id="travaux-provider-auth" className={styles.dialog}
      aria-labelledby="travaux-provider-auth-title" onClose={() => { if (!session) setProviderAction(null); }}>
      {providerAuthOpen && <div className={styles.dialogContent}>
        <div className={styles.dialogHeading}>
          <h2 id="travaux-provider-auth-title">{providerAction === 'register' ? professional.registerTitle : account.provider}</h2>
          <button type="button" className={styles.secondary} onClick={() => providerAuthDialog.current?.close()}>{t("Fermer")}</button>
        </div>
        <p>{providerAction === 'register' ? professional.registerHelp : account.providerHelp}</p>
        {signInForm('provider')}
      </div>}
    </dialog>}
    <div hidden={panel !== 'jobs'}>
    <div className={styles.pathways}>
      <section className={styles.card}>
        <div className={styles.pathwaySummary}><h2>{t("J’ai des travaux à faire")}</h2>
        <p>{t("Décrivez votre projet gratuitement. Vos coordonnées sont communiquées aux trois premiers professionnels abonnés qui répondent. Vous retrouvez leurs contacts et leurs propositions dans votre espace.")}</p></div>
        {enabled && <div className={styles.pathwayActions}>
          <button type="button" className={styles.button} aria-expanded={requestOpen} onClick={() => {
            setView('resident');
            setRequestOpen(open => !open);
            setResidentAccountOpen(false);
            setEmailFeedback(null);
          }}>{t("Déposer une demande")}</button>
          <button type="button" className={styles.secondary} aria-expanded={residentAccountOpen}
            aria-controls="compte" onClick={openResidentAccount}>{account.myJobs}</button>
        </div>}
        <div className={styles.pathwayDetails} hidden={!requestOpen && !residentAccountOpen}>
        {enabled && <div hidden={!requestOpen} className={styles.requestArea}>
          <div id="klus-aanvraag" className={styles.requestForm}>
            <h3>{t("Déposer une demande")}</h3>
            {!session && <p>{request.intro}</p>}
            {draft && <p role="status" className={styles.status}>{request.restored}</p>}
            <form key={publishVersion} className={styles.form} onSubmit={submit(data => {
              if (!session) {
                void sendSignInLink(String(data.get('email') ?? '').trim(), 'resident', data);
                return;
              }
              void send({
                action: 'publish', ...Object.fromEntries(data), category, commune, consent: data.has('consent'), submissionId: draft?.submissionId,
              }, t("Votre demande a été reçue. Elle sera publiée après vérification."));
            })}>
              {categoryPicker(category, setCategory)}
              {communePicker(commune, setCommune)}
              <label>{t("Titre")}<input name="title" defaultValue={draft?.fields.title} minLength={5} maxLength={100} required /></label>
              <label>{t("Description")}<textarea name="description" defaultValue={draft?.fields.description} minLength={20} maxLength={2000} rows={5} required placeholder={t("Dimensions, matériaux, état actuel et délai souhaité")} /></label>
              <fieldset><legend>{t("Coordonnées privées")}</legend>
                <p className={styles.meta}>{guide[locale].privacy} <button className={styles.secondary} type="button" onClick={showContact}>{guide[locale].contact}</button></p>
                <div className={styles.fields}>
                  <label>{t("Nom et prénom")}<input name="name" defaultValue={draft?.fields.name} autoComplete="name" maxLength={120} required /></label>
                  <label>{t("Téléphone")}<input name="phone" defaultValue={draft?.fields.phone} type="tel" autoComplete="tel" maxLength={30} required /></label>
                </div>
                <label>{company('street')}<input name="address" defaultValue={draft?.fields.address} autoComplete="address-line1" maxLength={160} required /></label>
                <label>{company('complement')}<input name="complement" defaultValue={draft?.fields.complement} autoComplete="address-line2" maxLength={80} /></label>
                <div className={styles.fields}>
                  <label>{company('postcode')}<input autoComplete="postal-code" value={jobTown?.postcode ?? ''} readOnly /></label>
                  <label>{company('city')}<input autoComplete="address-level2" value={jobTown?.name ?? ''} readOnly /></label>
                </div>
                <label>{t("Adresse e-mail")}<input name="email" type="email" key={userEmail ?? 'guest'} defaultValue={userEmail} readOnly={Boolean(userEmail)} autoComplete="email" maxLength={254} required /></label>
                <p className={styles.meta}>{t("Adresse e-mail partagée avec les répondants retenus")}</p>
              </fieldset>
              <label className={styles.check}><input name="consent" type="checkbox" defaultChecked={draft?.consent} required /> {t("J’accepte que mon nom, mon téléphone et mon e-mail soient transmis aux trois premiers professionnels abonnés qui répondent à cette demande.")}</label>
              <button className={styles.button} disabled={loading || busy || sendingDraft || (!session && emailSendingBlocked) || !category || !commune}>
                {session ? t("Envoyer ma demande gratuite") : sendingLink ? emailMessages.sending : request.verify}
              </button>
              {!session && emailStatus('resident')}
            </form>
          </div>
        </div>}
        {enabled && <div id="compte" hidden={!residentAccountOpen} className={styles.requestArea} aria-busy={loading || busy}>
          {residentAccountOpen && (loading ? <p role="status">{t("Chargement de votre espace…")}</p> : session ? <>
            {accountHeader()}
          {pendingOwnJobs.length > 0 && <Card compact title={t("Mes demandes en attente")}>
            <p>{t("Ces demandes sont privées jusqu’à leur approbation.")}</p>
            {pendingOwnJobs.map(job => <article className={styles.item} key={job.id}>
              <JobSummary job={job} />
              <p className={styles.meta}>{t(jobStatus.pending)}</p>
              <button className={styles.secondary} disabled={busy} onClick={() => {
                if (window.confirm(t("Clôturer cette demande ?"))) void send({ action: 'close', id: job.id }, t("Demande clôturée."));
              }}>{t("Clôturer la demande")}</button>
            </article>)}
          </Card>}
          {(!pendingOwnJobs.length || reviewedOwnJobs.length > 0) && <Card compact title={t("Mes demandes et mes contacts")}>
            {!reviewedOwnJobs.length && <p>{dashboard ? t("Aucune demande déposée.") : t("Chargement des demandes…")}</p>}
            {reviewedOwnJobs.map(job => <article className={styles.item} key={job.id}>
              <JobSummary job={job} /><p className={styles.meta}>{t(jobStatus[job.status])} · {job.responses?.length ?? 0}/3 {t("contacts")}</p>
              {[...(job.responses ?? [])].sort((a, b) => a.slot - b.slot).map(reply => <div key={reply.slot} className={styles.reply}>
                <strong>{reply.company}</strong><p>{reply.email} · {reply.phone}</p>
                {reply.quote_cents !== null && <p>{t("Montant proposé")}&nbsp;: {eur.format(reply.quote_cents / 100)}</p>}
                {reply.message && <p className={styles.description}>{reply.message}</p>}
              </div>)}
              {job.status === 'open' && <button className={styles.secondary} disabled={busy} onClick={() => {
                if (window.confirm(t("Clôturer cette demande ?"))) void send({ action: 'close', id: job.id }, t("Demande clôturée."));
              }}>{t("Clôturer la demande")}</button>}
            </article>)}
          </Card>}
          {token && <button className={styles.secondary} disabled={busy} onClick={() => void run(async () => {
            await refresh(token);
            await refreshJobs();
          })}>{t("Actualiser mes contacts")}</button>}
          </> : <>
            <h3>{account.resident}</h3>
            <p>{account.residentHelp}</p>
            {signInForm('resident')}
          </>)}
        </div>}
        </div>
      </section>
      <section className={`${styles.card} ${providerPanelOpen ? styles.providerExpanded : ""}`}>
        <div className={styles.pathwaySummary}><h2>{t("Je suis artisan")}</h2>
        <p>{t("Consultez librement les demandes près de Duras. Abonnez-vous pour répondre aux projets qui vous intéressent.")}</p>
        <p className={styles.price}>{company("monthly")}<br />{company("notice")}<br />{company("annual")}</p></div>
          {enabled && <div className={styles.pathwayActions}>
            {session ? <button type="button" className={styles.button} aria-expanded={providerPanelOpen}
              aria-controls="espace-pro" onClick={() => openProviderAccount('login')}>{professional.dashboard}</button> : <>
              <button type="button" className={styles.button} aria-haspopup="dialog"
                aria-controls="travaux-provider-auth" onClick={() => openProviderAccount('register')}>{professional.register}</button>
              <button type="button" className={styles.secondary} aria-haspopup="dialog"
                aria-controls="travaux-provider-auth" onClick={() => openProviderAccount('login')}>{professional.login}</button>
            </>}
          </div>}
          <div className={`${styles.pathwayDetails} ${styles.providerDetails}`} hidden={!providerPanelOpen}>
          {enabled && <div id="espace-pro" className={styles.requestArea} aria-busy={loading || busy}>
            {providerPanelOpen && <>
              {accountHeader()}
          <Card compact title={t("Mon abonnement professionnel")}>
            {!dashboard && <p>{t("Chargement de l’abonnement…")}</p>}
            {dashboard && provider?.subscribed && <p>{dashboard.active
              ? t(provider.cancelled ? "Accès actif." : "Accès actif pour la période payée.")
              : t("Aucun accès actif pour la période en cours.")}</p>}
            {provider?.subscribed && provider.plan === 'annual' && <p>{company('annualActive')}</p>}
            {provider?.cancelled && <p>
              {t("Le renouvellement automatique est arrêté.")}
              {provider.noticeUntil && <> {company('noticeUntil')} {new Intl.DateTimeFormat(intlLocale[locale], {
                dateStyle: 'long', timeZone: 'Europe/Paris',
              }).format(new Date(provider.noticeUntil + 'T12:00:00Z'))}.</>}
            </p>}
            {provider?.subscribed && provider.plan !== 'annual' && !provider.cancelled && <>
              <p>{company('notice')}</p>
              <button className={styles.secondary} disabled={busy} onClick={() => {
                if (window.confirm(t("Arrêter le renouvellement mensuel ?") + "\n" + company('notice'))) void send({ action: 'cancel' }, t("Renouvellement arrêté."));
              }}>{t("Arrêter le renouvellement")}</button>
            </>}
            {provider?.plan === 'monthly' && provider.canResumeCheckout && <p>{company('pendingCancellation')}</p>}
            {dashboard && <form key={provider?.subscribed ? 'profile' : 'checkout'} className={`${styles.form} ${styles.providerForm}`} onSubmit={submit(data => {
              if (!provider?.subscribed) {
                void openCheckout(data);
                return;
              }
              void send({ action: 'save-profile', ...Object.fromEntries(data), specialties: data.getAll('specialties') }, company('saved'));
            })} aria-busy={openingCheckout}>
              <CompanyFields profile={provider} email={userEmail} />
              {!provider?.subscribed && <>
                <fieldset><legend>{company('plan')}</legend>
                  {(['monthly', 'annual'] as const).map(plan => <label key={plan} className={styles.check}>
                    <input type="radio" name="plan" value={plan} defaultChecked={plan === (provider?.plan ?? 'monthly')}
                      required /> {company(plan)}{plan === 'monthly' && <> · {company('notice')}</>}
                  </label>)}
                </fieldset>
                <details><summary>{company('terms')}</summary><p>{company('termsText')}</p>
                  <p>{copy.market} {copy.guarantees} {copy.liability}</p></details>
                <label className={styles.check}><input name="billingConsent" type="checkbox" required /> {company('accept')}</label>
              </>}
              {checkoutError && <p className={styles.error} role="alert">{travauxErrorText(checkoutError, locale)}</p>}
              <div className={styles.actions}>
                {provider?.canResumeCheckout && !provider.subscribed && <button type="button" className={styles.button}
                  disabled={busy || openingCheckout} onClick={() => void openCheckout()}>
                  {openingCheckout ? t("Ouverture de Mollie…") : t("Reprendre ou vérifier mon paiement")}
                </button>}
                <button className={provider?.canResumeCheckout && !provider.subscribed ? styles.secondary : styles.button}
                  disabled={busy || openingCheckout}>{provider?.subscribed ? company('save')
                    : provider?.canResumeCheckout ? t("Continuer avec les données renseignées")
                    : openingCheckout ? t("Ouverture de Mollie…") : t("S’abonner avec Mollie")}</button>
              </div>
            </form>}
          </Card>
          {token && provider && <Invoices token={token} />}
          <Card compact title={t("Mes réponses")}>
            {!dashboard?.sent.length && <p>{t("Aucune réponse envoyée.")}</p>}
            {dashboard?.sent.map(({ job, job_id }) => job?.contact && <article key={job_id} className={styles.item}>
              <h3>{localizedJobTitle(job, locale)}</h3><ContactDetails contact={job.contact} title={localizedJobTitle(job, locale)} />
            </article>)}
          </Card>
            </>}
          </div>}
        </div>
      </section>
      {enabled && <section className={`${styles.card} ${styles.recentJobs}`}>
        <div className={styles.pathwaySummary}>
          <h2>{listings.headline}</h2>
          {recentJobsError ? <p>{t("Les demandes sont temporairement indisponibles.")}</p>
            : !recentJobs ? <p role="status">{t("Chargement des demandes…")}</p>
            : recentJobs.length === 0 ? <p>{t("Aucune nouvelle demande disponible.")}</p>
            : <ul className={styles.recentJobList}>{recentJobs.map(job => <li key={job.id}>
              <h3>{localizedJobTitle(job, locale)}</h3>
              <span className={styles.meta}>{travauxCategoryLabel(job.category, locale)} · {job.commune}</span>
            </li>)}</ul>}
        </div>
        <div className={styles.pathwayActions}>
          <button type="button" className={styles.button} onClick={showListings}>{listings.all}</button>
        </div>
      </section>}
    </div>
    {!enabled && <p className={styles.status}>{t("Les inscriptions ouvriront prochainement.")}</p>}

    {enabled && <div id="demandes" tabIndex={-1} className={styles.publicListings}>
      <Card title={t("Demandes de travaux")}>
        {!dashboard?.active && <p>{t("Consultez librement les demandes. Pour répondre et recevoir les coordonnées du demandeur,")} <a href="#espace-pro" onClick={openPlan}>{company("plan")}</a>.</p>}
        {session && <div className={styles.tabs}>
          <button type="button" className={styles.secondary} aria-pressed={!recommended} onClick={() => setRecommended(false)}>{t("Toutes les demandes")}</button>
          <button type="button" className={styles.secondary} aria-pressed={recommended} onClick={() => setRecommended(true)}>{t("Recommandées pour moi")}</button>
        </div>}
        {session && recommended && !specialties.size && <p><a href="#espace-pro" onClick={openPlan}>{t("Ajoutez vos spécialités dans votre espace pro pour recevoir des recommandations.")}</a></p>}
        <div className={styles.filters}>
          {categoryPicker(categoryFilter, setCategoryFilter)}
          {communePicker(communeFilter, setCommuneFilter)}
          {(categoryFilter || communeFilter) && <button type="button" className={styles.secondary}
            onClick={() => { setCategoryFilter(''); setCommuneFilter(''); }}>{t("Effacer les filtres")}</button>}
        </div>
        {jobsError && <p role="alert">{t("Les demandes sont temporairement indisponibles.")}</p>}
        {!jobsError && !visibleJobs && <p role="status">{t("Chargement des demandes…")}</p>}
        {!jobsError && visibleJobs?.length === 0 && <p>{t("Aucune nouvelle demande disponible.")}</p>}
        {visibleJobs && visibleJobs.length > 0 && <div className={styles.jobGrid}>{visibleJobs.map(job => {
          const contact = answeredJobs.get(job.id);
          return <article className={styles.publicJob} key={job.id}>
          <JobSummary job={job} />
          <div className={styles.actions}>
            <span className={styles.meta}>{job.responseCount ?? 0}/3 {t("réponses")}{job.responseCount === 3 ? " · " + t("Complet") : ""}</span>
            {specialties.has(job.category) && <span className={styles.match}>{t("Correspond à vos spécialités")}</span>}
          </div>
          {session && ownJobs.has(job.id) && <p>{t("Votre demande")}</p>}
          {session && answeredJobs.has(job.id) && <div className={styles.reply}>
            <p>{t("Vous avez déjà répondu")}</p>
            {contact && <ContactDetails contact={contact} title={localizedJobTitle(job, locale)} />}
          </div>}
          {session && dashboard?.active && job.responseCount !== 3 && !ownJobs.has(job.id) && !answeredJobs.has(job.id) &&
            <button type="button" className={styles.button} disabled={busy}
              onClick={() => {
                setView('provider');
                void send({ action: 'respond', id: job.id, message: '', quote: null }, t("Réponse transmise. Les coordonnées sont dans « Mes réponses »."));
              }}>{t("Répondre à cette demande")}</button>}
          {session && dashboard && job.responseCount !== 3 && !ownJobs.has(job.id) && !answeredJobs.has(job.id) && <details className={styles.jobReply}><summary className={styles.secondary}>{dashboard.active ? t("Ajouter un message ou un devis") : t("Répondre à cette demande")}</summary>
            {!dashboard.active ? <p>{t("Un abonnement actif est nécessaire pour envoyer votre réponse.")} <a href="#espace-pro" onClick={openPlan}>{company("plan")}</a></p> : <>
            <p>{guide[locale].beforeReply}</p>
            <form className={styles.form} onSubmit={submit(data => {
              const quote = String(data.get('quote'));
              setView('provider');
              void send({ action: 'respond', id: job.id, message: data.get('message'), quote: quote ? Math.round(Number(quote) * 100) : null }, t("Réponse transmise. Les coordonnées sont dans « Mes réponses »."));
            })}>
              <label>{t("Message ou détails du devis (facultatif)")}<textarea name="message" maxLength={1500} rows={3} /></label>
              <label>{t("Montant indicatif en euros (facultatif)")}<input name="quote" type="number" min="0.01" max="1000000" step="0.01" /></label>
              <button className={styles.button} disabled={busy}>{t("Envoyer ma réponse")}</button>
            </form></>}
          </details>}
        </article>})}</div>}
        {hasMoreJobs && !jobsError && <div ref={moreJobs} className={styles.moreJobs}>
          <button className={styles.secondary} disabled={jobsLoading} type="button"
            onClick={() => void refreshJobs(undefined, jobsPage + 1)}>
            {jobsLoading ? t("Chargement des demandes…") : t("Afficher plus de demandes")}
          </button>
        </div>}
        {(jobs || jobsError) && <button className={styles.secondary} disabled={busy || jobsLoading}
          onClick={() => void run(() => refreshJobs())}>{t("Actualiser les demandes")}</button>}
      </Card>
    </div>}
    </div>

    </div>
    <footer className={`site-footer ${styles.footer}`}>
      <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
      <div>
        <a href="/">{t("Accueil")}</a>
        <a href="/travaux?espace=contact#espace">{t("Contact")}</a>
        <a href="/disclaimer#travaux">{t("Mentions légales")}</a>
        {enabled && <AnalyticsConsent disabled={loading || Boolean(session && (!dashboard || dashboard.admin))} />}
      </div>
    </footer>
  </>;
}
