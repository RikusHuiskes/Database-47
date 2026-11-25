import { adminService } from '../../../../lib/admin-service';
import { parisToday } from '../../../../lib/recurring-server';
import { checked, isTravauxOwner, travauxUser, travauxFailure, travauxJson, TravauxError, uuid } from '../../../../lib/travaux-server';

const pageSize = 25;

export async function GET(request: Request) {
  try {
    const { user } = await travauxUser(request);
    const db = isTravauxOwner(user.id) && await adminService(request);
    if (!db) throw new TravauxError('Accès réservé à la modération.', 403);
    const params = new URL(request.url).searchParams;
    if (params.get('stats') === '1') {
      const days = Number(params.get('days') ?? '30');
      if (![7,30,90].includes(days)) throw new TravauxError('Demande invalide.');
      return travauxJson(checked(await db.rpc('travaux_analytics', { p_days: days })));
    }
    const provider = params.get('provider');
    const page = Number(params.get('page') ?? '0');
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || (provider && !uuid(provider))) {
      throw new TravauxError('Demande invalide.');
    }
    const start = page * pageSize;
    if (provider) {
      const rows = checked(await db.from('travaux_responses')
        .select('job_id,slot,message,quote_cents,job:travaux_jobs(title,commune,status)')
        .eq('provider_id', provider).order('job_id').range(start, start + pageSize));
      return travauxJson({ rows: rows.slice(0, pageSize), more: rows.length > pageSize });
    }

    const today = parisToday();
    const rows = checked(await db.from('travaux_providers')
      .select('user_id,name,email,phone,test_mode,subscription_id,cancelled_at,details,terms_version,terms_accepted_at,billing_plan,coverage:travaux_payments(id)')
      .eq('coverage.paid', true).lte('coverage.starts_on', today).gt('coverage.ends_on', today)
      .order('name').order('user_id').range(start, start + pageSize));
    return travauxJson({
      rows: rows.slice(0, pageSize).map(({ user_id, name, email, phone, test_mode, subscription_id, cancelled_at, details, terms_version, terms_accepted_at, billing_plan, coverage }) => ({
        id: user_id, name, email, phone, test: test_mode, subscription: subscription_id,
        details, termsVersion: terms_version, termsAcceptedAt: terms_accepted_at, cancelled: Boolean(cancelled_at), active: Boolean(coverage.length), plan: billing_plan,
      })),
      more: rows.length > pageSize,
    });
  } catch (error) { return travauxFailure(error); }
}
