import { createServiceClient } from '../../../../lib/supabase-server';
import { travauxCategories, travauxPageSize } from '../../../../lib/travaux';
import { checked, TravauxError, travauxCommunes, travauxEnabled, travauxFailure, travauxJson, travauxUser } from '../../../../lib/travaux-server';

export async function GET(request: Request) {
  try {
    const db = travauxEnabled() && createServiceClient();
    if (!db) throw new TravauxError('Les demandes ne sont pas encore ouvertes.', 503);

    const params = new URL(request.url).searchParams;
    const preview = params.get('preview') === '1';
    const category = params.get('category');
    const communeCode = params.get('commune');
    const commune = communeCode && travauxCommunes.find(place => place.code === communeCode);
    const page = Number(params.get('page') ?? '0');
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new TravauxError('Demande invalide.');
    if (category && !Object.hasOwn(travauxCategories, category)) throw new TravauxError('Choisissez un type de travaux.');
    if (communeCode && !commune) throw new TravauxError('Choisissez une commune dans un rayon de 50 km autour de Duras.');

    // The projection contains moderated job details and a response total only.
    let query = db.from('travaux_public_feed').select('id,title,title_translations,description,description_translations,category,commune,response_count');
    if (category) query = query.eq('category', category);
    if (params.get('recommended') === '1') {
      const { user } = await travauxUser(request);
      const profile = checked(await db.from('travaux_providers').select('details').eq('user_id', user.id).maybeSingle());
      const specialties: string[] = Array.isArray(profile?.details?.specialties)
        ? profile.details.specialties.filter((key: unknown) => typeof key === 'string' && Object.hasOwn(travauxCategories, key)) : [];
      if (!specialties.length) return travauxJson({ jobs: [], hasMore: false });
      query = query.in('category', specialties);
    }
    if (commune) query = query.eq('commune', commune.name);
    const pageSize = preview ? 3 : travauxPageSize;
    if (preview) query = query.lt('response_count', 3);
    const start = page * pageSize;
    const jobs = checked(await query.order('created_at', { ascending: false }).order('id')
      .range(start, start + pageSize));
    return travauxJson({
      jobs: jobs.slice(0, pageSize).map(({ response_count, ...job }) => ({ ...job, responseCount: response_count })),
      hasMore: jobs.length > pageSize,
    });
  } catch (error) { return travauxFailure(error); }
}
