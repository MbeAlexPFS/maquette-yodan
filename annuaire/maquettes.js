/*
 * Registre des maquettes affichées par l'annuaire (index.html à la racine).
 *
 * Pour ajouter une maquette :
 *   1. créer le dossier à la racine : <projet>-<nom-maquette>/ (minuscules, tirets) ;
 *   2. ajouter une entrée dans MAQUETTES ci-dessous (et le projet dans PROJETS s'il est nouveau) ;
 *   3. incrémenter ?v= de maquettes.js dans index.html.
 *
 * Données descriptives uniquement : jamais de donnée réelle ni de secret ici.
 * (fichier .js plutôt que .json : l'annuaire doit s'ouvrir par double-clic, où fetch() est bloqué.)
 */
window.PROJETS = {
  "yodan-business": { nom: "YODAN Business / LAMIFI", couleur: "#0A4875" },
  "yodan-atmp-cnps": { nom: "YODAN ATMP — CNPS", couleur: "#1566AA" },
  "bspa-particuliers": { nom: "BSPA Particuliers", couleur: "#0b6e6e" },
  "lonaci": { nom: "Lonaci", couleur: "#3c210e" },
};

window.MAQUETTES = [
  {
    dossier: "yodan-business-partenaires-simplifie",
    projet: "yodan-business",
    titre: "LAMIFI Business — partenaires (version simplifiée)",
    description: "Dérivée de « partenaires par type » : types Entreprise et Association / mutuelle seulement, création de partenaire en un écran court, seul réglage = inclure une fonctionnalité d'un rôle dans un autre. Pas de prise en charge dans l'app : l'admin Yodan exporte la liste des personnes à prendre en charge (CSV) et passe le dossier à « Clos » quand le traitement est fini. Superviseur secondaire (ex-adjoint). Métadonnées de filtre : secteur d'activité (liste de l'admin LAMIFI) et directions (entreprise) / régions (mutuelle) par défaut configurables dans l'admin LAMIFI et personnalisables par partenaire dans l'admin Yodan (onglet « Profil partenaire » : secteur, directions / régions, effectif daté, aussi saisissable à la création), champ du questionnaire et filtre du tableau de bord. Bandeau Participation en tête du tableau de bord (effectif → sélectionnés → ont répondu). Tests de cohérence inclus (?tests=1).",
    ecrans: ["Connexion", "Partenaires", "Créer un partenaire", "Secteurs d'activité", "Rôles (inclusions)", "Directions et régions (LAMIFI)", "Profil partenaire (Yodan)", "Tableau de bord par test", "Campagnes", "Validation", "Suivi des agences", "Comptes", "À prendre en charge (export, clôture)", "Participant"],
    roles: ["Admin LAMIFI Business", "Admin Yodan", "Administrateur", "Superviseur principal", "Superviseur secondaire", "Validateur", "Participant"],
    maj: "2026-11-20",
  },
  {
    dossier: "yodan-business-partenaires-types",
    projet: "yodan-business",
    titre: "LAMIFI Business — partenaires par type",
    description: "Fusion modulaire des maquettes CNPS (LAMIFI v2, graphes ATMP v2), Jouons responsable (Lonaci) et BSPA : création de partenaire par type ou personnalisée (rôles, fonctionnalités héritées, tests, campagne, bon / budget), évaluation guidée avec blocages et QR, validation, suivi des agences, un tableau de bord par test (PCL-5, ICJE, BSPA…), campagnes e-mail pro + code, Admin Yodan (vue complète, patients, attestation), Console, praticien, parcours publics. Connexion commune, barre de démo horloge + e-mails. Tests de cohérence inclus (?tests=1).",
    ecrans: ["Connexion", "Partenaires et réglages", "Créer un partenaire", "Évaluation (agent, QR)", "Validation", "Suivi des agences", "Tableau de bord par test", "Campagnes", "Comptes et agences", "Patients", "Console", "Praticien", "Patient / joueur / participant"],
    roles: ["Admin LAMIFI Business", "Admin Yodan", "Console", "Praticien", "Administrateur", "Superviseur principal", "Superviseur adjoint", "Validateur", "Évaluateur", "Patient / participant"],
    maj: "2026-11-18",
  },
  {
    dossier: "lonaci-parcours-jeu-responsable",
    projet: "lonaci",
    titre: "Parcours Jeu responsable",
    description: "Test ICJE côté joueur, page de résultat, puis tableau de bord Lonaci / YODAN avec recherche et pagination des dossiers, fiche d'appel (validée / injoignable / refusée avec motif), historique des accès et journaux internes (YODAN).",
    ecrans: ["Formulaire", "Résultat", "Tableau de bord", "Historique et journaux internes"],
    roles: ["Joueur", "Lonaci", "YODAN"],
    maj: "2026-11-19",
  },
  {
    dossier: "yodan-business-refonte-ux-v2",
    projet: "yodan-business",
    titre: "LAMIFI Business — refonte UX (v2)",
    description: "Refonte UX et flux de la plateforme SaaS (ex-YODAN Business), d'après le diagramme du 16/11/2026.",
    ecrans: ["Espaces par rôle", "Dossiers", "Tableaux de bord"],
    maj: "2026-11-16",
  },
  {
    dossier: "bspa-particuliers-parcours-qr-otp",
    projet: "bspa-particuliers",
    titre: "Parcours QR code + OTP",
    description: "Accès par QR code puis vérification d'identité par code à usage unique (OTP) envoyé par e-mail. Envois et exports simulés.",
    ecrans: ["QR code", "Vérification OTP"],
    maj: "2026-11-15",
    remplacePar: "bspa-particuliers-campagnes-multi-entreprises",
  },
  {
    dossier: "bspa-particuliers-standalone",
    projet: "bspa-particuliers",
    titre: "Version autonome (connexion + entreprises)",
    description: "Variante autonome de « Campagnes multi-entreprises » : page de connexion commune Yodan / RH (mot de passe + code par e-mail), création et modification des entreprises et de leur compte RH (lien d'activation, mot de passe oublié par code, déconnexion après 30 min d'inactivité). Tests de cohérence inclus (?tests=1).",
    ecrans: ["Connexion", "Code MFA", "Activation du compte", "Mot de passe oublié", "Entreprises", "Campagnes", "Tableau de bord & participants", "Tableau de bord RH", "Formulaire"],
    roles: ["Médecin Yodan", "RH", "Participant"],
    maj: "2026-11-17",
  },
  {
    dossier: "bspa-particuliers-campagnes-multi-entreprises",
    projet: "bspa-particuliers",
    titre: "Campagnes multi-entreprises",
    description: "Plusieurs entreprises clientes : création de campagne (nom, entreprise, période) et envoi du lien (adresses collées ou import CSV), formulaire avec message hors période, vue médecin Yodan non censurée filtrée par entreprise / campagne / patient avec la liste des participants, tableau de bord RH agrégé. Tests de cohérence inclus (?tests=1).",
    ecrans: ["Campagnes", "Tableau de bord & participants", "Rapport médecin", "Tableau de bord RH", "Formulaire", "Bilan fermé", "E-mail + rapport"],
    roles: ["Médecin Yodan", "RH", "Participant"],
    maj: "2026-11-17",
  },
  {
    dossier: "yodan-atmp-cnps-graphes-admin-v2",
    projet: "yodan-atmp-cnps",
    titre: "Graphes admin ATMP (v2)",
    description: "Tableau de bord enrichi : parcours des demandes, délais médians, dossiers en attente, évolution PCL-5, assiduité aux séances, zones par profil (agent matériel, sexe, âge, ville) et comparaison des agences. Masquage des effectifs < 5, tests de cohérence.",
    ecrans: ["Tableau de bord"],
    roles: ["Admin"],
    maj: "2026-11-17",
  },
  {
    dossier: "yodan-atmp-cnps-graphes-admin",
    projet: "yodan-atmp-cnps",
    titre: "Graphes admin ATMP",
    remplacePar: "yodan-atmp-cnps-graphes-admin-v2",
    description: "Tableau de bord administrateur : répartition par zone (vert / orange / rouge) et décisions de prise en charge dans le temps.",
    ecrans: ["Tableau de bord"],
    roles: ["Admin"],
    maj: "2026-11-13",
  },
  {
    dossier: "yodan-business-refonte-ux",
    projet: "yodan-business",
    titre: "YODAN Business — refonte UX (v1)",
    description: "Première version de la refonte UX. Maquette de référence pour les conventions (bandeau, bascule PC / Mobile, notes UX).",
    ecrans: ["Espaces par rôle", "Dossiers", "Tableaux de bord"],
    maj: "2026-11-13",
    remplacePar: "yodan-business-refonte-ux-v2",
    reference: true,
  },
];
