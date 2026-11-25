import type { Locale } from './i18n';

export const legalForms = ['EI', 'EURL', 'SARL', 'SASU', 'SAS', 'SA', 'SNC', 'SCOP', 'Autre'] as const;
export const companySizes = ['0', '1–9', '10–49', '50–249', '250+'] as const;
export const termsVersion = 'travaux-pro-2026-11-25';
export type CompanyDetails = {
  representative: string; address: string; complement: string; postcode: string; city: string;
  siret: string; legalForm: string; size: string; specialties: string[]; certifications: string;
};
const fields = {
  street: ['N° et nom de voie ou lieu-dit', 'Street number and name or locality', 'Huisnummer en straat of lieu-dit'],
  complement: ['Complément d’adresse (facultatif)', 'Address supplement (optional)', 'Adresaanvulling (optioneel)'],
  postcode: ['Code postal', 'Postcode', 'Postcode'],
  city: ['Commune', 'Town', 'Plaats'],
  representative: ['Nom et prénom du contact', 'Contact’s full name', 'Voor- en achternaam contactpersoon'],
  company: ['Raison sociale / nom de l’entreprise', 'Registered business name', 'Officiële bedrijfsnaam'],
  legal: ['Forme juridique', 'Legal form', 'Rechtsvorm'],
  size: ['Effectif salarié', 'Number of employees', 'Aantal werknemers'],
  cert: ['Certifications déclarées (facultatif)', 'Self-declared certifications (optional)', 'Opgegeven certificeringen (optioneel)'],
  specialty: ['Spécialités (au moins une)', 'Specialties (at least one)', 'Specialismen (minimaal één)'],
  accept: ['J’accepte les conditions générales et le renouvellement à 25 € par mois jusqu’à résiliation.', 'I accept the terms and €25 monthly renewal until cancellation.', 'Ik ga akkoord met de algemene voorwaarden en verlenging voor €25 per maand tot opzegging.'],
  terms: ['Conditions générales de l’abonnement', 'Subscription terms and conditions', 'Algemene abonnementsvoorwaarden'],
  termsText: ['L’abonnement ouvre la possibilité de répondre aux demandes pendant la période payée. Son prix est de 25 € par mois, renouvelé via Mollie jusqu’à l’arrêt du renouvellement dans l’espace professionnel. Un abonnement ne garantit ni mise en relation ni chantier. Les coordonnées obtenues sont réservées au chantier concerné.', 'The subscription lets you reply during your paid period. Mollie charges €25 per month until you stop renewal in your professional account. The subscription does not guarantee contacts or projects. Use any contact details you receive only for the relevant project.', 'Met het abonnement kun je reageren gedurende de betaalde periode. Mollie brengt €25 per maand in rekening tot je de verlenging stopzet in je vakmensenaccount. Het abonnement geeft geen garantie op contacten of klussen. Gebruik vrijgegeven contactgegevens uitsluitend voor de betreffende klus.'],
  save: ['Enregistrer les coordonnées', 'Save business details', 'Bedrijfsgegevens opslaan'],
  saved: ['Coordonnées enregistrées.', 'Business details saved.', 'Bedrijfsgegevens opgeslagen.'],
  invalid: ['Vérifiez le code postal, le SIRET, la forme juridique, l’effectif et les spécialités.', 'Check the postcode, SIRET, legal form, employee count and specialties.', 'Controleer de postcode, het SIRET-nummer, de rechtsvorm, het aantal werknemers en de specialismen.'],
} as const;
export function companyCopy(locale: Locale) {
  return (key: keyof typeof fields) => fields[key][locale === 'nl' ? 2 : locale === 'en' ? 1 : 0];
}
export const companyFieldLabels = fields;
