/*
 * domain.js : le métier fusionné des maquettes existantes, sur un seul modèle de données.
 *  - CNPS (LAMIFI Business v2 + graphes ATMP v2) : PCL-5, identifiants, blocages, décision, délai de recours,
 *    bons, attestation, séances, suivi PCL-5, pilotage ;
 *  - LONACI (Jouons responsable) : ICJE, catégories de risque, rappel / accompagnement ;
 *  - BSPA (entreprises) : 22 questions, 5 dimensions, profil, campagnes e-mail pro + code.
 * Règle §9 : seuls les FAITS sont stockés ; statuts, files et graphiques sont calculés ici.
 */
"use strict";

/* =====================================================================
 * Tests
 * ===================================================================== */
const ZONES = ["VERT", "ORANGE", "ROUGE"];
const ZONE_LABEL = { VERT: "Vert", ORANGE: "Orange", ROUGE: "Rouge" };
const opts = (labels, start = 0) => labels.map((l, i) => [i + start, l]);
const BSPA_SCALES = {
  A: ["Jamais", "De temps en temps", "Moins de la moitié du temps", "Plus de la moitié du temps", "La plupart du temps", "Tout le temps"],
  B: ["Jamais", "Presque jamais", "Parfois", "Assez souvent", "Très souvent"],
  C: ["Jamais", "Quelques fois par an", "Une fois par mois", "Quelques fois par mois", "Une fois par semaine", "Quelques fois par semaine", "Chaque jour"],
  D: ["Pas du tout d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "Tout à fait d'accord"],
};
const BSPA_SECTIONS = [
  { key: "A", short: "Bien-être", title: "Au cours des deux dernières semaines…", items: ["Je me suis senti(e) de bonne humeur et joyeux(se)", "Je me suis senti(e) calme et détendu(e)", "Je me suis senti(e) actif(ve) et plein(e) d'énergie", "Je me suis réveillé(e) reposé(e) et prêt(e) pour la journée", "Ma vie quotidienne a été remplie de choses qui m'intéressent"].map((t) => ({ t, o: opts(BSPA_SCALES.A) })) },
  { key: "B", short: "Stress", title: "Au cours du dernier mois, à quelle fréquence…", items: ["Vous avez été incapable de contrôler les choses importantes dans votre vie", "Vous vous êtes senti(e) confiant(e) dans votre capacité à gérer vos problèmes", "Vous avez eu l'impression que les choses allaient dans le bon sens pour vous", "Les difficultés ont tellement pesé que vous ne pouviez plus y faire face"].map((t) => ({ t, o: opts(BSPA_SCALES.B) })) },
  { key: "C", short: "Épuisement", title: "Votre ressenti au travail", items: ["Je me sens vidé(e) émotionnellement par mon travail", "Je me sens épuisé(e) en fin de journée de travail", "Le matin, je me sens fatigué(e) à l'idée d'aller travailler", "Mon travail me demande un effort qui me pèse de plus en plus", "J'ai l'impression d'être à bout"].map((t) => ({ t, o: opts(BSPA_SCALES.C) })) },
  { key: "D", short: "Vécu au travail", title: "Votre vécu au travail", items: ["Ma charge de travail quotidienne est raisonnable et gérable", "Je me sens soutenu(e) par mon responsable quand j'en ai besoin", "Mon travail est reconnu à sa juste valeur", "Je trouve du sens dans ce que je fais au quotidien", "Les relations avec mes collègues sont globalement satisfaisantes"].map((t) => ({ t, o: opts(BSPA_SCALES.D, 1) })) },
  { key: "E", short: "Signaux", title: "Quelques questions complémentaires", items: [
    { t: "Dormez-vous suffisamment et vous sentez-vous reposé(e) au réveil la plupart du temps ?", o: opts(["Oui, presque toujours", "Parfois", "Rarement ou jamais"]) },
    { t: "Avez-vous augmenté votre consommation de substances pour tenir (café, alcool, tabac, médicaments) ?", o: opts(["Non, pas de changement", "Légèrement", "Oui, nettement"]) },
    { t: "Traversez-vous actuellement un évènement de vie difficile (deuil, séparation, maladie, difficultés financières) ?", o: opts(["Non", "Oui, mais je le gère bien", "Oui, cela m'affecte fortement"]) }] },
];
const BSPA_DIMS = ["A", "B", "C", "D", "E"];
const BSPA_DIM_LABEL = { A: "Bien-être (WHO-5)", B: "Stress perçu (PSS-4)", C: "Épuisement (MBI-EE)", D: "Vécu au travail (QVT-5)", E: "Signaux d'alerte" };
const simpleItems = (qs, scale) => qs.map((t) => ({ t, o: opts(scale) }));
const PCL5_SCALE = ["Pas du tout", "Un peu", "Modérément", "Beaucoup", "Extrêmement"];
const ICJE_CATS = ["Sans risque", "À faible risque", "À risque modéré", "Jeu excessif"];

/** Chaque test : questions (items avec leurs choix), calcul, libellés de résultat. */
const TESTS = {
  "PCL-5": {
    label: "PCL-5", desc: "Stress post-traumatique", intro: "Au cours du dernier mois, à quel point avez-vous été dérangé(e) par…", max: 80,
    items: simpleItems(["Des souvenirs répétés, pénibles et involontaires de l'expérience stressante", "Des rêves répétés et pénibles de l'expérience stressante", "Se sentir ou agir soudainement comme si l'expérience stressante se reproduisait", "Se sentir très bouleversé(e) quand quelque chose rappelle l'expérience stressante", "De fortes réactions physiques quand quelque chose rappelle l'expérience stressante (cœur qui bat fort, souffle court, sueurs)", "Éviter les souvenirs, pensées ou sentiments liés à l'expérience stressante", "Éviter les personnes, lieux ou situations qui la rappellent", "Des difficultés à vous rappeler des éléments importants de l'expérience stressante", "Des croyances négatives sur vous-même, les autres ou le monde", "Vous blâmer ou blâmer quelqu'un d'autre pour l'expérience stressante", "Des sentiments négatifs intenses (peur, horreur, colère, culpabilité, honte)", "Une perte d'intérêt pour des activités que vous aimiez auparavant", "Vous sentir distant(e) ou coupé(e) des autres", "Avoir du mal à éprouver des sentiments positifs", "Un comportement irritable, des crises de colère ou des gestes agressifs", "Prendre des risques ou faire des choses qui pourraient vous mettre en danger", "Être « super en alerte », sur vos gardes", "Sursauter facilement", "Des difficultés à vous concentrer", "Des difficultés à vous endormir ou à rester endormi(e)"], PCL5_SCALE),
    /** Seuils de l'application CNPS : ≤ 42 vert, 43–50 orange, ≥ 51 rouge. */
    score: (a) => { const s = a.reduce((x, y) => x + y, 0); return { score: s, zone: s <= 42 ? "VERT" : s <= 50 ? "ORANGE" : "ROUGE" }; },
    zoneText: { VERT: ["Sous le seuil d'alerte", "Vos réponses ne montrent pas de signe important de stress post-traumatique. Si quelque chose change, vous pouvez refaire le point."], ORANGE: ["Symptômes modérés", "Vos réponses montrent des signes de stress à surveiller. Un professionnel peut vous aider à y voir plus clair."], ROUGE: ["Symptômes significatifs", "Vos réponses montrent des signes importants. Un accompagnement par un psychologue est recommandé."] },
  },
  ICJE: {
    label: "ICJE", desc: "Jeu excessif (Jouons responsable)", intro: "Au cours des douze derniers mois…", max: 27,
    items: simpleItems(["Avez-vous misé plus d'argent que vous pouviez vous permettre de perdre ?", "Avez-vous besoin de miser de plus en plus d'argent pour avoir la même excitation ?", "Avez-vous rejoué une autre journée pour récupérer l'argent que vous aviez perdu en jouant ?", "Avez-vous vendu ou emprunté quelque chose pour obtenir de l'argent pour jouer ?", "Avez-vous déjà senti que vous aviez peut-être un problème avec le jeu ?", "Le jeu a-t-il causé chez vous des problèmes de santé, y compris du stress ou de l'angoisse ?", "Des personnes ont-elles critiqué vos habitudes de jeu ou dit que vous aviez un problème avec le jeu ?", "Vos habitudes de jeu ont-elles causé des difficultés financières à vous ou à votre entourage ?", "Vous êtes-vous déjà senti coupable de vos habitudes de jeu ou de ce qui arrive quand vous jouez ?"], ["Jamais", "Parfois", "La plupart du temps", "Presque toujours"]),
    /** Catégories ICJE : 0 sans risque, 1–2 faible, 3–7 modéré, 8+ excessif. */
    score: (a) => { const s = a.reduce((x, y) => x + y, 0); const cat = s === 0 ? 0 : s <= 2 ? 1 : s <= 7 ? 2 : 3; return { score: s, cat, zone: cat <= 1 ? "VERT" : cat === 2 ? "ORANGE" : "ROUGE" }; },
    zoneText: { VERT: ["À faible risque", "Votre score indique un faible risque. Restez attentif à vos habitudes de jeu et fixez-vous des limites claires."], ORANGE: ["À risque modéré", "Votre score indique un risque modéré. Il peut être utile d'en parler et de mettre en place des stratégies pour reprendre le contrôle."], ROUGE: ["Jeu excessif", "Votre score suggère un risque élevé de jeu problématique. Nous vous recommandons fortement de demander de l'aide et de ne pas rester seul(e) avec cette situation."] },
  },
  BSPA: {
    label: "BSPA", desc: "Bilan de santé psychologique", intro: "", max: 100, sections: BSPA_SECTIONS,
    items: BSPA_SECTIONS.flatMap((s) => s.items.map((it) => ({ ...it, section: s.key }))),
    /** Calcul simplifié repris de la maquette BSPA (les vrais seuils restent dans bspa_core.py). */
    score: (a) => {
      const keys = BSPA_SECTIONS.flatMap((s) => s.items.map((_, i) => `${s.key}${i}`));
      const v = (k, i) => Number(a[keys.indexOf(`${k}${i}`)] ?? 0);
      const sum = (k, n) => Array.from({ length: n }, (_, i) => v(k, i)).reduce((x, y) => x + y, 0);
      const A = sum("A", 5) * 4, B = v("B", 0) + (4 - v("B", 1)) + (4 - v("B", 2)) + v("B", 3), C = sum("C", 5), Dd = sum("D", 5), E = sum("E", 3);
      const strong = [0, 1, 2].some((i) => v("E", i) === 2);
      const dims = {
        A: { pct: A, zone: A >= 68 ? "VERT" : A >= 51 ? "ORANGE" : "ROUGE" },
        B: { pct: Math.round((B / 16) * 100), zone: B <= 7 ? "VERT" : B <= 11 ? "ORANGE" : "ROUGE" },
        C: { pct: Math.round((C / 30) * 100), zone: C <= 8 ? "VERT" : C <= 14 ? "ORANGE" : "ROUGE" },
        D: { pct: Math.round(((Dd - 5) / 20) * 100), zone: Dd >= 20 ? "VERT" : Dd >= 13 ? "ORANGE" : "ROUGE" },
        E: { pct: Math.round((E / 6) * 100), zone: strong ? "ROUGE" : E <= 1 ? "VERT" : "ORANGE" },
      };
      const reds = ["A", "B", "C", "D"].filter((k) => dims[k].zone === "ROUGE").length;
      const pts = Object.values(dims).reduce((s, x) => s + ZONES.indexOf(x.zone), 0);
      const zone = strong || reds >= 2 ? "ROUGE" : reds === 1 || pts >= 3 ? "ORANGE" : "VERT";
      return { score: 100 - Math.round(pts * 10), zone, dims };
    },
    zoneText: { VERT: ["Satisfaisant", "Aucune action particulière requise à ce stade."], ORANGE: ["Vigilance", "Une vigilance est recommandée ; un entretien de bilan est conseillé."], ROUGE: ["À prendre en charge", "Un entretien avec un professionnel est recommandé sans délai."] },
  },
};
const genericTest = (label, desc, intro, qs, scale) => ({
  label, desc, intro, max: 100, items: simpleItems(qs, scale),
  score: (a) => { const s = Math.round((a.reduce((x, y) => x + y, 0) / (a.length * 3)) * 100); return { score: s, zone: s < 34 ? "VERT" : s < 67 ? "ORANGE" : "ROUGE" }; },
  zoneText: { VERT: ["Satisfaisant", "Pas de signal particulier."], ORANGE: ["Vigilance", "Quelques signaux à surveiller ; un échange peut aider."], ROUGE: ["À surveiller", "Plusieurs signaux importants ; un professionnel peut vous accompagner."] },
});
TESTS.KARASEK = genericTest("KARASEK", "Contraintes et latitude au travail", "Dans votre travail actuel…", ["Je dois travailler très vite", "Je reçois des ordres contradictoires", "Je manque de marge pour décider", "Je manque de soutien de mon équipe"], ["Pas du tout d'accord", "Pas d'accord", "D'accord", "Tout à fait d'accord"]);
TESTS.COPSOQ = genericTest("COPSOQ", "Risques psychosociaux", "Au cours des 4 dernières semaines…", ["Ma charge de travail est trop lourde", "Mon travail empiète sur ma vie privée", "Je me sens peu reconnu(e)", "Je m'inquiète pour mon emploi"], ["Jamais", "Parfois", "Souvent", "Toujours"]);
TESTS["WHO-5"] = genericTest("WHO-5", "Bien-être", "Au cours des deux dernières semaines…", ["Je ne me suis pas senti(e) de bonne humeur", "Je ne me suis pas senti(e) calme", "Je ne me suis pas senti(e) plein(e) d'énergie", "Ma vie quotidienne ne m'a pas intéressé(e)"], ["Jamais", "Parfois", "Souvent", "Tout le temps"]);
const TEST_KEYS = Object.keys(TESTS);
const ENTREPRISE_TESTS = ["BSPA", "KARASEK", "COPSOQ", "WHO-5"];
/** Résultat d'un test (score, zone, et catégorie ICJE ou dimensions BSPA). */
function scoreTest(test, answers) {
  const T = TESTS[test];
  if (!T || !Array.isArray(answers) || answers.length !== T.items.length || answers.some((a, i) => !T.items[i].o.some(([v]) => v === a))) return null;
  return T.score(answers);
}
const zoneTitle = (test, res) => (test === "ICJE" && res.cat === 0 ? "Sans risque" : TESTS[test].zoneText[res.zone][0]);
const scoreText = (test, s) => (test === "PCL-5" ? `${s}/80` : test === "ICJE" ? `${s}/27` : `${s}`);
const FOLLOW_UP_DAYS = 60, PCL5_CHANGE = 10, DECISION_DAYS = 7, LATE_DAYS = 3, ATTESTATION_MONTHS = 3;

/* =====================================================================
 * Réglages métier par type (identifiants, questionnaire général, bilan, agences)
 * Repris de l'admin système de LAMIFI v2 ; modifiables ensuite dans « Réglages » (Admin LAMIFI).
 * ===================================================================== */
const SELECT = (key, label, options, extra = {}) => ({ key, label, type: "select", options, pii: false, required: true, level: "person", ...extra });
const LONACI_VILLES = ["Abidjan", "Bouaké", "Daloa", "Korhogo", "Man", "San-Pédro", "Yamoussoukro", "Gagnoa", "Abengourou", "Autre ville"];
const LONACI_COMMUNES = ["Abobo", "Adjamé", "Cocody", "Koumassi", "Marcory", "Plateau", "Port-Bouët", "Treichville", "Yopougon"];
const LONACI_PLATS = ["Loto Bonheur", "PMU", "SportCash", "Scratch", "Jeux virtuels", "Autre plateforme"];
const LONACI_CANAUX = ["Campagne nationale 2026", "Au point de vente", "Autres"];
const CNPS_AGENTS = ["Chute de hauteur", "Machine / outil", "Véhicule", "Manutention", "Agression", "Autre"];
const CNPS_SITUATIONS = ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"];
const CNPS_VILLES = ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Daloa", "Korhogo"];
const BSPA_DEMO = [SELECT("genre", "Genre", ["Femme", "Homme", "Je préfère ne pas répondre"]), SELECT("tranche_age", "Tranche d'âge", ["18-25 ans", "26-35 ans", "36-45 ans", "46-55 ans", "56 ans et +"]), SELECT("anciennete", "Ancienneté", ["Moins d'1 an", "1 à 5 ans", "6 à 10 ans", "Plus de 10 ans"], { required: false })];
const DOMAIN_PRESETS = {
  CNPS: {
    idLabels: ["N° d'immatriculation", "N° de sinistre"],
    fields: [
      { key: "nom", label: "Nom", type: "text", pii: true, required: true, level: "person" }, { key: "prenom", label: "Prénom", type: "text", pii: true, required: true, level: "person" },
      SELECT("sexe", "Sexe", ["Femme", "Homme"]), { key: "naissance", label: "Date de naissance", type: "date", pii: true, required: true, level: "person" },
      { key: "telephone", label: "Téléphone", type: "tel", pii: true, required: false, level: "person" },
      SELECT("situation", "Situation matrimoniale", CNPS_SITUATIONS, { required: false }), SELECT("ville", "Ville", CNPS_VILLES),
      SELECT("type_sinistre", "Type de sinistre", ["Accident du travail", "Maladie professionnelle"], { level: "case" }),
      { key: "date_accident", label: "Date de l'accident", type: "date", pii: false, required: true, level: "case" }, SELECT("agent", "Agent matériel", CNPS_AGENTS, { level: "case" }),
    ],
    consents: [
      { id: "traitement", moment: "pre", required: true, label: "J'accepte que mes réponses soient traitées de façon confidentielle pour évaluer mon besoin d'accompagnement" },
      { id: "callback", moment: "post", zones: ["ORANGE", "ROUGE"], label: "J'accepte d'être recontacté(e) par un psychologue" },
      { id: "sms", moment: "post", zones: ZONES, label: "J'accepte de recevoir des conseils par SMS" },
    ],
    links: [{ label: "Ligne d'écoute (numéro fictif)", url: "https://exemple.ci/ecoute", zones: ["ORANGE", "ROUGE"] }, { label: "Conseils pour mieux dormir", url: "https://exemple.ci/sommeil", zones: ["VERT", "ORANGE"] }],
  },
  LONACI: {
    idLabels: ["N° de téléphone"],
    fields: [
      { key: "email", label: "E-mail", type: "email", pii: true, required: false, level: "person" }, SELECT("ville", "Ville", LONACI_VILLES), SELECT("commune", "Commune", LONACI_COMMUNES, { showIf: ["ville", "Abidjan"] }),
      { key: "age", label: "Âge", type: "number", min: 18, max: 120, pii: false, required: true, level: "person" }, SELECT("sexe", "Sexe", ["Homme", "Femme"]),
      SELECT("plateforme", "Plateforme de jeux préférée", LONACI_PLATS), SELECT("canal", "Où avez-vous entendu parler du jeu responsable ?", LONACI_CANAUX),
    ],
    consents: [
      { id: "traitement", moment: "pre", required: true, label: "J'accepte que mes données soient traitées dans le cadre de ce questionnaire, conformément à la politique de confidentialité" },
      { id: "callback", moment: "post", zones: ["ORANGE", "ROUGE"], label: "Je souhaite être appelé(e) par un conseiller" },
      { id: "support", moment: "post", zones: ["ROUGE"], label: "Je souhaite être accompagné(e) par un professionnel" },
    ],
    links: [{ label: "Ligne d'aide jeu responsable (numéro fictif)", url: "https://exemple.ci/jeu-responsable", zones: ["ORANGE", "ROUGE"] }, { label: "Conseils pour garder le jeu un plaisir", url: "https://exemple.ci/conseils-jeu", zones: ["VERT", "ORANGE"] }],
  },
  BSPA: {
    idLabels: ["E-mail professionnel"],
    fields: [{ key: "prenom", label: "Prénom", type: "text", pii: true, required: true, level: "person" }, { key: "nom", label: "Nom", type: "text", pii: true, required: true, level: "person" }, ...BSPA_DEMO],
    consents: [
      { id: "traitement", moment: "pre", required: true, label: "J'accepte que mes réponses produisent mon bilan personnel et des statistiques anonymes pour mon organisation" },
      { id: "support", moment: "post", zones: ["ORANGE", "ROUGE"], label: "J'accepte d'être accompagné(e) par un professionnel" },
    ],
    links: [{ label: "Conseils pour garder l'équilibre", url: "https://exemple.ci/equilibre", zones: ["VERT", "ORANGE"] }],
  },
};
DOMAIN_PRESETS.ENTREPRISE = DOMAIN_PRESETS.BSPA;
DOMAIN_PRESETS.MUTUELLE = { ...DOMAIN_PRESETS.BSPA, idLabels: ["E-mail"] };
DOMAIN_PRESETS.PERSO = { idLabels: ["N° de dossier"], fields: [SELECT("sexe", "Sexe", ["Femme", "Homme"]), SELECT("tranche_age", "Tranche d'âge", ["18-25 ans", "26-35 ans", "36-45 ans", "46 ans et +"])], consents: DOMAIN_PRESETS.BSPA.consents, links: [] };
/** Options d'agence (v2 « Agences et options ») : délai de recours, zones décidées par un validateur, QR ouvert. */
const agencyDefaults = (name, over = {}) => ({ name, appealDays: 7, validateZones: ["ORANGE"], qrAllowed: true, qrActive: true, ...over });
/** Sans validateur (LONACI, Entreprise) : orange et rouge partent directement chez Yodan, qui recueille l'accord par téléphone. */
const AGENCY_PRESET = { LONACI: { validateZones: [], appealDays: 0 }, ENTREPRISE: { validateZones: [], appealDays: 0 }, MUTUELLE: { appealDays: 0 } };
function domainDefaults(type, agencies) {
  const d = JSON.parse(JSON.stringify(DOMAIN_PRESETS[type] || DOMAIN_PRESETS.PERSO));
  return { idLabels: d.idLabels, fields: d.fields, consents: d.consents, links: d.links, agencyOpts: agencies.map((a) => agencyDefaults(a, AGENCY_PRESET[type])), sqlAnon: true };
}
const agencyOpt = (p, name) => p.agencyOpts.find((a) => a.name === name) || agencyDefaults(name);
/** Un rôle actif du partenaire porte-t-il la validation ? Sinon, c'est l'admin Yodan qui décide et appelle. */
const partnerValidates = (p) => hasFeature(p, "validation");
const consentsOf = (p, moment, zone = null) => p.consents.filter((c) => c.moment === moment && (!zone || !c.zones || c.zones.includes(zone)));

/* =====================================================================
 * Personnes (coffre identité) et recherche de dossier (DossierLookup de l'app CNPS)
 * ===================================================================== */
const peopleOf = (partnerId) => db.people.filter((x) => x.partnerId === partnerId);
const normId = (s) => norm(String(s ?? "").replace(/\s+/g, ""));
const findPerson = (partnerId, id1) => peopleOf(partnerId).find((x) => normId(x.id1) === normId(id1));
const displayName = (person) => (person ? `${person.identity.prenom || ""} ${person.identity.nom || ""}`.trim() || person.id1 : "—");
const evalsOfPerson = (personId) => db.evaluations.filter((e) => e.personId === personId).sort((a, b) => a.date.localeCompare(b.date));
const openPatientOf = (personId) => db.patients.find((x) => x.personId === personId && !x.closedAt);
/**
 * Avant une évaluation : nouvelle personne, personne connue, test de suivi, ou blocage (avec la raison).
 * @returns {{path:"new"|"known"|"followup", person?, patient?, blocker?:string}}
 */
function lookupDossier(partnerId, id1) {
  const person = findPerson(partnerId, id1);
  if (!person) return { path: "new" };
  const evs = evalsOfPerson(person.id);
  const pending = evs.find((e) => outcomeOf(e) === "PENDING");
  if (pending) return { path: "known", person, blocker: `Une évaluation attend déjà une décision (dossier ${pending.dossier}).` };
  const pt = openPatientOf(person.id);
  if (pt && pt.availableAt > todayIso()) return { path: "known", person, blocker: `Décision en délai de recours jusqu'au ${fmtDate(pt.availableAt)}.` };
  if (pt && patientStatus(pt) === "EN_COURS") {
    const last = evs.at(-1);
    const next = addDays(last.date, FOLLOW_UP_DAYS);
    if (next > todayIso()) return { path: "followup", person, patient: pt, blocker: `Test de suivi pas encore possible : prochain à partir du ${fmtDate(next)}.` };
    return { path: "followup", person, patient: pt };
  }
  if (pt) return { path: "known", person, blocker: `Un dossier de prise en charge est déjà ouvert (${pt.dossier}, ${PEC_STATUS[patientStatus(pt)][1].toLowerCase()}).` };
  return { path: "known", person };
}

/* =====================================================================
 * Évaluations et décisions
 * ===================================================================== */
const MODE_LABEL = { agent: "Avec le patient", qr: "QR code (agent)", qr_ouvert: "QR ouvert (affiche)", site: "Site Jouons responsable", campagne: "Campagne" };
let dossierSeq = 0;
/**
 * Enregistre une évaluation. Identité → coffre identité (people) ; le dossier clinique ne garde que personId.
 * Suivi (kind « Suivi ») : rattaché à la prise en charge, sans décision.
 */
function recordEvaluation(input) {
  const { partnerId, test, ids = {}, agency, identity = {}, profile = {}, answers, consentsPre = {}, consentsPost = {}, mode = "agent", by = null, campaignId = null, date = todayIso() } = input;
  const p = partnerOf(partnerId);
  if (!p) return { ok: false, err: "Partenaire inconnu." };
  if (!p.tests.includes(test)) return { ok: false, err: "Ce test n'est pas activé pour ce partenaire." };
  const res = scoreTest(test, answers);
  if (!res) return { ok: false, err: "Répondez à toutes les questions." };
  if (consentsOf(p, "pre").some((c) => c.required && !consentsPre[c.id])) return { ok: false, err: "Le consentement obligatoire n'est pas donné." };
  if (!String(ids.id1 ?? "").trim()) return { ok: false, err: `${p.idLabels[0]} obligatoire.` };
  // Parcours libres (campagne, site Jouons responsable) : chaque passage est un nouveau bilan, sans blocage d'agent.
  const selfService = ["campagne", "site"].includes(mode);
  const found = findPerson(partnerId, ids.id1);
  const look = selfService ? (found ? { path: "known", person: found } : { path: "new" }) : lookupDossier(partnerId, ids.id1);
  if (look.blocker) return { ok: false, err: look.blocker };
  let person = look.person;
  if (!person) {
    person = { id: newId("ps"), partnerId, pseudo: `PS-${(hash(`${partnerId}${ids.id1}${idSeq}`) % 90000) + 10000}`, id1: String(ids.id1).trim(), identity: {} };
    db.people.push(person);
  }
  Object.entries(identity).forEach(([k, v]) => { if (v !== "" && v != null) person.identity[k] = v; });
  const kind = look.path === "followup" ? "Suivi" : "Initiale";
  const ev = {
    id: newId("ev"), partnerId, test, personId: person.id, id2: ids.id2 || "", agency: agency || p.agencies[0], kind, mode, by, campaignId, date,
    dossier: `${p.slug.slice(0, 3).toUpperCase()}-${String(1000 + ++dossierSeq * 7).padStart(5, "0")}`,
    answers: [...answers], score: res.score, zone: res.zone, cat: res.cat ?? null, dims: res.dims || null,
    profile: { ...profile }, consentsPre: { ...consentsPre, version: "v1.0" }, consentsPost: {}, decision: null, decidedAt: null, decidedBy: null, comment: "",
    patientId: look.path === "followup" ? look.patient.id : null,
  };
  db.evaluations.push(ev);
  if (kind === "Initiale" && acceptsCare(ev) && !openPatientOf(person.id)) createPatient(ev);
  if (Object.keys(consentsPost).length) setPostConsents(ev.id, consentsPost);
  return { ok: true, evaluation: ev, path: look.path };
}
/** Post-consentements (proposés avec le résultat) : être rappelé(e), être accompagné(e)… */
function setPostConsents(evId, values) {
  const ev = evaluationOf(evId);
  const p = partnerOf(ev.partnerId);
  consentsOf(p, "post", ev.zone).forEach((c) => { if (c.id in values) ev.consentsPost[c.id] = !!values[c.id]; });
  const pt = db.patients.find((x) => x.evalId === ev.id);
  if (pt && pt.accord === null && ev.consentsPost.support) pt.accord = true;
  return true;
}
/** Issue d'une évaluation initiale : automatique, ou décision d'un validateur selon les zones de l'agence. */
function outcomeOf(ev) {
  if (ev.kind === "Suivi") return "SUIVI";
  if (ev.zone === "VERT") return "AUTO_NO";
  const validated = agencyOpt(partnerOf(ev.partnerId), ev.agency).validateZones.includes(ev.zone);
  if (!validated) return "AUTO_YES";
  return ev.decision || "PENDING";
}
const OUTCOME_LABEL = { AUTO_NO: "Pas de prise en charge (auto)", AUTO_YES: "Prise en charge (auto)", YES: "Prise en charge", NO: "Pas de prise en charge", PENDING: "À décider", SUIVI: "Test de suivi" };
const OUTCOME_PILL = { AUTO_NO: "gris", AUTO_YES: "vert", YES: "vert", NO: "rouge", PENDING: "jaune", SUIVI: "bleu" };
const acceptsCare = (ev) => ["AUTO_YES", "YES"].includes(outcomeOf(ev));
const decisionDeadline = (ev) => addDays(ev.date, DECISION_DAYS);
const isLate = (ev) => outcomeOf(ev) === "PENDING" && Date.parse(todayIso()) - Date.parse(ev.date) > LATE_DAYS * DAY;
function decide(evId, yes, { by = null, comment = "" } = {}) {
  const ev = evaluationOf(evId);
  if (!ev || outcomeOf(ev) !== "PENDING") return false;
  Object.assign(ev, { decision: yes ? "YES" : "NO", decidedAt: todayIso(), decidedBy: by, comment: String(comment).slice(0, 300) });
  audit("Décision", `${ev.dossier} : ${yes ? "oui" : "non"}`);
  if (yes) createPatient(ev);
  return true;
}
const pendingDecisions = (pids) => db.evaluations.filter((e) => pids.includes(e.partnerId) && outcomeOf(e) === "PENDING").sort((a, b) => a.date.localeCompare(b.date));

/* =====================================================================
 * Prise en charge
 * Statuts : En attente · Pas de bon (type bon) · Budget atteint (type budget) · Prise en charge en cours · Clos
 * ===================================================================== */
const PEC_STATUS = { EN_ATTENTE: ["bleu", "En attente"], PAS_DE_BON: ["orange", "Pas de bon"], BUDGET_ATTEINT: ["orange", "Budget atteint"], EN_COURS: ["vert", "Prise en charge en cours"], CLOS: ["gris", "Clos"] };
const statusesFor = (mode) => ["EN_ATTENTE", mode === "bon" ? "PAS_DE_BON" : "BUDGET_ATTEINT", "EN_COURS", "CLOS"];
function createPatient(ev) {
  if (db.patients.some((x) => x.evalId === ev.id)) return null;
  const p = partnerOf(ev.partnerId);
  const start = ev.decidedAt || ev.date;
  const pt = {
    id: newId("pa"), evalId: ev.id, partnerId: ev.partnerId, personId: ev.personId, dossier: ev.dossier, createdAt: start,
    // Délai de recours de l'agence après une décision du validateur.
    availableAt: ev.decision === "YES" ? addDays(start, agencyOpt(p, ev.agency).appealDays) : start,
    // Type bon : la prise en charge est financée par le bon. Type budget : l'accord du patient est recueilli par téléphone.
    accord: p.pec.mode === "bon" || ev.consentsPost.support ? true : null, accordCalls: 0,
    bons: [], budgets: p.pec.mode === "budget" ? 1 : 0, transferredAt: null, practitionerId: null, assignedAt: null, attestation: null, sessions: [], closedAt: null, closedReason: "", calls: [],
  };
  db.patients.push(pt);
  return pt;
}
const consumedOf = (pt) => pt.sessions.filter((s) => s.status === "PRESENT").length;
function capacityOf(pt) { const p = partnerOf(pt.partnerId); return (p.pec.mode === "bon" ? pt.bons.length : pt.budgets) * p.pec.max; }
function patientStatus(pt) {
  const p = partnerOf(pt.partnerId);
  if (pt.closedAt) return "CLOS";
  if (consumedOf(pt) >= capacityOf(pt)) return p.pec.mode === "bon" ? "PAS_DE_BON" : "BUDGET_ATTEINT";
  if (!pt.practitionerId) return "EN_ATTENTE";
  return "EN_COURS";
}
const inAppeal = (pt) => pt.availableAt > todayIso();
/** Admin Yodan : « Prise en charge » = le dossier est transmis à la Console pour l'attribution d'un praticien. */
const canTakeCharge = (pt) => patientStatus(pt) === "EN_ATTENTE" && pt.accord === true && !inAppeal(pt) && !pt.transferredAt;
/** Console : attribution d'un praticien aux dossiers transmis par l'admin Yodan. */
const canAssign = (pt) => patientStatus(pt) === "EN_ATTENTE" && pt.accord === true && !inAppeal(pt) && !!pt.transferredAt;
function transferToConsole(ptId) {
  const pt = patientOf(ptId);
  if (!pt || !canTakeCharge(pt)) return false;
  pt.transferredAt = todayIso();
  audit("Prise en charge (transmis à la Console)", pt.dossier);
  return true;
}
const canUnlock = (pt) => (patientStatus(pt) === "PAS_DE_BON" && !inAppeal(pt)) || patientStatus(pt) === "BUDGET_ATTEINT";
const canDepositBon = (pt) => partnerOf(pt.partnerId).pec.mode === "bon" && patientStatus(pt) === "PAS_DE_BON" && !inAppeal(pt);
/** Ce qui bloque la prise en charge, en clair (pour les files et les fiches). */
function waitingReason(pt) {
  const s = patientStatus(pt);
  if (s === "CLOS") return pt.closedReason || "Prise en charge close";
  if (inAppeal(pt)) return `Délai de recours jusqu'au ${fmtDate(pt.availableAt)}`;
  if (pt.accord === null) return "Accord du patient à recueillir";
  if (s === "PAS_DE_BON") return pt.bons.length ? "Bon consommé : nouveau bon attendu" : "Bon de prise en charge attendu";
  if (s === "BUDGET_ATTEINT") return "Budget consommé : déblocage attendu";
  if (s === "EN_ATTENTE") return pt.transferredAt ? "Praticien à attribuer (Console)" : "Prise en charge à valider (admin Yodan)";
  return `${consumedOf(pt)} / ${capacityOf(pt)} consultations`;
}
/** Bon de prise en charge déposé par le partenaire (Superviseur adjoint) : fichier PDF / image. */
function depositBon(ptId, file = "bon.pdf") {
  const pt = patientOf(ptId);
  if (!pt || !canDepositBon(pt)) return false;
  pt.bons.push({ at: todayIso(), file });
  audit("Dépôt bon de prise en charge", pt.dossier);
  return true;
}
/** Débloquer (admin Yodan) : enregistre le bon reçu (type bon) ou ouvre un nouveau budget (type budget). */
function unlockPatient(ptId) {
  const pt = patientOf(ptId);
  if (!pt || !canUnlock(pt)) return false;
  if (partnerOf(pt.partnerId).pec.mode === "bon") pt.bons.push({ at: todayIso(), file: "bon-recu-par-yodan.pdf" }); else pt.budgets++;
  audit("Déblocage prise en charge", pt.dossier);
  return true;
}
/** Accord du patient (type budget) : accepte, refuse (dossier clos) ou injoignable (nouvelle tentative). */
function recordAccord(ptId, outcome) {
  const pt = patientOf(ptId);
  if (!pt || pt.accord !== null || pt.closedAt) return false;
  if (outcome === "ACCEPTE") pt.accord = true;
  else if (outcome === "REFUSE") { pt.accord = false; pt.closedAt = todayIso(); pt.closedReason = "Refus du patient"; }
  else pt.accordCalls++;
  audit("Accord patient", `${pt.dossier} : ${outcome}`);
  return true;
}
const accordQueue = (pids) => db.patients.filter((x) => pids.includes(x.partnerId) && x.accord === null && !x.closedAt && !inAppeal(x));
/**
 * Prise en charge par Yodan : praticien (agenda en place obligatoire) + attestation (en ligne ou présentiel, 3 mois).
 * @param {{kind:"ONLINE"|"IN_PERSON", agency?:string, until?:string}} att
 */
function assignPractitioner(ptId, prId, att = { kind: "ONLINE" }) {
  const pt = patientOf(ptId), pr = practitionerOf(prId);
  if (!pt || !pr || !pr.active || !hasAgenda(pr) || !canAssign(pt)) return false;
  const p = partnerOf(pt.partnerId);
  pt.practitionerId = prId;
  pt.assignedAt = todayIso();
  pt.attestation = { kind: att.kind === "IN_PERSON" ? "IN_PERSON" : "ONLINE", agency: att.kind === "IN_PERSON" ? (att.agency || evaluationOf(pt.evalId).agency) : null, until: att.until || addDays(todayIso(), ATTESTATION_MONTHS * 30), token: tokenOf(pt.dossier), at: todayIso(), partner: p.name };
  audit("Attribution praticien + attestation", `${pt.dossier} → ${pr.name}`);
  return true;
}
const SESSION_STATUS = { PRESENT: ["vert", "Présent"], POSTPONED: ["jaune", "Reporté"], ABSENT: ["rouge", "Absent"] };
/** Séance du jour enregistrée par le praticien (présent, reporté, absent). Seules les présences consomment le bon / budget. */
function recordSession(ptId, status = "PRESENT", date = todayIso()) {
  const pt = patientOf(ptId);
  if (!pt || patientStatus(pt) !== "EN_COURS" || !SESSION_STATUS[status]) return false;
  pt.sessions.push({ date, status, practitionerId: pt.practitionerId, report: status === "PRESENT" });
  audit("Séance", `${pt.dossier} : ${SESSION_STATUS[status][1]}`);
  return true;
}
const addConsultation = (ptId, date) => recordSession(ptId, "PRESENT", date);
/** Pointage d'une séance prévue (agenda du praticien). Une présence au-delà de la capacité est refusée. */
function markSession(ptId, index, status) {
  const pt = patientOf(ptId), s = pt?.sessions[index];
  if (!s || s.status || !SESSION_STATUS[status] || s.date > todayIso()) return false;
  if (status === "PRESENT" && consumedOf(pt) >= capacityOf(pt)) return false;
  Object.assign(s, { status, report: status === "PRESENT" });
  audit("Séance", `${pt.dossier} : ${SESSION_STATUS[status][1]}`);
  return true;
}
const sessionsToday = (prId) => db.patients.flatMap((pt) => pt.sessions.map((s, i) => ({ pt, s, i }))).filter(({ s }) => s.practitionerId === prId && s.date === todayIso());
function closePatient(ptId, reason = "Fin de prise en charge") {
  const pt = patientOf(ptId);
  if (!pt || !pt.practitionerId || pt.closedAt) return false;
  pt.closedAt = todayIso(); pt.closedReason = reason;
  audit("Clôture prise en charge", pt.dossier);
  return true;
}
const CALL_OUTCOMES = { JOINT_ACCEPTE: "Joint — accepte l'accompagnement", JOINT_REFUSE: "Joint — refuse", INJOIGNABLE: "Injoignable", RAPPELER: "À rappeler plus tard" };
/** Appel de l'admin Yodan + retour d'appel (commentaire organisationnel, jamais médical). Met aussi à jour l'accord en attente. */
function logCall(ptId, outcome, note = "") {
  const pt = patientOf(ptId);
  if (!pt || !CALL_OUTCOMES[outcome]) return false;
  pt.calls.push({ at: clock.now, outcome, note: String(note).slice(0, 200) });
  if (pt.accord === null) recordAccord(pt.id, outcome === "JOINT_ACCEPTE" ? "ACCEPTE" : outcome === "JOINT_REFUSE" ? "REFUSE" : "INJOIGNABLE");
  audit("Retour d'appel", `${pt.dossier} : ${CALL_OUTCOMES[outcome]}`);
  return true;
}
/** Consentements du formulaire de test, affichés comme métadonnées (quel que soit le type de partenaire). */
function consentMeta(pt) {
  const ev = evaluationOf(pt.evalId), p = partnerOf(pt.partnerId);
  const yn = (v) => (v === true ? "Oui" : v === false ? "Non" : "—");
  return [["Formulaire", `${ev.test} · ${MODE_LABEL[ev.mode]} · ${fmtDate(ev.date)}`], ...p.consents.map((c) => [c.label, c.moment === "pre" ? `${yn(ev.consentsPre[c.id])} (texte ${ev.consentsPre.version})` : yn(ev.consentsPost[c.id])])];
}
/** Patients ayant demandé à être rappelés (post-consentement) : file « Rappels » de l'admin Yodan. */
const wantsCallback = (pt) => !!evaluationOf(pt.evalId).consentsPost.callback && !pt.calls.length && !pt.closedAt;

/* ---------- Praticiens ---------- */
function createPractitioner({ name, email }) {
  // Ni « psychologue / psychiatre », ni ville à la création (minimisation, demandé par l'équipe).
  const r = createIdentity({ name, email, kind: "PRACTITIONER" });
  if (!r.ok) return r;
  // Agenda à mettre en place par le praticien (Réglages) avant de recevoir un patient.
  const pr = { id: newId("pr"), name: r.identity.name, email: r.identity.email, identityId: r.identity.id, active: true, kind: "interne", weekdays: [false, false, false, false, false, false, false] };
  db.practitioners.push(pr);
  return { ok: true, practitioner: pr };
}
const practitionerLoad = (prId) => db.patients.filter((x) => x.practitionerId === prId && patientStatus(x) === "EN_COURS").length;
/** Praticien suggéré : agenda en place, le moins chargé. */
/** L'agenda est en place dès qu'au moins un jour de travail est coché (pas de bascule manuelle). */
const hasAgenda = (pr) => pr.weekdays.some(Boolean);
const suggestPractitioner = () => db.practitioners.filter((x) => x.active && hasAgenda(x)).sort((a, b) => practitionerLoad(a.id) - practitionerLoad(b.id))[0] || null;

/* =====================================================================
 * Tableaux de bord — chiffres calculés sur les évaluations (un par test), masqués < 5 côté partenaire
 * ===================================================================== */
const MIN_GROUP = 5;
const masked = (n, censor) => (censor && n > 0 && n < MIN_GROUP ? "< 5" : n);
const initials = (pids, test, agencies = null) => db.evaluations.filter((e) => pids.includes(e.partnerId) && e.test === test && e.kind === "Initiale" && (!agencies || agencies.includes(e.agency)));
const countBy = (rows, fn, keys) => Object.fromEntries(keys.map((k) => [k, rows.filter((r) => fn(r) === k).length]));
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / DAY);
const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));
const ageBand = (naissance) => { if (!naissance) return "Non renseigné"; const a = daysBetween(naissance, todayIso()) / 365.25; return a < 30 ? "Moins de 30 ans" : a < 40 ? "30-39 ans" : a < 50 ? "40-49 ans" : "50 ans et +"; };
const weeksBack = (n) => Array.from({ length: n }, (_, i) => addDays(mondayOf(todayIso()), -7 * (n - 1 - i)));

/** Modèle générique (KARASEK, COPSOQ, WHO-5…) et base commune des autres. */
function dashboardModel(partnerIds, test, censor, agencies = null) {
  const evs = initials(partnerIds, test, agencies);
  const zones = countBy(evs, (e) => e.zone, ZONES);
  const outcomes = countBy(evs, outcomeOf, ["AUTO_YES", "YES", "AUTO_NO", "NO", "PENDING"]);
  const agencyNames = [...new Set(evs.map((e) => e.agency))].sort();
  const byAgency = agencyNames.map((a) => { const sub = evs.filter((e) => e.agency === a); return { agency: a, total: sub.length, zones: countBy(sub, (e) => e.zone, ZONES) }; });
  const sexOf = (e) => e.profile.sexe || e.profile.genre || "Non précisé";
  const sexes = [...new Set(evs.map(sexOf))].sort();
  const bySex = sexes.map((s) => ({ sex: s, total: evs.filter((e) => sexOf(e) === s).length }));
  const weekly = weeksBack(12).map((w) => { const sub = evs.filter((e) => e.date >= w && e.date < addDays(w, 7)); return { week: w, total: sub.length, zones: countBy(sub, (e) => e.zone, ZONES) }; });
  return { test, total: evs.length, zones, outcomes, byAgency, bySex, weekly, censor, tooSmall: censor && evs.length < MIN_GROUP };
}
/** Tableau de bord PCL-5 (repris des graphes admin ATMP v2). */
function pcl5Model(pids, censor, agencies = null) {
  const base = dashboardModel(pids, "PCL-5", censor, agencies);
  const evs = initials(pids, "PCL-5", agencies);
  const pts = db.patients.filter((x) => evs.some((e) => e.id === x.evalId));
  const ptOf = (e) => pts.find((x) => x.evalId === e.id);
  const toDecide = evs.filter((e) => e.zone !== "VERT");
  const accepted = evs.filter(acceptsCare);
  const bon = (x) => x.bons[0]?.at;
  const first = (x) => x.sessions.find((s) => s.status === "PRESENT")?.date;
  const funnel = [["Évaluations", evs.length], ["Orange ou rouge", toDecide.length], ["Prise en charge accordée", accepted.length], ["Bon reçu / budget ouvert", pts.filter((x) => partnerOf(x.partnerId).pec.mode === "budget" ? x.accord : x.bons.length).length], ["Praticien attribué", pts.filter((x) => x.assignedAt).length], ["1re séance réalisée", pts.filter(first).length]];
  const delays = [
    ["Évaluation → décision", median(evs.filter((e) => e.decidedAt).map((e) => daysBetween(e.date, e.decidedAt)))],
    ["Décision → bon", median(pts.filter(bon).map((x) => daysBetween(x.createdAt, bon(x))))],
    ["Bon → praticien", median(pts.filter((x) => bon(x) && x.assignedAt).map((x) => daysBetween(bon(x), x.assignedAt)))],
    ["Praticien → 1re séance", median(pts.filter(first).map((x) => daysBetween(x.assignedAt, first(x))))],
  ];
  const pending = [["Décision", evs.filter((e) => outcomeOf(e) === "PENDING").length], ["Délai de recours", pts.filter((x) => !x.closedAt && inAppeal(x)).length], ["Bon", pts.filter((x) => !inAppeal(x) && patientStatus(x) === "PAS_DE_BON").length], ["Prise en charge Yodan", pts.filter((x) => !inAppeal(x) && patientStatus(x) === "EN_ATTENTE" && !x.transferredAt).length], ["Praticien", pts.filter((x) => patientStatus(x) === "EN_ATTENTE" && x.transferredAt).length]];
  const trend = { better: 0, stable: 0, worse: 0 };
  pts.forEach((x) => { const fu = db.evaluations.filter((e) => e.patientId === x.id).sort((a, b) => a.date.localeCompare(b.date)).at(-1); if (!fu) return; const d = fu.score - evaluationOf(x.evalId).score; trend[d <= -PCL5_CHANGE ? "better" : d >= PCL5_CHANGE ? "worse" : "stable"]++; });
  const sessions = pts.flatMap((x) => x.sessions);
  const attendance = countBy(sessions, (s) => s.status, Object.keys(SESSION_STATUS));
  const person = (e) => personOf(e.personId).identity;
  const dims = [["Agent matériel", (e) => e.profile.agent || "Non renseigné"], ["Sexe", (e) => e.profile.sexe || "Non renseigné"], ["Âge", (e) => ageBand(person(e).naissance)], ["Situation matrimoniale", (e) => e.profile.situation || "Non renseigné"], ["Ville", (e) => e.profile.ville || "Non renseigné"]];
  const profile = dims.map(([label, fn]) => ({ label, rows: [...new Set(evs.map(fn))].sort().map((g) => { const sub = evs.filter((e) => fn(e) === g); return { group: g, total: sub.length, zones: countBy(sub, (e) => e.zone, ZONES) }; }) }));
  const agencyRows = base.byAgency.map((a) => { const sub = evs.filter((e) => e.agency === a.agency); return { ...a, accepted: sub.filter(acceptsCare).length, pending: sub.filter((e) => outcomeOf(e) === "PENDING").length, delay: median(sub.filter((e) => e.decidedAt).map((e) => daysBetween(e.date, e.decidedAt))) }; });
  const weekly = weeksBack(12).map((w) => { const end = addDays(w, 7); return { week: w, accepted: evs.filter((e) => acceptsCare(e) && (e.decidedAt || e.date) >= w && (e.decidedAt || e.date) < end).length, pending: evs.filter((e) => e.date < end && (outcomeOf(e) === "PENDING" ? true : e.decidedAt && e.decidedAt >= end)).length }; });
  return { ...base, funnel, delays, pending, trend, attendance, profile, agencies: agencyRows, weeklyCare: weekly };
}
/** Tableau de bord ICJE (repris de la maquette Jouons responsable). */
function icjeModel(pids, censor, agencies = null) {
  const base = dashboardModel(pids, "ICJE", censor, agencies);
  const evs = initials(pids, "ICJE", agencies);
  const risk = evs.filter((e) => e.cat >= 2);
  const cats = [0, 1, 2, 3].map((c) => evs.filter((e) => e.cat === c).length);
  const byCat = (rows, fn) => [...new Set(rows.map(fn))].sort().map((g) => { const sub = rows.filter((e) => fn(e) === g); return { group: g, total: sub.length, cats: [0, 1, 2, 3].map((c) => sub.filter((e) => e.cat === c).length) }; });
  const zoneGeo = (e) => (e.profile.ville === "Abidjan" ? "Abidjan" : "Intérieur");
  const items = TESTS.ICJE.items.map((it, i) => ({ q: it.t, mean: evs.length ? Math.round((evs.reduce((s, e) => s + e.answers[i], 0) / evs.length) * 100) / 100 : 0 }));
  const pts = db.patients.filter((x) => risk.some((e) => e.id === x.evalId));
  const weekly = weeksBack(12).map((w) => { const sub = evs.filter((e) => e.date >= w && e.date < addDays(w, 7)); return { week: w, cats: [0, 1, 2, 3].map((c) => sub.filter((e) => e.cat === c).length) }; });
  return {
    ...base, cats, risk: risk.length, callback: risk.filter((e) => e.consentsPost.callback).length, support: risk.filter((e) => e.cat === 3 && e.consentsPost.support).length, excessif: cats[3],
    inCare: pts.filter((x) => ["EN_COURS", "CLOS"].includes(patientStatus(x))).length, weeklyCats: weekly, items,
    bySexe: byCat(evs, (e) => e.profile.sexe || "Non précisé"), byGeo: byCat(evs, zoneGeo), byCanal: byCat(evs, (e) => e.profile.canal || "Non précisé"),
    byPlat: byCat(evs, (e) => e.profile.plateforme || "Non précisé"), byVille: byCat(evs, (e) => e.profile.ville || "Non précisé"),
  };
}
/** Tableau de bord BSPA (repris du tableau de bord RH : agrégé, seuil de 5). */
function bspaModel(pids, censor, campaignId = "all", agencies = null) {
  const base = dashboardModel(pids, "BSPA", censor, agencies);
  const evs = initials(pids, "BSPA", agencies).filter((e) => campaignId === "all" || e.campaignId === campaignId);
  const n = evs.length;
  const prof = ZONES.map((z) => evs.filter((e) => e.zone === z).length);
  const dims = Object.fromEntries(BSPA_DIMS.map((k) => [k, n ? Math.round(evs.reduce((s, e) => s + e.dims[k].pct, 0) / n) : 0]));
  const by = BSPA_DEMO.map((f) => ({ label: f.label, rows: f.options.map((o) => { const sub = evs.filter((e) => e.profile[f.key] === o); return { group: o === "Je préfère ne pas répondre" ? "Non précisé" : o, total: sub.length, zones: countBy(sub, (e) => e.zone, ZONES) }; }) }));
  const camps = db.campaigns.filter((c) => pids.includes(c.partnerId) && c.test === "BSPA" && campaignState(c) !== "AVENIR");
  const compare = camps.map((c) => { const sub = evs.filter((e) => e.campaignId === c.id); return { id: c.id, name: c.name, total: sub.length, prof: ZONES.map((z) => sub.filter((e) => e.zone === z).length), wellbeing: sub.length ? Math.round(sub.reduce((s, e) => s + e.dims.A.pct, 0) / sub.length) : 0 }; });
  return { ...base, total: n, tooSmall: censor && n < MIN_GROUP, prof, dims, by, alerts: evs.filter((e) => e.dims.E.zone === "ROUGE").length, compare, campaigns: camps };
}
/** Tableau de bord de la prise en charge (console) : patients par statut et par partenaire. */
function pecDashboard(partnerIds) {
  const pts = db.patients.filter((p) => partnerIds.includes(p.partnerId));
  const byStatus = Object.fromEntries(Object.keys(PEC_STATUS).map((s) => [s, pts.filter((p) => patientStatus(p) === s).length]));
  const byPartner = partnerIds.map((id) => { const sub = pts.filter((p) => p.partnerId === id); return { partnerId: id, total: sub.length, byStatus: Object.fromEntries(Object.keys(PEC_STATUS).map((s) => [s, sub.filter((p) => patientStatus(p) === s).length])), consultations: sub.reduce((n, p) => n + consumedOf(p), 0) }; });
  const sessions = pts.flatMap((x) => x.sessions);
  return { total: pts.length, byStatus, byPartner, consultations: pts.reduce((n, p) => n + consumedOf(p), 0), attendance: countBy(sessions, (s) => s.status, Object.keys(SESSION_STATUS)) };
}

/* =====================================================================
 * Campagnes (repris de BSPA) : lien par e-mail + code ; participants visibles par l'admin Yodan seulement
 * ===================================================================== */
function campaignState(c) { const t = todayIso(); return t < c.start ? "AVENIR" : t > c.end ? "TERMINEE" : "EN_COURS"; }
const CAMP_STATE = { AVENIR: ["bleu", "À venir"], EN_COURS: ["vert", "En cours"], TERMINEE: ["gris", "Terminée"] };
const PART_STATUS = { TERMINE: ["vert", "Terminé"], NON_TERMINE: ["bleu", "Non terminé"], PAS_DE_REPONSE: ["gris", "Pas de réponse"] };
const participantStatus = (x) => (x.completedAt ? "TERMINE" : x.startedAt ? "NON_TERMINE" : "PAS_DE_REPONSE");
function createCampaign({ partnerId, name, test, start, end }) {
  const p = partnerOf(partnerId);
  const e = {};
  if (!p || !p.campaign.on) e.partner = "Campagne non activée pour ce partenaire.";
  if (!String(name ?? "").trim()) e.name = "Nommez la campagne.";
  if (p && !p.tests.includes(test)) e.test = "Test non activé pour ce partenaire.";
  if (!start || !end || end < start) e.dates = "La date de fin doit suivre la date de début.";
  if (Object.keys(e).length) return { ok: false, errors: e };
  const c = { id: newId("cp"), partnerId, name: name.trim(), test, start, end, createdAt: todayIso(), code: tokenOf(name).slice(0, 6).toUpperCase() };
  db.campaigns.push(c);
  audit("Création campagne", `${p.name} · ${c.name}`);
  return { ok: true, campaign: c };
}
/** Extrait la colonne e-mail d'un CSV (séparateur ; , ou tabulation, BOM Excel accepté) : les autres colonnes sont ignorées. */
function parseCsvEmails(text) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = [";", ",", "\t"].find((s) => lines[0].includes(s)) || ";";
  const head = lines[0].split(sep).map((x) => norm(x.replace(/"/g, "")));
  const col = head.findIndex((h) => /mail/.test(h));
  const rows = col >= 0 ? lines.slice(1) : lines;
  return rows.map((l) => l.split(sep)[col >= 0 ? col : 0]?.replace(/"/g, "").trim()).filter(Boolean);
}
/** Invitations (collage et / ou CSV) : avec e-mail pro, seules les adresses des domaines du partenaire sont acceptées. */
function inviteToCampaign(campaignId, text, csv = "") {
  const c = campaignOf(campaignId), p = partnerOf(c.partnerId);
  const emails = [...new Set([...String(text).split(/[\s,;]+/), ...parseCsvEmails(csv)].map(normEmail).filter(Boolean))];
  const added = [], refused = [];
  emails.forEach((em) => {
    const known = db.participants.find((x) => x.campaignId === c.id && x.email === em);
    if (!isEmail(em)) refused.push([em, "format"]);
    else if (p.campaign.emailPro && !p.campaign.domains.includes(domainOf(em))) refused.push([em, "domaine"]);
    else if (known && known.completedAt) refused.push([em, "déjà terminé"]);
    else if (known) { known.invitedAt = todayIso(); added.push(em); }
    else { db.participants.push({ id: newId("pp"), campaignId: c.id, email: em, invitedAt: todayIso(), startedAt: null, completedAt: null, evalId: null }); added.push(em); }
  });
  added.forEach((em) => sendMail(em, "CAMPAGNE", "Invitation : un questionnaire confidentiel vous attend", ["Vous êtes invité(e) à remplir un questionnaire confidentiel.", `Le lien est ouvert jusqu'au ${fmtDate(c.end)}. Un code vous sera envoyé pour vérifier votre adresse.`], { link: `${APP_URL}/c/${c.code}`, campaignId: c.id }));
  if (added.length) audit("Envoi campagne", `${c.name} : ${added.length} invitation(s)`);
  return { added, refused };
}
/** Participant : ouverture du lien (adresse du domaine si e-mail pro) puis code envoyé par e-mail. */
function startParticipation(campaignId, email) {
  const c = campaignOf(campaignId), p = partnerOf(c.partnerId), em = normEmail(email);
  if (campaignState(c) !== "EN_COURS") return { ok: false, err: campaignState(c) === "AVENIR" ? `La campagne ouvre le ${fmtDate(c.start)}.` : "Cette campagne est terminée." };
  if (!isEmail(em)) return { ok: false, err: "Adresse e-mail invalide." };
  if (p.campaign.emailPro && !p.campaign.domains.includes(domainOf(em))) return { ok: false, err: "Utilisez votre adresse e-mail professionnelle." };
  let x = db.participants.find((y) => y.campaignId === c.id && y.email === em);
  if (x && x.completedAt) return { ok: false, err: "Vous avez déjà répondu à cette campagne. Votre bilan vous a été envoyé par e-mail." };
  if (!x) { x = { id: newId("pp"), campaignId: c.id, email: em, invitedAt: null, startedAt: null, completedAt: null, evalId: null }; db.participants.push(x); }
  const code = String(100000 + (hash(`${em}|${c.id}|${++otpSeq}`) % 900000));
  db.challenges = db.challenges.filter((ch) => !(ch.participantId === x.id));
  db.challenges.push({ id: newId("ch"), participantId: x.id, purpose: "CAMPAGNE", code, at: clock.now, tries: 0, used: false });
  sendMail(em, "OTP", "Votre code de vérification", [`Votre code : ${code}`, `Il est valable ${OTP_VALID_MIN} minutes.`], { code });
  return { ok: true, participant: x, challengeId: db.challenges.at(-1).id };
}
function verifyParticipant(challengeId, code) {
  const r = verifyOtp(challengeId, code);
  if (r === "OK") { const ch = db.challenges.find((x) => x.id === challengeId); const x = db.participants.find((y) => y.id === ch.participantId); x.startedAt = x.startedAt || todayIso(); }
  return r;
}
function submitParticipation(participantId, { identity, profile, answers, consentsPre }) {
  const x = db.participants.find((y) => y.id === participantId);
  if (!x || !x.startedAt || x.completedAt) return { ok: false, err: "Participation introuvable ou déjà terminée." };
  const c = campaignOf(x.campaignId);
  const r = recordEvaluation({ partnerId: c.partnerId, test: c.test, ids: { id1: x.email }, agency: partnerOf(c.partnerId).agencies[0], identity: { ...identity, email: x.email }, profile, answers, consentsPre, mode: "campagne", campaignId: c.id });
  if (!r.ok) return r;
  x.completedAt = todayIso(); x.evalId = r.evaluation.id;
  // E-mail neutre : aucun résultat dans le message (ISO 27799) ; le lien redemande un code.
  sendMail(x.email, "BILAN", "Votre bilan est disponible", ["Merci pour votre participation.", "Votre bilan personnel est disponible en ligne. Le lien vous demandera un code de vérification."], { link: `${APP_URL}/bilan/${tokenOf(x.id)}` });
  return r;
}
