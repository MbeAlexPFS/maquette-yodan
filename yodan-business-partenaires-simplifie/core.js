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
 * Notation : Administrateur (ex-Super administrateur) · Superviseur principal (ex-Administrateur)
 *            · Superviseur secondaire (ex-Superviseur adjoint) · Validateur · Évaluateur
 * ===================================================================== */
/** Du plus petit au plus grand. */
const ROLES = ["EVAL", "VALID", "SUPADJ", "SUPPRI", "ADMIN"];
const ROLE_LABEL = { EVAL: "Évaluateur", VALID: "Validateur", SUPADJ: "Superviseur secondaire", SUPPRI: "Superviseur principal", ADMIN: "Administrateur" };
const ROLE_OLD = { SUPADJ: "ex-Superviseur adjoint", SUPPRI: "ex-Administrateur", ADMIN: "ex-Super administrateur" };
/** Rôle essentiel : un partenaire a toujours un Superviseur principal (les données pour piloter). */
const ESSENTIAL_ROLE = "SUPPRI";
/** Fonctionnalités propres à chaque rôle (onglets). Le Superviseur secondaire a le tableau de bord du principal, limité à ses agences. */
const OWN_FEATURES = { EVAL: ["evaluation"], VALID: ["validation"], SUPADJ: ["dashboard", "suivi"], SUPPRI: ["dashboard"], ADMIN: ["comptes"] };
/** Rôles dont le périmètre est limité aux agences du compte. */
const AGENCY_SCOPED = ["EVAL", "VALID", "SUPADJ"];
const FEATURE_ORDER = ["dashboard", "campagne", "evaluation", "validation", "suivi", "comptes"];
const FEATURE_LABEL = { evaluation: "Évaluation", validation: "Validation", suivi: "Suivi des agences", dashboard: "Tableau de bord", comptes: "Comptes", campagne: "Campagnes" };
const FEATURE_ICON = { evaluation: "📝", validation: "✅", suivi: "🧭", dashboard: "📊", comptes: "👥", campagne: "📣" };
const rank = (r) => ROLES.indexOf(r);
const rolesDesc = () => [...ROLES].reverse();

/* =====================================================================
 * Types de partenaire : on travaille par type. Seul réglage possible : inclure une fonctionnalité
 * d'un rôle dans un autre rôle (ex. donner l'onglet Validation au Superviseur principal).
 * ===================================================================== */
const PARTNER_TYPES = {
  ENTREPRISE: { label: "Entreprise", ico: "🏢", desc: "Superviseur principal seul, avec les campagnes." },
  MUTUELLE: { label: "Association / mutuelle", ico: "🤝", desc: "Validateur, Superviseur secondaire, Superviseur principal et Administrateur ; campagnes chez le Validateur." },
};
const PUBLIC_DOMAINS = ["gmail.com", "yahoo.fr", "yahoo.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "live.fr", "icloud.com"];

/** Fonctionnalité d'un rôle (propre ou campagne placée sur lui). */
const featuresOfRole = (cfg, r) => [...OWN_FEATURES[r], ...(cfg.campaign.roles.includes(r) ? ["campagne"] : [])];
/**
 * Fonctionnalités d'un rôle : les siennes (fixes) puis celles des autres rôles, que l'on peut inclure une par une.
 * @returns {{key:string, from:string, own:boolean}[]}
 */
function featuresAvailable(cfg, r) {
  const out = [];
  const push = (key, from, own) => { if (!out.some((f) => f.key === key)) out.push({ key, from, own }); };
  featuresOfRole(cfg, r).forEach((f) => push(f, r, true));
  rolesDesc().filter((x) => x !== r).forEach((x) => featuresOfRole(cfg, x).forEach((f) => push(f, x, false)));
  return out;
}
/** Remet la configuration d'aplomb : Superviseur principal toujours actif, inclusions connues pour chaque rôle. */
function normalizeConfig(cfg, defaultInclude = () => false) {
  cfg.roles[ESSENTIAL_ROLE].on = true;
  ROLES.forEach((r) => {
    const inh = cfg.roles[r].inherit;
    const avail = featuresAvailable(cfg, r).filter((f) => !f.own);
    avail.forEach((f) => { if (!(f.key in inh)) inh[f.key] = defaultInclude(r, f.key, f.from); });
    Object.keys(inh).forEach((k) => { if (!avail.some((f) => f.key === k)) delete inh[k]; });
  });
  return cfg;
}
const blankRoles = (enabled) => Object.fromEntries(ROLES.map((r) => [r, { on: enabled.includes(r) || r === ESSENTIAL_ROLE, inherit: {} }]));
/** Préréglage d'un type (copie neuve à chaque appel). */
function presetFor(type) {
  if (type === "MUTUELLE") {
    // Les rôles du dessus reprennent les fonctionnalités des rôles du dessous, sauf l'Évaluation (pas d'évaluateur).
    return normalizeConfig({ tests: ["BSPA"], roles: blankRoles(["VALID", "SUPADJ", "SUPPRI", "ADMIN"]), campaign: { on: true, roles: ["VALID"], emailPro: false, domains: [] } },
      (r, k, from) => rank(from) < rank(r) && k !== "evaluation");
  }
  return normalizeConfig({ tests: ["BSPA"], roles: blankRoles(["SUPPRI"]), campaign: { on: true, roles: ["SUPPRI"], emailPro: false, domains: [] } });
}
const cloneCfg = (cfg) => JSON.parse(JSON.stringify(cfg));
/** Compare deux configurations (inclusions seulement : les rôles et la campagne sont fixés par le type). */
const sameConfig = (a, b) => {
  const k = (c) => JSON.stringify(ROLES.map((r) => [r, Object.keys(c.roles[r].inherit).sort().map((f) => [f, !!c.roles[r].inherit[f]])]));
  return k(a) === k(b);
};
/** Onglets d'un rôle : ses fonctionnalités propres d'abord, puis les fonctionnalités incluses (ordre fixe). */
function tabsFor(cfg, r) {
  if (!cfg.roles[r] || !cfg.roles[r].on) return [];
  const own = featuresOfRole(cfg, r);
  const order = (f) => (f.own ? own.indexOf(f.key) : 10 + FEATURE_ORDER.indexOf(f.key));
  return featuresAvailable(cfg, r).filter((f) => f.own || cfg.roles[r].inherit[f.key]).sort((a, b) => order(a) - order(b)).map((f) => f.key);
}
const enabledRoles = (cfg) => ROLES.filter((r) => cfg.roles[r].on);
/** Rôle du premier compte créé : le plus grand rôle actif du partenaire. */
const highestRole = (cfg) => enabledRoles(cfg).at(-1);
/** Inclure (ou retirer) une fonctionnalité d'un autre rôle dans un rôle actif. */
function setInclude(cfg, r, key, on) {
  if (!cfg.roles[r]?.on || !featuresAvailable(cfg, r).some((f) => !f.own && f.key === key)) return false;
  cfg.roles[r].inherit[key] = !!on;
  return true;
}
/** Partenaires qui ont une fonctionnalité donnée sur au moins un rôle actif. */
const hasFeature = (cfg, key) => enabledRoles(cfg).some((r) => tabsFor(cfg, r).includes(key));

/* =====================================================================
 * Données (une seule « base » en mémoire)
 * ===================================================================== */
const db = {
  partners: [], identities: [], assignments: [], outbox: [], challenges: [], audit: [], logs: [],
  evaluations: [], people: [], patients: [], campaigns: [], participants: [], reportLinks: [],
  /** Réglages globaux (admin LAMIFI) : secteurs et listes par défaut des directions / régions. */
  settings: { sectors: [], defaultUnits: { ENTREPRISE: [], MUTUELLE: [] } },
};
/* Le domaine (tests, parcours de soin, tableaux de bord) est dans domain.js ; la démo dans seed.js. */
/** Session ouverte par la page de connexion (null = accès direct de démo par la barre de maquette). */
const session = { identityId: null, lastActivity: 0, role: null };

const partnerOf = (id) => db.partners.find((p) => p.id === id);
const identityOf = (id) => db.identities.find((i) => i.id === id);
const identityByEmail = (email) => db.identities.find((i) => i.email === normEmail(email));
const patientOf = (id) => db.patients.find((p) => p.id === id);
const personOf = (id) => db.people.find((p) => p.id === id);
const evaluationOf = (id) => db.evaluations.find((e) => e.id === id);
const campaignOf = (id) => db.campaigns.find((c) => c.id === id);
const normEmail = (e) => String(e ?? "").trim().toLowerCase();
const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const domainOf = (e) => normEmail(e).split("@").pop();

/**
 * Journal des accès en écriture seule, sur le modèle de l'application CNPS (AccessLog) :
 * qui (utilisateur), de quel côté (LAMIFI, YODAN, partenaire, public), pour quel partenaire (tenant),
 * quelle action (code), quel dossier, depuis quelle IP, quand — jamais de contenu de santé (règle 4.1.4).
 * Chaque entrée est figée (Object.freeze) : on ne peut ni la modifier ni la supprimer depuis l'application.
 * TODO SECURITE: en production, retirer aussi les droits UPDATE / DELETE au compte SQL de l'application.
 */
const ACTION_CODES = {
  "Connexion": "auth.login_mfa", "Déconnexion": "auth.logout", "Changement mot de passe": "auth.password_change",
  "Création identifiant": "user.create", "Ajout rôle": "user.role_add", "Désactivation rôle": "user.role_deactivate", "Réactivation rôle": "user.role_activate",
  "Désactivation identifiant": "user.deactivate", "Réactivation identifiant": "user.activate", "Migration rôle": "user.role_migrate", "Renvoi invitation": "user.invite_resend",
  "Création partenaire": "system.tenant_create", "Inclusion de fonctionnalité": "system.tenant_roles", "Création agence": "agency.create",
  "Secteurs d'activité": "system.sectors", "Liste par défaut": "system.unit_defaults", "Liste du partenaire": "system.tenant_units",
  "Création campagne": "campaign.create", "Envoi campagne": "campaign.send", "Évaluation transmise": "evaluation.create", "Bilan de campagne": "evaluation.campaign_submit",
  "Décision": "evaluation.validate", "Consultation détail évaluations": "evaluation.list_view", "Recherche de dossier": "evaluation.lookup",
  "Ouverture rapport individuel": "final_report.view", "Consultation fiche personne": "patient.view", "Appel": "patient.call", "Retour d'appel": "patient.call_result",
  "Clôture": "care.close", "Export personnes à prendre en charge": "care.export",
  "Renvoi du rapport (lien unique)": "report.link_send", "Ouverture du rapport par la personne": "report.link_open", "Export PDF du rapport": "report.pdf",
  "Export": "export.csv", "Export SQL": "export.sql",
  "Consultation journal interne": "logs.view", "Téléchargement journal interne": "logs.download",
};
const SIDE_LABEL = { LAMIFI: "LAMIFI", YODAN: "YODAN", PARTENAIRE: "Partenaire", PUBLIC: "Public", SYSTEME: "Système" };
/** IP fictive et stable par auteur (plages réservées à la documentation : aucune vraie adresse). */
const fakeIp = (who, side) => (side === "PUBLIC" ? `203.0.113.${(hash(String(who) + clock.now) % 250) + 1}` : `192.0.2.${(hash(String(who)) % 250) + 1}`);
function audit(label, target = "", meta = {}) {
  const i = session.identityId ? identityOf(session.identityId) : null;
  const space = typeof ui !== "undefined" ? ui.space : null;
  const dossier = meta.dossier ?? (String(target).match(/\b[A-Z]{3}-\d{5}\b/) || [null])[0];
  const ev = dossier ? db.evaluations.find((e) => e.dossier === dossier) : null;
  const side = meta.side || (i ? { LAMIFI_ADMIN: "LAMIFI", YODAN_ADMIN: "YODAN", PARTNER: "PARTENAIRE" }[i.kind] : { lamifi: "LAMIFI", yodan: "YODAN", partner: "PARTENAIRE", public: "PUBLIC" }[space] || "SYSTEME");
  const byName = db.partners.find((p) => String(target).includes(p.name));
  const partnerId = meta.partnerId !== undefined ? meta.partnerId : ev?.partnerId ?? i?.partnerId ?? (["PARTENAIRE", "PUBLIC"].includes(side) && typeof ui !== "undefined" ? ui.partnerId : byName?.id) ?? null;
  const who = meta.who !== undefined ? meta.who : i ? i.email : side === "PUBLIC" ? null : "accès démo";
  db.audit.push(Object.freeze({
    id: db.audit.length + 1, at: meta.at ?? clock.now, who, side, partnerId, action: ACTION_CODES[label] || slugOf(label).replace(/-/g, "_"), label, dossier,
    ip: meta.ip ?? fakeIp(who, side), details: Object.freeze({ ...(target ? { cible: String(target) } : {}), ...(meta.details || {}) }),
  }));
}
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
  const cfg = input.cfg;
  if (!cfg.tests.length) e.tests = "Choisissez au moins un test.";
  else if (cfg.tests.some((t) => !TESTS[t])) e.tests = "Test inconnu.";
  if (!PARTNER_TYPES[input.type]) e.type = "Choisissez un type.";
  if (!input.sector) e.sector = "Choisissez un secteur d'activité.";
  else if (!db.settings.sectors.includes(input.sector)) e.sector = "Secteur inconnu : il doit figurer dans la liste de l'admin LAMIFI.";
  if (cfg.campaign.on) {
    if (!cfg.campaign.roles.length) e.campaign = "Placez la campagne sur au moins un rôle actif.";
    if (cfg.campaign.roles.some((r) => !cfg.roles[r].on)) e.campaign = "La campagne ne peut être placée que sur un rôle actif.";
    if (cfg.campaign.emailPro) {
      const bad = cfg.campaign.domains.filter((x) => PUBLIC_DOMAINS.includes(x) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x));
      if (!cfg.campaign.domains.length) e.domains = "E-mail pro activé : indiquez au moins un domaine.";
      else if (bad.length) e.domains = `Domaine refusé : ${bad.join(", ")} (messagerie publique ou format invalide).`;
    }
  }
  const fa = input.firstAccount || {};
  if (!String(fa.name ?? "").trim()) e.faName = "Nom du titulaire du premier compte.";
  if (!isEmail(normEmail(fa.email))) e.faEmail = "Adresse e-mail invalide.";
  else if (identityByEmail(fa.email)) e.faEmail = "Cette adresse a déjà un identifiant.";
  else if (cfg.campaign.emailPro && cfg.campaign.domains.length && !cfg.campaign.domains.includes(domainOf(fa.email))) e.faEmail = "Utilisez une adresse d'un domaine autorisé.";
  return e;
}
const parseDomains = (text) => [...new Set(String(text ?? "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];

/** Crée le partenaire, son premier compte (plus grand rôle actif) et envoie le lien d'activation. */
function createPartner(input, { silent = false } = {}) {
  const errors = validatePartner(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const cfg = normalizeConfig(cloneCfg(input.cfg));
  const name = input.name.trim();
  const slug = slugOf(name);
  const p = {
    id: newId("pt"), name, slug, type: input.type, customized: !sameConfig(cfg, presetFor(input.type)),
    createdAt: todayIso(), agencies: input.agencies || ["Siège"], ...cfg, ...domainDefaults(input.type, input.agencies || ["Siège"]),
    // Base unique pour tous les partenaires : chaque ligne porte l'identifiant du tenant (= id du partenaire),
    // et la base filtre par tenant (row-level security) en plus du code applicatif.
    tenant: `T-${slug}`,
    // Métadonnées (filtres seulement) : secteur choisi dans la liste LAMIFI ; directions / régions copiées
    // depuis la liste par défaut Yodan du type (copie : modifier le modèle ne change pas ce partenaire).
    sector: input.sector, units: [...db.settings.defaultUnits[input.type]],
  };
  db.partners.push(p);
  const role = highestRole(p);
  const idn = createIdentity({ partnerId: p.id, name: input.firstAccount.name, email: input.firstAccount.email }, { silent, skipDomain: true });
  addRole(idn.identity.id, role, [...p.agencies]);
  if (!silent) audit("Création partenaire", `${name} (${PARTNER_TYPES[p.type].label}${p.customized ? ", modifié" : ""})`);
  return { ok: true, partner: p, identity: idn.identity, role };
}

/* =====================================================================
 * Métadonnées des partenaires (filtres seulement, jamais d'identification)
 *  - secteur d'activité : liste gérée par l'admin LAMIFI, choisie à la création du partenaire ;
 *  - directions (entreprise) / structures géographiques (mutuelle) : liste par défaut par type gérée par
 *    l'admin LAMIFI, copiée à la création, puis personnalisée partenaire par partenaire par l'admin Yodan.
 * ===================================================================== */
const UNIT_LABEL = {
  ENTREPRISE: { one: "Direction", list: "Directions", all: "Toutes les directions", ex: "Ressources humaines" },
  MUTUELLE: { one: "Région", list: "Structures géographiques", all: "Toutes les régions", ex: "Région du Centre" },
};
/** Champ du questionnaire : direction (entreprise) ou région (mutuelle), options = liste actuelle du partenaire. */
const unitField = (p) => ({ key: "unite", label: UNIT_LABEL[p.type].one, type: "select", options: [...p.units], pii: false, required: true, level: "person" });
/** Champs du questionnaire d'un partenaire : identité, puis direction / région, puis profil (statistiques). */
const fieldsOf = (p) => { const f = [...p.fields]; f.splice(3, 0, unitField(p)); return f; };
/** Texte saisi (une valeur par ligne) → liste propre, sans doublon (casse et accents ignorés). */
function parseList(text) {
  const out = [];
  String(text ?? "").split(/\r?\n/).map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean).forEach((x) => { if (!out.some((y) => norm(y) === norm(x))) out.push(x); });
  return out;
}
const checkList = (list, what) => (!list.length ? `Indiquez au moins ${what}.` : list.some((x) => x.length > 60) ? "60 caractères maximum par ligne." : null);
/** Admin LAMIFI : liste des secteurs. Un secteur utilisé par un partenaire ne peut pas être retiré. */
function setSectors(text) {
  const list = parseList(text);
  const err = checkList(list, "un secteur");
  if (err) return { ok: false, err };
  const used = db.partners.filter((p) => !list.includes(p.sector)).map((p) => `${p.sector} (${p.name})`);
  if (used.length) return { ok: false, err: `Secteur utilisé, impossible de le retirer : ${used.join(", ")}.` };
  db.settings.sectors = list;
  audit("Secteurs d'activité", `${list.length} secteur(s)`);
  return { ok: true, list };
}
/** Admin LAMIFI : liste par défaut d'un type (ne change pas les partenaires existants). */
function setDefaultUnits(type, text) {
  const list = parseList(text);
  const err = checkList(list, `une ${UNIT_LABEL[type].one.toLowerCase()}`);
  if (err) return { ok: false, err };
  db.settings.defaultUnits[type] = list;
  audit("Liste par défaut", `${UNIT_LABEL[type].list} (${PARTNER_TYPES[type].label})`);
  return { ok: true, list };
}
/** Admin Yodan : liste d'un partenaire. Les bilans déjà enregistrés gardent leur valeur. */
function setPartnerUnits(partnerId, text) {
  const p = partnerOf(partnerId);
  const list = parseList(text);
  const err = checkList(list, `une ${UNIT_LABEL[p.type].one.toLowerCase()}`);
  if (err) return { ok: false, err };
  p.units = list;
  audit("Liste du partenaire", `${UNIT_LABEL[p.type].list} — ${p.name}`, { partnerId: p.id });
  return { ok: true, list };
}

/* =====================================================================
 * Identifiants, rôles, migration (création de profil refaite)
 * Un identifiant (personne + e-mail) d'abord, puis un ou plusieurs rôles rattachés.
 * ===================================================================== */
const PW_MIN = 12, OTP_VALID_MIN = 10, OTP_TRIES = 5, ACTIVATION_HOURS = 72, IDLE_MIN = 30;
const DEMO_PASSWORD = "Demo-Lamifi-2026";
const APP_URL = "https://lamifi.yodan.exemple.test";
const KIND_LABEL = { PARTNER: "Partenaire", LAMIFI_ADMIN: "Admin LAMIFI Business", YODAN_ADMIN: "Admin Yodan" };
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

