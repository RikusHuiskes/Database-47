export function listingRequestInput(value: unknown) {
  if (!value || typeof value !== 'object') throw Error('Controleer de aanvraag.');
  const input = value as Record<string, unknown>;
  const text = (key: string, max: number, required = true) => {
    const result = typeof input[key] === 'string' ? input[key].trim() : '';
    if ((required && !result) || result.length > max) throw Error('Controleer de ingevulde gegevens.');
    return result;
  };
  const eventId = text('eventId', 36), kind = text('kind', 20), email = text('email', 254);
  if (!/^[a-f0-9-]{36}$/i.test(eventId) || !['claim', 'correction'].includes(kind) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Controleer de vermelding en het e-mailadres.');
  if (input.consent !== true || input.website) throw Error('De aanvraag kon niet worden verwerkt.');
  return {event_id: eventId, kind, name: text('name', 150), email,
    organization: text('organization', 200, kind === 'claim'), phone: text('phone', 80, false),
    message: text('message', 4000), status: 'pending'};
}
