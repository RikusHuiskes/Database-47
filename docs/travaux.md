# Travaux et artisans autour de Duras

La page `/travaux` utilise le logo, le visuel et les styles de Côte de Duras. La page, les formulaires, les états et la modération sont disponibles en français, anglais et néerlandais via le sélecteur du site. Les annonces restent dans la langue de la personne qui les a rédigées. La langue sélectionnée est conservée après le lien e-mail et le retour Mollie.

## Fonctionnement

- Un habitant se connecte par lien e-mail puis dépose gratuitement sa demande. La commune sélectionnée doit se trouver à 50 km à vol d’oiseau du centre de Duras, selon les coordonnées du référentiel du site. Le sélecteur réunit les communes du guide et les autres communes du référentiel dans le rayon, avec recherche par nom ou code postal.
- Un administrateur se connecte avec son adresse habituelle dans l’espace Travaux, puis ouvre « Demandes à modérer » sur `/travaux` et vérifie le titre et la description avant publication. Le choix de type de travaux propose 28 métiers ou prestations, répartis en six familles. La liste publique affiche le type de travaux, la commune, le titre et la description des demandes ouvertes. Le nom, l’adresse et les autres coordonnées restent privés. La consultation est libre, y compris sans compte, avec filtres par métier et commune, et pagination.
- Pour répondre, un artisan s’abonne via Mollie à 25 € par mois. Le premier paiement recueille le mandat et couvre le premier mois. Après confirmation côté serveur, Mollie gère les échéances suivantes. Le renouvellement automatique peut être arrêté depuis l’espace pro. Dans cette première version, la réactivation après résiliation passe par l’assistance.
- Chaque réponse acceptée affiche les coordonnées de l’artisan chez l’habitant et celles de l’habitant chez cet artisan. Le message et le montant du devis sont facultatifs. Les échanges se consultent dans les espaces personnels. Le troisième répondant ferme automatiquement la demande.

## Essai en environnement de test

1. Appliquer `supabase/migrations/20261125160000_travaux.sql` à un projet Supabase de test. La modération réutilise la fonction `public.is_admin()` du site. Pour l’essai, prévoir un compte administrateur, un habitant et quatre comptes artisans.
2. Configurer Supabase Auth Email OTP et un transport SMTP capable de délivrer les liens. Autoriser comme URL de retour le chemin HTTPS `/travaux` sur chaque environnement autorisé. Tester les liens résidents et pros pour les trois langues. Le retour utilise `lang=fr|en|nl` et le lien professionnel ajoute `espace=pro`. Le modèle de l'e-mail doit contenir le lien de confirmation et la confirmation d'e-mail doit être activée.
3. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, la clé serveur Supabase déjà utilisée par le site, `MOLLIE_API_KEY` en mode test et `TRAVAUX_ENABLED=true`. Le domaine doit être en HTTPS. Le webhook Mollie `/api/travaux/mollie` doit être joignable par Mollie, y compris sur Vercel Preview.
4. Vérifier le lien de connexion, le dépôt, la modération et quatre réponses à la même demande. Vérifier qu’un visiteur non connecté peut consulter la liste, et qu’un artisan sans abonnement ne peut pas répondre. Vérifier dans Mollie le premier paiement, la première date de renouvellement, le traitement d’un renouvellement et la résiliation. Les bénéficiaires s’affichent dans les espaces respectifs après actualisation. Aucun e-mail de mise en relation n’est envoyé par cette version.
5. Avant ouverture publique, valider les mentions de confidentialité et les conditions de l’abonnement, les modalités de facturation et la durée de conservation des coordonnées. Utiliser une base distincte pour les essais et une clé Mollie live uniquement dans l’environnement de production. La configuration de production utilise l’origine HTTPS canonique `PUBLIC_SITE_URL` si elle est définie.

Test local des règles PostgreSQL avec `node --test lib/travaux-sql.test.mjs`.
