/*
 * notes.js : contenu du panneau « Notes UX » (choix de chaque écran, questions à valider, aides de démo).
 */
"use strict";

const N = (title, choix, questions = []) => ({ title, choix, questions });
const SRC = (t) => `<span class="pill bleu">Source</span> ${t}`;
Object.assign(NOTES, {
  "login:login": N("Connexion — page commune", [
    "Version simplifiée, dérivée de « LAMIFI Business — partenaires par type » : types Entreprise et Association / mutuelle seulement, pas de prise en charge dans l'application.",
    "Une seule page de connexion pour tous les profils : le compte mène au bon espace.",
    "Même bandeau que la maquette CNPS (LAMIFI v2) : accroche, phrase « Mesurer, Assister, Piloter et Transformer… », valeurs ACISE en pied.",
    "Parcours : identifiants → code reçu par e-mail → entrer.",
  ]),
  "login:otp": N("Code de vérification", ["Code à 6 chiffres envoyé par e-mail, valable 10 minutes, 5 essais."]),
  "login:password": N("Mot de passe", ["Activation : lien e-mail → code → mot de passe → entrer.", "Admin LAMIFI Business : créé par le seed depuis .env, change son mot de passe à la 1re connexion."]),
  "lamifi:partners": N("Admin LAMIFI Business — partenaires", [
    "Deux types seulement : Entreprise et Association / mutuelle. Les rôles et la campagne sont fixés par le type.",
    "« Rôles » : seul réglage possible, inclure une fonctionnalité d'un rôle dans un autre (badge « inclusions » quand c'est fait).",
    "Nouvelle notation : Superviseur secondaire (ex-Superviseur adjoint).",
  ]),
  "lamifi:create": N("Créer un partenaire", [
    "Un écran court en 3 blocs : partenaire et type, tests et domaines e-mail, premier compte (rôle déduit du type).",
    "Plus de base de données à renseigner (validé) : une base commune à tous les partenaires. Chaque donnée porte l'identifiant du tenant (colonne « Tenant » de la liste) et la base elle-même filtre par tenant.",
    "E-mail professionnel facultatif (désactivé par défaut) : les domaines ne sont demandés que si on l'exige.",
    "Inclusions repliées (facultatif) : on ne les ouvre que si un rôle doit recevoir l'onglet d'un autre rôle.",
  ], ["Faut-il proposer tous les tests aux deux types, ou réserver KARASEK / COPSOQ / WHO-5 aux entreprises ?"]),
  "yodan:dashboard": N("Admin Yodan — tableau de bord", ["Rapport individuel (clic sur une ligne) : « Renvoyer le rapport » par un lien à usage unique (s'ouvre une fois, disparaît à la fermeture, expire en 72 h) ou « Exporter en PDF ».", "Un tableau de bord par test (BSPA, KARASEK, COPSOQ, WHO-5), filtrable par partenaire.", "Yodan voit tout : pas de masquage < 5 et « Détail des évaluations » sous les graphiques ; chaque ouverture de rapport est journalisée."]),
  "yodan:campagnes": N("Admin Yodan — campagnes et participants", [SRC("BSPA — campagnes multi-entreprises."), "Seul l'admin Yodan voit les participants et les taux de réponse."]),
  "yodan:evaluation": N("Admin Yodan — évaluation", [SRC("maquette CNPS (LAMIFI v2) — évaluateur."), "Même parcours que l'Évaluateur : N°, consentements, identité, une question par écran, vérification, résultat."]),
  "yodan:validation": N("Admin Yodan — validation", ["File « À décider » de tous les partenaires (en pratique : la mutuelle, qui fait valider l'orange)."]),
  "yodan:comptes": N("Admin Yodan — comptes", ["Identifiant d'abord, puis rôles ; migration et désactivation ciblées."]),
  "yodan:patients": N("Admin Yodan — à prendre en charge", [
    "La prise en charge se fait <strong>hors de l'application</strong> : cette liste sert à exporter les personnes à prendre en charge, puis à passer leur dossier à « Clos » quand le traitement est fini.",
    "Qui est dans la liste : bilan rouge (ou orange sans validateur) automatiquement ; orange validé par le validateur de la mutuelle.",
    "Export CSV (la liste affichée, sans les dossiers clos) : colonnes limitées au contact et à l'orientation (minimisation), date d'export notée sur chaque dossier, export journalisé.",
    "Fiche : « Renvoyer le rapport » (lien unique) ou « Exporter en PDF » quand la personne demande à revoir son résultat.",
    "Filtre « Jamais exportées » : ce qu'il reste à transmettre. Fiche : appel + retour, consentements, « Passer à Clos » avec un motif (traitement terminé, refus, injoignable) et confirmation.",
  ], ["À qui est envoyé le fichier exporté (praticien, cabinet partenaire) et par quel canal sécurisé ? C'est un transfert de données de santé identifiantes : il faut un contrat de sous-traitance (règle 4.1.6).", "Les colonnes de l'export conviennent-elles ?", "Faut-il pouvoir rouvrir un dossier clos ?"]),
  "yodan:partenaires": N("Admin Yodan — rôles du partenaire", ["Même réglage que dans l'Admin LAMIFI : inclure une fonctionnalité d'un rôle dans un autre. Rien d'autre à configurer."]),
  "partner:dashboard": N("Tableau de bord", [SRC("BSPA — tableau de bord RH ; autres tests : générique."), "Superviseur principal : tout le partenaire. Superviseur secondaire : le même tableau, limité à ses agences.", "Chiffres agrégés uniquement ; un effectif de moins de 5 est masqué."]),
  "partner:campagne": N("Campagnes", [SRC("BSPA."), "Le partenaire crée la campagne et envoie le lien (collage ou CSV) ; il ne voit pas les participants."]),
  "partner:validation": N("Validation", [SRC("maquette CNPS (LAMIFI v2) — validateur."), "« À décider » : liste à gauche, dossier à droite (dimensions, réponses, commentaire), touches O / N.", "« Oui » : la personne apparaît dans la liste « À prendre en charge » de Yodan."]),
  "partner:suivi": N("Superviseur secondaire — suivi des agences", ["Sous-onglets : suivi des dossiers (N° et statut, jamais l'identité), hors délai, équipe."]),
  "partner:evaluation": N("Évaluation", [SRC("maquette CNPS (LAMIFI v2)."), "Disponible seulement si un rôle l'inclut (aucun évaluateur par défaut pour ces deux types)."]),
  "partner:comptes": N("Comptes", ["Identifiants et rôles, agences (nom seulement), recherche de dossier en lecture seule, historique et exports."]),
  "public:choix": N("Participant", ["Parcours publics selon le partenaire choisi dans la barre du haut."]),
  "public:campagne": N("Participant — campagne", [SRC("BSPA — e-mail + code."), "Adresse e-mail (professionnelle seulement si le partenaire l'exige), code à 6 chiffres, consentement, questions par section, informations pour les statistiques.",
    "<strong>Résultat affiché tout de suite à la fin du test</strong>, avec les consentements sur le même écran (être accompagné(e), être recontacté(e)). Aucun e-mail de bilan.",
    "Pour revoir son rapport plus tard, la personne contacte YODAN, qui le renvoie par un lien à usage unique ou l'exporte en PDF."]),
  "public:qr": N("Participant — QR d'un agent", ["Seulement si un rôle du partenaire inclut l'Évaluation."]),
});

Object.assign(NOTES, {
  "lamifi:history": N("Admin LAMIFI — historique", [SRC("application CNPS (AccessLog, onglet Historique du super administrateur)."),
    "Lecture seule. Chaque ligne : date, côté (LAMIFI, YODAN, partenaire, public), partenaire, utilisateur, action (libellé + code technique), dossier, détails non sensibles.",
    "Filtres : partenaire (ou « hors partenaire »), côté, recherche (utilisateur, action, dossier), Du → Au ; 20 lignes par page.",
    "Jamais de contenu de santé : ni réponses, ni profil, ni nom ou e-mail de participant (règle 4.1.4). Un participant apparaît comme « participant », avec le N° de dossier.",
    "Écriture seule : une entrée ne peut être ni modifiée ni supprimée depuis l'application (en production : retirer aussi les droits UPDATE / DELETE au compte SQL, comme noté dans l'app CNPS).",
    "Chaque partenaire ne voit que son propre historique (son tenant, son côté) dans « Comptes → Historique et exports » ; l'admin LAMIFI voit tout."],
    ["Durée de conservation de l'historique : même règle que les dossiers (service central de purge) ?", "Faut-il un export CSV de l'historique pour les audits ?"]),
  "lamifi:logs": N("Admin LAMIFI — journaux internes", [SRC("application CNPS : copie access-jj-mm-aaaa.log, écrite avant la base de données."),
    "Un fichier par jour, une ligne JSON par accès (created_at, user_id, tenant, side, action, evaluation_id, ip, details) : la trace subsiste même si la base est inaccessible.",
    "Base commune : chaque ligne porte le tenant du partenaire concerné.",
    "« Voir » et « Télécharger » sont eux-mêmes journalisés. Les adresses IP de la démo sont fictives (plages réservées à la documentation)."],
    ["Où sont stockés les fichiers en production (disque chiffré, copie hors site par le service central de sauvegarde) et qui peut les télécharger ?"]),
});

/** Aides de démo (affichées dans les notes, jamais dans l'écran de l'application). */
function demoHints() {
  const k = notesKey();
  const common = ["Bouton rond 🛠 en bas à droite : <strong>horloge</strong> et <strong>boîte e-mail</strong> simulée (codes, liens d'activation, invitations). Les e-mails ne contiennent jamais de résultat."];
  if (k.startsWith("login")) return [
    `Mot de passe de démo : <code>${DEMO_PASSWORD}</code>.`,
    `Admin LAMIFI Business (seed .env) : <code>${ENV.LAMIFI_ADMIN_EMAIL}</code> / <code>${ENV.LAMIFI_ADMIN_PASSWORD}</code> → changement de mot de passe obligatoire.`,
    "Admin Yodan : <code>admin.yodan@yodan.exemple.test</code>",
    "Entreprise Alpha : <code>rh@alpha.exemple.test</code> · Entreprise Beta : <code>rh@beta.exemple.test</code>",
    "Mutuelle Horizon : Administrateur <code>admin@horizon.exemple.test</code> · Superviseur principal <code>principal@horizon.exemple.test</code> · Superviseur secondaire <code>secondaire@horizon.exemple.test</code> · Validateur <code>validation@horizon.exemple.test</code>",
    "Activation : e-mail « Activez votre compte » de <code>nouveau.validateur@horizon.exemple.test</code>.", ...common,
  ];
  if (k === "yodan:patients") return ["L'export télécharge un vrai fichier CSV contenant uniquement les données fictives de la démo.", ...common];
  if (k === "public:campagne") return ["Entreprise Alpha exige l'e-mail pro (<code>@alpha.exemple.test</code>, gmail refusé) ; Beta et la mutuelle acceptent toute adresse.", ...common];
  if (k.startsWith("yodan")) return ["Rapport renvoyé : ouvrez l'e-mail « Votre rapport est disponible » dans la boîte 🛠 ; une 2e ouverture du même lien est refusée.", ...common];
  if (k.startsWith("partner")) return ["Changez de partenaire et de rôle dans la barre du haut. Mutuelle : le Superviseur principal a aussi l'onglet Comptes (inclusion d'exemple).", ...common];
  return common;
}
function demoActions() {
  const k = notesKey();
  const acts = [];
  if (k.endsWith(":evaluation") && Object.values(evx).some((s) => s.step === "wizard")) acts.push(["Remplir : vert", () => fillEvaluationDemo("VERT")], ["Remplir : orange", () => fillEvaluationDemo("ORANGE")], ["Remplir : rouge", () => fillEvaluationDemo("ROUGE")]);
  if (k.endsWith(":evaluation") && Object.values(evx).some((s) => s.step === "qr" && !s.result)) acts.push(["Simuler : la personne a terminé", qrPatientDone]);
  if (k.startsWith("public") && ["questions", "form"].includes(pub.step)) acts.push(["Remplir : bien", () => fillPublicDemo(0.1)], ["Remplir : difficile", () => fillPublicDemo(0.9)]);
  if (k === "lamifi:create") acts.push(["Remplir l'exemple", () => {
    Object.assign(cd, { name: "Entreprise Démo Gamma", sector: db.settings.sectors.find((x) => x === "Télécoms et numérique") || db.settings.sectors[0], fa: { name: "RH Gamma Démo", email: "rh@gamma.exemple.test" }, domainsText: "gamma.exemple.test" });
    cd.cfg.campaign.domains = ["gamma.exemple.test"];
    render();
  }]);
  return acts;
}

/* ---------- Métadonnées : secteur d'activité, directions / régions ---------- */
Object.assign(NOTES, {
  "lamifi:sectors": N("Admin LAMIFI — secteurs d'activité", [
    "Liste gérée par l'admin LAMIFI Business, une valeur par ligne ; choisie à la création d'un partenaire (champ obligatoire).",
    "Métadonnée : sert uniquement de filtre (liste des partenaires, barre de l'admin Yodan). Jamais affichée au participant.",
    "Un secteur utilisé par un partenaire ne peut pas être retiré ; doublons ignorés (casse et accents). Réglage tracé dans l'historique (system.sectors).",
  ], ["La liste proposée par défaut convient-elle (10 secteurs) ? Faut-il pouvoir changer le secteur d'un partenaire après sa création ?"]),
  "lamifi:units": N("Admin LAMIFI — directions et régions par défaut", [
    "Deux listes par défaut, gérées par l'admin LAMIFI Business : directions (Entreprise) et structures géographiques (Association / mutuelle, ex. « Région du Centre »).",
    "La liste du type est copiée à la création du partenaire. La modifier ne change pas les partenaires existants.",
    "Réglage tracé (system.unit_defaults).",
  ], ["Faut-il proposer « Je préfère ne pas répondre » (le champ est obligatoire aujourd'hui) ?"]),
  "yodan:listes": N("Admin Yodan — directions et régions des partenaires", [
    "Yodan personnalise seulement la liste de chaque partenaire (les listes par défaut sont chez l'admin LAMIFI).",
    "Le tableau garde tous les partenaires du filtre ; « Modifier » ouvre l'éditeur à droite sans changer le filtre de la barre du haut. Badge « par défaut » ou « personnalisée ».",
    "« Reprendre la liste par défaut » remplit l'éditeur avec la liste LAMIFI du type (à enregistrer).",
    "La liste du partenaire alimente le champ « Direction » / « Région » du questionnaire et le filtre du tableau de bord. Retirer une valeur ne modifie pas les bilans déjà enregistrés. Réglage tracé (system.tenant_units).",
  ], ["Le partenaire doit-il pouvoir gérer lui-même sa liste (ex. son Administrateur), ou seulement Yodan ?"]),
});
NOTES["lamifi:partners"].choix.push("Colonne et filtre « Secteur » ; nombre de directions / régions du partenaire.");
NOTES["lamifi:create"].choix.push("Secteur d'activité obligatoire (liste LAMIFI). Les directions (entreprise) ou régions (mutuelle) par défaut (onglet LAMIFI « Directions et régions ») sont copiées à la création ; l'admin Yodan les personnalise ensuite.");
NOTES["yodan:dashboard"].choix.push("Barre du haut : filtre « Secteur » (limite les partenaires de tous les onglets). Colonne « Direction / région » dans le détail des évaluations.");
NOTES["partner:dashboard"].choix.push("Filtre « Direction » (entreprise) ou « Région » (mutuelle) et groupe correspondant dans « Par groupe » ; une direction / région de moins de 5 bilans est masquée.");
NOTES["public:campagne"].choix.push("Nouveau champ obligatoire « Direction » (entreprise) ou « Région » (mutuelle) dans « Quelques informations », liste du partenaire ; sert uniquement aux statistiques anonymes.");
