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
  "entreprise-mutuelle": { nom: "Entreprise & Mutuelle", couleur: "#296DA8" },
};

window.MAQUETTES = [
  {
    dossier: "entreprise-mutuelle-plateforme-v2",
    projet: "entreprise-mutuelle",
    titre: "Plateforme Entreprise & Mutuelle (v1.5 : entretien psychologue)",
    description: "Entretien psychologue, rapport et avis, puis décision : aucune prise en charge sans avis validé.",
    tests: true,
    ecrans: ["Connexion", "Parcours participant (3 consentements)", "Clients", "Comptes", "Délais", "Campagnes", "Psychologues", "Mes entretiens", "Fiche d'entretien", "Participants", "Détail", "Validation / décisions", "À prendre en charge", "Historique"],
    roles: ["Participant", "Admin Yodan", "Psychologue", "Assistante sociale", "Médecin-conseil (niveau 1)", "Superviseur secondaire (niveau 2)", "Superviseur principal", "Administrateur"],
    maj: "2026-11-24",
  },
  {
    dossier: "entreprise-mutuelle-plateforme",
    projet: "entreprise-mutuelle",
    titre: "Plateforme Entreprise & Mutuelle (complète)",
    description: "Tous les écrans du cahier des charges v1.4 : clients, campagnes, test BSPA, validation, prise en charge.",
    remplacePar: "entreprise-mutuelle-plateforme-v2",
    tests: true,
    ecrans: ["Connexion", "Parcours participant", "Clients", "Fiche client", "Comptes", "Délais", "Campagnes", "Tableau de bord", "Participants", "Détail", "Validation", "À prendre en charge", "Historique"],
    roles: ["Participant", "Admin Yodan", "Superviseur principal", "Administrateur", "Superviseur secondaire", "Validateur"],
    maj: "2026-11-21",
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
    dossier: "yodan-atmp-cnps-graphes-admin-v2",
    projet: "yodan-atmp-cnps",
    titre: "Graphes admin ATMP (v2)",
    description: "Demandes, délais, évolution PCL-5 et comparaison des agences ; effectifs < 5 masqués.",
    tests: true,
    ecrans: ["Tableau de bord"],
    roles: ["Admin"],
    maj: "2026-11-17",
  },
];
