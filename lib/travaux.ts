import type { Locale } from './i18n';

export const travauxPath = '/travaux';
export const travauxPageSize = 24;

type Translation = readonly [fr: string, en: string, nl: string];
export const travauxText = (translations: Translation, locale: Locale) => translations[locale === 'nl' ? 2 : locale === 'en' ? 1 : 0];

export const travauxGroups = {
  building: ['Construction et gros œuvre', 'Construction and structural work', 'Bouw en constructie'],
  exterior: ['Toiture et enveloppe', 'Roof and exterior', 'Dak en buitenschil'],
  systems: ['Installations techniques', 'Building services', 'Technische installaties'],
  interiors: ['Aménagement et finitions', 'Interiors and finishing', 'Interieur en afwerking'],
  garden: ['Jardin et accès', 'Garden and access', 'Tuin en terrein'],
  maintenance: ['Entretien et dépannage', 'Maintenance and repairs', 'Onderhoud en reparaties'],
} as const satisfies Record<string, Translation>;

type Trade = readonly [keyof typeof travauxGroups, Translation, Translation?];
export const travauxCategories = {
  renovation: ['building', ['Entreprise générale du bâtiment', 'General contractor', 'Aannemer'], ['Construction, extension, rénovation complète', 'New build, extension, full renovation', 'Nieuwbouw, aanbouw, totaalrenovatie']],
  maconnerie: ['building', ['Maçonnerie', 'Masonry', 'Metselwerk'], ['Murs, briques, pierre, joints', 'Walls, brickwork, stonework, pointing', 'Muren, baksteen, natuursteen, voegwerk']],
  fondations: ['building', ['Fondations et béton', 'Foundations and concrete', 'Fundering en beton'], ['Semelles, dalles, reprise en sous-œuvre', 'Footings, slabs, underpinning', 'Funderingsstroken, betonplaten, funderingsherstel']],
  terrassement: ['building', ['Terrassement et démolition', 'Groundworks and demolition', 'Grondwerk en sloop']],
  charpente: ['exterior', ['Charpente et ossature bois', 'Roof framing and timber structures', 'Kapconstructie en houtskeletbouw']],
  toiture: ['exterior', ['Couverture, étanchéité et gouttières', 'Roofing, waterproofing and gutters', 'Dakwerk, waterdichting en goten']],
  facade: ['exterior', ['Façade et enduits extérieurs', 'Façades and exterior rendering', 'Gevelwerk en buitenstucwerk']],
  isolation: ['exterior', ['Isolation', 'Insulation', 'Isolatie']],
  vitrerie: ['exterior', ['Vitrerie et double vitrage', 'Glazing and double glazing', 'Beglazing en dubbelglas']],
  fenetres: ['exterior', ['Fenêtres, portes et volets', 'Windows, doors and shutters', 'Ramen, deuren en luiken']],
  plomberie: ['systems', ['Plomberie et sanitaires', 'Plumbing and sanitary fittings', 'Loodgieterswerk en sanitair']],
  chauffage: ['systems', ['Chauffage, climatisation et ventilation', 'Heating, air conditioning and ventilation', 'Verwarming, airco en ventilatie']],
  electricite: ['systems', ['Électricité et éclairage', 'Electrical work and lighting', 'Elektra en verlichting']],
  solaire: ['systems', ['Panneaux solaires et bornes de recharge', 'Solar panels and EV chargers', 'Zonnepanelen en laadpalen']],
  assainissement: ['systems', ['Assainissement et drainage', 'Wastewater and drainage', 'Riolering, septic tank en drainage']],
  menuiserie: ['interiors', ['Menuiserie et agencement', 'Carpentry and joinery', 'Timmerwerk en interieurbouw'], ['Escaliers, placards, boiseries', 'Stairs, cupboards, woodwork', 'Trappen, kasten, houtwerk']],
  platrerie: ['interiors', ['Plâtrerie et cloisons', 'Plastering and partitions', 'Stucwerk en scheidingswanden']],
  peinture: ['interiors', ['Peinture et finitions', 'Painting and decorating', 'Schilderwerk en afwerking']],
  sols: ['interiors', ['Carrelage, parquet et autres sols', 'Tiling, wood and other flooring', 'Tegelwerk, parket en andere vloeren']],
  cuisine: ['interiors', ['Cuisine et salle de bains', 'Kitchen and bathroom fitting', 'Keuken- en badkamermontage']],
  jardin: ['garden', ['Jardinage, paysagisme et élagage', 'Gardening, landscaping and tree work', 'Tuinwerk, aanleg en snoeiwerk']],
  clotures: ['garden', ['Clôtures, portails et terrasses', 'Fences, gates and patios', 'Hekwerk, poorten en terrassen']],
  allees: ['garden', ['Allées, pavage et accès', 'Driveways, paving and access', 'Opritten, bestrating en toegang']],
  piscine: ['garden', ['Piscine et entretien de piscine', 'Pool installation and maintenance', 'Zwembadaanleg en zwembadonderhoud']],
  entretien: ['maintenance', ['Entretien et petits travaux', 'Maintenance and odd jobs', 'Onderhoud en kleine klussen']],
  serrurerie: ['maintenance', ['Serrurerie et dépannage', 'Locksmith and repairs', 'Slotenmaker en reparaties']],
  nettoyage: ['maintenance', ['Nettoyage après travaux', 'Post-construction cleaning', 'Schoonmaak na werkzaamheden']],
  autre: ['maintenance', ['Autres travaux', 'Other work', 'Overige werkzaamheden']],
} as const satisfies Record<string, Trade>;

export type TravauxCategory = keyof typeof travauxCategories;
export function travauxCategoryLabel(key: TravauxCategory, locale: Locale) {
  return travauxText(travauxCategories[key]?.[1] ?? travauxCategories.autre[1], locale);
}
