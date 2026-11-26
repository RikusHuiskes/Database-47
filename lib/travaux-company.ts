import type { Locale } from './i18n';

export const legalForms = ['EI', 'EURL', 'SARL', 'SASU', 'SAS', 'SA', 'SNC', 'SCOP', 'Autre'] as const;
export const companySizes = ['0', '1–9', '10–49', '50–249', '250+'] as const;
export const termsVersion = 'travaux-pro-2026-11-26-v5';

export function canResumeTravauxTerms(version: unknown) {
  return version === termsVersion || version === 'travaux-pro-2026-11-26-v4';
}
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
  termsText: ['L’abonnement ouvre la possibilité de répondre pendant la période payée. La formule mensuelle est renouvelée par prélèvement SEPA ou par carte bancaire, selon le moyen choisi. Dans Mon compte, ouvrez Mon abonnement professionnel et cliquez sur Arrêter le renouvellement. Le préavis d’un mois commence le premier jour du mois suivant la demande et le contrat prend fin le premier jour du mois d’après. Les prochains paiements automatiques sont arrêtés dès la demande. Si votre accès est actif à cette date, vous le conservez pendant le préavis et au moins jusqu’à la fin de la période déjà payée. La formule annuelle est payée une fois et se termine après douze mois. Une facture est adressée par e-mail après chaque paiement confirmé. L’abonnement ne garantit ni mise en relation ni chantier.', 'The subscription lets you reply during the paid period. The monthly plan renews by SEPA direct debit or card, depending on your chosen payment method. Under My account, open My professional subscription and choose Cancel subscription. The one-month notice starts on the first day of the month after your request. The subscription ends on the first day of the following month. Future automatic payments stop when you request it. If your access is active then, it continues through the notice period and at least to the end of any period already paid. The annual plan is paid once and ends after twelve months. An invoice is emailed after each confirmed payment. The subscription does not guarantee contacts or projects.', 'Met het abonnement kun je gedurende de betaalde periode reageren. Het maandabonnement wordt automatisch betaald via SEPA-incasso of kaart, afhankelijk van je keuze. Ga via Mijn account naar Mijn abonnement en kies Abonnement opzeggen. De opzegtermijn van één maand begint op de eerste dag van de maand na je verzoek. Het abonnement eindigt op de eerste dag van de daaropvolgende maand. Nieuwe automatische betalingen stoppen zodra je opzegt. Als je toegang dan actief is, blijft die beschikbaar tijdens de opzegtermijn en minimaal tot het einde van de al betaalde periode. Het jaarabonnement betaal je één keer en eindigt na twaalf maanden. Na elke bevestigde betaling krijg je een factuur per e-mail. Het abonnement geeft geen garantie op contacten of klussen.'],
  plan: ['Choisir une formule', 'Choose a plan', 'Kies een abonnement'],
  monthly: ['25 € par mois · carte ou prélèvement SEPA', '€25 per month · card or SEPA direct debit', '€25 per maand · kaart of SEPA-incasso'],
  annual: ['250 € pour 12 mois · paiement unique', '€250 for 12 months · one-off payment', '€250 voor 12 maanden · eenmalige betaling'],
  notice: ['Préavis d’un mois à compter du 1er du mois suivant la demande de résiliation.', 'One month’s notice starting on the first day of the month after you request cancellation.', 'Eén maand opzegtermijn vanaf de eerste dag van de maand na je opzegging.'],
  noticeUntil: ['Fin du préavis le', 'Notice period ends on', 'Opzegtermijn eindigt op'],
  pendingCancellation: ['Votre paiement est en cours. Le bouton de résiliation apparaît ici après l’activation de l’abonnement mensuel.', 'Your payment is in progress. The cancellation button appears here once the monthly subscription is active.', 'Je betaling is nog niet afgerond. De opzegknop verschijnt hier zodra het maandabonnement is geactiveerd.'],
  annualActive: ['Formule annuelle sans renouvellement automatique.', 'Annual plan with no automatic renewal.', 'Jaarabonnement zonder automatische verlenging.'],
  save: ['Enregistrer les coordonnées', 'Save business details', 'Bedrijfsgegevens opslaan'],
  saved: ['Coordonnées enregistrées.', 'Business details saved.', 'Bedrijfsgegevens opgeslagen.'],
  invalid: ['Vérifiez le code postal, le SIRET, la forme juridique, l’effectif et les spécialités.', 'Check the postcode, SIRET, legal form, employee count and specialties.', 'Controleer de postcode, het SIRET-nummer, de rechtsvorm, het aantal werknemers en de specialismen.'],
} as const;
export function companyCopy(locale: Locale) {
  return (key: keyof typeof fields) => fields[key][locale === 'nl' ? 2 : locale === 'en' ? 1 : 0];
}
export const companyFieldLabels = fields;
