/*
 * seed.js : jeu de données de démo, déterministe et 100 % fictif.
 * Ne produit que des FAITS (réponses, dates, décisions, bons, appels, séances) ; tout le reste est calculé (domain.js).
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
  const j = () => (r() - 0.5) * 0.35;
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));
  const L = () => Math.max(0, Math.min(1, level + j()));
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
  // Admin LAMIFI Business (ex-Admin système) : créé depuis .env, change son mot de passe à la 1re connexion.
  const la = seedActiveIdentity({ name: ENV.LAMIFI_ADMIN_NAME, email: ENV.LAMIFI_ADMIN_EMAIL, kind: "LAMIFI_ADMIN" }, ENV.LAMIFI_ADMIN_PASSWORD);
  la.mustChangePassword = true;
  seedActiveIdentity({ name: "Admin Yodan Démo", email: "admin.yodan@yodan.exemple.test", kind: "YODAN_ADMIN" });
  seedActiveIdentity({ name: "Console Démo", email: "console@yodan.exemple.test", kind: "CONSOLE" });

  const dbIn = (name) => ({ host: "db.interne.exemple.test", port: 3306, username: `pec_${slugOf(name).replace(/-/g, "_")}`, password: "fictif", database: `pec_${slugOf(name).replace(/-/g, "_")}` });
  const mk = (name, type, agencies, account, tweak = (c) => c) => {
    const r = createPartner({ name, type, cfg: tweak(presetFor(type)), db: dbIn(name), agencies, firstAccount: account }, { silent: true });
    Object.assign(r.identity, { password: DEMO_PASSWORD, activatedAt: CLOCK_START - 20 * DAY, token: null });
    r.partner.createdAt = addDays(todayIso(), -200);
    return r.partner;
  };
  const cnps = mk("CNPS", "CNPS", ["Agence Plateau", "Agence Yopougon", "Agence Bouaké"], { name: "Admin CNPS Démo", email: "admin@cnps.exemple.test" });
  Object.assign(agencyOpt(cnps, "Agence Yopougon"), { qrActive: false });
  Object.assign(agencyOpt(cnps, "Agence Bouaké"), { appealDays: 3, validateZones: ["ORANGE", "ROUGE"] });
  cnps.sqlAnon = false;
  const lon = mk("LONACI", "LONACI", ["Site Jouons responsable"], { name: "Superviseur LONACI Démo", email: "supervision@lonaci.exemple.test" });
  const alpha = mk("Entreprise Démo Alpha", "ENTREPRISE", ["Site Abidjan", "Site San-Pédro"], { name: "RH Alpha Démo", email: "rh@alpha.exemple.test" }, (c) => { c.tests = ["BSPA", "KARASEK"]; c.campaign.domains = ["alpha.exemple.test"]; return c; });
  const mut = mk("Mutuelle Démo Horizon", "MUTUELLE", ["Siège"], { name: "Admin Horizon Démo", email: "admin@horizon.exemple.test" }, (c) => { c.campaign.domains = ["horizon.exemple.test"]; return c; });

  // Comptes : un identifiant d'abord, puis le(s) rôle(s).
  const ids = {};
  [
    [cnps, "Claire Démo", "claire.demo@cnps.exemple.test", [["SUPPRI"], ["SUPADJ", ["Agence Plateau", "Agence Yopougon"]]]],
    [cnps, "Awa Fictif", "awa.fictif@cnps.exemple.test", [["SUPADJ", ["Agence Bouaké"]]]],
    [cnps, "Marc Démo", "marc.demo@cnps.exemple.test", [["VALID", ["Agence Plateau", "Agence Yopougon"]]]],
    [cnps, "Sophie Test", "sophie.test@cnps.exemple.test", [["VALID", ["Agence Bouaké"]]]],
    [cnps, "Paul Démo", "paul.demo@cnps.exemple.test", [["EVAL", ["Agence Plateau"]]]],
    [cnps, "Lina Démo", "lina.demo@cnps.exemple.test", [["EVAL", ["Agence Yopougon"]]]],
    [cnps, "Eric Test", "eric.test@cnps.exemple.test", [["EVAL", ["Agence Bouaké"]]]],
    [mut, "Validateur Horizon Démo", "validation@horizon.exemple.test", [["VALID"]]],
  ].forEach(([p, name, email, roles]) => {
    const i = seedActiveIdentity({ partnerId: p.id, name, email });
    roles.forEach(([r, ag]) => addRole(i.id, r, ag || []));
    ids[email.split("@")[0]] = i.id;
  });
  const inv = createIdentity({ partnerId: cnps.id, name: "Nouvel Agent Démo", email: "nouvel.agent@cnps.exemple.test" });
  addRole(inv.identity.id, "EVAL", ["Agence Bouaké"]);
  // Désactivation ciblée : Claire garde son rôle de Superviseur principal, son rôle d'adjointe est désactivé.
  setAssignmentActive(db.assignments.find((a) => a.role === "SUPADJ" && a.identityId === ids["claire.demo"]).id, false);

  // Praticiens : agenda en place (internes en ligne, externe sur place) ; un nouveau sans agenda.
  [["Dr Kader Démo", "interne", true], ["Mme Ines Test", "interne", true], ["Dr Yves Fictif", "externe", true], ["Mme Salimata Exemple", "interne", false]].forEach(([name, kind, agenda]) => {
    const r = createIdentity({ name, email: `${slugOf(name).replace(/-/g, ".")}@praticiens.exemple.test`, kind: "PRACTITIONER" }, { silent: true });
    Object.assign(r.identity, { password: DEMO_PASSWORD, activatedAt: CLOCK_START - 40 * DAY, token: null });
    db.practitioners.push({ id: newId("pr"), name, email: r.identity.email, identityId: r.identity.id, active: true, kind, weekdays: agenda ? [true, true, kind === "interne", true, true, false, false] : [false, false, false, false, false, false, false] });
  });
  const prs = db.practitioners.filter(hasAgenda);

  let n = 0;
  const nm = () => { const k = n++; return [FIRST[(k * 7) % FIRST.length], LAST[k % LAST.length]]; };
  const R = rng(20261118);

  /* ---------- CNPS : PCL-5 par les évaluateurs (avec le patient, QR, affiche QR ouvert) ---------- */
  const evaluators = { "Agence Plateau": ids["paul.demo"], "Agence Yopougon": ids["lina.demo"], "Agence Bouaké": ids["eric.test"] };
  for (let k = 0; k < 132; k++) {
    const agency = cnps.agencies[pickW(R, [5, 4, 3])];
    const zone = ZONES[pickW(R, [45, 30, 25])];
    const total = zone === "VERT" ? 8 + Math.floor(R() * 34) : zone === "ORANGE" ? 43 + Math.floor(R() * 8) : 51 + Math.floor(R() * 24);
    const [prenom, nom] = nm();
    const date = addDays(todayIso(), -Math.floor(Math.pow(R(), 0.9) * 178));
    const mode = ["agent", "agent", "agent", "qr", "qr_ouvert"][Math.floor(R() * 5)];
    const sexe = R() < 0.42 ? "Femme" : "Homme";
    const r = recordEvaluation({
      partnerId: cnps.id, test: "PCL-5", agency, mode, by: mode === "qr_ouvert" ? null : evaluators[agency], date,
      ids: { id1: `DEMO-${String(100000 + k * 37).padStart(6, "0")}`, id2: `SIN-${80000 + k * 13}` },
      identity: { nom, prenom, naissance: `${1960 + Math.floor(R() * 40)}-0${1 + Math.floor(R() * 9)}-1${Math.floor(R() * 9)}`, telephone: `07 00 00 ${pad(10 + (k % 89))} ${pad(k % 100)}` },
      profile: { sexe, situation: CNPS_SITUATIONS[pickW(R, [3, 5, 1, 1])], ville: CNPS_VILLES[pickW(R, [8, 3, 2, 2, 1, 1])], type_sinistre: R() < 0.8 ? "Accident du travail" : "Maladie professionnelle", agent: CNPS_AGENTS[pickW(R, [3, 3, 4, 3, 1, 1])], date_accident: addDays(date, -Math.floor(5 + R() * 40)) },
      answers: answersForTotal(20, 4, total, R), consentsPre: { traitement: true },
      consentsPost: zone === "VERT" ? { sms: R() < 0.3 } : { callback: R() < 0.5, sms: R() < 0.3 },
    });
    const ev = r.evaluation;
    if (outcomeOf(ev) === "PENDING" && daysBetween(ev.date, todayIso()) > 6 && R() < 0.9) {
      const yes = R() < 0.68;
      Object.assign(ev, { decision: yes ? "YES" : "NO", decidedAt: minIso(addDays(ev.date, 1 + Math.floor(R() * 3)), todayIso()), decidedBy: agency === "Agence Bouaké" ? ids["sophie.test"] : ids["marc.demo"], comment: yes ? "" : "Symptômes en baisse à l'entretien." });
      if (yes) createPatient(ev);
    }
  }

  /* ---------- LONACI : test ICJE en ligne (site Jouons responsable) ---------- */
  const RL = rng(4242);
  for (let k = 0; k < 164; k++) {
    const cat = pickW(RL, [35, 30, 22, 13]);
    const total = cat === 0 ? 0 : cat === 1 ? 1 + Math.floor(RL() * 2) : cat === 2 ? 3 + Math.floor(RL() * 5) : 8 + Math.floor(Math.pow(RL(), 1.8) * 16);
    const ville = LONACI_VILLES[pickW(RL, [10, 3, 2, 1, 1, 1, 1, 1, 1, 1])];
    const phone = `05 0${Math.floor(k / 100)} ${pad(k % 100)} ${pad((k * 7) % 100)} ${pad((k * 3) % 100)}`;
    const r = recordEvaluation({
      partnerId: lon.id, test: "ICJE", agency: lon.agencies[0], mode: "site", date: addDays(todayIso(), -Math.floor(Math.pow(RL(), 1.1) * 118)),
      ids: { id1: phone }, identity: { telephone: phone, email: RL() < 0.4 ? `joueur${k}@exemple.test` : "" },
      profile: { ville, commune: ville === "Abidjan" ? LONACI_COMMUNES[Math.floor(RL() * LONACI_COMMUNES.length)] : "", age: String(18 + Math.floor(RL() * 45)), sexe: RL() < 0.78 ? "Homme" : "Femme", plateforme: LONACI_PLATS[pickW(RL, [4, 3, 4, 2, 2, 1])], canal: LONACI_CANAUX[pickW(RL, [5, 3, 2])] },
      answers: answersForTotal(9, 3, total, RL), consentsPre: { traitement: true },
      consentsPost: cat >= 2 ? { callback: RL() < 0.6, ...(cat === 3 ? { support: RL() < 0.45 } : {}) } : {},
    });
    if (!r.ok) console.warn("seed LONACI", r.err);
  }

  /* ---------- Campagnes BSPA / KARASEK (Entreprise Alpha, Mutuelle Horizon) ---------- */
  const RB = rng(777);
  const campaign = (p, name, test, start, end, invited, done, started, domain) => {
    const c = { id: newId("cp"), partnerId: p.id, name, test, start, end, createdAt: addDays(start, -7), code: tokenOf(name).slice(0, 6).toUpperCase() };
    db.campaigns.push(c);
    for (let k = 0; k < invited; k++) {
      const email = `${slugOf(FIRST[(k * 3 + name.length) % FIRST.length])}.${slugOf(LAST[k % LAST.length])}${k}@${domain}`;
      const x = { id: newId("pp"), campaignId: c.id, email, invitedAt: c.start <= todayIso() ? c.start : minIso(c.createdAt, todayIso()), startedAt: null, completedAt: null, evalId: null };
      db.participants.push(x);
      if (c.start > todayIso() || k >= done + started) continue;
      x.startedAt = minIso(addDays(c.start, k % 9), minIso(c.end, todayIso()));
      if (k >= done) continue;
      const level = Math.pow(RB(), 1.7) * 0.9;
      const [prenom, nom] = nm();
      const answers = test === "BSPA" ? bspaAnswers(level, RB) : answersForTotal(4, 3, Math.round(level * 12), RB);
      const r = recordEvaluation({ partnerId: p.id, test, agency: p.agencies[k % p.agencies.length], mode: "campagne", campaignId: c.id, date: x.startedAt, ids: { id1: email }, identity: { prenom, nom, email }, profile: Object.fromEntries(BSPA_DEMO.map((f) => [f.key, f.options[pickW(RB, f.key === "genre" ? [5, 5, 1] : f.options.map(() => 1))]])), answers, consentsPre: { traitement: true } });
      if (!r.ok) { console.warn("seed campagne", r.err); continue; }
      if (r.evaluation.zone !== "VERT") setPostConsents(r.evaluation.id, { support: RB() < 0.55 });
      x.completedAt = x.startedAt; x.evalId = r.evaluation.id;
    }
    return c;
  };
  campaign(alpha, "Bilan 2025", "BSPA", addDays(todayIso(), -220), addDays(todayIso(), -190), 26, 21, 2, "alpha.exemple.test");
  campaign(alpha, "Bilan annuel 2026", "BSPA", addDays(todayIso(), -30), addDays(todayIso(), 10), 38, 29, 4, "alpha.exemple.test");
  campaign(alpha, "Contraintes au travail (printemps)", "KARASEK", addDays(todayIso(), -100), addDays(todayIso(), -70), 16, 12, 1, "alpha.exemple.test");
  campaign(alpha, "Contraintes au travail (automne)", "KARASEK", addDays(todayIso(), 5), addDays(todayIso(), 35), 8, 0, 0, "alpha.exemple.test");
  campaign(mut, "Bien-être des adhérents", "BSPA", addDays(todayIso(), -15), addDays(todayIso(), 15), 16, 9, 3, "horizon.exemple.test");
  // Mutuelle (avec validateur) : orange à décider par le validateur, décisions passées pour les plus anciennes.
  db.evaluations.filter((e) => e.partnerId === mut.id && outcomeOf(e) === "PENDING" && daysBetween(e.date, todayIso()) > 6).forEach((e) => { Object.assign(e, { decision: RB() < 0.7 ? "YES" : "NO", decidedAt: addDays(e.date, 2), decidedBy: ids["validation"] }); if (e.decision === "YES") createPatient(e); });

  /* ---------- Parcours de soin : accord, bon, attribution + attestation, séances, suivi PCL-5, clôture ---------- */
  const RP = rng(99);
  db.patients.forEach((pt) => {
    const p = partnerOf(pt.partnerId), t = todayIso();
    if (inAppeal(pt)) return;
    let ready = minIso(pt.availableAt, t);
    if (pt.accord === null) {
      if (daysBetween(ready, t) < 2 || RP() < 0.18) return; // accord encore à recueillir
      ready = minIso(addDays(ready, 1 + Math.floor(RP() * 2)), t);
      if (RP() < 0.12) { Object.assign(pt, { accord: false, accordCalls: 1, closedAt: ready, closedReason: "Refus du patient" }); return; }
      Object.assign(pt, { accord: true, accordCalls: 1 + Math.floor(RP() * 2) });
    }
    if (p.pec.mode === "bon") {
      if (daysBetween(ready, t) < 2 || RP() < 0.15) return; // bon pas encore déposé
      ready = minIso(addDays(ready, 1 + Math.floor(RP() * 3)), t);
      pt.bons.push({ at: ready, file: `bon_${pt.dossier}.pdf` });
    }
    if (daysBetween(ready, t) < 1 || RP() < 0.06) return; // prise en charge à valider par Yodan
    pt.transferredAt = minIso(addDays(ready, 1), t);
    if (daysBetween(ready, t) < 2 || RP() < 0.1) return; // praticien à attribuer dans la Console
    const pr = prs[Math.floor(RP() * prs.length)];
    pt.practitionerId = pr.id;
    pt.assignedAt = minIso(addDays(ready, 1 + Math.floor(RP() * 3)), t);
    pt.attestation = { kind: pr.kind === "externe" ? "IN_PERSON" : "ONLINE", agency: pr.kind === "externe" ? evaluationOf(pt.evalId).agency : null, until: addDays(pt.assignedAt, ATTESTATION_MONTHS * 30), token: tokenOf(pt.dossier), at: pt.assignedAt, partner: p.name };
    const goal = RP() < 0.25 ? capacityOf(pt) : 1 + Math.floor(RP() * (p.pec.max - 1));
    for (let d = addDays(pt.assignedAt, 3); d < t && consumedOf(pt) < Math.min(goal, capacityOf(pt)); d = addDays(d, 6 + Math.floor(RP() * 3))) {
      pt.sessions.push({ date: d, status: ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "POSTPONED", "ABSENT"][Math.floor(RP() * 8)], practitionerId: pr.id, report: true });
    }
    pt.sessions.forEach((s) => { s.report = s.status === "PRESENT"; });
    // Test de suivi PCL-5 deux mois après le début de l'accompagnement.
    const ev0 = evaluationOf(pt.evalId);
    const fuDate = addDays(pt.assignedAt, FOLLOW_UP_DAYS);
    if (ev0.test === "PCL-5" && fuDate < t && pt.sessions.length >= 3) {
      const delta = pickW(RP, [6, 3, 1]) === 0 ? -(10 + Math.floor(RP() * 20)) : pickW(RP, [3, 1]) === 0 ? Math.floor(RP() * 12) - 6 : 10 + Math.floor(RP() * 8);
      const ans = answersForTotal(20, 4, Math.max(0, Math.min(80, ev0.score + delta)), RP);
      const res = scoreTest("PCL-5", ans);
      db.evaluations.push({ ...ev0, id: newId("ev"), kind: "Suivi", mode: "agent", date: fuDate, dossier: `${ev0.dossier}-S1`, answers: ans, score: res.score, zone: res.zone, decision: null, decidedAt: null, decidedBy: null, comment: "", consentsPost: {}, patientId: pt.id });
    }
    if (consumedOf(pt) >= 4 && daysBetween(pt.assignedAt, t) > 70 && RP() < 0.5) Object.assign(pt, { closedAt: minIso(addDays(pt.sessions.at(-1).date, 3), t), closedReason: "Fin de prise en charge" });
    if (RP() < 0.25) pt.calls.push({ at: CLOCK_START - Math.floor(RP() * 20 + 2) * DAY, outcome: "JOINT_ACCEPTE", note: "Créneau convenu le mardi matin." });
  });
  // Séances prévues aujourd'hui pour l'agenda des praticiens (non encore pointées).
  db.patients.filter((x) => patientStatus(x) === "EN_COURS").slice(0, 7).forEach((x) => x.sessions.push({ date: todayIso(), status: null, practitionerId: x.practitionerId, report: false }));
  db.outbox.forEach((m) => { m.read = true; });
  db.audit.length = 0;
  db.logs.length = 0;
}
seed();
