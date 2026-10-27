export type CuratedLocalService = {
  id: string;
  type: "library" | "pharmacy" | "dentist" | "church";
  municipality: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  serviceTimes?: string;
  extra?: string;
  sourceUrl: string;
  sourceName: string;
  secondarySourceUrl?: string;
  secondarySourceName?: string;
};

// Verified local entries supplement map data, which can be incomplete for
// smaller communes. Keep the municipality explicit so results are not
// misrepresented as belonging to a neighbouring town.
export const CURATED_LOCAL_SERVICES: CuratedLocalService[] = [
  {
    id: "dentist-mutualiste-marmande", type: "dentist", municipality: "Marmande",
    name: "Centre de Santé Dentaire Mutualiste — Marmande",
    address: "77 avenue Jean Jaurès, 47200 Marmande", phone: "05 53 20 93 49",
    openingHours: "Maandag–vrijdag 08:30–12:30 en 14:00–18:30; zaterdag 08:00–14:00; zondag gesloten. Op afspraak.",
    website: "https://www.centre-de-sante-dentaire47.fr/",
    sourceUrl: "https://www.centre-de-sante-dentaire47.fr/", sourceName: "Centre de Santé Dentaire Mutualiste — eigen website",
    secondarySourceUrl: "https://annuaire-entreprises.data.gouv.fr/etablissement/78215297900251", secondarySourceName: "Annuaire des Entreprises — actief tandartscentrum",
  },
  {
    id: "dentist-mutualiste-agen", type: "dentist", municipality: "Agen",
    name: "Centre de Santé Dentaire Mutualiste — Agen",
    address: "259 avenue du Général Leclerc, 47000 Agen", phone: "05 53 77 76 75",
    openingHours: "Maandag–vrijdag 08:30–12:30 en 14:00–18:30; zaterdag 08:00–14:00; zondag gesloten. Op afspraak.",
    website: "https://www.centre-de-sante-dentaire47.fr/", sourceUrl: "https://www.centre-de-sante-dentaire47.fr/", sourceName: "Centre de Santé Dentaire Mutualiste — eigen website",
  },
  {
    id: "dentist-mutualiste-villeneuve", type: "dentist", municipality: "Villeneuve-sur-Lot",
    name: "Centre de Santé Dentaire Mutualiste — Villeneuve-sur-Lot",
    address: "26 avenue de Fumel, 47300 Villeneuve-sur-Lot", phone: "05 53 40 23 16",
    openingHours: "Maandag–vrijdag 08:30–12:30 en 14:00–18:30; zaterdag 08:00–14:00; zondag gesloten. Op afspraak.",
    website: "https://www.centre-de-sante-dentaire47.fr/", sourceUrl: "https://www.centre-de-sante-dentaire47.fr/", sourceName: "Centre de Santé Dentaire Mutualiste — eigen website",
  },
  {
    id: "library-duras",
    type: "library",
    municipality: "Duras",
    name: "Bibliothèque municipale de Duras",
    address: "25 rue Paul Persil, 47120 Duras",
    phone: "05 53 64 92 72",
    email: "bibliotheque.duras@wanadoo.fr",
    website: "https://bibliotheque-de-duras.fr/",
    openingHours: "Maandag 9:30–12:30; woensdag 9:30–12:30 en 14:00–19:00; vrijdag 17:00–19:00",
    sourceUrl: "https://bibliotheque-de-duras.fr/",
    sourceName: "Bibliothèque municipale de Duras — officiële website",
    secondarySourceUrl: "https://www.tourisme-lotetgaronne.com/loisirs/bibliotheque-municipale-de-duras/",
    secondarySourceName: "Tourisme Lot-et-Garonne",
  },
  {
    id: "pharmacy-duras-chateau",
    type: "pharmacy",
    municipality: "Duras",
    name: "Pharmacie du Château",
    address: "6 place Jean Bousquet, 47120 Duras",
    phone: "05 53 83 70 29",
    email: "pharmacieduchateauduras@giphar.fr",
    website: "https://pharmacies.giphar.fr/nouvelle-aquitaine/lot-et-garonne/duras/pharmacie-du-chateau-duras-1364",
    openingHours: "Maandag–vrijdag 9:00–12:30 en 14:00–19:30; zaterdag 9:00–12:30",
    sourceUrl: "https://pharmacies.giphar.fr/nouvelle-aquitaine/lot-et-garonne/duras/pharmacie-du-chateau-duras-1364",
    sourceName: "Pharmacie du Château — officiële Giphar-pagina",
    secondarySourceUrl: "https://acceslibre.beta.gouv.fr/app/47-duras/a/pharmacie/erp/pharmacie-du-chateau-7/",
    secondarySourceName: "Acceslibre — Franse overheidsdirectory",
  },
  {
    id: "dentist-sainte-foy-baptiste-anselmi",
    type: "dentist",
    municipality: "Sainte-Foy-la-Grande",
    name: "Baptiste Anselmi — tandarts",
    address: "35 boulevard Larégnère, 33220 Sainte-Foy-la-Grande",
    phone: "05 57 46 03 18",
    sourceUrl: "https://www.saintefoylagrande.fr/mon-quotidien/sante/",
    sourceName: "Gemeente Sainte-Foy-la-Grande — gezondheidsdirectory",
  },
  {
    id: "pharmacy-sainte-foy-halles",
    type: "pharmacy",
    municipality: "Sainte-Foy-la-Grande",
    name: "Aprium Pharmacie des Halles",
    address: "2 place Jean Jaurès, 33220 Sainte-Foy-la-Grande",
    phone: "05 57 46 00 33",
    sourceUrl: "https://www.saintefoylagrande.fr/mon-quotidien/sante/",
    sourceName: "Gemeente Sainte-Foy-la-Grande — gezondheidsdirectory",
  },
  {
    id: "dentist-duras-francois-lalauze",
    type: "dentist",
    municipality: "Duras",
    name: "Dr François Lalauze — tandarts",
    address: "Pôle de Santé, 4 avenue Aristide Briand, 47120 Duras",
    phone: "05 53 83 70 54",
    sourceUrl: "https://cc-paysdeduras.fr/fr/rb/1956320/maison-de-sante-de-duras",
    sourceName: "Communauté de communes du Pays de Duras",
    secondarySourceUrl: "https://annuairesante.ameli.fr/professionnels-de-sante/fiche-detaillee-lalauze-francois-BLUwkjI0NjS1",
    secondarySourceName: "Annuaire Santé — Assurance Maladie",
    extra: "De officiële lokale bron en de Assurance Maladie vermelden dit praktijkadres. Bel voor actuele bereikbaarheid en afspraken.",
  },
  {
    id: "church-duras-sainte-marie-madeleine",
    type: "church",
    municipality: "Duras",
    name: "Église Sainte Marie-Madeleine",
    address: "Rue César Jauffret, 47120 Duras",
    phone: "05 24 30 50 81",
    email: "paroisse.saintmartin@diocese47.fr",
    website: "https://diocese47.fr/Paroisse-Saint-Martin-du-Dropt/",
    serviceTimes: "Volgende gepubliceerde mis in Duras: zondag 1 november 2026 om 10:30 (Allerheiligen). De zondagse mislocatie wisselt binnen de parochie.",
    extra: "De parochie vermeldt daarnaast een mis op de eerste dinsdag van de maand om 16:00 in Bellevue en op de eerste woensdag om 16:00 in de MARPA in Duras. Controleer de parochiekalender voor wijzigingen en de actuele locatie.",
    sourceUrl: "https://messes.info/horaires/44.6764:0.1837",
    sourceName: "Messes.info — gepubliceerde vieringen en actuele agenda",
    secondarySourceUrl: "https://paroissesaintmartindudropt47.over-blog.com/lieux-horaires-des-messes.html",
    secondarySourceName: "Paroisse Saint Martin du Dropt — plaatsen en tijden",
  },
];
