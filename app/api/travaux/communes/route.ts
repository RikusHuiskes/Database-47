import { travauxCommunes, travauxEnabled } from '../../../../lib/travaux-server';

export function GET() {
  return Response.json(travauxEnabled() ? travauxCommunes : []);
}
