'use client';

import { createClient, type Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { travauxCategories, travauxCategoryLabel, travauxGroups, travauxPath, travauxText, type TravauxCategory } from '../../lib/travaux';
import { travauxCopy, travauxErrorText } from '../../lib/travaux-copy';
import { intlLocale } from '../../lib/i18n';
import { useLanguage } from '../i18n/Language';
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
type Contact = { name: string; address: string; email: string; phone: string };
type Reply = { company: string; email: string; phone: string; message: string | null; quote_cents: number | null; slot: number };
type PublicJob = {
  id: string; title: string; description: string; commune: string; category: TravauxCategory;
};
type Job = PublicJob & {
  status: 'pending' | 'open' | 'rejected' | 'closed';
  responses?: Reply[];
};
type Dashboard = {
  active: boolean; provider: { name: string; phone: string; subscribed: boolean; cancelled: boolean } | null;
  jobs: Job[]; pending: Job[];
  sent: { job_id: string; job: { title: string; commune: string; contact: Contact | null } | null }[];
};
const jobStatus = { pending: 'En cours de vérification', open: 'En ligne', rejected: 'Refusée', closed: 'Clôturée' } as const;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.card}><h2>{title}</h2>{children}</section>;
}

function JobSummary({ job }: { job: PublicJob }) {
  const { locale } = useLanguage();
  return <>
    <p className={styles.meta}>{travauxCategoryLabel(job.category, locale)} · {job.commune}</p>
    <h3>{job.title}</h3><p className={styles.description}>{job.description}</p>
  </>;
}

async function api(token: string, data?: object) {
  const res = await fetch(apiPath, {
    method: data ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(data && { 'Content-Type': 'application/json' }) },
    body: data && JSON.stringify(data),
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

export default function Travaux({ enabled, communes }: { enabled: boolean; communes: Commune[] }) {
  const { locale } = useLanguage();
  const t = travauxCopy(locale);
  const eur = new Intl.NumberFormat(intlLocale[locale], { style: 'currency', currency: 'EUR' });
  const [category, setCategory] = useState('');
  const [commune, setCommune] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [communeFilter, setCommuneFilter] = useState('');
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
  const [view, setView] = useState<'resident' | 'provider'>('resident');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [jobsPage, setJobsPage] = useState(0);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const latestJobsRequest = useRef(0);
  const [jobsError, setJobsError] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const token = session?.access_token;
  const currentSession = useRef<Session | null>(null);
  const [publishVersion, setPublishVersion] = useState(0);

  useEffect(() => {
    if (!auth) return;
    const { data } = auth.auth.onAuthStateChange((_event, next) => {
      if (currentSession.current?.user.id !== next?.user.id) setDashboard(null);
      currentSession.current = next;
      setSession(next);
      setLoading(false);
    });
    if (['paiement', 'espace'].some(name => new URLSearchParams(window.location.search).has(name))) setView('provider');
    return () => data.subscription.unsubscribe();
  }, [auth]);

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
    const params = new URLSearchParams({ page: String(page) });
    if (categoryFilter) params.set('category', categoryFilter);
    if (communeFilter) params.set('commune', communeFilter);
    try {
      const result = await fetch(apiPath + '/jobs?' + params, { signal, cache: 'no-store' });
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
    }
  }, [categoryFilter, communeFilter]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setJobs(null);
    setJobsError(false);
    setHasMoreJobs(false);
    void refreshJobs(controller.signal);
    return () => controller.abort();
  }, [enabled, refreshJobs]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Le service ne répond pas."); }
    finally { setBusy(false); }
  }

  async function send(data: { action: string; [key: string]: unknown }, success: string) {
    if (!token) return;
    await run(async () => {
      const result = await api(token, data);
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (data.action === 'publish') { setCategory(''); setCommune(''); setPublishVersion(version => version + 1); }
      setNotice(success);
      await refresh(token);
      if (['respond', 'moderate', 'close'].includes(data.action)) await refreshJobs();
    });
  }

  const userEmail = session?.user.email;
  const provider = dashboard?.provider;
  const ownOrAnsweredJobs = new Set([
    ...(dashboard?.jobs ?? []).map(job => job.id),
    ...(dashboard?.sent ?? []).map(reply => reply.job_id),
  ]);
  const visibleJobs = jobs?.filter(job => !ownOrAnsweredJobs.has(job.id));
  const categoryPicker = (value: string, onChoose: (next: string) => void) =>
    <Picker label={t("Type de travaux")} placeholder={t("Choisir un type de travaux")}
      searchLabel={t("Rechercher un métier ou un type de travaux")} groups={categoryGroups} value={value} onChoose={onChoose} />;
  const communePicker = (value: string, onChoose: (next: string) => void) =>
    <Picker label={t("Commune des travaux")} placeholder={t("Choisir une commune")}
      searchLabel={t("Rechercher par commune ou code postal")} groups={communeGroups} value={value} onChoose={onChoose} />;

  return <div className={styles.body} id="espace">
    <div className={styles.pathways}>
      <section className={styles.card}>
        <h2>{t("J’ai des travaux à faire")}</h2>
        <p>{t("Décrivez votre projet gratuitement. Vos coordonnées sont communiquées aux trois premiers professionnels abonnés qui répondent. Vous retrouvez leurs contacts et leurs propositions dans votre espace.")}</p>
        {enabled && <a className={styles.button} href="#compte" onClick={() => setView('resident')}>{t("Déposer une demande")}</a>}
      </section>
      <section className={styles.card}>
        <h2>{t("Je suis artisan")}</h2>
        <p>{t("Consultez librement les demandes près de Duras. Abonnez-vous pour répondre aux projets qui vous intéressent.")}</p>
        <p className={styles.price}><strong>{eur.format(25).replace(/[.,]00(?=\s|$)/, '')}</strong> {t("/ mois · paiement via Mollie")}</p>
        {enabled && <a className={styles.button} href="#demandes" onClick={() => setView('provider')}>{t("Voir les demandes de travaux")}</a>}
        {enabled && <p className={styles.proLink}><a href="#compte" onClick={() => setView('provider')}>{t("Accéder à l’espace pro")}</a></p>}
      </section>
    </div>

    {error && <p className={styles.error} role="alert">{travauxErrorText(error, locale)}</p>}
    {notice && <p className={styles.status} role="status">{notice}</p>}
    {enabled && <div id="demandes">
      <Card title={t("Demandes de travaux")}>
        {!dashboard?.active && <p>{t("Consultez librement les demandes. Pour répondre et recevoir les coordonnées du demandeur,")} <a href="#compte" onClick={() => setView('provider')}>{t("abonnez-vous pour 25 € par mois")}</a>.</p>}
        <div className={styles.filters}>
          {categoryPicker(categoryFilter, setCategoryFilter)}
          {communePicker(communeFilter, setCommuneFilter)}
          {(categoryFilter || communeFilter) && <button type="button" className={styles.secondary}
            onClick={() => { setCategoryFilter(''); setCommuneFilter(''); }}>{t("Effacer les filtres")}</button>}
        </div>
        {jobsError && <p role="alert">{t("Les demandes sont temporairement indisponibles.")}</p>}
        {!jobsError && !visibleJobs && <p role="status">{t("Chargement des demandes…")}</p>}
        {!jobsError && visibleJobs?.length === 0 && <p>{t("Aucune nouvelle demande disponible.")}</p>}
        {visibleJobs?.map(job => <article className={styles.item} key={job.id}>
          <JobSummary job={job} />
          {dashboard?.active && <details><summary>{t("Répondre à cette demande")}</summary>
            <form className={styles.form} onSubmit={submit(data => {
              const quote = String(data.get('quote'));
              void send({ action: 'respond', id: job.id, message: data.get('message'), quote: quote ? Math.round(Number(quote) * 100) : null }, t("Réponse transmise. Les coordonnées sont dans « Mes réponses »."));
            })}>
              <label>{t("Message ou détails du devis (facultatif)")}<textarea name="message" maxLength={1500} rows={3} /></label>
              <label>{t("Montant indicatif en euros (facultatif)")}<input name="quote" type="number" min="0.01" max="1000000" step="0.01" /></label>
              <button className={styles.button} disabled={busy}>{t("Envoyer ma réponse")}</button>
            </form>
          </details>}
        </article>)}
        {hasMoreJobs && <button className={styles.button} disabled={busy} type="button"
          onClick={() => void run(() => refreshJobs(undefined, jobsPage + 1))}>{t("Afficher plus de demandes")}</button>}
        {(jobs || jobsError) && <button className={styles.secondary} disabled={busy}
          onClick={() => void run(() => refreshJobs())}>{t("Actualiser les demandes")}</button>}
      </Card>
    </div>}

    {!enabled ? <p className={styles.status}>{t("Les inscriptions ouvriront prochainement.")}</p> : <div id="compte" aria-busy={busy || loading}>
      {loading ? <p role="status">{t("Chargement de votre espace…")}</p> : !session ? <Card title={t("Accéder à mon espace")}>
        <form className={styles.form} onSubmit={submit(data => void run(async () => {
          if (!auth) throw Error("Connexion indisponible.");
          const { error: authError } = await auth.auth.signInWithOtp({
            email: String(data.get('email')).trim(),
            options: { emailRedirectTo: window.location.origin + travauxPath + '?' + new URLSearchParams({ lang: locale, ...(view === 'provider' && { espace: 'pro' }) }) },
          });
          if (authError) throw Error("Le lien de connexion n’a pas pu être envoyé. Réessayez dans quelques instants.");
          setNotice(t("Consultez votre boîte e-mail pour ouvrir votre lien de connexion."));
        }))}>
          <label>{t("Adresse e-mail")}<input name="email" type="email" autoComplete="email" required /></label>
          <button className={styles.button} disabled={busy}>{t("Recevoir mon lien de connexion")}</button>
        </form>
      </Card> : <>
        <div className={styles.account}>
          <span>{userEmail}</span>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => void run(async () => { await auth?.auth.signOut({ scope: 'local' }); })}>{t("Se déconnecter")}</button>
        </div>

        {view === 'resident' ? <>
          <Card title={t("Déposer une demande")}>
            <form key={publishVersion} className={styles.form} onSubmit={submit(data => void send({
              action: 'publish', ...Object.fromEntries(data), category, commune, consent: data.has('consent'),
            }, t("Votre demande a été reçue. Elle sera publiée après vérification.")))}>
              <div className={styles.fields}>
                {categoryPicker(category, setCategory)}
                {communePicker(commune, setCommune)}
              </div>
              <label>{t("Titre")}<input name="title" minLength={5} maxLength={100} required /></label>
              <label>{t("Description")}<textarea name="description" minLength={20} maxLength={2000} rows={5} required placeholder={t("Dimensions, matériaux, état actuel et délai souhaité")} /></label>
              <fieldset><legend>{t("Coordonnées privées")}</legend>
                <div className={styles.fields}>
                  <label>{t("Nom et prénom")}<input name="name" autoComplete="name" maxLength={120} required /></label>
                  <label>{t("Téléphone")}<input name="phone" type="tel" autoComplete="tel" maxLength={30} required /></label>
                </div>
                <label>{t("Adresse des travaux")}<input name="address" autoComplete="street-address" maxLength={220} required /></label>
                <p className={styles.meta}>{t("Adresse e-mail partagée avec les répondants retenus")}&nbsp;: {userEmail}</p>
              </fieldset>
              <label className={styles.check}><input name="consent" type="checkbox" required /> {t("J’accepte que mon nom, mon adresse, mon téléphone et mon e-mail soient transmis aux trois premiers professionnels abonnés qui répondent à cette demande.")}</label>
              <button className={styles.button} disabled={busy || !category || !commune}>{t("Envoyer ma demande gratuite")}</button>
            </form>
          </Card>
          <Card title={t("Mes demandes et mes contacts")}>
            {!dashboard?.jobs.length && <p>{dashboard ? t("Aucune demande déposée.") : t("Chargement des demandes…")}</p>}
            {dashboard?.jobs.map(job => <article className={styles.item} key={job.id}>
              <JobSummary job={job} /><p className={styles.meta}>{t(jobStatus[job.status])} · {job.responses?.length ?? 0}/3 {t("contacts")}</p>
              {[...(job.responses ?? [])].sort((a, b) => a.slot - b.slot).map(reply => <div key={reply.slot} className={styles.reply}>
                <strong>{reply.company}</strong><p>{reply.email} · {reply.phone}</p>
                {reply.quote_cents !== null && <p>{t("Montant proposé")}&nbsp;: {eur.format(reply.quote_cents / 100)}</p>}
                {reply.message && <p className={styles.description}>{reply.message}</p>}
              </div>)}
              {['open', 'pending'].includes(job.status) && <button className={styles.secondary} disabled={busy} onClick={() => {
                if (window.confirm(t("Clôturer cette demande ?"))) void send({ action: 'close', id: job.id }, t("Demande clôturée."));
              }}>{t("Clôturer la demande")}</button>}
            </article>)}
            {token && <button className={styles.secondary} disabled={busy} onClick={() => void run(() => refresh(token))}>{t("Actualiser mes contacts")}</button>}
          </Card>
        </> : <>
          <Card title={t("Mon abonnement professionnel")}>
            {!dashboard ? <p>{t("Chargement de l’abonnement…")}</p> : provider?.subscribed ? <>
              <p>{dashboard.active ? t("Accès actif pour la période payée.") : t("Aucun accès actif pour la période en cours.")}</p>
              {provider.cancelled ? <p>{t("Le renouvellement automatique est arrêté.")}</p> :
                <button className={styles.secondary} disabled={busy} onClick={() => {
                  if (window.confirm(t("Arrêter le renouvellement mensuel ?"))) void send({ action: 'cancel' }, t("Renouvellement arrêté."));
                }}>{t("Arrêter le renouvellement")}</button>}
            </> : <form className={styles.form} onSubmit={submit(data => void send({
              action: 'checkout', company: data.get('company'), phone: data.get('phone'), locale, consent: data.has('billingConsent'),
            }, t("Paiement confirmé. Votre accès a été actualisé.")))}>
              <p>{t("Le premier mois coûte 25 €, puis l’abonnement se renouvelle à 25 € par mois jusqu’à sa résiliation.")}</p>
              <div className={styles.fields}>
                <label>{t("Nom de l’entreprise")}<input name="company" defaultValue={provider?.name} readOnly={Boolean(provider)} autoComplete="organization" maxLength={120} required /></label>
                <label>{t("Téléphone professionnel")}<input name="phone" defaultValue={provider?.phone} readOnly={Boolean(provider)} type="tel" autoComplete="tel" maxLength={30} required /></label>
              </div>
              <label className={styles.check}><input name="billingConsent" type="checkbox" required /> {t("J’accepte le paiement de 25 € par mois jusqu’à résiliation.")}</label>
              <button className={styles.button} disabled={busy}>{provider ? t("Reprendre ou vérifier mon paiement") : t("S’abonner avec Mollie")}</button>
            </form>}
          </Card>
          <Card title={t("Mes réponses")}>
            {!dashboard?.sent.length && <p>{t("Aucune réponse envoyée.")}</p>}
            {dashboard?.sent.map(({ job, job_id }) => job?.contact && <article key={job_id} className={styles.item}>
              <h3>{job.title}</h3><p>{job.contact.name} · {job.contact.address}, {job.commune}</p>
              <p>{job.contact.email} · {job.contact.phone}</p>
            </article>)}
          </Card>
        </>}
        {Boolean(dashboard?.pending.length) && <Card title={t("Demandes à modérer")}>
          <p>{t("Vérifiez que le titre et la description préservent l’anonymat du demandeur avant de publier.")}</p>
          {dashboard?.pending.map(job => <article key={job.id} className={styles.item}>
            <JobSummary job={job} /><div className={styles.actions}>
              <button className={styles.button} disabled={busy} onClick={() => void send({ action: 'moderate', id: job.id, status: 'open' }, t("Demande publiée."))}>{t("Publier")}</button>
              <button className={styles.secondary} disabled={busy} onClick={() => void send({ action: 'moderate', id: job.id, status: 'rejected' }, t("Demande refusée."))}>{t("Refuser")}</button>
            </div>
          </article>)}
        </Card>}
      </>}
    </div>}
  </div>;
}
