import { createServiceClient } from '../../../../lib/supabase-server';
import { travauxCategories, travauxPageSize } from '../../../../lib/travaux';
import { checked, TravauxError, travauxCommunes, travauxEnabled, travauxFailure, travauxJson } from '../../../../lib/travaux-server';

export async function GET(request: Request) {
  try {
    const db = travauxEnabled() && createServiceClient();
    if (!db) throw new TravauxError('Les demandes ne sont pas encore ouvertes.', 503);

    const params = new URL(request.url).searchParams;
    const category = params.get('category');
    const communeCode = params.get('commune');
    const commune = communeCode && travauxCommunes.find(place => place.code === communeCode);
    const page = Number(params.get('page') ?? '0');
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new TravauxError('Demande invalide.');
    if (category && !Object.hasOwn(travauxCategories, category)) throw new TravauxError('Choisissez un type de travaux.');
    if (communeCode && !commune) throw new TravauxError('Choisissez une commune dans un rayon de 50 km autour de Duras.');

    // Public preview: select moderated content only, with no joins to private tables.
    let query = db.from('travaux_jobs').select('id,title,description,category,commune').eq('status', 'open');
    if (category) query = query.eq('category', category);
    if (commune) query = query.eq('commune', commune.name);
    const start = page * travauxPageSize;
    const jobs = checked(await query.order('created_at', { ascending: false }).order('id')
      .range(start, start + travauxPageSize));
    return travauxJson({ jobs: jobs.slice(0, travauxPageSize), hasMore: jobs.length > travauxPageSize });
  } catch (error) { return travauxFailure(error); }
}
