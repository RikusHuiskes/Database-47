import type { Locale } from './i18n';

export const travauxMail = {
  fr: {
    label: 'Écrire au demandeur',
    to: "Destinataire",
    subjectLabel: "Objet",
    bodyLabel: "Message",
    copy: "Copier l’e-mail",
    open: "Ouvrir l’application mail",
    copied: "Copié.",
    manual: "Sélectionnez le texte et copiez-le.",
    subject: 'Votre demande sur Côte de Duras',
    greeting: 'Bonjour',
    message: 'Je vous contacte au sujet de votre demande de travaux sur Côte de Duras. Auriez-vous un moment pour en discuter et, si nécessaire, convenir d’une visite ?',
    closing: 'Cordialement,',
  },
  en: {
    label: 'Email the requester',
    to: "To",
    subjectLabel: "Subject",
    bodyLabel: "Message",
    copy: "Copy email",
    open: "Open mail app",
    copied: "Copied.",
    manual: "Select and copy the text.",
    subject: 'Your project on Côte de Duras',
    greeting: 'Hello',
    message: 'I’m contacting you about your project on Côte de Duras. Would you have time to discuss the work and arrange a visit if needed?',
    closing: 'Kind regards,',
  },
  nl: {
    label: 'Mail de aanvrager',
    to: "Aan",
    subjectLabel: "Onderwerp",
    bodyLabel: "Bericht",
    copy: "Kopieer mail",
    open: "Open mailapp",
    copied: "Gekopieerd.",
    manual: "Selecteer en kopieer de tekst.",
    subject: 'Je klus op Côte de Duras',
    greeting: 'Beste',
    message: 'Ik neem contact op over je klus op Côte de Duras. Wanneer komt het uit om de werkzaamheden te bespreken en zo nodig een afspraak op locatie te maken?',
    closing: 'Met vriendelijke groet,',
  },
} as const;

export function travauxMailDraft(locale: Locale, contact: { name: string }, title: string) {
  const copy = travauxMail[locale];
  const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();
  const subject = copy.subject + ' – ' + oneLine(title);
  const body = [
    copy.greeting + ' ' + oneLine(contact.name) + ',',
    copy.message,
    copy.closing + '\r\n',
  ].join('\r\n\r\n');
  return { subject, body };
}

export function travauxMailLink(email: string, subject: string, body: string) {
  const recipient = encodeURIComponent(email).replace(/%40/g, '@');
  return 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject.replace(/[\r\n]+/g, ' ')) + '&body=' + encodeURIComponent(body);
}
