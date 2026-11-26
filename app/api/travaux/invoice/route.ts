import { advertisingInvoicePdf } from '../../../../lib/advertising-invoices';
import { checked, travauxFailure, travauxJson, travauxUser, uuid, TravauxError } from '../../../../lib/travaux-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { db, user } = await travauxUser(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      const rows = checked(await db.from('advertising_invoices')
        .select('id,invoice_number,total_cents,issued_at,travaux_payments!inner(provider_id)')
        .eq('travaux_payments.provider_id', user.id).order('issued_at', { ascending: false }).limit(60));
      return travauxJson(rows.map(({ travaux_payments, ...invoice }) => invoice));
    }
    if (!uuid(id)) throw new TravauxError('Demande introuvable.', 404);
    const invoice = checked(await db.from('advertising_invoices')
      .select('invoice_number,snapshot,travaux_payments!inner(provider_id)')
      .eq('id', id).eq('travaux_payments.provider_id', user.id).maybeSingle());
    if (!invoice) throw new TravauxError('Demande introuvable.', 404);
    return new Response(new Uint8Array(advertisingInvoicePdf(invoice.snapshot)), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Facture-Cote-de-Duras.pdf"',
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return travauxFailure(error); }
}
