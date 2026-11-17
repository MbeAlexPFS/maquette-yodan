/*
 * Maquette BSPA — version autonome (standalone) : connexion Yodan / RH, entreprises et comptes RH, campagnes, tableaux de bord, formulaire.
 * Écrans : Admin Yodan (Campagnes / Tableau de bord & participants), RH (tableau de bord agrégé), Participant (formulaire).
 * Toutes les données sont fictives (noms « Démo / Test / Exemple », domaines *.exemple.test). Aucun appel réseau.
 *
 * Règle de construction (CLAUDE.md §9) : le générateur ne produit que des FAITS (réponses, dates).
 * Statuts, profils, compteurs et tableaux de bord sont CALCULÉS par les mêmes fonctions que les écrans et que tests.js.
 */
"use strict";

/* =====================================================================
 * Outils
 * ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pct = (x, n) => (n ? Math.round((x / n) * 100) : 0);

function toast(msg) {
  const el = h(`<div class="toast">${msg}</div>`);
  $("#toast").append(el);
  setTimeout(() => el.remove(), 3200);
}
function bind(root, handlers) {
  $$("[data-act]", root).forEach((el) => {
    const fn = handlers[el.dataset.act];
    if (fn) el.addEventListener(el.dataset.ev || (el.tagName === "SELECT" ? "change" : "click"), (e) => fn(el, e));
  });
}
function modal(title, html, mount, wide = false) {
  const back = h(`<div class="modal-back"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" aria-label="Fermer">×</button></div>
    <div class="modal-body">${html}</div></div></div>`);
  const close = () => { back.remove(); document.removeEventListener("keydown", onEsc); };
  const onEsc = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onEsc);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  $(".modal-head button", back).addEventListener("click", close);
  ($("#stage .phone") || document.body).append(back);
  mount?.($(".modal-body", back), close);
  $("input, select, textarea, button", $(".modal-body", back))?.focus();
  return close;
}
/** Générateur pseudo-aléatoire déterministe : mêmes données fictives à chaque ouverture. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
/** Faux QR code (motif déterministe) : purement illustratif, non scannable. */
function qrSvg(seed) {
  const n = 25, rnd = rng(hash(seed));
  const finder = (x, y) => [[0, 7], [1, 5], [2, 3]].map(([o, w], i) => `<rect x="${x + o}" y="${y + o}" width="${w}" height="${w}" fill="${i === 1 ? "#fff" : "#0f2f47"}"/>`).join("");
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  let cells = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  return `<svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR code fictif" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><g fill="#0f2f47">${cells}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

/* =====================================================================
 * Dates (date du jour simulée, fixe pour que la maquette reste cohérente)
 * ===================================================================== */
const TODAY = "2026-11-17";
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const fmt = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const fmtLong = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** État d'une campagne à une date (bornes incluses : du jour de début au jour de fin). */
function campaignState(c, day = TODAY) { return day < c.start ? "AVENIR" : day > c.end ? "TERMINEE" : "EN_COURS"; }
const STATE_PILL = { AVENIR: ["bleu", "À venir"], EN_COURS: ["vert", "En cours"], TERMINEE: ["gris", "Terminée"] };
/** Ce que voit une personne qui ouvre le lien de la campagne ce jour-là. */
function availability(c, day = TODAY) {
  const st = campaignState(c, day);
  if (st === "AVENIR") return { open: false, state: st, title: "Ce bilan n'est pas encore ouvert", message: `Il sera disponible à partir du ${fmtLong(c.start)}, jusqu'au ${fmtLong(c.end)}.` };
  if (st === "TERMINEE") return { open: false, state: st, title: "Ce bilan est terminé", message: `Il était disponible du ${fmtLong(c.start)} au ${fmtLong(c.end)}. Il n'est plus possible d'y répondre.` };
  return { open: true, state: st, title: "", message: `Disponible jusqu'au ${fmtLong(c.end)}.` };
}

/* =====================================================================
 * Questionnaire (libellés repris de app/bspa_core.py) + calcul simplifié
 * ===================================================================== */
const SCALE_A = ["Jamais", "De temps en temps", "Moins de la moitié du temps", "Plus de la moitié du temps", "La plupart du temps", "Tout le temps"];
const SCALE_B = ["Jamais", "Presque jamais", "Parfois", "Assez souvent", "Très souvent"];
const SCALE_C = ["Jamais", "Quelques fois par an", "Une fois par mois", "Quelques fois par mois", "Une fois par semaine", "Quelques fois par semaine", "Chaque jour"];
const SCALE_D = ["Pas du tout d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "Tout à fait d'accord"];
const opts = (labels, start = 0) => labels.map((l, i) => [i + start, l]);
const SECTIONS = [
  { key: "A", short: "Bien-être", title: "Au cours des deux dernières semaines…", items: [
    "Je me suis senti(e) de bonne humeur et joyeux(se)", "Je me suis senti(e) calme et détendu(e)",
    "Je me suis senti(e) actif(ve) et plein(e) d'énergie", "Je me suis réveillé(e) reposé(e) et prêt(e) pour la journée",
    "Ma vie quotidienne a été remplie de choses qui m'intéressent"].map((t) => ({ t, o: opts(SCALE_A) })) },
  { key: "B", short: "Stress", title: "Au cours du dernier mois, à quelle fréquence…", items: [
    "Vous avez été incapable de contrôler les choses importantes dans votre vie",
    "Vous vous êtes senti(e) confiant(e) dans votre capacité à gérer vos problèmes",
    "Vous avez eu l'impression que les choses allaient dans le bon sens pour vous",
    "Les difficultés ont tellement pesé que vous ne pouviez plus y faire face"].map((t) => ({ t, o: opts(SCALE_B) })) },
  { key: "C", short: "Épuisement", title: "Votre ressenti au travail", items: [
    "Je me sens vidé(e) émotionnellement par mon travail", "Je me sens épuisé(e) en fin de journée de travail",
    "Le matin, je me sens fatigué(e) à l'idée d'aller travailler", "Mon travail me demande un effort qui me pèse de plus en plus",
    "J'ai l'impression d'être à bout"].map((t) => ({ t, o: opts(SCALE_C) })) },
  { key: "D", short: "Vécu au travail", title: "Votre vécu au travail", items: [
    "Ma charge de travail quotidienne est raisonnable et gérable", "Je me sens soutenu(e) par mon responsable quand j'en ai besoin",
    "Mon travail est reconnu à sa juste valeur", "Je trouve du sens dans ce que je fais au quotidien",
    "Les relations avec mes collègues sont globalement satisfaisantes"].map((t) => ({ t, o: opts(SCALE_D, 1) })) },
  { key: "E", short: "Signaux", title: "Quelques questions complémentaires", items: [
    { t: "Dormez-vous suffisamment et vous sentez-vous reposé(e) au réveil la plupart du temps ?", o: opts(["Oui, presque toujours", "Parfois", "Rarement ou jamais"]) },
    { t: "Avez-vous augmenté votre consommation de substances pour tenir (café, alcool, tabac, médicaments) ?", o: opts(["Non, pas de changement", "Légèrement", "Oui, nettement"]) },
    { t: "Traversez-vous actuellement un évènement de vie difficile (deuil, séparation, maladie, difficultés financières) ?", o: opts(["Non", "Oui, mais je le gère bien", "Oui, cela m'affecte fortement"]) }] },
];
const ITEM_KEYS = SECTIONS.flatMap((s) => s.items.map((_, i) => `${s.key}${i}`));
const DEMO_FIELDS = [
  ["genre", "Genre", ["Femme", "Homme", "Je préfère ne pas répondre"]],
  ["tranche_age", "Tranche d'âge", ["18-25 ans", "26-35 ans", "36-45 ans", "46-55 ans", "56 ans et +"]],
  ["anciennete", "Ancienneté dans l'entreprise", ["Moins d'1 an", "1 à 5 ans", "6 à 10 ans", "Plus de 10 ans"]],
];
const DEMO_SHORT = { "Je préfère ne pas répondre": "Non précisé" };
const ZONES = ["VERT", "ORANGE", "ROUGE"];
const ZONE_LABEL = { VERT: "Satisfaisant", ORANGE: "Vigilance", ROUGE: "À prendre en charge" };
const ZONE_CLS = { VERT: "vert", ORANGE: "orange", ROUGE: "rouge" };
const DIMS = ["A", "B", "C", "D", "E"];
const DIM_LABEL = { A: "Bien-être (WHO-5)", B: "Stress perçu (PSS-4)", C: "Épuisement (MBI-EE)", D: "Vécu au travail (QVT-5)", E: "Signaux d'alerte" };
const DIM_SHORT = { A: "Bien-être", B: "Stress", C: "Épuis.", D: "Vécu", E: "Signaux" };
const RECO = { VERT: "Aucune action particulière requise à ce stade.", ORANGE: "Une vigilance est recommandée ; un entretien de bilan est conseillé.", ROUGE: "Un entretien avec un professionnel est recommandé sans délai." };

const isComplete = (ans) => !!ans && ITEM_KEYS.every((k) => Number.isInteger(ans[k]));
/** Calcul simplifié pour la maquette (les vrais seuils restent dans bspa_core.py). */
function score(ans) {
  const v = (k, i) => Number(ans[`${k}${i}`] ?? 0);
  const sum = (k, n) => Array.from({ length: n }, (_, i) => v(k, i)).reduce((a, b) => a + b, 0);
  const a = sum("A", 5) * 4;
  const b = v("B", 0) + (4 - v("B", 1)) + (4 - v("B", 2)) + v("B", 3);
  const c = sum("C", 5), d = sum("D", 5), e = sum("E", 3);
  const strong = [0, 1, 2].some((i) => v("E", i) === 2);
  const dims = {
    A: { pct: a, zone: a >= 68 ? "VERT" : a >= 51 ? "ORANGE" : "ROUGE" },
    B: { pct: Math.round((b / 16) * 100), zone: b <= 7 ? "VERT" : b <= 11 ? "ORANGE" : "ROUGE" },
    C: { pct: Math.round((c / 30) * 100), zone: c <= 8 ? "VERT" : c <= 14 ? "ORANGE" : "ROUGE" },
    D: { pct: Math.round(((d - 5) / 20) * 100), zone: d >= 20 ? "VERT" : d >= 13 ? "ORANGE" : "ROUGE" },
    E: { pct: Math.round((e / 6) * 100), zone: strong ? "ROUGE" : e <= 1 ? "VERT" : "ORANGE" },
  };
  const reds = ["A", "B", "C", "D"].filter((k) => dims[k].zone === "ROUGE").length;
  const pts = Object.values(dims).reduce((s, x) => s + ZONES.indexOf(x.zone), 0);
  const profil = strong || reds >= 2 ? "ROUGE" : reds === 1 || pts >= 3 ? "ORANGE" : "VERT";
  return { dims, profil };
}

/* =====================================================================
 * Données fictives
 * ===================================================================== */
/** Entreprises : créées dans CETTE application (version autonome) par l'admin Yodan. « domain » = e-mail pro des salariés. */
const COMPANIES = [
  { id: "alpha", name: "Entreprise Démo Alpha", domain: "alpha.exemple.test", createdAt: "2025-10-06" },
  { id: "beta", name: "Société Test Beta", domain: "beta.exemple.test", createdAt: "2026-05-11" },
  { id: "gamma", name: "Groupe Fictif Gamma", domain: "gamma.exemple.test", createdAt: "2026-09-14" },
  { id: "delta", name: "Entreprise Exemple Delta", domain: "delta.exemple.test", createdAt: "2026-11-02" },
];
const FIRST = ["Aya", "Koffi", "Mariam", "Yao", "Fatou", "Serge", "Adjoua", "Ibrahim", "Clarisse", "Moussa", "Estelle", "Didier", "Nadia", "Paul", "Awa", "Hervé", "Salimata", "Franck"];
const LAST = ["Démo", "Test", "Exemple"];
const CONSENT_VERSION = "v1.2";
/*
 * accounts   : comptes Admin Yodan et RH ;
 * outbox     : e-mails envoyés (simulés) ;
 * challenges : codes à usage unique en cours (MFA à la connexion, mot de passe oublié) ;
 * fails      : échecs de connexion par adresse ; trusted : comptes « appareil de confiance ».
 */
const db = { people: [], campaigns: [], evals: [], audit: [], accounts: [], outbox: [], challenges: [], fails: {}, trusted: [] };
/** Session de l'application (qui est connecté). */
const session = { accountId: null };

const companyOf = (id) => COMPANIES.find((c) => c.id === id);
const campOf = (id) => db.campaigns.find((c) => c.id === id);
const personOf = (id) => db.people.find((p) => p.id === id);
const evalOf = (id) => db.evals.find((e) => e.id === id);
const displayName = (p) => (p && (p.prenom || p.nom) ? `${p.prenom} ${p.nom}`.trim() : "(nom non saisi)");
const campaignCode = (id) => { const r = rng(hash("code" + id)); const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 6 }, () => A[Math.floor(r() * A.length)]).join(""); };
const campaignUrl = (c) => `https://bspa.yodan.exemple.test/c/${c.code}`;

/**
 * Statut d'une participation, déduit des faits :
 *  - TERMINE        : questionnaire envoyé (completedAt) ;
 *  - NON_TERMINE    : lien ouvert et code validé (startedAt), questionnaire pas envoyé ;
 *  - PAS_DE_REPONSE : lien reçu par e-mail (invitedAt), jamais ouvert.
 */
function statusOf(ev) {
  if (ev.completedAt) return "TERMINE";
  return ev.startedAt ? "NON_TERMINE" : "PAS_DE_REPONSE";
}
const STATUS_PILL = { TERMINE: ["vert", "Terminé"], NON_TERMINE: ["bleu", "Non terminé"], PAS_DE_REPONSE: ["gris", "Pas de réponse"] };
const lastDateOf = (ev) => ev.completedAt || ev.startedAt || ev.invitedAt;
const newEval = (id, campaignId, personId) => ({ id, campaignId, personId, invitedAt: null, startedAt: null, completedAt: null, answers: null, demo: null, consent: null, reportSends: [] });
const resultOf = (ev) => (ev.completedAt && isComplete(ev.answers) ? score(ev.answers) : null);

(function seed() {
  const R = rng(20261117);
  const pick = (arr, w) => { if (!w) return arr[Math.floor(R() * arr.length)]; let x = R() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
  const risk = {};
  [["alpha", 40], ["beta", 16], ["gamma", 10]].forEach(([cid, n]) => {
    const co = companyOf(cid);
    for (let i = 0; i < n; i++) {
      const prenom = FIRST[i % FIRST.length], nom = LAST[Math.floor(i / FIRST.length) % LAST.length];
      const id = `${cid}-p${i}`;
      db.people.push({ id, companyId: cid, prenom, nom, email: `${norm(prenom)}.${norm(nom)}@${co.domain}`,
        _demo: { genre: pick(DEMO_FIELDS[0][2], [5, 5, 1]), tranche_age: pick(DEMO_FIELDS[1][2], [2, 5, 5, 3, 1]), anciennete: pick(DEMO_FIELDS[2][2], [2, 5, 3, 3]) } });
      risk[id] = Math.pow(R(), 1.5);
    }
  });
  const answersFor = (rk) => {
    const p = (x, max, min = 0) => Math.max(min, Math.min(max, Math.round(x + (R() - 0.5) * 1.8)));
    const a = {};
    for (let i = 0; i < 5; i++) a[`A${i}`] = p((1 - rk) * 5, 5);
    [0, 3].forEach((i) => (a[`B${i}`] = p(rk * 4, 4)));
    [1, 2].forEach((i) => (a[`B${i}`] = p((1 - rk) * 4, 4)));
    for (let i = 0; i < 5; i++) a[`C${i}`] = p(rk * 6, 6);
    for (let i = 0; i < 5; i++) a[`D${i}`] = p(1 + (1 - rk) * 4, 5, 1);
    for (let i = 0; i < 3; i++) a[`E${i}`] = p(rk * 1.5, 2);
    return a;
  };
  // [id, entreprise, nom, début, fin, ont ouvert le lien, dont terminés, invités par e-mail sans réponse]
  [["a1", "alpha", "Bilan T4 2025", "2025-11-03", "2025-11-21", 30, 27, 4],
   ["a2", "alpha", "Bilan T2 2026", "2026-05-04", "2026-05-22", 32, 29, 3],
   ["a3", "alpha", "Bilan T4 2026", "2026-11-03", "2026-11-30", 26, 20, 8],
   ["a4", "alpha", "Bilan T1 2027", "2027-01-11", "2027-01-29", 0, 0, 10],
   ["b1", "beta", "Pilote 2026", "2026-06-01", "2026-06-12", 6, 4, 2],
   ["b2", "beta", "Bilan annuel 2026", "2026-11-10", "2026-12-04", 12, 9, 3],
   ["g1", "gamma", "Lancement 2026", "2026-12-01", "2026-12-12", 0, 0, 0],
  ].forEach(([id, cid, name, start, end, n, done, inv], k) => {
    const createdAt = addDays(start, -14) < TODAY ? addDays(start, -14) : TODAY;
    db.campaigns.push({ id, companyId: cid, name, start, end, code: campaignCode(id), createdAt });
    const pool = db.people.filter((p) => p.companyId === cid).map((p) => [R(), p]).sort((x, y) => x[0] - y[0]).map(([, p]) => p).slice(0, n + inv);
    const last = end < TODAY ? end : TODAY;
    const between = (a, b) => addDays(a, Math.floor(R() * (daysBetween(a, b) + 1)));
    pool.forEach((p, i) => {
      const ev = newEval(`${id}-e${i}`, id, p.id);
      if (i >= n) { ev.invitedAt = between(createdAt, last); db.evals.push(ev); return; }
      const startedAt = between(start, last);
      ev.startedAt = startedAt;
      if (i % 2 === 0) ev.invitedAt = between(createdAt, startedAt); // les autres sont arrivés par le QR code
      if (i < done) {
        const completedAt = addDays(startedAt, Math.min(Math.floor(R() * 2), daysBetween(startedAt, last)));
        const rk = Math.max(0, Math.min(1, risk[p.id] + (R() - 0.5) * 0.25 + (k % 2 ? 0.05 : 0)));
        Object.assign(ev, { completedAt, answers: answersFor(rk), demo: { ...p._demo }, consent: { at: startedAt, version: CONSENT_VERSION }, reportSends: [completedAt] });
      }
      db.evals.push(ev);
    });
  });
  db.people.forEach((p) => {
    delete p._demo;
    // Le nom n'est connu que par le formulaire : une personne seulement invitée n'a que son e-mail.
    if (!db.evals.some((e) => e.personId === p.id && e.startedAt)) Object.assign(p, { prenom: "", nom: "" });
  });
})();

/* =====================================================================
 * Règles métier (fonctions pures, partagées par les écrans et tests.js)
 * ===================================================================== */
/** Journal des accès : identifiant de compte (pas d'e-mail en clair), jamais de mot de passe, de code ni de donnée de santé. */
function audit(action, target, who = session.accountId || "système") { db.audit.push({ at: TODAY, who, action, target }); }

/** Contrôle de l'e-mail pro : domaine EXACT de l'entreprise (pas de sous-domaine ni de suffixe). */
function emailAllowed(email, company) {
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email).trim().toLowerCase());
  return !!m && m[1] === company.domain;
}
function validateCampaign({ name, companyId, start, end }, today = TODAY) {
  const errors = {}, n = String(name || "").trim();
  if (!n) errors.name = "Donnez un nom à la campagne.";
  else if (n.length > 80) errors.name = "80 caractères maximum.";
  else if (db.campaigns.some((c) => c.companyId === companyId && norm(c.name) === norm(n))) errors.name = "Cette entreprise a déjà une campagne avec ce nom.";
  if (!companyOf(companyId)) errors.companyId = "Choisissez une entreprise.";
  if (!start) errors.start = "Indiquez la date de début.";
  if (!end) errors.end = "Indiquez la date de fin.";
  else if (start && end < start) errors.end = "La date de fin doit être le même jour ou après la date de début.";
  else if (end < today) errors.end = "Cette date de fin est déjà passée.";
  return errors;
}
function createCampaign(input, today = TODAY) {
  const errors = validateCampaign(input, today);
  if (Object.keys(errors).length) return { ok: false, errors };
  const id = "n" + (db.campaigns.length + 1) + "-" + hash(input.name + Date.now()).toString(36).slice(0, 4);
  const c = { id, companyId: input.companyId, name: String(input.name).trim(), start: input.start, end: input.end, code: campaignCode(id), createdAt: today };
  db.campaigns.push(c);
  return { ok: true, campaign: c };
}
/** Liste d'adresses collée pour l'envoi du lien : acceptées / refusées avec la raison. */
function parseRecipients(text, company) {
  const ok = [], refused = [], seen = new Set();
  String(text).split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).forEach((m) => {
    if (seen.has(m)) refused.push({ email: m, reason: "En double" });
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) refused.push({ email: m, reason: "Adresse invalide" });
    else if (!emailAllowed(m, company)) refused.push({ email: m, reason: `Domaine différent de @${company.domain}` });
    else ok.push(m);
    seen.add(m);
  });
  return { ok, refused };
}
/** Découpe une ligne CSV (gère les guillemets et les "" échappés). */
function splitCsvLine(line, d) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
/**
 * Extrait la colonne e-mail d'un fichier CSV (séparateur ; , ou tabulation, BOM Excel accepté).
 * Seules les adresses sont gardées : les autres colonnes (nom, prénom…) sont ignorées (minimisation).
 */
function parseCsvEmails(text) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim());
  if (firstIdx < 0) return { error: "Le fichier est vide." };
  const delim = [";", ",", "\t"].map((d) => [d, splitCsvLine(lines[firstIdx], d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const head = splitCsvLine(lines[firstIdx], delim).map((c) => c.trim());
  let col = head.findIndex((c) => /^(e-?mail|courriel|adresse)/i.test(c)), start = firstIdx + 1;
  if (col < 0) {
    col = head.findIndex((c) => c.includes("@"));
    if (col < 0) return { error: "Colonne « email » introuvable : la première ligne doit contenir un en-tête « email »." };
    start = firstIdx; // pas d'en-tête : la première ligne contient déjà des adresses
  }
  const emails = [], missing = [];
  lines.forEach((l, i) => {
    if (i < start || !l.trim()) return;
    const v = (splitCsvLine(l, delim)[col] || "").trim();
    if (v) emails.push(v); else missing.push(i + 1);
  });
  if (!emails.length && !missing.length) return { error: "Aucune ligne après l'en-tête." };
  return { emails, missing };
}
/** Adresses collées + fichier CSV → acceptées / refusées (doublons entre les deux sources compris). */
function collectRecipients(paste, csvText, company) {
  let csv = { emails: [], missing: [] };
  if (csvText != null) { csv = parseCsvEmails(csvText); if (csv.error) return { error: csv.error, ok: [], refused: [] }; }
  const r = parseRecipients([paste || "", ...csv.emails].join("\n"), company);
  csv.missing.forEach((n) => r.refused.push({ email: `Ligne ${n} du fichier`, reason: "Adresse manquante" }));
  return r;
}
/** Retrouve (ou crée) la personne et sa participation à la campagne. */
function findOrCreate(c, email) {
  let p = db.people.find((x) => x.email === email);
  if (!p) { p = { id: "p" + (db.people.length + 1) + "-" + hash(email).toString(36).slice(0, 4), companyId: c.companyId, prenom: "", nom: "", email }; db.people.push(p); }
  let ev = db.evals.find((e) => e.campaignId === c.id && e.personId === p.id);
  if (!ev) { ev = newEval(c.id + "-e" + (db.evals.length + 1), c.id, p.id); db.evals.push(ev); }
  return { p, ev };
}
/**
 * Envoi (ou renvoi) du lien de campagne par e-mail : chaque destinataire apparaît en « Pas de réponse »
 * jusqu'à ce qu'il ouvre le lien. Une personne qui a déjà terminé n'est pas relancée.
 */
function inviteRecipients(campaignId, emails, today = TODAY) {
  const c = campOf(campaignId), co = companyOf(c.companyId);
  if (campaignState(c, today) === "TERMINEE") return { ok: false, reason: "CLOSED" };
  const out = { ok: true, invited: 0, reminded: 0, skipped: [] };
  emails.forEach((raw) => {
    const email = String(raw).trim().toLowerCase();
    if (!emailAllowed(email, co)) { out.skipped.push({ email, reason: "DOMAIN" }); return; }
    const existed = db.evals.some((e) => e.campaignId === c.id && db.people.find((p) => p.id === e.personId)?.email === email);
    const { ev } = findOrCreate(c, email);
    if (ev.completedAt) { out.skipped.push({ email, reason: "ALREADY" }); return; }
    ev.invitedAt = today;
    existed ? out.reminded++ : out.invited++;
  });
  return out;
}
/** Après le code OTP : la participation passe en « Non terminé » (créée si la personne arrive par le QR code). */
function startParticipation(campaignId, email, today = TODAY) {
  const c = campOf(campaignId), co = companyOf(c.companyId);
  if (!availability(c, today).open) return { ok: false, reason: "CLOSED" };
  email = String(email).trim().toLowerCase();
  if (!emailAllowed(email, co)) return { ok: false, reason: "DOMAIN" };
  const { p, ev } = findOrCreate(c, email);
  if (ev.completedAt) return { ok: false, reason: "ALREADY", evaluation: ev, person: p };
  ev.startedAt ||= today;
  return { ok: true, evaluation: ev, person: p };
}
/** Envoi du formulaire : le rapport part TOUJOURS par e-mail (lien), jamais affiché directement. */
function submitEvaluation({ campaignId, email, prenom, nom, demo, answers, consent }, today = TODAY) {
  if (!consent) return { ok: false, reason: "CONSENT" };
  if (!isComplete(answers)) return { ok: false, reason: "INCOMPLETE" };
  const st = startParticipation(campaignId, email, today);
  if (!st.ok) return st;
  const { evaluation: ev, person: p } = st;
  Object.assign(p, { prenom: String(prenom || "").trim(), nom: String(nom || "").trim() });
  Object.assign(ev, { answers: { ...answers }, demo: { ...demo }, completedAt: today, consent: { at: today, version: CONSENT_VERSION }, reportSends: [today] });
  return { ok: true, evaluation: ev, result: score(ev.answers) };
}
function sendReportLink(evId, today = TODAY) {
  const ev = evalOf(evId);
  if (!ev || statusOf(ev) !== "TERMINE") return false;
  ev.reportSends.push(today);
  audit("RAPPORT_LIEN_RENVOYE", evId);
  return true;
}

/** Filtres communs Yodan (entreprise, campagne, patient). */
function normalizeFilters(f) {
  const g = { ...f };
  if (g.campaign !== "all") { const c = campOf(g.campaign); if (!c || (g.company !== "all" && c.companyId !== g.company)) g.campaign = "all"; }
  if (g.person) { const p = personOf(g.person); if (!p || (g.company !== "all" && p.companyId !== g.company)) g.person = ""; }
  return g;
}
function scopeEvals({ company = "all", campaign = "all", person = "" } = {}) {
  return db.evals.filter((ev) => {
    const c = campOf(ev.campaignId);
    return (company === "all" || c.companyId === company) && (campaign === "all" || ev.campaignId === campaign) && (!person || ev.personId === person);
  });
}
/** Agrégat unique utilisé par le tableau de bord Yodan, le tableau de bord RH et les tests. */
function aggregate(evals) {
  const rows = evals.map((e) => ({ e, st: statusOf(e), r: resultOf(e) }));
  const done = rows.filter((x) => x.st === "TERMINE");
  const prof = [0, 0, 0];
  done.forEach((x) => prof[ZONES.indexOf(x.r.profil)]++);
  const dims = Object.fromEntries(DIMS.map((k) => [k, done.length ? Math.round(done.reduce((s, x) => s + x.r.dims[k].pct, 0) / done.length) : 0]));
  const by = Object.fromEntries(DEMO_FIELDS.map(([k, , choices]) => [k, choices.map((lbl) => {
    const z = [0, 0, 0];
    done.filter((x) => x.e.demo[k] === lbl).forEach((x) => z[ZONES.indexOf(x.r.profil)]++);
    return [DEMO_SHORT[lbl] || lbl, z];
  })]));
  return {
    participations: rows.length, done: done.length,
    nonTermine: rows.filter((x) => x.st === "NON_TERMINE").length, pasDeReponse: rows.filter((x) => x.st === "PAS_DE_REPONSE").length,
    prof, dims, by,
    alertes: done.filter((x) => x.r.dims.E.zone === "ROUGE").length,
  };
}
const MIN_GROUP = 5;
/** Modèle de l'écran RH : agrégé, seuil de 5, uniquement son entreprise et ses campagnes commencées. */
function rhModel(companyId, campaignId = "all") {
  const co = companyOf(companyId);
  if (!co) return { error: "FORBIDDEN" };
  const own = db.campaigns.filter((c) => c.companyId === companyId);
  const started = own.filter((c) => campaignState(c) !== "AVENIR").sort((a, b) => b.start.localeCompare(a.start));
  if (campaignId !== "all" && !started.some((c) => c.id === campaignId)) return { error: "FORBIDDEN" };
  // Uniquement les campagnes commencées : les invitations d'une campagne à venir ne sont pas comptées.
  const startedIds = new Set(started.map((c) => c.id));
  const A = aggregate(scopeEvals({ company: companyId, campaign: campaignId }).filter((e) => startedIds.has(e.campaignId)));
  const masked = A.done < MIN_GROUP;
  const group = (rows) => rows.map(([label, z]) => { const n = z[0] + z[1] + z[2]; return n >= MIN_GROUP ? { label, n, z } : { label, masked: true }; });
  return {
    company: { name: co.name },
    campaigns: started.map((c) => ({ id: c.id, name: c.name, start: c.start, end: c.end, state: campaignState(c) })),
    upcoming: own.filter((c) => campaignState(c) === "AVENIR").map((c) => ({ name: c.name, start: c.start, end: c.end })),
    done: A.done, nonTermine: A.nonTermine, pasDeReponse: A.pasDeReponse, masked,
    prof: masked ? null : A.prof, dims: masked ? null : A.dims,
    by: masked ? null : Object.fromEntries(Object.entries(A.by).map(([k, rows]) => [k, group(rows)])),
    compare: campaignId !== "all" ? null : started.map((c) => {
      const a = aggregate(scopeEvals({ company: companyId, campaign: c.id }));
      return a.done >= MIN_GROUP ? { id: c.id, name: c.name, start: c.start, end: c.end, state: campaignState(c), done: a.done, prof: a.prof, wellbeing: a.dims.A } : null;
    }).filter(Boolean),
  };
}
/** Lignes de la liste des participants (même périmètre que le tableau de bord + filtres de liste). */
function listRows(f, lf = { q: "", status: "all", profil: "all" }) {
  return scopeEvals(f).map((e) => ({ e, c: campOf(e.campaignId), p: personOf(e.personId), st: statusOf(e), r: resultOf(e) }))
    .filter((x) => (!lf.q.trim() || norm(displayName(x.p) + " " + x.p.email).includes(norm(lf.q.trim()))) &&
      (lf.status === "all" || x.st === lf.status) &&
      (lf.profil === "all" || (lf.profil === "none" ? !x.r : x.r && x.r.profil === lf.profil)))
    .sort((a, b) => lastDateOf(b.e).localeCompare(lastDateOf(a.e)) || displayName(a.p).localeCompare(displayName(b.p)) || a.p.email.localeCompare(b.p.email));
}

/* =====================================================================
 * Comptes, connexion, mots de passe (Admin Yodan + RH)
 * ===================================================================== */
// TODO SECURITE: maquette uniquement. En production : mots de passe et codes stockés HACHÉS (Argon2id),
// générés par un générateur cryptographique, sessions côté serveur avec expiration après inactivité.
const PW_MIN = 12, MAX_FAILS = 5, ACTIVATION_DAYS = 3, CODE_TRIES = 5, SESSION_IDLE_MIN = 30;
const ACTIVATION_URL = "https://bspa.yodan.exemple.test/activation/";
const LOGIN_URL = "https://bspa.yodan.exemple.test/connexion";
const ROLE_LABEL = { YODAN: "Médecin Yodan", RH: "RH entreprise" };
const ACCOUNT_PILL = { INVITE: ["bleu", "Invitation envoyée"], EXPIREE: ["orange", "Invitation expirée"], ACTIF: ["vert", "Actif"], DESACTIVE: ["gris", "Désactivé"] };
/** Messageries publiques : jamais acceptées comme domaine d'entreprise. */
const PUBLIC_DOMAINS = ["gmail.com", "yahoo.fr", "yahoo.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "live.fr", "icloud.com", "orange.fr", "gmail.exemple.test"];
const normEmail = (e) => String(e ?? "").trim().toLowerCase();
const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const accountOf = (id) => db.accounts.find((a) => a.id === id);
const accountByEmail = (email) => db.accounts.find((a) => a.email === normEmail(email));
/** État d'un compte, déduit des faits (désactivé, mot de passe choisi, lien d'activation et sa date). */
function accountStatus(a, today = TODAY) {
  if (a.disabled) return "DESACTIVE";
  if (a.pw) return "ACTIF";
  return a.activation && a.activation.expires >= today ? "INVITE" : "EXPIREE";
}
/** Le compte RH (un seul non désactivé par entreprise). */
const rhOf = (companyId) => db.accounts.find((a) => a.role === "RH" && a.companyId === companyId && !a.disabled) || null;
const pwRand = rng(424242);
/** Jeton du lien d'activation (en production : 32 octets aléatoires cryptographiques, stocké haché). */
function genToken() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 24 }, () => A[Math.floor(pwRand() * A.length)]).join("");
}
function sendMail(to, kind, subject, lines) { db.outbox.push({ at: TODAY, to, kind, subject, lines }); }
/** (Re)génère le lien d'activation et envoie l'invitation : l'ancien lien ne marche plus. Aucun mot de passe ne circule par e-mail. */
function issueInvitation(a) {
  a.activation = { token: genToken(), expires: addDays(TODAY, ACTIVATION_DAYS) };
  sendMail(a.email, "INVITATION", "Activez votre accès YODAN BSPA", [
    "Bonjour,",
    `Un compte ${ROLE_LABEL[a.role]} a été créé pour vous${a.companyId ? ` (${companyOf(a.companyId).name})` : ""}.`,
    `Pour l'activer et choisir votre mot de passe : ${ACTIVATION_URL}${a.activation.token}`,
    `Ce lien est personnel, utilisable une seule fois, et valable jusqu'au ${fmt(a.activation.expires)}.`,
    "Si vous n'attendiez pas cet e-mail, ignorez-le."]);
}
(function seedAccounts() {
  const mk = (id, email, role, companyId, pw, extra = {}) =>
    db.accounts.push({ id, email, role, companyId, pw, activation: null, disabled: false, createdAt: "2026-10-01", lastLoginAt: pw ? "2026-11-16" : null, ...extra });
  // Admin Yodan : créé par le seed de la base (e-mail lu dans .env), pas d'écran de création.
  mk("u-yodan", "medecin.demo@yodan.exemple.test", "YODAN", null, "Demo-Yodan-2026");
  mk("u-alpha", "rh.demo@alpha.exemple.test", "RH", "alpha", "Demo-RhAlpha-2026");
  mk("u-beta", "rh.test@beta.exemple.test", "RH", "beta", null, { createdAt: TODAY });
  issueInvitation(accountOf("u-beta"));
  mk("u-gamma-old", "ancien.rh@gamma.exemple.test", "RH", "gamma", "Ancien-RhGamma-2026", { disabled: true, createdAt: "2026-09-14" });
  mk("u-gamma", "rh.exemple@gamma.exemple.test", "RH", "gamma", "Demo-RhGamma-2026");
  mk("u-delta", "rh.demo@delta.exemple.test", "RH", "delta", null, { createdAt: "2026-11-02", activation: { token: "LienExpireDeltaDemo2026x", expires: "2026-11-05" } });
})();

/* ---------- Entreprises et compte RH (admin Yodan) ---------- */
function cleanDomain(v) { let d = normEmail(v); if (d.includes("@")) d = d.split("@").pop(); return d; }
function validateRhEmail(email, domain) {
  const e = normEmail(email);
  if (!e) return "Indiquez l'e-mail du RH.";
  if (!isEmail(e)) return "Adresse e-mail invalide.";
  if (domain && e.split("@")[1] !== domain) return `L'e-mail du RH doit être une adresse @${domain}.`;
  if (accountByEmail(e)) return "Un compte existe déjà avec cette adresse.";
  return "";
}
function validateName(name, exceptId = null) {
  const n = String(name || "").trim();
  if (!n) return "Indiquez le nom de l'entreprise.";
  if (n.length > 120) return "120 caractères maximum.";
  if (COMPANIES.some((c) => c.id !== exceptId && norm(c.name) === norm(n))) return "Une entreprise porte déjà ce nom.";
  return "";
}
function validateDomain(d, exceptId = null) {
  if (!d) return "Indiquez le domaine e-mail pro (ex. entreprise.ci).";
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return "Domaine invalide (ex. entreprise.ci).";
  if (PUBLIC_DOMAINS.includes(d)) return "Messagerie publique refusée : indiquez le domaine propre à l'entreprise.";
  if (COMPANIES.some((c) => c.id !== exceptId && c.domain === d)) return "Ce domaine est déjà utilisé par une autre entreprise.";
  return "";
}
function validateCompany({ name, domain, rhEmail }) {
  const errors = {}, d = cleanDomain(domain);
  const ne = validateName(name), de = validateDomain(d);
  if (ne) errors.name = ne;
  if (de) errors.domain = de;
  const re = validateRhEmail(rhEmail, de ? "" : d);
  if (re) errors.rhEmail = re;
  return errors;
}
function newRhAccount(companyId, email) {
  const a = { id: "u-" + hash(email + db.accounts.length).toString(36), email: normEmail(email), role: "RH", companyId, pw: null, activation: null, disabled: false, createdAt: TODAY, lastLoginAt: null };
  db.accounts.push(a);
  issueInvitation(a);
  audit("COMPTE_RH_CREE", a.id);
  return a;
}
/** Création d'une entreprise + de son compte RH (invitation avec lien d'activation par e-mail). */
function createCompany(input) {
  const errors = validateCompany(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const name = String(input.name).trim();
  const company = { id: norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) + "-" + (COMPANIES.length + 1), name, domain: cleanDomain(input.domain), createdAt: TODAY };
  COMPANIES.push(company);
  audit("ENTREPRISE_CREEE", company.id);
  const account = newRhAccount(company.id, input.rhEmail);
  return { ok: true, company, account };
}
/**
 * Le domaine ne peut plus changer dès qu'une campagne a commencé ou qu'une invitation / participation existe :
 * sinon les participants déjà enregistrés ne correspondraient plus au domaine de l'entreprise.
 */
function domainLocked(companyId) {
  return db.campaigns.some((c) => c.companyId === companyId && campaignState(c) !== "AVENIR") ||
    db.evals.some((e) => campOf(e.campaignId).companyId === companyId);
}
/** Modification : le nom toujours ; le domaine si non verrouillé, et alors le RH doit être remplacé (adresse du nouveau domaine). */
function updateCompany(companyId, { name, domain, rhEmail }) {
  const co = companyOf(companyId), errors = {}, d = cleanDomain(domain);
  const ne = validateName(name, companyId);
  if (ne) errors.name = ne;
  const domainChanged = d !== co.domain;
  if (domainChanged) {
    const de = domainLocked(companyId) ? "Le domaine ne peut plus être modifié : une campagne a commencé ou des invitations ont été envoyées." : validateDomain(d, companyId);
    if (de) errors.domain = de;
    else { const re = validateRhEmail(rhEmail, d); if (re) errors.rhEmail = re; }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  co.name = String(name).trim();
  audit("ENTREPRISE_MODIFIEE", companyId);
  if (!domainChanged) return { ok: true, company: co, account: null };
  co.domain = d;
  return { ok: true, company: co, account: replaceRh(companyId, rhEmail).account };
}
function resendInvitation(accountId) {
  const a = accountOf(accountId);
  if (!a || !["INVITE", "EXPIREE"].includes(accountStatus(a))) return false;
  issueInvitation(a);
  audit("INVITATION_RENVOYEE", a.id);
  return true;
}
/** Un seul compte RH par entreprise : le nouveau remplace l'ancien, qui est désactivé immédiatement. */
function replaceRh(companyId, email) {
  const co = companyOf(companyId);
  const error = validateRhEmail(email, co.domain);
  if (error) return { ok: false, error };
  const old = rhOf(companyId);
  if (old) { old.disabled = true; db.trusted = db.trusted.filter((id) => id !== old.id); audit("COMPTE_RH_DESACTIVE", old.id); }
  return { ok: true, account: newRhAccount(companyId, email), replaced: old };
}
function setRhDisabled(accountId, disabled) {
  const a = accountOf(accountId);
  if (!a || a.role !== "RH") return { ok: false };
  if (!disabled && rhOf(a.companyId) && rhOf(a.companyId).id !== a.id) return { ok: false, error: "Cette entreprise a déjà un compte RH actif." };
  a.disabled = disabled;
  if (disabled) db.trusted = db.trusted.filter((id) => id !== a.id);
  audit(disabled ? "COMPTE_RH_DESACTIVE" : "COMPTE_RH_REACTIVE", a.id);
  return { ok: true };
}

/* ---------- Activation par lien, puis connexion : mot de passe → code par e-mail (MFA) ---------- */
function startChallenge(email, purpose) {
  db.challenges = db.challenges.filter((c) => !(c.email === email && c.purpose === purpose)); // l'ancien code ne marche plus
  db.challenges.push({ email, purpose, code: FAKE_OTP, tries: 0 });
  sendMail(email, purpose === "MFA" ? "CODE_CONNEXION" : "CODE_REINIT", purpose === "MFA" ? "Votre code de connexion" : "Réinitialisation de votre mot de passe", [
    `Votre code : ${FAKE_OTP}`, "Il expire dans 10 minutes.",
    purpose === "MFA" ? "Si vous n'essayez pas de vous connecter, changez votre mot de passe." : "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."]);
}
function checkChallenge(email, purpose, code) {
  const c = db.challenges.find((x) => x.email === email && x.purpose === purpose);
  if (!c) return "EXPIRED";
  if (c.tries >= CODE_TRIES) return "TOO_MANY";
  if (String(code) !== c.code) { c.tries++; return c.tries >= CODE_TRIES ? "TOO_MANY" : "BAD"; }
  db.challenges = db.challenges.filter((x) => x !== c);
  return "OK";
}
function finishLogin(a) {
  a.lastLoginAt = TODAY;
  audit("CONNEXION_OK", a.id, a.id);
  return { ok: true, next: "HOME", accountId: a.id };
}
/**
 * Étape 1 : e-mail + mot de passe. Réponse identique pour une adresse inconnue, un compte désactivé
 * ou un mauvais mot de passe (on ne révèle pas quels comptes existent).
 */
function login(email, password, today = TODAY) {
  const e = normEmail(email);
  db.fails[e] = db.fails[e] || 0;
  if (db.fails[e] >= MAX_FAILS) return { ok: false, reason: "LOCKED" };
  const a = accountByEmail(e);
  const good = a && !a.disabled && a.pw && password === a.pw; // un compte pas encore activé n'a pas de mot de passe
  if (!good) {
    db.fails[e]++;
    audit("CONNEXION_ECHEC", "adresse#" + hash(e).toString(36), "anonyme"); // adresse pseudonymisée
    return { ok: false, reason: db.fails[e] >= MAX_FAILS ? "LOCKED" : "BAD" };
  }
  db.fails[e] = 0;
  if (db.trusted.includes(a.id)) return finishLogin(a);
  startChallenge(a.email, "MFA");
  return { ok: true, next: "MFA", accountId: a.id };
}
/** Étape 2 : code reçu par e-mail. « Se souvenir de cet appareil » évite le code pendant 30 jours. */
function verifyMfa(accountId, code, remember = false) {
  const a = accountOf(accountId);
  if (!a || a.disabled) return { ok: false, reason: "BAD" };
  const r = checkChallenge(a.email, "MFA", code);
  if (r !== "OK") return { ok: false, reason: r };
  if (remember && !db.trusted.includes(a.id)) db.trusted.push(a.id);
  return finishLogin(a);
}
function passwordChecks(pw, a) {
  const local = a ? a.email.split("@")[0] : "";
  return [
    ["min", `Au moins ${PW_MIN} caractères`, pw.length >= PW_MIN],
    ["case", "Une majuscule et une minuscule", /[a-z]/.test(pw) && /[A-Z]/.test(pw)],
    ["digit", "Au moins un chiffre", /\d/.test(pw)],
    ["email", "Ne contient pas votre adresse e-mail", !local || !norm(pw).includes(norm(local))],
    ["reuse", "Différent du mot de passe actuel", !a || pw !== a.pw],
  ].map(([id, label, ok]) => ({ id, label, ok }));
}
/** Activation du compte, « mot de passe oublié » ou changement : nouveau mot de passe. */
function setPassword(accountId, pw, confirm, source = "CHANGE") {
  const a = accountOf(accountId);
  if (!a || a.disabled) return { ok: false, reason: "BAD" };
  const checks = passwordChecks(pw, a);
  if (checks.some((c) => !c.ok)) return { ok: false, reason: "RULES", checks };
  if (pw !== confirm) return { ok: false, reason: "CONFIRM" };
  a.pw = pw; a.activation = null; // le lien d'activation ne servira plus
  db.fails[a.email] = 0;
  db.trusted = db.trusted.filter((id) => id !== a.id); // nouveau mot de passe = on redemande le code partout
  audit({ RESET: "MDP_REINITIALISE", ACTIVATION: "COMPTE_ACTIVE" }[source] || "MDP_CHANGE", a.id, a.id);
  return { ok: true };
}
/** Lien d'activation : valide seulement pour un compte non désactivé, pas encore activé, avant expiration. */
function activationAccount(token, today = TODAY) {
  const a = token && db.accounts.find((x) => x.activation && x.activation.token === token);
  if (!a || a.disabled || a.pw) return { ok: false, reason: "INVALID" };
  if (a.activation.expires < today) return { ok: false, reason: "EXPIRED" };
  return { ok: true, accountId: a.id };
}
function activateAccount(token, pw, confirm, today = TODAY) {
  const r = activationAccount(token, today);
  return r.ok ? setPassword(r.accountId, pw, confirm, "ACTIVATION") : r;
}
/** Déconnexion automatique après inactivité. */
const isIdleExpired = (lastActivity, now, minutes = SESSION_IDLE_MIN) => now - lastActivity >= minutes * 60000;
/** Mot de passe oublié : même réponse que le compte existe ou non ; un code n'est envoyé qu'à un compte valide. */
function forgotStart(email) {
  const a = accountByEmail(email);
  if (a && !a.disabled) { startChallenge(a.email, "RESET"); audit("MDP_OUBLIE_DEMANDE", a.id, a.id); }
  return { ok: true };
}
function forgotVerify(email, code) {
  const a = accountByEmail(email);
  if (!a || a.disabled) return { ok: false, reason: "BAD" };
  const r = checkChallenge(a.email, "RESET", code);
  return r === "OK" ? { ok: true, accountId: a.id } : { ok: false, reason: r };
}
/** Droits : un compte doit être actif (mot de passe définitif) ; Yodan → espace Yodan, RH → son entreprise seulement. */
function canAccess(accountId, area, companyId = null) {
  const a = accountOf(accountId);
  if (!a || accountStatus(a) !== "ACTIF") return false;
  if (area === "yodan") return a.role === "YODAN";
  if (area === "rh") return a.role === "RH" && (!companyId || a.companyId === companyId);
  return false;
}

/* =====================================================================
 * État d'interface + rendu général
 * ===================================================================== */
const ROLES = [
  { id: "app", label: "Application (connexion Yodan / RH)" },
  { id: "participant", label: "Participant (lien de campagne)" },
];
const LF_DEFAULT = { q: "", status: "all", profil: "all", page: 1, size: 10 };
const AUTH_DEFAULT = { screen: "login", email: "", accountId: null, err: "", info: "", remember: false };
const state = {
  role: "app", device: "pc", notes: true,
  auth: { ...AUTH_DEFAULT },
  ent: { q: "", page: 1, size: 10 },
  yodan: { tab: "campagnes", cf: { q: "", company: "all", etat: "all", page: 1, size: 10 },
    f: { company: "all", campaign: "all", person: "" }, lf: { ...LF_DEFAULT }, sel: new Set(), by: "tranche_age" },
  rh: { company: "alpha", campaign: "all", by: "tranche_age", cmp: { page: 1, size: 5 } },
  part: null,
};
function resetPart(campaignId = state.part?.campaignId || "a3") {
  state.part = { campaignId, step: availability(campOf(campaignId)).open ? "email" : "closed", email: "", otpTries: 0, page: 0, ans: {}, demo: {}, prenom: "", nom: "", consent: false, evId: null, err: "" };
}
resetPart("a3");

function render() {
  $$("#role-switch button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
  $("#role-select").value = state.role;
  $$(".device-switch button").forEach((b) => b.classList.toggle("on", b.dataset.device === state.device));
  const stage = $("#stage");
  stage.innerHTML = "";
  let root = stage;
  if (state.device === "mobile") {
    const wrap = h(`<div class="phone-wrap"><div class="phone"><div class="phone-screen"></div></div></div>`);
    stage.append(wrap);
    root = $(".phone-screen", wrap);
  }
  ({ app: renderApp, participant: renderParticipant })[state.role](root);
  $$("[data-logout]", stage).forEach((b) => b.addEventListener("click", logout));
  renderNotes();
}
/** Point d'entrée unique : page de connexion, puis l'espace correspondant au rôle du compte. */
function renderApp(root) {
  const a = session.accountId && accountOf(session.accountId);
  if (a && canAccess(a.id, "yodan")) return renderYodan(root);
  if (a && canAccess(a.id, "rh")) { if (state.rh.company !== a.companyId) Object.assign(state.rh, { company: a.companyId, campaign: "all" }); return renderRH(root); }
  session.accountId = null;
  renderAuth(root);
}
function openSession(accountId) { session.accountId = accountId; session.lastActivity = Date.now(); }
function idleLogout() {
  audit("DECONNEXION_INACTIVITE", session.accountId);
  session.accountId = null;
  state.auth = { ...AUTH_DEFAULT, info: `Vous avez été déconnecté(e) après ${SESSION_IDLE_MIN} minutes d'inactivité.` };
  state.role = "app";
  render(); scrollTop();
}
function checkIdle() { if (session.accountId && isIdleExpired(session.lastActivity, Date.now())) idleLogout(); }
function logout() {
  if (session.accountId) audit("DECONNEXION", session.accountId);
  session.accountId = null;
  state.auth = { ...AUTH_DEFAULT };
  render(); scrollTop();
}
const currentAccount = () => (session.accountId ? accountOf(session.accountId) : null);
const scrollTop = () => { $("#stage .phone-screen")?.scrollTo(0, 0); window.scrollTo(0, 0); };

/* ---------- Composants communs ---------- */
function paginate(list, f) {
  const pages = Math.max(1, Math.ceil(list.length / f.size));
  f.page = Math.min(Math.max(1, f.page), pages);
  return { rows: list.slice((f.page - 1) * f.size, f.page * f.size), pages };
}
function pagerHtml(total, f, pages, sizes = [5, 10, 25]) {
  const from = total ? (f.page - 1) * f.size + 1 : 0, to = Math.min(f.page * f.size, total);
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - f.page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return `<nav class="pager" aria-label="Pagination"><span class="small muted">${from}–${to} sur ${total}</span>
    <label class="small muted">Par page <select data-pg="size">${sizes.map((s) => `<option ${s === f.size ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <div class="pg-btns"><button type="button" data-pg="prev" ${f.page === 1 ? "disabled" : ""} aria-label="Page précédente">‹</button>
    ${nums.map((p) => (p === "…" ? `<span class="muted">…</span>` : `<button type="button" data-pg="${p}" class="${p === f.page ? "on" : ""}" ${p === f.page ? 'aria-current="page"' : ""}>${p}</button>`)).join("")}
    <button type="button" data-pg="next" ${f.page === pages ? "disabled" : ""} aria-label="Page suivante">›</button></div></nav>`;
}
function bindPager(root, f) {
  $$("[data-pg]", root).forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "click", () => {
    const v = el.dataset.pg;
    if (v === "size") { f.size = Number(el.value); f.page = 1; } else if (v === "prev") f.page--; else if (v === "next") f.page++; else f.page = Number(v);
    render();
  }));
}
const fSearch = (key, ph, f) => `<input type="search" data-f="${key}" value="${esc(f[key])}" placeholder="${ph}" aria-label="${ph}">`;
const fSelect = (key, label, options, f) => `<select data-f="${key}" aria-label="${label}">${options.map(([v, l]) => `<option value="${v}" ${f[key] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const filtersActive = (f, keys) => keys.some((k) => (k === "q" ? f.q.trim() !== "" : f[k] !== "all"));
function bindFilters(root, f, keys) {
  $$("[data-f]", root).forEach((el) => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
    f[el.dataset.f] = el.value; f.page = 1; render();
    const again = $(`#stage [data-f="${el.dataset.f}"]`);
    if (again && el.tagName === "INPUT") { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  }));
  $$("[data-freset]", root).forEach((b) => b.addEventListener("click", () => { keys.forEach((k) => (f[k] = k === "q" ? "" : "all")); f.page = 1; render(); }));
}
const kpi = (v, l, sub = "") => `<div class="card kpi"><div class="v">${v}</div><div class="l">${l}</div>${sub ? `<div class="small muted" style="margin-top:.3rem">${sub}</div>` : ""}</div>`;
const statePill = (c) => { const [cls, l] = STATE_PILL[campaignState(c)]; return `<span class="pill ${cls}">${l}</span>`; };
const zonePill = (z, txt) => `<span class="pill ${ZONE_CLS[z]}">${txt ?? ZONE_LABEL[z]}</span>`;
function stackBar([v, o, r], total) {
  if (!total) return `<div class="masked">Aucun bilan terminé</div>`;
  return `<div class="stack-bar" role="img" aria-label="${v} satisfaisant, ${o} vigilance, ${r} à prendre en charge">
    ${[["vert", v], ["orange", o], ["rouge", r]].map(([c, x]) => `<div class="${c}" style="width:${(x / total) * 100}%">${x / total >= 0.09 ? pct(x, total) + "%" : ""}</div>`).join("")}</div>`;
}
const legend = `<div class="legend"><span><i style="background:var(--vert)"></i>Satisfaisant</span><span><i style="background:var(--orange)"></i>Vigilance</span><span><i style="background:var(--rouge)"></i>À prendre en charge</span></div>`;
const dimZone = (k, v) => (k === "A" || k === "D" ? (v >= 68 ? "VERT" : v >= 51 ? "ORANGE" : "ROUGE") : v <= 45 ? "VERT" : v <= 65 ? "ORANGE" : "ROUGE");
const dimRows = (dims) => DIMS.map((k) => { const v = dims[k], z = dimZone(k, v); return `<div class="dim-row"><span>${DIM_LABEL[k]}</span><div class="meter"><span style="width:${v}%;background:var(--${ZONE_CLS[z]})"></span></div>${zonePill(z, v)}</div>`; }).join("");
const appBar = (who, tabs = "") => { const a = currentAccount(); return `<header class="app-bar"><img class="logo-img" src="logo-yodan.png" alt="YODAN">${tabs}<div class="spacer"></div>
  <div class="who"><span class="role-pill">${who}</span>${a ? `<span class="small muted hide-m">${esc(a.email)}</span><button type="button" class="btn btn-ghost btn-sm" data-logout>Se déconnecter</button>` : ""}</div></header>`; };

/* =====================================================================
 * ADMIN YODAN
 * ===================================================================== */
function renderYodan(root) {
  const y = state.yodan;
  const tabs = `<nav class="tabs" aria-label="Sections">${[["campagnes", "Campagnes"], ["tb", "Tableau de bord & participants"], ["entreprises", "Entreprises"]]
    .map(([k, l]) => `<button type="button" class="${y.tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</nav>`;
  const wrap = h(`<div>${appBar("Médecin Yodan", tabs)}<div class="page" id="ypage"></div></div>`);
  root.append(wrap);
  $$("[data-tab]", wrap).forEach((b) => b.addEventListener("click", () => { y.tab = b.dataset.tab; render(); scrollTop(); }));
  ({ campagnes: renderYCampaigns, tb: renderYDashboard, entreprises: renderYCompanies })[y.tab]($("#ypage", wrap));
}

/* ---------- Onglet 3 : Entreprises (création + compte RH) ---------- */
const mailLine = (l, maskSecrets, demoLinks) => {
  if (l.includes(ACTIVATION_URL)) {
    const [txt, token] = l.split(ACTIVATION_URL);
    if (maskSecrets) return `${esc(txt)}<span class="mono-s">${esc(ACTIVATION_URL)}••••••••</span>`;
    if (demoLinks) return `${esc(txt)}<br><button type="button" class="btn btn-primary btn-sm" data-demo-act="activate" data-v="${esc(token)}">Activer mon compte</button>`;
    return `${esc(txt)}<span class="mono-s">${esc(ACTIVATION_URL + token)}</span>`;
  }
  return esc(maskSecrets ? l.replace(/(Votre code : ).+/, "$1••••••") : l);
};
const mailHtml = (m, maskSecrets = false, demoLinks = false) => `<div class="mail"><div class="mail-head"><div><strong>De :</strong> YODAN &lt;ne-pas-repondre@yodan.exemple.test&gt;</div><div><strong>À :</strong> ${esc(m.to)}</div><div><strong>Objet :</strong> ${esc(m.subject)}</div></div>
  <div class="mail-body small">${m.lines.map((l) => mailLine(l, maskSecrets, demoLinks)).join("<br>")}</div></div>`;
function renderYCompanies(el) {
  const f = state.ent;
  const list = COMPANIES.filter((c) => !f.q.trim() || norm(c.name + " " + c.domain).includes(norm(f.q.trim()))).sort((a, b) => a.name.localeCompare(b.name));
  const { rows, pages } = paginate(list, f);
  el.append(h(`<div>
    <div class="page-head"><div><span class="kicker">Yodan · ${COMPANIES.length} entreprises clientes</span><h1 class="display">Entreprises</h1>
      <p class="muted small">Chaque entreprise a un domaine e-mail pro (contrôle des participants) et un seul compte RH.</p></div>
      <button type="button" class="btn btn-primary" data-act="new">+ Nouvelle entreprise</button></div>
    <div class="card">
      <div class="filters">${fSearch("q", "Rechercher une entreprise ou un domaine…", f)}</div>
      <div class="table-wrap"><table class="t-companies"><thead><tr><th>Entreprise</th><th>Domaine e-mail pro</th><th>Compte RH</th><th class="hide-m">Campagnes</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((c) => { const rh = rhOf(c.id), st = rh && accountStatus(rh), n = db.campaigns.filter((x) => x.companyId === c.id).length; return `<tr>
        <td><strong>${esc(c.name)}</strong><div class="small muted">créée le ${fmt(c.createdAt)}</div>
          <button type="button" class="btn btn-ghost btn-sm edit-link" data-act="edit" data-id="${c.id}">✎ Modifier</button></td>
        <td class="small">@${esc(c.domain)}</td>
        <td>${rh ? `${esc(rh.email)}<div><span class="pill ${ACCOUNT_PILL[st][0]}">${ACCOUNT_PILL[st][1]}</span>
            <span class="small muted">${st === "ACTIF" ? `dernière connexion ${fmt(rh.lastLoginAt)}` : st === "INVITE" ? `lien valable jusqu'au ${fmt(rh.activation.expires)}` : st === "EXPIREE" ? `lien expiré le ${fmt(rh.activation.expires)}` : ""}</span></div>`
          : `<span class="pill gris">Aucun compte RH actif</span>`}</td>
        <td class="hide-m small">${n}</td>
        <td class="actions">${rh && ["INVITE", "EXPIREE"].includes(st) ? `<button type="button" class="btn btn-sm" data-act="resend" data-id="${rh.id}">✉ Renvoyer l'invitation</button> ` : ""}
          <button type="button" class="btn btn-sm" data-act="replace" data-id="${c.id}">${rh ? "Remplacer le RH" : "Créer le compte RH"}</button>
          ${rh ? `<button type="button" class="btn btn-ghost btn-sm" data-act="disable" data-id="${rh.id}">Désactiver</button>` : ""}</td></tr>`; }).join("")
        : `<tr><td colspan="5" class="empty">Aucune entreprise ne correspond à la recherche.</td></tr>`}
      </tbody></table></div>
      ${pagerHtml(list.length, f, pages, [10, 25])}</div></div>`));
  bind(el, {
    new: () => newCompanyModal(),
    resend: (b) => { resendInvitation(b.dataset.id); toast("Nouveau lien d'activation envoyé : l'ancien ne fonctionne plus"); render(); },
    edit: (b) => editCompanyModal(companyOf(b.dataset.id)),
    replace: (b) => replaceRhModal(companyOf(b.dataset.id)),
    disable: (b) => {
      const a = accountOf(b.dataset.id);
      modal("Désactiver le compte RH", `<p>Le compte <strong>${esc(a.email)}</strong> ne pourra plus se connecter, immédiatement.</p>
        <p class="small muted">L'entreprise n'aura plus de RH tant que vous n'en créez pas un nouveau.</p>
        <div class="row end"><button type="button" class="btn" data-x>Annuler</button><button type="button" class="btn btn-primary" data-ok>Désactiver</button></div>`,
      (body, close) => { $("[data-x]", body).addEventListener("click", close); $("[data-ok]", body).addEventListener("click", () => { setRhDisabled(a.id, true); close(); toast("Compte RH désactivé"); render(); }); });
    },
  });
  bindFilters(el, f, ["q"]);
  bindPager(el, f);
}
function newCompanyModal() {
  modal("Nouvelle entreprise", `<form id="nco" novalidate>
    <div class="field"><label for="nco-name">Nom de l'entreprise</label><input id="nco-name" maxlength="120" autocomplete="organization"><div class="err hidden" data-err="name" role="alert"></div></div>
    <div class="field"><label for="nco-dom">Domaine e-mail professionnel</label><div class="input-prefix"><span>@</span><input id="nco-dom" placeholder="entreprise.ci" autocapitalize="off" spellcheck="false"></div>
      <div class="hint">Seuls les salariés avec une adresse de ce domaine pourront répondre aux bilans.</div><div class="err hidden" data-err="domain" role="alert"></div></div>
    <div class="field"><label for="nco-rh">E-mail du RH</label><input id="nco-rh" type="email" autocomplete="off" placeholder="prenom.nom@entreprise.ci">
      <div class="hint" id="nco-rh-hint">Doit être une adresse du domaine de l'entreprise. Le RH recevra un lien d'activation par e-mail.</div><div class="err hidden" data-err="rhEmail" role="alert"></div></div>
    <div class="row end"><button type="button" class="btn" data-x>Annuler</button><button type="submit" class="btn btn-primary">Créer et envoyer l'invitation</button></div></form>`,
  (body, close) => {
    $("#nco-dom", body).addEventListener("input", (e) => { const d = cleanDomain(e.target.value); $("#nco-rh-hint", body).innerHTML = d ? `Doit être une adresse <strong>@${esc(d)}</strong>. Le RH recevra un lien d'activation par e-mail.` : "Doit être une adresse du domaine de l'entreprise. Le RH recevra un lien d'activation par e-mail."; });
    $("[data-x]", body).addEventListener("click", close);
    $("#nco", body).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const res = createCompany({ name: $("#nco-name", body).value, domain: $("#nco-dom", body).value, rhEmail: $("#nco-rh", body).value });
      $$("[data-err]", body).forEach((e) => { const m = res.errors?.[e.dataset.err]; e.textContent = m || ""; e.classList.toggle("hidden", !m); });
      if (!res.ok) return;
      close(); render();
      invitationSentModal(res.account, `Entreprise « ${res.company.name} » créée`);
    });
  });
}
function invitationSentModal(a, title) {
  const m = db.outbox.filter((x) => x.to === a.email && x.kind === "INVITATION").pop();
  modal(title, `<p><span class="pill bleu">Invitation envoyée</span> à <strong>${esc(a.email)}</strong>.</p>
    ${mailHtml(m, true)}
    <p class="small muted" style="margin-top:.6rem">Le lien d'activation est personnel : il n'est jamais affiché à l'admin Yodan. Il expire le ${fmt(a.activation.expires)} ; vous pourrez renvoyer l'invitation si besoin.</p>
    <div class="row end"><button type="button" class="btn btn-primary" data-ok>Terminer</button></div>`,
  (body, close) => $("[data-ok]", body).addEventListener("click", close));
}
function editCompanyModal(co) {
  const locked = domainLocked(co.id), rh = rhOf(co.id);
  modal("Modifier l'entreprise", `<form id="eco" novalidate>
    <div class="field"><label for="eco-name">Nom de l'entreprise</label><input id="eco-name" maxlength="120" value="${esc(co.name)}"><div class="err hidden" data-err="name" role="alert"></div></div>
    <div class="field"><label for="eco-dom">Domaine e-mail professionnel</label><div class="input-prefix"><span>@</span><input id="eco-dom" value="${esc(co.domain)}" ${locked ? "disabled" : ""} autocapitalize="off" spellcheck="false"></div>
      <div class="hint">${locked ? "🔒 Verrouillé : une campagne a commencé ou des invitations ont été envoyées (les participants déjà enregistrés ne correspondraient plus)." : "Modifiable tant qu'aucune campagne n'a commencé. Changer le domaine oblige à remplacer le compte RH."}</div>
      <div class="err hidden" data-err="domain" role="alert"></div></div>
    <div class="field hidden" id="eco-rh-field"><label for="eco-rh">E-mail du nouveau RH</label><input id="eco-rh" type="email" autocomplete="off">
      <div class="hint">${rh ? `Le compte actuel <strong>${esc(rh.email)}</strong> sera désactivé ; ` : ""}le nouveau RH recevra un lien d'activation.</div><div class="err hidden" data-err="rhEmail" role="alert"></div></div>
    <div class="row end"><button type="button" class="btn" data-x>Annuler</button><button type="submit" class="btn btn-primary">Enregistrer</button></div></form>`,
  (body, close) => {
    const dom = $("#eco-dom", body);
    dom.addEventListener("input", () => {
      const d = cleanDomain(dom.value);
      $("#eco-rh-field", body).classList.toggle("hidden", d === co.domain);
      $("#eco-rh", body).placeholder = d ? `prenom.nom@${d}` : "";
    });
    $("[data-x]", body).addEventListener("click", close);
    $("#eco", body).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const res = updateCompany(co.id, { name: $("#eco-name", body).value, domain: dom.value, rhEmail: $("#eco-rh", body).value });
      $$("[data-err]", body).forEach((e) => { const m = res.errors?.[e.dataset.err]; e.textContent = m || ""; e.classList.toggle("hidden", !m); });
      if (!res.ok) return;
      close(); render();
      if (res.account) invitationSentModal(res.account, "Domaine modifié · nouveau compte RH");
      else toast("Entreprise modifiée");
    });
  });
}
function replaceRhModal(co) {
  const old = rhOf(co.id);
  modal(old ? "Remplacer le compte RH" : "Créer le compte RH", `<form id="rrh" novalidate>
    <p class="small">${esc(co.name)} · domaine <strong>@${esc(co.domain)}</strong></p>
    ${old ? `<p class="info small">L'ancien compte <strong>${esc(old.email)}</strong> sera désactivé immédiatement (un seul compte RH par entreprise).</p>` : ""}
    <div class="field"><label for="rrh-mail">E-mail du nouveau RH</label><input id="rrh-mail" type="email" autocomplete="off" placeholder="prenom.nom@${esc(co.domain)}"><div class="err hidden" id="rrh-err" role="alert"></div></div>
    <div class="row end"><button type="button" class="btn" data-x>Annuler</button><button type="submit" class="btn btn-primary">${old ? "Remplacer et envoyer l'invitation" : "Créer et envoyer l'invitation"}</button></div></form>`,
  (body, close) => {
    $("[data-x]", body).addEventListener("click", close);
    $("#rrh", body).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const res = replaceRh(co.id, $("#rrh-mail", body).value), err = $("#rrh-err", body);
      err.textContent = res.error || ""; err.classList.toggle("hidden", res.ok);
      if (!res.ok) return;
      close(); render();
      invitationSentModal(res.account, old ? "Compte RH remplacé" : "Compte RH créé");
    });
  });
}

/* =====================================================================
 * CONNEXION (point d'entrée commun Admin Yodan + RH)
 * ===================================================================== */
const pwField = (id, label, auto) => `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input id="${id}" type="password" autocomplete="${auto}">
  <button type="button" class="btn btn-ghost btn-sm pw-toggle" data-pw="${id}" aria-label="Afficher le mot de passe" aria-pressed="false">Afficher</button></div></div>`;
const checklist = (checks) => `<ul class="pw-rules" aria-live="polite">${checks.map((c) => `<li class="${c.ok ? "ok" : ""}">${c.ok ? "✓" : "○"} ${esc(c.label)}</li>`).join("")}</ul>`;
const otpInputsHtml = () => `<div class="otp" role="group" aria-label="Code à 6 chiffres">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" aria-label="Chiffre ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : ""}>`).join("")}</div>`;
function wireOtp(root) {
  const inputs = $$(".otp input", root);
  inputs.forEach((inp, i) => {
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); if (inp.value && inputs[i + 1]) inputs[i + 1].focus(); });
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Backspace" && !inp.value && inputs[i - 1]) inputs[i - 1].focus(); });
    inp.addEventListener("paste", (ev) => { const d = (ev.clipboardData.getData("text").match(/\d/g) || []).slice(0, 6); if (d.length) { ev.preventDefault(); d.forEach((x, k) => (inputs[k].value = x)); inputs[Math.min(d.length, 5)].focus(); } });
  });
  inputs[0]?.focus();
  return () => inputs.map((x) => x.value).join("");
}
const CODE_ERR = { BAD: "Code incorrect.", TOO_MANY: "Trop d'essais : demandez un nouveau code.", EXPIRED: "Ce code a expiré : demandez-en un nouveau." };
function renderAuth(root) {
  const A = state.auth;
  const go = (screen, extra = {}) => { Object.assign(A, { screen, err: "", info: "" }, extra); render(); scrollTop(); };
  const shell = (title, sub, body) => root.append(h(`<div class="auth-shell"><div class="auth-card card">
    <img class="auth-logo" src="logo-yodan.png" alt="YODAN"><span class="kicker">Bilan de santé psychologique · espace professionnel</span>
    <h1 class="display">${title}</h1>${sub ? `<p class="muted small">${sub}</p>` : ""}
    ${A.info ? `<p class="info small" role="status">${A.info}</p>` : ""}${A.err ? `<p class="err-box small" role="alert">${A.err}</p>` : ""}
    ${body}</div><p class="small muted auth-foot">Accès réservé aux équipes YODAN et aux RH des entreprises clientes. Les salariés répondent via le lien de leur campagne.</p></div>`));
  const bindPwToggles = () => $$("[data-pw]", root).forEach((b) => b.addEventListener("click", () => {
    const inp = $("#" + b.dataset.pw, root), show = inp.type === "password";
    inp.type = show ? "text" : "password"; b.textContent = show ? "Masquer" : "Afficher"; b.setAttribute("aria-pressed", String(show));
  }));
  const pwForm = (onSubmit) => {
    const a = accountOf(A.accountId), upd = () => { $(".pw-rules", root).outerHTML = checklist(passwordChecks($("#np1", root).value, a)); };
    $("#np1", root).addEventListener("input", upd);
    bindPwToggles();
    $("form", root).addEventListener("submit", (ev) => { ev.preventDefault(); onSubmit($("#np1", root).value, $("#np2", root).value); });
  };
  const pwFormHtml = (btn) => `<form novalidate>${pwField("np1", "Nouveau mot de passe", "new-password")}${checklist(passwordChecks("", accountOf(A.accountId)))}
    ${pwField("np2", "Confirmer le mot de passe", "new-password")}<button class="btn btn-primary btn-block" type="submit">${btn}</button></form>`;
  const pwErr = (r) => (r.reason === "CONFIRM" ? "Les deux mots de passe ne sont pas identiques." : r.reason === "RULES" ? "Le mot de passe ne respecte pas toutes les règles." : "Action impossible.");

  if (A.screen === "login") {
    shell("Connexion", "", `<form novalidate>
      <div class="field"><label for="lg-mail">Adresse e-mail</label><input id="lg-mail" type="email" autocomplete="username" value="${esc(A.email)}"></div>
      ${pwField("lg-pw", "Mot de passe", "current-password")}
      <button class="btn btn-primary btn-block" type="submit">Se connecter</button></form>
      <p style="text-align:center;margin:.8rem 0 0"><button type="button" class="btn btn-ghost btn-sm" data-act="forgot">Mot de passe oublié ?</button></p>`);
    bindPwToggles();
    if (A.prefillPw) { $("#lg-pw", root).value = A.prefillPw; A.prefillPw = ""; }
    (A.email ? $("#lg-pw", root) : $("#lg-mail", root)).focus();
    bind(root, { forgot: () => go("forgot", { email: $("#lg-mail", root).value.trim() }) });
    $("form", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const email = $("#lg-mail", root).value, r = login(email, $("#lg-pw", root).value);
      A.email = normEmail(email);
      if (!r.ok) {
        A.err = { BAD: "E-mail ou mot de passe incorrect.", LOCKED: `Trop de tentatives (${MAX_FAILS}). Réessayez dans 15 minutes ou utilisez « Mot de passe oublié ».`,
        }[r.reason];
        A.info = ""; render(); return;
      }
      A.accountId = r.accountId;
      if (r.next === "MFA") go("mfa");
      else { openSession(r.accountId); state.auth = { ...AUTH_DEFAULT }; render(); scrollTop(); }
    });
    return;
  }

  if (A.screen === "mfa") {
    const a = accountOf(A.accountId);
    shell("Vérification", `Un code à 6 chiffres vient d'être envoyé à <strong>${esc(a.email)}</strong>. Il expire dans 10 minutes.`, `<form novalidate>${otpInputsHtml()}
      <label class="row nowrap small" style="gap:.5rem;align-items:flex-start;margin:.2rem 0 .8rem"><input type="checkbox" id="mfa-rem" style="margin-top:.2rem"><span>Se souvenir de cet appareil pendant 30 jours (à ne pas cocher sur un poste partagé)</span></label>
      <button class="btn btn-primary btn-block" type="submit">Valider</button></form>
      <div class="row between small" style="margin-top:.8rem"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← Retour</button><button type="button" class="btn btn-ghost btn-sm" data-act="resend">Renvoyer le code</button></div>`);
    const code = wireOtp(root);
    bind(root, { back: () => go("login"), resend: () => { startChallenge(a.email, "MFA"); A.info = "Nouveau code envoyé : le précédent ne fonctionne plus."; A.err = ""; render(); } });
    $("form", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const r = verifyMfa(a.id, code(), $("#mfa-rem", root).checked);
      if (!r.ok) { A.err = CODE_ERR[r.reason] || "Code incorrect."; A.info = ""; render(); return; }
      openSession(a.id); state.auth = { ...AUTH_DEFAULT }; render(); scrollTop();
    });
    return;
  }

  if (A.screen === "activate") {
    const v = activationAccount(A.token);
    if (!v.ok) {
      shell(v.reason === "EXPIRED" ? "Lien expiré" : "Lien invalide",
        v.reason === "EXPIRED" ? `Ce lien d'activation n'est plus valable (${ACTIVATION_DAYS} jours).` : "Ce lien d'activation a déjà été utilisé ou n'existe pas.",
        `<p class="small">Utilisez « Mot de passe oublié » avec votre adresse e-mail professionnelle pour recevoir un code et choisir votre mot de passe, ou demandez une nouvelle invitation à YODAN.</p>
        <button type="button" class="btn btn-primary btn-block" data-act="forgot">Mot de passe oublié</button>
        <p style="text-align:center;margin:.8rem 0 0"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← Page de connexion</button></p>`);
      bind(root, { forgot: () => go("forgot"), back: () => go("login") });
      return;
    }
    A.accountId = v.accountId;
    const a = accountOf(v.accountId);
    shell("Activez votre compte", `Compte ${ROLE_LABEL[a.role]}${a.companyId ? ` · ${esc(companyOf(a.companyId).name)}` : ""}<br><strong>${esc(a.email)}</strong><br>Choisissez votre mot de passe. Vous vous connecterez ensuite avec ce mot de passe et un code reçu par e-mail.`, pwFormHtml("Activer mon compte"));
    pwForm((p1, p2) => {
      const r = activateAccount(A.token, p1, p2);
      if (!r.ok) { A.err = r.reason === "EXPIRED" || r.reason === "INVALID" ? "Ce lien n'est plus valable." : pwErr(r); render(); return; }
      state.auth = { ...AUTH_DEFAULT, email: a.email, info: "Compte activé. Connectez-vous avec votre nouveau mot de passe." };
      render(); scrollTop();
    });
    return;
  }

  if (A.screen === "forgot") {
    shell("Mot de passe oublié", "Saisissez votre adresse e-mail : nous vous enverrons un code pour choisir un nouveau mot de passe.", `<form novalidate>
      <div class="field"><label for="fg-mail">Adresse e-mail</label><input id="fg-mail" type="email" autocomplete="username" value="${esc(A.email)}"></div>
      <button class="btn btn-primary btn-block" type="submit">Recevoir un code</button></form>
      <p style="text-align:center;margin:.8rem 0 0"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← Retour à la connexion</button></p>`);
    $("#fg-mail", root).focus();
    bind(root, { back: () => go("login") });
    $("form", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const email = normEmail($("#fg-mail", root).value);
      if (!isEmail(email)) { A.err = "Saisissez une adresse e-mail valide."; render(); return; }
      forgotStart(email);
      go("forgot-code", { email, info: `Si un compte existe pour <strong>${esc(email)}</strong>, un code vient de lui être envoyé.` });
    });
    return;
  }

  if (A.screen === "forgot-code") {
    shell("Saisissez le code", "", `<form novalidate>${otpInputsHtml()}<button class="btn btn-primary btn-block" type="submit">Valider</button></form>
      <div class="row between small" style="margin-top:.8rem"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← Changer d'adresse</button><button type="button" class="btn btn-ghost btn-sm" data-act="resend">Renvoyer le code</button></div>`);
    const code = wireOtp(root);
    bind(root, { back: () => go("forgot"), resend: () => { forgotStart(A.email); A.info = "Si un compte existe, un nouveau code a été envoyé."; A.err = ""; render(); } });
    $("form", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const r = forgotVerify(A.email, code());
      if (!r.ok) { A.err = CODE_ERR[r.reason] || "Code incorrect."; A.info = ""; render(); return; }
      go("forgot-new", { accountId: r.accountId });
    });
    return;
  }

  if (A.screen === "forgot-new") {
    shell("Nouveau mot de passe", "Choisissez un nouveau mot de passe. Vous serez ensuite invité(e) à vous connecter.", pwFormHtml("Enregistrer le mot de passe"));
    pwForm((p1, p2) => {
      const r = setPassword(A.accountId, p1, p2, "RESET");
      if (!r.ok) { A.err = pwErr(r); render(); return; }
      const email = A.email;
      state.auth = { ...AUTH_DEFAULT, email, info: "Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe." };
      render(); scrollTop();
    });
  }
}
const goResults = (campaignId) => {
  const c = campOf(campaignId), y = state.yodan;
  Object.assign(y, { tab: "tb", f: { company: c.companyId, campaign: c.id, person: "" }, lf: { ...LF_DEFAULT } });
  y.sel.clear(); render(); scrollTop();
};
const testAsParticipant = (campaignId) => { state.role = "participant"; resetPart(campaignId); render(); scrollTop(); };

/* ---------- Onglet 1 : Campagnes ---------- */
const CF_KEYS = ["q", "company", "etat"];
function renderYCampaigns(el) {
  const f = state.yodan.cf;
  const order = { EN_COURS: 0, AVENIR: 1, TERMINEE: 2 };
  const list = db.campaigns.filter((c) =>
    (!f.q.trim() || norm(c.name).includes(norm(f.q.trim()))) &&
    (f.company === "all" || c.companyId === f.company) &&
    (f.etat === "all" || campaignState(c) === f.etat))
    .sort((a, b) => order[campaignState(a)] - order[campaignState(b)] || b.start.localeCompare(a.start));
  const { rows, pages } = paginate(list, f);
  el.append(h(`<div>
    <div class="page-head"><div><span class="kicker">Yodan · ${COMPANIES.length} entreprises clientes</span><h1 class="display">Campagnes de bilan</h1>
      <p class="muted small">Une campagne = un nom, une entreprise et une période. Elle a un seul lien (et son QR code) à diffuser.</p></div>
      <button type="button" class="btn btn-primary" data-act="new">+ Nouvelle campagne</button></div>
    <div class="card">
      <div class="filters">${fSearch("q", "Rechercher une campagne…", f)}
        ${fSelect("company", "Entreprise", [["all", "Toutes les entreprises"], ...COMPANIES.map((c) => [c.id, c.name])], f)}
        ${fSelect("etat", "État", [["all", "Tous les états"], ["EN_COURS", "En cours"], ["AVENIR", "À venir"], ["TERMINEE", "Terminées"]], f)}
        ${filtersActive(f, CF_KEYS) ? `<button type="button" class="btn btn-ghost btn-sm" data-freset>Effacer les filtres</button>` : ""}</div>
      <div class="table-wrap"><table><thead><tr><th>Campagne</th><th>Entreprise</th><th>Période</th><th>État</th><th>Bilans</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((c) => { const a = aggregate(scopeEvals({ campaign: c.id })), co = companyOf(c.companyId); return `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(co.name)}<div class="small muted">@${esc(co.domain)}</div></td>
        <td class="small" style="white-space:nowrap">${fmt(c.start)} → ${fmt(c.end)}</td>
        <td>${statePill(c)}</td>
        <td class="small"><strong>${a.done}</strong> terminé(s)${a.nonTermine ? `<div class="muted">${a.nonTermine} non terminé(s)</div>` : ""}${a.pasDeReponse ? `<div class="muted">${a.pasDeReponse} sans réponse</div>` : ""}</td>
        <td class="actions"><button type="button" class="btn btn-sm" data-act="diff" data-id="${c.id}">${campaignState(c) === "TERMINEE" ? "Lien" : "✉ Diffuser"}</button>
          <button type="button" class="btn btn-sm" data-act="res" data-id="${c.id}" ${a.participations ? "" : "disabled"}>Résultats →</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="try" data-id="${c.id}">Tester</button></td></tr>`; }).join("")
        : `<tr><td colspan="6" class="empty">Aucune campagne ne correspond aux filtres.</td></tr>`}
      </tbody></table></div>
      ${pagerHtml(list.length, f, pages, [10, 25])}</div></div>`));
  bind(el, {
    new: () => newCampaignModal(),
    diff: (b) => diffusionModal(campOf(b.dataset.id)),
    res: (b) => goResults(b.dataset.id),
    try: (b) => testAsParticipant(b.dataset.id),
  });
  bindFilters(el, f, CF_KEYS);
  bindPager(el, f);
}

function newCampaignModal() {
  modal("Nouvelle campagne", `<form id="nc" novalidate>
    <div class="field"><label for="nc-name">Nom de la campagne</label><input id="nc-name" maxlength="80" placeholder="Ex. Bilan T1 2027"><div class="err hidden" data-err="name" role="alert"></div></div>
    <div class="field"><label for="nc-co">Entreprise</label><select id="nc-co"><option value="">Choisir…</option>${COMPANIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <div class="hint" id="nc-dom">Les entreprises se créent dans l'onglet « Entreprises ».</div><div class="err hidden" data-err="companyId" role="alert"></div></div>
    <div class="grid-2"><div class="field"><label for="nc-start">Début</label><input id="nc-start" type="date" value="${TODAY}"><div class="err hidden" data-err="start" role="alert"></div></div>
      <div class="field"><label for="nc-end">Fin (incluse)</label><input id="nc-end" type="date" value="${addDays(TODAY, 14)}"><div class="err hidden" data-err="end" role="alert"></div></div></div>
    <p class="small muted">Avant le début, le lien affiche « disponible à partir du… » ; après la fin, « bilan terminé ».</p>
    <div class="row end"><button type="button" class="btn" data-x>Annuler</button><button type="submit" class="btn btn-primary">Créer et diffuser</button></div></form>`,
  (body, close) => {
    $("#nc-co", body).addEventListener("change", (e) => { const co = companyOf(e.target.value); $("#nc-dom", body).innerHTML = co ? `Seules les adresses <strong>@${esc(co.domain)}</strong> pourront répondre.` : "Les entreprises se créent dans l'onglet « Entreprises »."; });
    $("[data-x]", body).addEventListener("click", close);
    $("#nc", body).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const res = createCampaign({ name: $("#nc-name", body).value, companyId: $("#nc-co", body).value, start: $("#nc-start", body).value, end: $("#nc-end", body).value });
      $$("[data-err]", body).forEach((e) => { const m = res.errors?.[e.dataset.err]; e.textContent = m || ""; e.classList.toggle("hidden", !m); });
      if (!res.ok) return;
      close(); render(); toast("Campagne créée");
      diffusionModal(res.campaign);
    });
  });
}

function diffusionModal(c) {
  const co = companyOf(c.companyId), st = campaignState(c), url = campaignUrl(c);
  modal(`Diffuser · ${c.name}`, `
    <p class="small">${esc(co.name)} · ${fmt(c.start)} → ${fmt(c.end)} · ${statePill(c)}</p>
    ${st === "AVENIR" ? `<p class="info small">Le lien peut être diffusé dès maintenant : jusqu'au ${fmt(c.start)}, il affichera la date d'ouverture.</p>` : ""}
    ${st === "TERMINEE" ? `<p class="info small">Campagne terminée : le lien affiche un message de clôture. L'envoi n'est plus proposé.</p>` : ""}
    <div class="qr-box"><div class="qr">${qrSvg(c.code)}</div>
      <div class="stack" style="flex:1;min-width:180px"><div class="linkline">${url}</div>
        <div class="row"><button type="button" class="btn btn-sm" data-act="copy">Copier le lien</button><button type="button" class="btn btn-sm" data-act="poster">Affiche A4 (PDF)</button></div>
        <p class="small muted" style="margin:0">Le lien seul ne donne accès à rien : e-mail <strong>@${esc(co.domain)}</strong> + code reçu par e-mail.</p></div></div>
    ${st !== "TERMINEE" ? `<hr><h3>Envoyer le lien par e-mail</h3>
      <p class="small muted">Seules les adresses <strong>@${esc(co.domain)}</strong> sont acceptées. Les doublons sont retirés.</p>
      <div class="field"><label for="rcpt">Coller des adresses</label>
        <textarea id="rcpt" rows="3" placeholder="Une adresse par ligne, ou séparées par des virgules"></textarea></div>
      <div class="field"><label for="rcpt-csv">ou importer un fichier CSV</label>
        <input id="rcpt-csv" type="file" accept=".csv,text/csv">
        <div class="hint">Une colonne « email » (les autres colonnes sont ignorées). Séparateur virgule ou point-virgule, 1 Mo maximum.</div>
        <div class="err hidden" id="csv-err" role="alert"></div></div>
      <div id="rcpt-res" aria-live="polite"></div>
      <div class="row end"><button type="button" class="btn" data-act="try">▶ Tester comme un participant</button>
        <button type="button" class="btn" data-act="check">Vérifier les adresses</button>
        <button type="button" class="btn btn-primary" data-act="send" disabled>Envoyer</button></div>` : ""}`,
  (body, close) => {
    let csvText = null, last = null;
    const resEl = $("#rcpt-res", body), sendBtn = $("[data-act=send]", body), csvErr = $("#csv-err", body);
    const reset = () => { last = null; if (resEl) resEl.innerHTML = ""; if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "Envoyer"; } };
    const check = () => {
      last = collectRecipients($("#rcpt", body).value, csvText, co);
      if (last.error) { csvErr.textContent = last.error; csvErr.classList.remove("hidden"); reset(); return; }
      csvErr.classList.add("hidden");
      const { ok, refused } = last, MAX = 8;
      resEl.innerHTML = !ok.length && !refused.length ? `<p class="small muted">Aucune adresse à vérifier.</p>` : `
        <p class="small"><span class="pill vert">${ok.length} acceptée(s)</span> ${refused.length ? `<span class="pill rouge">${refused.length} refusée(s)</span>` : ""}</p>
        ${refused.length ? `<ul class="small">${refused.slice(0, MAX).map((r) => `<li>${esc(r.email)} : ${esc(r.reason)}</li>`).join("")}${refused.length > MAX ? `<li class="muted">… et ${refused.length - MAX} autre(s)</li>` : ""}</ul>` : ""}
        ${ok.length ? `<details class="small"><summary>Voir les ${ok.length} adresse(s) acceptée(s)</summary><ul>${ok.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details>` : ""}`;
      sendBtn.disabled = !ok.length;
      sendBtn.textContent = ok.length ? `Envoyer à ${ok.length} personne(s)` : "Envoyer";
    };
    $("#rcpt", body)?.addEventListener("input", reset);
    $("#rcpt-csv", body)?.addEventListener("change", (ev) => {
      const file = ev.target.files[0];
      csvText = null; reset(); csvErr.classList.add("hidden");
      if (!file) return;
      if (file.size > 1024 * 1024) { csvErr.textContent = "Fichier trop volumineux (1 Mo maximum)."; csvErr.classList.remove("hidden"); ev.target.value = ""; return; }
      // Lecture locale dans le navigateur : le fichier n'est envoyé nulle part.
      const reader = new FileReader();
      reader.onload = () => { csvText = String(reader.result); check(); };
      reader.onerror = () => { csvErr.textContent = "Impossible de lire ce fichier."; csvErr.classList.remove("hidden"); };
      reader.readAsText(file, "utf-8");
    });
    bind(body, {
      copy: () => toast("Lien copié"),
      poster: () => toast("Affiche A4 générée (simulation)"),
      try: () => { close(); testAsParticipant(c.id); },
      check,
      send: () => {
        if (!last || !last.ok.length) return;
        const r = inviteRecipients(c.id, last.ok);
        const already = r.skipped.filter((x) => x.reason === "ALREADY").length;
        close(); render();
        toast(`Lien envoyé à ${r.invited + r.reminded} personne(s)${r.reminded ? ` dont ${r.reminded} relance(s)` : ""}${already ? ` · ${already} ont déjà répondu (non relancées)` : ""} (simulation)`);
      },
    });
  }, true);
}

/* ---------- Onglet 2 : Tableau de bord & participants ---------- */
const LF_KEYS = ["q", "status", "profil"];
function renderYDashboard(el) {
  const y = state.yodan;
  y.f = normalizeFilters(y.f);
  const f = y.f;
  const A = aggregate(scopeEvals(f));
  const camps = db.campaigns.filter((c) => f.company === "all" || c.companyId === f.company).sort((a, b) => b.start.localeCompare(a.start));
  const inScope = [...new Set(scopeEvals({ ...f, person: "" }).map((e) => e.personId))].map(personOf).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const label = (p) => `${displayName(p)} — ${p.email}`;
  const person = f.person ? personOf(f.person) : null;
  const scopeTxt = [f.company !== "all" ? companyOf(f.company).name : "Toutes les entreprises", f.campaign !== "all" ? campOf(f.campaign).name : "toutes les campagnes"].join(" · ");
  el.append(h(`<div>
    <div class="page-head"><div><span class="kicker">Vue médecin · résultats nominatifs</span><h1 class="display">Tableau de bord & participants</h1>
      <p class="muted small">${esc(scopeTxt)}${person ? ` · patient : <strong>${esc(displayName(person))}</strong>` : ""}</p></div></div>
    <div class="card filterbar">
      <div class="field"><label for="tf-co">Entreprise</label><select id="tf-co" data-act="fco">${[["all", "Toutes les entreprises"], ...COMPANIES.map((c) => [c.id, c.name])].map(([v, l]) => `<option value="${v}" ${f.company === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="field"><label for="tf-ca">Campagne</label><select id="tf-ca" data-act="fca"><option value="all">Toutes les campagnes</option>${camps.map((c) => `<option value="${c.id}" ${f.campaign === c.id ? "selected" : ""}>${f.company === "all" ? esc(companyOf(c.companyId).name) + " · " : ""}${esc(c.name)} (${STATE_PILL[campaignState(c)][1].toLowerCase()})</option>`).join("")}</select></div>
      <div class="field grow"><label for="tf-pa">Patient</label><div class="row nowrap"><input id="tf-pa" type="search" list="dl-pa" autocomplete="off" placeholder="Nom ou e-mail…" value="${person ? esc(label(person)) : ""}">
        ${person ? `<button type="button" class="btn btn-sm" data-act="clearp" aria-label="Retirer le filtre patient">×</button>` : ""}</div>
        <datalist id="dl-pa">${inScope.map((p) => `<option value="${esc(label(p))}"></option>`).join("")}</datalist></div>
      ${f.company !== "all" || f.campaign !== "all" || f.person ? `<button type="button" class="btn btn-ghost btn-sm" data-act="freset">Réinitialiser</button>` : ""}
    </div>
    <div id="tb"></div>
    <div id="plist"></div></div>`));
  const tb = $("#tb", el);
  if (person) renderPatientCard(tb, person, f);
  else renderYAggregate(tb, A, f);
  renderParticipants($("#plist", el));

  const pa = $("#tf-pa", el);
  pa.addEventListener("change", () => {
    const v = pa.value.trim();
    if (!v) { f.person = ""; render(); return; }
    const p = inScope.find((x) => label(x) === v) || inScope.find((x) => norm(label(x)).includes(norm(v)));
    if (p) { f.person = p.id; y.lf.page = 1; y.sel.clear(); render(); } else toast("Aucun patient ne correspond dans ce périmètre");
  });
  // Liaison limitée à la barre de filtres et au tableau de bord : la liste gère ses propres actions.
  const handlers = {
    fco: (s) => { f.company = s.value; y.f = normalizeFilters(f); y.lf.page = 1; y.sel.clear(); render(); },
    fca: (s) => { f.campaign = s.value; if (s.value !== "all") f.company = campOf(s.value).companyId; y.f = normalizeFilters(f); y.lf.page = 1; y.sel.clear(); render(); },
    clearp: () => { f.person = ""; render(); },
    freset: () => { y.f = { company: "all", campaign: "all", person: "" }; y.lf = { ...LF_DEFAULT }; y.sel.clear(); render(); },
    by: (b) => { y.by = b.dataset.v; render(); },
    pick1: (b) => { const c = campOf(b.dataset.id); Object.assign(f, { company: c.companyId, campaign: c.id }); render(); scrollTop(); },
    report: (b) => reportModal(b.dataset.id),
  };
  bind($(".filterbar", el), handlers);
  bind(tb, handlers);
}

function renderYAggregate(el, A, f) {
  const y = state.yodan;
  const compare = f.campaign === "all" ? db.campaigns.filter((c) => f.company === "all" || c.companyId === f.company)
    .map((c) => ({ c, a: aggregate(scopeEvals({ campaign: c.id })) })).filter((x) => x.a.participations).sort((a, b) => b.c.start.localeCompare(a.c.start)) : [];
  el.append(h(`<div>
    <div class="grid-4 kpis">
      ${kpi(A.done, "bilans terminés", `${A.nonTermine} non terminé(s) · ${A.pasDeReponse} sans réponse`)}
      ${kpi(A.prof[2], "à prendre en charge", `${pct(A.prof[2], A.done)} % des bilans`)}
      ${kpi(A.prof[1], "en vigilance", `${pct(A.prof[1], A.done)} % des bilans`)}
      ${kpi(A.alertes, "signaux d'alerte forts", "sommeil, substances ou évènement de vie")}
    </div>
    ${A.done ? `<div class="grid-2" style="margin-top:1rem">
      <div class="card"><h2>Répartition des profils</h2><p class="small muted">${A.done} bilans · ${A.prof.map((x, i) => `${x} ${ZONE_LABEL[ZONES[i]].toLowerCase()}`).join(" · ")}</p>${stackBar(A.prof, A.done)}${legend}</div>
      <div class="card"><h2>Moyennes par dimension</h2><p class="small muted">0 à 100 · couleur = zone de la moyenne</p>${dimRows(A.dims)}</div></div>
    <div class="card" style="margin-top:1rem"><div class="row between"><h2>Par groupe</h2>
      <div class="seg">${[["tranche_age", "Âge"], ["genre", "Genre"], ["anciennete", "Ancienneté"]].map(([k, l]) => `<button type="button" class="${y.by === k ? "on" : ""}" data-act="by" data-v="${k}">${l}</button>`).join("")}</div></div>
      <p class="small muted">Vue médecin : tous les groupes sont affichés, même les petits.</p>
      <div class="stack">${A.by[y.by].map(([lbl, z]) => { const n = z[0] + z[1] + z[2]; return `<div><div class="row between small"><strong>${esc(lbl)}</strong><span class="muted">${n} bilan(s)</span></div>${stackBar(z, n)}</div>`; }).join("")}</div></div>`
    : `<div class="card" style="margin-top:1rem"><div class="masked">Aucun bilan terminé pour ce filtre.</div></div>`}
    ${compare.length ? `<div class="card" style="margin-top:1rem"><h2>Comparaison des campagnes</h2><div class="table-wrap"><table>
      <thead><tr><th>Campagne</th><th>Période</th><th>Terminés</th><th>Satisf.</th><th>Vigil.</th><th>À prendre en charge</th><th class="hide-m">Bien-être moy.</th><th></th></tr></thead><tbody>
      ${compare.map(({ c, a }) => `<tr><td><strong>${esc(c.name)}</strong><div class="small muted">${esc(companyOf(c.companyId).name)}</div></td>
        <td class="small">${fmt(c.start)} → ${fmt(c.end)}<div>${statePill(c)}</div></td><td>${a.done}</td>
        <td>${pct(a.prof[0], a.done)} %</td><td>${pct(a.prof[1], a.done)} %</td><td>${pct(a.prof[2], a.done)} %</td><td class="hide-m">${a.dims.A}</td>
        <td><button type="button" class="btn btn-sm" data-act="pick1" data-id="${c.id}">Filtrer</button></td></tr>`).join("")}
      </tbody></table></div></div>` : ""}</div>`));
}

function renderPatientCard(el, p, f) {
  const evs = scopeEvals({ company: "all", campaign: "all", person: p.id }).sort((a, b) => campOf(b.campaignId).start.localeCompare(campOf(a.campaignId).start));
  const inFilter = new Set(scopeEvals(f).map((e) => e.id));
  el.append(h(`<div class="card"><div class="row between"><div><span class="kicker">Fiche patient</span><h2 style="margin:0">${esc(displayName(p))}</h2>
      <p class="small muted" style="margin:0">${esc(p.email)} · ${esc(companyOf(p.companyId).name)} · ${evs.filter((e) => e.completedAt).length} bilan(s) terminé(s)</p></div></div>
    ${f.campaign !== "all" && !inFilter.size ? `<p class="info small" style="margin-top:.8rem">Ce patient n'a pas participé à la campagne filtrée. Son historique complet est ci-dessous.</p>` : ""}
    <h3 style="margin-top:1rem">Évolution d'une campagne à l'autre</h3>
    <div class="table-wrap"><table><thead><tr><th>Campagne</th><th>Date</th><th>Profil</th>${DIMS.map((k) => `<th class="hide-m">${DIM_SHORT[k]}</th>`).join("")}<th></th></tr></thead><tbody>
    ${evs.map((e) => { const r = resultOf(e), c = campOf(e.campaignId), [cls, l] = STATUS_PILL[statusOf(e)]; return `<tr class="${inFilter.has(e.id) ? "" : "dim"}">
      <td><strong>${esc(c.name)}</strong></td><td class="small">${fmt(lastDateOf(e))}</td>
      <td>${r ? zonePill(r.profil) : `<span class="pill ${cls}">${l}</span>`}</td>
      ${DIMS.map((k) => `<td class="hide-m">${r ? zonePill(r.dims[k].zone, r.dims[k].pct) : "—"}</td>`).join("")}
      <td>${r ? `<button type="button" class="btn btn-sm" data-act="report" data-id="${e.id}">Rapport</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div></div>`));
}

function renderParticipants(el) {
  const y = state.yodan, lf = y.lf;
  const all = listRows(y.f, lf);
  const { rows, pages } = paginate(all, lf);
  const done = all.filter((x) => x.st === "TERMINE");
  const pageDone = rows.filter((x) => x.st === "TERMINE");
  const sel = [...y.sel].filter((id) => all.some((x) => x.e.id === id));
  const oneCamp = y.f.campaign !== "all";
  el.append(h(`<div class="card" style="margin-top:1rem">
    <div class="row between"><h2>Participants (${all.length})</h2><span class="small muted">Suit les filtres du haut de page</span></div>
    <div class="filters">${fSearch("q", "Nom ou e-mail…", lf)}
      ${fSelect("status", "Statut", [["all", "Tous les statuts"], ...Object.entries(STATUS_PILL).map(([k, [, l]]) => [k, l])], lf)}
      ${fSelect("profil", "Profil", [["all", "Tous les profils"], ["VERT", "Satisfaisant"], ["ORANGE", "Vigilance"], ["ROUGE", "À prendre en charge"], ["none", "Pas de profil"]], lf)}
      ${filtersActive(lf, LF_KEYS) ? `<button type="button" class="btn btn-ghost btn-sm" data-freset>Effacer</button>` : ""}</div>
    <div class="toolbar"><span class="count">${sel.length ? `${sel.length} sélectionné(s)` : "Aucune sélection"}</span>
      <button type="button" class="btn btn-sm" data-act="selDone" ${done.length ? "" : "disabled"}>Sélectionner les ${done.length} terminés</button>
      ${sel.length ? `<button type="button" class="btn btn-ghost btn-sm" data-act="selNone">Tout désélectionner</button>` : ""}
      <span style="flex:1"></span>
      <button type="button" class="btn btn-sm btn-primary" data-act="sendSel" ${sel.length ? "" : "disabled"}>✉ Renvoyer le lien du rapport</button>
      <button type="button" class="btn btn-sm" data-act="pdfSel" ${sel.length ? "" : "disabled"}>⬇ PDF${sel.length > 1 ? " (ZIP)" : ""}</button>
      <button type="button" class="btn btn-sm" data-act="xlsx" ${all.length ? "" : "disabled"}>⬇ XLSX (${all.length})</button></div>
    <div class="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Sélectionner les terminés de cette page" data-act="all" data-ev="change" ${pageDone.length && pageDone.every((x) => y.sel.has(x.e.id)) ? "checked" : ""}></th>
      <th>Patient</th>${oneCamp ? "" : `<th class="hide-m">Entreprise · campagne</th>`}<th>Date · rapport</th><th>Statut</th><th>Profil</th><th></th></tr></thead><tbody>
    ${rows.length ? "" : `<tr><td colspan="8" class="empty">Aucun participant ne correspond aux filtres.</td></tr>`}
    ${rows.map((x) => { const [cls, l] = STATUS_PILL[x.st], can = x.st === "TERMINE"; return `<tr class="${y.sel.has(x.e.id) ? "sel" : ""}">
      <td><input type="checkbox" aria-label="Sélectionner ${esc(displayName(x.p))}" data-act="pick" data-ev="change" data-id="${x.e.id}" ${y.sel.has(x.e.id) ? "checked" : ""} ${can ? "" : "disabled"}></td>
      <td><button type="button" class="linklike" data-act="person" data-id="${x.p.id}" title="Filtrer sur ce patient">${esc(displayName(x.p))}</button><div class="small muted">${esc(x.p.email)}</div></td>
      ${oneCamp ? "" : `<td class="hide-m small">${esc(companyOf(x.c.companyId).name)}<div class="muted">${esc(x.c.name)}</div></td>`}
      <td class="small" style="white-space:nowrap">${fmt(lastDateOf(x.e))}${can ? `<div class="muted" title="Dernier envoi du lien du rapport">✉ ${fmt(x.e.reportSends[x.e.reportSends.length - 1]).slice(0, 5)}${x.e.reportSends.length > 1 ? ` (×${x.e.reportSends.length})` : ""}</div>` : ""}</td>
      <td><span class="pill ${cls}">${l}</span></td>
      <td>${x.r ? zonePill(x.r.profil) : `<span class="muted">—</span>`}</td>
      <td class="actions">${can ? `<button type="button" class="btn btn-sm" data-act="report" data-id="${x.e.id}">Rapport</button> <button type="button" class="btn btn-sm" data-act="send1" data-id="${x.e.id}" title="Renvoyer le lien du rapport" aria-label="Renvoyer le lien du rapport">✉</button>`
        : campaignState(x.c) !== "TERMINEE" ? `<button type="button" class="btn btn-sm" data-act="remind" data-id="${x.e.id}">✉ Relancer</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>
    ${pagerHtml(all.length, lf, pages, [10, 25, 50])}</div>`));
  const sendLinks = (ids) => modal("Renvoyer le lien du rapport", `
    <p>${ids.length} personne(s) vont recevoir un e-mail <strong>neutre</strong> avec le lien vers leur rapport.</p>
    ${mailPreviewReport(personOf(evalOf(ids[0]).personId).email, ids.length)}
    <div class="row end" style="margin-top:.8rem"><button type="button" class="btn btn-primary" data-ok>Envoyer</button></div>`,
  (b, close) => $("[data-ok]", b).addEventListener("click", () => { ids.forEach((id) => sendReportLink(id)); y.sel.clear(); close(); toast(`${ids.length} e-mail(s) envoyé(s)`); render(); }));
  bind(el, {
    pick: (b) => { b.checked ? y.sel.add(b.dataset.id) : y.sel.delete(b.dataset.id); render(); },
    all: (b) => { pageDone.forEach((x) => (b.checked ? y.sel.add(x.e.id) : y.sel.delete(x.e.id))); render(); },
    selDone: () => { done.forEach((x) => y.sel.add(x.e.id)); render(); },
    selNone: () => { y.sel.clear(); render(); },
    sendSel: () => sendLinks(sel),
    send1: (b) => sendLinks([b.dataset.id]),
    pdfSel: () => { audit("EXPORT_PDF", `${sel.length} rapport(s)`); toast(sel.length > 1 ? `ZIP de ${sel.length} PDF téléchargé (simulation)` : "PDF téléchargé (simulation)"); },
    xlsx: () => { audit("EXPORT_XLSX", `${all.length} ligne(s)`); toast(`Export XLSX de ${all.length} ligne(s) (simulation)`); },
    remind: (b) => { const ev = evalOf(b.dataset.id), email = personOf(ev.personId).email; inviteRecipients(ev.campaignId, [email]); toast(`Lien de la campagne renvoyé à ${esc(email)} (simulation)`); render(); },
    person: (b) => { y.f.person = b.dataset.id; y.sel.clear(); render(); scrollTop(); },
    report: (b) => reportModal(b.dataset.id),
  });
  bindFilters(el, lf, LF_KEYS);
  bindPager(el, lf);
}

const mailPreviewReport = (to, n = 1, clickable = false) => `<div class="mail"><div class="mail-head"><div><strong>De :</strong> YODAN &lt;ne-pas-repondre@yodan.exemple.test&gt;</div><div><strong>À :</strong> ${esc(to)}${n > 1 ? ` + ${n - 1} autre(s)` : ""}</div><div><strong>Objet :</strong> Votre bilan est disponible</div></div>
  <div class="mail-body small">Bonjour,<br>Merci d'avoir pris le temps de répondre. Votre bilan de santé psychologique est disponible dans votre espace sécurisé.<br><br>${clickable ? `<button type="button" class="btn btn-primary btn-sm" data-act="open">Consulter mon rapport</button>` : `<span class="btn btn-primary btn-sm">Consulter mon rapport</span>`}<br><br><span class="muted">Ce lien est personnel et valable 30 jours. Un code vous sera demandé à l'ouverture.</span></div></div>`;

/** Rapport détaillé vu par le médecin Yodan (équivalent du « détail du bilan » actuel). Chaque ouverture est journalisée. */
function reportModal(evId) {
  const e = evalOf(evId), r = resultOf(e), p = personOf(e.personId), c = campOf(e.campaignId);
  audit("RAPPORT_CONSULTE", evId);
  const ansLbl = (s, i) => { const v = e.answers[`${s.key}${i}`]; return s.items[i].o.find(([x]) => x === v)?.[1] ?? "—"; };
  modal(`Rapport · ${displayName(p)}`, `
    <p class="small muted">${esc(p.email)} · ${esc(companyOf(c.companyId).name)} · ${esc(c.name)} · terminé le ${fmt(e.completedAt)}</p>
    <div class="result-head ${ZONE_CLS[r.profil]}"><span class="kicker" style="color:inherit">Profil global</span><div class="display">${ZONE_LABEL[r.profil]}</div><p style="margin:0">${RECO[r.profil]}</p></div>
    <div class="grid-2" style="margin-top:1rem"><div><h3>Dimensions</h3>${DIMS.map((k) => `<div class="dim-row"><span>${DIM_LABEL[k]}</span><div class="meter"><span style="width:${r.dims[k].pct}%;background:var(--${ZONE_CLS[r.dims[k].zone]})"></span></div>${zonePill(r.dims[k].zone, r.dims[k].pct)}</div>`).join("")}</div>
      <div><h3>Suivi</h3><ul class="small plain">
        <li>Rapport envoyé le ${e.reportSends.map(fmt).join(", ")}</li>
        <li>Consentement ${esc(e.consent.version)} du ${fmt(e.consent.at)}</li>
        <li>${DEMO_FIELDS.map(([k, l]) => `${l} : ${esc(DEMO_SHORT[e.demo[k]] || e.demo[k])}`).join(" · ")}</li></ul></div></div>
    <details style="margin-top:1rem"><summary><strong>Réponses détaillées</strong></summary>
      ${SECTIONS.map((s) => `<h3 style="margin-top:.8rem">${s.key}. ${s.short}</h3><ul class="small plain">${s.items.map((it, i) => `<li>${esc(it.t)} → <strong>${esc(ansLbl(s, i))}</strong></li>`).join("")}</ul>`).join("")}</details>
    <p class="disclaimer" style="margin-top:1rem">Ce test est un outil d'interprétation et ne permet pas d'établir un diagnostic.</p>
    <div class="row end"><button type="button" class="btn" data-act="pdf">⬇ PDF</button><button type="button" class="btn btn-primary" data-act="send">✉ Renvoyer le lien au patient</button></div>`,
  (b, close) => bind(b, {
    pdf: () => { audit("EXPORT_PDF", evId); toast("PDF téléchargé (simulation)"); },
    send: () => { sendReportLink(evId); close(); toast(`Lien du rapport renvoyé à ${esc(p.email)}`); render(); },
  }), true);
}

/* =====================================================================
 * RH — tableau de bord agrégé (une seule entreprise)
 * ===================================================================== */
function renderRH(root) {
  const s = state.rh;
  let M = rhModel(s.company, s.campaign);
  if (M.error) { s.campaign = "all"; M = rhModel(s.company, "all"); }
  const camp = M.campaigns.find((c) => c.id === s.campaign);
  const wrap = h(`<div>${appBar("RH · " + esc(M.company.name))}
    <div class="page">
    <div class="page-head"><div><span class="kicker">Tableau de bord · ${camp ? `${esc(camp.name)} (${STATE_PILL[camp.state][1].toLowerCase()})` : "toutes les campagnes"}</span><h1 class="display">Santé psychologique de vos équipes</h1>
      <p class="muted small">Résultats <strong>agrégés et anonymes</strong>. Aucun résultat individuel n'est visible ici.</p></div>
      ${M.campaigns.length ? `<div class="row"><div class="field" style="margin:0"><label for="rh-ca" class="small">Campagne</label>
        <select id="rh-ca" data-act="ca" style="min-width:220px"><option value="all">Toutes les campagnes</option>
        ${M.campaigns.map((c) => `<option value="${c.id}" ${s.campaign === c.id ? "selected" : ""}>${esc(c.name)}${c.state === "EN_COURS" ? " · en cours" : ""}</option>`).join("")}</select></div>
        <button type="button" class="btn" data-act="pdf" style="align-self:flex-end" ${M.masked ? "disabled" : ""}>⬇ Rapport PDF</button></div>` : ""}</div>
    ${!M.campaigns.length ? `<div class="card"><div class="masked">Aucune campagne n'a encore commencé.${M.upcoming.length ? ` Prochaine : <strong>${esc(M.upcoming[0].name)}</strong>, du ${fmt(M.upcoming[0].start)} au ${fmt(M.upcoming[0].end)}.` : ""}</div></div>` : `
    <div class="grid-4 kpis">${kpi(M.done, "bilans terminés")}${kpi(M.nonTermine, "non terminés", "questionnaire ouvert, pas envoyé")}
      ${kpi(M.pasDeReponse, "pas de réponse", "lien reçu par e-mail, jamais ouvert")}
      ${camp ? kpi(camp.state === "EN_COURS" ? daysBetween(TODAY, camp.end) + " j" : "Clôturée", camp.state === "EN_COURS" ? "restants" : `du ${fmt(camp.start)} au ${fmt(camp.end)}`) : kpi(M.campaigns.length, "campagne(s) commencée(s)", M.upcoming.length ? `${M.upcoming.length} à venir` : "")}</div>
    ${M.masked ? `<div class="card" style="margin-top:1rem"><div class="masked">🔒 Moins de ${MIN_GROUP} bilans terminés : les résultats s'afficheront dès qu'il y en aura assez pour garantir l'anonymat.</div></div>` : `
    <div class="grid-2" style="margin-top:1rem">
      <div class="card"><h2>Répartition des profils</h2><p class="small muted">${M.done} répondants</p>${stackBar(M.prof, M.done)}${legend}</div>
      <div class="card"><h2>Moyennes par dimension</h2><p class="small muted">0 à 100</p>${dimRows(M.dims)}</div></div>
    <div class="card" style="margin-top:1rem"><div class="row between"><h2>Par groupe</h2>
      <div class="seg">${[["tranche_age", "Âge"], ["genre", "Genre"], ["anciennete", "Ancienneté"]].map(([k, l]) => `<button type="button" class="${s.by === k ? "on" : ""}" data-act="by" data-v="${k}">${l}</button>`).join("")}</div></div>
      <p class="small muted">Un groupe de moins de ${MIN_GROUP} répondants est masqué pour qu'on ne puisse reconnaître personne.</p>
      <div class="stack">${M.by[s.by].map((g) => `<div><div class="row between small"><strong>${esc(g.label)}</strong><span class="muted">${g.masked ? "moins de " + MIN_GROUP : g.n + " répondants"}</span></div>
        ${g.masked ? `<div class="masked">🔒 Groupe trop petit pour être affiché</div>` : stackBar(g.z, g.n)}</div>`).join("")}</div></div>`}
    ${M.compare && M.compare.length ? (() => { const { rows, pages } = paginate(M.compare, s.cmp); return `<div class="card" id="cmp" style="margin-top:1rem"><h2>Comparaison des campagnes</h2>
      <p class="small muted">Les campagnes de moins de ${MIN_GROUP} bilans n'y figurent pas.</p><div class="table-wrap"><table>
      <thead><tr><th>Campagne</th><th>Bilans</th><th>Satisf.</th><th>Vigil.</th><th>À prendre en charge</th><th class="hide-m">Bien-être moy.</th><th></th></tr></thead><tbody>
      ${rows.map((c) => `<tr><td><strong>${esc(c.name)}</strong><div class="small muted">${fmt(c.start)} → ${fmt(c.end)}</div></td><td>${c.done}</td>
        <td>${pct(c.prof[0], c.done)} %</td><td>${pct(c.prof[1], c.done)} %</td><td>${pct(c.prof[2], c.done)} %</td><td class="hide-m">${c.wellbeing}</td>
        <td><button type="button" class="btn btn-sm" data-act="camp1" data-id="${c.id}">Voir</button></td></tr>`).join("")}
      </tbody></table></div>${pagerHtml(M.compare.length, s.cmp, pages)}</div>`; })() : ""}`}
  </div></div>`);
  root.append(wrap);
  bind(wrap, {
    ca: (el) => { s.campaign = el.value; render(); },
    by: (b) => { s.by = b.dataset.v; render(); },
    camp1: (b) => { s.campaign = b.dataset.id; render(); scrollTop(); },
    pdf: () => toast("Rapport agrégé téléchargé (simulation)"),
  });
  if ($("#cmp", wrap)) bindPager($("#cmp", wrap), s.cmp);
}

/* =====================================================================
 * PARTICIPANT — formulaire de test
 * ===================================================================== */
const FAKE_OTP = "482913";
const PART_STEPS = ["E-mail", "Code", "Questionnaire", "Envoyé"];
function partShell(root, { step = null, title, sub, body }) {
  const e = state.part, c = campOf(e.campaignId);
  root.append(h(`<div><div class="emp-shell"><div class="emp-top"><img src="logo-yodan.png" alt="YODAN"><span class="conf">🔒 Confidentiel</span></div>
    <div class="emp-hero">${step != null ? `<div class="stepper">${PART_STEPS.map((l, k) => `<div class="${k < step ? "done" : k === step ? "on" : ""}"><div class="bar"></div><div class="lbl">${k + 1}. ${l}</div></div>`).join("")}</div>` : ""}
      <h1 class="display">${title}</h1><p>${sub}</p></div>
    <div class="emp-main">${body}</div></div></div>`));
}
function randomFill() {
  const e = state.part;
  DEMO_FIELDS.forEach(([k, , ch]) => (e.demo[k] = ch[Math.floor(Math.random() * ch.length)]));
  const rk = Math.random();
  SECTIONS.forEach((s) => s.items.forEach((it, i) => {
    const neg = s.key === "C" || s.key === "E" || (s.key === "B" && (i === 0 || i === 3));
    const n = it.o.length, base = neg ? rk * (n - 1) : (1 - rk) * (n - 1);
    e.ans[`${s.key}${i}`] = it.o[Math.max(0, Math.min(n - 1, Math.round(base + (Math.random() - 0.5) * 2)))][0];
  }));
  e.prenom ||= "Invité"; e.nom ||= "Démo"; e.consent = true;
}
function otpBlock(root, onOk) {
  const e = state.part;
  const inputs = $$(".otp input", root);
  inputs.forEach((inp, i) => {
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); if (inp.value && inputs[i + 1]) inputs[i + 1].focus(); });
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Backspace" && !inp.value && inputs[i - 1]) inputs[i - 1].focus(); });
    inp.addEventListener("paste", (ev) => { const d = (ev.clipboardData.getData("text").match(/\d/g) || []).slice(0, 6); if (d.length) { ev.preventDefault(); d.forEach((x, k) => (inputs[k].value = x)); inputs[Math.min(d.length, 5)].focus(); } });
  });
  inputs[0].focus();
  $("form.otp-form", root).addEventListener("submit", (ev) => {
    ev.preventDefault();
    const code = inputs.map((x) => x.value).join(""), err = $(".otp-err", root);
    if (code === FAKE_OTP) { e.otpTries = 0; onOk(); return; }
    e.otpTries++;
    err.textContent = e.otpTries >= 5 ? "Trop d'essais. Demandez un nouveau code." : `Code incorrect. Il vous reste ${5 - e.otpTries} essai(s).`;
    err.classList.remove("hidden");
  });
}
const otpHtml = (email) => `<div class="card">
  <p class="small">Un code à 6 chiffres vient d'être envoyé à <strong>${esc(email)}</strong>. Il expire dans 10 minutes.</p>
  <form class="otp-form" novalidate><div class="otp" role="group" aria-label="Code à 6 chiffres">
    ${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" aria-label="Chiffre ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : ""}>`).join("")}</div>
    <div class="err otp-err hidden" role="alert" style="text-align:center"></div>
    <button class="btn btn-primary btn-block" type="submit">Valider</button></form>
  <div class="row between small" style="margin-top:.8rem"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← Changer d'adresse</button><button type="button" class="btn btn-ghost btn-sm" data-act="resend">Renvoyer le code</button></div></div>`;

function renderParticipant(root) {
  const e = state.part, c = campOf(e.campaignId), co = companyOf(c.companyId);
  const go = (step) => { e.step = step; render(); scrollTop(); };
  const sub = `${esc(c.name)} · proposé par ${esc(co.name)} avec YODAN`;

  if (e.step === "closed") {
    const av = availability(c);
    partShell(root, { title: av.title, sub, body: `<div class="card" style="text-align:center"><div style="font-size:2.4rem" aria-hidden="true">${av.state === "AVENIR" ? "📅" : "🔒"}</div>
      <p><strong>${esc(av.message)}</strong></p>
      ${av.state === "AVENIR" ? `<p class="small muted">Vous pourrez utiliser ce même lien à partir de cette date.</p>` : `<p class="small muted">Si vous avez répondu, votre rapport vous a été envoyé par e-mail.</p>`}</div>
      <div class="card"><h3>Besoin de parler à quelqu'un ?</h3><p class="small">Centre d'écoute YODAN : <strong>+225 00 00 00 00</strong> (numéro fictif).</p></div>` });
    return;
  }

  if (e.step === "email") {
    partShell(root, { step: 0, title: "Bilan de santé psychologique", sub: `${sub} · 8 à 10 minutes`, body: `
      <div class="card"><form id="f-mail" novalidate>
        <div class="field"><label for="mail">Votre adresse e-mail professionnelle</label>
          <input id="mail" type="email" autocomplete="email" inputmode="email" placeholder="prenom.nom@${esc(co.domain)}" value="${esc(e.email)}" aria-describedby="mail-hint mail-err">
          <div class="hint" id="mail-hint">Nous vous envoyons un code à 6 chiffres pour vérifier que c'est bien vous.</div>
          <div class="err hidden" id="mail-err" role="alert"></div></div>
        <button class="btn btn-primary btn-block" type="submit">Recevoir mon code</button></form></div>
      <div class="card"><h3>Ce que voit votre employeur</h3><p class="small">Uniquement des statistiques globales et anonymes. <strong>Jamais vos réponses ni votre résultat.</strong></p></div>` });
    $("#f-mail", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = $("#mail", root).value.trim().toLowerCase(), err = $("#mail-err", root);
      let msg = "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = "Saisissez une adresse e-mail valide.";
      else if (!emailAllowed(v, co)) msg = `Cette adresse n'est pas reconnue pour ce bilan. Utilisez votre e-mail professionnel (@${co.domain}).`;
      err.textContent = msg; err.classList.toggle("hidden", !msg); $("#mail", root).setAttribute("aria-invalid", String(!!msg));
      if (!msg) { e.email = v; e.otpTries = 0; go("otp"); toast("Code envoyé (simulation)"); }
    });
    return;
  }

  if (e.step === "otp") {
    partShell(root, { step: 1, title: "Vérifiez votre e-mail", sub: "Saisissez le code reçu", body: otpHtml(e.email) });
    bind(root, { back: () => go("email"), resend: () => toast("Nouveau code envoyé — le précédent ne fonctionne plus") });
    otpBlock(root, () => {
      const r = startParticipation(c.id, e.email);
      if (!r.ok && r.reason === "ALREADY") { e.evId = r.evaluation.id; go("already"); return; }
      if (!r.ok) { toast("Ce bilan n'est plus disponible"); resetPart(c.id); render(); return; }
      e.evId = r.evaluation.id; e.prenom ||= r.person.prenom; e.nom ||= r.person.nom; e.page = 0; go("form");
    });
    return;
  }

  if (e.step === "already") {
    const ev = evalOf(e.evId);
    partShell(root, { title: "Vous avez déjà répondu", sub, body: `<div class="card" style="text-align:center"><div style="font-size:2.4rem" aria-hidden="true">✅</div>
      <p>Vous avez répondu à ce bilan le <strong>${fmt(ev.completedAt)}</strong>. Votre rapport vous a été envoyé par e-mail.</p>
      <button type="button" class="btn btn-primary" data-act="again">Renvoyer le lien de mon rapport</button></div>` });
    bind(root, { again: () => { sendReportLink(ev.id); toast("Lien renvoyé par e-mail"); go("mail"); } });
    return;
  }

  if (e.step === "form") {
    const pages = [{ key: "INFO", short: "Vous" }, ...SECTIONS];
    const p = pages[e.page];
    const answered = ITEM_KEYS.filter((k) => e.ans[k] != null).length;
    let body;
    if (p.key === "INFO") {
      body = `<div class="card"><h2>Avant de commencer</h2>
        <p class="small">Il n'y a pas de bonne ou de mauvaise réponse : répondez selon ce que vous ressentez réellement.</p>
        <div class="grid-2"><div class="field"><label for="d-prenom">Prénom</label><input id="d-prenom" data-id="prenom" autocomplete="given-name" value="${esc(e.prenom)}"></div>
          <div class="field"><label for="d-nom">Nom</label><input id="d-nom" data-id="nom" autocomplete="family-name" value="${esc(e.nom)}"></div></div>
        ${DEMO_FIELDS.map(([k, l, ch]) => `<div class="field"><label for="d-${k}">${l}</label><select id="d-${k}" data-demo="${k}"><option value="">Choisir…</option>${ch.map((x) => `<option ${e.demo[k] === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>`).join("")}
        <label class="row" style="align-items:flex-start;gap:.5rem;flex-wrap:nowrap"><input type="checkbox" id="consent" ${e.consent ? "checked" : ""} style="margin-top:.3rem">
          <span class="small">J'accepte que mes réponses soient traitées par YODAN pour produire mon bilan personnel, consultable par les médecins YODAN, et des statistiques <strong>anonymes</strong> pour mon entreprise. Mes résultats individuels ne seront jamais transmis à mon employeur. <a href="#" data-act="policy">Politique de confidentialité (${CONSENT_VERSION})</a></span></label>
        <div class="err hidden" id="form-err" role="alert"></div></div>`;
    } else {
      body = `<div class="card"><span class="kicker">Partie ${e.page} / ${SECTIONS.length} · ${p.short}</span><h2>${p.title}</h2>
        ${p.items.map((it, i) => { const name = `${p.key}${i}`; return `<fieldset class="q-block" data-q="${name}"><legend class="q-text">${esc(it.t)}</legend>
          <div class="choices">${it.o.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(e.ans[name]) === String(v) ? "checked" : ""}>${l}</label>`).join("")}</div></fieldset>`; }).join("")}
        <div class="err hidden" id="form-err" role="alert"></div></div>`;
    }
    partShell(root, { step: 2, title: "Questionnaire", sub: `${answered} / ${ITEM_KEYS.length} réponses · enregistré automatiquement`, body: `${body}
      <div class="row between" style="margin-top:1rem">
        <button type="button" class="btn" data-act="prev" ${e.page === 0 ? "disabled" : ""}>← Précédent</button>
        <button type="button" class="btn btn-primary" data-act="next">${e.page === pages.length - 1 ? "Envoyer mes réponses" : "Suivant →"}</button></div>` });
    $$("input[type=radio]", root).forEach((r) => r.addEventListener("change", () => { e.ans[r.name] = Number(r.value); r.closest(".q-block").classList.remove("missing"); }));
    $$("[data-demo]", root).forEach((s) => s.addEventListener("change", () => (e.demo[s.dataset.demo] = s.value)));
    $$("[data-id]", root).forEach((s) => s.addEventListener("input", () => (e[s.dataset.id] = s.value)));
    $("#consent", root)?.addEventListener("change", (ev) => (e.consent = ev.target.checked));
    bind(root, {
      policy: (_, ev) => { ev.preventDefault(); toast("Politique de confidentialité (à rédiger)"); },
      prev: () => { e.page--; render(); },
      next: () => {
        const err = $("#form-err", root);
        let missing = [];
        if (p.key === "INFO") {
          if (!e.prenom.trim()) missing.push("le prénom");
          if (!e.nom.trim()) missing.push("le nom");
          missing.push(...DEMO_FIELDS.filter(([k]) => !e.demo[k]).map(([, l]) => l.toLowerCase()));
          if (!e.consent) missing.push("le consentement");
        } else {
          $$(".q-block", root).forEach((q) => { const m = e.ans[q.dataset.q] == null; q.classList.toggle("missing", m); if (m) missing.push(q); });
        }
        if (missing.length) {
          err.textContent = p.key === "INFO" ? `Il manque : ${missing.join(", ")}.` : `${missing.length} question(s) sans réponse (en rouge).`;
          err.classList.remove("hidden"); return;
        }
        if (e.page < pages.length - 1) { e.page++; render(); scrollTop(); return; }
        const res = submitEvaluation({ campaignId: c.id, email: e.email, prenom: e.prenom, nom: e.nom, demo: e.demo, answers: e.ans, consent: e.consent });
        if (!res.ok) { err.textContent = { ALREADY: "Vous avez déjà répondu à ce bilan.", CLOSED: "Ce bilan est terminé." }[res.reason] || "Envoi impossible."; err.classList.remove("hidden"); return; }
        e.evId = res.evaluation.id; go("done");
      },
    });
    return;
  }

  if (e.step === "done") {
    partShell(root, { step: 3, title: "Merci !", sub: "Vos réponses sont enregistrées.", body: `
      <div class="card" style="text-align:center"><div style="font-size:2.4rem" aria-hidden="true">✉️</div>
        <h2>Votre bilan vous a été envoyé par e-mail</h2>
        <p class="small">Un e-mail a été envoyé à <strong>${esc(e.email)}</strong>. Il contient un lien sécurisé vers votre rapport détaillé.</p>
        <p class="small muted">Vous ne le trouvez pas ? Pensez à regarder dans les indésirables.</p></div>
      <div class="card"><h3>Besoin de parler à quelqu'un ?</h3><p class="small">Centre d'écoute YODAN : <strong>+225 00 00 00 00</strong> (numéro fictif), du lundi au vendredi.</p></div>` });
    return;
  }

  if (e.step === "mail") {
    partShell(root, { title: "Votre boîte mail", sub: "E-mail reçu", body: mailPreviewReport(e.email, 1, true) });
    bind(root, { open: () => go("rotp") });
    return;
  }

  if (e.step === "rotp") {
    partShell(root, { title: "Accès à votre rapport", sub: "Pour protéger votre rapport, confirmez avec le code reçu par e-mail.", body: otpHtml(e.email) });
    bind(root, { back: () => go("mail"), resend: () => toast("Nouveau code envoyé") });
    otpBlock(root, () => go("bilan"));
    return;
  }

  if (e.step === "bilan") {
    const ev = evalOf(e.evId), r = resultOf(ev);
    partShell(root, { title: "Mon rapport", sub: `${esc(c.name)} · ${fmt(ev.completedAt)} · visible par vous seul(e) et les médecins YODAN`, body: `
      <div class="result-head ${ZONE_CLS[r.profil]}"><span class="kicker" style="color:inherit">Profil global</span><div class="display">${ZONE_LABEL[r.profil]}</div><p style="margin:0">${RECO[r.profil]}</p></div>
      <div class="card" style="margin-top:1rem"><h2>Vos 5 dimensions</h2>
        ${DIMS.map((k) => `<div class="dim-row"><span>${DIM_LABEL[k]}</span><div class="meter"><span style="width:${r.dims[k].pct}%;background:var(--${ZONE_CLS[r.dims[k].zone]})"></span></div>${zonePill(r.dims[k].zone, r.dims[k].pct)}</div>`).join("")}
        <p class="disclaimer" style="margin-top:.8rem">Ce test est un outil d'interprétation et ne permet pas d'établir un diagnostic. Parlez-en à un professionnel pour bénéficier d'une meilleure orientation.</p></div>
      <div class="row" style="margin-top:1rem"><button type="button" class="btn" data-act="pdf">⬇ Télécharger en PDF</button></div>` });
    bind(root, {
      pdf: () => toast("PDF téléchargé (simulation)"),
    });
  }
}

/* =====================================================================
 * Notes UX
 * ===================================================================== */
const NOTES = {
  "yodan-campagnes": {
    title: "Admin Yodan · Campagnes",
    why: ["Création en <strong>3 champs</strong> : nom, entreprise, période. Rien d'autre à régler : le domaine e-mail vient de l'entreprise (onglet « Entreprises »).",
      "L'<strong>état est calculé</strong> à partir des dates (à venir / en cours / terminée) : jamais saisi à la main, donc jamais faux.",
      "« Créer et diffuser » ouvre directement la diffusion : lien unique + QR code + envoi du lien par e-mail.",
      "Envoi du lien : adresses <strong>collées</strong> et/ou <strong>fichier CSV</strong> (colonne « email », séparateur , ou ;, export Excel accepté). « Vérifier » montre avant l'envoi les adresses acceptées et refusées avec la raison (hors domaine, doublon, invalide, ligne sans adresse).",
      "Par ligne : <em>Diffuser</em>, <em>Résultats →</em> (ouvre le tableau de bord filtré sur la campagne), <em>Tester</em> (ouvre le formulaire comme un participant)."],
    secu: ["Le lien seul ne donne accès à rien : e-mail du domaine exact de l'entreprise + code à usage unique (OTP).", "Pas de nom d'entreprise ni de campagne dans l'URL : un code neutre (/c/XXXXXX).",
      "CSV : seule la colonne e-mail est lue, les autres (nom, matricule…) sont ignorées et jamais stockées (minimisation). Taille limitée à 1 Mo ; côté serveur, le fichier n'est pas conservé après l'envoi.",
      "Les adresses invitées sont <strong>conservées</strong> (statut « Pas de réponse ») : c'est une nouvelle donnée personnelle (e-mail seul, finalité : relance) à signaler au service central de purge."],
    q: ["Peut-on <strong>modifier la période</strong> d'une campagne ? Proposé : prolonger la fin oui ; avancer/décaler le début seulement si elle n'a pas commencé.",
      "Deux campagnes <strong>en même temps</strong> pour la même entreprise : autorisé ? (la maquette l'autorise)",
      "Salariés sans e-mail pro (terrain, usine) : hors périmètre pour l'instant ?"],
  },
  "yodan-tb": {
    title: "Admin Yodan · Tableau de bord & participants",
    why: ["Vue <strong>non censurée</strong> pour les médecins : tous les groupes affichés, profils nominatifs.",
      "3 filtres en haut : <strong>entreprise → campagne → patient</strong>. Choisir une campagne fixe l'entreprise ; changer d'entreprise retire une campagne ou un patient qui n'en fait pas partie.",
      "Avec un patient : le tableau de bord devient une <strong>fiche patient</strong> (évolution d'une campagne à l'autre, scores par dimension).",
      "La <strong>liste des participants</strong> est juste dessous et suit exactement les mêmes filtres (mêmes chiffres que le tableau de bord — vérifié par les tests). Cliquer un nom = filtrer sur ce patient.",
      "3 statuts : <strong>Terminé</strong> (questionnaire envoyé), <strong>Non terminé</strong> (lien ouvert et code validé, questionnaire pas envoyé), <strong>Pas de réponse</strong> (lien reçu par e-mail, jamais ouvert). Une personne arrivée par le QR code n'apparaît qu'à partir de « Non terminé ».",
      "Actions : <em>Rapport</em> (détail du bilan + réponses), <em>✉</em> renvoyer le lien du rapport, <em>Relancer</em> (non terminé ou pas de réponse, campagne pas finie), exports PDF (ZIP) et XLSX."],
    secu: ["Données de santé nominatives : écran réservé à un rôle <strong>médecin Yodan</strong>, avec MFA (double authentification) et sessions courtes.",
      "Chaque ouverture de rapport, renvoi et export est <strong>journalisé</strong> (qui, quand, quel dossier), sans contenu de santé dans le journal.",
      "Le patient recherché ne doit pas apparaître dans l'URL ni dans les logs du serveur.",
      "L'e-mail de rapport reste neutre : pas de profil, pas de score, pas de PDF joint."],
    q: ["Tous les admins Yodan sont-ils médecins ? Sinon, prévoir 2 rôles : <strong>admin</strong> (campagnes, statuts, sans résultats) et <strong>médecin</strong> (résultats).",
      "Un patient est identifié par son e-mail pro : s'il change d'entreprise, ce sera un autre patient. Acceptable ?",
      "Export XLSX nominatif : à garder, ou pseudonymisé par défaut ?",
      "Relance automatique des « non terminés » et « pas de réponse » avant la fin de campagne ?"],
  },
  rh: {
    title: "RH · tableau de bord",
    why: ["Le RH ne voit <strong>que son entreprise</strong> (celle de son compte) et ses campagnes déjà commencées. Pour voir une autre entreprise : se connecter avec son compte RH (bloc Démo).",
      "Mêmes calculs que la vue médecin, mais <strong>agrégés</strong> : aucune ligne individuelle, ni signaux d'alerte.",
      "Seuil de 5 : une campagne ou un groupe de moins de 5 bilans est masqué (essayez Société Test Beta · Pilote 2026, ou Âge 18-25 ans).",
      "Pas de taux de participation : avec un lien unique, on ne connaît pas l'effectif de l'entreprise."],
    secu: ["Règle non négociable 4.1.7 : aucune donnée clinique individuelle côté employeur.", "Attention aux croisements : le seuil s'applique au résultat final de chaque filtre.", "Pas d'export de qui a répondu."],
    q: ["Afficher un taux de participation ? Il faudrait ajouter l'<strong>effectif</strong> au formulaire de création d'entreprise.",
      "Sur « Toutes les campagnes », une personne qui a répondu à 2 campagnes compte 2 fois : OK ?",
      "Les nombres « non terminés » et « pas de réponse » (agrégés, jamais nominatifs) sont-ils utiles au RH pour relancer ses équipes ?"],
  },
  "yodan-entreprises": {
    title: "Admin Yodan · Entreprises",
    why: ["Version <strong>autonome</strong> : les entreprises sont créées ici (et non plus dans le système Yodan).",
      "Création en 3 champs : <strong>nom</strong>, <strong>domaine e-mail pro</strong> (« @entreprise.ci » ; on peut coller une adresse, le domaine est extrait), <strong>e-mail du RH</strong>.",
      "Le RH reçoit un e-mail avec un <strong>lien d'activation</strong> (valable 3 jours, utilisable une fois) : il choisit lui-même son mot de passe. Aucun mot de passe ne circule par e-mail.",
      "<strong>Un seul compte RH</strong> par entreprise : « Remplacer le RH » crée le nouveau compte et désactive l'ancien immédiatement. « Renvoyer l'invitation » envoie un nouveau lien (l'ancien ne marche plus).",
      "<strong>Modifier</strong> : le nom toujours ; le domaine seulement si aucune campagne n'a commencé et qu'aucune invitation n'est partie (essayez Delta). Changer le domaine oblige à remplacer le RH, dont l'adresse doit être du nouveau domaine.",
      "Archivage d'une entreprise en fin de contrat : <strong>hors périmètre pour l'instant</strong> (décision).",
      "Les comptes <strong>admin Yodan</strong> sont créés par le seed de la base (e-mail dans .env) : pas d'écran pour les créer (décision).",
      "États du compte : Invitation envoyée → Actif (mot de passe choisi) ; Invitation expirée ; Désactivé. Exemple : Delta (invitation expirée), Beta (invitation en attente)."],
    secu: ["L'e-mail du RH doit être du <strong>domaine de l'entreprise</strong> ; les messageries publiques (gmail…) sont refusées comme domaine.",
      "L'admin Yodan <strong>ne voit jamais</strong> le lien d'activation (masqué dans l'aperçu) : seul le RH le reçoit.",
      "Lien d'activation : jeton aléatoire long, stocké haché, à usage unique, expiré après 3 jours ; l'activation ne connecte pas directement : il faut ensuite mot de passe + code.",
      "Seed de l'admin Yodan : proposé de ne mettre <strong>que l'e-mail</strong> dans .env et d'envoyer un lien d'activation, plutôt qu'un mot de passe dans .env (règle 4.1.1 : aucun secret dans le dépôt ni dans les exemples).",
      "Création, remplacement, désactivation et renvoi sont journalisés. Nouvelle donnée personnelle : l'e-mail du RH (à signaler au service central de purge)."],
    q: ["Plusieurs domaines pour une même entreprise (filiales) ?",
      "Seed de l'admin Yodan : e-mail seul dans .env + lien d'activation (proposé), ou mot de passe initial dans .env à changer à la première connexion ?"],
  },
  "auth-login": {
    title: "Connexion (point d'entrée Yodan + RH)",
    why: ["Une seule page de connexion pour tous ; après connexion, chacun arrive dans son espace : <strong>médecin Yodan</strong> → campagnes, tableau de bord, entreprises ; <strong>RH</strong> → tableau de bord de son entreprise.",
      "Les salariés ne passent pas par ici : ils répondent via le lien de leur campagne.",
      "Bouton « Afficher » pour vérifier le mot de passe saisi ; lien « Mot de passe oublié ? ».",
      `Déconnexion automatique après <strong>${SESSION_IDLE_MIN} minutes d'inactivité</strong> (décision) ; un message l'explique sur cette page.`],
    secu: ["Message <strong>identique</strong> pour une adresse inconnue, un compte désactivé ou un mauvais mot de passe : on ne révèle pas quels comptes existent.",
      `Après ${MAX_FAILS} échecs, la connexion est bloquée 15 minutes pour cette adresse (attaque par essais successifs).`,
      "Les échecs sont journalisés avec l'adresse pseudonymisée (jamais en clair, jamais le mot de passe).",
      "Un compte pas encore activé ne peut pas se connecter (même message) : il faut utiliser le lien reçu ou « Mot de passe oublié »."],
    q: ["Prévenir l'utilisateur 2 minutes avant la déconnexion automatique (« Vous êtes toujours là ? ») ?"],
  },
  "auth-mfa": {
    title: "Connexion · code par e-mail (MFA)",
    why: ["Deuxième vérification après le mot de passe, pour <strong>tous</strong> les comptes (décision) : un code à 6 chiffres envoyé par e-mail.",
      "« Se souvenir de cet appareil 30 jours » évite de redemander le code à chaque fois (à ne pas cocher sur un poste partagé)."],
    secu: ["MFA (double authentification) : un mot de passe volé ne suffit pas à se connecter.", "Code valable 10 min, 5 essais ; renvoyer un code invalide le précédent.",
      "Changer son mot de passe ou désactiver le compte supprime les appareils de confiance."],
    q: ["Proposer plus tard une application d'authentification (TOTP) pour les médecins, plus robuste qu'un e-mail ?"],
  },
  "auth-activate": {
    title: "Activation du compte (lien reçu par e-mail)",
    why: ["Remplace le mot de passe temporaire : le RH ouvre le lien et choisit directement son mot de passe.", "Les règles se cochent en direct pendant la saisie ; confirmation demandée.",
      "Lien expiré ou déjà utilisé : message clair et accès direct à « Mot de passe oublié »."],
    secu: [`Règles : ${PW_MIN} caractères minimum, majuscule + minuscule, chiffre, ne contient pas l'adresse.`, "Le lien ne marche qu'une fois ; renvoyer l'invitation invalide l'ancien lien.",
      "Après l'activation, retour à la connexion (mot de passe + code) : le lien seul ne suffit pas pour entrer.", "En production : jeton et mot de passe stockés hachés, jamais en clair."],
    q: ["Vérifier aussi que le mot de passe n'apparaît pas dans une liste de mots de passe compromis ?"],
  },
  "auth-forgot": {
    title: "Mot de passe oublié · adresse",
    why: ["Même principe que le code envoyé aux participants : on prouve qu'on possède l'adresse e-mail."],
    secu: ["Réponse <strong>identique</strong> que le compte existe ou non (« si un compte existe, un code a été envoyé ») ; aucun e-mail n'est envoyé à une adresse inconnue ou désactivée."],
  },
  "auth-forgot-code": {
    title: "Mot de passe oublié · code",
    why: ["Même écran de code que la connexion et le parcours participant."],
    secu: ["Code valable 10 min, 5 essais, un seul code valide à la fois."],
  },
  "auth-forgot-new": {
    title: "Mot de passe oublié · nouveau mot de passe",
    why: ["Mêmes règles que la première connexion. Ensuite retour à la page de connexion (mot de passe + code)."],
    secu: ["Fonctionne aussi pour une invitation expirée : le RH active son compte sans repasser par Yodan.", "Débloque l'adresse après trop d'échecs et retire les appareils de confiance."],
  },
  "part-closed": {
    title: "Participant · bilan fermé",
    why: ["Le même lien sert avant, pendant et après la période : seul le message change.", "Avant : date d'ouverture en toutes lettres (et date de fin). Après : période passée + rappel que le rapport a été envoyé par e-mail.", "Testez avec le bloc Démo ci-dessous : « Bilan T1 2027 » (à venir) ou « Bilan T2 2026 » (terminée)."],
    q: ["Après la fin, faut-il quand même permettre de <strong>renvoyer le lien du rapport</strong> depuis cet écran (e-mail + code) ?"],
  },
  "part-email": {
    title: "Participant · e-mail pro",
    why: ["Une seule question : l'e-mail professionnel. Domaine vérifié selon l'entreprise de la campagne.", "Message rassurant sur ce que voit l'employeur dès la première seconde."],
    secu: ["Ne pas révéler si une adresse a déjà répondu avant d'avoir validé le code (l'écran « déjà répondu » n'apparaît qu'après l'OTP)."],
    q: ["Le message de refus doit-il citer le domaine attendu ? (aide l'utilisateur, mais révèle le domaine — risque faible)"],
  },
  "part-otp": {
    title: "Participant · code OTP",
    why: ["6 cases, avance automatique, collage accepté (le code est dans le bloc Démo)."],
    secu: ["Code valable 10 min, 5 essais, l'ancien est invalidé au renvoi ; stocké haché.", "Limiter les demandes par adresse et par IP (rate_limit.py existe)."],
  },
  "part-already": {
    title: "Participant · déjà répondu",
    why: ["Une seule participation par personne et par campagne : pas de doublon dans les statistiques.", "Raccourci utile : renvoyer le lien du rapport."],
    q: ["Autoriser à <strong>refaire</strong> le test dans la même campagne (le nouveau remplace l'ancien) ?"],
  },
  "part-form": {
    title: "Participant · questionnaire",
    why: ["Une partie par écran (6 au total) : moins intimidant sur téléphone.", "<strong>Prénom et nom</strong> demandés : nécessaires pour que le médecin retrouve un patient.", "Consentement au début, avec la version de la politique."],
    secu: ["Consentement enregistré (date, version, périmètre) — ISO 27701. Il mentionne que les médecins Yodan voient le résultat individuel.", "Sauvegarde côté serveur, pas dans le navigateur (téléphone partagé)."],
    q: ["Minimisation : le nom est-il indispensable, ou l'e-mail suffit-il au médecin ?", "Garder les 3 champs démographiques (servent aux groupes du tableau de bord) ?"],
  },
  "part-done": {
    title: "Participant · envoyé",
    why: ["<strong>Message seul</strong> : le rapport n'est pas affiché à l'écran, il part toujours par e-mail (lien). Évite qu'il reste visible sur un poste ou un téléphone partagé.", "Numéro du centre d'écoute toujours visible."],
  },
  "part-mail": {
    title: "Participant · e-mail reçu",
    why: ["L'e-mail annonce le rapport sans le contenir."],
    secu: ["Pas de profil, de score ni de PDF joint (ISO 27799) : une boîte pro peut être lue par d'autres."],
    q: ["Durée de validité du lien : 30 jours ? (renvoyable à tout moment par le médecin ou par le participant)"],
  },
  "part-rotp": {
    title: "Participant · code pour ouvrir le rapport",
    why: ["Même écran que le code d'entrée : rien de nouveau à apprendre."],
    secu: ["Protège le rapport si l'e-mail est transféré ou lu par quelqu'un d'autre."],
  },
  "part-bilan": {
    title: "Participant · mon rapport",
    why: ["Profil global (couleur + texte), 5 dimensions sur la même échelle 0-100, avertissement « pas un diagnostic ».",
      "<strong>Plus de question « acceptez-vous d'être accompagné(e) ? »</strong> (décision de réunion) : un premier entretien est prévu pour tous les employés dans le cadre de la prise en charge validée par l'entreprise ; c'est à l'issue de cet entretien qu'on garde ceux qui veulent continuer.",
      "<strong>Décidé :</strong> pour l'instant, l'annonce du premier entretien au participant et le suivi (qui continue, qui arrête) se font <strong>en interne, hors de l'application</strong>. Le rapport n'en parle donc pas."],
    secu: ["Chaque consultation du rapport est journalisée."],
  },
};
function notesKey() {
  if (state.role === "participant") return `part-${state.part.step}`;
  const a = currentAccount();
  if (!a) return `auth-${state.auth.screen}`;
  return a.role === "YODAN" ? `yodan-${state.yodan.tab}` : "rh";
}
function renderNotes() {
  const n = NOTES[notesKey()];
  const aside = $("#notes");
  const li = (arr) => arr.map((x) => `<li>${x}</li>`).join("");
  const T = window.TEST_RESULTS;
  aside.innerHTML = `<button type="button" class="notes-close" aria-label="Fermer les notes">×</button>
    ${T ? `<div class="tests-box ${T.ko ? "ko" : "ok"}"><strong>Tests : ${T.ok} OK / ${T.ko} KO</strong>${T.ko ? `<ul>${T.failed.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>`
      : `<div class="tests-box"><a href="?tests=1">Lancer les tests de cohérence</a></div>`}
    <span class="kicker">Notes UX</span><h2>${n.title}</h2>
    <span class="tag">Choix de l'écran</span><ul>${li(n.why)}</ul>
    ${n.secu ? `<span class="tag">Sécurité / conformité</span><ul class="secu">${li(n.secu)}</ul>` : ""}
    ${n.q ? `<span class="tag">Questions à valider</span><ul class="q">${li(n.q)}</ul>` : ""}
    <span class="tag">Démo (hors maquette)</span><div class="demo-box">${demoHtml()}</div>`;
  $(".notes-close", aside).addEventListener("click", () => setNotes(false));
  bindDemo(aside);
  $$("[data-jump]", aside).forEach((b) => b.addEventListener("click", () => {
    const e = state.part, c = campOf(e.campaignId), co = companyOf(c.companyId), s = b.dataset.jump;
    if (!availability(c).open) { toast("Choisissez d'abord une campagne en cours (bloc Démo)"); return; }
    e.email ||= `invite.demo@${co.domain}`;
    if (["done", "mail", "bilan"].includes(s) && !(e.evId && evalOf(e.evId)?.completedAt)) {
      randomFill();
      const res = submitEvaluation({ campaignId: c.id, email: e.email, prenom: e.prenom, nom: e.nom, demo: e.demo, answers: e.ans, consent: true });
      e.evId = res.ok ? res.evaluation.id : res.evaluation?.id;
    }
    if (s === "form") { const r = startParticipation(c.id, e.email); if (!r.ok) { toast("Cette adresse a déjà répondu"); return; } e.evId = r.evaluation.id; e.page = 0; }
    e.step = s; render();
  }));
}
/* ---------- Bloc « Démo » du panneau Notes UX : tout ce qui sert à tester, hors des écrans ---------- */
/** Fichier CSV d'exemple : cas acceptés, hors domaine, doublon, adresse manquante, guillemets. */
function sampleCsv(company) {
  return ["nom;prenom;email",
    `Démo;Inès;ines.demo@${company.domain}`,
    `Test;Jules;jules.test@${company.domain}`,
    `"Exemple; Jr";Noé;noe.exemple@${company.domain}`,
    "Exemple;Léa;lea.exemple@gmail.exemple.test",
    `Démo;Inès;INES.DEMO@${company.domain}`,
    "Test;Sans;"].join("\r\n");
}
function demoHtml() {
  const sel = (id, label, options, value) => `<label class="small" for="${id}">${label}</label><select id="${id}" class="demo-sel">${options.map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const campOpts = db.campaigns.map((x) => [x.id, `${companyOf(x.companyId).name} · ${x.name} (${STATE_PILL[campaignState(x)][1].toLowerCase()})`]);
  if (state.role === "app") {
    const me = currentAccount();
    // Comptes de démo : mot de passe pour les comptes actifs, lien d'activation pour les invitations.
    const accRows = db.accounts.slice().sort((x, y) => (x.role === y.role ? 0 : x.role === "YODAN" ? -1 : 1)).map((a) => {
      const st = accountStatus(a), pw = a.pw || "";
      return `<li><span class="pill ${ACCOUNT_PILL[st][0]}">${ACCOUNT_PILL[st][1]}</span> <strong>${a.role === "YODAN" ? "Yodan" : esc(companyOf(a.companyId).name)}</strong><br>
        <code>${esc(a.email)}</code>${pw ? ` · <code>${esc(pw)}</code>` : ""}
        <div class="row" style="margin-top:.2rem">${st === "ACTIF" ? `<button type="button" class="btn btn-sm" data-demo-act="fillLogin" data-v="${a.id}">Remplir la connexion</button>` : ""}
        ${["INVITE", "EXPIREE"].includes(st) ? `<button type="button" class="btn btn-sm" data-demo-act="activate" data-v="${esc(a.activation.token)}">Ouvrir le lien d'activation</button>` : ""}
        ${st === "ACTIF" ? `<button type="button" class="btn btn-sm" data-demo-act="as" data-v="${a.id}">Connexion directe</button>` : ""}</div></li>`;
    }).join("");
    const last = db.outbox[db.outbox.length - 1];
    let html = `<p class="small">Date du jour simulée : <strong>${fmt(TODAY)}</strong>. Tout code reçu par e-mail : <strong>${FAKE_OTP}</strong>.</p>
      ${!me && ["mfa", "forgot-code"].includes(state.auth.screen) ? `<button type="button" class="btn btn-sm" data-demo-act="otp">Remplir le code</button>` : ""}
      ${me ? `<div class="row"><button type="button" class="btn btn-sm" data-demo-act="logout">Se déconnecter</button><button type="button" class="btn btn-sm" data-demo-act="idle">Simuler ${SESSION_IDLE_MIN} min d'inactivité</button></div>` : ""}
      <details ${me ? "" : "open"}><summary class="small"><strong>Comptes de démo</strong></summary><ul class="demo-accounts small">${accRows}</ul>
        <p class="small muted">« Connexion directe » saute le mot de passe et le code (démo seulement).</p></details>
      ${last ? `<details ${!me && last.kind === "INVITATION" ? "open" : ""}><summary class="small"><strong>Dernier e-mail envoyé</strong> (boîte mail simulée)</summary>${mailHtml(last, false, true)}</details>` : ""}`;
    if (me && me.role === "YODAN" && state.yodan.tab !== "entreprises") {
      html += `<p class="small" style="margin-top:.6rem"><strong>Envoi du lien</strong> (bouton « Diffuser » d'une campagne en cours) : téléchargez d'abord un fichier d'exemple, puis importez-le dans la fenêtre.</p>
      <div class="row">${COMPANIES.map((co) => `<button type="button" class="btn btn-sm" data-demo-act="csv" data-v="${co.id}">⬇ CSV ${esc(co.name.split(" ").pop())}</button>`).join("")}</div>
      <p class="small muted">Contenu : 3 adresses valides, 1 hors domaine, 1 doublon (majuscules), 1 ligne sans adresse, 1 nom entre guillemets avec « ; ».</p>`;
    }
    if (me && me.role === "YODAN" && state.yodan.tab === "entreprises") {
      html += `<p class="small" style="margin-top:.6rem">Essai complet : créez une entreprise (ex. domaine <code>epsilon.exemple.test</code>, RH <code>rh@epsilon.exemple.test</code>), déconnectez-vous, puis « Ouvrir le lien d'activation » du nouveau compte : choix du mot de passe → connexion (mot de passe + code).</p>`;
    }
    if (me && me.role === "RH") html += `<p class="small muted" style="margin-top:.6rem">Beta · « Pilote 2026 » : moins de 5 bilans (masqué). Gamma : aucune campagne commencée.</p>`;
    return html;
  }
  const e = state.part, c = campOf(e.campaignId), co = companyOf(c.companyId);
  const doneEv = db.evals.find((x) => x.campaignId === c.id && x.completedAt);
  const invEv = db.evals.find((x) => x.campaignId === c.id && statusOf(x) === "PAS_DE_REPONSE");
  const stepBox = {
    email: `<p class="small">Adresses à essayer (cliquer pour remplir) :</p><div class="stack-s">
      <button type="button" class="btn btn-sm" data-demo-act="mail" data-v="invite.demo@${esc(co.domain)}">invite.demo@${esc(co.domain)} · nouvelle personne</button>
      ${invEv ? `<button type="button" class="btn btn-sm" data-demo-act="mail" data-v="${esc(personOf(invEv.personId).email)}">${esc(personOf(invEv.personId).email)} · invitée, pas de réponse</button>` : ""}
      ${doneEv ? `<button type="button" class="btn btn-sm" data-demo-act="mail" data-v="${esc(personOf(doneEv.personId).email)}">${esc(personOf(doneEv.personId).email)} · a déjà répondu</button>` : ""}
      <button type="button" class="btn btn-sm" data-demo-act="mail" data-v="aya@gmail.exemple.test">aya@gmail.exemple.test · refusée</button></div>`,
    otp: `<p class="small">Code reçu par e-mail (simulé) : <strong>${FAKE_OTP}</strong></p><button type="button" class="btn btn-sm" data-demo-act="otp">Remplir le code</button>`,
    rotp: `<p class="small">Code reçu par e-mail (simulé) : <strong>${FAKE_OTP}</strong></p><button type="button" class="btn btn-sm" data-demo-act="otp">Remplir le code</button>`,
    form: `<button type="button" class="btn btn-sm" data-demo-act="fill">Remplir au hasard</button>`,
    done: `<button type="button" class="btn btn-sm" data-demo-act="jump" data-v="mail">Ouvrir la boîte mail du participant</button>`,
    bilan: `<button type="button" class="btn btn-sm" data-demo-act="restart">Recommencer le parcours</button>`,
  }[e.step] || "";
  return sel("demo-link", "Lien de campagne ouvert", campOpts, c.id) +
    `<p class="small muted mono-s">${esc(campaignUrl(c))}</p>${stepBox}
    <p class="small" style="margin-top:.6rem">Aller à l'étape :</p><div class="row">${["email", "otp", "form", "done", "mail", "bilan"].map((s) => `<button type="button" class="btn btn-sm" data-jump="${s}">${s}</button>`).join("")}</div>`;
}
function bindDemo(aside) {
  $("#demo-link", aside)?.addEventListener("change", (ev) => { resetPart(ev.target.value); render(); });
  $$("[data-demo-act]", aside).forEach((b) => b.addEventListener("click", () => {
    const e = state.part, v = b.dataset.v;
    ({
      fillLogin: () => {
        const a = accountOf(v);
        session.accountId = null;
        state.auth = { ...AUTH_DEFAULT, email: a.email, prefillPw: a.pw || "" };
        render(); scrollTop();
      },
      as: () => { openSession(v); audit("CONNEXION_DEMO", v, v); state.auth = { ...AUTH_DEFAULT }; render(); scrollTop(); },
      activate: () => { session.accountId = null; state.role = "app"; state.auth = { ...AUTH_DEFAULT, screen: "activate", token: v }; render(); scrollTop(); },
      idle: () => { session.lastActivity = Date.now() - (SESSION_IDLE_MIN * 60000 + 1000); checkIdle(); },
      logout: () => logout(),
      csv: () => {
        const co = companyOf(v), url = URL.createObjectURL(new Blob(["﻿" + sampleCsv(co)], { type: "text/csv;charset=utf-8" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: `exemple-destinataires-${co.id}.csv` });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      mail: () => { const inp = $("#stage #mail"); if (inp) { inp.value = v; inp.focus(); } },
      otp: () => { $$("#stage .otp input").forEach((i, k) => (i.value = FAKE_OTP[k])); $("#stage form button[type=submit]")?.focus(); },
      fill: () => { randomFill(); render(); },
      jump: () => { e.step = v; render(); scrollTop(); },
      restart: () => { resetPart(e.campaignId); render(); scrollTop(); },
    })[b.dataset.demoAct]?.();
  }));
}
function setNotes(on) {
  state.notes = on;
  $("#notes-toggle").setAttribute("aria-pressed", String(on));
  $("#layout").classList.toggle("with-notes", on);
  $("#notes").hidden = !on;
}

/* =====================================================================
 * Démarrage
 * ===================================================================== */
$("#role-switch").innerHTML = ROLES.map((r) => `<button type="button" data-role="${r.id}">${r.label}</button>`).join("");
$("#role-select").innerHTML = ROLES.map((r) => `<option value="${r.id}">${r.label}</option>`).join("");
$$("#role-switch button").forEach((b) => b.addEventListener("click", () => { state.role = b.dataset.role; render(); }));
$("#role-select").addEventListener("change", (e) => { state.role = e.target.value; render(); });
$$(".device-switch button").forEach((b) => b.addEventListener("click", () => { state.device = b.dataset.device; render(); }));
$("#notes-toggle").addEventListener("click", () => setNotes(!state.notes));
const measureBar = () => document.documentElement.style.setProperty("--bar-h", $("#mock-bar").offsetHeight + "px");
window.addEventListener("resize", measureBar);
if (matchMedia("(max-width: 760px)").matches) { state.device = "mobile"; setNotes(false); }
measureBar();
// Déconnexion après inactivité : toute action dans l'application repousse l'échéance.
["click", "keydown", "input"].forEach((ev) => $("#stage").addEventListener(ev, () => { if (session.accountId) session.lastActivity = Date.now(); }));
setInterval(checkIdle, 15000);
render();
