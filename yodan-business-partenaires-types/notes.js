/*
 * notes.js : contenu du panneau « Notes UX » (choix de chaque écran, questions à valider, aides de démo).
 */
"use strict";

const N = (title, choix, questions = []) => ({ title, choix, questions });
Object.assign(NOTES, {
  "login:login": N("Connexion — page commune", [
    "Aucun texte de démo dans l'interface : les explications sont ici, dans les Notes UX.",
    "Une seule page de connexion pour tous les profils (partenaires, Admin Yodan, Console, Admin LAMIFI, praticiens) : le compte mène au bon espace.",
    "Même mise en page que le login de la maquette LAMIFI Business v2 : logo, accroche, une phrase, trois repères, devise en pied — du texte simple, sans blocs.",
    "Accroche : mot de bienvenue (« Bienvenue sur votre espace. ») à la place de « Prendre soin de celles et ceux qui font l'entreprise ».",
    "Phrase : « Mesurer, Assister, Piloter et Transformer pour une performance durable et la santé mentale de vos équipes » (piliers de yodan.ci).",
    "Devise en pied : les valeurs ACISE (Agilité & Authenticité · Conformité · Innovation · Sécurité · Éthique) à la place de « Agir avec agilité · Innover avec responsabilité · Protéger avec exigence ».",
    "Thème bleu + orange de yodan.ci (bleus #002c4c / #1566aa, orange #fc5a1b). L'orange des boutons est foncé (#c2410c) pour garder un contraste lisible.",
    "Parcours : identifiants → code reçu par e-mail → entrer. Message identique pour une adresse inconnue ou un mauvais mot de passe (on ne révèle pas quels comptes existent).",
  ], ["Formulation de l'accroche « Bienvenue sur votre espace. » et de la fin de phrase « … pour une performance durable et la santé mentale de vos équipes » ?"]),
  "login:otp": N("Code de vérification", ["Code à 6 chiffres envoyé par e-mail, valable 10 minutes, 5 essais.", "Collage du code accepté ; « Renvoyer un code » invalide l'ancien."]),
  "login:password": N("Mot de passe", [
    "Activation d'un nouveau compte : lien e-mail → code → mot de passe → entrer.",
    "Admin LAMIFI Business : identifiant créé par le seed depuis <code>.env</code> ; il change son mot de passe dès la 1re connexion (login → code → nouveau mot de passe → entrer).",
    "Règles affichées en direct : 12 caractères, majuscules + minuscules, un chiffre, pas l'adresse e-mail.",
  ]),
  "lamifi:partners": N("Admin LAMIFI Business — partenaires", [
    "Nouvelle notation des rôles partout : Superviseur principal (ex-Administrateur), Administrateur (ex-Super administrateur), Superviseur adjoint (ex-Superviseur).",
    "Badge « modifié » quand un type connu a été ajusté via « Voir en détail ».",
    "La base de chaque partenaire n'affiche que l'hôte et la référence du secret (🔒), jamais le mot de passe.",
  ]),
  "lamifi:create": N("Créer un partenaire", [
    "Type connu : le préréglage est résumé en une carte ; seuls les champs propres au type restent à saisir (tests multiples et domaines pour Entreprise, domaines pour Association / mutuelle).",
    "« Voir en détail » : le bouton disparaît et le formulaire personnalisé s'ouvre, pré-rempli avec le préréglage du type choisi.",
    "Personnalisé : rôles activables (Superviseur principal verrouillé), fonctionnalités héritées une par une, tests en choix multiple, campagne sur un ou plusieurs rôles + e-mail pro, prise en charge (max + bon / budget).",
    "Premier compte : créé automatiquement sur le plus grand rôle actif (Administrateur › Superviseur principal › …) ; le titulaire reçoit le lien d'activation.",
    "Aperçu à droite : les onglets de chaque rôle sont recalculés à chaque changement.",
    "Test de connexion à la base : un message par cause d'échec (hôte injoignable, authentification refusée, base introuvable), journalisé sans mot de passe.",
    "🔒 Le mot de passe de la base part dans le gestionnaire de secrets dès la création : il n'est ni gardé dans la base LAMIFI, ni réaffiché, ni écrit dans les journaux.",
    "Association / mutuelle (validé) : les parents reprennent les fonctionnalités des enfants, sauf l'Évaluation ; aucun rôle n'a l'onglet Évaluation (les réponses viennent des campagnes).",
    "Prise en charge : chaque bon couvre les consultations max (sans bon : « Pas de bon ») ; au budget, une fois consommé : « Budget atteint », débloqué par l'admin Yodan.",
    "Mode détail : une modification du préréglage marque le partenaire « modifié » dans la liste.",
  ], [
    "Entreprise : seul le Superviseur principal est actif par défaut ; les autres rôles restent activables en « Voir en détail ». OK ?",
    "Faut-il garder le lien « Revenir au préréglage » une fois le détail ouvert ?",
    "Le type « Personnalisé » démarre avec le seul Superviseur principal, sans test : bon point de départ ?",
  ]),
  "yodan:dashboard": N("Admin Yodan — tableau de bord", [
    "Yodan voit tout (validé) : ce sont des médecins et des psychologues. Effectifs réels sans masquage < 5, et <strong>détail individuel</strong> des évaluations (dossier, nom, score, décision, prise en charge) sous les graphiques.",
    "Un tableau de bord par test (onglets PCL-5, ICJE, BSPA, KARASEK…), filtrable par partenaire.",
    "L'affichage du détail individuel est inscrit au journal des accès.",
  ]),
  "yodan:campagnes": N("Admin Yodan — campagnes et participants", ["Seul l'admin Yodan consulte les participants (e-mail, date d'invitation, état) et les taux de réponse (validé).", "Seuls les partenaires ayant activé la campagne apparaissent.", "E-mail pro : les adresses hors domaines autorisés sont refusées avec la raison."]),
  "yodan:evaluation": N("Admin Yodan — évaluation", ["Même écran que l'Évaluateur, avec le choix du partenaire puis du test.", "Identité (nom, téléphone) rangée dans le coffre identité, à part des réponses : le dossier clinique ne garde qu'un pseudonyme."]),
  "yodan:validation": N("Admin Yodan — validation", ["Même file que le Validateur, tous partenaires confondus.", "Vert et rouge sont décidés automatiquement ; seuls les dossiers orange attendent une décision.", "Sans le volet évaluation (déjà dans l'onglet Évaluation) pour éviter la redondance."]),
  "yodan:comptes": N("Admin Yodan — comptes", ["Même écran que l'Administrateur du partenaire : création, migration, activation et désactivation.", "Création en 2 temps : l'identifiant d'abord (un lien d'activation part tout de suite), puis les rôles — seuls ceux activés chez le partenaire sont proposés.", "Désactivation ciblée : un rôle seul, ou l'identifiant entier."], ["La migration est limitée aux identifiants du même partenaire : OK ?"]),
  "yodan:patients": N("Admin Yodan — patients", [
    "Statut calculé : En attente · Pas de bon (type bon) · Budget atteint (type budget) · Prise en charge en cours · Clos.",
    "Fiche : bouton Appeler + retour d'appel. Le commentaire est organisationnel (ex. « rappeler après 17 h »), jamais médical.",
    "Consentements affichés comme métadonnées reprises des formulaires de test, quel que soit le type de partenaire.",
    "« Prise en charge » si En attente ; « Débloquer » si Pas de bon (enregistrer le bon reçu) ou Budget atteint (nouveau budget) — validé.",
    "Chaque ouverture de fiche et chaque appel est inscrit au journal des accès (qui, quand, quel dossier).",
  ], ["Le bon est déposé par le Superviseur adjoint du partenaire ; Yodan peut l'enregistrer aussi via « Débloquer ». OK ?"]),
  "yodan:partenaires": N("Admin Yodan — partenaire", ["Même éditeur que « Rôles » dans la création personnalisée : on attribue n'importe quelle fonctionnalité à un rôle.", "Chaque changement s'applique tout de suite aux comptes du partenaire.", "Désactiver un rôle encore utilisé demande une confirmation (les comptes perdent ces onglets, sans être supprimés)."]),
  "console:pec": N("Console — patients pris en charge", ["Filtre par partenaire (barre du haut).", "Historique : consultations et rapports de séance. Le contenu des rapports reste chiffré (non montré dans la maquette) ; chaque ouverture est tracée."]),
  "console:attribution": N("Console — attribution", ["Patients « En attente » uniquement (bon reçu ou budget disponible) ; la charge actuelle de chaque praticien aide au choix.", "Les dossiers « Pas de bon » n'apparaissent qu'une fois le bon reçu."]),
  "console:dashboard": N("Console — tableau de bord", ["Patients par statut et par partenaire ; « — » quand un statut n'existe pas pour le type (ex. Budget atteint chez un partenaire au bon).", "La somme des statuts est égale au total (test de cohérence)."]),
  "console:praticiens": N("Console — praticiens", ["Création : nom et e-mail seulement. Ni psychologue / psychiatre, ni ville.", "Même parcours d'activation que les autres comptes : lien → code → mot de passe."]),
  "partner:dashboard": N("Superviseur principal — tableau de bord", ["Rôle essentiel, jamais désactivable : il porte les données pour piloter.", "Un tableau de bord par test. Chiffres agrégés : jamais de ligne individuelle ; un effectif de moins de 5 est masqué."]),
  "partner:campagne": N("Campagnes", ["Placée sur le rôle choisi à la création (Entreprise : Superviseur principal ; Association / mutuelle : Validateur).", "Le partenaire <strong>crée</strong> la campagne et envoie le lien, mais <strong>ne consulte pas</strong> les participants ni les taux de réponse (validé) : ils ne sont visibles que par l'admin Yodan.", "Lien envoyé par e-mail + code de vérification ; avec l'e-mail pro, seules les adresses des domaines autorisés sont acceptées."]),
  "partner:evaluation": N("Évaluation", ["Onglet propre à l'Évaluateur ; repris par les rôles parents quand l'héritage est activé (ex. CNPS : l'Administrateur a l'onglet Évaluation).", "Identité rangée dans le coffre identité, séparée des réponses."]),
  "partner:validation": N("Validation", ["Dossiers orange à décider ; vert et rouge sont décidés automatiquement."]),
  "partner:suivi": N("Superviseur adjoint — suivi", ["Bons de prise en charge à déposer (type bon), décisions en retard, équipe.", "Numéros de dossier uniquement : l'identité des personnes n'apparaît pas."]),
  "partner:comptes": N("Administrateur — comptes", ["1. On crée l'identifiant (personne + e-mail, lien d'activation envoyé). 2. On lui ajoute un ou plusieurs rôles.", "Un rôle se désactive ou se migre seul, sans toucher au reste.", "Seuls les rôles activés chez le partenaire sont proposés."]),
  praticien: N("Praticien", ["Repris de LAMIFI Business v2.", "La connexion suit le même parcours que les autres profils."]),
});
/* Fusion modulaire : chaque fonctionnalité reprend une maquette existante (repère « Source »). */
const SRC = (t) => `<span class="pill bleu">Source</span> ${t}`;
Object.assign(NOTES, {
  "partner:evaluation": N("Évaluation", [SRC("LAMIFI v2 — évaluateur (application CNPS en préprod : DossierLookup)."),
    "N° de la personne d'abord : nouvelle personne, personne connue (identité déjà enregistrée, non modifiable ici) ou test de suivi si une prise en charge est en cours.",
    "Blocages calculés sur les données : évaluation déjà en attente de décision, délai de recours, test de suivi trop tôt (60 jours), dossier déjà ouvert.",
    "Mode : avec le patient sur cet écran, ou par QR code (le patient répond seul sur son téléphone, 15 min).",
    "Consentements avant le questionnaire, identité selon le questionnaire général du partenaire (🔒 = coffre identité), une question par écran (touches du clavier), vérification avec « Modifier », puis résultat à montrer au patient avec ses choix (être rappelé…) et les liens de la zone.",
    "Onglet propre à l'Évaluateur ; repris par les rôles parents quand l'héritage est activé (CNPS : l'Administrateur a l'onglet Évaluation)."]),
  "partner:validation": N("Validation", [SRC("LAMIFI v2 — validateur."),
    "« À décider » : liste à gauche, dossier à droite (score, délai pour décider, réponses, commentaire), touches O / N, dossier suivant automatique.",
    "Zones décidées par un validateur : réglées par agence (ex. Bouaké : orange et rouge). Les autres zones sont décidées automatiquement.",
    "« À appeler » (type budget) : l'accord du patient est recueilli par téléphone avant la prise en charge (accepte, refuse = dossier clos, injoignable).",
    "« Traités » : décisions avec leur auteur et le commentaire éventuel."]),
  "partner:suivi": N("Superviseur adjoint — suivi des agences", [SRC("LAMIFI v2 — superviseur."),
    "Pilotage : histogramme calculé sur les évaluations réelles de la démo, par semaine, mois, trimestre, année ou Du → Au, par décision ou par zone, en nombre ou en % ; colonnes de moins de 5 masquées.",
    "Hors délai : dossiers orange sans décision depuis plus de 3 jours (N° seulement).",
    "Bons de prise en charge (type bon) : dépôt du PDF après le délai de recours ; une fois envoyé, le bon part chez Yodan.",
    "Équipe, suivi des dossiers (N° et étape, jamais l'identité), affiches QR ouvert par agence (imprimer, activer, régénérer)."]),
  "partner:dashboard": N("Superviseur principal — tableau de bord", [SRC("un tableau de bord par test : PCL-5 = graphes admin ATMP v2 ; ICJE = tableau de bord Jouons responsable ; BSPA = tableau de bord RH ; autres tests = générique."),
    "Rôle essentiel, jamais désactivable.", "Chiffres agrégés uniquement, jamais de ligne individuelle ; un effectif de moins de 5 est masqué (cases, colonnes, groupes).", "Sections repliables, état gardé pendant la session."]),
  "partner:campagne": N("Campagnes", [SRC("BSPA — campagnes multi-entreprises."), "Le partenaire crée la campagne et envoie le lien (adresses collées ou import CSV : seule la colonne e-mail est lue).",
    "Il ne consulte pas les participants ni les taux de réponse (validé) : seul l'admin Yodan les voit.", "E-mail pro : adresses hors domaines refusées avec la raison ; une personne qui a déjà terminé n'est pas relancée."]),
  "partner:comptes": N("Administrateur — comptes", [SRC("LAMIFI v2 — super admin (agences, options, comptes, exports, historique)."),
    "Identifiants et rôles : 1. l'identifiant (lien d'activation envoyé) ; 2. un ou plusieurs rôles ; migration et désactivation ciblées.",
    "Agences et options : délai de recours, zones décidées par un validateur, QR ouvert autorisé.",
    "Recherche de dossier par N° : fiche en lecture seule, sans identité, ni réponses, ni score.",
    "Exports : CSV / XLSX agrégés ; SQL avec un code reçu par e-mail (anonymisé ou complet selon le réglage de l'Admin LAMIFI)."]),
  "yodan:dashboard": N("Admin Yodan — tableau de bord", [SRC("mêmes tableaux de bord que le Superviseur principal, par test."),
    "Yodan voit tout (validé) : médecins et psychologues. Pas de masquage < 5 et « Détail des évaluations » sous les graphiques.",
    "Clic sur une ligne : rapport individuel (résultat, dimensions BSPA, réponses, consentements), comme la vue médecin BSPA. Chaque ouverture est journalisée."]),
  "yodan:patients": N("Admin Yodan — patients", [SRC("LAMIFI v2 — admin Yodan (À faire, Rappels, attestation) + Jouons responsable (file « À appeler »)."),
    "Filtres rapides : rappels demandés (📞), accord à recueillir (partenaires sans validateur : LONACI, Entreprise), à prendre en charge, à débloquer.",
    "Prise en charge en 3 étapes : praticien (agenda en place obligatoire, suggestion du moins chargé) → attestation (en ligne ou présentiel, 3 mois) → lien à envoyer (copie, SMS, e-mail), sans donnée de santé.",
    "Statuts : En attente · Pas de bon · Budget atteint · Prise en charge en cours · Clos ; « Débloquer » pour Pas de bon et Budget atteint (validé).",
    "Retour d'appel : met aussi à jour l'accord du patient quand il est attendu."]),
  "console:attribution": N("Console — à faire", [SRC("LAMIFI v2 — admin Yodan, « À faire »."), "Prendre en charge : patients prêts (accord, bon ou budget, délai de recours passé), praticien suggéré.", "Plafonds atteints : débloquer (bon reçu ou nouveau budget)."]),
  "console:pec": N("Console — patients pris en charge", [SRC("LAMIFI v2 — patients, séances, suivi PCL-5."), "Historique : séances (présent, reporté, absent ; seules les présences consomment le bon ou le budget), rapports de séance (ouverture tracée, contenu chiffré), suivi PCL-5 initial → test de suivi.", "Clôture avec confirmation."]),
  "console:dashboard": N("Console — tableau de bord", ["Patients par statut, assiduité, par partenaire (« — » quand un statut n'existe pas pour le type) et par praticien.", "La somme des statuts est égale au total (test de cohérence)."]),
  "praticien:today": N("Praticien — séances du jour", [SRC("LAMIFI v2 — praticien."), "Agenda obligatoire avant tout patient.", "Praticien externe (sur place) : scan du QR de l'attestation avant de pointer la séance ; attestation expirée refusée.", "Présent, reporté ou absent ; une présence au-delà du plafond est refusée."]),
  "praticien:patients": N("Praticien — mes patients", ["Séances réalisées / capacité, statut, validité de l'attestation ; ajout d'une séance au jour même."]),
  "praticien:settings": N("Praticien — agenda", ["Jours de travail ; « Agenda en place » ouvre la réception de patients (sinon le praticien n'est pas proposé par Yodan)."]),
  "lamifi:settings": N("Admin LAMIFI — réglages d'un partenaire", [SRC("LAMIFI v2 — admin système (réglages du partenaire)."), "Identifiants (1 ou 2, libellés), questionnaire général (assistant en 5 étapes : type, libellé et clé, valeurs, identité 🔒 et niveau, aperçu), consentements et liens par zone, export SQL anonymisé ou complet.", "Chaque champ ajouté pose la question de la minimisation : à quoi sert-il ?"]),
  "public:choix": N("Patient / participant", ["Parcours publics selon le partenaire choisi dans la barre du haut."]),
  "public:site": N("Joueur — Jouons responsable", [SRC("maquette Lonaci (formulaire, résultat)."), "Étape 1 : téléphone, e-mail facultatif, ville (commune si Abidjan), âge (18 ans et +), sexe, plateforme, canal, consentement ; étape 2 : 9 questions ICJE.", "Résultat : jauge, catégorie (sans risque, faible, modéré, excessif), message ; orange et rouge : demande d'appel ; rouge : accompagnement.", "Charte Lonaci (brun, Montserrat) sur cette page publique."]),
  "public:campagne": N("Participant — campagne", [SRC("BSPA — parcours e-mail + code."), "Adresse (domaine pro), code à 6 chiffres, consentement, questions par section (BSPA : 5 sections, 22 questions), informations pour les statistiques, puis e-mail neutre « Votre bilan est disponible ».", "Bilan personnel : profil, 5 dimensions, recommandation, choix d'être accompagné(e)."]),
  "public:qr": N("Patient — QR unique", [SRC("LAMIFI v2 — patient (QR donné par l'agent)."), "Consentements, une question par écran, résultat et choix avec le résultat."]),
  "public:qr_ouvert": N("Patient — affiche (QR ouvert)", [SRC("LAMIFI v2 — QR ouvert."), "Nouveau patient seulement : une personne déjà connue est orientée vers un agent.", "Identité demandée sur le téléphone, puis questionnaire et résultat."]),
});

/* Retours du 18/11 : attribution dans la Console, sous-onglets, évaluateur mono-agence, adjoint = tableau de bord limité, agenda calculé. */
Object.assign(NOTES, {
  "yodan:patients": N("Admin Yodan — patients", [SRC("LAMIFI v2 — admin Yodan (Rappels) + Jouons responsable (file « À appeler »)."),
    "Filtres rapides : rappels demandés (📞), accord à recueillir (partenaires sans validateur : LONACI, Entreprise), prise en charge à valider, à débloquer.",
    "« Prise en charge » (validé) : l'admin Yodan valide la prise en charge et le dossier part dans la Console. <strong>L'attribution du praticien se fait uniquement dans la Console.</strong>",
    "Statuts : En attente · Pas de bon · Budget atteint · Prise en charge en cours · Clos ; « Débloquer » pour Pas de bon et Budget atteint.",
    "Retour d'appel : met aussi à jour l'accord du patient quand il est attendu. Ouverture de fiche et appels journalisés."]),
  "console:attribution": N("Console — attribution", [SRC("LAMIFI v2 — admin Yodan, « À faire »."),
    "Sous-onglets « À attribuer » et « Plafonds atteints » : une file par onglet, avec son compteur, pour qu'aucune ne soit cachée sous l'autre.",
    "À attribuer : dossiers validés par l'admin Yodan ; 3 étapes : praticien (agenda en place, suggestion du moins chargé) → attestation (en ligne ou présentiel, 3 mois) → lien à envoyer, sans donnée de santé.",
    "Plafonds atteints : débloquer (bon reçu ou nouveau budget)."]),
  "console:dashboard": N("Console — tableau de bord", ["Sous-onglets : Vue d'ensemble (statuts, assiduité), Par partenaire, Par praticien.", "La somme des statuts est égale au total (test de cohérence)."]),
  "partner:dashboard": N("Tableau de bord", [SRC("un tableau de bord par test : PCL-5 = graphes admin ATMP v2 ; ICJE = Jouons responsable ; BSPA = tableau de bord RH ; autres tests = générique."),
    "Superviseur principal : tout le réseau du partenaire. <strong>Superviseur adjoint : le même tableau de bord, limité à ses agences</strong> (rappelées sous le titre).",
    "Chiffres agrégés uniquement ; un effectif de moins de 5 est masqué."]),
  "partner:suivi": N("Superviseur adjoint — suivi des agences", [SRC("LAMIFI v2 — superviseur."),
    "Le pilotage passe dans l'onglet Tableau de bord (même tableau que le principal, limité aux agences) : plus de doublon ici.",
    "Sous-onglets : suivi des dossiers (N° et étape, jamais l'identité), hors délai, bons de prise en charge (type bon), équipe, affiches QR ouvert."]),
  "partner:evaluation": N("Évaluation", [SRC("LAMIFI v2 — évaluateur (application CNPS en préprod : DossierLookup)."),
    "Un évaluateur est rattaché à <strong>une seule agence</strong> : pas de choix d'agence à l'écran.",
    "N° d'abord : nouvelle personne, personne connue ou test de suivi ; blocages calculés (décision en attente, délai de recours, suivi avant 60 jours, dossier ouvert).",
    "Avec le patient ou par QR ; consentements, identité, une question par écran, vérification, résultat avec les choix du patient et les liens de la zone."]),
  "partner:comptes": N("Administrateur — comptes", [SRC("LAMIFI v2 — super admin."),
    "Identifiants et rôles : 1. l'identifiant ; 2. les rôles. Évaluateur : une seule agence (choix unique) ; autres rôles : une ou plusieurs agences.",
    "Agences et options, recherche de dossier (lecture seule), historique et exports (SQL avec code par e-mail)."]),
  "praticien:settings": N("Praticien — agenda", ["L'agenda est en place dès qu'au moins un jour de travail est coché : pas de bouton à activer.", "Sans aucun jour coché, le praticien n'est pas proposé à l'attribution."]),
});

/** Aides de démo (affichées dans les notes, jamais dans l'écran de l'application). */
function demoHints() {
  const k = notesKey();
  const common = ["Bouton rond 🛠 en bas à droite : <strong>horloge</strong> (avancer le temps) et <strong>boîte e-mail</strong> simulée (codes, liens d'activation, invitations). Les e-mails ne contiennent jamais de résultat de test."];
  if (k.startsWith("login")) return [
    `Mot de passe de démo : <code>${DEMO_PASSWORD}</code> pour les comptes ci-dessous.`,
    `Admin LAMIFI Business (seed .env) : <code>${ENV.LAMIFI_ADMIN_EMAIL}</code> / <code>${ENV.LAMIFI_ADMIN_PASSWORD}</code> → changement de mot de passe obligatoire.`,
    "Admin Yodan : <code>admin.yodan@yodan.exemple.test</code> · Console : <code>console@yodan.exemple.test</code> · Praticien : <code>dr.kader.demo@praticiens.exemple.test</code>",
    "CNPS : Administrateur <code>admin@cnps.exemple.test</code> · Superviseur principal <code>claire.demo@cnps.exemple.test</code> · Validateur <code>marc.demo@cnps.exemple.test</code> · Évaluateur <code>paul.demo@cnps.exemple.test</code>",
    "LONACI : <code>supervision@lonaci.exemple.test</code> · Entreprise Alpha : <code>rh@alpha.exemple.test</code> · Mutuelle Horizon : <code>validation@horizon.exemple.test</code>",
    "Activation : ouvrez l'e-mail « Activez votre compte » de <code>nouvel.agent@cnps.exemple.test</code>.", ...common,
  ];
  if (k === "lamifi:create") return ["Base : hôte contenant « injoignable » = panne réseau ; mot de passe « faux » = refus ; base commençant par « absente » = base introuvable.", ...common];
  if (k.endsWith(":evaluation")) return ["N° déjà connus : prenez un N° dans « Mes évaluations » (personne connue, ou test de suivi si elle est prise en charge depuis plus de 60 jours).", "Les boutons ci-dessous remplissent le questionnaire et passent à la vérification.", ...common];
  if (k === "public:campagne") return ["Adresse acceptée : <code>prenom.nom@alpha.exemple.test</code> (Alpha) ou <code>@horizon.exemple.test</code> ; refusée : <code>@gmail.com</code>.", "Le code arrive dans la boîte e-mail 🛠.", ...common];
  if (k.startsWith("public")) return ["Changez de partenaire dans la barre du haut : CNPS (QR), LONACI (site), Entreprise ou Mutuelle (campagne).", ...common];
  if (k.startsWith("partner")) return ["Changez de partenaire et de rôle dans la barre du haut : les onglets suivent la configuration (fonctionnalités propres + héritées).", ...common];
  return common;
}
function demoActions() {
  const k = notesKey();
  const wz = Object.values(evx).find((s) => s.step === "wizard");
  const acts = [];
  if (k.endsWith(":evaluation") && wz) acts.push(["Remplir : vert", () => fillEvaluationDemo("VERT")], ["Remplir : orange", () => fillEvaluationDemo("ORANGE")], ["Remplir : rouge", () => fillEvaluationDemo("ROUGE")]);
  if (k.endsWith(":evaluation") && Object.values(evx).some((s) => s.step === "qr" && !s.result)) acts.push(["Simuler : le patient a terminé", qrPatientDone]);
  if (k.startsWith("public") && ["questions", "form"].includes(pub.step)) acts.push(["Remplir : faible risque", () => fillPublicDemo(0.1)], ["Remplir : risque élevé", () => fillPublicDemo(0.9)]);
  if (k === "console:pec") acts.push(["Simuler une consultation", () => {
    const pt = db.patients.find((x) => patientStatus(x) === "EN_COURS" && (co.partner === "all" || x.partnerId === co.partner));
    if (!pt) return toast("Aucun patient en cours.");
    addConsultation(pt.id); toast(`Consultation ajoutée : ${esc(pt.dossier)} (${consumedOf(pt)} / ${capacityOf(pt)}).`); render();
  }]);
  if (k === "lamifi:create") acts.push(["Remplir l'exemple", () => {
    Object.assign(cd, { name: "Entreprise Démo Gamma", db: { host: "db.interne.exemple.test", port: "3306", username: "pec_gamma", password: "fictif-demo", database: "pec_gamma" }, fa: { name: "RH Gamma Démo", email: "rh@gamma.exemple.test" }, domainsText: "gamma.exemple.test" });
    cd.cfg.campaign.domains = ["gamma.exemple.test"];
    render();
  }]);
  return acts;
}

