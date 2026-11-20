/*
 * Maquette LAMIFI Business — partenaires par type. Données 100 % fictives, aucun appel réseau.
 * core.js : outils, données de démo et RÈGLES MÉTIER (fonctions pures partagées par les écrans et tests.js).
 *
 * Règle de construction (CLAUDE.md §9) : le générateur de démo ne produit que des FAITS
 * (réponses, dates, bons, consultations…). Les statuts, onglets, compteurs et tableaux de bord
 * sont CALCULÉS par les fonctions ci-dessous, les mêmes que celles des écrans et des tests.
 */
"use strict";

/* =====================================================================
 * Outils
 * ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pad = (n) => String(n).padStart(2, "0");
const slugOf = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash = (s) => { let x = 2166136261; for (const c of String(s)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
let idSeq = 0;
const newId = (p) => `${p}${++idSeq}`;

/* ---------- Horloge simulée (barre d'outils de démo) ---------- */
const CLOCK_START = Date.parse("2026-11-18T09:00:00");
const clock = { now: CLOCK_START };
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const isoOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const todayIso = () => isoOf(clock.now);
const addDays = (iso, n) => isoOf(Date.parse(`${iso}T12:00:00`) + n * DAY);
const fmtDate = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const fmtTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDateTime = (ms) => `${fmtDate(isoOf(ms))} ${fmtTime(ms)}`;

/* =====================================================================
 * Rôles et fonctionnalités
 * Nouvelle notation : Administrateur → Superviseur principal · Super administrateur → Administrateur
 *                     · Superviseur → Superviseur adjoint
 * ===================================================================== */
/** Du plus petit au plus grand : un rôle « parent » est plus haut dans cette liste que ses « enfants ». */
const ROLES = ["EVAL", "VALID", "SUPADJ", "SUPPRI", "ADMIN"];
const ROLE_LABEL = { EVAL: "Évaluateur", VALID: "Validateur", SUPADJ: "Superviseur adjoint", SUPPRI: "Superviseur principal", ADMIN: "Administrateur" };
const ROLE_OLD = { SUPADJ: "ex-Superviseur", SUPPRI: "ex-Administrateur", ADMIN: "ex-Super administrateur" };
/** Rôle essentiel : un partenaire a toujours un Superviseur principal (les données pour piloter). */
const ESSENTIAL_ROLE = "SUPPRI";
/** Fonctionnalités propres à chaque rôle (onglets). La campagne est une fonctionnalité placée sur un ou plusieurs rôles. */
/** Le Superviseur adjoint a le même tableau de bord que le Superviseur principal, limité à ses agences. */
const OWN_FEATURES = { EVAL: ["evaluation"], VALID: ["validation"], SUPADJ: ["dashboard", "suivi"], SUPPRI: ["dashboard"], ADMIN: ["comptes"] };
/** Rôles dont le périmètre est limité aux agences du compte (les autres voient tout le réseau du partenaire). */
const AGENCY_SCOPED = ["EVAL", "VALID", "SUPADJ"];
const FEATURE_ORDER = ["dashboard", "campagne", "evaluation", "validation", "suivi", "comptes"];
const FEATURE_LABEL = { evaluation: "Évaluation", validation: "Validation", suivi: "Suivi des agences", dashboard: "Tableau de bord", comptes: "Comptes", campagne: "Campagnes" };
const FEATURE_ICON = { evaluation: "📝", validation: "✅", suivi: "🧭", dashboard: "📊", comptes: "👥", campagne: "📣" };
const rank = (r) => ROLES.indexOf(r);
const childrenOf = (r) => ROLES.slice(0, rank(r));
const rolesDesc = () => [...ROLES].reverse();

/* =====================================================================
 * Types de partenaire et préréglages
 * ===================================================================== */
const PARTNER_TYPES = {
  CNPS: { label: "CNPS", ico: "🏦", desc: "Test PCL-5, tous les rôles, les parents reprennent les fonctionnalités des enfants. Bon de prise en charge." },
  LONACI: { label: "LONACI", ico: "🎲", desc: "Test ICJE, Superviseur principal seul, sans héritage. Budget de consultations." },
  ENTREPRISE: { label: "Entreprise", ico: "🏢", desc: "BSPA (+ autres tests au choix), Superviseur principal avec campagne et e-mail pro. Budget." },
  MUTUELLE: { label: "Association / mutuelle", ico: "🤝", desc: "BSPA, tous les rôles sauf Évaluateur (aucune évaluation), campagne chez le Validateur (e-mail pro). Budget." },
  PERSO: { label: "Personnalisé", ico: "🧩", desc: "Rôles, fonctionnalités, tests, campagne et prise en charge réglés à la main." },
};
const PEC_MODE_LABEL = { bon: "Bon de prise en charge", budget: "Budget de consultations" };
const MAX_CONSULT_DEFAULT = 10;
const PUBLIC_DOMAINS = ["gmail.com", "yahoo.fr", "yahoo.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "live.fr", "icloud.com"];

/**
 * Fonctionnalités disponibles pour un rôle : les siennes (fixes), la campagne si elle est placée sur lui,
 * puis celles de chaque rôle enfant (héritables, réglables une par une).
 * @returns {{key:string, from:string, own:boolean}[]}
 */
function featuresAvailable(cfg, r) {
  const out = [];
  const push = (key, from, own) => { if (!out.some((f) => f.key === key)) out.push({ key, from, own }); };
  OWN_FEATURES[r].forEach((f) => push(f, r, true));
  if (cfg.campaign.on && cfg.campaign.roles.includes(r)) push("campagne", r, true);
  [...childrenOf(r)].reverse().forEach((c) => {
    OWN_FEATURES[c].forEach((f) => push(f, c, false));
    if (cfg.campaign.on && cfg.campaign.roles.includes(c)) push("campagne", c, false);
  });
  return out;
}

/** Remet la configuration d'aplomb : Superviseur principal toujours actif, campagne sur des rôles actifs, héritages connus. */
function normalizeConfig(cfg, defaultInherit = () => false) {
  cfg.roles[ESSENTIAL_ROLE].on = true;
  cfg.campaign.roles = cfg.campaign.roles.filter((r) => cfg.roles[r].on);
  if (cfg.campaign.on && !cfg.campaign.roles.length) cfg.campaign.roles = [ESSENTIAL_ROLE];
  if (!cfg.campaign.on) cfg.campaign.emailPro = false;
  ROLES.forEach((r) => {
    const inh = cfg.roles[r].inherit;
    const avail = featuresAvailable(cfg, r).filter((f) => !f.own).map((f) => f.key);
    avail.forEach((k) => { if (!(k in inh)) inh[k] = defaultInherit(r, k); });
    Object.keys(inh).forEach((k) => { if (!avail.includes(k)) delete inh[k]; });
  });
  return cfg;
}

const blankRoles = (enabled) => Object.fromEntries(ROLES.map((r) => [r, { on: enabled.includes(r) || r === ESSENTIAL_ROLE, inherit: {} }]));

/** Préréglage d'un type connu (copie neuve à chaque appel). */
function presetFor(type) {
  const base = (enabled, tests, campaign, mode, inheritRule) => normalizeConfig({
    tests, roles: blankRoles(enabled), campaign: { on: false, roles: [], emailPro: false, domains: [], ...campaign }, pec: { max: MAX_CONSULT_DEFAULT, mode },
  }, inheritRule);
  switch (type) {
    case "CNPS": return base(ROLES, ["PCL-5"], {}, "bon", () => true);
    case "LONACI": return base(["SUPPRI"], ["ICJE"], {}, "budget", () => false);
    case "ENTREPRISE": return base(["SUPPRI"], ["BSPA"], { on: true, roles: ["SUPPRI"], emailPro: true }, "budget", () => false);
    // Les parents reprennent les fonctionnalités des enfants, sauf l'Évaluation (rôle Évaluateur désactivé) : personne n'a l'onglet Évaluation.
    case "MUTUELLE": return base(["VALID", "SUPADJ", "SUPPRI", "ADMIN"], ["BSPA"], { on: true, roles: ["VALID"], emailPro: true }, "budget", (r, k) => k !== "evaluation");
    default: return base(["SUPPRI"], [], {}, "budget", () => false);
  }
}
const cloneCfg = (cfg) => JSON.parse(JSON.stringify(cfg));
/** Compare deux configurations (sans les domaines, propres à chaque partenaire). */
const sameConfig = (a, b) => {
  const k = (c) => JSON.stringify({
    tests: [...c.tests].sort(),
    roles: ROLES.map((r) => [r, c.roles[r].on, Object.keys(c.roles[r].inherit).sort().map((f) => [f, !!c.roles[r].inherit[f]])]),
    campaign: [c.campaign.on, [...c.campaign.roles].sort(), c.campaign.emailPro], pec: [c.pec.max, c.pec.mode],
  });
  return k(a) === k(b);
};

/** Onglets d'un rôle chez un partenaire : ses fonctionnalités propres d'abord, puis les héritages activés (ordre fixe). */
function tabsFor(cfg, r) {
  if (!cfg.roles[r] || !cfg.roles[r].on) return [];
  const order = (f) => (f.own ? 0 : 10) + FEATURE_ORDER.indexOf(f.key);
  return featuresAvailable(cfg, r).filter((f) => f.own || cfg.roles[r].inherit[f.key]).sort((a, b) => order(a) - order(b)).map((f) => f.key);
}
const enabledRoles = (cfg) => ROLES.filter((r) => cfg.roles[r].on);
/** Rôle du premier compte créé : le plus grand rôle actif du partenaire. */
const highestRole = (cfg) => enabledRoles(cfg).at(-1);
/** Active / désactive un rôle. Le Superviseur principal ne peut pas être désactivé. */
function setRoleEnabled(cfg, r, on) {
  if (r === ESSENTIAL_ROLE && !on) return false;
  cfg.roles[r].on = on;
  normalizeConfig(cfg);
  return true;
}
/** Partenaires qui ont une fonctionnalité donnée sur au moins un rôle actif. */
const hasFeature = (cfg, key) => enabledRoles(cfg).some((r) => tabsFor(cfg, r).includes(key));

/* =====================================================================
 * Données (une seule « base » en mémoire)
 * ===================================================================== */
const db = {
  partners: [], identities: [], assignments: [], outbox: [], challenges: [], audit: [], logs: [],
  evaluations: [], people: [], patients: [], practitioners: [], campaigns: [], participants: [],
};
/* Le domaine (tests, parcours de soin, tableaux de bord) est dans domain.js ; la démo dans seed.js. */
/** Session ouverte par la page de connexion (null = accès direct de démo par la barre de maquette). */
const session = { identityId: null, lastActivity: 0, role: null };

const partnerOf = (id) => db.partners.find((p) => p.id === id);
const identityOf = (id) => db.identities.find((i) => i.id === id);
const identityByEmail = (email) => db.identities.find((i) => i.email === normEmail(email));
const patientOf = (id) => db.patients.find((p) => p.id === id);
const personOf = (id) => db.people.find((p) => p.id === id);
const practitionerOf = (id) => db.practitioners.find((p) => p.id === id);
const evaluationOf = (id) => db.evaluations.find((e) => e.id === id);
const campaignOf = (id) => db.campaigns.find((c) => c.id === id);
const normEmail = (e) => String(e ?? "").trim().toLowerCase();
const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const domainOf = (e) => normEmail(e).split("@").pop();

/** Journal des accès : qui a fait quoi, quand — jamais de contenu de santé (règle 4.1.4). */
function audit(action, target = "") { db.audit.push({ at: clock.now, who: session.identityId ? identityOf(session.identityId)?.email : "accès démo", action, target }); }
/** E-mails simulés (boîte e-mail de la barre d'outils). Aucun résultat de test dans un e-mail (ISO 27799). */
function sendMail(to, kind, subject, lines, extra = {}) { const m = { id: newId("m"), at: clock.now, to: normEmail(to), kind, subject, lines, read: false, ...extra }; db.outbox.push(m); return m; }

/* =====================================================================
 * Création d'un partenaire
 * ===================================================================== */
/** Contrôle de la saisie du formulaire de création. Renvoie un objet { champ: message } (vide si tout va bien). */
function validatePartner(input) {
  const e = {};
  const name = String(input.name ?? "").trim();
  if (!name) e.name = "Donnez un nom au partenaire.";
  else if (db.partners.some((p) => norm(p.name) === norm(name))) e.name = "Un partenaire porte déjà ce nom.";
  const d = input.db || {};
  if (!String(d.host ?? "").trim()) e.host = "Indiquez l'hôte (HOST).";
  const port = Number(d.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) e.port = "Port entre 1 et 65535.";
  if (!String(d.username ?? "").trim()) e.username = "Indiquez l'utilisateur (USERNAME).";
  if (!String(d.password ?? "")) e.password = "Indiquez le mot de passe (PASSWORD).";
  if (!/^[a-zA-Z0-9_]+$/.test(String(d.database ?? ""))) e.database = "Nom de base : lettres, chiffres et _ uniquement.";
  const cfg = input.cfg;
  if (!cfg.tests.length) e.tests = "Choisissez au moins un test.";
  else if (cfg.tests.some((t) => !TESTS[t])) e.tests = "Test inconnu.";
  if (!cfg.roles[ESSENTIAL_ROLE].on) e.roles = "Le Superviseur principal est obligatoire.";
  if (cfg.campaign.on) {
    if (!cfg.campaign.roles.length) e.campaign = "Placez la campagne sur au moins un rôle actif.";
    if (cfg.campaign.roles.some((r) => !cfg.roles[r].on)) e.campaign = "La campagne ne peut être placée que sur un rôle actif.";
    if (cfg.campaign.emailPro) {
      const bad = cfg.campaign.domains.filter((x) => PUBLIC_DOMAINS.includes(x) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x));
      if (!cfg.campaign.domains.length) e.domains = "E-mail pro activé : indiquez au moins un domaine.";
      else if (bad.length) e.domains = `Domaine refusé : ${bad.join(", ")} (messagerie publique ou format invalide).`;
    }
  }
  if (!Number.isInteger(cfg.pec.max) || cfg.pec.max < 1 || cfg.pec.max > 50) e.max = "Consultations max : entre 1 et 50.";
  if (!["bon", "budget"].includes(cfg.pec.mode)) e.mode = "Choisissez bon ou budget.";
  const fa = input.firstAccount || {};
  if (!String(fa.name ?? "").trim()) e.faName = "Nom du titulaire du premier compte.";
  if (!isEmail(normEmail(fa.email))) e.faEmail = "Adresse e-mail invalide.";
  else if (identityByEmail(fa.email)) e.faEmail = "Cette adresse a déjà un identifiant.";
  else if (cfg.campaign.emailPro && cfg.campaign.domains.length && !cfg.campaign.domains.includes(domainOf(fa.email))) e.faEmail = "Utilisez une adresse d'un domaine autorisé.";
  return e;
}
const parseDomains = (text) => [...new Set(String(text ?? "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];

/**
 * Test de connexion à la base (simulé). Un message distinct par cause d'échec, sans jamais journaliser
 * le mot de passe (CLAUDE.md §5) : hôte injoignable, authentification refusée, base absente.
 */
function testDbConnection(d) {
  const started = clock.now;
  const log = (level, msg, extra = {}) => db.logs.push({ at: clock.now, level, service: "base-partenaire", operation: "test-connexion", host: d.host, port: Number(d.port), database: d.database, msg, ...extra });
  if (/injoignable|erreur|timeout/i.test(d.host)) { log("error", "Hôte injoignable : délai dépassé (5 s)", { durationMs: 5000 }); return { ok: false, msg: "Hôte injoignable : délai de 5 s dépassé. Vérifiez HOST, PORT et le pare-feu." }; }
  if (d.password === "faux") { log("warning", "Authentification refusée par le serveur", { code: 1045 }); return { ok: false, msg: "Authentification refusée (code 1045) : USERNAME ou PASSWORD incorrect." }; }
  if (/^absente/i.test(d.database)) { log("warning", "Base inexistante", { code: 1049 }); return { ok: false, msg: `Base « ${d.database} » introuvable (code 1049).` }; }
  log("info", "Connexion réussie", { durationMs: clock.now - started + 42 });
  return { ok: true, msg: "Connexion réussie (TLS)." };
}

/** Crée le partenaire, son premier compte (plus grand rôle actif) et envoie le lien d'activation. */
function createPartner(input, { silent = false } = {}) {
  const errors = validatePartner(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const cfg = normalizeConfig(cloneCfg(input.cfg));
  const name = input.name.trim();
  const slug = slugOf(name);
  const p = {
    id: newId("pt"), name, slug, type: input.type, customized: input.type !== "PERSO" && !sameConfig(cfg, presetFor(input.type)),
    createdAt: todayIso(), agencies: input.agencies || ["Siège"], ...cfg, ...domainDefaults(input.type, input.agencies || ["Siège"]),
    // Le mot de passe de la base part dans le gestionnaire de secrets : seule une référence est gardée.
    db: { host: input.db.host.trim(), port: Number(input.db.port), username: input.db.username.trim(), database: input.db.database, secretRef: `vault://partenaires/${slug}/db` },
  };
  db.partners.push(p);
  const role = highestRole(p);
  const idn = createIdentity({ partnerId: p.id, name: input.firstAccount.name, email: input.firstAccount.email }, { silent, skipDomain: true });
  addRole(idn.identity.id, role, [...p.agencies]);
  if (!silent) audit("Création partenaire", `${name} (${PARTNER_TYPES[p.type].label}${p.customized ? ", modifié" : ""})`);
  return { ok: true, partner: p, identity: idn.identity, role };
}

/* =====================================================================
 * Identifiants, rôles, migration (création de profil refaite)
 * Un identifiant (personne + e-mail) d'abord, puis un ou plusieurs rôles rattachés.
 * ===================================================================== */
const PW_MIN = 12, OTP_VALID_MIN = 10, OTP_TRIES = 5, ACTIVATION_HOURS = 72, IDLE_MIN = 30;
const DEMO_PASSWORD = "Demo-Lamifi-2026";
const APP_URL = "https://lamifi.yodan.exemple.test";
const KIND_LABEL = { PARTNER: "Partenaire", LAMIFI_ADMIN: "Admin LAMIFI Business", YODAN_ADMIN: "Admin Yodan", CONSOLE: "Console prise en charge", PRACTITIONER: "Praticien" };
const ID_STATUS = { INVITE: ["bleu", "Invitation envoyée"], EXPIREE: ["orange", "Invitation expirée"], ACTIF: ["vert", "Actif"], DESACTIVE: ["gris", "Désactivé"] };

function identityStatus(i, now = clock.now) {
  if (i.disabled) return "DESACTIVE";
  if (i.activatedAt) return "ACTIF";
  return now - i.invitedAt > ACTIVATION_HOURS * HOUR ? "EXPIREE" : "INVITE";
}
const assignmentsOf = (identityId, activeOnly = false) => db.assignments.filter((a) => a.identityId === identityId && (!activeOnly || a.active));
const tokenOf = (seed) => (hash(seed + clock.now).toString(36) + hash(seed).toString(36)).slice(0, 14);

function issueActivation(i, silent = false) {
  i.token = tokenOf(i.email);
  i.invitedAt = clock.now;
  if (!silent) {
    sendMail(i.email, "ACTIVATION", "Activez votre compte LAMIFI Business", [
      `Bonjour ${i.name},`, "Un compte LAMIFI Business vient d'être créé pour vous.",
      `Ce lien est valable ${ACTIVATION_HOURS} heures. Un code de vérification vous sera ensuite envoyé, puis vous choisirez votre mot de passe.`,
    ], { link: `${APP_URL}/activation/${i.token}`, token: i.token });
  }
}

/** Étape 1 : créer l'identifiant (sans rôle). */
function createIdentity({ partnerId = null, name, email, kind = "PARTNER" }, { silent = false, skipDomain = false } = {}) {
  const e = {};
  const em = normEmail(email);
  if (!String(name ?? "").trim()) e.name = "Indiquez le nom.";
  if (!isEmail(em)) e.email = "Adresse e-mail invalide.";
  else if (identityByEmail(em)) e.email = "Cette adresse a déjà un identifiant.";
  const p = partnerId ? partnerOf(partnerId) : null;
  if (!skipDomain && !e.email && p && p.campaign.emailPro && p.campaign.domains.length && !p.campaign.domains.includes(domainOf(em))) e.email = `Adresse hors des domaines autorisés (${p.campaign.domains.join(", ")}).`;
  if (Object.keys(e).length) return { ok: false, errors: e };
  const i = { id: newId("id"), partnerId, kind, name: String(name).trim(), email: em, password: null, activatedAt: null, invitedAt: clock.now, disabled: false, mustChangePassword: false, token: null, createdAt: clock.now };
  db.identities.push(i);
  issueActivation(i, silent);
  if (!silent) audit("Création identifiant", em);
  return { ok: true, identity: i };
}

/** Étape 2 : ajouter un rôle à un identifiant existant (rôle actif chez le partenaire, pas en double). */
function addRole(identityId, role, agencies = []) {
  const i = identityOf(identityId);
  if (!i || i.kind !== "PARTNER") return { ok: false, err: "Identifiant introuvable." };
  const p = partnerOf(i.partnerId);
  if (!p.roles[role]?.on) return { ok: false, err: `Le rôle ${ROLE_LABEL[role]} n'est pas activé chez ${p.name}.` };
  if (assignmentsOf(identityId).some((a) => a.role === role)) return { ok: false, err: "Cet identifiant a déjà ce rôle." };
  const list = agencies.length ? agencies : [...p.agencies];
  if (role === "EVAL" && list.length !== 1) return { ok: false, err: "Un évaluateur est rattaché à une seule agence." };
  const a = { id: newId("as"), identityId, partnerId: p.id, role, agencies: list, active: true, createdAt: clock.now, history: [] };
  db.assignments.push(a);
  audit("Ajout rôle", `${ROLE_LABEL[role]} → ${i.email}`);
  return { ok: true, assignment: a };
}
/** Désactivation ciblée : un seul rôle, l'identifiant et ses autres rôles restent actifs. */
function setAssignmentActive(assignmentId, active) {
  const a = db.assignments.find((x) => x.id === assignmentId);
  if (!a) return false;
  a.active = active;
  audit(active ? "Réactivation rôle" : "Désactivation rôle", `${ROLE_LABEL[a.role]} · ${identityOf(a.identityId).email}`);
  return true;
}
function setIdentityDisabled(identityId, disabled) {
  const i = identityOf(identityId);
  if (!i) return false;
  i.disabled = disabled;
  if (disabled && session.identityId === identityId) logout("Compte désactivé.");
  audit(disabled ? "Désactivation identifiant" : "Réactivation identifiant", i.email);
  return true;
}
/** Migration : le rôle (et ses agences) passe à un autre identifiant du même partenaire ; l'historique est gardé. */
function migrateAssignment(assignmentId, targetIdentityId) {
  const a = db.assignments.find((x) => x.id === assignmentId);
  const t = identityOf(targetIdentityId);
  if (!a || !t) return { ok: false, err: "Introuvable." };
  if (t.id === a.identityId) return { ok: false, err: "Choisissez un autre identifiant." };
  if (t.partnerId !== a.partnerId) return { ok: false, err: "La migration se fait entre identifiants du même partenaire." };
  if (t.disabled) return { ok: false, err: "L'identifiant cible est désactivé." };
  if (assignmentsOf(t.id).some((x) => x.role === a.role)) return { ok: false, err: "L'identifiant cible a déjà ce rôle." };
  const from = identityOf(a.identityId);
  a.history.push({ at: clock.now, from: from.email, to: t.email });
  a.identityId = t.id;
  audit("Migration rôle", `${ROLE_LABEL[a.role]} : ${from.email} → ${t.email}`);
  return { ok: true };
}
function resendActivation(identityId) {
  const i = identityOf(identityId);
  if (!i || i.activatedAt) return false;
  issueActivation(i);
  audit("Renvoi invitation", i.email);
  return true;
}

/* =====================================================================
 * Connexion : Login → OTP → entrer · Activation : lien → OTP → mot de passe → entrer
 * ===================================================================== */
let otpSeq = 0;
function startOtp(identityId, purpose) {
  const i = identityOf(identityId);
  const code = String(100000 + (hash(`${i.email}|${purpose}|${++otpSeq}`) % 900000));
  db.challenges = db.challenges.filter((c) => !(c.identityId === identityId && c.purpose === purpose));
  const c = { id: newId("ch"), identityId, purpose, code, at: clock.now, tries: 0, used: false };
  db.challenges.push(c);
  sendMail(i.email, "OTP", "Votre code de vérification", [`Votre code : ${code}`, `Il est valable ${OTP_VALID_MIN} minutes. Ne le communiquez à personne : YODAN ne vous le demandera jamais.`], { code });
  return c;
}
/** @returns {"OK"|"EXPIRE"|"FAUX"|"BLOQUE"|"INCONNU"} */
function verifyOtp(challengeId, code) {
  const c = db.challenges.find((x) => x.id === challengeId);
  if (!c || c.used) return "INCONNU";
  if (clock.now - c.at > OTP_VALID_MIN * MIN) return "EXPIRE";
  if (c.tries >= OTP_TRIES) return "BLOQUE";
  if (String(code).trim() !== c.code) { c.tries++; return c.tries >= OTP_TRIES ? "BLOQUE" : "FAUX"; }
  c.used = true;
  return "OK";
}
/** Étape 1 de la connexion. Même message pour adresse inconnue, mot de passe faux ou compte désactivé. */
function login(email, password) {
  const i = identityByEmail(email);
  const generic = { ok: false, err: "Adresse ou mot de passe incorrect." };
  if (!i || i.disabled || !i.activatedAt || i.password !== password) { db.logs.push({ at: clock.now, level: "info", service: "auth", operation: "login", msg: "Échec de connexion (identifiants refusés)" }); return generic; }
  if (i.kind === "PARTNER" && !assignmentsOf(i.id, true).length) return { ok: false, err: "Aucun rôle actif sur ce compte. Contactez votre administrateur." };
  return { ok: true, identity: i };
}
function passwordChecks(pw, i) {
  const local = i ? i.email.split("@")[0] : "";
  return [
    [pw.length >= PW_MIN, `${PW_MIN} caractères minimum`],
    [/[a-z]/.test(pw) && /[A-Z]/.test(pw), "Majuscules et minuscules"],
    [/\d/.test(pw), "Au moins un chiffre"],
    [!local || !norm(pw).includes(norm(local)), "Ne contient pas votre adresse"],
    [!i || i.password !== pw, "Différent de l'ancien mot de passe"],
  ];
}
function setPassword(identityId, pw, confirm) {
  const i = identityOf(identityId);
  const failed = passwordChecks(pw, i).filter(([ok]) => !ok).map(([, l]) => l);
  if (failed.length) return { ok: false, err: `Mot de passe trop faible : ${failed.join(", ").toLowerCase()}.` };
  if (pw !== confirm) return { ok: false, err: "Les deux mots de passe ne correspondent pas." };
  // TODO SECURITE: en production, stocker un hachage (Argon2id / bcrypt), jamais le mot de passe.
  i.password = pw;
  i.mustChangePassword = false;
  if (!i.activatedAt) i.activatedAt = clock.now;
  i.token = null;
  audit("Changement mot de passe", i.email);
  return { ok: true };
}
/** Lien d'activation : valable 72 h, une seule fois. */
function activationIdentity(token) {
  const i = db.identities.find((x) => x.token && x.token === token);
  if (!i) return { ok: false, err: "Lien inconnu ou déjà utilisé." };
  if (i.disabled) return { ok: false, err: "Ce compte est désactivé." };
  if (i.activatedAt) return { ok: false, err: "Compte déjà activé : connectez-vous." };
  if (clock.now - i.invitedAt > ACTIVATION_HOURS * HOUR) return { ok: false, err: "Lien expiré (72 h). Demandez un nouveau lien à votre administrateur." };
  return { ok: true, identity: i };
}
/** Espace d'arrivée après connexion. Partenaire : son plus grand rôle actif. */
function landingOf(i) {
  if (i.kind === "LAMIFI_ADMIN") return { space: "lamifi" };
  if (i.kind === "YODAN_ADMIN") return { space: "yodan" };
  if (i.kind === "CONSOLE") return { space: "console" };
  if (i.kind === "PRACTITIONER") return { space: "praticien" };
  const roles = assignmentsOf(i.id, true).map((a) => a.role).filter((r) => partnerOf(i.partnerId).roles[r].on).sort((a, b) => rank(b) - rank(a));
  return { space: "partner", partnerId: i.partnerId, role: roles[0], roles };
}
function enterSession(identityId) {
  session.identityId = identityId;
  session.lastActivity = clock.now;
  audit("Connexion", identityOf(identityId).email);
  return landingOf(identityOf(identityId));
}
let onLogout = () => {};
function logout(reason = "") { if (session.identityId) audit("Déconnexion", reason || "volontaire"); session.identityId = null; session.role = null; onLogout(reason); }
const idleExpired = () => !!session.identityId && clock.now - session.lastActivity >= IDLE_MIN * MIN;

