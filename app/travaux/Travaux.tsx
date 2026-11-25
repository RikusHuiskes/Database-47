'use client';

import { createClient, type Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { travauxCategories, travauxCategoryLabel, travauxGroups, travauxPath, travauxText, type TravauxCategory } from '../../lib/travaux';
import { travauxCopy, travauxErrorText } from '../../lib/travaux-copy';
import { intlLocale } from '../../lib/i18n';
import { useLanguage } from '../i18n/Language';
import guide from '../../lib/travaux-guides.json';
import Guide from './Guide';
import Registry from './Registry';
import CompanyFields from './CompanyFields';
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
type Contact = { name: string; address: string; email: string; phone: string };
type Reply = { company: string; email: string; phone: string; message: string | null; quote_cents: number | null; slot: number };
type PublicJob = {
  id: string; title: string; description: string; commune: string; category: TravauxCategory; responseCount?: number;
};
type Job = PublicJob & {
  status: 'pending' | 'open' | 'rejected' | 'closed';
  responses?: Reply[];
};
type Dashboard = {
  active: boolean; admin: boolean; provider: { name: string; phone: string; details: CompanyDetails | null; subscribed: boolean; cancelled: boolean } | null;
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
  const copy = panels[locale];
  const company = companyCopy(locale);
  const [panel, setPanel] = useState<'jobs' | 'guide' | 'contact' | 'admin'>('jobs');

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
      if (currentSession.current?.user.id !== next?.user.id) {
        if (!next) setRecommended(false);
        setDashboard(null);
        setPanel(previous => previous === 'admin' ? 'jobs' : previous);
      }
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
    }
  }, [categoryFilter, communeFilter, recommended, token]);

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
      let result;
      try { result = await api(token, data); }
      catch (error) { if (data.action === 'respond') await refreshJobs(); throw error; }
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (data.action === 'publish') { setCategory(''); setCommune(''); setPublishVersion(version => version + 1); }
      setNotice(success);
      await refresh(token);
      if (['respond', 'moderate', 'close', 'save-profile'].includes(data.action)) await refreshJobs();
    });
  }

  const userEmail = session?.user.email;
  const provider = dashboard?.provider ?? null;
  const jobTown = communes.find(place => place.code === commune);
  const ownJobs = new Set(dashboard?.jobs.map(job => job.id));
  const answeredJobs = new Set(dashboard?.sent.map(reply => reply.job_id));
  const specialties = new Set(provider?.details?.specialties ?? []);
  const visibleJobs = jobs;
  const categoryPicker = (value: string, onChoose: (next: string) => void) =>
    <Picker label={t("Type de travaux")} placeholder={t("Choisir un type de travaux")}
      searchLabel={t("Rechercher un métier ou un type de travaux")} groups={categoryGroups} value={value} onChoose={onChoose} />;
  const communePicker = (value: string, onChoose: (next: string) => void) =>
    <Picker label={t("Commune des travaux")} placeholder={t("Choisir une commune")}
      searchLabel={t("Rechercher par commune ou code postal")} groups={communeGroups} value={value} onChoose={onChoose} />;

  return <div className={styles.body} id="espace">
    <nav className={styles.tabs} aria-label={copy.jobs}>
      {(['jobs', 'guide', 'contact', ...(dashboard?.admin ? ['admin'] as const : [])] as const).map(tab =>
        <button type="button" key={tab} className={styles.secondary} aria-pressed={panel === tab}
          onClick={() => setPanel(tab)}>{copy[tab]}</button>)}
    </nav>
    {panel === 'guide' && <Guide />}
    {panel === 'contact' && <Card title={copy.contact}>
      <p>{copy.help}</p><p><a href="mailto:info@cotededuras.com">info@cotededuras.com</a> · <a href="/contact">{copy.platformContact}</a></p>
      <h3>{copy.legal}</h3><p>{copy.market}</p><p>{copy.guarantees}</p><p>{copy.liability}</p>
    </Card>}
     {panel === 'admin' && dashboard?.admin && token && <>
      <Registry token={token} />
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
    <div hidden={panel !== 'jobs'}>
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
        {session && <div className={styles.tabs}>
          <button type="button" className={styles.secondary} aria-pressed={!recommended} onClick={() => setRecommended(false)}>{t("Toutes les demandes")}</button>
          <button type="button" className={styles.secondary} aria-pressed={recommended} onClick={() => setRecommended(true)}>{t("Recommandées pour moi")}</button>
        </div>}
        {session && recommended && !specialties.size && <p><a href="#compte" onClick={() => setView('provider')}>{t("Ajoutez vos spécialités dans votre espace pro pour recevoir des recommandations.")}</a></p>}
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
          <div className={styles.actions}>
            <span className={styles.meta}>{job.responseCount ?? 0}/3 {t("réponses")}{job.responseCount === 3 ? " · " + t("Complet") : ""}</span>
            {specialties.has(job.category) && <span className={styles.match}>{t("Correspond à vos spécialités")}</span>}
          </div>
          {session && ownJobs.has(job.id) && <p>{t("Votre demande")}</p>}
          {session && answeredJobs.has(job.id) && <p>{t("Vous avez déjà répondu")}</p>}
          {session && dashboard && job.responseCount !== 3 && !ownJobs.has(job.id) && !answeredJobs.has(job.id) && <details className={styles.jobReply}><summary className={styles.button}>{t("Répondre à cette demande")}</summary>
            {!dashboard.active ? <p>{t("Un abonnement actif est nécessaire pour envoyer votre réponse.")} <a href="#compte" onClick={() => setView('provider')}>{t("abonnez-vous pour 25 € par mois")}</a></p> : <>
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
          const email = String(data.get('email') ?? '').trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Vérifiez votre adresse e-mail (ex. nom@exemple.fr).');
          const { error: authError } = await auth.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + travauxPath + '?' + new URLSearchParams({ lang: locale, ...(view === 'provider' && { espace: 'pro' }) }) },
          });
          if (authError?.code === 'email_address_invalid' || authError?.code === 'validation_failed') {
            throw Error('Vérifiez votre adresse e-mail (ex. nom@exemple.fr).');
          }
          if (authError?.code === 'over_email_send_rate_limit' || authError?.code === 'over_request_rate_limit') {
            throw Error('Patientez avant de demander un nouveau lien.');
          }
          if (authError) throw Error("Le lien de connexion n’a pas pu être envoyé. Réessayez dans quelques instants.");
          setNotice(t("Consultez votre boîte e-mail pour ouvrir votre lien de connexion."));
        }))}>
          <label>{t("Adresse e-mail")}<input name="email" type="text" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required /></label>
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
                <p className={styles.meta}>{guide[locale].privacy} <a href="/contact">{guide[locale].contact}</a></p>
                <div className={styles.fields}>
                  <label>{t("Nom et prénom")}<input name="name" autoComplete="name" maxLength={120} required /></label>
                  <label>{t("Téléphone")}<input name="phone" type="tel" autoComplete="tel" maxLength={30} required /></label>
                </div>
                <label>{company('street')}<input name="address" autoComplete="address-line1" maxLength={160} required /></label>
                <label>{company('complement')}<input name="complement" autoComplete="address-line2" maxLength={80} /></label>
                <div className={styles.fields}>
                  <label>{company('postcode')}<input autoComplete="postal-code" value={jobTown?.postcode ?? ''} readOnly /></label>
                  <label>{company('city')}<input autoComplete="address-level2" value={jobTown?.name ?? ''} readOnly /></label>
                </div>
                <label>{t("Adresse e-mail")}<input type="email" value={userEmail ?? ""} readOnly autoComplete="email" /></label>
                <p className={styles.meta}>{t("Adresse e-mail partagée avec les répondants retenus")}</p>
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
            </> : null}
            {dashboard && <form key={provider?.subscribed ? 'profile' : 'checkout'} className={styles.form} onSubmit={submit(data => void send({
              action: provider?.subscribed ? 'save-profile' : 'checkout', ...Object.fromEntries(data),
              specialties: data.getAll('specialties'), locale, termsVersion, consent: data.has('billingConsent'),
            }, provider?.subscribed ? company('saved') : t("Paiement confirmé. Votre accès a été actualisé.")))}>
              <CompanyFields profile={provider} email={userEmail} />
              {!provider?.subscribed && <>
                <details><summary>{company('terms')}</summary><p>{company('termsText')}</p>
                  <p>{copy.market} {copy.guarantees} {copy.liability}</p></details>
                <label className={styles.check}><input name="billingConsent" type="checkbox" required /> {company('accept')}</label>
              </>}
              <button className={styles.button} disabled={busy}>{provider?.subscribed ? company('save')
                : provider ? t("Reprendre ou vérifier mon paiement") : t("S’abonner avec Mollie")}</button>
            </form>}
          </Card>
          <Card title={t("Mes réponses")}>
            {!dashboard?.sent.length && <p>{t("Aucune réponse envoyée.")}</p>}
            {dashboard?.sent.map(({ job, job_id }) => job?.contact && <article key={job_id} className={styles.item}>
              <h3>{job.title}</h3><p>{job.contact.name} · {job.contact.address}</p>
              <p>{job.contact.email} · {job.contact.phone}</p>
            </article>)}
          </Card>
        </>}

      </>}
    </div>}
    </div>
  </div>;
}
