/*
 * Tests de cohérence (règles métier) — CLAUDE.md §9.
 * Lancement : index.html?tests=1 (console + encadré du panneau Notes UX), ou `agent-browser eval "runTests().filter(t => !t.ok)"`.
 * Une fois la maquette validée, ces noms de règles deviennent les tests PHPUnit du projet.
 */
"use strict";

function runTests() {
  const results = [];
  const snap = JSON.stringify(db), clockSnap = clock.now, sessionSnap = { ...session }, uiSnap = JSON.stringify({ space: ui.space, partnerId: ui.partnerId, role: ui.role, tabs: ui.tabs });
  const restore = () => {
    const s = JSON.parse(snap);
    Object.keys(s).forEach((k) => { db[k] = s[k]; });
    clock.now = clockSnap; Object.assign(session, sessionSnap); Object.assign(ui, JSON.parse(uiSnap));
    $$(".modal-back").forEach((m) => m.remove());
  };
  const keepLogout = onLogout;
  onLogout = () => {};
  const test = (name, fn) => { try { fn(); results.push({ name, ok: true }); } catch (err) { results.push({ name, ok: false, err: err.message }); } finally { restore(); } };
  const assert = (c, msg) => { if (!c) throw new Error(msg); };
  const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)})`);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const P = (name) => db.partners.find((p) => p.name === name);
  const ALPHA = () => P("Entreprise Démo Alpha"), MUT = () => P("Mutuelle Démo Horizon");
  const today = () => todayIso();
  const input = (type, over = {}) => {
    const cfg = presetFor(type); cfg.campaign.domains = ["gamma.exemple.test"];
    return { name: `Test ${type} ${Math.random().toString(36).slice(2, 6)}`, type, sector: db.settings.sectors[0], headcount: "250", cfg, firstAccount: { name: "Titulaire Démo", email: `titulaire.${type.toLowerCase()}@gamma.exemple.test` }, ...over };
  };
  const activate = (i) => Object.assign(i, { password: DEMO_PASSWORD, activatedAt: clock.now, token: null });
  const bilan = (p, id1, level, agency) => recordEvaluation({ partnerId: p.id, test: "BSPA", ids: { id1 }, agency: agency || p.agencies[0], identity: { prenom: "Règle", nom: "Test" }, profile: { genre: "Femme", unite: p.units[0] }, answers: bspaAnswers(level, rng(Math.round(level * 100) + 1)), consentsPre: { traitement: true } });
  const orangeAnswers = () => { for (let s = 1; s < 400; s++) { const a = bspaAnswers((s % 40) / 40, rng(s)); if (scoreTest("BSPA", a).zone === "ORANGE") return a; } throw new Error("pas de réponses orange"); };

  /* ---------- Types, rôles, inclusions ---------- */
  test("Types · Entreprise et Association / mutuelle seulement (plus de CNPS, LONACI ni personnalisé)", () => {
    eq(Object.keys(PARTNER_TYPES), ["ENTREPRISE", "MUTUELLE"], "types");
    assert(validatePartner(input("CNPS")).type && validatePartner(input("LONACI")).type, "type retiré accepté");
    db.partners.forEach((p) => assert(PARTNER_TYPES[p.type], p.name));
  });
  test("Rôles · « Superviseur secondaire » remplace « Superviseur adjoint »", () => {
    eq(ROLE_LABEL.SUPADJ, "Superviseur secondaire", "libellé"); assert(!Object.values(ROLE_LABEL).some((l) => /adjoint/i.test(l)), "adjoint encore affiché");
  });
  test("Préréglage Entreprise · Superviseur principal seul avec tableau de bord et campagnes ; e-mail pro facultatif (désactivé par défaut)", () => {
    const c = presetFor("ENTREPRISE"); eq(enabledRoles(c), ["SUPPRI"], "rôles"); eq(tabsFor(c, "SUPPRI"), ["dashboard", "campagne"], "onglets");
    assert(!c.campaign.emailPro && !presetFor("MUTUELLE").campaign.emailPro, "e-mail pro imposé");
  });
  test("Préréglage Mutuelle · Validateur (avec campagnes), secondaire, principal, Administrateur ; personne n'a l'Évaluation", () => {
    const c = presetFor("MUTUELLE"); eq(enabledRoles(c), ["VALID", "SUPADJ", "SUPPRI", "ADMIN"], "rôles"); eq(tabsFor(c, "VALID"), ["validation", "campagne"], "validateur");
    enabledRoles(c).forEach((r) => assert(!tabsFor(c, r).includes("evaluation"), r));
    ["SUPADJ", "SUPPRI", "ADMIN"].forEach((r) => assert(tabsFor(c, r).includes("validation"), `${r} reprend la validation`));
  });
  test("Inclusion · inclure l'onglet d'un autre rôle (même d'un rôle « au-dessus »), retirer, jamais sur un rôle inactif", () => {
    const c = presetFor("MUTUELLE");
    assert(setInclude(c, "VALID", "comptes", true) && tabsFor(c, "VALID").includes("comptes"), "inclusion vers le bas");
    assert(setInclude(c, "VALID", "comptes", false) && !tabsFor(c, "VALID").includes("comptes"), "retrait");
    assert(!setInclude(c, "EVAL", "dashboard", true), "rôle inactif"); assert(!setInclude(c, "VALID", "validation", true), "fonctionnalité propre");
    const e = presetFor("ENTREPRISE"); assert(setInclude(e, "SUPPRI", "evaluation", true) && tabsFor(e, "SUPPRI").includes("evaluation"), "évaluation incluse");
    assert(!sameConfig(e, presetFor("ENTREPRISE")), "inclusion non détectée");
  });
  test("Inclusion · la démo : le Superviseur principal de la mutuelle a l'onglet Comptes, partenaire marqué « inclusions »", () => {
    assert(tabsFor(MUT(), "SUPPRI").includes("comptes") && MUT().customized && !ALPHA().customized, "démo");
  });

  /* ---------- Création ---------- */
  test("Création · premier compte sur le plus grand rôle actif, invité par lien d'activation ; aucun réglage de prise en charge", () => {
    [["ENTREPRISE", "SUPPRI"], ["MUTUELLE", "ADMIN"]].forEach(([t, role]) => { const r = createPartner(input(t)); assert(r.ok, t); eq(r.role, role, t); assert(!("pec" in r.partner), "prise en charge"); assert(db.outbox.some((m) => m.to === r.identity.email && m.kind === "ACTIVATION"), "e-mail"); });
  });
  test("Création · e-mail pro facultatif : sans lui, pas de domaine ; avec lui, domaines obligatoires (messageries publiques refusées)", () => {
    const i = input("ENTREPRISE"); i.cfg.campaign.domains = []; assert(!validatePartner(i).domains, "domaines exigés sans e-mail pro");
    i.cfg.campaign.emailPro = true; assert(validatePartner(i).domains, "domaines vides"); i.cfg.campaign.domains = ["gmail.com"]; assert(validatePartner(i).domains, "gmail");
    const c = createPartner(input("MUTUELLE")).partner; eq(c.campaign.emailPro, false, "mutuelle");
  });
  test("Création · au moins un test ; aucune base de données à renseigner", () => {
    const j = input("ENTREPRISE"); j.cfg.tests = []; assert(validatePartner(j).tests, "aucun test");
    const r = createPartner(input("ENTREPRISE")); assert(r.ok && !("db" in r.partner) && r.partner.tenant, "base ou tenant");
    eq(new Set(db.partners.map((p) => p.tenant)).size, db.partners.length, "tenant unique");
  });

  /* ---------- Base commune : isolation par tenant ---------- */
  test("Tenant · chaque donnée d'un partenaire porte son identifiant (évaluations, personnes, dossiers, campagnes, comptes)", () => {
    const ids = new Set(db.partners.map((p) => p.id));
    [["évaluation", db.evaluations], ["personne", db.people], ["dossier", db.patients], ["campagne", db.campaigns], ["rôle", db.assignments]].forEach(([l, rows]) => rows.forEach((x) => assert(ids.has(x.partnerId), `${l} sans tenant`)));
    db.identities.filter((i) => i.kind === "PARTNER").forEach((i) => assert(ids.has(i.partnerId), `${i.email} sans tenant`));
    db.participants.forEach((x) => assert(campaignOf(x.campaignId), "participant sans campagne"));
    db.evaluations.forEach((e) => { assert(personOf(e.personId).partnerId === e.partnerId, `${e.dossier} : personne d'un autre tenant`); if (e.campaignId) assert(campaignOf(e.campaignId).partnerId === e.partnerId, `${e.dossier} : campagne d'un autre tenant`); });
  });
  test("Tenant · un partenaire ne voit jamais les données d'un autre (tableau de bord, campagnes, comptes, validation, suivi)", () => {
    db.partners.forEach((p) => {
      const others = db.partners.filter((o) => o.id !== p.id);
      const foreign = [...others.map((o) => o.name), ...db.campaigns.filter((c) => c.partnerId !== p.id).map((c) => c.name), ...db.identities.filter((i) => i.partnerId && i.partnerId !== p.id).map((i) => i.email), ...db.evaluations.filter((e) => e.partnerId !== p.id).map((e) => e.dossier)];
      const scope = { partnerIds: [p.id], censor: true, actor: "partner" };
      const box = document.createElement("div"); let text = "";
      viewDashboard(box, scope, `iso-${p.id}`); text += box.textContent;
      viewCampaigns(box, scope); text += box.textContent;
      viewAccounts(box, scope, `iso-${p.id}`); text += box.textContent;
      if (partnerValidates(p)) { viewValidation(box, scope, `iso-${p.id}`); text += box.textContent; subs[`val-iso-${p.id}`] = "done"; viewValidation(box, scope, `iso-${p.id}`); text += box.textContent; }
      viewSuivi(box, scope, `iso-${p.id}`); text += box.textContent;
      foreign.forEach((f) => assert(!text.includes(f), `${p.name} voit « ${f} »`));
    });
  });
  test("Tenant · une évaluation ou une décision ne peut pas mélanger deux tenants", () => {
    const a = ALPHA(), m = MUT();
    assert(!recordEvaluation({ partnerId: a.id, test: "BSPA", ids: { id1: "x@alpha.exemple.test" }, profile: { unite: a.units[0] }, answers: bspaAnswers(0.2, rng(3)), consentsPre: { traitement: true }, mode: "campagne", campaignId: db.campaigns.find((c) => c.partnerId === m.id).id }).ok, "campagne d'un autre tenant acceptée");
    const p1 = findPerson(m.id, db.people.find((x) => x.partnerId === m.id).id1); assert(!findPerson(a.id, p1.id1), "personne visible depuis un autre tenant");
  });

  /* ---------- Comptes et connexion ---------- */
  test("Comptes · identifiant puis rôles ; rôle non activé refusé ; évaluateur sur une seule agence", () => {
    const i = createIdentity({ partnerId: MUT().id, name: "X", email: "x@horizon.exemple.test" }).identity;
    assert(!addRole(i.id, "EVAL").ok, "évaluateur non activé chez la mutuelle"); assert(addRole(i.id, "VALID", ["Siège"]).ok && !addRole(i.id, "VALID").ok, "doublon");
    const c = createPartner(input("ENTREPRISE")).partner; setInclude(c, "SUPPRI", "evaluation", true); c.roles.EVAL.on = true;
    const j = createIdentity({ partnerId: c.id, name: "Y", email: "y@gamma.exemple.test" }).identity; c.agencies.push("Site 2");
    assert(!addRole(j.id, "EVAL", ["Siège", "Site 2"]).ok && addRole(j.id, "EVAL", ["Siège"]).ok, "une seule agence");
  });
  test("Connexion · login → code → entrer ; message générique ; admin LAMIFI (.env) change son mot de passe", () => {
    const r = login("rh@alpha.exemple.test", DEMO_PASSWORD); assert(r.ok, "login"); const c = startOtp(r.identity.id, "LOGIN"); eq(verifyOtp(c.id, c.code), "OK", "code");
    eq(login("inconnu@exemple.test", "x").err, "Adresse ou mot de passe incorrect.", "générique");
    assert(identityByEmail(ENV.LAMIFI_ADMIN_EMAIL).mustChangePassword, "admin LAMIFI");
  });
  test("Activation · lien valable 72 h, à usage unique ; session coupée après 30 min", () => {
    const i = identityByEmail("nouveau.validateur@horizon.exemple.test"), tok = i.token;
    clock.now = i.invitedAt + 73 * HOUR; assert(!activationIdentity(tok).ok, "73 h"); clock.now = clockSnap;
    assert(setPassword(i.id, "Demo-Activation-42", "Demo-Activation-42").ok && !activationIdentity(tok).ok, "usage unique");
    enterSession(identityByEmail("admin.yodan@yodan.exemple.test").id); clock.now += 30 * MIN; assert(idleExpired(), "30 min");
  });

  /* ---------- Bilans et décisions ---------- */
  test("Calcul · BSPA : 22 questions, 5 dimensions, signal fort ⇒ rouge ; réponses incomplètes refusées", () => {
    eq(TESTS.BSPA.items.length, 22, "questions"); eq(scoreTest("BSPA", bspaAnswers(0, rng(1))).zone, "VERT", "bien"); eq(scoreTest("BSPA", bspaAnswers(1, rng(1))).zone, "ROUGE", "mal");
    const a = bspaAnswers(0, rng(1)); a[21] = 2; eq(scoreTest("BSPA", a).zone, "ROUGE", "signal fort");
    assert(!scoreTest("BSPA", Array(22).fill(0)) && !scoreTest("COPSOQ", [0, 0, 0]), "accepté");
  });
  test("Invariant · données fictives cohérentes : le nom d'une personne correspond à son adresse e-mail", () => {
    db.people.forEach((x) => { const local = x.id1.split("@")[0]; if (x.identity.prenom) assert(local.startsWith(`${slugOf(x.identity.prenom)}.${slugOf(x.identity.nom)}`), `${x.id1} ≠ ${x.identity.prenom} ${x.identity.nom}`); });
  });
  test("Invariant · zone et score stockés = recalcul à partir des réponses", () => {
    db.evaluations.forEach((e) => { const r = scoreTest(e.test, e.answers); assert(r && r.zone === e.zone && r.score === e.score, e.dossier); });
  });
  test("Règle · entreprise : orange et rouge à prendre en charge automatiquement ; mutuelle : orange décidé par le validateur", () => {
    const a = recordEvaluation({ partnerId: ALPHA().id, test: "BSPA", ids: { id1: "o1@alpha.exemple.test" }, profile: { unite: ALPHA().units[0] }, answers: orangeAnswers(), consentsPre: { traitement: true }, mode: "campagne" }).evaluation;
    eq(outcomeOf(a), "AUTO_YES", "entreprise orange");
    const m = recordEvaluation({ partnerId: MUT().id, test: "BSPA", ids: { id1: "o1@horizon.exemple.test" }, profile: { unite: MUT().units[0] }, answers: orangeAnswers(), consentsPre: { traitement: true }, mode: "campagne" }).evaluation;
    eq(outcomeOf(m), "PENDING", "mutuelle orange"); assert(!db.patients.some((x) => x.evalId === m.id), "patient avant décision");
    assert(decide(m.id, true) && db.patients.some((x) => x.evalId === m.id), "oui"); eq(outcomeOf(bilan(MUT(), "v@horizon.exemple.test", 0).evaluation), "AUTO_NO", "vert");
  });
  test("Invariant · décision seulement sur une zone validée, après le bilan ; vert jamais décidé", () => {
    db.evaluations.filter((e) => e.decision).forEach((e) => assert(agencyOpt(partnerOf(e.partnerId), e.agency).validateZones.includes(e.zone) && e.decidedAt >= e.date && e.zone !== "VERT", e.dossier));
  });

  /* ---------- À prendre en charge : export et clôture (pas de prise en charge dans l'app) ---------- */
  test("Hors périmètre · plus de console, de praticien, d'attribution, de bon ni de budget", () => {
    assert(!SPACES.some((s) => ["console", "praticien"].includes(s.id)), "espaces"); assert(!("practitioners" in db), "praticiens");
    db.patients.forEach((x) => assert(!("bons" in x) && !("practitionerId" in x) && !("sessions" in x), x.dossier));
    eq(Object.keys(PEC_STATUS), ["A_PRENDRE", "CLOS"], "statuts");
  });
  test("Invariant · une personne à prendre en charge = un bilan accepté ; un seul dossier ouvert par personne ; dates cohérentes", () => {
    db.patients.forEach((x) => { assert(acceptsCare(evaluationOf(x.evalId)), x.dossier); x.exports.forEach((d) => assert(d >= x.createdAt && d <= today(), `${x.dossier} export`)); if (x.closedAt) assert(x.closedAt >= x.createdAt && x.closedAt <= today() && CLOSE_REASONS.includes(x.closedReason), `${x.dossier} clôture`); });
    const open = db.patients.filter((x) => !x.closedAt).map((x) => x.personId); eq(new Set(open).size, open.length, "doublon");
  });
  test("Export · dossiers ouverts seulement, colonnes de contact (ni réponses ni dimensions), date notée, export journalisé", () => {
    const list = db.patients.filter((x) => x.partnerId === ALPHA().id);
    const open = list.filter((x) => !x.closedAt), before = db.audit.length;
    const r = exportPatients(list); eq(r.count, open.length, "lignes");
    const lines = r.csv.replace(/^﻿/, "").split("\r\n"); eq(lines.length, open.length + 1, "lignes CSV"); eq(lines[0].split(";").map((x) => x.replace(/"/g, "")), EXPORT_COLUMNS, "colonnes");
    assert(!/Bien-être|Stress|Épuisement|score/i.test(r.csv), "données cliniques détaillées");
    open.forEach((x) => eq(x.exports.at(-1), today(), `${x.dossier} date`)); assert(db.audit.length === before + 1 && db.audit.at(-1).action === "care.export", "journal");
    assert(!list.filter((x) => x.closedAt).some((x) => r.csv.includes(x.dossier)), "dossier clos exporté");
  });
  test("Clôture · « Clos » avec un motif valable, une seule fois ; la personne peut refaire un bilan ensuite", () => {
    const pt = db.patients.find((x) => !x.closedAt && x.partnerId === MUT().id);
    assert(!closePatient(pt.id, "Autre motif"), "motif libre"); assert(closePatient(pt.id, "Traitement terminé") && patientStatus(pt) === "CLOS", "clôture"); assert(!closePatient(pt.id), "deux fois");
    const id1 = personOf(pt.personId).id1; assert(!lookupDossier(MUT().id, id1).blocker, "toujours bloqué après clôture");
  });
  test("Blocage · une évaluation par un agent est refusée si la personne est déjà à prendre en charge ou attend une décision", () => {
    const pt = db.patients.find((x) => !x.closedAt); assert(/déjà à prendre en charge/.test(lookupDossier(pt.partnerId, personOf(pt.personId).id1).blocker), "ouvert");
    const m = recordEvaluation({ partnerId: MUT().id, test: "BSPA", ids: { id1: "p1@horizon.exemple.test" }, profile: { unite: MUT().units[0] }, answers: orangeAnswers(), consentsPre: { traitement: true }, mode: "campagne" }).evaluation;
    assert(/attend déjà une décision/.test(lookupDossier(MUT().id, "p1@horizon.exemple.test").blocker), "décision en attente"); eq(outcomeOf(m), "PENDING", "orange");
  });
  test("Visibilité · liste « À prendre en charge » : admin Yodan seulement ; le suivi du secondaire ne montre que des N°", () => {
    eq(tabsFor(MUT(), "SUPPRI").includes("patients"), false, "onglet partenaire");
    const box = document.createElement("div"); viewSuivi(box, { partnerIds: [MUT().id], actor: "partner", agencies: MUT().agencies }, "tv");
    const names = db.patients.filter((x) => x.partnerId === MUT().id).map((x) => displayName(personOf(x.personId)));
    assert(!names.some((n) => box.textContent.includes(n)), "nom visible");
  });

  /* ---------- Campagnes ---------- */
  test("Parcours · participant : domaine refusé (e-mail pro) → code → bilan affiché tout de suite, sans e-mail ; pas de deuxième participation", () => {
    const c = db.campaigns.find((x) => campaignState(x) === "EN_COURS" && x.partnerId === ALPHA().id);
    assert(!startParticipation(c.id, "x@gmail.com").ok, "gmail"); const s = startParticipation(c.id, "regle.p@alpha.exemple.test"); assert(s.ok, "départ");
    eq(verifyParticipant(s.challengeId, db.outbox.at(-1).code), "OK", "code");
    const r = submitParticipation(s.participant.id, { identity: { prenom: "R", nom: "T" }, profile: { genre: "Femme", unite: ALPHA().units[1] }, answers: bspaAnswers(0.95, rng(5)), consentsPre: { traitement: true } });
    assert(r.ok && participantStatus(s.participant) === "TERMINE", "fin");
    assert(!db.outbox.some((m) => m.to === "regle.p@alpha.exemple.test" && /bilan|rapport/i.test(m.subject)), "e-mail de bilan envoyé : le résultat doit s'afficher à la fin du test");
    assert(db.patients.some((x) => x.evalId === r.evaluation.id), "à prendre en charge"); assert(!startParticipation(c.id, "regle.p@alpha.exemple.test").ok, "deuxième");
  });
  test("Campagne · sans e-mail pro, toute adresse valide est acceptée", () => {
    const c = db.campaigns.find((x) => campaignState(x) === "EN_COURS" && partnerOf(x.partnerId).name === "Entreprise Démo Beta");
    assert(!partnerOf(c.partnerId).campaign.emailPro && startParticipation(c.id, "personne@gmail.com").ok, "adresse personnelle refusée");
  });
  test("Rapport · renvoi sur demande par lien unique : e-mail neutre, une seule ouverture, expiration 72 h, ancien lien annulé", () => {
    const ev = db.evaluations.find((e) => e.mode === "campagne");
    const r1 = sendReportLink(ev.id); assert(r1.ok, r1.err); const m1 = db.outbox.at(-1);
    eq(m1.kind, "RAPPORT", "type"); assert(!/\b(score|zone|vert|orange|rouge|vigilance|satisfaisant)\b/i.test(`${m1.subject} ${m1.lines.join(" ")}`), "résultat dans l'e-mail");
    assert(openReportLink(m1.token).ok, "première ouverture"); assert(!openReportLink(m1.token).ok, "deuxième ouverture");
    sendReportLink(ev.id); const t2 = db.outbox.at(-1).token; sendReportLink(ev.id); const t3 = db.outbox.at(-1).token;
    assert(!openReportLink(t2).ok, "ancien lien encore valable"); clock.now += 73 * HOUR; assert(!openReportLink(t3).ok, "lien expiré accepté");
    assert(db.audit.some((a) => a.action === "report.link_send"), "journal");
  });
  test("Campagne · invitations : CSV (colonne e-mail seule), refus hors domaine, format, déjà terminé", () => {
    eq(parseCsvEmails("﻿Nom;E-mail\nDémo;a.b@alpha.exemple.test"), ["a.b@alpha.exemple.test"], "CSV");
    const c = db.campaigns.find((x) => campaignState(x) === "EN_COURS" && x.partnerId === ALPHA().id); const done = db.participants.find((x) => x.campaignId === c.id && x.completedAt).email;
    const r = inviteToCampaign(c.id, `x@gmail.com pas-un-email ${done}`, "email\nnouveau.csv@alpha.exemple.test");
    eq(r.added, ["nouveau.csv@alpha.exemple.test"], "ajoutés"); eq(r.refused.map(([, w]) => w).sort(), ["déjà terminé", "domaine", "format"].sort(), "raisons");
  });
  test("Visibilité · participants d'une campagne : admin Yodan seulement", () => {
    const box = document.createElement("div"); viewCampaigns(box, { partnerIds: [ALPHA().id], actor: "partner" }); assert(box.querySelector("#c-new") && !/Invités|Terminés/.test(box.textContent), "partenaire");
    viewCampaigns(box, { partnerIds: [ALPHA().id], actor: "yodan" }); assert(/Invités/.test(box.textContent), "Yodan");
  });
  test("E-mails · aucun résultat, score ni zone", () => {
    db.outbox.forEach((m) => assert(!/\b(score|zone|vert|orange|rouge|résultat|vigilance)\b/i.test(`${m.subject} ${m.lines.join(" ")}`), m.subject));
  });

  /* ---------- Historique et journaux internes (modèle CNPS) ---------- */
  test("Journal · même structure que la CNPS : code d'action, côté, partenaire, utilisateur, dossier, IP, détails", () => {
    db.audit.forEach((a) => { assert(/^[a-z_]+\.[a-z_.]+$/.test(a.action), `code « ${a.action} »`); assert(SIDE_LABEL[a.side], `côté ${a.side}`); assert(a.ip && typeof a.details === "object", `${a.id} incomplet`); if (a.partnerId) assert(partnerOf(a.partnerId), `${a.id} partenaire inconnu`); });
    for (let k = 1; k < db.audit.length; k++) assert(db.audit[k].at >= db.audit[k - 1].at, "ordre chronologique");
  });
  test("Journal · écriture seule : une entrée ne peut être ni modifiée ni effacée de son contenu", () => {
    audit("Connexion", "x@exemple.test"); const e = db.audit.at(-1);
    let blocked = 0;
    try { e.action = "falsifié"; } catch { blocked++; }
    try { e.details.cible = "falsifié"; } catch { blocked++; }
    try { delete e.who; } catch { blocked++; }
    eq(blocked, 3, "modification acceptée"); eq(e.action, "auth.login_mfa", "contenu changé");
  });
  test("Journal · cohérent avec les faits : chaque décision, clôture, export, campagne et bilan est tracé", () => {
    db.evaluations.filter((e) => e.decidedAt).forEach((e) => assert(db.audit.some((a) => a.action === "evaluation.validate" && a.dossier === e.dossier && isoOf(a.at) === e.decidedAt && a.who === identityOf(e.decidedBy).email), `${e.dossier} : décision non tracée`));
    db.patients.filter((x) => x.closedAt).forEach((x) => assert(db.audit.some((a) => a.action === "care.close" && a.dossier === x.dossier), `${x.dossier} : clôture non tracée`));
    db.patients.forEach((x) => x.exports.forEach((d) => assert(db.audit.some((a) => a.action === "care.export" && a.partnerId === x.partnerId && isoOf(a.at) === d), `${x.dossier} : export du ${d} non tracé`)));
    db.campaigns.forEach((c) => assert(db.audit.some((a) => a.action === "campaign.create" && a.partnerId === c.partnerId && a.details.cible.includes(c.name)), `${c.name} non tracée`));
    eq(db.audit.filter((a) => a.action === "evaluation.campaign_submit").length, db.evaluations.filter((e) => e.mode === "campagne").length, "bilans");
    db.audit.forEach((a) => assert(a.at <= clock.now, `${a.id} dans le futur`));
  });
  test("Journal · aucune donnée de santé ni identité de participant (règle 4.1.4)", () => {
    const people = db.people.flatMap((x) => [displayName(x), x.identity.telephone, x.id1].filter((v) => v && String(v).length > 4));
    const text = JSON.stringify(db.audit);
    people.forEach((v) => assert(!text.includes(v), `« ${v} » dans le journal`));
    // Les noms de campagne (« Bien-être des adhérents ») sont choisis par le partenaire : on les retire avant de chercher un résultat.
    const cibles = db.audit.map((a) => db.campaigns.reduce((t, c) => t.split(c.name).join(""), a.details.cible || "")).join(" ");
    assert(!/\b(vert|orange|rouge|vigilance|satisfaisant|score|bien-être|stress|épuisement)\b/i.test(cibles), "résultat dans le journal");
  });
  test("Journal · un partenaire ne voit que son historique (son tenant, son côté) ; l'admin LAMIFI voit tout", () => {
    const m = MUT(), mine = historyScope({ partnerId: m.id });
    assert(mine.length && mine.every((a) => a.partnerId === m.id && a.side === "PARTENAIRE"), "périmètre");
    const box = document.createElement("div"); partnerHistoryView(box, m);
    const others = db.identities.filter((i) => i.partnerId && i.partnerId !== m.id).map((i) => i.email).concat(["admin.yodan@yodan.exemple.test", ENV.LAMIFI_ADMIN_EMAIL]);
    others.forEach((e) => assert(!box.textContent.includes(e), `${e} visible chez ${m.name}`));
    eq(historyScope({}).length, db.audit.length, "admin LAMIFI");
  });
  test("Journaux internes · un fichier access-jj-mm-aaaa.log par jour, une ligne JSON par accès, rien de perdu", () => {
    const files = logFiles(); eq(files.reduce((s, f) => s + f.lines, 0), db.audit.length, "lignes");
    files.forEach((f) => {
      assert(/^access-\d{2}-\d{2}-\d{4}\.log$/.test(f.name), f.name);
      f.content.trim().split("\n").forEach((l) => { const o = JSON.parse(l); ["created_at", "user_id", "tenant", "side", "action", "evaluation_id", "ip", "details"].forEach((k) => assert(k in o, `${f.name} : ${k}`)); if (o.tenant) assert(db.partners.some((p) => p.tenant === o.tenant), "tenant inconnu"); });
    });
  });

  /* ---------- Tableaux de bord ---------- */
  test("Cohérence · zones et décisions = total pour chaque partenaire et chaque test ; BSPA : profils et campagnes", () => {
    db.partners.forEach((p) => p.tests.forEach((t) => { const m = dashboardModel([p.id], t, false); eq(sum(m.zones), m.total, `${p.name}/${t}`); eq(sum(m.outcomes), m.total, `${p.name}/${t} décisions`); }));
    const b = bspaModel([ALPHA().id], false); eq(b.prof.reduce((x, y) => x + y, 0), b.total, "profils"); eq(b.campaigns.reduce((s, c) => s + bspaModel([ALPHA().id], false, c.id).total, 0), b.total, "campagnes");
  });
  test("Superviseur secondaire · même tableau de bord que le principal, limité à ses agences", () => {
    const m = MUT(), ag = ["Antenne Bouaké"]; assert(tabsFor(m, "SUPADJ").includes("dashboard"), "onglet");
    eq(bspaModel([m.id], true, "all", ag).total, db.evaluations.filter((e) => e.partnerId === m.id && e.test === "BSPA" && ag.includes(e.agency)).length, "périmètre");
  });
  test("Masquage · partenaire : 1 à 4 masqué, jamais de nom ; Yodan : détail individuel", () => {
    eq([masked(3, true), masked(5, true), masked(3, false)], ["< 5", 5, 3], "seuil");
    const box = document.createElement("div"), someone = displayName(personOf(db.evaluations.find((e) => e.partnerId === ALPHA().id).personId));
    viewDashboard(box, { partnerIds: [ALPHA().id], actor: "partner" }, "t-p"); assert(!box.textContent.includes(someone), "nom côté partenaire");
    viewDashboard(box, { partnerIds: [ALPHA().id], actor: "yodan" }, "t-y"); assert(/ENT-\d/.test(box.textContent), "détail Yodan");
  });

  /* ---------- Métadonnées : secteur d'activité, directions / régions ---------- */
  test("Secteur · obligatoire à la création, choisi dans la liste de l'admin LAMIFI", () => {
    assert(validatePartner(input("ENTREPRISE", { sector: "" })).sector, "secteur vide accepté");
    assert(validatePartner(input("ENTREPRISE", { sector: "Secteur inventé" })).sector, "secteur hors liste accepté");
    const r = createPartner(input("MUTUELLE", { sector: db.settings.sectors[2] }));
    assert(r.ok && r.partner.sector === db.settings.sectors[2], "secteur enregistré");
    db.partners.forEach((p) => assert(db.settings.sectors.includes(p.sector), `${p.name} : secteur hors liste`));
  });
  test("Secteur · liste LAMIFI : une valeur par ligne, sans doublon ; un secteur utilisé ne peut pas être retiré", () => {
    const r = setSectors("Banque et assurance\nbanque et ASSURANCE\n  Énergie  \n\nIndustrie\nAssociatif et mutualiste");
    assert(r.ok, r.err); eq(db.settings.sectors, ["Banque et assurance", "Énergie", "Industrie", "Associatif et mutualiste"], "liste nettoyée");
    assert(!setSectors("Énergie").ok, "secteur utilisé retiré"); assert(!setSectors("").ok, "liste vide");
    assert(db.audit.some((a) => a.action === "system.sectors"), "réglage tracé");
  });
  test("Directions / régions · liste par défaut (admin LAMIFI) copiée à la création ; la modifier ne change pas les partenaires existants", () => {
    const e = createPartner(input("ENTREPRISE")).partner, m = createPartner(input("MUTUELLE")).partner;
    eq(e.units, db.settings.defaultUnits.ENTREPRISE, "directions copiées"); eq(m.units, db.settings.defaultUnits.MUTUELLE, "régions copiées");
    const before = [...e.units];
    assert(setDefaultUnits("ENTREPRISE", "Direction unique").ok, "modèle");
    eq(e.units, before, "partenaire existant modifié par le modèle");
    eq(createPartner(input("ENTREPRISE", { firstAccount: { name: "Titulaire Démo 2", email: "titulaire.deux@gamma.exemple.test" } })).partner.units, ["Direction unique"], "nouveau partenaire");
    assert(!setDefaultUnits("MUTUELLE", " \n ").ok, "liste vide acceptée");
  });
  test("Directions / régions · liste d'un partenaire ajustable par Yodan ; le questionnaire propose sa liste actuelle", () => {
    const m = MUT();
    assert(setPartnerUnits(m.id, "Région du Centre\nRégion du Sud").ok, "réglage");
    const f = fieldsOf(m).find((x) => x.key === "unite");
    assert(f && f.required && !f.pii, "champ obligatoire, non identifiant"); eq(f.label, "Région", "libellé mutuelle"); eq(f.options, ["Région du Centre", "Région du Sud"], "options");
    eq(fieldsOf(ALPHA()).find((x) => x.key === "unite").label, "Direction", "libellé entreprise");
    assert(db.audit.some((a) => a.action === "system.tenant_units" && a.partnerId === m.id), "réglage tracé sur le tenant");
  });
  test("Directions / régions · listes par défaut chez l'admin LAMIFI ; l'admin Yodan personnalise seulement par partenaire", () => {
    const lam = document.createElement("div"); renderDefaultUnits(lam);
    eq($$("[data-def]", lam).map((f) => f.dataset.def), ["ENTREPRISE", "MUTUELLE"], "éditeurs LAMIFI");
    const yod = document.createElement("div"); viewPartnerProfile(yod, db.partners.map((p) => p.id));
    assert(!$("[data-def]", yod), "liste par défaut modifiable côté Yodan");
    assert($$("[data-pick]", yod).length === db.partners.length, "un bouton Modifier par partenaire");
  });
  test("Bug corrigé · « Modifier » la liste d'un partenaire garde tous les partenaires dans le tableau et ne change pas le filtre", () => {
    const pids = db.partners.map((p) => p.id), box = document.createElement("div"), keepFilter = yo.partner;
    viewPartnerProfile(box, pids);
    $(`[data-pick="${MUT().id}"]`, box).click();
    $('[data-psub="unites"]', box).click();
    db.partners.forEach((p) => assert(box.textContent.includes(p.name), `${p.name} a disparu du tableau`));
    assert($("#own-u", box) && $("#own-u", box).value === MUT().units.join("\n"), "éditeur de la mutuelle");
    eq(yo.partner, keepFilter, "filtre partenaire modifié");
    $("#own-u", box).value = "Région du Centre\nRégion du Sud"; $("#pf-f", box).dispatchEvent(new Event("submit", { cancelable: true }));
    eq(MUT().units, ["Région du Centre", "Région du Sud"], "enregistrement");
    db.partners.forEach((p) => assert(box.textContent.includes(p.name), `${p.name} a disparu après enregistrement`));
    eq(ALPHA().units, db.settings.defaultUnits.ENTREPRISE, "autre partenaire modifié");
  });
  test("Directions / régions · bilan refusé sans valeur ou avec une valeur hors liste ; les bilans gardent leur valeur", () => {
    const a = ALPHA();
    const rec = (unite) => recordEvaluation({ partnerId: a.id, test: "BSPA", ids: { id1: `u${Math.random()}@alpha.exemple.test` }, profile: { unite }, answers: bspaAnswers(0.1, rng(9)), consentsPre: { traitement: true }, mode: "campagne" });
    assert(!rec(undefined).ok, "sans valeur"); assert(!rec("Direction inventée").ok, "hors liste"); assert(rec(a.units[0]).ok, "valeur de la liste");
    const before = db.evaluations.filter((e) => e.partnerId === a.id).map((e) => e.profile.unite);
    setPartnerUnits(a.id, "Nouvelle direction");
    eq(db.evaluations.filter((e) => e.partnerId === a.id).map((e) => e.profile.unite), before, "bilans modifiés");
    db.evaluations.filter((e) => e.test === "BSPA").forEach((e) => assert(e.profile.unite, `${e.dossier} sans direction / région`));
  });
  test("Tableau de bord · groupe Direction / région = total ; le filtre donne le même chiffre que le groupe ; moins de 5 masqué côté partenaire", () => {
    [ALPHA(), MUT()].forEach((p) => {
      const all = bspaModel([p.id], false), g = all.by[0];
      eq(g.label, UNIT_LABEL[p.type].one, `${p.name} libellé`); eq(sum(Object.fromEntries(g.rows.map((r) => [r.group, r.total]))), all.total, `${p.name} total`);
      g.rows.forEach((r) => eq(bspaModel([p.id], false, "all", null, r.group).total, r.total, `${p.name}/${r.group}`));
    });
    const small = bspaModel([ALPHA().id], true).by[0].rows.find((r) => r.total > 0 && r.total < MIN_GROUP);
    assert(small, "la démo doit contenir une direction de moins de 5 bilans");
    const box = document.createElement("div");
    viewDashboard(box, { partnerIds: [ALPHA().id], actor: "partner" }, "t-unit");
    assert(box.textContent.includes(`${small.group}moins de ${MIN_GROUP} : masqué`), "petite direction non masquée");
  });
  test("Filtre secteur · Yodan : seuls les partenaires du secteur ; filtre seulement, aucune donnée nouvelle dans les e-mails ni l'historique", () => {
    const inSector = (x) => db.partners.filter((p) => p.sector === x).map((p) => p.id);
    eq(inSector(ALPHA().sector), [ALPHA().id], "secteur Alpha");
    assert(!db.outbox.some((m) => JSON.stringify(m).includes(ALPHA().units[0])), "direction dans un e-mail");
    assert(!db.audit.some((a) => a.action.startsWith("evaluation") && JSON.stringify(a.details).includes(ALPHA().units[0])), "direction dans l'historique d'un bilan");
  });

  /* ---------- Profil partenaire (admin Yodan) et participation ---------- */
  test("Profil partenaire · un onglet Yodan avec sous-onglets Secteur / Directions-régions / Effectif ; tous les partenaires restent listés", () => {
    eq(YODAN_TABS.filter((t) => ["profil", "listes"].includes(t.id)).map((t) => t.id), ["profil"], "un seul onglet");
    const box = document.createElement("div"), pids = db.partners.map((p) => p.id);
    viewPartnerProfile(box, pids); $(`[data-pick="${ALPHA().id}"]`, box).click();
    eq($$("[data-psub]", box).map((b) => b.dataset.psub), ["secteur", "unites", "effectif"], "sous-onglets");
    ["unites", "effectif", "secteur"].forEach((sub) => { $(`[data-psub="${sub}"]`, box).click(); db.partners.forEach((p) => assert(box.textContent.includes(p.name), `${sub} : ${p.name} a disparu`)); });
  });
  test("Profil partenaire · secteur modifiable par Yodan, seulement dans la liste LAMIFI ; tracé", () => {
    assert(!setPartnerSector(ALPHA().id, "Secteur inventé").ok, "hors liste");
    assert(setPartnerSector(ALPHA().id, "Industrie").ok && ALPHA().sector === "Industrie", "enregistré");
    assert(db.audit.some((a) => a.action === "system.tenant_sector" && a.partnerId === ALPHA().id), "tracé");
  });
  test("Effectif · nombre entier de 1 à 1 000 000, daté (pas dans le futur) ; même date = remplacement ; tracé ; avertissement si moins que les sélectionnés", () => {
    ["0", "-3", "12,5", "abc", "2000000", ""].forEach((x) => assert(!setHeadcount(ALPHA().id, x).ok, `« ${x} » accepté`));
    assert(!setHeadcount(ALPHA().id, "100", addDays(todayIso(), 1)).ok, "date future acceptée");
    assert(!setHeadcount(ALPHA().id, "100", "pas-une-date").ok, "date invalide acceptée");
    const before = ALPHA().headcounts.length;
    assert(setHeadcount(ALPHA().id, " 1 250 ").ok && headcountAt(ALPHA()) === 1250, "espaces ignorés");
    assert(setHeadcount(ALPHA().id, "1300").ok && headcountAt(ALPHA()) === 1300, "même date");
    eq(ALPHA().headcounts.length, before + 1, "une seule valeur par date");
    assert(setHeadcount(ALPHA().id, "3", todayIso()).warn, "avertissement absent");
    assert(removeHeadcount(ALPHA().id, todayIso()).ok && ALPHA().headcounts.length === before, "retrait");
    assert(db.audit.filter((a) => a.action === "system.tenant_headcount").length >= 4, "tracé");
  });
  test("Effectif · daté : chaque campagne utilise l'effectif en vigueur à son début ; « toutes les campagnes » = effectif du jour", () => {
    const a = ALPHA(), old = db.campaigns.find((c) => c.partnerId === a.id && c.name === "Bilan du printemps 2026"), cur = db.campaigns.find((c) => c.partnerId === a.id && c.name === "Bilan annuel 2026");
    eq([headcountAt(a, old.start), headcountAt(a, cur.start), headcountAt(a)], [110, 120, 125], "valeurs de la démo");
    eq(participationOf([a.id], old.id).headcount, 110, "ancienne campagne");
    eq(participationOf([a.id], cur.id).headcount, 120, "campagne en cours");
    eq(participationOf([a.id]).headcount, 125, "effectif du jour");
    eq(participationOf([a.id]).asOf, todayIso(), "toutes les campagnes");
    eq(headcountAt(a, addDays(old.start, -400)), null, "avant toute saisie = non renseigné");
  });
  test("Effectif · obligatoire à la création du partenaire, daté du jour de création", () => {
    assert(validatePartner(input("ENTREPRISE", { headcount: "abc" })).headcount, "effectif invalide accepté");
    ["", "  ", undefined].forEach((x) => assert(validatePartner(input("ENTREPRISE", { headcount: x })).headcount, `effectif « ${x} » accepté`));
    assert(!createPartner(input("ENTREPRISE", { headcount: "" })).ok, "création sans effectif");
    db.partners.forEach((p) => assert(headcountAt(p) != null, `${p.name} sans effectif`));
    const avec = createPartner(input("MUTUELLE", { headcount: "2 400" })).partner;
    eq(avec.headcounts.map((h) => [h.value, h.from]), [[2400, todayIso()]], "effectif saisi"); eq(headcountAt(avec), 2400, "en vigueur");
  });
  test("Participation · effectif ≥ sélectionnés ≥ ont répondu ; taux = rapport à l'effectif ; inconnu si effectif non renseigné", () => {
    db.partners.forEach((p) => {
      const pa = participationOf([p.id]), h = headcountAt(p);
      assert(pa.answered <= pa.selected, `${p.name} répondu > sélectionnés`);
      assert(h && pa.selected <= h, `${p.name} effectif de démo trop petit`);
      eq(pa.answeredPct, Math.round((pa.answered / h) * 1000) / 10, `${p.name} taux`);
    });
    ALPHA().headcounts = [];
    const pa = participationOf([ALPHA().id]); eq([pa.headcount, pa.selectedPct, pa.answeredPct], [null, null, null], "effectif inconnu");
    eq(participationOf(db.partners.map((p) => p.id)).headcount, null, "total incomplet");
  });
  test("Participation · les statistiques restent sur les sélectionnés qui ont répondu (bilans de la campagne = réponses de la campagne)", () => {
    db.campaigns.filter((c) => c.test === "BSPA" && campaignState(c) !== "AVENIR").forEach((c) => {
      eq(bspaModel([c.partnerId], false, c.id).total, db.participants.filter((x) => x.campaignId === c.id && x.completedAt).length, c.name);
      eq(participationOf([c.partnerId], c.id).answered, bspaModel([c.partnerId], false, c.id).total, `${c.name} participation`);
    });
  });
  test("Participation · en tête du tableau de bord pour le partenaire et Yodan (agrégé, jamais la liste) ; pas pour un rôle limité à ses agences", () => {
    const p = ALPHA(), email = db.participants.find((x) => campaignOf(x.campaignId).partnerId === p.id).email;
    [["partner", "t-pa"], ["yodan", "t-py"]].forEach(([actor, k]) => {
      const box = document.createElement("div"); viewDashboard(box, { partnerIds: [p.id], actor }, k);
      const txt = box.textContent;
      assert(txt.indexOf("Participation") > -1 && txt.indexOf("Participation") < txt.indexOf("Bilans terminés"), `${actor} : participation pas en tête`);
      assert(txt.includes("Effectif total") && txt.includes("Sélectionnés pour une campagne") && txt.includes("Ont répondu"), `${actor} : tuiles`);
      assert(!txt.includes(email), `${actor} : e-mail de participant affiché`);
    });
    const box = document.createElement("div"); viewDashboard(box, { partnerIds: [MUT().id], actor: "partner", agencies: ["Antenne Bouaké"] }, "t-pad");
    assert(!box.textContent.includes("Effectif total"), "affiché au superviseur secondaire");
  });

  test("Participation · affichée sur tous les tests (pas seulement BSPA), pour le partenaire et Yodan", () => {
    db.partners.forEach((p) => p.tests.forEach((t) => {
      ["partner", "yodan"].forEach((actor) => {
        const box = document.createElement("div"), key = `t-all-${actor}-${p.id}-${t}`;
        dash[key] = { test: t, campaign: "all", dim: 0 };
        viewDashboard(box, { partnerIds: [p.id], actor }, key);
        assert(box.textContent.includes("Participation") && box.textContent.includes("Effectif total"), `${p.name} / ${t} / ${actor}`);
        const pa = participationOf([p.id], "all", t);
        assert(pa.answered <= pa.selected, `${p.name} / ${t} : répondu > sélectionnés`);
      });
    }));
  });
  test("Démo · effectif daté visible : chaque partenaire a un effectif qui change entre ses campagnes ou depuis sa dernière campagne", () => {
    db.partners.forEach((p) => {
      assert(p.headcounts.length >= 2, `${p.name} : un seul effectif`);
      const seen = new Set([headcountAt(p), ...p.tests.flatMap((t) => participationByCampaign([p.id], t).map((r) => r.headcount))]);
      assert(seen.size >= 2, `${p.name} : aucune différence visible`);
    });
  });
  test("Participation par campagne · effectif au début = effectif daté en vigueur ; même chiffres que le bloc d'une campagne", () => {
    db.partners.forEach((p) => p.tests.forEach((t) => participationByCampaign([p.id], t).forEach((r) => {
      eq(r.headcount, headcountAt(p, r.campaign.start), `${r.campaign.name} effectif`);
      const one = participationOf([p.id], r.campaign.id, t); eq([r.selected, r.answered], [one.selected, one.answered], `${r.campaign.name} chiffres`);
    })));
  });

  /* ---------- Tous les tests : seule différence = le questionnaire et ses indicateurs ---------- */
  test("Tous les tests · filtres direction / région et campagne, groupes et participation sur chaque tableau de bord (KARASEK, COPSOQ…)", () => {
    db.partners.forEach((p) => p.tests.forEach((t) => {
      const box = document.createElement("div"), key = `t-common-${p.id}-${t}`;
      dash[key] = { test: t, campaign: "all", dim: 0 };
      viewDashboard(box, { partnerIds: [p.id], actor: "yodan" }, key);
      assert($("#bs-u", box) && $("#bs-c", box), `${p.name} / ${t} : filtres absents`);
      const camps = [...$("#bs-c", box).options].slice(1).map((o) => o.value);
      eq(camps.sort(), db.campaigns.filter((c) => c.partnerId === p.id && c.test === t && campaignState(c) !== "AVENIR").map((c) => c.id).sort(), `${p.name} / ${t} : campagnes du test`);
      const m = commonModel([p.id], t, false);
      if (m.total) assert(box.textContent.includes("Par groupe") && box.textContent.includes(UNIT_LABEL[p.type].one), `${p.name} / ${t} : groupe ${UNIT_LABEL[p.type].one} absent`);
      assert(box.textContent.includes("Participation"), `${p.name} / ${t} : participation`);
    }));
  });
  test("Tous les tests · chaque bilan porte sa direction / région ; groupe = total ; filtre direction et filtre campagne cohérents", () => {
    db.evaluations.forEach((e) => assert(partnerOf(e.partnerId).units.includes(e.profile.unite) || e.profile.unite, `${e.dossier} sans direction / région`));
    db.partners.forEach((p) => p.tests.forEach((t) => {
      const m = testModel([p.id], t, false);
      eq(m.by[0].rows.reduce((s, r) => s + r.total, 0), m.total, `${p.name} / ${t} : groupe direction`);
      m.by[0].rows.forEach((r) => eq(testModel([p.id], t, false, "all", null, r.group).total, r.total, `${p.name} / ${t} / ${r.group}`));
      m.campaigns.forEach((c) => eq(testModel([p.id], t, false, c.id).total, db.evaluations.filter((e) => e.campaignId === c.id).length, `${c.name}`));
    }));
  });
  test("Tous les tests · une campagne choisie pour un test n'est pas reprise sur un autre test", () => {
    const box = document.createElement("div"), key = "t-switch", a = ALPHA();
    const bspaCamp = db.campaigns.find((c) => c.partnerId === a.id && c.test === "BSPA");
    dash[key] = { test: "BSPA", campaign: bspaCamp.id, dim: 0 };
    viewDashboard(box, { partnerIds: [a.id], actor: "partner" }, key);
    $('[data-dtest="KARASEK"]', box).click();
    eq(dash[key].campaign, "all", "campagne BSPA gardée sur KARASEK");
    eq(commonModel([a.id], "KARASEK", false, bspaCamp.id).campaignId, "all", "modèle");
  });

  test("Tableau de bord · un seul bloc « Par groupe » avec sélecteur (direction / région, genre, âge, ancienneté ; agence pour les autres tests) ; total identique pour chaque regroupement", () => {
    [["BSPA", ["Direction", "Genre", "Tranche d'âge", "Ancienneté"]], ["KARASEK", ["Direction", "Genre", "Tranche d'âge", "Ancienneté", "Agence / site"]]].forEach(([t, labels]) => {
      const box = document.createElement("div"), key = `t-grp-${t}`;
      dash[key] = { test: t, campaign: "all", dim: 0 };
      viewDashboard(box, { partnerIds: [ALPHA().id], actor: "yodan" }, key);
      eq($$('[data-seg="grp"] [data-v]', box).map((b) => b.dataset.v), labels, `${t} : regroupements`);
      eq($$(".fold", box).filter((b) => b.textContent.trim() === "Par groupe").length, 1, `${t} : un seul bloc`);
      const total = t === "BSPA" ? bspaModel([ALPHA().id], false).total : testModel([ALPHA().id], t, false).total;
      labels.forEach((l) => {
        $(`[data-seg="grp"] [data-v="${l}"]`, box).click();
        eq(dash[key].group, l, `${t} : sélection ${l}`);
        const sum = $$(".bar-row .num-cell", box).reduce((s, c) => s + (+c.textContent || 0), 0);
        eq(sum, total, `${t} / ${l} : total`);
      });
    });
  });
  test("Tableau de bord · bouton au début pour fermer puis rouvrir tous les blocs", () => {
    const box = document.createElement("div"), key = "t-fold";
    dash[key] = { test: "BSPA", campaign: "all", dim: 0 };
    viewDashboard(box, { partnerIds: [ALPHA().id], actor: "partner" }, key);
    const btn = $("#fold-all", box), first = $(".toolbar", box).firstElementChild;
    assert(btn && first === btn, "bouton absent ou pas au début");
    btn.click(); assert($$(".fold-body", box).every((b) => b.hidden), "blocs encore ouverts"); assert(btn.textContent.includes("déplier"), "libellé");
    btn.click(); assert($$(".fold-body", box).every((b) => !b.hidden), "blocs encore fermés"); assert(btn.textContent.includes("replier"), "libellé");
  });

  onLogout = keepLogout;
  const ko = results.filter((r) => !r.ok);
  console.log(`%cTests : ${results.length - ko.length} OK / ${ko.length} KO`, `font-weight:bold;color:${ko.length ? "#c93a3a" : "#1f8a4c"}`);
  ko.forEach((r) => console.warn(`❌ ${r.name} — ${r.err}`));
  return results;
}
