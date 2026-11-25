import { createServiceClient } from '../../../../lib/supabase-server';
import { checked, TravauxError, travauxEnabled, travauxFailure, travauxJson } from '../../../../lib/travaux-server';

export async function GET() {
  try {
    const db = travauxEnabled() && createServiceClient();
    if (!db) throw new TravauxError('Les demandes ne sont pas encore ouvertes.', 503);

    // Public preview: select moderated content only, with no joins to private tables.
    const jobs = checked(await db.from('travaux_jobs')
      .select('id,title,description,category,commune')
      .eq('status', 'open').order('created_at', { ascending: false }).limit(100));
    return travauxJson(jobs);
  } catch (error) { return travauxFailure(error); }
}
