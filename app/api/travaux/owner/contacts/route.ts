import { adminService } from '../../../../../lib/admin-service';
import { checked, field, isTravauxOwner, phoneField, TravauxError, travauxFailure, travauxJson, travauxUser, uuid } from '../../../../../lib/travaux-server';

async function ownerDb(request: Request) {
  const { db, user } = await travauxUser(request);
  if (!isTravauxOwner(user.id) || !await adminService(request)) {
    throw new TravauxError('Accès réservé à la modération.', 403);
  }
  return db;
}

const pageSize = 25;

export async function GET(request: Request) {
  try {
    const db = await ownerDb(request);
    const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new TravauxError('Demande invalide.');
    const start = page * pageSize;
    const rows = checked(await db.from('travaux_jobs')
      .select('id,title,title_translations,commune,status,contact:travaux_contacts(name,address,email,phone)')
      .order('created_at', { ascending: false }).order('id').range(start, start + pageSize));
    return travauxJson({ rows: rows.slice(0, pageSize), more: rows.length > pageSize });
  } catch (error) { return travauxFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new TravauxError('Demande invalide.', 403);
    const db = await ownerDb(request);
    const text = await request.text();
    if (text.length > 4000) throw new TravauxError('Demande trop longue.', 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new TravauxError('Demande invalide.'); }
    if (!uuid(body?.id)) throw new TravauxError('Demande introuvable.', 404);
    const email = field(body.email, 'e-mail', 254);
    if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(email)) {
      throw new TravauxError('Vérifiez votre adresse e-mail (ex. nom@exemple.fr).');
    }
    const contact = checked(await db.from('travaux_contacts').update({
      name: field(body.name, 'nom', 120),
      address: field(body.address, 'adresse', 350),
      email, phone: phoneField(body.phone),
    }).eq('job_id', body.id).select('name,address,email,phone').maybeSingle());
    if (!contact) throw new TravauxError('Demande introuvable.', 404);
    return travauxJson(contact);
  } catch (error) { return travauxFailure(error); }
}
