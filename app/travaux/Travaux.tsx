'use client';

import { createClient, type Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { travauxCategories, travauxPath } from '../../lib/travaux';
import styles from './travaux.module.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiPath = '/api/travaux';
let browserAuth: ReturnType<typeof createClient> | undefined;

function travauxAuth() {
  if (typeof window === 'undefined' || !url || !key) return null;
  return browserAuth ??= createClient(url, key, { auth: { storageKey: 'cdd-travaux-auth' } });
}

type Commune = { code: string; name: string; postcode: string };
type Contact = { name: string; address: string; email: string; phone: string };
type Reply = { company: string; email: string; phone: string; message: string | null; quote_cents: number | null; slot: number };
type PublicJob = {
  id: string; title: string; description: string; commune: string; category: keyof typeof travauxCategories;
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
const jobStatus = { pending: 'En cours de vérification', open: 'En ligne', rejected: 'Refusée', closed: 'Clôturée' };
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.card}><h2>{title}</h2>{children}</section>;
}

function JobSummary({ job }: { job: PublicJob }) {
  return <>
    <p className={styles.meta}>{travauxCategories[job.category]} · {job.commune}</p>
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
  if (!res.ok) throw Error(result.error ?? 'Le service ne répond pas.');
  return result;
}

function submit(run: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(new FormData(event.currentTarget));
  };
}

export default function Travaux({ enabled }: { enabled: boolean }) {
  const [auth] = useState(() => enabled ? travauxAuth() : null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<'resident' | 'provider'>('resident');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
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
      if (stillCurrent()) setError(err instanceof Error ? err.message : 'Le service ne répond pas.');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void refresh(token, controller.signal);
    fetch(apiPath + '/communes', { signal: controller.signal })
      .then(res => { if (!res.ok) throw Error(); return res.json(); })
      .then(setCommunes)
      .catch(() => { if (!controller.signal.aborted) setError('La liste des communes est temporairement indisponible.'); });
    return () => controller.abort();
  }, [token, refresh]);

  const refreshJobs = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await fetch(apiPath + '/jobs', { signal, cache: 'no-store' });
      if (!result.ok) throw Error();
      const publicJobs = await result.json();
      if (!signal?.aborted) {
        setJobs(publicJobs);
        setJobsError(false);
      }
    } catch {
      if (!signal?.aborted) setJobsError(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void refreshJobs(controller.signal);
    return () => controller.abort();
  }, [enabled, refreshJobs]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Le service ne répond pas.'); }
    finally { setBusy(false); }
  }

  async function send(data: { action: string; [key: string]: unknown }, success: string) {
    if (!token) return;
    await run(async () => {
      const result = await api(token, data);
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (data.action === 'publish') setPublishVersion(version => version + 1);
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

  return <div className={styles.body} id="espace">
    <div className={styles.pathways}>
      <section className={styles.card}>
        <h2>J’ai des travaux à faire</h2>
        <p>Décrivez votre projet gratuitement. Vos coordonnées sont communiquées aux trois premiers professionnels abonnés qui répondent. Vous retrouvez leurs contacts et leurs propositions dans votre espace.</p>
        {enabled && <a className={styles.button} href="#compte" onClick={() => setView('resident')}>Déposer une demande</a>}
      </section>
      <section className={styles.card}>
        <h2>Je suis artisan</h2>
        <p>Consultez librement les demandes près de Duras. Abonnez-vous pour répondre aux projets qui vous intéressent.</p>
        <p className={styles.price}><strong>25 €</strong> / mois · paiement via Mollie</p>
        {enabled && <a className={styles.button} href="#demandes" onClick={() => setView('provider')}>Voir les demandes de travaux</a>}
        {enabled && <p className={styles.proLink}><a href="#compte" onClick={() => setView('provider')}>Accéder à l’espace pro</a></p>}
      </section>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.status} role="status">{notice}</p>}
    {enabled && <div id="demandes">
      <Card title="Demandes de travaux">
        {!dashboard?.active && <p>Consultez librement les demandes. Pour répondre et recevoir les coordonnées du demandeur, <a href="#compte" onClick={() => setView('provider')}>abonnez-vous pour 25 € par mois</a>.</p>}
        {jobsError && <p role="alert">Les demandes sont temporairement indisponibles.</p>}
        {!jobsError && !visibleJobs && <p role="status">Chargement des demandes…</p>}
        {!jobsError && visibleJobs?.length === 0 && <p>Aucune nouvelle demande disponible.</p>}
        {visibleJobs?.map(job => <article className={styles.item} key={job.id}>
          <JobSummary job={job} />
          {dashboard?.active && <details><summary>Répondre à cette demande</summary>
            <form className={styles.form} onSubmit={submit(data => {
              const quote = String(data.get('quote'));
              void send({ action: 'respond', id: job.id, message: data.get('message'), quote: quote ? Math.round(Number(quote) * 100) : null }, 'Réponse transmise. Les coordonnées sont dans « Mes réponses ».');
            })}>
              <label>Message ou détails du devis (facultatif)<textarea name="message" maxLength={1500} rows={3} /></label>
              <label>Montant indicatif en euros (facultatif)<input name="quote" type="number" min="0.01" max="1000000" step="0.01" /></label>
              <button className={styles.button} disabled={busy}>Envoyer ma réponse</button>
            </form>
          </details>}
        </article>)}
        {(jobs || jobsError) && <button className={styles.secondary} disabled={busy}
          onClick={() => void run(() => refreshJobs())}>Actualiser les demandes</button>}
      </Card>
    </div>}

    {!enabled ? <p className={styles.status}>Les inscriptions ouvriront prochainement.</p> : <div id="compte" aria-busy={busy || loading}>
      {loading ? <p role="status">Chargement de votre espace…</p> : !session ? <Card title="Accéder à mon espace">
        <form className={styles.form} onSubmit={submit(data => void run(async () => {
          if (!auth) throw Error('Connexion indisponible.');
          const { error: authError } = await auth.auth.signInWithOtp({
            email: String(data.get('email')).trim(),
            options: { emailRedirectTo: window.location.origin + travauxPath + (view === 'provider' ? '?espace=pro' : '') },
          });
          if (authError) throw Error('Le lien de connexion n’a pas pu être envoyé. Réessayez dans quelques instants.');
          setNotice('Consultez votre boîte e-mail pour ouvrir votre lien de connexion.');
        }))}>
          <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required /></label>
          <button className={styles.button} disabled={busy}>Recevoir mon lien de connexion</button>
        </form>
      </Card> : <>
        <div className={styles.account}>
          <span>{userEmail}</span>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => void run(async () => { await auth?.auth.signOut({ scope: 'local' }); })}>Se déconnecter</button>
        </div>

        {view === 'resident' ? <>
          <Card title="Déposer une demande">
            <form key={publishVersion} className={styles.form} onSubmit={submit(data => void send({
              action: 'publish', ...Object.fromEntries(data), consent: data.has('consent'),
            }, 'Votre demande a été reçue. Elle sera publiée après vérification.'))}>
              <div className={styles.fields}>
                <label>Type de travaux<select name="category" required><option value="">Sélectionner</option>
                  {Object.entries(travauxCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <label>Commune des travaux<select name="commune" required><option value="">Sélectionner</option>
                  {communes.map(place => <option key={place.code} value={place.code}>{place.name} ({place.postcode})</option>)}
                </select></label>
              </div>
              <label>Titre<input name="title" minLength={5} maxLength={100} required /></label>
              <label>Description<textarea name="description" minLength={20} maxLength={2000} rows={5} required placeholder="Dimensions, matériaux, état actuel et délai souhaité" /></label>
              <fieldset><legend>Coordonnées privées</legend>
                <div className={styles.fields}>
                  <label>Nom et prénom<input name="name" autoComplete="name" maxLength={120} required /></label>
                  <label>Téléphone<input name="phone" type="tel" autoComplete="tel" maxLength={30} required /></label>
                </div>
                <label>Adresse des travaux<input name="address" autoComplete="street-address" maxLength={220} required /></label>
                <p className={styles.meta}>Adresse e-mail partagée avec les répondants retenus&nbsp;: {userEmail}</p>
              </fieldset>
              <label className={styles.check}><input name="consent" type="checkbox" required /> J’accepte que mon nom, mon adresse, mon téléphone et mon e-mail soient transmis aux trois premiers professionnels abonnés qui répondent à cette demande.</label>
              <button className={styles.button} disabled={busy || !communes.length}>Envoyer ma demande gratuite</button>
            </form>
          </Card>
          <Card title="Mes demandes et mes contacts">
            {!dashboard?.jobs.length && <p>{dashboard ? 'Aucune demande déposée.' : 'Chargement des demandes…'}</p>}
            {dashboard?.jobs.map(job => <article className={styles.item} key={job.id}>
              <JobSummary job={job} /><p className={styles.meta}>{jobStatus[job.status]} · {job.responses?.length ?? 0}/3 contacts</p>
              {[...(job.responses ?? [])].sort((a, b) => a.slot - b.slot).map(reply => <div key={reply.slot} className={styles.reply}>
                <strong>{reply.company}</strong><p>{reply.email} · {reply.phone}</p>
                {reply.quote_cents !== null && <p>Montant proposé&nbsp;: {eur.format(reply.quote_cents / 100)}</p>}
                {reply.message && <p className={styles.description}>{reply.message}</p>}
              </div>)}
              {['open', 'pending'].includes(job.status) && <button className={styles.secondary} disabled={busy} onClick={() => {
                if (window.confirm('Clôturer cette demande ?')) void send({ action: 'close', id: job.id }, 'Demande clôturée.');
              }}>Clôturer la demande</button>}
            </article>)}
            {token && <button className={styles.secondary} disabled={busy} onClick={() => void run(() => refresh(token))}>Actualiser mes contacts</button>}
          </Card>
        </> : <>
          <Card title="Mon abonnement professionnel">
            {!dashboard ? <p>Chargement de l’abonnement…</p> : provider?.subscribed ? <>
              <p>{dashboard.active ? 'Accès actif pour la période payée.' : 'Aucun accès actif pour la période en cours.'}</p>
              {provider.cancelled ? <p>Le renouvellement automatique est arrêté.</p> :
                <button className={styles.secondary} disabled={busy} onClick={() => {
                  if (window.confirm('Arrêter le renouvellement mensuel ?')) void send({ action: 'cancel' }, 'Renouvellement arrêté.');
                }}>Arrêter le renouvellement</button>}
            </> : <form className={styles.form} onSubmit={submit(data => void send({
              action: 'checkout', company: data.get('company'), phone: data.get('phone'),
            }, 'Paiement confirmé. Votre accès a été actualisé.'))}>
              <p>Le premier mois coûte 25 €, puis l’abonnement se renouvelle à 25 € par mois jusqu’à sa résiliation.</p>
              <div className={styles.fields}>
                <label>Nom de l’entreprise<input name="company" defaultValue={provider?.name} readOnly={Boolean(provider)} autoComplete="organization" maxLength={120} required /></label>
                <label>Téléphone professionnel<input name="phone" defaultValue={provider?.phone} readOnly={Boolean(provider)} type="tel" autoComplete="tel" maxLength={30} required /></label>
              </div>
              <button className={styles.button} disabled={busy}>{provider ? 'Reprendre ou vérifier mon paiement' : 'S’abonner avec Mollie'}</button>
            </form>}
          </Card>
          <Card title="Mes réponses">
            {!dashboard?.sent.length && <p>Aucune réponse envoyée.</p>}
            {dashboard?.sent.map(({ job, job_id }) => job?.contact && <article key={job_id} className={styles.item}>
              <h3>{job.title}</h3><p>{job.contact.name} · {job.contact.address}, {job.commune}</p>
              <p>{job.contact.email} · {job.contact.phone}</p>
            </article>)}
          </Card>
        </>}
        {Boolean(dashboard?.pending.length) && <Card title="Demandes à modérer">
          <p>Vérifiez que le titre et la description préservent l’anonymat du demandeur avant de publier.</p>
          {dashboard?.pending.map(job => <article key={job.id} className={styles.item}>
            <JobSummary job={job} /><div className={styles.actions}>
              <button className={styles.button} disabled={busy} onClick={() => void send({ action: 'moderate', id: job.id, status: 'open' }, 'Demande publiée.')}>Publier</button>
              <button className={styles.secondary} disabled={busy} onClick={() => void send({ action: 'moderate', id: job.id, status: 'rejected' }, 'Demande refusée.')}>Refuser</button>
            </div>
          </article>)}
        </Card>}
      </>}
    </div>}
  </div>;
}
