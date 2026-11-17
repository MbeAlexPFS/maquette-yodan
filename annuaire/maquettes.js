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
    dossier: "lonaci-parcours-jeu-responsable",
    projet: "lonaci",
    titre: "Parcours Jeu responsable",
    description: "Test ICJE côté joueur, page de résultat, puis tableau de bord Lonaci / YODAN avec recherche et pagination des dossiers.",
    ecrans: ["Formulaire", "Résultat", "Tableau de bord"],
    roles: ["Joueur", "Lonaci", "YODAN"],
    maj: "2026-11-17",
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
  },
  {
    dossier: "yodan-atmp-cnps-graphes-admin",
    projet: "yodan-atmp-cnps",
    titre: "Graphes admin ATMP",
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
