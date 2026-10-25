export type CuratedLocalService = {
  id: string;
  type: "library" | "pharmacy";
  municipality: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
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
];
