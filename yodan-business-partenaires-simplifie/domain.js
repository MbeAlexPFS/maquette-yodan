/*
 * domain.js : métier de la version simplifiée (Entreprise, Association / mutuelle).
 *  - Tests : BSPA (22 questions, 5 dimensions), KARASEK, COPSOQ, WHO-5 ;
 *  - Évaluations, décisions du validateur (mutuelle), campagnes e-mail pro + code ;
 *  - Pas de prise en charge dans l'app : l'admin Yodan exporte les personnes à prendre en charge
 *    et passe le dossier à « Clos » quand le traitement est fini.
 * Règle §9 : seuls les FAITS sont stockés ; statuts, listes et graphiques sont calculés ici.
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
const TESTS = {
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
function scoreTest(test, answers) {
  const T = TESTS[test];
  if (!T || !Array.isArray(answers) || answers.length !== T.items.length || answers.some((a, i) => !T.items[i].o.some(([v]) => v === a))) return null;
  return T.score(answers);
}
const zoneTitle = (test, res) => TESTS[test].zoneText[res.zone][0];
const scoreText = (test, s) => String(s);
const DECISION_DAYS = 7, LATE_DAYS = 3;

/* =====================================================================
 * Réglages métier (identiques pour les deux types) : identifiant, questionnaire général, consentements
 * ===================================================================== */
const SELECT = (key, label, options, extra = {}) => ({ key, label, type: "select", options, pii: false, required: true, level: "person", ...extra });
const BSPA_DEMO = [SELECT("genre", "Genre", ["Femme", "Homme", "Je préfère ne pas répondre"]), SELECT("tranche_age", "Tranche d'âge", ["18-25 ans", "26-35 ans", "36-45 ans", "46-55 ans", "56 ans et +"]), SELECT("anciennete", "Ancienneté", ["Moins d'1 an", "1 à 5 ans", "6 à 10 ans", "Plus de 10 ans"], { required: false })];
const DOMAIN_PRESET = {
  fields: [{ key: "prenom", label: "Prénom", type: "text", pii: true, required: true, level: "person" }, { key: "nom", label: "Nom", type: "text", pii: true, required: true, level: "person" }, { key: "telephone", label: "Téléphone (pour être recontacté)", type: "tel", pii: true, required: false, level: "person" }, ...BSPA_DEMO],
  consents: [
    { id: "traitement", moment: "pre", required: true, label: "J'accepte que mes réponses produisent mon bilan personnel et des statistiques anonymes pour mon organisation" },
    { id: "support", moment: "post", zones: ["ORANGE", "ROUGE"], label: "J'accepte d'être accompagné(e) par un professionnel" },
    { id: "callback", moment: "post", zones: ["ORANGE", "ROUGE"], label: "J'accepte d'être recontacté(e) par YODAN" },
  ],
  links: [{ label: "Conseils pour garder l'équilibre", url: "https://exemple.ci/equilibre", zones: ["VERT", "ORANGE"] }, { label: "Ligne d'écoute (numéro fictif)", url: "https://exemple.ci/ecoute", zones: ["ORANGE", "ROUGE"] }],
};
/** Agences : la mutuelle a un validateur (orange décidé par lui) ; l'entreprise non (orange et rouge vont directement à Yodan). */
const agencyDefaults = (name, type) => ({ name, validateZones: type === "MUTUELLE" ? ["ORANGE"] : [] });
function domainDefaults(type, agencies) {
  const d = JSON.parse(JSON.stringify(DOMAIN_PRESET));
  return { idLabels: ["E-mail"], fields: d.fields, consents: d.consents, links: d.links, agencyOpts: agencies.map((a) => agencyDefaults(a, type)), sqlAnon: true };
}
const agencyOpt = (p, name) => p.agencyOpts.find((a) => a.name === name) || agencyDefaults(name, p.type);
const partnerValidates = (p) => hasFeature(p, "validation");
const consentsOf = (p, moment, zone = null) => p.consents.filter((c) => c.moment === moment && (!zone || !c.zones || c.zones.includes(zone)));

/* =====================================================================
 * Personnes (coffre identité) et recherche de dossier
 * ===================================================================== */
const peopleOf = (partnerId) => db.people.filter((x) => x.partnerId === partnerId);
const normId = (s) => norm(String(s ?? "").replace(/\s+/g, ""));
const findPerson = (partnerId, id1) => peopleOf(partnerId).find((x) => normId(x.id1) === normId(id1));
const displayName = (person) => (person ? `${person.identity.prenom || ""} ${person.identity.nom || ""}`.trim() || person.id1 : "—");
const evalsOfPerson = (personId) => db.evaluations.filter((e) => e.personId === personId).sort((a, b) => a.date.localeCompare(b.date));
const openPatientOf = (personId) => db.patients.find((x) => x.personId === personId && !x.closedAt);
/** Avant une évaluation par un agent : nouvelle personne, personne connue, ou blocage (avec la raison). */
function lookupDossier(partnerId, id1) {
  const person = findPerson(partnerId, id1);
  if (!person) return { path: "new" };
  const pending = evalsOfPerson(person.id).find((e) => outcomeOf(e) === "PENDING");
  if (pending) return { path: "known", person, blocker: `Une évaluation attend déjà une décision (dossier ${pending.dossier}).` };
  const pt = openPatientOf(person.id);
  if (pt) return { path: "known", person, blocker: `Cette personne est déjà à prendre en charge (${pt.dossier}).` };
  return { path: "known", person };
}

/* =====================================================================
 * Évaluations et décisions
 * ===================================================================== */
const MODE_LABEL = { agent: "Avec un agent", qr: "QR code (agent)", qr_ouvert: "QR ouvert (affiche)", campagne: "Campagne" };
let dossierSeq = 0;
/** Enregistre une évaluation. Identité → coffre identité (people) ; l'évaluation ne garde que personId. */
function recordEvaluation(input) {
  const { partnerId, test, ids = {}, agency, identity = {}, profile = {}, answers, consentsPre = {}, consentsPost = {}, mode = "agent", by = null, campaignId = null, date = todayIso() } = input;
  const p = partnerOf(partnerId);
  if (!p) return { ok: false, err: "Partenaire inconnu." };
  if (!p.tests.includes(test)) return { ok: false, err: "Ce test n'est pas activé pour ce partenaire." };
  // Base commune : on refuse toute référence à une donnée d'un autre tenant.
  if (campaignId && campaignOf(campaignId)?.partnerId !== partnerId) return { ok: false, err: "Campagne d'un autre partenaire." };
  if (agency && !p.agencies.includes(agency)) return { ok: false, err: "Agence d'un autre partenaire." };
  const res = scoreTest(test, answers);
  if (!res) return { ok: false, err: "Répondez à toutes les questions." };
  if (consentsOf(p, "pre").some((c) => c.required && !consentsPre[c.id])) return { ok: false, err: "Le consentement obligatoire n'est pas donné." };
  if (!String(ids.id1 ?? "").trim()) return { ok: false, err: `${p.idLabels[0]} obligatoire.` };
  // Campagne : chaque bilan est nouveau, sans blocage d'agent.
  const found = findPerson(partnerId, ids.id1);
  const look = mode === "campagne" ? (found ? { path: "known", person: found } : { path: "new" }) : lookupDossier(partnerId, ids.id1);
  if (look.blocker) return { ok: false, err: look.blocker };
  let person = look.person;
  if (!person) {
    person = { id: newId("ps"), partnerId, pseudo: `PS-${(hash(`${partnerId}${ids.id1}${idSeq}`) % 90000) + 10000}`, id1: String(ids.id1).trim(), identity: {} };
    db.people.push(person);
  }
  Object.entries(identity).forEach(([k, v]) => { if (v !== "" && v != null) person.identity[k] = v; });
  const ev = {
    id: newId("ev"), partnerId, test, personId: person.id, agency: agency || p.agencies[0], kind: "Initiale", mode, by, campaignId, date,
    dossier: `${p.slug.slice(0, 3).toUpperCase()}-${String(1000 + ++dossierSeq * 7).padStart(5, "0")}`,
    answers: [...answers], score: res.score, zone: res.zone, dims: res.dims || null,
    profile: { ...profile }, consentsPre: { ...consentsPre, version: "v1.0" }, consentsPost: {}, decision: null, decidedAt: null, decidedBy: null, comment: "",
  };
  db.evaluations.push(ev);
  if (acceptsCare(ev) && !openPatientOf(person.id)) createPatient(ev);
  if (Object.keys(consentsPost).length) setPostConsents(ev.id, consentsPost);
  return { ok: true, evaluation: ev, path: look.path };
}
function setPostConsents(evId, values) {
  const ev = evaluationOf(evId);
  consentsOf(partnerOf(ev.partnerId), "post", ev.zone).forEach((c) => { if (c.id in values) ev.consentsPost[c.id] = !!values[c.id]; });
  return true;
}
/** Issue : vert = sans suite ; zone décidée par un validateur (mutuelle) ou prise en charge automatique. */
function outcomeOf(ev) {
  if (ev.zone === "VERT") return "AUTO_NO";
  if (!agencyOpt(partnerOf(ev.partnerId), ev.agency).validateZones.includes(ev.zone)) return "AUTO_YES";
  return ev.decision || "PENDING";
}
const OUTCOME_LABEL = { AUTO_NO: "Sans suite (auto)", AUTO_YES: "À prendre en charge (auto)", YES: "À prendre en charge", NO: "Pas de prise en charge", PENDING: "À décider" };
const OUTCOME_PILL = { AUTO_NO: "gris", AUTO_YES: "orange", YES: "orange", NO: "rouge", PENDING: "jaune" };
const acceptsCare = (ev) => ["AUTO_YES", "YES"].includes(outcomeOf(ev));
const decisionDeadline = (ev) => addDays(ev.date, DECISION_DAYS);
const isLate = (ev) => outcomeOf(ev) === "PENDING" && Date.parse(todayIso()) - Date.parse(ev.date) > LATE_DAYS * DAY;
function decide(evId, yes, { by = null, comment = "" } = {}) {
  const ev = evaluationOf(evId);
  if (!ev || outcomeOf(ev) !== "PENDING") return false;
  Object.assign(ev, { decision: yes ? "YES" : "NO", decidedAt: todayIso(), decidedBy: by, comment: String(comment).slice(0, 300) });
  audit("Décision", `${ev.dossier} : ${yes ? "oui" : "non"}`);
  if (yes && !openPatientOf(ev.personId)) createPatient(ev);
  return true;
}
const pendingDecisions = (pids) => db.evaluations.filter((e) => pids.includes(e.partnerId) && outcomeOf(e) === "PENDING").sort((a, b) => a.date.localeCompare(b.date));

/* =====================================================================
 * Personnes à prendre en charge (hors application) : export + clôture
 * ===================================================================== */
const PEC_STATUS = { A_PRENDRE: ["orange", "À prendre en charge"], CLOS: ["gris", "Clos"] };
const CLOSE_REASONS = ["Traitement terminé", "Refus de la personne", "Personne injoignable"];
function createPatient(ev) {
  if (db.patients.some((x) => x.evalId === ev.id)) return null;
  const pt = { id: newId("pa"), evalId: ev.id, partnerId: ev.partnerId, personId: ev.personId, dossier: ev.dossier, createdAt: ev.decidedAt || ev.date, exports: [], calls: [], closedAt: null, closedReason: "" };
  db.patients.push(pt);
  return pt;
}
const patientStatus = (pt) => (pt.closedAt ? "CLOS" : "A_PRENDRE");
/** Passer à « Clos » quand le traitement est fini (ou refus, ou injoignable). */
function closePatient(ptId, reason = CLOSE_REASONS[0]) {
  const pt = patientOf(ptId);
  if (!pt || pt.closedAt || !CLOSE_REASONS.includes(reason)) return false;
  pt.closedAt = todayIso(); pt.closedReason = reason;
  audit("Clôture", `${pt.dossier} : ${reason}`);
  return true;
}
const CALL_OUTCOMES = { JOINT: "Joint", INJOIGNABLE: "Injoignable", RAPPELER: "À rappeler plus tard" };
function logCall(ptId, outcome, note = "") {
  const pt = patientOf(ptId);
  if (!pt || !CALL_OUTCOMES[outcome]) return false;
  pt.calls.push({ at: clock.now, outcome, note: String(note).slice(0, 200) });
  audit("Retour d'appel", `${pt.dossier} : ${CALL_OUTCOMES[outcome]}`);
  return true;
}
function consentMeta(pt) {
  const ev = evaluationOf(pt.evalId), p = partnerOf(pt.partnerId);
  const yn = (v) => (v === true ? "Oui" : v === false ? "Non" : "—");
  return [["Formulaire", `${ev.test} · ${MODE_LABEL[ev.mode]} · ${fmtDate(ev.date)}`], ...p.consents.map((c) => [c.label, c.moment === "pre" ? `${yn(ev.consentsPre[c.id])} (texte ${ev.consentsPre.version})` : yn(ev.consentsPost[c.id])])];
}
const wantsCallback = (pt) => !!evaluationOf(pt.evalId).consentsPost.callback && !pt.calls.length && !pt.closedAt;
/**
 * Export des personnes à prendre en charge : colonnes limitées au nécessaire pour contacter et orienter
 * (minimisation) — ni réponses, ni dimensions détaillées.
 */
const EXPORT_COLUMNS = ["Dossier", "Prénom", "Nom", "Téléphone", "E-mail", "Partenaire", "Date du bilan", "Profil", "Accompagnement accepté", "Rappel demandé"];
function exportRows(patients) {
  return patients.map((pt) => {
    const ev = evaluationOf(pt.evalId), person = personOf(pt.personId);
    return [pt.dossier, person.identity.prenom || "", person.identity.nom || "", person.identity.telephone || "", person.identity.email || person.id1, partnerOf(pt.partnerId).name, fmtDate(ev.date), zoneTitle(ev.test, ev), ev.consentsPost.support ? "Oui" : "Non", ev.consentsPost.callback ? "Oui" : "Non"];
  });
}
/** Marque l'export (date) sur chaque dossier ouvert exporté et renvoie le CSV (séparateur ; et BOM pour Excel). */
function exportPatients(patients) {
  const open = patients.filter((x) => !x.closedAt);
  open.forEach((x) => x.exports.push(todayIso()));
  audit("Export personnes à prendre en charge", `${open.length} ligne(s)`);
  const cell = (c) => `"${String(c).replace(/"/g, '""')}"`;
  return { count: open.length, csv: `﻿${[EXPORT_COLUMNS, ...exportRows(open)].map((r) => r.map(cell).join(";")).join("\r\n")}` };
}

/* =====================================================================
 * Tableaux de bord — agrégés, effectifs < 5 masqués côté partenaire
 * ===================================================================== */
const MIN_GROUP = 5;
const masked = (n, censor) => (censor && n > 0 && n < MIN_GROUP ? "< 5" : n);
const initials = (pids, test, agencies = null) => db.evaluations.filter((e) => pids.includes(e.partnerId) && e.test === test && (!agencies || agencies.includes(e.agency)));
const countBy = (rows, fn, keys) => Object.fromEntries(keys.map((k) => [k, rows.filter((r) => fn(r) === k).length]));
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / DAY);
const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));
const weeksBack = (n) => Array.from({ length: n }, (_, i) => addDays(mondayOf(todayIso()), -7 * (n - 1 - i)));
function dashboardModel(partnerIds, test, censor, agencies = null) {
  const evs = initials(partnerIds, test, agencies);
  const zones = countBy(evs, (e) => e.zone, ZONES);
  const outcomes = countBy(evs, outcomeOf, ["AUTO_YES", "YES", "AUTO_NO", "NO", "PENDING"]);
  const agencyNames = [...new Set(evs.map((e) => e.agency))].sort();
  const byAgency = agencyNames.map((a) => { const sub = evs.filter((e) => e.agency === a); return { agency: a, total: sub.length, zones: countBy(sub, (e) => e.zone, ZONES) }; });
  const weekly = weeksBack(12).map((w) => { const sub = evs.filter((e) => e.date >= w && e.date < addDays(w, 7)); return { week: w, total: sub.length, zones: countBy(sub, (e) => e.zone, ZONES) }; });
  return { test, total: evs.length, zones, outcomes, byAgency, weekly, censor, tooSmall: censor && evs.length < MIN_GROUP };
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

/* =====================================================================
 * Campagnes (BSPA) : le partenaire crée et envoie ; seul l'admin Yodan consulte les participants
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
/** Colonne e-mail d'un CSV (séparateur ; , ou tabulation, BOM Excel accepté) ; les autres colonnes sont ignorées. */
function parseCsvEmails(text) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = [";", ",", "\t"].find((s) => lines[0].includes(s)) || ";";
  const head = lines[0].split(sep).map((x) => norm(x.replace(/"/g, "")));
  const col = head.findIndex((h) => /mail/.test(h));
  const rows = col >= 0 ? lines.slice(1) : lines;
  return rows.map((l) => l.split(sep)[col >= 0 ? col : 0]?.replace(/"/g, "").trim()).filter(Boolean);
}
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
function startParticipation(campaignId, email) {
  const c = campaignOf(campaignId), p = partnerOf(c.partnerId), em = normEmail(email);
  if (campaignState(c) !== "EN_COURS") return { ok: false, err: campaignState(c) === "AVENIR" ? `La campagne ouvre le ${fmtDate(c.start)}.` : "Cette campagne est terminée." };
  if (!isEmail(em)) return { ok: false, err: "Adresse e-mail invalide." };
  if (p.campaign.emailPro && !p.campaign.domains.includes(domainOf(em))) return { ok: false, err: "Utilisez votre adresse e-mail professionnelle." };
  let x = db.participants.find((y) => y.campaignId === c.id && y.email === em);
  if (x && x.completedAt) return { ok: false, err: "Vous avez déjà répondu à cette campagne. Votre bilan vous a été envoyé par e-mail." };
  if (!x) { x = { id: newId("pp"), campaignId: c.id, email: em, invitedAt: null, startedAt: null, completedAt: null, evalId: null }; db.participants.push(x); }
  const code = String(100000 + (hash(`${em}|${c.id}|${++otpSeq}`) % 900000));
  db.challenges = db.challenges.filter((ch) => ch.participantId !== x.id);
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
  // Le résultat s'affiche tout de suite à la fin du test (avec les consentements) : aucun e-mail de bilan.
  x.completedAt = todayIso(); x.evalId = r.evaluation.id;
  return r;
}

/* =====================================================================
 * Revoir son rapport : sur demande à YODAN, renvoi par un lien à usage unique ou export PDF
 * ===================================================================== */
const REPORT_LINK_HOURS = 72;
/** Lien à usage unique : il s'ouvre une seule fois et disparaît après fermeture (et expire après 72 h). */
function sendReportLink(evId) {
  const ev = evaluationOf(evId), person = ev && personOf(ev.personId);
  const email = person && (person.identity.email || (isEmail(person.id1) ? person.id1 : ""));
  if (!email) return { ok: false, err: "Pas d'adresse e-mail pour cette personne." };
  db.reportLinks.filter((l) => l.evId === evId && !l.usedAt).forEach((l) => { l.revokedAt = clock.now; });
  const token = tokenOf(`${evId}-${db.reportLinks.length}`);
  db.reportLinks.push({ token, evId, at: clock.now, usedAt: null, revokedAt: null });
  // E-mail neutre : aucun résultat dans le message (ISO 27799).
  sendMail(email, "RAPPORT", "Votre rapport est disponible", ["Comme convenu avec YODAN, voici le lien vers votre rapport personnel.", `Ce lien ne fonctionne qu'une seule fois : il disparaît dès que vous fermez la page. Il expire dans ${REPORT_LINK_HOURS} heures.`], { link: `${APP_URL}/rapport/${token}`, token });
  audit("Renvoi du rapport (lien unique)", ev.dossier);
  return { ok: true, email };
}
function openReportLink(token) {
  const l = db.reportLinks.find((x) => x.token === token);
  if (!l || l.revokedAt) return { ok: false, err: "Ce lien n'est plus valide. Contactez YODAN pour recevoir à nouveau votre rapport." };
  if (l.usedAt) return { ok: false, err: "Ce lien a déjà été utilisé : il ne fonctionne qu'une seule fois. Contactez YODAN pour recevoir à nouveau votre rapport." };
  if (clock.now - l.at > REPORT_LINK_HOURS * HOUR) return { ok: false, err: "Ce lien a expiré. Contactez YODAN pour recevoir à nouveau votre rapport." };
  l.usedAt = clock.now;
  audit("Ouverture du rapport par la personne", evaluationOf(l.evId).dossier);
  return { ok: true, evaluation: evaluationOf(l.evId) };
}
