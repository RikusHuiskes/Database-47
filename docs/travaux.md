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

## Comparaison locale

| Service | Ce qu’il propose | Choix Côte de Duras |
| --- | --- | --- |
| [AlloVoisins à Duras](https://www.allovoisins.com/r/0/123/25045/0/Duras/service/Bricolage-travaux) | Annonces locales par commune et spécialité, particuliers et professionnels | Consultation libre et filtres locaux, réponses réservées aux abonnés |
| [Travaux.com](https://www.travaux.com/comment-ca-marche) | Description détaillée, comparaison d’offres et coordonnées transmises aux artisans choisis | Conseils pour préciser et comparer les offres. Transmission aux trois premières réponses éligibles selon la règle affichée |
| [Habitatpresto Pro](https://www.habitatpresto.com/pro/inscription-chantiers) | Demandes de devis selon le métier et la zone | Filtres métier et commune, tarif mensuel annoncé et propositions facultatives |

L’e-mail utilisé pour le contact est l’adresse vérifiée du compte. La table travaux_contacts est liée à la demande par sa clé primaire, sans lecture publique. La modération courante affiche les seuls champs de l’annonce. Le guide ne remplace pas les mentions RGPD complètes à valider avant activation publique, dont la durée de conservation et le fondement du traitement. [Repères CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence).

## Registre et future évaluation

L’onglet Administration, réservé aux comptes qui passent `is_admin()`, affiche les artisans, leur référence d’abonnement Mollie, l’accès payé, le mode test et le renouvellement. L’historique d’un artisan est paginé et affiche le chantier, la place, le message et le montant éventuel. L’API d’administration n’envoie ni l’adresse ni les coordonnées du demandeur.

Pour une future évaluation, utiliser le couple `(job_id, provider_id)` déjà unique dans `travaux_responses`. Vérifier que l’auteur est le propriétaire du chantier et que l’artisan a obtenu une place. Enregistrer au plus une évaluation par couple. Décider du déclencheur après réalisation, de la modération et de la visibilité avant d’ouvrir les avis.

Appliquer également `20261125170000_travaux_provider_profile.sql` avant d’activer les formulaires. Le profil professionnel est conservé dans le registre privé, avec le SIRET au format 14 chiffres, les spécialités, l’effectif et les certifications déclarées. La version des conditions et la date d’acceptation sont enregistrées avant la redirection vers Mollie. Vérifier les conditions contractuelles définitives avant mise en production.

Appliquer `20261125190000_travaux_public_feed.sql` pour le compteur public des réponses. La projection expose le contenu modéré et le total, sans identité des répondants. Une demande complète reste visible à 3/3 et ne peut plus recevoir de réponses. Les recommandations filtrent sur les spécialités du profil authentifié avant pagination.

## Paiements et factures

Appliquer `20261125210000_travaux_billing_plans.sql` après les migrations Travaux, statistiques et facturation publicitaire. Les prix serveur sont 25 € par mois (première autorisation par un moyen compatible, renouvellement par prélèvement SEPA) et 250 € pour 12 mois (paiement unique). Configurer les moyens Mollie et l’envoi SMTP dans un environnement isolé. Vérifier le régime fiscal et les coordonnées du vendeur dans les réglages de facturation existants. Le retour navigateur ne valide pas un paiement. Le serveur lit la transaction Mollie, puis enregistre la période, la facture et sa mise en file dans une transaction. Une facture par paiement, y compris lors d’un renouvellement. La file existante réessaie via le cron de messagerie. Les factures sont également téléchargeables depuis l’espace professionnel.

### Recette

- Créer une demande avec des coordonnées fictives, approuver, vérifier l’anonymat public, puis accepter trois réponses et rejeter la quatrième (y compris sous concurrence).
- Tester un paiement annuel, un premier paiement mensuel et son renouvellement SEPA. Tester un échec, rejouer la notification et contrôler qu’un seul PDF et e-mail soient émis pour le même paiement.
- Contrôler la réception SMTP sur la boîte de test, la durée de 12 mois de l’option annuelle, l’arrêt du renouvellement mensuel et l’accès aux PDF du seul acheteur.
- En mode test, les factures sont marquées TEST et le transport existant redirige les e-mails vers le compte de test configuré.
- Une contestation ou un remboursement suspend l’accès pour la période concernée. Traiter l’éventuel avoir dans le circuit comptable.

Le registre « Coordonnées privées des demandeurs » utilise la table existante `travaux_contacts`, liée à chaque demande. Pour le rendre accessible au propriétaire, définir côté serveur `TRAVAUX_OWNER_USER_ID` sur l’UUID de son compte Supabase vérifié. Ce compte doit également être administrateur. Sans cette configuration, le registre reste fermé à tous les comptes. Modifier l’e-mail de contact dans ce registre ne change pas la connexion du demandeur. Les artisans ayant répondu avec succès continuent de recevoir le nom, l’e-mail et le téléphone, sans adresse.

L’onglet Beheer / Administration est accessible à l’écran de connexion. Le lien `/travaux?espace=admin` ouvre cet écran ou le tableau de bord si la session est autorisée. La demande de lien administrative ne crée pas de compte. La modération, les statistiques et les dossiers privés utilisent tous l’UUID propriétaire configuré et le rôle administrateur.
