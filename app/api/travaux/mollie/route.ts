import { billingOrigin } from '../../../../lib/recurring-server';
import { createServiceClient } from '../../../../lib/supabase-server';
import { reconcileTravauxPayment } from '../../../../lib/travaux-billing';
import { travauxEnabled } from '../../../../lib/travaux-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const text = await request.text();
  const id = text.length <= 500 && new URLSearchParams(text).get('id');
  if (!id || !/^tr_[A-Za-z0-9]+$/.test(id)) return new Response(null, { status: 400 });
  const db = travauxEnabled() && createServiceClient();
  if (!db) return new Response(null, { status: 503 });
  try {
    await reconcileTravauxPayment(db, id, billingOrigin(request));
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
