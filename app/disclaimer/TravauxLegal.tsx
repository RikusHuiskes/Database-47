'use client';

import { useLanguage } from '../i18n/Language';

const copy = {
  fr: {
    title: 'Côte de Duras Travaux',
    sections: [
      {
        title: 'Service de mise en relation',
        text: 'Travaux est une place de marché en ligne qui met en relation les habitants et les artisans indépendants dans un rayon de 50 km autour de Duras. Les habitants déposent gratuitement leurs demandes, consultables sans compte après validation. Les artisans disposant d’un abonnement actif peuvent y répondre. Les demandes sont affichées de la plus récente à la plus ancienne. Vous pouvez filtrer par métier ou par commune. Les recommandations tiennent compte des spécialités renseignées par l’artisan. L’abonnement donne accès aux réponses et n’influence pas le classement.',
      },
      {
        title: 'Devis, contrat et paiement',
        text: 'Le particulier et l’artisan conviennent directement du devis, du contrat, des délais et du règlement des travaux. Côte de Duras ne signe pas le contrat de travaux, n’encaisse pas le prix du chantier et ne prélève pas de commission sur celui-ci. Sur Travaux, Mollie traite uniquement les paiements d’abonnement des artisans. Le préavis d’un mois de l’abonnement mensuel commence le 1er du mois suivant la demande de résiliation. L’abonnement annuel se termine après douze mois sans renouvellement automatique.',
      },
      {
        title: 'Garanties et responsabilités',
        text: 'L’artisan est responsable de l’exécution des travaux, du respect de ses engagements et des assurances applicables à son activité et au chantier. Avant de vous engager, vérifiez ses qualifications et ses assurances et demandez un devis écrit. La validation d’une annonce ne vaut ni certification ni recommandation. Côte de Duras ne réalise ni ne supervise les travaux et ne garantit ni le nombre de réponses, ni l’obtention d’un chantier, ni la disponibilité ou la qualité du travail. Dans les limites prévues par la loi, Côte de Duras ne répond pas des malfaçons, retards, inexécutions ou dommages imputables à l’artisan. Cette disposition préserve les obligations propres à Côte de Duras et les droits impératifs des utilisateurs.',
      },
      {
        title: 'Coordonnées et confidentialité',
        text: 'Le nom, l’e-mail et le téléphone du demandeur sont communiqués uniquement aux trois premiers artisans abonnés dont la réponse est acceptée. L’adresse exacte reste privée. L’artisan utilise les coordonnées uniquement pour la demande concernée.',
      },
    ],
    disputesTitle: 'Litiges et signalements',
    disputes: 'Pour un litige sur le chantier, contactez d’abord l’artisan concerné. Lorsqu’un consommateur contracte avec un professionnel, ses droits légaux et les recours applicables restent ouverts. Pour signaler une annonce ou poser une question sur la plateforme, l’abonnement ou vos données, utilisez le formulaire de contact de Travaux.',
    contact: 'Contacter Travaux',
  },
  en: {
    title: 'Côte de Duras Travaux',
    sections: [
      {
        title: 'Marketplace and matching service',
        text: 'Travaux is an online marketplace that connects residents with independent tradespeople within 50 km of Duras. Residents can post projects for free. Approved projects are visible without an account. Tradespeople with an active subscription can reply. Projects are listed newest first. You can filter by trade or town. Recommendations use the specialities listed in the tradesperson’s profile. The subscription allows replies and does not affect the order of listings.',
      },
      {
        title: 'Quotes, contracts and payment',
        text: 'The customer and tradesperson agree the quote, contract, schedule and payment for the work directly. Côte de Duras does not sign the contract for the work, collect payment for the work or charge a commission on it. On Travaux, Mollie only processes tradesperson subscription payments. The monthly plan has one month’s notice starting on the first day of the month after the cancellation request. The annual plan ends after twelve months without automatic renewal.',
      },
      {
        title: 'Guarantees and responsibilities',
        text: 'The tradesperson is responsible for carrying out the work, meeting their commitments and maintaining the insurance applicable to their business and the project. Before agreeing to the work, check their qualifications and insurance and ask for a written quote. Approval of a listing does not certify or endorse a tradesperson. Côte de Duras does not carry out or supervise the work and cannot guarantee replies, contracts, availability or the quality of the work. To the extent permitted by law, Côte de Duras is not responsible for defects, delays, failure to carry out the work or damage attributable to the tradesperson. Côte de Duras’s own obligations and users’ mandatory legal rights continue to apply.',
      },
      {
        title: 'Contact details and privacy',
        text: 'Only the first three subscribed tradespeople whose replies are accepted receive the requester’s name, email and phone number. The exact address stays private. Tradespeople may use the details only for that project.',
      },
    ],
    disputesTitle: 'Disputes and reports',
    disputes: 'For a dispute about the work, contact the tradesperson first. Consumers who contract with a professional keep their legal rights and access to applicable remedies. To report a listing or ask about the platform, your subscription or your data, use the Travaux contact form.',
    contact: 'Contact Travaux',
  },
  nl: {
    title: 'Côte de Duras Travaux',
    sections: [
      {
        title: 'Marktplaats en bemiddeling',
        text: 'Travaux is een online marktplaats die inwoners en zelfstandige vakmensen binnen 50 km rond Duras met elkaar in contact brengt. Inwoners plaatsen gratis een klus. Goedgekeurde klussen zijn zonder account te bekijken. Vakmensen met een actief abonnement kunnen reageren. De nieuwste aanvragen staan bovenaan. Je kunt filteren op vakgebied of plaats. Aanbevelingen sluiten aan op de specialismen in het profiel van de vakman. Het abonnement geeft toegang tot reageren en bepaalt de volgorde van de klussen niet.',
      },
      {
        title: 'Offerte, overeenkomst en betaling',
        text: 'De aanvrager en de vakman spreken de offerte, overeenkomst, planning en betaling voor het werk rechtstreeks met elkaar af. Côte de Duras is geen partij bij de overeenkomst over de klus, ontvangt geen betaling voor de werkzaamheden en rekent daarover geen commissie. Mollie verwerkt op Travaux alleen de abonnementsbetalingen van vakmensen. De opzegtermijn van het maandabonnement duurt één maand en begint op de eerste dag van de maand na de opzegging. Het jaarabonnement eindigt na twaalf maanden zonder automatische verlenging.',
      },
      {
        title: 'Garanties en verantwoordelijkheid',
        text: 'De vakman is verantwoordelijk voor de uitvoering van het werk, het nakomen van afspraken en de verzekeringen die voor het bedrijf en de klus gelden. Controleer vóór akkoord de kwalificaties en verzekeringen en vraag een schriftelijke offerte. Goedkeuring van een klus geldt niet als certificering of aanbeveling. Côte de Duras voert de werkzaamheden niet uit en houdt er geen toezicht op. Het platform geeft geen garantie op reacties, opdrachten, beschikbaarheid of de kwaliteit van het werk. Voor zover wettelijk toegestaan is Côte de Duras niet aansprakelijk voor gebreken, vertraging, niet-uitvoering of schade die aan de vakman zijn toe te rekenen. De eigen verplichtingen van Côte de Duras en de dwingende rechten van gebruikers blijven gelden.',
      },
      {
        title: 'Contactgegevens en privacy',
        text: 'Alleen de eerste drie vakmensen met een abonnement van wie de reactie wordt geaccepteerd, ontvangen de naam, het e-mailadres en het telefoonnummer van de aanvrager. Het exacte adres blijft privé. Vakmensen gebruiken de gegevens alleen voor die klus.',
      },
    ],
    disputesTitle: 'Geschillen en meldingen',
    disputes: 'Gaat het geschil over het werk? Neem eerst contact op met de vakman. Consumenten die een overeenkomst sluiten met een vakman behouden hun wettelijke rechten en de mogelijkheden om daar een beroep op te doen. Gebruik het contactformulier van Travaux om een advertentie te melden of voor vragen over het platform, je abonnement of je gegevens.',
    contact: 'Contact met Travaux',
  },
};

export default function TravauxLegal() {
  const { locale } = useLanguage();
  const text = copy[locale];

  return <section id="travaux" aria-labelledby="travaux-legal-title" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #d9dfd5', scrollMarginTop: 72 }}>
    <h2 id="travaux-legal-title">{text.title}</h2>
    {text.sections.map(section => <div key={section.title}>
      <h3>{section.title}</h3>
      <p>{section.text}</p>
    </div>)}
    <h3>{text.disputesTitle}</h3>
    <p>{text.disputes}</p>
    <p><a href="/travaux?espace=contact#espace">{text.contact}</a></p>
  </section>;
}
