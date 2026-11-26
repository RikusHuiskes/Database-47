import { jobTitleLocales } from '../../../lib/travaux-job-title';
import { projectAddress, readCompanyDetails } from '../../../lib/travaux-company-server';
import { isTravauxPlan } from '../../../lib/travaux-plans';
import { processAdvertisingInvoiceMailOutbox } from '../../../lib/advertising-invoices';
import { after } from 'next/server';
import { termsVersion } from '../../../lib/travaux-company';
import { localeFrom } from '../../../lib/i18n';
import { adminService } from '../../../lib/admin-service';
import { travauxCategories } from '../../../lib/travaux';
import {
  checked, field, isTravauxOwner, phoneField, travauxCommunes, TravauxError, travauxFailure,
  travauxJson, travauxTestMode, travauxUser, uuid,
} from '../../../lib/travaux-server';
import { cancelTravauxSubscription, startTravauxCheckout } from '../../../lib/travaux-billing';

const jobFields = 'id,title,title_translations,description,description_translations,category,commune,status,created_at';
const publicContactPattern = /@|https?:\/\/|www\.|(?:\d[ .()-]*){8}/i;
const contactFields = 'company,email,phone,message,quote_cents,slot';

export async function GET(request: Request) {
  try {
    const { db, user } = await travauxUser(request);
    const [paid, profile, jobs, sent, admin] = await Promise.all([
      db.rpc('travaux_paid', { p_user: user.id, p_test: travauxTestMode() }),
      db.from('travaux_providers').select('name,phone,cancelled_at,notice_ends_on,subscription_id,details,billing_plan,first_payment_id,terms_version').eq('user_id', user.id).maybeSingle(),
      db.from('travaux_jobs').select(`${jobFields}, responses:travaux_responses(${contactFields})`)
        .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100),
      db.from('travaux_responses').select('job_id,job:travaux_jobs(title,title_translations,commune,contact:travaux_contacts(name,email,phone))')
        .eq('provider_id', user.id).order('job_id').limit(100),
      isTravauxOwner(user.id) ? adminService(request) : null,
    ]);
    const active = Boolean(checked(paid));
    const provider = checked(profile);
    const pending = admin ? checked(await db.from('travaux_jobs').select(jobFields)
      .eq('status', 'pending').order('created_at').limit(100)) : [];
    return travauxJson({
      active, admin: Boolean(admin), owner: Boolean(admin && isTravauxOwner(user.id)), pending, jobs: checked(jobs), sent: checked(sent),
      provider: provider && {
        name: provider.name, phone: provider.phone, details: provider.details, cancelled: Boolean(provider.cancelled_at), noticeUntil: provider.notice_ends_on,
        canResumeCheckout: Boolean(provider.first_payment_id && provider.terms_version === termsVersion && !active && !provider.subscription_id),
        subscribed: Boolean((provider.subscription_id && (!provider.cancelled_at || active)) || (provider.billing_plan === 'annual' && active)), plan: provider.billing_plan,
      },
    });
  } catch (error) { return travauxFailure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, user, email } = await travauxUser(request);
    const raw = await request.text();
    if (raw.length > 16000) throw new TravauxError('Demande trop longue.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new TravauxError('Demande invalide.'); }
    if (!body || typeof body !== 'object') throw new TravauxError('Demande invalide.');
    if (body.action !== 'moderate' && raw.length > 8000) throw new TravauxError('Demande trop longue.', 413);

    if (body.action === 'resume-checkout') {
      const profile = checked(await db.from('travaux_providers').select('name,phone,details,billing_plan,first_payment_id,terms_version')
        .eq('user_id', user.id).maybeSingle());
      if (!profile?.first_payment_id || profile.terms_version !== termsVersion || !profile.details || !isTravauxPlan(profile.billing_plan)) {
        throw new TravauxError('Confirmez le prix et le renouvellement de l’abonnement.');
      }
      const result = await startTravauxCheckout(db, request, user.id, email, profile.name, profile.phone, localeFrom(body.locale),
        profile.details, profile.billing_plan, true);
      if (result.ok) after(() => processAdvertisingInvoiceMailOutbox().catch(() => undefined));
      return travauxJson(result);
    }
    if (body.action === 'checkout' || body.action === 'save-profile') {
      const company = field(body.company, 'entreprise', 120);
      const phone = phoneField(body.phone);
      const details = readCompanyDetails(body);
      if (body.action === 'save-profile') {
        const saved = checked(await db.from('travaux_providers').update({ name: company, phone, email, details })
          .eq('user_id', user.id).select('user_id').maybeSingle());
        if (!saved) throw new TravauxError('Demande introuvable.', 404);
        return travauxJson({ ok: true });
      }
      if (body.consent !== true || body.termsVersion !== termsVersion) {
        throw new TravauxError('Confirmez le prix et le renouvellement de l’abonnement.');
      }
      if (!isTravauxPlan(body.plan)) throw new TravauxError('Choisissez une formule de paiement.');
      const result = await startTravauxCheckout(db, request, user.id, email, company, phone, localeFrom(body.locale), details, body.plan);
      if (result.ok) after(() => processAdvertisingInvoiceMailOutbox().catch(() => undefined));
      return travauxJson(result);
    }
    if (body.action === 'cancel') {
      await cancelTravauxSubscription(db, user.id, true);
      return travauxJson({ ok: true });
    }
    if (body.action === 'publish') {
      const commune = travauxCommunes.find(item => item.code === body.commune);
      if (!commune) throw new TravauxError('Choisissez une commune dans un rayon de 50 km autour de Duras.');
      if (typeof body.category !== 'string' || !Object.hasOwn(travauxCategories, body.category)) throw new TravauxError('Choisissez un type de travaux.');
      const title = field(body.title, 'titre', 100, 5);
      const description = field(body.description, 'description', 2000, 20);
      if (body.consent !== true) throw new TravauxError('Confirmez le partage des coordonnées.');
      if (publicContactPattern.test(title + ' ' + description)) {
        throw new TravauxError('Saisissez vos coordonnées uniquement dans les champs privés.');
      }
      if (body.submissionId !== undefined && !uuid(body.submissionId)) throw new TravauxError('Demande invalide.');
      const id = checked(await db.rpc('travaux_create', {
        ...(body.submissionId ? { p_submission: body.submissionId } : {}),
        p_owner: user.id, p_job: { title, description, category: body.category, commune: commune.name },
        p_contact: { name: field(body.name, 'nom', 120), address: projectAddress(body, commune), phone: phoneField(body.phone), email },
      }));
      return travauxJson({ id }, 201);
    }

    if (!uuid(body.id)) throw new TravauxError('Demande introuvable.', 404);
    if (body.action === 'moderate') {
      const admin = isTravauxOwner(user.id) && await adminService(request);
      if (!admin) throw new TravauxError('Accès réservé à la modération.', 403);
      if (!['open', 'rejected'].includes(body.status)) throw new TravauxError('Décision invalide.');
      const changes: { status: string; title_translations?: Record<string, string>; description_translations?: Record<string, string> } = {
        status: body.status,
      };
      if (body.status === 'open') {
        const titles: Record<string, string> = {};
        const descriptions: Record<string, string> = {};
        for (const locale of jobTitleLocales) {
          const title = typeof body.titles?.[locale] === 'string' ? body.titles[locale].trim() : '';
          if (!title || title.length > 100 || /[\u0000-\u001f]/.test(title)) {
            throw new TravauxError('Renseignez un titre dans chacune des trois langues.');
          }
          const description = typeof body.descriptions?.[locale] === 'string' ? body.descriptions[locale].trim() : '';
          if (!description || description.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(description)) {
            throw new TravauxError('Renseignez une description dans chacune des trois langues.');
          }
          if (publicContactPattern.test(title + ' ' + description)) {
            throw new TravauxError('Saisissez vos coordonnées uniquement dans les champs privés.');
          }
          titles[locale] = title;
          descriptions[locale] = description;
        }
        changes.title_translations = titles;
        changes.description_translations = descriptions;
      }
      const job = checked(await admin.from('travaux_jobs').update(changes)
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
