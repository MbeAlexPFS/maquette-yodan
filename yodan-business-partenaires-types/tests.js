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
  const CNPS = () => P("CNPS"), LON = () => P("LONACI"), ALPHA = () => P("Entreprise Démo Alpha"), MUT = () => P("Mutuelle Démo Horizon");
  const today = () => todayIso();
  const input = (type, over = {}) => {
    const cfg = presetFor(type);
    if (cfg.campaign.emailPro) cfg.campaign.domains = ["gamma.exemple.test"];
    if (!cfg.tests.length) cfg.tests = ["BSPA"];
    return { name: `Test ${type} ${Math.random().toString(36).slice(2, 6)}`, type, cfg, db: { host: "db.exemple.test", port: "3306", username: "u", password: "fictif", database: "pec_test" }, firstAccount: { name: "Titulaire Démo", email: `titulaire.${type.toLowerCase()}@gamma.exemple.test` }, ...over };
  };
  const activate = (i) => Object.assign(i, { password: DEMO_PASSWORD, activatedAt: clock.now, token: null });
  const pcl = (total) => answersForTotal(20, 4, total, rng(total + 1));
  const cnpsEval = (id1, total, agency = "Agence Plateau", extra = {}) => recordEvaluation({ partnerId: CNPS().id, test: "PCL-5", ids: { id1, id2: "SIN-T" }, agency, identity: { nom: "Test", prenom: "Règle" }, profile: { sexe: "Femme" }, answers: pcl(total), consentsPre: { traitement: true }, ...extra });
  const freshPractitioner = () => { const r = createPractitioner({ name: "Dr Test Règle", email: `dr.regle${Math.random().toString(36).slice(2, 6)}@praticiens.exemple.test` }); r.practitioner.weekdays[0] = true; return r.practitioner; };
  /** Prise en charge en deux temps : l'admin Yodan valide (transfert), la Console attribue le praticien. */
  const takeAndAssign = (ptId, prId, att) => transferToConsole(ptId) && assignPractitioner(ptId, prId, att);

  /* ---------- Préréglages et rôles (spécification validée) ---------- */
  test("Préréglage CNPS · PCL-5, tous les rôles, parents avec toutes les fonctionnalités des enfants, bon, 10 consultations", () => {
    const c = presetFor("CNPS");
    eq(c.tests, ["PCL-5"], "tests"); eq(enabledRoles(c), ROLES, "rôles"); eq(c.pec, { max: 10, mode: "bon" }, "prise en charge");
    ROLES.forEach((r) => childrenOf(r).forEach((ch) => OWN_FEATURES[ch].forEach((f) => assert(tabsFor(c, r).includes(f), `${r} devrait avoir ${f}`))));
  });
  test("Préréglage LONACI · ICJE, Superviseur principal seul, sans héritage, budget", () => {
    const c = presetFor("LONACI"); eq(c.tests, ["ICJE"], "tests"); eq(enabledRoles(c), ["SUPPRI"], "rôles"); eq(tabsFor(c, "SUPPRI"), ["dashboard"], "onglets"); eq(c.pec.mode, "budget", "pec");
  });
  test("Préréglage Entreprise · BSPA, Superviseur principal avec campagne et e-mail pro, budget", () => {
    const c = presetFor("ENTREPRISE"); eq(c.tests, ["BSPA"], "tests"); eq(enabledRoles(c), ["SUPPRI"], "rôles"); eq(c.campaign.roles, ["SUPPRI"], "campagne"); assert(c.campaign.emailPro, "e-mail pro"); eq(tabsFor(c, "SUPPRI"), ["dashboard", "campagne"], "onglets");
  });
  test("Préréglage Association / mutuelle · tous les rôles sauf Évaluateur, campagne chez le Validateur, aucun rôle avec l'Évaluation", () => {
    const c = presetFor("MUTUELLE"); eq(enabledRoles(c), ["VALID", "SUPADJ", "SUPPRI", "ADMIN"], "rôles"); eq(c.campaign.roles, ["VALID"], "campagne");
    enabledRoles(c).forEach((r) => assert(!tabsFor(c, r).includes("evaluation"), `${r} a l'Évaluation`));
    ["SUPADJ", "SUPPRI", "ADMIN"].forEach((r) => assert(tabsFor(c, r).includes("validation") && tabsFor(c, r).includes("campagne"), `${r} hérite`));
  });
  test("Rôles · Superviseur principal jamais désactivable ; les autres rôles le sont", () => {
    Object.keys(PARTNER_TYPES).forEach((t) => { const c = presetFor(t); assert(!setRoleEnabled(c, "SUPPRI", false) && c.roles.SUPPRI.on, t); ROLES.filter((r) => r !== "SUPPRI").forEach((r) => { setRoleEnabled(c, r, true); assert(setRoleEnabled(c, r, false) && !c.roles[r].on, `${t}/${r}`); }); });
  });
  test("Rôles · un rôle désactivé n'a aucun onglet et perd la campagne", () => {
    const c = presetFor("MUTUELLE"); setRoleEnabled(c, "VALID", false); eq(tabsFor(c, "VALID"), [], "onglets"); assert(!c.campaign.roles.includes("VALID") && c.campaign.roles.length, "campagne");
  });
  test("Rôles · validation par le partenaire seulement s'il a un rôle actif avec l'onglet Validation (sinon Yodan)", () => {
    assert(partnerValidates(CNPS()) && partnerValidates(MUT()), "CNPS / Mutuelle"); assert(!partnerValidates(LON()) && !partnerValidates(ALPHA()), "LONACI / Alpha");
  });

  /* ---------- Création d'un partenaire ---------- */
  test("Création · premier compte sur le plus grand rôle actif, invité par lien d'activation", () => {
    const exp = { CNPS: "ADMIN", LONACI: "SUPPRI", ENTREPRISE: "SUPPRI", MUTUELLE: "ADMIN", PERSO: "SUPPRI" };
    Object.entries(exp).forEach(([t, role]) => { const r = createPartner(input(t)); assert(r.ok, t); eq(r.role, role, t); assert(db.outbox.some((m) => m.to === r.identity.email && m.kind === "ACTIVATION"), `${t} : pas d'e-mail`); });
  });
  test("Création · « Voir en détail » sans changement = préréglage ; un changement marque « modifié »", () => {
    ["CNPS", "LONACI", "ENTREPRISE", "MUTUELLE"].forEach((t) => { assert(!createPartner(input(t)).partner.customized, t); const i = input(t, { firstAccount: { name: "B", email: `b.${t.toLowerCase()}@gamma.exemple.test` } }); i.cfg.pec.max = 8; assert(createPartner(i).partner.customized, `${t} modifié`); });
  });
  test("Création · réglages métier du type repris (identifiants, questionnaire général, consentements, options d'agence)", () => {
    const c = createPartner(input("CNPS")).partner; eq(c.idLabels, ["N° d'immatriculation", "N° de sinistre"], "identifiants CNPS"); assert(c.fields.some((f) => f.key === "type_sinistre"), "champ sinistre");
    const l = createPartner(input("LONACI")).partner; eq(l.idLabels, ["N° de téléphone"], "identifiant LONACI"); eq(l.agencyOpts[0].validateZones, [], "LONACI sans validateur");
    assert(consentsOf(l, "pre").some((x) => x.required), "consentement obligatoire");
  });
  test("Création · base : 5 champs obligatoires, port 1–65535 ; mot de passe jamais conservé", () => {
    const e = validatePartner(input("CNPS", { db: { host: "", port: "70000", username: "", password: "", database: "a-b" } }));
    ["host", "port", "username", "password", "database"].forEach((k) => assert(e[k], k));
    const r = createPartner(input("CNPS")); assert(!("password" in r.partner.db) && r.partner.db.secretRef.startsWith("vault://"), "secret");
  });
  test("Création · e-mail pro ⇒ au moins un domaine, messageries publiques refusées ; consultations max 1 à 50", () => {
    const i = input("ENTREPRISE"); i.cfg.campaign.domains = []; assert(validatePartner(i).domains, "vide"); i.cfg.campaign.domains = ["gmail.com"]; assert(validatePartner(i).domains, "gmail");
    [[1, false], [50, false], [0, true], [51, true]].forEach(([v, err]) => { const j = input("LONACI"); j.cfg.pec.max = v; eq(!!validatePartner(j).max, err, `max ${v}`); });
  });
  test("Test de connexion base · un message par cause, jamais le mot de passe dans le journal", () => {
    const b = { host: "db.exemple.test", port: 3306, username: "u", password: "S3cret-x", database: "pec" };
    const m = [testDbConnection({ ...b, host: "injoignable" }), testDbConnection({ ...b, password: "faux" }), testDbConnection({ ...b, database: "absente" }), testDbConnection(b)];
    eq(m.map((x) => x.ok), [false, false, false, true], "issues"); eq(new Set(m.map((x) => x.msg)).size, 4, "messages"); assert(!JSON.stringify(db.logs).includes("S3cret"), "secret journalisé");
  });

  /* ---------- Comptes et connexion ---------- */
  test("Comptes · identifiant sans rôle : pas de connexion ; rôle non activé refusé ; pas de doublon", () => {
    const r = createIdentity({ partnerId: CNPS().id, name: "Sans Rôle", email: "sans.role@cnps.exemple.test" }); activate(r.identity);
    assert(/Aucun rôle actif/.test(login(r.identity.email, DEMO_PASSWORD).err || ""), "connexion sans rôle");
    const i = createIdentity({ partnerId: LON().id, name: "X", email: "x@lonaci.exemple.test" }).identity;
    assert(!addRole(i.id, "EVAL").ok && addRole(i.id, "SUPPRI").ok && !addRole(i.id, "SUPPRI").ok, "rôles");
  });
  test("Comptes · désactivation ciblée d'un rôle ; migration vers un identifiant du même partenaire avec historique", () => {
    const claire = identityByEmail("claire.demo@cnps.exemple.test"); const [a, b] = assignmentsOf(claire.id); setAssignmentActive(a.id, false); setAssignmentActive(b.id, true);
    assert(!a.active && b.active && !claire.disabled, "ciblée");
    const paul = identityByEmail("paul.demo@cnps.exemple.test"), asg = assignmentsOf(paul.id)[0];
    const nv = createIdentity({ partnerId: CNPS().id, name: "Remplaçant", email: "remplacant@cnps.exemple.test" }).identity;
    assert(migrateAssignment(asg.id, nv.id).ok && asg.identityId === nv.id && asg.history.at(-1).from === paul.email, "migration");
    assert(!migrateAssignment(asg.id, identityByEmail("supervision@lonaci.exemple.test").id).ok, "autre partenaire");
  });
  test("Connexion · login → code → entrer ; code expiré après 10 min ; message générique", () => {
    const r = login("admin@cnps.exemple.test", DEMO_PASSWORD); assert(r.ok, "login");
    const c = startOtp(r.identity.id, "LOGIN"); clock.now += 11 * MIN; eq(verifyOtp(c.id, c.code), "EXPIRE", "expiré");
    const c2 = startOtp(r.identity.id, "LOGIN"); eq(verifyOtp(c2.id, c2.code), "OK", "code");
    eq(login("inconnu@exemple.test", "x").err, "Adresse ou mot de passe incorrect.", "générique");
  });
  test("Activation · lien → code → mot de passe → entrer ; lien expiré après 72 h ; admin LAMIFI (.env) change son mot de passe", () => {
    const i = identityByEmail("nouvel.agent@cnps.exemple.test"); const tok = i.token;
    clock.now = i.invitedAt + 71 * HOUR; assert(activationIdentity(tok).ok, "71 h");
    assert(setPassword(i.id, "Demo-Activation-42", "Demo-Activation-42").ok && !activationIdentity(tok).ok, "usage unique");
    clock.now = clockSnap; const la = identityByEmail(ENV.LAMIFI_ADMIN_EMAIL); assert(la.mustChangePassword && !setPassword(la.id, ENV.LAMIFI_ADMIN_PASSWORD, ENV.LAMIFI_ADMIN_PASSWORD).ok, "admin LAMIFI");
  });
  test("Session · déconnexion après 30 min sans activité", () => {
    const i = identityByEmail("admin.yodan@yodan.exemple.test"); enterSession(i.id);
    clock.now += 29 * MIN; assert(!idleExpired(), "29 min"); clock.now += MIN; assert(idleExpired(), "30 min");
  });

  /* ---------- Tests et calculs (repris des maquettes sources) ---------- */
  test("Calcul · PCL-5 : 20 questions de 0 à 4, ≤ 42 vert, 43–50 orange, ≥ 51 rouge", () => {
    eq(TESTS["PCL-5"].items.length, 20, "questions");
    [[0, "VERT"], [42, "VERT"], [43, "ORANGE"], [50, "ORANGE"], [51, "ROUGE"], [80, "ROUGE"]].forEach(([s, z]) => eq(scoreTest("PCL-5", pcl(s)).zone, z, `score ${s}`));
  });
  test("Calcul · ICJE : 9 questions de 0 à 3 ; 0 sans risque, 1–2 faible, 3–7 modéré, 8+ excessif", () => {
    eq(TESTS.ICJE.items.length, 9, "questions");
    [[0, 0, "VERT"], [2, 1, "VERT"], [3, 2, "ORANGE"], [7, 2, "ORANGE"], [8, 3, "ROUGE"], [27, 3, "ROUGE"]].forEach(([s, cat, z]) => { const r = scoreTest("ICJE", answersForTotal(9, 3, s, rng(s + 3))); eq([r.cat, r.zone], [cat, z], `score ${s}`); });
  });
  test("Calcul · BSPA : 22 questions en 5 dimensions, profil vert / orange / rouge, signal fort ⇒ rouge", () => {
    eq(TESTS.BSPA.items.length, 22, "questions");
    const good = scoreTest("BSPA", bspaAnswers(0, rng(1))), bad = scoreTest("BSPA", bspaAnswers(1, rng(1)));
    eq(Object.keys(good.dims), BSPA_DIMS, "dimensions"); eq(good.zone, "VERT", "bien"); eq(bad.zone, "ROUGE", "mal");
    const a = bspaAnswers(0, rng(1)); a[a.length - 1] = 2; eq(scoreTest("BSPA", a).zone, "ROUGE", "signal fort");
  });
  test("Calcul · réponses incomplètes ou hors échelle refusées", () => {
    assert(!scoreTest("PCL-5", pcl(10).slice(0, 19)) && !scoreTest("ICJE", Array(9).fill(4)) && !scoreTest("BSPA", Array(22).fill(0)), "accepté");
  });
  test("Invariant · zone, score, catégorie et dimensions stockés = recalcul à partir des réponses", () => {
    db.evaluations.forEach((e) => { const r = scoreTest(e.test, e.answers); assert(r && r.zone === e.zone && r.score === e.score && (r.cat ?? null) === e.cat, `${e.dossier} incohérent`); });
  });

  /* ---------- Décisions et blocages (DossierLookup) ---------- */
  test("Invariant · décision seulement sur une zone validée par l'agence, après l'évaluation ; vert jamais décidé", () => {
    db.evaluations.filter((e) => e.decision).forEach((e) => { assert(agencyOpt(partnerOf(e.partnerId), e.agency).validateZones.includes(e.zone), `${e.dossier} : zone non validée`); assert(e.decidedAt >= e.date && e.decidedAt <= today(), `${e.dossier} : date`); assert(e.zone !== "VERT", e.dossier); });
  });
  test("Règle · Bouaké décide aussi le rouge ; Plateau : rouge pris en charge automatiquement", () => {
    eq(outcomeOf(cnpsEval("DEMO-T001", 70, "Agence Bouaké").evaluation), "PENDING", "Bouaké"); eq(outcomeOf(cnpsEval("DEMO-T002", 70).evaluation), "AUTO_YES", "Plateau"); eq(outcomeOf(cnpsEval("DEMO-T003", 10).evaluation), "AUTO_NO", "vert");
  });
  test("Blocages · décision en attente, délai de recours, dossier ouvert, suivi trop tôt ; suivi possible après 60 jours", () => {
    const e = cnpsEval("DEMO-T010", 46).evaluation;
    assert(/attend déjà une décision/.test(lookupDossier(CNPS().id, "DEMO-T010").blocker), "attente");
    decide(e.id, true); assert(/délai de recours/.test(lookupDossier(CNPS().id, "DEMO-T010").blocker), "recours");
    clock.now += 8 * DAY; assert(/déjà ouvert/.test(lookupDossier(CNPS().id, "DEMO-T010").blocker), "ouvert");
    const pt = db.patients.find((x) => x.evalId === e.id); depositBon(pt.id); takeAndAssign(pt.id, freshPractitioner().id);
    const look = lookupDossier(CNPS().id, "DEMO-T010"); eq(look.path, "followup", "suivi"); assert(/pas encore possible/.test(look.blocker), "trop tôt");
    clock.now += 61 * DAY; const l2 = lookupDossier(CNPS().id, "DEMO-T010"); assert(l2.path === "followup" && !l2.blocker, "suivi après 60 j");
    const fu = cnpsEval("DEMO-T010", 30); assert(fu.ok && fu.evaluation.kind === "Suivi" && fu.evaluation.patientId === pt.id && outcomeOf(fu.evaluation) === "SUIVI", "test de suivi");
  });
  test("Règle · consentement obligatoire, test non activé et identifiant manquant refusés", () => {
    assert(!cnpsEval("DEMO-T020", 10, "Agence Plateau", { consentsPre: {} }).ok, "sans consentement");
    assert(!recordEvaluation({ partnerId: CNPS().id, test: "ICJE", ids: { id1: "X" }, answers: Array(9).fill(0), consentsPre: { traitement: true } }).ok, "test non activé");
    assert(!cnpsEval("", 10).ok, "sans N°");
  });
  test("Règle · parcours libres (site, campagne) jamais bloqués, sans doublon de prise en charge", () => {
    const base = { partnerId: LON().id, test: "ICJE", ids: { id1: "05 11 22 33 44" }, agency: LON().agencies[0], answers: answersForTotal(9, 3, 20, rng(4)), consentsPre: { traitement: true }, mode: "site" };
    assert(recordEvaluation(base).ok && recordEvaluation(base).ok, "deuxième passage bloqué");
    eq(db.patients.filter((x) => personOf(x.personId).id1 === "05 11 22 33 44").length, 1, "un seul dossier ouvert");
  });

  /* ---------- Prise en charge ---------- */
  test("Invariant · un patient = une évaluation initiale acceptée ; jamais pour le vert ; un seul dossier ouvert par personne", () => {
    db.patients.forEach((x) => { const e = evaluationOf(x.evalId); assert(e.kind === "Initiale" && acceptsCare(e), `${x.dossier}`); });
    const open = db.patients.filter((x) => !x.closedAt).map((x) => x.personId); eq(new Set(open).size, open.length, "doublon");
  });
  test("Invariant · « Pas de bon » au type bon, « Budget atteint » au type budget ; les deux présents dans la démo", () => {
    db.patients.forEach((x) => assert(statusesFor(partnerOf(x.partnerId).pec.mode).includes(patientStatus(x)), x.dossier));
    assert(db.patients.some((x) => patientStatus(x) === "PAS_DE_BON") && db.patients.some((x) => patientStatus(x) === "BUDGET_ATTEINT"), "démo");
  });
  test("Invariant · consultations ≤ capacité ; séances après l'attribution, pas dans le futur ; bon après le délai de recours", () => {
    db.patients.forEach((x) => {
      assert(consumedOf(x) <= capacityOf(x), `${x.dossier} capacité`);
      x.sessions.forEach((s) => assert(s.date >= x.assignedAt && s.date <= today(), `${x.dossier} séance`));
      x.bons.forEach((b) => assert(b.at >= x.availableAt && b.at <= today(), `${x.dossier} bon`));
      if (x.practitionerId) assert(x.attestation && x.attestation.until > x.assignedAt && hasAgenda(practitionerOf(x.practitionerId)), `${x.dossier} attestation / agenda`);
      if (x.practitionerId) assert(x.transferredAt && x.transferredAt <= x.assignedAt, `${x.dossier} : attribué sans validation Yodan`);
      if (["EN_COURS", "CLOS"].includes(patientStatus(x)) && x.closedReason !== "Refus du patient") assert(x.practitionerId, `${x.dossier} sans praticien`);
    });
  });
  test("Invariant · type bon : pas d'accord à recueillir ; refus de l'accord ⇒ dossier clos", () => {
    db.patients.forEach((x) => { if (partnerOf(x.partnerId).pec.mode === "bon") eq(x.accord, true, x.dossier); if (x.accord === false) assert(x.closedAt, x.dossier); });
  });
  test("Parcours · prise en charge validée par l'admin Yodan, attribution dans la Console seulement après", () => {
    const pt = db.patients.find(canTakeCharge); const pr = freshPractitioner();
    assert(!canAssign(pt) && !assignPractitioner(pt.id, pr.id), "attribution sans validation Yodan");
    assert(transferToConsole(pt.id) && !canTakeCharge(pt) && canAssign(pt), "transfert"); eq(patientStatus(pt), "EN_ATTENTE", "toujours en attente");
    assert(/Console/.test(waitingReason(pt)), "étape affichée"); assert(assignPractitioner(pt.id, pr.id) && patientStatus(pt) === "EN_COURS", "attribution");
  });
  test("Parcours · type bon : décision oui → délai de recours → bon → praticien (agenda obligatoire) → 10 présences → Pas de bon → déblocage", () => {
    const e = cnpsEval("DEMO-T030", 47).evaluation; decide(e.id, true, { comment: "ok" });
    const pt = db.patients.find((x) => x.evalId === e.id); eq(patientStatus(pt), "PAS_DE_BON", "sans bon"); assert(!canDepositBon(pt) && !canUnlock(pt), "pendant le recours");
    clock.now += 7 * DAY; assert(depositBon(pt.id), "dépôt"); eq(patientStatus(pt), "EN_ATTENTE", "après bon");
    const noAgenda = createPractitioner({ name: "Dr Sans Agenda", email: "sans.agenda@praticiens.exemple.test" }).practitioner;
    assert(transferToConsole(pt.id), "validation Yodan");
    assert(!assignPractitioner(pt.id, noAgenda.id) && suggestPractitioner()?.id !== noAgenda.id, "praticien sans agenda accepté");
    assert(assignPractitioner(pt.id, freshPractitioner().id, { kind: "IN_PERSON" }), "attribution"); eq(pt.attestation.kind, "IN_PERSON", "présentiel");
    recordSession(pt.id, "ABSENT"); recordSession(pt.id, "POSTPONED"); eq(consumedOf(pt), 0, "absences consommées");
    for (let k = 0; k < 10; k++) assert(recordSession(pt.id, "PRESENT"), `séance ${k + 1}`);
    eq(patientStatus(pt), "PAS_DE_BON", "bon consommé"); assert(!recordSession(pt.id, "PRESENT"), "11e séance");
    assert(unlockPatient(pt.id), "déblocage"); eq(patientStatus(pt), "EN_COURS", "après déblocage"); eq(capacityOf(pt), 20, "capacité");
  });
  test("Parcours · type budget : rouge → accord à recueillir → accepte → praticien → 10 présences → Budget atteint → déblocage", () => {
    const r = recordEvaluation({ partnerId: LON().id, test: "ICJE", ids: { id1: "05 00 99 99 01" }, agency: LON().agencies[0], answers: answersForTotal(9, 3, 15, rng(9)), consentsPre: { traitement: true }, mode: "site" });
    const pt = db.patients.find((x) => x.evalId === r.evaluation.id); eq(pt.accord, null, "accord"); assert(!canTakeCharge(pt), "avant accord");
    assert(accordQueue([LON().id]).includes(pt), "file d'appel"); recordAccord(pt.id, "INJOIGNABLE"); eq(pt.accordCalls, 1, "tentative");
    logCall(pt.id, "JOINT_ACCEPTE"); assert(pt.accord === true && canTakeCharge(pt), "accord par l'appel Yodan");
    takeAndAssign(pt.id, freshPractitioner().id); for (let k = 0; k < 10; k++) recordSession(pt.id, "PRESENT");
    eq(patientStatus(pt), "BUDGET_ATTEINT", "budget"); assert(!depositBon(pt.id), "bon au type budget"); assert(unlockPatient(pt.id) && patientStatus(pt) === "EN_COURS", "déblocage");
  });
  test("Parcours · accompagnement coché avec le résultat = accord donné ; refus au téléphone = dossier clos", () => {
    const mk = (id) => recordEvaluation({ partnerId: LON().id, test: "ICJE", ids: { id1: id }, agency: LON().agencies[0], answers: answersForTotal(9, 3, 15, rng(2)), consentsPre: { traitement: true }, mode: "site" }).evaluation;
    const a = mk("05 00 99 99 02"); setPostConsents(a.id, { support: true }); eq(db.patients.find((x) => x.evalId === a.id).accord, true, "support");
    const b = mk("05 00 99 99 03"); const pb = db.patients.find((x) => x.evalId === b.id); recordAccord(pb.id, "REFUSE"); eq(patientStatus(pb), "CLOS", "refus");
  });
  test("Parcours · séance prévue pointée par le praticien ; présence au-delà du plafond refusée", () => {
    const pt = db.patients.find((x) => patientStatus(x) === "EN_COURS");
    pt.sessions.push({ date: today(), status: null, practitionerId: pt.practitionerId, report: false });
    const k = pt.sessions.length - 1, before = consumedOf(pt); assert(markSession(pt.id, k, "PRESENT") && consumedOf(pt) === before + 1, "pointage");
    assert(!markSession(pt.id, k, "ABSENT"), "deux fois");
    while (consumedOf(pt) < capacityOf(pt)) pt.sessions.push({ date: today(), status: "PRESENT", practitionerId: pt.practitionerId });
    pt.sessions.push({ date: today(), status: null, practitionerId: pt.practitionerId }); assert(!markSession(pt.id, pt.sessions.length - 1, "PRESENT"), "plafond");
  });
  test("Invariant · tests de suivi : rattachés à une prise en charge, sans décision, après l'attribution", () => {
    db.evaluations.filter((e) => e.kind === "Suivi").forEach((e) => { const pt = patientOf(e.patientId); assert(pt && pt.assignedAt <= e.date && !e.decision, e.dossier); });
    assert(db.evaluations.some((e) => e.kind === "Suivi"), "la démo doit contenir des tests de suivi");
  });

  /* ---------- Données personnelles ---------- */
  test("Invariant · identité dans le coffre identité : aucun champ 🔒 dans le profil statistique d'une évaluation", () => {
    db.evaluations.forEach((e) => { const pii = partnerOf(e.partnerId).fields.filter((f) => f.pii).map((f) => f.key); assert(!Object.keys(e.profile).some((k) => pii.includes(k)) && !("name" in e) && personOf(e.personId), e.dossier); });
  });
  test("E-mails · aucun résultat, score ni zone dans un e-mail (activation, code, invitation, bilan)", () => {
    const c = db.campaigns.find((x) => campaignState(x) === "EN_COURS" && x.partnerId === ALPHA().id);
    inviteToCampaign(c.id, "invite.regle@alpha.exemple.test");
    db.outbox.forEach((m) => assert(!/\b(score|zone|vert|orange|rouge|PCL-5|ICJE|BSPA|résultat|risque)\b/i.test(`${m.subject} ${m.lines.join(" ")}`), `« ${m.subject} »`));
  });

  /* ---------- Campagnes ---------- */
  test("Invariant · participants : terminé ⇒ ouvert + évaluation dans la période ; campagne à venir sans réponse ; domaine pro respecté", () => {
    db.participants.forEach((x) => {
      const c = campaignOf(x.campaignId), p = partnerOf(c.partnerId);
      if (x.completedAt) { const e = evaluationOf(x.evalId); assert(x.startedAt && e && e.campaignId === c.id && e.date >= c.start && e.date <= c.end, x.email); }
      if (campaignState(c) === "AVENIR") assert(!x.startedAt, `${x.email} : réponse avant l'ouverture`);
      if (p.campaign.emailPro) assert(p.campaign.domains.includes(domainOf(x.email)), `${x.email} hors domaine`);
    });
  });
  test("Parcours · participant : domaine refusé → code → questionnaire → terminé ; nouvelle tentative refusée ; e-mail neutre", () => {
    const c = db.campaigns.find((x) => campaignState(x) === "EN_COURS" && x.partnerId === ALPHA().id);
    assert(!startParticipation(c.id, "x@gmail.com").ok, "gmail accepté");
    const s = startParticipation(c.id, "regle.participant@alpha.exemple.test"); assert(s.ok, "départ");
    eq(verifyParticipant(s.challengeId, db.outbox.at(-1).code), "OK", "code");
    const r = submitParticipation(s.participant.id, { identity: { prenom: "Règle", nom: "Test" }, profile: { genre: "Femme", tranche_age: "26-35 ans" }, answers: bspaAnswers(0.4, rng(5)), consentsPre: { traitement: true } });
    assert(r.ok && r.evaluation.mode === "campagne" && participantStatus(s.participant) === "TERMINE", "fin");
    eq(db.outbox.at(-1).subject, "Votre bilan est disponible", "e-mail"); assert(!startParticipation(c.id, "regle.participant@alpha.exemple.test").ok, "deuxième participation");
    const fut = db.campaigns.find((x) => campaignState(x) === "AVENIR"); assert(!startParticipation(fut.id, "a@alpha.exemple.test").ok, "campagne à venir");
  });
  test("Campagne · invitations : CSV (colonne e-mail seule), refus hors domaine, format, déjà terminé", () => {
    eq(parseCsvEmails("﻿Nom;E-mail;Service\nDémo;a.b@alpha.exemple.test;RH\nTest;c.d@alpha.exemple.test;IT"), ["a.b@alpha.exemple.test", "c.d@alpha.exemple.test"], "CSV");
    const c = db.campaigns.find((x) => campaignState(x) === "EN_COURS" && x.partnerId === ALPHA().id);
    const done = db.participants.find((x) => x.campaignId === c.id && x.completedAt).email;
    const r = inviteToCampaign(c.id, `x@gmail.com pas-un-email ${done}`, "email\nnouveau.csv@alpha.exemple.test");
    eq(r.added, ["nouveau.csv@alpha.exemple.test"], "ajoutés"); eq(r.refused.map(([, w]) => w).sort(), ["déjà terminé", "domaine", "format"].sort(), "raisons");
  });
  test("Visibilité · participants d'une campagne : admin Yodan seulement ; le partenaire peut créer", () => {
    const box = document.createElement("div");
    viewCampaigns(box, { partnerIds: [ALPHA().id], actor: "partner" }); assert(box.querySelector("#c-new") && !/Invités|Terminés/.test(box.textContent), "partenaire");
    campaignModal(db.campaigns.find((c) => c.partnerId === ALPHA().id && campaignState(c) === "EN_COURS").id, { partnerIds: [ALPHA().id], actor: "partner" }, () => {});
    const t = $$(".modal-back").at(-1).textContent; assert(!/Participants|@alpha\.exemple\.test/.test(t.replace(/prenom\.nom@alpha\.exemple\.test/, "")), "liste visible");
    viewCampaigns(box, { partnerIds: [ALPHA().id], actor: "yodan" }); assert(/Invités/.test(box.textContent), "Yodan");
  });

  /* ---------- Tableaux de bord ---------- */
  test("Cohérence · pour chaque partenaire et chaque test : zones, décisions, agences et sexes = total", () => {
    db.partners.forEach((p) => p.tests.forEach((t) => { const m = dashboardModel([p.id], t, false); eq(sum(m.zones), m.total, `${p.name}/${t} zones`); eq(sum(m.outcomes), m.total, `${p.name}/${t} décisions`); eq(m.byAgency.reduce((s, a) => s + a.total, 0), m.total, "agences"); eq(m.bySex.reduce((s, a) => s + a.total, 0), m.total, "sexes"); }));
  });
  test("Cohérence · PCL-5 : parcours décroissant, suivi = patients avec test de suivi, assiduité = séances pointées", () => {
    const m = pcl5Model([CNPS().id], false);
    m.funnel.slice(1).forEach(([l, n], i) => assert(n <= m.funnel[i][1], `${l} > étape précédente`));
    eq(sum(m.trend), new Set(db.evaluations.filter((e) => e.kind === "Suivi" && e.partnerId === CNPS().id).map((e) => e.patientId)).size, "suivi");
    eq(sum(m.attendance), db.patients.filter((x) => x.partnerId === CNPS().id).flatMap((x) => x.sessions).filter((s) => s.status).length, "assiduité");
    m.profile.forEach((d) => eq(d.rows.reduce((s, r) => s + r.total, 0), m.total, d.label));
  });
  test("Cohérence · ICJE : 4 catégories = total ; à risque = modéré + excessif", () => {
    const m = icjeModel([LON().id], false); eq(m.cats.reduce((a, b) => a + b, 0), m.total, "catégories"); eq(m.risk, m.cats[2] + m.cats[3], "à risque");
    m.weeklyCats.forEach((w) => assert(w.cats.every((n) => n >= 0), "semaine"));
  });
  test("Cohérence · BSPA : profils = bilans ; filtre par campagne = somme des campagnes", () => {
    const all = bspaModel([ALPHA().id], false); eq(all.prof.reduce((a, b) => a + b, 0), all.total, "profils");
    eq(all.campaigns.reduce((s, c) => s + bspaModel([ALPHA().id], false, c.id).total, 0), all.total, "campagnes");
  });
  test("Superviseur adjoint · même tableau de bord que le principal, limité à ses agences", () => {
    const p = CNPS(); assert(tabsFor(p, "SUPADJ").includes("dashboard") && OWN_FEATURES.SUPADJ.includes("dashboard"), "onglet");
    const ag = ["Agence Plateau", "Agence Yopougon"];
    const all = pcl5Model([p.id], true), mine = pcl5Model([p.id], true, ag);
    eq(mine.total, db.evaluations.filter((e) => e.partnerId === p.id && e.test === "PCL-5" && e.kind === "Initiale" && ag.includes(e.agency)).length, "périmètre");
    assert(mine.total < all.total && mine.agencies.every((a) => ag.includes(a.agency)), "agences hors périmètre");
    const box = document.createElement("div"); viewDashboard(box, { partnerIds: [p.id], actor: "partner", agencies: ag }, "t-adj");
    assert(!box.textContent.includes("Agence Bouaké"), "Bouaké visible");
  });
  test("Évaluateur · une seule agence (création du rôle et comptes de la démo)", () => {
    const i = createIdentity({ partnerId: CNPS().id, name: "Éval Règle", email: "eval.regle@cnps.exemple.test" }).identity;
    assert(!addRole(i.id, "EVAL", ["Agence Plateau", "Agence Bouaké"]).ok, "deux agences acceptées");
    assert(!addRole(i.id, "EVAL").ok, "toutes les agences par défaut acceptées");
    assert(addRole(i.id, "EVAL", ["Agence Bouaké"]).ok, "une agence refusée");
    db.assignments.filter((a) => a.role === "EVAL").forEach((a) => eq(a.agencies.length, 1, identityOf(a.identityId).email));
  });
  test("Praticien · agenda en place dès qu'un jour est coché (calculé, aucun réglage manuel)", () => {
    const pr = createPractitioner({ name: "Dr Agenda", email: "dr.agenda@praticiens.exemple.test" }).practitioner;
    assert(!hasAgenda(pr) && !("agenda" in pr) && suggestPractitioner()?.id !== pr.id, "sans jour");
    pr.weekdays[2] = true; assert(hasAgenda(pr), "un jour coché");
    db.practitioners.forEach((x) => assert(!("agenda" in x), `${x.name} : bascule manuelle`));
  });
  test("Cohérence · console : somme des statuts = total, par partenaire et global", () => {
    const m = pecDashboard(db.partners.map((p) => p.id)); eq(sum(m.byStatus), m.total, "global"); m.byPartner.forEach((b) => eq(sum(b.byStatus), b.total, pName(b.partnerId)));
  });
  test("Masquage · partenaire : 1 à 4 masqué ; moins de 5 évaluations ⇒ tout masqué ; Yodan jamais masqué", () => {
    eq([masked(3, true), masked(5, true), masked(0, true), masked(3, false)], ["< 5", 5, 0, 3], "seuil");
    const r = createPartner(input("LONACI")); assert(dashboardModel([r.partner.id], "ICJE", true).tooSmall && !dashboardModel([r.partner.id], "ICJE", false).tooSmall, "petit effectif");
  });
  test("Visibilité · tableau de bord : jamais de nom ni de N° côté partenaire ; détail individuel côté Yodan", () => {
    const p = CNPS(), box = document.createElement("div");
    const someone = displayName(personOf(db.evaluations.find((e) => e.partnerId === p.id).personId));
    viewDashboard(box, { partnerIds: [p.id], actor: "partner" }, "t-p"); assert(!box.textContent.includes(someone) && !/CNP-\d/.test(box.textContent), "partenaire");
    viewDashboard(box, { partnerIds: [p.id], actor: "yodan" }, "t-y"); assert(/CNP-\d/.test(box.textContent) && !box.textContent.includes("< 5"), "Yodan");
  });
  test("Visibilité · Superviseur adjoint : suivi des dossiers et hors délai sans identité", () => {
    const p = CNPS(), box = document.createElement("div"); subs[`sv-tv`] = "dossiers";
    viewSuivi(box, { partnerIds: [p.id], actor: "partner" }, "tv");
    const names = db.patients.filter((x) => x.partnerId === p.id).slice(0, 15).map((x) => displayName(personOf(x.personId)));
    assert(!names.some((n) => box.textContent.includes(n)), "nom visible");
  });
  test("Visibilité · employeur (Entreprise) : ni Évaluation ni Validation ; fiche de dossier de l'Administrateur sans score", () => {
    eq(tabsFor(ALPHA(), "SUPPRI"), ["dashboard", "campagne"], "onglets");
    const box = document.createElement("div"); const e = db.evaluations.find((x) => x.partnerId === CNPS().id && x.kind === "Initiale");
    dossierSearch(box, CNPS(), e.dossier); assert(box.textContent.includes(e.dossier) && !box.textContent.includes(`${e.score}/80`) && !box.textContent.includes(displayName(personOf(e.personId))), "fiche");
  });
  test("Console · praticien créé sans type ni ville, agenda à mettre en place, lien d'activation", () => {
    const r = createPractitioner({ name: "Dr Nouveau Démo", email: "nouveau@praticiens.exemple.test" });
    assert(r.ok && !("city" in r.practitioner) && !hasAgenda(r.practitioner), "praticien"); eq(db.outbox.at(-1).kind, "ACTIVATION", "e-mail");
  });
  test("Export SQL · code reçu par e-mail obligatoire", () => {
    const i = identityByEmail("admin@cnps.exemple.test"); const c = startOtp(i.id, "EXPORT");
    eq(verifyOtp(c.id, c.code === "111111" ? "222222" : "111111"), "FAUX", "faux code"); eq(verifyOtp(c.id, c.code), "OK", "bon code");
  });

  onLogout = keepLogout;
  const ko = results.filter((r) => !r.ok);
  console.log(`%cTests : ${results.length - ko.length} OK / ${ko.length} KO`, `font-weight:bold;color:${ko.length ? "#c93a3a" : "#1f8a4c"}`);
  ko.forEach((r) => console.warn(`❌ ${r.name} — ${r.err}`));
  return results;
}
