/*
 * Tests de cohérence (règles métier) — CLAUDE.md § 9.
 * Lancement : ouvrir index.html?tests=1 (console + encadré du panneau Notes UX),
 * ou `agent-browser eval "JSON.stringify(runTests())"`.
 * Chaque test travaille sur un jeu de données neuf (E.generate()) : l'interface n'est pas modifiée.
 * Une fois la maquette validée, ces noms de règles deviennent les tests PHPUnit du projet.
 */
"use strict";

function runTests() {
  const E = window.EM, D = E.D, NOW = E.NOW0;
  const results = [];
  const test = (name, fn) => { try { fn(E.generate()); results.push({ name, ok: true }); } catch (err) { results.push({ name, ok: false, err: err.message }); } };
  const assert = (cond, msg) => { if (!cond) { throw new Error(msg); } };
  const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)})`);
  const throws = (fn, msg) => { let ok = false; try { fn(); } catch (e) { ok = !!e.business; } assert(ok, msg); };
  const acc = (db, role, clientId) => db.accounts.find((a) => a.role === role && (clientId === undefined || a.clientId === clientId));
  const P = window.APP.PRESETS;
  const profile = (unitId, extra = {}) => ({ consentDonnees: true, consentContact: true, nom: "Exemple", prenom: "Camille", tel: "07 00 99 88 77", unitId, genre: "Femme", age: "26-35 ans", ancEnt: "1 à 5 ans", ancPoste: "Moins d'1 an", poids: 70, taille: 170, antecedents: [], aucunAntecedent: true, ...extra });
  const enCours = (db, clientId) => db.campaigns.find((k) => k.clientId === clientId && E.campaignStatus(k, NOW) === "EN_COURS");

  /* ---------- Score BSPA et IMC ---------- */
  test("Score · seuils du BSPA : tout au minimum / maximum, profils types vert, orange, rouge", () => {
    eq(E.scoreBspa(P.VERT).profil, "VERT", "profil type vert");
    eq(E.scoreBspa(P.ORANGE).profil, "ORANGE", "profil type orange");
    eq(E.scoreBspa(P.ROUGE).profil, "ROUGE", "profil type rouge");
    const best = [5, 5, 5, 5, 5, 0, 4, 4, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 0, 0, 0];
    const worst = [0, 0, 0, 0, 0, 4, 0, 0, 4, 6, 6, 6, 6, 6, 1, 1, 1, 1, 1, 2, 2, 2];
    const b = E.scoreBspa(best), w = E.scoreBspa(worst);
    eq([b.profil, b.scoreGlobal, b.signalFort], ["VERT", 0, false], "meilleures réponses");
    eq([w.profil, w.scoreGlobal, w.signalFort], ["ROUGE", 10, true], "pires réponses");
    ["A", "B", "C", "D", "E"].forEach((k) => { eq(Math.round(b.dims[k].s100), ["A", "D"].includes(k) ? 100 : 0, `dimension ${k} au mieux`); });
    const sig = best.slice(); sig[21] = 2;
    eq(E.scoreBspa(sig).profil, "ORANGE", "un seul signal fort sans dimension rouge ⇒ orange");
    throws(() => { try { E.scoreBspa([1, 2]); } catch (e) { e.business = true; throw e; } }, "22 réponses exigées");
  });
  test("Score · chaque bilan généré a le résultat recalculé à partir de ses réponses, scores entre 0 et 100", (db) => {
    db.responses.forEach((r) => {
      eq(r.result, E.scoreBspa(r.answers), `${r.pseudo} : résultat stocké ≠ calcul`);
      Object.values(r.result.dims).forEach((d) => assert(d.s100 >= 0 && d.s100 <= 100, `${r.pseudo} : score hors bornes`));
      assert(r.result.scoreGlobal >= 0 && r.result.scoreGlobal <= 10, `${r.pseudo} : score global hors bornes`);
    });
  });
  test("IMC · formule et bornes du référentiel (exemple 92 kg / 1,78 m = 29,0 Surpoids)", () => {
    eq(E.imc(92, 178), 29, "exemple de l'annexe");
    eq(E.imcCategorie(29).categorie, "Surpoids", "catégorie de l'exemple");
    const cases = [[15.9, "IMC-01"], [16, "IMC-02"], [16.9, "IMC-02"], [17, "IMC-03"], [18.4, "IMC-03"], [18.5, "IMC-04"], [24.9, "IMC-04"], [25, "IMC-05"], [29.9, "IMC-05"], [30, "IMC-06"], [34.9, "IMC-06"], [35, "IMC-07"], [39.9, "IMC-07"], [40, "IMC-08"], [60, "IMC-08"]];
    cases.forEach(([v, code]) => eq(E.imcCategorie(v).code, code, `IMC ${v}`));
    eq(E.imc(0, 170), null, "poids manquant");
    assert(E.imcMessage(18.4).includes("inférieur") && E.imcMessage(18.5).includes("zone de référence"), "messages");
  });

  /* ---------- Invariants des données ---------- */
  test("Invariant · bilan : consentement avant la fin, dans la période de campagne, téléphone, région du client, domaine e-mail", (db) => {
    db.responses.forEach((r) => {
      const k = E.campaignOf(db, r), c = E.clientOf(db, r);
      assert(r.consentAt <= r.completedAt && r.consentVersion, `${r.pseudo} : consentement`);
      assert(r.completedAt >= E.day(k.start) && r.completedAt < E.day(k.end) + D && r.completedAt <= NOW, `${r.pseudo} : hors période`);
      assert(E.isPhone(r.tel), `${r.pseudo} : téléphone`);
      assert(c.units.some((u) => u.id === r.unitId), `${r.pseudo} : région inconnue`);
      if (c.emailPro) { eq(E.domainOf(r.email), E.domainOf(c.emailPro), `${r.pseudo} : domaine`); }
      if (r.inviteeId) { const i = E.byId(db.invitees, r.inviteeId); assert(i.email === r.email && i.pseudo === r.pseudo && i.campaignId === r.campaignId, `${r.pseudo} : invité incohérent`); }
    });
  });
  test("Invariant · une seule réponse par adresse et par campagne", (db) => {
    const seen = new Set();
    db.responses.forEach((r) => { const k = r.campaignId + "|" + r.email; assert(!seen.has(k), `doublon ${r.pseudo}`); seen.add(k); });
  });
  test("Invariant · vert ⇒ aucune décision ni prise en charge ; rouge ⇒ aucune décision ; décisions datées entre fin du test et maintenant", (db) => {
    db.responses.forEach((r) => {
      const z = r.result.profil, s = E.careState(db, r, NOW);
      if (z === "VERT") { assert(!r.decisions.length && s.state === "NONE" && r.care.closedAt == null, `${r.pseudo} vert`); }
      if (z === "ROUGE") { assert(!r.decisions.length, `${r.pseudo} rouge décidé`); }
      r.decisions.forEach((d) => {
        assert(d.at >= r.completedAt && d.at <= NOW, `${r.pseudo} : date de décision`);
        if (d.revokedAt != null) { assert(d.revokedAt > d.at && d.revokedAt < E.deadlineOf(db, r) && E.byId(db.accounts, d.revokedBy).role === "SUP_SECONDAIRE", `${r.pseudo} : révocation invalide`); }
      });
    });
  });
  test("Invariant · Entreprise : rouge pris en charge dès la fin du test ; orange « oui » dès la décision ; jamais de délai", (db) => {
    db.responses.filter((r) => E.clientOf(db, r).type === "E").forEach((r) => {
      const s = E.careState(db, r, NOW);
      assert(!["PROVISIONAL", "SCHEDULED"].includes(s.state), `${r.pseudo} : délai sur une Entreprise`);
      if (r.result.profil === "ROUGE") { eq(s.since, r.completedAt, `${r.pseudo} : début de prise en charge`); }
      if (r.result.profil === "ORANGE" && ["ACTIVE", "CLOSED"].includes(s.state)) { eq(s.since, E.effectiveDecision(r, NOW).at, `${r.pseudo} : début = décision`); }
    });
  });
  test("Invariant · Mutuelle : délai figé à la fin du test ; décision prise pendant le délai appliquée à l'échéance, après le délai immédiatement", (db) => {
    db.responses.filter((r) => E.clientOf(db, r).type === "M").forEach((r) => {
      eq(r.delayDays, E.unitOf(db, r.clientId, r.unitId).delayDays, `${r.pseudo} : délai`);
      const s = E.careState(db, r, NOW), dl = E.deadlineOf(db, r);
      if (["ACTIVE", "CLOSED"].includes(s.state)) {
        const d = E.effectiveDecision(r, NOW);
        eq(s.since, r.result.profil === "ROUGE" ? dl : Math.max(d.at, dl), `${r.pseudo} : début de prise en charge`);
      }
      if (NOW < dl) { assert(!["ACTIVE", "CLOSED"].includes(s.state), `${r.pseudo} : pris en charge avant l'échéance`); }
    });
  });
  test("Invariant · clôtures : prise en charge close après son début ; entretien clos après la fin du test ; jamais dans le futur", (db) => {
    db.responses.forEach((r) => {
      const s = E.careState(db, r, NOW);
      if (r.care.closedAt != null) { assert(s.state === "CLOSED" && r.care.closedAt >= s.since && r.care.closedAt <= NOW, `${r.pseudo} : clôture de prise en charge`); }
      if (r.followUp.closedAt != null) { assert(r.followUp.closedAt >= r.completedAt && r.followUp.closedAt <= NOW, `${r.pseudo} : clôture d'entretien`); }
    });
  });
  test("Invariant · « Sans réponse » ⇒ ni score, ni statut de suivi, ni prise en charge ; relances avant maintenant", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    db.campaigns.forEach((k) => E.participantRows(db, admin, k.id, NOW).forEach((row) => {
      if (!row.responseId) { assert(row.statut === "Sans réponse" && row.zone === null && row.scoreGlobal === null && row.suivi === null && row.care === null, `${row.pseudo}`); }
      else { assert(["A_APPELER", "CLOS"].includes(row.suivi), `${row.pseudo} : statut de suivi manquant`); }
    }));
    db.invitees.forEach((i) => i.reminders.forEach((t) => assert(t <= NOW && !db.responses.some((r) => r.inviteeId === i.id && r.completedAt <= t), `${i.pseudo} : relance après réponse`)));
  });
  test("Invariant · affectation : chaque région a exactement un validateur et un superviseur secondaire ; un superviseur principal par client", (db) => {
    db.clients.forEach((c) => {
      eq(db.accounts.filter((a) => a.clientId === c.id && a.active && a.role === "SUP_PRINCIPAL").length, 1, `${c.nom} : superviseur principal`);
      if (c.type === "M") { E.coverage(db, c.id).forEach((x) => assert(x.validateurs.length === 1 && x.secondaires.length === 1, `${x.unit.nom} : couverture`)); }
      else { assert(!db.accounts.some((a) => a.clientId === c.id && !E.ROLES_BY_TYPE.E.includes(a.role)), `${c.nom} : rôle Mutuelle sur une Entreprise`); }
    });
  });
  test("Invariant · effectif daté : la campagne prend l'effectif enregistré à sa date de lancement", (db) => {
    const c = E.byId(db.clients, "C1");
    eq(E.effectifAt(c, E.day("2025-10-06")), 420, "campagne 2025");
    eq(E.effectifAt(c, E.day("2026-11-02")), 450, "campagne 2026");
    eq(E.effectifAt(c, E.day("2024-12-31")), null, "avant tout enregistrement");
  });
  test("Invariant · statut de campagne calculé par les dates (bornes incluses)", () => {
    const k = { start: "2026-11-02", end: "2026-12-11" };
    eq(E.campaignStatus(k, E.day("2026-11-01") + 23 * E.H), "A_VENIR", "veille");
    eq(E.campaignStatus(k, E.day("2026-11-02")), "EN_COURS", "premier jour");
    eq(E.campaignStatus(k, E.day("2026-12-11") + 23 * E.H), "EN_COURS", "dernier jour");
    eq(E.campaignStatus(k, E.day("2026-12-12")), "TERMINEE", "lendemain");
  });

  /* ---------- Règles de prise en charge (scénarios) ---------- */
  test("Scénario · Entreprise : l'Admin Yodan décide un orange ⇒ application immédiate, dans « À prendre en charge », décision non modifiable", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const r = E.validationQueue(db, admin, NOW)[0];
    assert(r, "au moins un cas orange Entreprise en attente");
    const before = E.careRows(db, admin, NOW).length;
    eq(E.decide(db, admin, r.id, true, NOW).state, "ACTIVE", "état après décision");
    eq(E.careRows(db, admin, NOW).length, before + 1, "liste À prendre en charge");
    assert(!E.validationQueue(db, admin, NOW).includes(r), "sort de la file");
    throws(() => E.decide(db, admin, r.id, false, NOW + E.H), "seconde décision refusée");
  });
  test("Scénario · Entreprise : un orange « non » ⇒ pas de prise en charge ; rouge ⇒ immédiat sans décision", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const r = E.validationQueue(db, admin, NOW)[0];
    eq(E.decide(db, admin, r.id, false, NOW).state, "NONE", "orange non");
    const k = enCours(db, "C1");
    const red = E.submitResponse(db, k.id, { ...profile("D2"), email: "nouveau.rouge@alpha.exemple.test", answers: P.ROUGE }, NOW);
    eq(E.careState(db, red, NOW), { state: "ACTIVE", since: NOW }, "rouge immédiat");
  });
  test("Scénario · Mutuelle : décision du validateur provisoire, révocation par le superviseur secondaire, application à l'échéance", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R1"), email: "cas.orange@mail.exemple.test", answers: P.ORANGE }, NOW);
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R1"));
    const sec = db.accounts.find((a) => a.role === "SUP_SECONDAIRE" && a.units.includes("R1"));
    const dl = E.deadlineOf(db, r);
    eq(dl, NOW + 7 * D, "délai de 7 jours (Abidjan Nord)");
    eq(E.careState(db, r, NOW).state, "PENDING", "en attente");
    eq(E.decide(db, val, r.id, true, NOW + D).state, "PROVISIONAL", "décision provisoire");
    assert(!E.careRows(db, acc(db, "ADMIN_YODAN"), NOW + D).some((x) => x.responseId === r.id), "pas encore dans À prendre en charge");
    throws(() => E.revoke(db, val, r.id, NOW + D), "le validateur ne peut pas révoquer");
    eq(E.revoke(db, sec, r.id, NOW + 2 * D).state, "PENDING", "révocation ⇒ en attente");
    eq(E.decide(db, sec, r.id, true, NOW + 3 * D).state, "PROVISIONAL", "le superviseur décide à la place");
    eq(E.careState(db, r, dl - 1).state, "PROVISIONAL", "juste avant l'échéance");
    eq(E.careState(db, r, dl), { state: "ACTIVE", since: dl }, "à l'échéance");
    throws(() => E.revoke(db, sec, r.id, dl + D), "révocation impossible après le délai");
  });
  test("Scénario · Mutuelle : sans décision ⇒ « délai dépassé de X jours » ; décision tardive appliquée immédiatement ; rouge automatique à l'échéance", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R5"), email: "cas.tardif@mail.exemple.test", answers: P.ORANGE }, NOW);
    const dl = E.deadlineOf(db, r);
    eq(dl, NOW + 10 * D, "délai réglé à 10 jours (Ouest)");
    eq(E.careState(db, r, dl + 3 * D + E.H).overdueDays, 3, "délai dépassé de 3 jours");
    assert(E.waitLabel(db, r, dl + 3 * D + E.H) === "délai dépassé de 3 jours", "libellé");
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R5"));
    eq(E.decide(db, val, r.id, true, dl + 4 * D), { state: "ACTIVE", since: dl + 4 * D }, "décision tardive immédiate");
    const red = E.submitResponse(db, k.id, { ...profile("R5"), email: "cas.rouge@mail.exemple.test", answers: P.ROUGE }, NOW);
    eq(E.careState(db, red, NOW + D).state, "SCHEDULED", "rouge pendant le délai");
    eq(E.careState(db, red, E.deadlineOf(db, red)).state, "ACTIVE", "rouge à l'échéance");
  });
  test("Scénario · un changement de délai ne modifie pas les cas déjà terminés", (db) => {
    const k = enCours(db, "C2"), adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R3"), email: "avant.changement@mail.exemple.test", answers: P.ORANGE }, NOW);
    E.setDelay(db, adminM, "C2", "R3", 3, NOW + E.H);
    eq(E.deadlineOf(db, r), NOW + 7 * D, "ancien délai conservé");
    const r2 = E.submitResponse(db, k.id, { ...profile("R3"), email: "apres.changement@mail.exemple.test", answers: P.ORANGE }, NOW + 2 * E.H);
    eq(E.deadlineOf(db, r2), NOW + 2 * E.H + 3 * D, "nouveau délai");
    throws(() => E.setDelay(db, adminM, "C2", "R3", 0, NOW), "délai de 0 jour refusé");
    throws(() => E.setDelay(db, acc(db, "SUP_PRINCIPAL", "C2"), "C2", "R3", 5, NOW), "superviseur principal non autorisé");
  });
  test("Scénario · statut de suivi et prise en charge indépendants (clore l'un ne touche pas l'autre)", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const row = E.careRows(db, admin, NOW).find((x) => x.state === "ACTIVE" && E.followUpState(E.byId(db.responses, x.responseId), NOW) === "A_APPELER");
    assert(row, "un cas actif à appeler");
    E.closeFollowUp(db, admin, row.responseId, NOW);
    const r = E.byId(db.responses, row.responseId);
    eq([E.followUpState(r, NOW), E.careState(db, r, NOW).state], ["CLOS", "ACTIVE"], "après clôture de l'entretien");
    E.closeCare(db, admin, r.id, NOW + E.H);
    eq(E.careState(db, r, NOW + E.H).state, "CLOSED", "après clôture de la prise en charge");
    throws(() => E.closeCare(db, admin, r.id, NOW + 2 * E.H), "double clôture refusée");
  });

  /* ---------- Parcours participant ---------- */
  test("Parcours · un bilan terminé met à jour tableau de bord, participants, suivi et prise en charge, sans doublon", (db) => {
    const k = enCours(db, "C1"), admin = acc(db, "ADMIN_YODAN"), sp = acc(db, "SUP_PRINCIPAL", "C1");
    const f = { campaignId: k.id, clientId: "C1" };
    const d0 = E.dashboard(db, admin, f, NOW), rows0 = E.participantRows(db, admin, k.id, NOW).length, care0 = E.careRows(db, admin, NOW).length;
    const inv = db.invitees.find((i) => i.campaignId === k.id && !db.responses.some((r) => r.inviteeId === i.id));
    const r = E.submitResponse(db, k.id, { ...profile(inv.unitId), email: inv.email.toUpperCase(), answers: P.ROUGE }, NOW + E.H);
    const T = NOW + 2 * E.H;
    const d1 = E.dashboard(db, admin, f, T);
    eq([d1.kpis.bilans, d1.kpis.ROUGE, d1.participation.repondu], [d0.kpis.bilans + 1, d0.kpis.ROUGE + 1, d0.participation.repondu + 1], "tableau de bord");
    eq(E.participantRows(db, admin, k.id, T).length, rows0, "même nombre de lignes : l'invité passe de « Sans réponse » à répondu");
    eq(r.inviteeId, inv.id, "rattaché à la liste");
    eq(E.followUpState(r, T), "A_APPELER", "à appeler");
    eq(E.careRows(db, admin, T).length, care0 + 1, "À prendre en charge");
    throws(() => E.submitResponse(db, k.id, { ...profile(inv.unitId), email: inv.email, answers: P.VERT }, T), "seconde réponse refusée");
    eq(E.dashboard(db, sp, f, T).kpis.bilans, d1.kpis.bilans, "même total pour le superviseur principal");
  });
  test("Parcours · hors liste accepté si bon domaine ; refus : mauvais domaine, campagne à venir ou terminée, client désactivé, consentement manquant", (db) => {
    const k = enCours(db, "C1");
    assert(E.checkParticipantAccess(db, k, "inconnu@alpha.exemple.test", NOW).ok, "hors liste, bon domaine");
    assert(!E.checkParticipantAccess(db, k, "x@autre.exemple.test", NOW).ok, "mauvais domaine");
    assert(E.checkParticipantAccess(db, enCours(db, "C2"), "x@nimportequoi.test", NOW).ok, "mutuelle sans e-mail pro : ouvert");
    assert(!E.checkParticipantAccess(db, db.campaigns.find((x) => x.clientId === "C3"), "a@gamma.exemple.test", NOW).ok, "à venir");
    assert(!E.checkParticipantAccess(db, db.campaigns.find((x) => x.nom === "Bilan annuel 2025"), "a@alpha.exemple.test", NOW).ok, "terminée");
    const kd = db.campaigns.find((x) => x.clientId === "C4"); kd.end = "2027-01-01";
    assert(!E.checkParticipantAccess(db, kd, "a@delta.exemple.test", NOW).ok, "client désactivé");
    throws(() => E.submitResponse(db, k.id, { ...profile("D1", { consentContact: false }), email: "sans.accord@alpha.exemple.test", answers: P.VERT }, NOW), "sans accord pour l'entretien");
    throws(() => E.submitResponse(db, k.id, { ...profile("D1", { tel: "" }), email: "sans.tel@alpha.exemple.test", answers: P.VERT }, NOW), "sans téléphone");
    throws(() => E.submitResponse(db, k.id, { ...profile("D1", { poids: 10 }), email: "poids@alpha.exemple.test", answers: P.VERT }, NOW), "poids hors bornes");
    throws(() => E.submitResponse(db, k.id, { ...profile("D1"), email: "incomplet@alpha.exemple.test", answers: P.VERT.slice(0, 21) }, NOW), "test incomplet");
  });
  test("Parcours · questionnaire général : cas limites (Aucun + antécédent, région d'un autre client)", (db) => {
    const k = enCours(db, "C1");
    assert(E.profileErrors(db, k, profile("D1", { antecedents: ["Maladie chronique"], aucunAntecedent: true })).length, "Aucun + antécédent refusé");
    assert(E.profileErrors(db, k, profile("D1", { antecedents: [], aucunAntecedent: false })).length, "rien coché refusé");
    assert(E.profileErrors(db, k, profile("R1")).length, "région d'une autre organisation refusée");
    eq(E.profileErrors(db, k, profile("D1", { poids: 30, taille: 230 })), [], "valeurs aux bornes acceptées");
  });

  /* ---------- Tableaux de bord ---------- */
  test("Cohérence · chiffres clés = anneau = groupes = comparaison = participation = export", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    db.campaigns.filter((k) => db.responses.some((r) => r.campaignId === k.id)).forEach((k) => {
      const d = E.dashboard(db, admin, { clientId: k.clientId, campaignId: k.id }, NOW), K = d.kpis;
      eq(K.VERT + K.ORANGE + K.ROUGE, K.bilans, `${k.nom} : parties du total`);
      eq(d.participation.repondu, K.bilans, `${k.nom} : participation`);
      d.groups.filter((g) => !g.multi).forEach((g) => eq(g.rows.reduce((s, r) => s + r.total, 0), K.bilans, `${k.nom} : groupe ${g.label}`));
      const cmp = d.comparison.find((x) => x.campaignId === k.id);
      eq([cmp.bilans, cmp.VERT, cmp.ORANGE, cmp.ROUGE], [K.bilans, K.VERT, K.ORANGE, K.ROUGE], `${k.nom} : comparaison`);
      eq(cmp.bienEtre, d.dims.find((x) => x.key === "A").moyenne, `${k.nom} : bien-être moyen`);
      const csv = E.dashboardCsv(d);
      assert(csv.includes(`Bilans terminés;${K.bilans}`) && csv.includes(`À prendre en charge;${K.ROUGE}`), `${k.nom} : export`);
    });
  });
  test("Cohérence · filtre par direction/région : la somme des régions = le total", (db) => {
    const sp = acc(db, "SUP_PRINCIPAL", "C2"), admin = acc(db, "ADMIN_YODAN");
    const k = enCours(db, "C2"), all = E.dashboard(db, admin, { clientId: "C2", campaignId: k.id }, NOW).kpis.bilans;
    const sum = E.byId(db.clients, "C2").units.reduce((s, u) => s + E.dashboard(db, admin, { clientId: "C2", campaignId: k.id, unitId: u.id }, NOW).kpis.bilans, 0);
    eq(sum, all, "somme des régions");
    assert(E.dashboard(db, sp, { campaignId: k.id }, NOW).kpis.bilans === all, "superviseur principal : même total");
  });
  test("Anonymat · côté client, groupe de 1 à 4 réponses masqué, jamais une seule ligne masquée seule ; pas de seuil pour l'Admin Yodan", (db) => {
    const sp = acc(db, "SUP_PRINCIPAL", "C1"), admin = acc(db, "ADMIN_YODAN");
    let sawMask = false;
    db.campaigns.filter((k) => k.clientId === "C1").forEach((k) => ["", ...E.byId(db.clients, "C1").units.map((u) => u.id)].forEach((unitId) => {
      const d = E.dashboard(db, sp, { campaignId: k.id, unitId }, NOW);
      if (d.masked) { assert(d.kpis === undefined && d.groups === undefined, "sélection masquée sans chiffres"); return; }
      d.groups.forEach((g) => {
        g.rows.forEach((r) => { if (r.masked) { sawMask = true; assert(r.total === null && r.ROUGE === null, `${g.label} : valeur exposée`); } else { assert(r.total === 0 || r.total >= 5, `${g.label} ${r.label} : ${r.total} réponses affichées`); } });
        if (!g.multi) { assert(g.rows.filter((r) => r.masked).length !== 1, `${g.label} : une seule ligne masquée, retrouvable par soustraction`); }
      });
      d.comparison.forEach((c) => assert(c.masked || c.bilans >= 5, `${c.nom} : comparaison sous le seuil`));
      const da = E.dashboard(db, admin, { clientId: "C1", campaignId: k.id, unitId }, NOW);
      da.groups.forEach((g) => g.rows.forEach((r) => assert(!r.masked, "masquage appliqué à l'Admin Yodan")));
    }));
    assert(sawMask, "le jeu fictif doit contenir au moins un groupe masqué (sinon la règle n'est pas testée)");
  });
  test("Anonymat · une sélection de moins de 5 réponses masque tout le tableau de bord (ex. filtre Population)", (db) => {
    const sp = acc(db, "SUP_PRINCIPAL", "C1");
    const k = enCours(db, "C1");
    const d = E.dashboard(db, sp, { campaignId: k.id, unitId: "D5" }, NOW);
    const n = db.responses.filter((r) => r.campaignId === k.id && r.unitId === "D5").length;
    eq(d.masked, n < 5, `Finances : ${n} réponses`);
    const d2 = E.dashboard(db, sp, { campaignId: k.id, popKey: "antecedents", popValue: "Handicap psychique" }, NOW);
    const n2 = db.responses.filter((r) => r.campaignId === k.id && r.antecedents.includes("Handicap psychique")).length;
    eq(d2.masked, n2 < 5, `population : ${n2} réponses`);
  });
  test("Visibilité · le tableau de bord d'un superviseur ne contient aucune donnée individuelle", (db) => {
    ["C1", "C2"].forEach((cid) => {
      const sp = acc(db, "SUP_PRINCIPAL", cid);
      const json = JSON.stringify(E.dashboard(db, sp, {}, NOW)) + JSON.stringify(E.dashboard(db, sp, { campaignId: enCours(db, cid).id }, NOW));
      db.responses.filter((r) => r.clientId === cid).forEach((r) => assert(!json.includes(r.email) && !json.includes(r.pseudo) && !json.includes(r.tel), `fuite de ${r.pseudo}`));
    });
  });
  test("Visibilité · superviseur secondaire : uniquement ses régions, refus d'une autre région, pas d'effectif client", (db) => {
    const sec = acc(db, "SUP_SECONDAIRE", "C2"), admin = acc(db, "ADMIN_YODAN");
    eq(E.allowedUnits(db, sec, "C2"), sec.units, "régions autorisées");
    const other = E.byId(db.clients, "C2").units.find((u) => !sec.units.includes(u.id));
    eq(E.dashboard(db, sec, { unitId: other.id }, NOW), null, "autre région refusée");
    const k = enCours(db, "C2"), mine = E.dashboard(db, sec, { campaignId: k.id }, NOW);
    const expected = sec.units.reduce((s, u) => s + E.dashboard(db, admin, { clientId: "C2", campaignId: k.id, unitId: u }, NOW).kpis.bilans, 0);
    eq(mine.kpis.bilans, expected, "total = ses régions");
    eq(mine.participation.effectif, null, "effectif client masqué");
  });
  test("Visibilité · écrans par rôle : participants, historique et prises en charge réservés ; superviseur principal = tableau de bord seul", (db) => {
    const roles = ["ADMIN_YODAN", "SUP_PRINCIPAL", "ADMIN_MUTUELLE", "SUP_SECONDAIRE", "VALIDATEUR"];
    const m = (screen) => roles.filter((r) => E.canAccess({ role: r }, screen));
    eq(m("participants"), ["ADMIN_YODAN"], "participants");
    eq(m("care"), ["ADMIN_YODAN"], "à prendre en charge");
    eq(m("clients"), ["ADMIN_YODAN"], "clients");
    eq(m("dashboard"), ["SUP_PRINCIPAL", "SUP_SECONDAIRE"], "tableau de bord client");
    eq(m("validation"), ["ADMIN_YODAN", "SUP_SECONDAIRE", "VALIDATEUR"], "validation");
    eq(m("history"), ["ADMIN_YODAN", "ADMIN_MUTUELLE"], "historique");
    const sp = acc(db, "SUP_PRINCIPAL", "C2");
    eq(E.participantRows(db, sp, enCours(db, "C2").id, NOW), [], "aucune ligne nominative pour le superviseur principal");
    eq(E.careRows(db, sp, NOW), [], "aucune prise en charge pour le superviseur principal");
  });
  test("Visibilité · résultats individuels : validateur = oranges en attente de ses régions ; superviseur principal et administrateur = jamais", (db) => {
    const val = acc(db, "VALIDATEUR", "C2"), sec = acc(db, "SUP_SECONDAIRE", "C2");
    db.responses.forEach((r) => {
      ["SUP_PRINCIPAL", "ADMIN_MUTUELLE"].forEach((role) => db.accounts.filter((a) => a.role === role).forEach((a) => assert(!E.canSeeResponse(db, a, r, NOW), `${role} voit ${r.pseudo}`)));
      const s = E.careState(db, r, NOW).state;
      eq(E.canSeeResponse(db, val, r, NOW), r.clientId === "C2" && val.units.includes(r.unitId) && r.result.profil === "ORANGE" && s === "PENDING", `validateur / ${r.pseudo}`);
      if (E.canSeeResponse(db, sec, r, NOW)) { assert(sec.units.includes(r.unitId) && r.result.profil === "ORANGE" && ["PENDING", "PROVISIONAL"].includes(s), `secondaire / ${r.pseudo}`); }
    });
    E.validationQueue(db, acc(db, "ADMIN_YODAN"), NOW).forEach((r) => eq(E.clientOf(db, r).type, "E", "l'Admin Yodan ne valide que des Entreprises"));
  });
  test("Droits · décisions : Admin Yodan refusé sur une Mutuelle, validateur refusé hors de ses régions, superviseur principal refusé", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R6"), email: "droits@mail.exemple.test", answers: P.ORANGE }, NOW);
    throws(() => E.decide(db, acc(db, "ADMIN_YODAN"), r.id, true, NOW), "Admin Yodan sur Mutuelle");
    throws(() => E.decide(db, db.accounts.find((a) => a.role === "VALIDATEUR" && !a.units.includes("R6")), r.id, true, NOW), "validateur d'une autre région");
    throws(() => E.decide(db, acc(db, "SUP_PRINCIPAL", "C2"), r.id, true, NOW), "superviseur principal");
    const vert = db.responses.find((x) => x.result.profil === "VERT");
    throws(() => E.decide(db, acc(db, "ADMIN_YODAN"), vert.id, true, NOW), "décision sur un vert");
  });

  /* ---------- Comptes ---------- */
  test("Comptes · règles d'affectation : région déjà couverte, second superviseur principal, rôle indisponible, Administrateur limité", (db) => {
    const admin = acc(db, "ADMIN_YODAN"), adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const base = { clientId: "C2", nom: "Nouveau compte", email: "nouveau@beta.exemple.test" };
    assert(E.accountErrors(db, adminM, { ...base, role: "VALIDATEUR", units: ["R1"] }).some((e) => e.includes("Abidjan Nord")), "région déjà couverte");
    assert(E.accountErrors(db, adminM, { ...base, role: "VALIDATEUR", units: [] }).length, "validateur sans région");
    assert(E.accountErrors(db, admin, { ...base, role: "SUP_PRINCIPAL" }).length, "second superviseur principal");
    assert(E.accountErrors(db, admin, { ...base, clientId: "C1", role: "VALIDATEUR", units: ["D1"] }).length, "validateur sur une Entreprise");
    assert(E.accountErrors(db, adminM, { ...base, role: "ADMIN_MUTUELLE" }).length, "l'Administrateur ne crée pas d'Administrateur");
    assert(E.accountErrors(db, adminM, { ...base, clientId: "C1", role: "SUP_PRINCIPAL" }).length, "l'Administrateur ne gère pas un autre client");
    assert(E.accountErrors(db, admin, { ...base, email: "admin@yodan.exemple.test", role: "SUP_SECONDAIRE", units: ["R1"] }).length, "e-mail déjà utilisé");
    const v = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R1"));
    E.setAccountActive(db, adminM, v.id, false, NOW);
    eq(E.accountErrors(db, adminM, { ...base, role: "VALIDATEUR", units: ["R1"] }), [], "région libérée après désactivation");
    const created = E.saveAccount(db, adminM, { ...base, role: "VALIDATEUR", units: ["R1", "R2"] }, NOW);
    assert(created.mustChange && created.active, "mot de passe temporaire à changer");
    throws(() => E.setAccountActive(db, adminM, v.id, true, NOW), "réactivation refusée : région reprise");
  });
  test("Comptes · actions de Yodan pour un client marquées « pour le compte du client » ; celles de l'Administrateur non", (db) => {
    const admin = acc(db, "ADMIN_YODAN"), adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const sec = acc(db, "SUP_SECONDAIRE", "C2");
    E.resendPassword(db, admin, sec.id, NOW);
    E.resendPassword(db, adminM, sec.id, NOW);
    const last = db.log.slice(-2);
    eq(last.map((e) => e.onBehalf), [true, false], "mention");
  });

  /* ---------- Journal ---------- */
  test("Historique · aucune donnée de santé : champs fixes, pas de score, de couleur, de niveau, d'IMC ni de valeur de décision", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R1"), email: "journal@mail.exemple.test", answers: P.ROUGE }, NOW);
    const forbidden = /score|risque|vigilance|satisfaisant|rouge|orange|vert|imc|antéc|poids|taille|\boui\b|\bnon\b|stress|épuis|bien-être|signal/i;
    db.log.forEach((e) => {
      eq(Object.keys(e).sort(), ["action", "actorId", "at", "clientId", "id", "onBehalf", "target"], `${e.id} : champs`);
      const target = db.campaigns.some((k) => k.nom === e.target) ? "" : e.target; /* nom de campagne choisi par Yodan, pas une donnée de santé */
      assert(!forbidden.test(e.action + " " + target), `${e.id} : « ${e.action} ${e.target} »`);
    });
    assert(db.log.some((e) => e.target === r.pseudo), "le bilan est tracé par pseudonyme");
  });
  test("Historique · l'Administrateur d'une mutuelle ne voit que sa mutuelle ; les autres rôles ne voient rien", (db) => {
    const adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const h = E.historyFor(db, adminM);
    assert(h.length > 0 && h.every((e) => e.clientId === "C2"), "périmètre");
    eq(E.historyFor(db, acc(db, "SUP_PRINCIPAL", "C2")), [], "superviseur principal");
    eq(E.historyFor(db, acc(db, "ADMIN_YODAN")).length, db.log.length, "Admin Yodan voit tout");
  });

  /* ---------- Saisie ---------- */
  test("Import · liste de campagne : téléphone obligatoire, domaine, région connue, doublons ; en-tête ignoré", (db) => {
    const txt = ["nom;prénom;e-mail;téléphone;direction", "Kouassi;Awa;awa.k@alpha.exemple.test;07 00 11 22 33;Production", "Traoré;Yao;yao@autre.exemple.test;07 00 11 22 34;Production",
      "Bamba;Mariam;mariam@alpha.exemple.test;;Production", "Diallo;Serge;serge@alpha.exemple.test;07 00 11 22 35;Marketing", "Aka;Esther;awa.k@alpha.exemple.test;07 00 11 22 36;Finances"].join("\n");
    const p = E.parseInviteeList(db, "C1", txt);
    eq(p.rows.length, 1, "une seule ligne valide");
    eq(p.errors.length, 4, "quatre erreurs");
    assert(p.errors[0].startsWith("Ligne 3") && /domaine|alpha/.test(p.errors[0]), "erreur de domaine numérotée");
    throws(() => E.createCampaign(db, acc(db, "ADMIN_YODAN"), { clientId: "C1", nom: "Test", test: "BSPA", start: "2026-12-01", end: "2026-11-01", liste: txt }, NOW), "dates inversées et liste invalide refusées");
  });
  test("Fiche client · champs obligatoires, doublon de direction, e-mail du compte principal unique", (db) => {
    const ok = { nom: "Epsilon (fictif)", type: "E", effectif: 10, secteur: "J", tests: ["BSPA"], units: ["A", "B"], compteNom: "Test", compteEmail: "test@epsilon.exemple.test" };
    eq(E.clientErrors(db, ok), [], "fiche valide");
    assert(E.clientErrors(db, { ...ok, units: ["A", "a"] }).length, "doublon");
    assert(E.clientErrors(db, { ...ok, secteur: "Z" }).length, "secteur hors liste");
    assert(E.clientErrors(db, { ...ok, effectif: 0 }).length, "effectif nul");
    assert(E.clientErrors(db, { ...ok, compteEmail: "admin@yodan.exemple.test" }).length, "e-mail déjà pris");
    assert(E.clientErrors(db, { ...ok, logo: "x", logoSize: 3e6 }).length, "logo > 2 Mo");
    eq(E.SECTEURS.length, 21, "21 secteurs CIAP");
  });
  test("Thème · texte lisible sur la couleur choisie et liens lisibles sur blanc (contraste ≥ 4,5)", () => {
    ["#296DA8", "#ffff00", "#ffffff", "#000000", "#0F766E", "#6D28D9", "#f2a541", "#88ccff", "nimportequoi"].forEach((c) => {
      const t = E.theme(c);
      assert(E.contrast(t.primary, t.onPrimary) >= 4.5, `${c} : texte sur fond ${E.contrast(t.primary, t.onPrimary).toFixed(2)}`);
      assert(E.contrast(t.ink, "#ffffff") >= 4.5, `${c} : lien sur blanc`);
    });
  });

  /* ---------- Interface ---------- */
  test("Interface · chaque compte actif ouvre son espace sans erreur et sans débordement horizontal en mobile", () => {
    const A = window.APP, S = A.S;
    const saved = { accountId: S.accountId, mode: S.mode, screen: S.screen, params: S.params, device: S.device, logLen: S.db.log.length };
    const stage = document.getElementById("stage");
    const wasMobile = stage.classList.contains("is-mobile");
    try {
      stage.classList.add("is-mobile"); S.device = "mobile";
      S.db.accounts.filter((a) => a.active && !a.mustChange && (!a.clientId || E.byId(S.db.clients, a.clientId).active)).forEach((a) => {
        A.loginAs(a.id);
        const app = document.getElementById("app");
        assert(app.querySelector("h1"), `${a.email} : pas de titre`);
        assert(app.scrollWidth <= app.clientWidth + 2, `${a.email} : débordement de ${app.scrollWidth - app.clientWidth} px`);
      });
    } finally {
      stage.classList.toggle("is-mobile", wasMobile);
      Object.assign(S, { accountId: saved.accountId, mode: saved.mode, device: saved.device });
      S.db.log.length = saved.logLen;
      if (saved.mode === "app") { S.screen = saved.screen; S.params = saved.params; }
      A.render();
    }
  });

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.err}`);
  console.groupCollapsed(`Tests de cohérence : ${ok} OK / ${failed.length} KO`);
  results.forEach((r) => (r.ok ? console.log("✅", r.name) : console.error("❌", r.name, "—", r.err)));
  console.groupEnd();
  return { ok, ko: failed.length, failed };
}
window.runTests = runTests;
