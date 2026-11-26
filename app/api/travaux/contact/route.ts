import { mailConfiguration, mailTransport } from '../../../../lib/mail';
import { travauxEnabled, travauxJson } from '../../../../lib/travaux-server';

export const runtime = 'nodejs';

const roles = { requester: 'Demandeur', professional: 'Artisan' };

export async function POST(request: Request) {
  if (!travauxEnabled()) return travauxJson({ error: 'unavailable' }, 503);
  if (request.headers.get('origin') !== new URL(request.url).origin) return travauxJson({ error: 'invalid' }, 403);
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return travauxJson({ error: 'invalid' }, 413);
    data = JSON.parse(raw);
  } catch { return travauxJson({ error: 'invalid' }, 400); }
  if (!data || typeof data !== 'object') return travauxJson({ error: 'invalid' }, 400);
  if (data.website) return travauxJson({ ok: true });
  const role = data.role === 'requester' || data.role === 'professional' ? data.role as keyof typeof roles : null;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (!role || name.length < 2 || name.length > 120 || /[\r\n]/.test(name)
    || !/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(email) || email.length > 254
    || message.length < 10 || message.length > 3000) return travauxJson({ error: 'invalid' }, 400);
  const config = mailConfiguration();
  if (!config.deliveryEnabled) return travauxJson({ error: 'unavailable' }, 503);
  try {
    const info = await mailTransport().sendMail({
      from: config.from,
      to: config.previewMode ? config.user : 'info@cotededuras.com',
      replyTo: { address: email, name },
      subject: (config.previewMode ? '[TEST] ' : '') + 'Contact Travaux — ' + roles[role],
      text: 'Profil : ' + roles[role] + '\nNom : ' + name + '\nE-mail : ' + email + '\n\n' + message,
    });
    if (!info.accepted?.length) return travauxJson({ error: 'unavailable' }, 503);
    return travauxJson({ ok: true });
  } catch { return travauxJson({ error: 'unavailable' }, 503); }
}
