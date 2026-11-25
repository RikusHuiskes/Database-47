import { adminService } from '../../../lib/admin-service';
import { travauxCategories } from '../../../lib/travaux';
import {
  checked, field, phoneField, travauxCommunes, TravauxError, travauxFailure,
  travauxJson, travauxTestMode, travauxUser, uuid,
} from '../../../lib/travaux-server';
import { cancelTravauxSubscription, startTravauxCheckout } from '../../../lib/travaux-billing';

const jobFields = 'id,title,description,category,commune,status,created_at';
const contactFields = 'company,email,phone,message,quote_cents,slot';

export async function GET(request: Request) {
  try {
    const { db, user } = await travauxUser(request);
    const [paid, profile, jobs, sent, admin] = await Promise.all([
      db.rpc('travaux_paid', { p_user: user.id, p_test: travauxTestMode() }),
      db.from('travaux_providers').select('name,phone,cancelled_at,subscription_id').eq('user_id', user.id).maybeSingle(),
      db.from('travaux_jobs').select(`${jobFields}, responses:travaux_responses(${contactFields})`)
        .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100),
      db.from('travaux_responses').select('job_id,job:travaux_jobs(title,commune,contact:travaux_contacts(name,address,email,phone))')
        .eq('provider_id', user.id).order('job_id').limit(100),
      adminService(request),
    ]);
    const active = Boolean(checked(paid));
    const provider = checked(profile);
    const pending = admin ? checked(await db.from('travaux_jobs').select(jobFields)
      .eq('status', 'pending').order('created_at').limit(100)) : [];
    return travauxJson({
      active, pending, jobs: checked(jobs), sent: checked(sent),
      provider: provider && {
        name: provider.name, phone: provider.phone, cancelled: Boolean(provider.cancelled_at),
        subscribed: Boolean(provider.subscription_id),
      },
    });
  } catch (error) { return travauxFailure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, user, email } = await travauxUser(request);
    const raw = await request.text();
    if (raw.length > 8000) throw new TravauxError('Demande trop longue.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new TravauxError('Demande invalide.'); }
    if (!body || typeof body !== 'object') throw new TravauxError('Demande invalide.');

    if (body.action === 'checkout') {
      return travauxJson(await startTravauxCheckout(db, request, user.id, email,
        field(body.company, 'entreprise', 120), phoneField(body.phone)));
    }
    if (body.action === 'cancel') {
      await cancelTravauxSubscription(db, user.id);
      return travauxJson({ ok: true });
    }
    if (body.action === 'publish') {
      const commune = travauxCommunes.find(item => item.code === body.commune);
      if (!commune) throw new TravauxError('Choisissez une commune dans un rayon de 50 km autour de Duras.');
      if (!Object.hasOwn(travauxCategories, body.category)) throw new TravauxError('Choisissez un type de travaux.');
      const title = field(body.title, 'titre', 100, 5);
      const description = field(body.description, 'description', 2000, 20);
      if (body.consent !== true) throw new TravauxError('Confirmez le partage des coordonnées.');
      if (/@|https?:\/\/|www\.|(?:\d[ .()-]*){8}/i.test(title + ' ' + description)) {
        throw new TravauxError('Saisissez vos coordonnées uniquement dans les champs privés.');
      }
      const id = checked(await db.rpc('travaux_create', {
        p_owner: user.id, p_job: { title, description, category: body.category, commune: commune.name },
        p_contact: { name: field(body.name, 'nom', 120), address: field(body.address, 'adresse', 220), phone: phoneField(body.phone), email },
      }));
      return travauxJson({ id }, 201);
    }

    if (!uuid(body.id)) throw new TravauxError('Demande introuvable.', 404);
    if (body.action === 'moderate') {
      const admin = await adminService(request);
      if (!admin) throw new TravauxError('Accès réservé à la modération.', 403);
      if (!['open', 'rejected'].includes(body.status)) throw new TravauxError('Décision invalide.');
      const job = checked(await admin.from('travaux_jobs').update({ status: body.status })
        .eq('id', body.id).eq('status', 'pending').select('id').maybeSingle());
      if (!job) throw new TravauxError('Cette demande a déjà été traitée.', 409);
      return travauxJson({ ok: true });
    }
    if (body.action === 'close') {
      checked(await db.from('travaux_jobs').update({ status: 'closed' }).eq('id', body.id)
        .eq('owner_id', user.id).in('status', ['pending', 'open']));
      return travauxJson({ ok: true });
    }
    if (body.action === 'respond') {
      const quote = body.quote;
      if (quote !== null && (!Number.isSafeInteger(quote) || quote < 1 || quote > 100000000)) {
        throw new TravauxError('Indiquez un montant valide en euros.');
      }
      const result = checked(await db.rpc('travaux_respond', { p_user: user.id, p_job: body.id,
        p_test: travauxTestMode(), p_quote: quote, p_message: field(body.message, 'message', 1500, 0) || null }));
      if (result === 'subscription') throw new TravauxError('Un abonnement actif est nécessaire.', 403);
      if (result !== 'accepted' && result !== 'already') throw new TravauxError('Cette demande est désormais fermée.', 409);
      return travauxJson({ ok: true });
    }
    throw new TravauxError('Action inconnue.');
  } catch (error) { return travauxFailure(error); }
}
