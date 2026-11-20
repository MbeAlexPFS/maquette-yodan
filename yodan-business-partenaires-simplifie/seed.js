/*
 * seed.js : jeu de données de démo, déterministe et 100 % fictif.
 * Ne produit que des FAITS (réponses, dates, décisions, exports, clôtures) ; tout le reste est calculé (domain.js).
 */
"use strict";

const FIRST = ["Aya", "Koffi", "Mariam", "Yao", "Adjoua", "Ibrahim", "Fanta", "Serge", "Clarisse", "Bakary", "Rose", "Moussa", "Aminata", "Hervé", "Grâce", "Didier", "Nadia", "Awa", "Esther", "Paul"];
const LAST = ["Démo", "Test", "Fictif", "Exemple"];
/** Variables lues dans .env au seed (valeurs fictives de la démo). */
const ENV = { LAMIFI_ADMIN_NAME: "Admin LAMIFI Démo", LAMIFI_ADMIN_EMAIL: "admin@lamifi.exemple.test", LAMIFI_ADMIN_PASSWORD: "Temp-Seed-2026" };

function seedActiveIdentity(data, pw = DEMO_PASSWORD) {
  const r = createIdentity(data, { silent: true, skipDomain: true });
  Object.assign(r.identity, { password: pw, activatedAt: CLOCK_START - 30 * DAY, token: null, invitedAt: CLOCK_START - 31 * DAY });
  return r.identity;
}
/** Réponses qui donnent un score total visé (items de 0 à maxPer). */
function answersForTotal(n, maxPer, total, r) {
  const a = Array(n).fill(0);
  let left = Math.max(0, Math.min(total, n * maxPer));
  while (left > 0) { const i = Math.floor(r() * n); if (a[i] < maxPer) { a[i]++; left--; } }
  return a;
}
/** Réponses BSPA selon un niveau de difficulté (0 = très bien, 1 = très difficile). */
function bspaAnswers(level, r) {
  const L = () => Math.max(0, Math.min(1, level + (r() - 0.5) * 0.35));
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));
  return [
    ...Array.from({ length: 5 }, () => cl((1 - L()) * 5, 0, 5)),
    cl(L() * 4, 0, 4), cl((1 - L()) * 4, 0, 4), cl((1 - L()) * 4, 0, 4), cl(L() * 4, 0, 4),
    ...Array.from({ length: 5 }, () => cl(L() * 6, 0, 6)),
    ...Array.from({ length: 5 }, () => cl(1 + (1 - L()) * 4, 1, 5)),
    ...Array.from({ length: 3 }, () => (L() > 0.82 ? 2 : L() > 0.5 ? 1 : 0)),
  ];
}
const pickW = (r, weights) => { let x = r() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; } return weights.length - 1; };
const minIso = (a, b) => (a < b ? a : b);

function seed() {
  // Admin LAMIFI Business : créé depuis .env, change son mot de passe à la 1re connexion.
  const la = seedActiveIdentity({ name: ENV.LAMIFI_ADMIN_NAME, email: ENV.LAMIFI_ADMIN_EMAIL, kind: "LAMIFI_ADMIN" }, ENV.LAMIFI_ADMIN_PASSWORD);
  la.mustChangePassword = true;
  seedActiveIdentity({ name: "Admin Yodan Démo", email: "admin.yodan@yodan.exemple.test", kind: "YODAN_ADMIN" });

  const mk = (name, type, agencies, account, tests, domain, include = (c) => c, emailPro = false) => {
    const cfg = include(presetFor(type)); cfg.tests = tests;
    if (emailPro) { cfg.campaign.emailPro = true; cfg.campaign.domains = [domain]; }
    const r = createPartner({ name, type, cfg, agencies, firstAccount: account }, { silent: true });
    Object.assign(r.identity, { password: DEMO_PASSWORD, activatedAt: CLOCK_START - 20 * DAY, token: null });
    r.partner.createdAt = addDays(todayIso(), -240);
    return r.partner;
  };
  const alpha = mk("Entreprise Démo Alpha", "ENTREPRISE", ["Site Abidjan", "Site San-Pédro"], { name: "RH Alpha Démo", email: "rh@alpha.exemple.test" }, ["BSPA", "KARASEK"], "alpha.exemple.test", (c) => c, true);
  const beta = mk("Entreprise Démo Beta", "ENTREPRISE", ["Siège"], { name: "RH Beta Démo", email: "rh@beta.exemple.test" }, ["BSPA", "COPSOQ"], "beta.exemple.test");
  // Inclusion d'exemple : le Superviseur principal de la mutuelle a aussi l'onglet Comptes de l'Administrateur.
  const mut = mk("Mutuelle Démo Horizon", "MUTUELLE", ["Siège", "Antenne Bouaké"], { name: "Admin Horizon Démo", email: "admin@horizon.exemple.test" }, ["BSPA"], "horizon.exemple.test", (c) => { c.roles.SUPPRI.inherit.comptes = true; return c; });

  // Comptes : un identifiant d'abord, puis le(s) rôle(s).
  const ids = {};
  [
    [mut, "Principal Horizon Démo", "principal@horizon.exemple.test", [["SUPPRI"]]],
    [mut, "Secondaire Horizon Démo", "secondaire@horizon.exemple.test", [["SUPADJ", ["Antenne Bouaké"]]]],
    [mut, "Validateur Horizon Démo", "validation@horizon.exemple.test", [["VALID"]]],
  ].forEach(([p, name, email, roles]) => {
    const i = seedActiveIdentity({ partnerId: p.id, name, email });
    roles.forEach(([r, ag]) => addRole(i.id, r, ag || []));
    ids[email.split("@")[0]] = i.id;
  });
  const inv = createIdentity({ partnerId: mut.id, name: "Nouveau Validateur Démo", email: "nouveau.validateur@horizon.exemple.test" });
  addRole(inv.identity.id, "VALID", ["Antenne Bouaké"]);

  /* ---------- Campagnes et bilans (faits : invitations, ouvertures, réponses) ---------- */
  const RB = rng(777);
  const campaign = (p, name, test, start, end, invited, done, started, domain) => {
    const c = { id: newId("cp"), partnerId: p.id, name, test, start, end, createdAt: addDays(start, -7), code: tokenOf(name).slice(0, 6).toUpperCase() };
    db.campaigns.push(c);
    for (let k = 0; k < invited; k++) {
      // Le nom est tiré de l'adresse : une même personne garde le même nom d'une campagne à l'autre.
      const prenom = FIRST[(k * 3 + name.length) % FIRST.length], nom = LAST[k % LAST.length];
      const email = `${slugOf(prenom)}.${slugOf(nom)}${k}@${domain}`;
      const x = { id: newId("pp"), campaignId: c.id, email, invitedAt: c.start <= todayIso() ? c.start : minIso(c.createdAt, todayIso()), startedAt: null, completedAt: null, evalId: null };
      db.participants.push(x);
      if (c.start > todayIso() || k >= done + started) continue;
      x.startedAt = minIso(addDays(c.start, k % 9), minIso(c.end, todayIso()));
      if (k >= done) continue;
      const level = Math.pow(RB(), p.type === "MUTUELLE" ? 1 : 1.7) * 0.9;
      const answers = test === "BSPA" ? bspaAnswers(level, RB) : answersForTotal(4, 3, Math.round(level * 12), RB);
      const r = recordEvaluation({ partnerId: p.id, test, agency: p.agencies[k % p.agencies.length], mode: "campagne", campaignId: c.id, date: x.startedAt, ids: { id1: email },
        identity: { prenom, nom, email, telephone: RB() < 0.6 ? `07 00 ${pad(k % 100)} ${pad((k * 7) % 100)} ${pad((k * 3) % 100)}` : "" },
        profile: Object.fromEntries(BSPA_DEMO.map((f) => [f.key, f.options[pickW(RB, f.key === "genre" ? [5, 5, 1] : f.options.map(() => 1))]])), answers, consentsPre: { traitement: true } });
      if (!r.ok) { console.warn("seed campagne", r.err); continue; }
      if (r.evaluation.zone !== "VERT") setPostConsents(r.evaluation.id, { support: RB() < 0.55, callback: RB() < 0.5 });
      x.completedAt = x.startedAt; x.evalId = r.evaluation.id;
    }
    return c;
  };
  campaign(alpha, "Bilan 2025", "BSPA", addDays(todayIso(), -220), addDays(todayIso(), -190), 26, 21, 2, "alpha.exemple.test");
  campaign(alpha, "Bilan annuel 2026", "BSPA", addDays(todayIso(), -30), addDays(todayIso(), 10), 38, 29, 4, "alpha.exemple.test");
  campaign(alpha, "Contraintes au travail (printemps)", "KARASEK", addDays(todayIso(), -100), addDays(todayIso(), -70), 16, 12, 1, "alpha.exemple.test");
  campaign(alpha, "Contraintes au travail (automne)", "KARASEK", addDays(todayIso(), 5), addDays(todayIso(), 35), 8, 0, 0, "alpha.exemple.test");
  campaign(beta, "Bilan Beta 2026", "BSPA", addDays(todayIso(), -20), addDays(todayIso(), 15), 24, 17, 3, "beta.exemple.test");
  campaign(beta, "Risques psychosociaux", "COPSOQ", addDays(todayIso(), -80), addDays(todayIso(), -50), 14, 11, 0, "beta.exemple.test");
  campaign(mut, "Bien-être des adhérents", "BSPA", addDays(todayIso(), -40), addDays(todayIso(), 15), 64, 50, 6, "horizon.exemple.test");

  // Mutuelle : orange décidé par le validateur ; les plus anciennes sont décidées, les plus récentes attendent.
  db.evaluations.filter((e) => e.partnerId === mut.id && outcomeOf(e) === "PENDING" && daysBetween(e.date, todayIso()) > 10 && RB() < 0.85).forEach((e) => {
    Object.assign(e, { decision: RB() < 0.7 ? "YES" : "NO", decidedAt: minIso(addDays(e.date, 2), todayIso()), decidedBy: ids.validation });
    if (e.decision === "YES" && !openPatientOf(e.personId)) createPatient(e);
  });

  /* ---------- Suivi hors application : exports, appels, clôtures ---------- */
  const RP = rng(99);
  db.patients.forEach((pt) => {
    const t = todayIso(), age = daysBetween(pt.createdAt, t);
    if (age >= 3 && RP() < 0.75) pt.exports.push(minIso(addDays(pt.createdAt, 2), t));
    if (RP() < 0.3) pt.calls.push({ at: CLOCK_START - Math.floor(RP() * 20 + 2) * DAY, outcome: "JOINT", note: "Créneau convenu le mardi matin." });
    if (pt.exports.length && age > 45 && RP() < 0.7) Object.assign(pt, { closedAt: minIso(addDays(pt.createdAt, 30 + Math.floor(RP() * 30)), t), closedReason: CLOSE_REASONS[pickW(RP, [8, 1, 1])] });
  });
  db.outbox.forEach((m) => { m.read = true; });
  db.logs.length = 0;
  seedHistory();
}
/**
 * Historique de démo : reconstruit à partir des FAITS déjà générés (créations, campagnes, bilans, décisions,
 * exports, appels, clôtures) + des connexions. Même format que le journal de l'application CNPS.
 */
function seedHistory() {
  db.audit = [];
  const R = rng(5150), specs = [];
  const at = (iso, h, m = 0) => Date.parse(`${iso}T${pad(h)}:${pad(m)}:00`);
  const add = (ms, label, target, meta) => specs.push([ms, label, target, meta]);
  const LAMIFI = ENV.LAMIFI_ADMIN_EMAIL, YODAN = "admin.yodan@yodan.exemple.test";
  const owner = (p) => db.identities.find((i) => i.partnerId === p.id && assignmentsOf(i.id, true).some((a) => ["ADMIN", "SUPPRI"].includes(a.role)))?.email;
  const campaignOwner = (p) => db.identities.find((i) => i.partnerId === p.id && assignmentsOf(i.id, true).some((a) => p.campaign.roles.includes(a.role)))?.email || owner(p);
  db.partners.forEach((p) => {
    add(at(p.createdAt, 10), "Création partenaire", `${p.name} (${PARTNER_TYPES[p.type].label})`, { who: LAMIFI, side: "LAMIFI", partnerId: p.id });
    db.identities.filter((i) => i.partnerId === p.id).forEach((i, k) => {
      const first = k === 0;
      add(at(addDays(p.createdAt, first ? 0 : 3 + k), first ? 10 : 9, 5 + k), "Création identifiant", i.email, { who: first ? LAMIFI : owner(p), side: first ? "LAMIFI" : "PARTENAIRE", partnerId: p.id });
      assignmentsOf(i.id).forEach((a) => add(at(addDays(p.createdAt, first ? 0 : 3 + k), first ? 10 : 9, 7 + k), "Ajout rôle", `${ROLE_LABEL[a.role]} → ${i.email}`, { who: first ? LAMIFI : owner(p), side: first ? "LAMIFI" : "PARTENAIRE", partnerId: p.id }));
    });
    if (p.customized) add(at(addDays(p.createdAt, 1), 11), "Inclusion de fonctionnalité", p.name, { who: LAMIFI, side: "LAMIFI", partnerId: p.id });
  });
  db.campaigns.forEach((c) => {
    const p = partnerOf(c.partnerId), who = campaignOwner(p), inv = db.participants.filter((x) => x.campaignId === c.id && x.invitedAt), n = inv.length;
    const sentOn = inv.map((x) => x.invitedAt).sort()[0];
    add(at(c.createdAt, 15), "Création campagne", `${p.name} · ${c.name}`, { who, side: "PARTENAIRE", partnerId: p.id });
    if (n) add(at(sentOn, 8, 30), "Envoi campagne", `${c.name} : ${n} invitation(s)`, { who, side: "PARTENAIRE", partnerId: p.id });
  });
  db.evaluations.forEach((e) => {
    add(at(e.date, 9 + Math.floor(R() * 9), Math.floor(R() * 60)), "Bilan de campagne", e.dossier, { who: null, side: "PUBLIC", partnerId: e.partnerId, dossier: e.dossier });
    if (e.decidedAt) add(at(e.decidedAt, 10, Math.floor(R() * 60)), "Décision", `${e.dossier} : ${e.decision === "YES" ? "oui" : "non"}`, { who: identityOf(e.decidedBy)?.email, side: "PARTENAIRE", partnerId: e.partnerId, dossier: e.dossier });
  });
  const byDay = {};
  db.patients.forEach((pt) => {
    pt.exports.forEach((d) => { (byDay[d] = byDay[d] || []).push(pt); });
    pt.calls.forEach((c) => { add(c.at - 5 * MIN, "Consultation fiche personne", pt.dossier, { who: YODAN, side: "YODAN", partnerId: pt.partnerId }); add(c.at, "Retour d'appel", `${pt.dossier} : ${CALL_OUTCOMES[c.outcome]}`, { who: YODAN, side: "YODAN", partnerId: pt.partnerId }); });
    if (pt.closedAt) add(at(pt.closedAt, 16, Math.floor(R() * 60)), "Clôture", `${pt.dossier} : ${pt.closedReason}`, { who: YODAN, side: "YODAN", partnerId: pt.partnerId });
  });
  // Un export couvre plusieurs partenaires : une entrée par partenaire concerné (chaque tenant a sa trace).
  Object.entries(byDay).forEach(([d, pts]) => [...new Set(pts.map((x) => x.partnerId))].forEach((pid) => add(at(d, 14), "Export personnes à prendre en charge", `${pts.filter((x) => x.partnerId === pid).length} ligne(s)`, { who: YODAN, side: "YODAN", partnerId: pid })));
  // Connexions des 30 derniers jours ouvrés (code reçu par e-mail).
  const staff = [[LAMIFI, "LAMIFI", null, 0.3], [YODAN, "YODAN", null, 0.95], ...db.identities.filter((i) => i.kind === "PARTNER" && i.activatedAt).map((i) => [i.email, "PARTENAIRE", i.partnerId, 0.35])];
  for (let d = 30; d >= 1; d--) {
    const iso = addDays(todayIso(), -d), wd = new Date(`${iso}T12:00:00`).getDay();
    if (wd === 0 || wd === 6) continue;
    staff.forEach(([who, side, pid, p]) => { if (R() < p) add(at(iso, 8, Math.floor(R() * 50)), "Connexion", who, { who, side, partnerId: pid }); });
  }
  specs.filter(([ms]) => ms <= clock.now).sort((a, b) => a[0] - b[0]).forEach(([ms, label, target, meta]) => audit(label, target, { ...meta, at: ms }));
}
seed();

