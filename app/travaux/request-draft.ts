const storageKey = 'cdd-travaux-request-draft';
const draftLifetime = 60 * 60 * 1000;

export const requestFields = ['title', 'description', 'name', 'phone', 'address', 'complement'] as const;
type RequestField = typeof requestFields[number];

type RequestDraft = {
  email: string;
  fields: Record<RequestField, string>;
  category: string;
  commune: string;
  consent: boolean;
  expiresAt: number;
};

export function saveRequestDraft(email: string, data: FormData, category: string, commune: string) {
  const fields = Object.fromEntries(requestFields.map(field => [field, String(data.get(field) ?? '')]));
  localStorage.setItem(storageKey, JSON.stringify({
    email: email.toLowerCase(), fields, category, commune, consent: data.has('consent'),
    expiresAt: Date.now() + draftLifetime,
  }));
}

export function readRequestDraft(email: string): RequestDraft | null {
  try {
    const draft: RequestDraft = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!draft || !draft.fields) return null;
    if (!Number.isFinite(draft.expiresAt) || draft.expiresAt <= Date.now()) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return draft.email === email.toLowerCase() ? draft : null;
  } catch {
    return null;
  }
}

export function clearRequestDraft(email: string) {
  if (readRequestDraft(email)) {
    try { localStorage.removeItem(storageKey); } catch { /* The draft still expires. */ }
  }
}
