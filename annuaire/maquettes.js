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
    description: "Partenaire créé en un écran, profil et filtres (secteur, directions / régions), export CSV des personnes à prendre en charge.",
    tests: true,
    ecrans: ["Connexion", "Partenaires", "Créer un partenaire", "Secteurs d'activité", "Rôles (inclusions)", "Directions et régions (LAMIFI)", "Profil partenaire (Yodan)", "Tableau de bord par test", "Campagnes", "Validation", "Suivi des agences", "Comptes", "À prendre en charge (export, clôture)", "Participant"],
    roles: ["Admin LAMIFI Business", "Admin Yodan", "Administrateur", "Superviseur principal", "Superviseur secondaire", "Validateur", "Participant"],
    maj: "2026-11-20",
  },
  {
    dossier: "yodan-business-partenaires-types",
    projet: "yodan-business",
    titre: "LAMIFI Business — partenaires par type",
    description: "Fusion CNPS, Lonaci et BSPA : partenaires par type, évaluation guidée, validation, tableaux de bord par test, campagnes.",
    tests: true,
    ecrans: ["Connexion", "Partenaires et réglages", "Créer un partenaire", "Évaluation (agent, QR)", "Validation", "Suivi des agences", "Tableau de bord par test", "Campagnes", "Comptes et agences", "Patients", "Console", "Praticien", "Patient / joueur / participant"],
    roles: ["Admin LAMIFI Business", "Admin Yodan", "Console", "Praticien", "Administrateur", "Superviseur principal", "Superviseur adjoint", "Validateur", "Évaluateur", "Patient / participant"],
    maj: "2026-11-18",
  },
  {
    dossier: "lonaci-parcours-jeu-responsable",
    projet: "lonaci",
    titre: "Parcours Jeu responsable",
    description: "Test ICJE du joueur, résultat, puis suivi des dossiers et des appels.",
    ecrans: ["Formulaire", "Résultat", "Tableau de bord", "Historique et journaux internes"],
    roles: ["Joueur", "Lonaci", "YODAN"],
    maj: "2026-11-19",
  },
  {
    dossier: "yodan-business-refonte-ux-v2",
    projet: "yodan-business",
    titre: "LAMIFI Business — refonte UX (v2)",
    description: "Refonte UX et flux de la plateforme SaaS (diagramme du 16/11/2026).",
    ecrans: ["Espaces par rôle", "Dossiers", "Tableaux de bord"],
    maj: "2026-11-16",
  },
  {
    dossier: "bspa-particuliers-parcours-qr-otp",
    projet: "bspa-particuliers",
    titre: "Parcours QR code + OTP",
    description: "Accès par QR code puis code à usage unique (OTP) par e-mail.",
    ecrans: ["QR code", "Vérification OTP"],
    maj: "2026-11-15",
    remplacePar: "bspa-particuliers-campagnes-multi-entreprises",
  },
  {
    dossier: "bspa-particuliers-standalone",
    projet: "bspa-particuliers",
    titre: "Version autonome (connexion + entreprises)",
    description: "Variante autonome : connexion Yodan / RH avec code e-mail et gestion des entreprises.",
    tests: true,
    ecrans: ["Connexion", "Code MFA", "Activation du compte", "Mot de passe oublié", "Entreprises", "Campagnes", "Tableau de bord & participants", "Tableau de bord RH", "Formulaire"],
    roles: ["Médecin Yodan", "RH", "Participant"],
    maj: "2026-11-17",
  },
  {
    dossier: "bspa-particuliers-campagnes-multi-entreprises",
    projet: "bspa-particuliers",
    titre: "Campagnes multi-entreprises",
    description: "Campagnes par entreprise, vue médecin détaillée et tableau de bord RH agrégé.",
    tests: true,
    ecrans: ["Campagnes", "Tableau de bord & participants", "Rapport médecin", "Tableau de bord RH", "Formulaire", "Bilan fermé", "E-mail + rapport"],
    roles: ["Médecin Yodan", "RH", "Participant"],
    maj: "2026-11-17",
  },
  {
    dossier: "yodan-atmp-cnps-graphes-admin-v2",
    projet: "yodan-atmp-cnps",
    titre: "Graphes admin ATMP (v2)",
    description: "Demandes, délais, évolution PCL-5 et comparaison des agences ; effectifs < 5 masqués.",
    tests: true,
    ecrans: ["Tableau de bord"],
    roles: ["Admin"],
    maj: "2026-11-17",
  },
  {
    dossier: "yodan-atmp-cnps-graphes-admin",
    projet: "yodan-atmp-cnps",
    titre: "Graphes admin ATMP",
    remplacePar: "yodan-atmp-cnps-graphes-admin-v2",
    description: "Répartition par zone et décisions de prise en charge dans le temps.",
    ecrans: ["Tableau de bord"],
    roles: ["Admin"],
    maj: "2026-11-13",
  },
  {
    dossier: "yodan-business-refonte-ux",
    projet: "yodan-business",
    titre: "YODAN Business — refonte UX (v1)",
    description: "Première version, référence pour les conventions des maquettes.",
    ecrans: ["Espaces par rôle", "Dossiers", "Tableaux de bord"],
    maj: "2026-11-13",
    remplacePar: "yodan-business-refonte-ux-v2",
    reference: true,
  },
];
