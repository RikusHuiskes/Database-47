import type { Locale } from './i18n';

export const legalForms = ['EI', 'EURL', 'SARL', 'SASU', 'SAS', 'SA', 'SNC', 'SCOP', 'Autre'] as const;
export const companySizes = ['0', '1–9', '10–49', '50–249', '250+'] as const;
export const termsVersion = 'travaux-pro-2026-11-25-v2';
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
  accept: ['J’accepte les conditions générales et le paiement de la formule choisie.', 'I accept the terms and payment for the selected plan.', 'Ik ga akkoord met de voorwaarden en de betaling van het gekozen abonnement.'],
  terms: ['Conditions générales de l’abonnement', 'Subscription terms and conditions', 'Algemene abonnementsvoorwaarden'],
  termsText: ['L’abonnement ouvre la possibilité de répondre pendant la période payée. La formule mensuelle est renouvelée par prélèvement SEPA jusqu’à l’arrêt du renouvellement dans l’espace professionnel. La formule annuelle est payée une fois et se termine après douze mois. Une facture est adressée par e-mail après chaque paiement confirmé. L’abonnement ne garantit ni mise en relation ni chantier.', 'The subscription lets you reply during the paid period. The monthly plan renews by SEPA direct debit until you stop renewal in your account. The annual plan is paid once and ends after twelve months. An invoice is emailed after each confirmed payment. The subscription does not guarantee contacts or projects.', 'Met het abonnement kun je gedurende de betaalde periode reageren. Het maandabonnement wordt via SEPA geïncasseerd tot je de verlenging stopzet in je account. Het jaarabonnement betaal je één keer en eindigt na twaalf maanden. Na elke bevestigde betaling krijg je een factuur per e-mail. Het abonnement geeft geen garantie op contacten of klussen.'],
  plan: ['Choisir une formule', 'Choose a plan', 'Kies een abonnement'],
  monthly: ['25 € par mois · prélèvement SEPA', '€25 per month · SEPA direct debit', '€25 per maand · SEPA-incasso'],
  annual: ['250 € pour 12 mois · paiement unique', '€250 for 12 months · one-off payment', '€250 voor 12 maanden · eenmalige betaling'],
  annualActive: ['Formule annuelle sans renouvellement automatique.', 'Annual plan with no automatic renewal.', 'Jaarabonnement zonder automatische verlenging.'],
  save: ['Enregistrer les coordonnées', 'Save business details', 'Bedrijfsgegevens opslaan'],
  saved: ['Coordonnées enregistrées.', 'Business details saved.', 'Bedrijfsgegevens opgeslagen.'],
  invalid: ['Vérifiez le code postal, le SIRET, la forme juridique, l’effectif et les spécialités.', 'Check the postcode, SIRET, legal form, employee count and specialties.', 'Controleer de postcode, het SIRET-nummer, de rechtsvorm, het aantal werknemers en de specialismen.'],
} as const;
export function companyCopy(locale: Locale) {
  return (key: keyof typeof fields) => fields[key][locale === 'nl' ? 2 : locale === 'en' ? 1 : 0];
}
export const companyFieldLabels = fields;
