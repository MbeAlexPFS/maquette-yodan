/*
 * Tests de cohérence (règles métier) — CLAUDE.md § 9. Maquette v1.5.
 * Lancement : ouvrir index.html?tests=1 (console + encadré du panneau Notes UX),
 * ou `agent-browser eval "JSON.stringify(runTests())"`.
 * Chaque test travaille sur un jeu de données neuf (E.generate()) : l'interface n'est pas modifiée.
 * Une fois la maquette validée, ces noms de règles deviennent les tests PHPUnit du projet.
 */
"use strict";

function runTests() {
  const E = window.EM, D = E.D, H = E.H, NOW = E.NOW0;
  const results = [];
  const test = (name, fn) => { try { fn(E.generate()); results.push({ name, ok: true }); } catch (err) { results.push({ name, ok: false, err: err.message }); } };
  const assert = (cond, msg) => { if (!cond) { throw new Error(msg); } };
  const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)})`);
  const throws = (fn, msg) => { let ok = false; try { fn(); } catch (e) { ok = !!e.business; } assert(ok, msg); };
  const acc = (db, role, clientId) => db.accounts.find((a) => a.role === role && (clientId === undefined || a.clientId === clientId));
  const P = window.APP.PRESETS;
  const profile = (unitId, extra = {}) => ({ consentDonnees: true, consentContact: true, consentAvis: true, nom: "Exemple", prenom: "Camille", tel: "07 00 99 88 77", unitId, genre: "Femme", age: "26-35 ans", ancEnt: "1 à 5 ans", ancPoste: "Moins d'1 an", poids: 70, taille: 170, antecedents: [], aucunAntecedent: true, ...extra });
  const enCours = (db, clientId) => db.campaigns.find((k) => k.clientId === clientId && E.campaignStatus(k, NOW) === "EN_COURS");
  const psyOf = (db, r) => E.campaignOf(db, r).psychologueIds.map((id) => E.byId(db.accounts, id)).find((p) => p.active);
  const PDF = { name: "rapport-entretien.pdf", size: 120 * 1024, type: "application/pdf" };
  const AVIS_OUI = { risque: "CONFIRME", reco: true, type: "SUIVI", urgence: "STANDARD", commentaire: "Accord de principe." };
  /** Entretien complet par le psychologue de la campagne : rapport + avis validé à la date `at`. */
  const interview = (db, r, at, avis = AVIS_OUI) => {
    const psy = psyOf(db, r);
    E.saveReport(db, psy, r.id, PDF, at);
    E.saveAvis(db, psy, r.id, { date: E.isoDate(at), ...avis }, at);
    return E.validateAvis(db, psy, r.id, at);
  };

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
      eq(r.consentAvis, c.type === "M" ? true : null, `${r.pseudo} : consentement à la transmission de l'avis (Mutuelle)`);
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
  test("Invariant · entretien : avis validé ⇒ rapport présent, champs fermés valides, auteur = psychologue de la campagne, dates cohérentes", (db) => {
    db.responses.forEach((r) => {
      const a = r.interview.avis, rep = r.interview.report, k = E.campaignOf(db, r);
      if (rep) { assert(k.psychologueIds.includes(rep.by) && rep.savedAt >= r.completedAt && rep.savedAt <= NOW, `${r.pseudo} : rapport`); }
      if (!a) { return; }
      assert(k.psychologueIds.includes(a.by), `${r.pseudo} : auteur de l'avis hors campagne`);
      if (a.validatedAt != null) {
        assert(a.validatedAt >= r.completedAt && a.validatedAt <= NOW && a.savedAt <= a.validatedAt, `${r.pseudo} : dates de validation`);
        eq(E.avisErrors(db, r, a, a.validatedAt), [], `${r.pseudo} : avis validé invalide`);
        assert(E.day(a.date) <= a.validatedAt, `${r.pseudo} : entretien après la validation`);
      }
    });
  });
  test("Invariant · aucune décision ni prise en charge sans avis validé ; décisions datées entre la validation de l'avis et maintenant", (db) => {
    db.responses.forEach((r) => {
      const z = r.result.profil, s = E.careState(db, r, NOW), va = E.avisValidatedAt(r, NOW);
      if (z === "VERT") { assert(!r.decisions.length && s.state === "NONE" && r.care.closedAt == null, `${r.pseudo} vert`); }
      if (z === "ROUGE") { assert(!r.decisions.length, `${r.pseudo} rouge décidé`); }
      if (va == null) { assert(!r.decisions.length && ["NONE", "INTERVIEW"].includes(s.state), `${r.pseudo} : décision ou prise en charge sans avis`); }
      if (["ACTIVE", "CLOSED"].includes(s.state)) { assert(s.since >= va, `${r.pseudo} : prise en charge avant l'avis`); }
      r.decisions.forEach((d) => {
        assert(d.at >= va && d.at <= NOW, `${r.pseudo} : date de décision`);
        if (d.revokedAt != null) { assert(d.revokedAt > d.at && d.revokedAt < E.deadlineOf(db, r) && E.byId(db.accounts, d.revokedBy).role === "SUP_SECONDAIRE", `${r.pseudo} : révocation invalide`); }
      });
    });
  });
  test("Invariant · Entreprise : rouge pris en charge dès l'avis ; orange « oui » dès la décision ; jamais de délai", (db) => {
    db.responses.filter((r) => E.clientOf(db, r).type === "E").forEach((r) => {
      const s = E.careState(db, r, NOW);
      assert(!["PROVISIONAL", "SCHEDULED"].includes(s.state), `${r.pseudo} : délai sur une Entreprise`);
      eq(E.deadlineOf(db, r, NOW), null, `${r.pseudo} : échéance sur une Entreprise`);
      if (r.result.profil === "ROUGE" && s.state !== "INTERVIEW") { eq(s.since, E.avisValidatedAt(r, NOW), `${r.pseudo} : début de prise en charge`); }
      if (r.result.profil === "ORANGE" && ["ACTIVE", "CLOSED"].includes(s.state)) { eq(s.since, E.effectiveDecision(r, NOW).at, `${r.pseudo} : début = décision`); }
    });
  });
  test("Invariant · Mutuelle : délai démarré à la validation de l'avis ; décision du niveau 1/2 appliquée à l'échéance ; décision Yodan immédiate", (db) => {
    db.responses.filter((r) => E.clientOf(db, r).type === "M").forEach((r) => {
      eq(r.delayDays, E.unitOf(db, r.clientId, r.unitId).delayDays, `${r.pseudo} : délai`);
      const s = E.careState(db, r, NOW), va = E.avisValidatedAt(r, NOW), dl = E.deadlineOf(db, r, NOW);
      eq(dl, va == null ? null : va + r.delayDays * D, `${r.pseudo} : échéance = avis + délai`);
      if (["ACTIVE", "CLOSED"].includes(s.state)) {
        const d = E.effectiveDecision(r, NOW);
        const expected = r.result.profil === "ROUGE" ? dl : d.role === "ADMIN_YODAN" ? d.at : Math.max(d.at, dl);
        eq(s.since, expected, `${r.pseudo} : début de prise en charge`);
      }
      if (va != null && NOW < dl && !E.yodanDecision(r, NOW)) { assert(!["ACTIVE", "CLOSED"].includes(s.state), `${r.pseudo} : pris en charge avant l'échéance`); }
    });
  });
  test("Invariant · clôtures : prise en charge close après son début, jamais dans le futur", (db) => {
    db.responses.forEach((r) => {
      const s = E.careState(db, r, NOW);
      if (r.care.closedAt != null) { assert(s.state === "CLOSED" && r.care.closedAt >= s.since && r.care.closedAt <= NOW, `${r.pseudo} : clôture de prise en charge`); }
    });
  });
  test("Invariant · « Sans réponse » ⇒ ni score, ni entretien, ni prise en charge ; relances avant maintenant", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    db.campaigns.forEach((k) => E.participantRows(db, admin, k.id, NOW).forEach((row) => {
      if (!row.responseId) { assert(row.statut === "Sans réponse" && row.zone === null && row.scoreGlobal === null && row.entretien === null && row.care === null, `${row.pseudo}`); }
      else { assert(Object.keys(E.INTERVIEW).includes(row.entretien), `${row.pseudo} : statut d'entretien manquant`); }
    }));
    db.invitees.forEach((i) => i.reminders.forEach((t) => assert(t <= NOW && !db.responses.some((r) => r.inviteeId === i.id && r.completedAt <= t), `${i.pseudo} : relance après réponse`)));
  });
  test("Invariant · affectation : chaque région a exactement un médecin-conseil et un superviseur secondaire ; un superviseur principal par client", (db) => {
    db.clients.forEach((c) => {
      eq(db.accounts.filter((a) => a.clientId === c.id && a.active && a.role === "SUP_PRINCIPAL").length, 1, `${c.nom} : superviseur principal`);
      if (c.type === "M") { E.coverage(db, c.id).forEach((x) => assert(x.validateurs.length === 1 && x.secondaires.length === 1, `${x.unit.nom} : couverture`)); }
      else { assert(!db.accounts.some((a) => a.clientId === c.id && !E.ROLES_BY_TYPE.E.includes(a.role)), `${c.nom} : rôle Mutuelle sur une Entreprise`); }
    });
    db.accounts.filter((a) => a.role === "PSYCHOLOGUE").forEach((p) => assert(p.clientId === null, `${p.email} : psychologue rattaché à un client`));
  });
  test("Invariant · campagnes : psychologues attribués = comptes psychologues ; campagne sans psychologue ⇒ aucun entretien commencé", (db) => {
    db.campaigns.forEach((k) => {
      k.psychologueIds.forEach((id) => eq(E.byId(db.accounts, id).role, "PSYCHOLOGUE", `${k.nom} : attribution`));
      if (!k.psychologueIds.length) { db.responses.filter((r) => r.campaignId === k.id).forEach((r) => eq(E.interviewState(r, NOW), "A_FAIRE", `${r.pseudo}`)); }
    });
    assert(db.campaigns.some((k) => !k.psychologueIds.length && E.byId(db.accounts, k.createdBy).role === "ASSISTANTE_SOCIALE"), "le jeu fictif contient une campagne de l'assistante sociale à attribuer");
  });
  test("Invariant · effectif daté : la campagne prend l'effectif enregistré à sa date de lancement", (db) => {
    const c = E.byId(db.clients, "C1");
    eq(E.effectifAt(c, E.day("2025-10-06")), 420, "campagne 2025");
    eq(E.effectifAt(c, E.day("2026-11-02")), 450, "campagne 2026");
    eq(E.effectifAt(c, E.day("2024-12-31")), null, "avant tout enregistrement");
  });
  test("Invariant · statut de campagne calculé par les dates (bornes incluses)", () => {
    const k = { start: "2026-11-02", end: "2026-12-11" };
    eq(E.campaignStatus(k, E.day("2026-11-01") + 23 * H), "A_VENIR", "veille");
    eq(E.campaignStatus(k, E.day("2026-11-02")), "EN_COURS", "premier jour");
    eq(E.campaignStatus(k, E.day("2026-12-11") + 23 * H), "EN_COURS", "dernier jour");
    eq(E.campaignStatus(k, E.day("2026-12-12")), "TERMINEE", "lendemain");
  });

  /* ---------- Circuit entretien → avis → décision ---------- */
  test("Verrou · avant l'avis validé : « entretien en attente », décision refusée à tous (Admin Yodan, médecin-conseil), délai non démarré", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R1"), email: "verrou@mail.exemple.test", answers: P.ORANGE }, NOW);
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R1"));
    eq(E.careState(db, r, NOW + 20 * D).state, "INTERVIEW", "en attente d'entretien, même 20 jours après");
    eq(E.deadlineOf(db, r, NOW + 20 * D), null, "le délai ne court pas");
    throws(() => E.decide(db, val, r.id, true, NOW + D), "médecin-conseil refusé");
    throws(() => E.decide(db, acc(db, "ADMIN_YODAN"), r.id, true, NOW + D), "Admin Yodan refusé");
    assert(!E.canSeeResponse(db, val, r, NOW + D), "dossier non ouvert au médecin-conseil");
    assert(E.validationQueue(db, val, NOW + D).includes(r), "mais visible dans sa file (boutons grisés)");
    const psy = psyOf(db, r);
    E.saveReport(db, psy, r.id, PDF, NOW + 2 * D);
    E.saveAvis(db, psy, r.id, { date: E.isoDate(NOW + 2 * D), ...AVIS_OUI }, NOW + 2 * D);
    eq(E.careState(db, r, NOW + 2 * D).state, "INTERVIEW", "un brouillon n'ouvre pas la décision");
    eq(E.interviewView(db, val, r, NOW + 2 * D).avis, null, "brouillon invisible du médecin-conseil");
    eq(E.validateAvis(db, psy, r.id, NOW + 3 * D).state, "PENDING", "avis validé ⇒ décision ouverte");
    eq(E.deadlineOf(db, r, NOW + 3 * D), NOW + 3 * D + 7 * D, "délai démarré à la validation");
  });
  test("Scénario · Entreprise : l'Admin Yodan décide un orange ⇒ application immédiate, dans « À prendre en charge », décision non modifiable", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const r = E.validationQueue(db, admin, NOW).find((x) => E.clientOf(db, x).type === "E" && E.careState(db, x, NOW).state === "PENDING");
    assert(r, "au moins un cas orange Entreprise en décision ouverte");
    const before = E.careRows(db, admin, NOW).length;
    eq(E.decide(db, admin, r.id, true, NOW).state, "ACTIVE", "état après décision");
    eq(E.careRows(db, admin, NOW).length, before + 1, "liste À prendre en charge");
    assert(!E.validationQueue(db, admin, NOW).includes(r), "sort de la file");
    throws(() => E.decide(db, admin, r.id, false, NOW + H), "seconde décision refusée");
  });
  test("Scénario · Entreprise : orange « non » ⇒ pas de prise en charge ; rouge ⇒ pris en charge à la validation de l'avis, sans décision", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const r = E.validationQueue(db, admin, NOW).find((x) => E.careState(db, x, NOW).state === "PENDING" && E.clientOf(db, x).type === "E");
    eq(E.decide(db, admin, r.id, false, NOW).state, "NONE", "orange non");
    const k = enCours(db, "C1");
    const red = E.submitResponse(db, k.id, { ...profile("D2"), email: "nouveau.rouge@alpha.exemple.test", answers: P.ROUGE }, NOW);
    eq(E.careState(db, red, NOW).state, "INTERVIEW", "rouge : pas de prise en charge avant l'avis");
    interview(db, red, NOW + D);
    eq(E.careState(db, red, NOW + D), { state: "ACTIVE", since: NOW + D }, "rouge à la validation de l'avis");
  });
  test("Scénario · Mutuelle : médecin-conseil (niveau 1) provisoire, annulation par le superviseur secondaire (niveau 2), application à l'échéance", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R1"), email: "cas.orange@mail.exemple.test", answers: P.ORANGE }, NOW);
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R1"));
    const sec = db.accounts.find((a) => a.role === "SUP_SECONDAIRE" && a.units.includes("R1"));
    const T0 = NOW + D;
    interview(db, r, T0);
    const dl = E.deadlineOf(db, r, T0);
    eq(dl, T0 + 7 * D, "délai de 7 jours (Abidjan Nord) à partir de l'avis");
    eq(E.careState(db, r, T0).state, "PENDING", "décision ouverte");
    eq(E.decide(db, val, r.id, true, T0 + D).state, "PROVISIONAL", "décision provisoire");
    assert(!E.careRows(db, acc(db, "ADMIN_YODAN"), T0 + D).some((x) => x.responseId === r.id), "pas encore dans À prendre en charge");
    throws(() => E.revoke(db, val, r.id, T0 + D), "le médecin-conseil ne peut pas révoquer");
    eq(E.revoke(db, sec, r.id, T0 + 2 * D).state, "PENDING", "annulation ⇒ décision ouverte");
    eq(E.decide(db, sec, r.id, true, T0 + 3 * D).state, "PROVISIONAL", "le niveau 2 décide à la place");
    eq(E.careState(db, r, dl - 1).state, "PROVISIONAL", "juste avant l'échéance");
    eq(E.careState(db, r, dl), { state: "ACTIVE", since: dl }, "à l'échéance");
    throws(() => E.revoke(db, sec, r.id, dl + D), "annulation impossible après le délai");
  });
  test("Scénario · Mutuelle : sans décision ⇒ « délai dépassé de X jours » ; décision tardive immédiate ; rouge automatique à l'échéance", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R5"), email: "cas.tardif@mail.exemple.test", answers: P.ORANGE }, NOW);
    interview(db, r, NOW + 2 * D);
    const dl = E.deadlineOf(db, r, NOW + 2 * D);
    eq(dl, NOW + 12 * D, "délai de 10 jours (Ouest) après l'avis");
    eq(E.careState(db, r, dl + 3 * D + H).overdueDays, 3, "délai dépassé de 3 jours");
    assert(E.waitLabel(db, r, dl + 3 * D + H) === "délai dépassé de 3 jours", "libellé");
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R5"));
    eq(E.decide(db, val, r.id, true, dl + 4 * D), { state: "ACTIVE", since: dl + 4 * D }, "décision tardive immédiate");
    const red = E.submitResponse(db, k.id, { ...profile("R5"), email: "cas.rouge@mail.exemple.test", answers: P.ROUGE }, NOW);
    interview(db, red, NOW + D);
    eq(E.careState(db, red, NOW + 2 * D).state, "SCHEDULED", "rouge pendant le délai");
    eq(E.careState(db, red, E.deadlineOf(db, red, NOW + D)).state, "ACTIVE", "rouge à l'échéance");
  });
  test("Scénario · Mutuelle : l'Admin Yodan décide à la place de la mutuelle ⇒ immédiat, définitif, « validée par YODAN », niveaux 1 et 2 bloqués", (db) => {
    const k = enCours(db, "C2"), admin = acc(db, "ADMIN_YODAN");
    const r = E.submitResponse(db, k.id, { ...profile("R2"), email: "yodan.decide@mail.exemple.test", answers: P.ORANGE }, NOW);
    interview(db, r, NOW + H);
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes("R2"));
    const sec = db.accounts.find((a) => a.role === "SUP_SECONDAIRE" && a.units.includes("R2"));
    assert(E.validationQueue(db, admin, NOW + H).includes(r), "dans la file de l'Admin Yodan");
    eq(E.decide(db, admin, r.id, true, NOW + 2 * H), { state: "ACTIVE", since: NOW + 2 * H }, "pris en charge immédiatement, sans attendre le délai");
    throws(() => E.decide(db, val, r.id, false, NOW + 3 * H), "médecin-conseil bloqué");
    throws(() => E.decide(db, sec, r.id, false, NOW + 3 * H), "superviseur secondaire bloqué");
    throws(() => E.revoke(db, sec, r.id, NOW + 3 * H), "pas d'annulation");
    assert(E.validationQueue(db, val, NOW + 3 * H).includes(r), "affiché au médecin-conseil comme décidé par Yodan");
    assert(E.yodanDecision(r, NOW + 3 * H), "décision marquée Yodan");
    assert(db.log.slice(-1)[0].onBehalf, "journal : pour le compte du client");
  });
  test("Scénario · un changement de délai ne modifie pas les cas déjà terminés", (db) => {
    const k = enCours(db, "C2"), adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R3"), email: "avant.changement@mail.exemple.test", answers: P.ORANGE }, NOW);
    E.setDelay(db, adminM, "C2", "R3", 3, NOW + H);
    interview(db, r, NOW + D);
    eq(E.deadlineOf(db, r, NOW + D), NOW + D + 7 * D, "ancienne durée conservée");
    const r2 = E.submitResponse(db, k.id, { ...profile("R3"), email: "apres.changement@mail.exemple.test", answers: P.ORANGE }, NOW + 2 * H);
    interview(db, r2, NOW + D);
    eq(E.deadlineOf(db, r2, NOW + D), NOW + D + 3 * D, "nouvelle durée");
    throws(() => E.setDelay(db, adminM, "C2", "R3", 0, NOW), "délai de 0 jour refusé");
    throws(() => E.setDelay(db, acc(db, "SUP_PRINCIPAL", "C2"), "C2", "R3", 5, NOW), "superviseur principal non autorisé");
  });
  test("Scénario · clôture de la prise en charge par l'Admin Yodan ; double clôture refusée", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const row = E.careRows(db, admin, NOW).find((x) => x.state === "ACTIVE");
    E.closeCare(db, admin, row.responseId, NOW);
    eq(E.careState(db, E.byId(db.responses, row.responseId), NOW).state, "CLOSED", "close");
    throws(() => E.closeCare(db, admin, row.responseId, NOW + H), "double clôture refusée");
  });

  /* ---------- Avis du psychologue ---------- */
  test("Avis · validation refusée : sans rapport, champs manquants, « oui » sans type ni urgence, « non » avec type, date hors bornes, commentaire trop long", (db) => {
    const k = enCours(db, "C1");
    const r = E.submitResponse(db, k.id, { ...profile("D1"), email: "avis.erreurs@alpha.exemple.test", answers: P.ORANGE }, NOW);
    const psy = psyOf(db, r), today = E.isoDate(NOW);
    const err = (a) => E.avisErrors(db, r, a, NOW);
    assert(err({ date: today, ...AVIS_OUI }).some((x) => x.includes("rapport")), "rapport PDF exigé");
    E.saveReport(db, psy, r.id, PDF, NOW);
    eq(err({ date: today, ...AVIS_OUI }), [], "avis complet accepté");
    assert(err({ date: today, risque: "", reco: true, type: "SUIVI", urgence: "STANDARD" }).length, "risque manquant");
    assert(err({ date: today, risque: "CONFIRME", reco: null }).length, "recommandation manquante");
    assert(err({ date: today, risque: "CONFIRME", reco: true, type: "", urgence: "" }).length === 2, "oui sans type ni urgence");
    assert(err({ date: today, risque: "INFIRME", reco: false, type: "SUIVI", urgence: "" }).length, "non avec type");
    eq(err({ date: today, risque: "INFIRME", reco: false, type: "", urgence: "" }), [], "non sans type accepté");
    assert(err({ date: "2026-01-01", ...AVIS_OUI }).length, "entretien avant le test");
    assert(err({ date: E.isoDate(NOW + 3 * D), ...AVIS_OUI }).length, "entretien dans le futur");
    assert(err({ date: today, ...AVIS_OUI, commentaire: "x".repeat(301) }).length, "commentaire > 300");
    eq(err({ date: today, ...AVIS_OUI, commentaire: "x".repeat(300) }), [], "commentaire de 300 accepté");
    throws(() => E.validateAvis(db, psy, r.id, NOW), "validation sans avis enregistré refusée");
  });
  test("Avis · une fois validé il est verrouillé ; le rapport reste chez Yodan ; le journal n'en contient pas le contenu", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R1"), email: "avis.verrou@mail.exemple.test", answers: P.ORANGE }, NOW);
    interview(db, r, NOW + H, { ...AVIS_OUI, commentaire: "Commentaire témoin unique" });
    const psy = psyOf(db, r);
    throws(() => E.saveAvis(db, psy, r.id, { date: E.isoDate(NOW), ...AVIS_OUI, reco: false }, NOW + 2 * H), "modification refusée");
    throws(() => E.validateAvis(db, psy, r.id, NOW + 2 * H), "double validation refusée");
    const log = JSON.stringify(db.log);
    assert(!log.includes("Commentaire témoin unique"), "contenu de l'avis ou du rapport dans le journal");
  });

  /* ---------- Parcours participant ---------- */
  test("Parcours · un bilan terminé met à jour tableau de bord, participants et entretien ; prise en charge seulement après l'avis ; sans doublon", (db) => {
    const k = enCours(db, "C1"), admin = acc(db, "ADMIN_YODAN"), sp = acc(db, "SUP_PRINCIPAL", "C1");
    const f = { campaignId: k.id, clientId: "C1" };
    const d0 = E.dashboard(db, admin, f, NOW), rows0 = E.participantRows(db, admin, k.id, NOW).length;
    const inv = db.invitees.find((i) => i.campaignId === k.id && !db.responses.some((r) => r.inviteeId === i.id));
    const r = E.submitResponse(db, k.id, { ...profile(inv.unitId), email: inv.email.toUpperCase(), answers: P.ROUGE }, NOW + H);
    const T = NOW + 2 * H;
    const d1 = E.dashboard(db, admin, f, T);
    eq([d1.kpis.bilans, d1.kpis.ROUGE, d1.participation.repondu], [d0.kpis.bilans + 1, d0.kpis.ROUGE + 1, d0.participation.repondu + 1], "tableau de bord");
    eq(E.participantRows(db, admin, k.id, T).length, rows0, "même nombre de lignes : l'invité passe de « Sans réponse » à répondu");
    eq(r.inviteeId, inv.id, "rattaché à la liste");
    eq(E.interviewState(r, T), "A_FAIRE", "entretien à faire");
    assert(E.psyRows(db, psyOf(db, r), T).some((x) => x.responseId === r.id), "dans la liste du psychologue");
    assert(!E.careRows(db, admin, T).some((x) => x.responseId === r.id), "pas encore à prendre en charge");
    interview(db, r, T + H);
    eq(E.careRows(db, admin, T + H).filter((x) => x.responseId === r.id).length, 1, "À prendre en charge après l'avis, une seule fois");
    throws(() => E.submitResponse(db, k.id, { ...profile(inv.unitId), email: inv.email, answers: P.VERT }, T), "seconde réponse refusée");
    eq(E.dashboard(db, sp, f, T).kpis.bilans, d1.kpis.bilans, "même total pour le superviseur principal");
  });
  test("Parcours · consentements : transmission de l'avis obligatoire pour une Mutuelle, pas demandée pour une Entreprise", (db) => {
    const kM = enCours(db, "C2"), kE = enCours(db, "C1");
    throws(() => E.submitResponse(db, kM.id, { ...profile("R1", { consentAvis: false }), email: "sans.transmission@mail.exemple.test", answers: P.VERT }, NOW), "Mutuelle sans 3e consentement refusée");
    const rE = E.submitResponse(db, kE.id, { ...profile("D1", { consentAvis: false }), email: "entreprise@alpha.exemple.test", answers: P.VERT }, NOW);
    eq(rE.consentAvis, null, "Entreprise : sans objet");
    const rM = E.submitResponse(db, kM.id, { ...profile("R1"), email: "avec.transmission@mail.exemple.test", answers: P.VERT }, NOW);
    eq([rM.consentAvis, rM.consentVersion], [true, window.EM_TEXTES.consentement.version], "Mutuelle : accord et version enregistrés");
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
  test("Cohérence · psychologue : les compteurs « à faire / en cours / validés » = la liste filtrée = l'onglet Admin", (db) => {
    db.accounts.filter((a) => a.role === "PSYCHOLOGUE" && a.active).forEach((p) => {
      const all = E.psyRows(db, p, NOW);
      eq(Object.keys(E.INTERVIEW).reduce((s, st) => s + E.psyRows(db, p, NOW, { state: st }).length, 0), all.length, `${p.nom} : somme des statuts`);
      eq(E.psychologueStats(db, p.id, NOW).campagnes, db.campaigns.filter((k) => k.psychologueIds.includes(p.id)).length, `${p.nom} : campagnes`);
    });
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

  /* ---------- Visibilité par rôle ---------- */
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
  test("Visibilité · écrans par rôle (psychologue, assistante sociale inclus)", (db) => {
    const roles = ["ADMIN_YODAN", "PSYCHOLOGUE", "SUP_PRINCIPAL", "ADMIN_MUTUELLE", "ASSISTANTE_SOCIALE", "SUP_SECONDAIRE", "VALIDATEUR"];
    const m = (screen) => roles.filter((r) => E.canAccess({ role: r }, screen));
    eq(m("participants"), ["ADMIN_YODAN"], "participants");
    eq(m("care"), ["ADMIN_YODAN"], "à prendre en charge");
    eq(m("clients"), ["ADMIN_YODAN"], "clients");
    eq(m("psychologues"), ["ADMIN_YODAN"], "onglet Psychologues");
    eq(m("interviews"), ["PSYCHOLOGUE"], "entretiens");
    eq(m("campaignForm"), ["ADMIN_YODAN", "ASSISTANTE_SOCIALE", "VALIDATEUR"], "création de campagne");
    eq(m("campaigns"), ["ADMIN_YODAN", "ASSISTANTE_SOCIALE", "VALIDATEUR"], "liste des campagnes");
    eq(m("campaign"), ["ADMIN_YODAN"], "détail de campagne (participants nominatifs)");
    eq(m("dashboard"), ["SUP_PRINCIPAL", "SUP_SECONDAIRE"], "tableau de bord client");
    eq(m("validation"), ["ADMIN_YODAN", "SUP_SECONDAIRE", "VALIDATEUR"], "validation");
    eq(m("detail"), ["ADMIN_YODAN", "SUP_SECONDAIRE", "VALIDATEUR"], "dossier individuel");
    eq(m("history"), ["ADMIN_YODAN", "ADMIN_MUTUELLE"], "historique");
    const sp = acc(db, "SUP_PRINCIPAL", "C2");
    eq(E.participantRows(db, sp, enCours(db, "C2").id, NOW), [], "aucune ligne nominative pour le superviseur principal");
    eq(E.careRows(db, sp, NOW), [], "aucune prise en charge pour le superviseur principal");
  });
  test("Visibilité · résultats individuels : médecin-conseil = oranges en décision ouverte de ses régions ; superviseur principal, administrateur, assistante sociale = jamais", (db) => {
    const val = acc(db, "VALIDATEUR", "C2"), sec = acc(db, "SUP_SECONDAIRE", "C2");
    db.responses.forEach((r) => {
      ["SUP_PRINCIPAL", "ADMIN_MUTUELLE", "ASSISTANTE_SOCIALE"].forEach((role) => db.accounts.filter((a) => a.role === role).forEach((a) => {
        assert(!E.canSeeResponse(db, a, r, NOW), `${role} voit ${r.pseudo}`);
        eq(E.interviewView(db, a, r, NOW).avis, null, `${role} voit l'avis de ${r.pseudo}`);
      }));
      const s = E.careState(db, r, NOW).state;
      eq(E.canSeeResponse(db, val, r, NOW), r.clientId === "C2" && val.units.includes(r.unitId) && r.result.profil === "ORANGE" && s === "PENDING", `médecin-conseil / ${r.pseudo}`);
      if (E.canSeeResponse(db, sec, r, NOW)) { assert(sec.units.includes(r.unitId) && r.result.profil === "ORANGE" && ["PENDING", "PROVISIONAL"].includes(s), `secondaire / ${r.pseudo}`); }
    });
    E.validationQueue(db, acc(db, "ADMIN_YODAN"), NOW).forEach((r) => assert(["PENDING", "INTERVIEW"].includes(E.careState(db, r, NOW).state), "file Admin : à traiter seulement"));
    assert(E.validationQueue(db, acc(db, "ADMIN_YODAN"), NOW).some((r) => E.clientOf(db, r).type === "M"), "l'Admin Yodan voit aussi les Mutuelles");
  });
  test("Visibilité · rapport d'entretien : psychologue de la campagne et Admin Yodan seulement ; médecin-conseil et superviseur secondaire = avis seul", (db) => {
    const r = db.responses.find((x) => x.clientId === "C2" && x.result.profil === "ORANGE" && E.interviewState(x, NOW) === "VALIDE");
    const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes(r.unitId));
    const sec = db.accounts.find((a) => a.role === "SUP_SECONDAIRE" && a.units.includes(r.unitId));
    const psy = psyOf(db, r), other = db.accounts.find((a) => a.role === "PSYCHOLOGUE" && a.active && !E.campaignOf(db, r).psychologueIds.includes(a.id));
    [val, sec].forEach((a) => { const V = E.interviewView(db, a, r, NOW); assert(V.avis && V.report === null && !V.canSeeReport, `${a.role} : avis seul`); });
    const VA = E.interviewView(db, acc(db, "ADMIN_YODAN"), r, NOW);
    assert(VA.avis && VA.report, "Admin Yodan : rapport + avis");
    const VP = E.interviewView(db, psy, r, NOW);
    assert(VP.avis && VP.report, "psychologue de la campagne : rapport + avis");
    if (other) { eq(E.interviewView(db, other, r, NOW).report, null, "psychologue d'une autre campagne : rien"); assert(!E.canSeeResponse(db, other, r, NOW), "dossier refusé"); }
  });
  test("Visibilité · la liste du psychologue est sous pseudonyme, sans nom, e-mail ni téléphone, limitée à ses campagnes", (db) => {
    db.accounts.filter((a) => a.role === "PSYCHOLOGUE" && a.active).forEach((p) => {
      const rows = E.psyRows(db, p, NOW), json = JSON.stringify(rows);
      rows.forEach((x) => {
        const r = E.byId(db.responses, x.responseId);
        assert(E.campaignOf(db, r).psychologueIds.includes(p.id), `${p.nom} : ${r.pseudo} hors de ses campagnes`);
        assert(!json.includes(r.email) && !json.includes(r.tel) && !json.includes(`"${r.nom}"`), `${p.nom} : coordonnées de ${r.pseudo}`);
      });
    });
  });
  test("Droits · décisions : médecin-conseil refusé hors de ses régions ; superviseur principal, assistante sociale et psychologue refusés ; vert refusé", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R6"), email: "droits@mail.exemple.test", answers: P.ORANGE }, NOW);
    interview(db, r, NOW + H);
    throws(() => E.decide(db, db.accounts.find((a) => a.role === "VALIDATEUR" && !a.units.includes("R6")), r.id, true, NOW + H), "médecin-conseil d'une autre région");
    ["SUP_PRINCIPAL", "ASSISTANTE_SOCIALE", "ADMIN_MUTUELLE"].forEach((role) => throws(() => E.decide(db, acc(db, role, "C2"), r.id, true, NOW + H), role));
    throws(() => E.decide(db, psyOf(db, r), r.id, true, NOW + H), "le psychologue ne décide pas");
    const vert = db.responses.find((x) => x.result.profil === "VERT");
    throws(() => E.decide(db, acc(db, "ADMIN_YODAN"), vert.id, true, NOW), "décision sur un vert");
  });
  test("Droits · seul un psychologue attribué et actif dépose le rapport (PDF, 10 Mo max.) et rédige l'avis", (db) => {
    const r = db.responses.find((x) => x.clientId === "C1" && E.interviewState(x, NOW) === "A_FAIRE" && E.campaignOf(db, x).psychologueIds.length);
    assert(r, "un entretien à faire");
    const other = db.accounts.find((a) => a.role === "PSYCHOLOGUE" && a.active && !E.campaignOf(db, r).psychologueIds.includes(a.id));
    if (other) { throws(() => E.saveReport(db, other, r.id, PDF, NOW), "psychologue non attribué"); }
    throws(() => E.saveReport(db, acc(db, "ADMIN_YODAN"), r.id, PDF, NOW), "l'Admin Yodan ne dépose pas");
    throws(() => E.saveReport(db, acc(db, "VALIDATEUR", "C2"), r.id, PDF, NOW), "le médecin-conseil ne dépose pas");
    const psy = psyOf(db, r);
    throws(() => E.saveReport(db, psy, r.id, null, NOW), "aucun fichier refusé");
    throws(() => E.saveReport(db, psy, r.id, { name: "rapport.docx", size: 1000, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, NOW), "Word refusé");
    throws(() => E.saveReport(db, psy, r.id, { name: "rapport.pdf", size: 1000, type: "image/png" }, NOW), "faux PDF (type) refusé");
    throws(() => E.saveReport(db, psy, r.id, { ...PDF, size: 0 }, NOW), "fichier vide refusé");
    throws(() => E.saveReport(db, psy, r.id, { ...PDF, size: E.REPORT_MAX + 1 }, NOW), "> 10 Mo refusé");
    eq(E.saveReport(db, psy, r.id, { ...PDF, size: E.REPORT_MAX }, NOW).version, 1, "10 Mo accepté");
    eq(E.saveReport(db, psy, r.id, { ...PDF, name: "RAPPORT-V2.PDF" }, NOW + H).version, 2, "remplacement = version 2");
    eq(E.interviewState(r, NOW + H), "BROUILLON", "rapport déposé ⇒ rapport en cours");
  });

  /* ---------- Psychologues et campagnes ---------- */
  test("Psychologues · création (nom + e-mail, invitation), e-mail unique, désactivation : plus d'accès, rapports conservés, plus proposé ; réactivation", (db) => {
    const admin = acc(db, "ADMIN_YODAN");
    const p = E.createPsychologue(db, admin, { nom: "Nouvelle Psychologue", email: "Nouvelle.Psy@yodan.exemple.test" }, NOW);
    assert(p.role === "PSYCHOLOGUE" && p.clientId === null && p.mustChange && p.email === "nouvelle.psy@yodan.exemple.test", "compte créé avec invitation");
    throws(() => E.createPsychologue(db, admin, { nom: "Doublon", email: "psy.ndri@yodan.exemple.test" }, NOW), "e-mail déjà utilisé");
    throws(() => E.createPsychologue(db, admin, { nom: "", email: "x@yodan.exemple.test" }, NOW), "nom obligatoire");
    throws(() => E.createPsychologue(db, acc(db, "ADMIN_MUTUELLE", "C2"), { nom: "X", email: "y@yodan.exemple.test" }, NOW), "réservé à l'Admin Yodan");
    const psy = db.accounts.find((a) => a.email === "psy.ndri@yodan.exemple.test");
    const kept = db.responses.filter((r) => r.interview.report && r.interview.report.by === psy.id).length;
    assert(kept > 0 && E.psyRows(db, psy, NOW).length > 0, "le psychologue a des dossiers");
    throws(() => E.setAccountActive(db, acc(db, "ADMIN_MUTUELLE", "C2"), psy.id, false, NOW), "désactivation réservée à l'Admin Yodan");
    E.setAccountActive(db, admin, psy.id, false, NOW);
    eq(E.psyRows(db, psy, NOW), [], "plus d'accès aux dossiers");
    eq(db.responses.filter((r) => r.interview.report && r.interview.report.by === psy.id).length, kept, "rapports conservés");
    throws(() => E.setCampaignPsychologues(db, admin, enCours(db, "C1").id, [psy.id], NOW), "plus proposé à l'attribution");
    E.setAccountActive(db, admin, psy.id, true, NOW + H);
    assert(E.psyRows(db, psy, NOW + H).length > 0, "réactivé");
  });
  test("Campagnes · Admin Yodan : au moins un psychologue actif ; assistante sociale et médecin-conseil : leur mutuelle, sans psychologue ; attribution réservée à Yodan", (db) => {
    const admin = acc(db, "ADMIN_YODAN"), as = acc(db, "ASSISTANTE_SOCIALE", "C2");
    const psy = db.accounts.find((a) => a.role === "PSYCHOLOGUE" && a.active);
    const base = { nom: "Campagne test", test: "BSPA", start: "2026-12-01", end: "2026-12-20", liste: "nom;prénom;e-mail;téléphone;région\nKouassi;Awa;awa.k@mail.exemple.test;07 00 11 22 33;Centre" };
    throws(() => E.createCampaign(db, admin, { ...base, clientId: "C2", psychologueIds: [] }, NOW), "Admin sans psychologue");
    const inactive = db.accounts.find((a) => a.role === "PSYCHOLOGUE" && !a.active);
    throws(() => E.createCampaign(db, admin, { ...base, clientId: "C2", psychologueIds: [inactive.id] }, NOW), "psychologue désactivé");
    const k1 = E.createCampaign(db, admin, { ...base, clientId: "C2", psychologueIds: [psy.id, psy.id] }, NOW);
    eq(k1.psychologueIds, [psy.id], "doublon ignoré");
    const k2 = E.createCampaign(db, as, { ...base, nom: "Campagne AS", clientId: "C2" }, NOW);
    eq([k2.psychologueIds, k2.createdBy], [[], as.id], "assistante sociale : à attribuer");
    throws(() => E.createCampaign(db, as, { ...base, clientId: "C2", psychologueIds: [psy.id] }, NOW), "l'assistante sociale n'attribue pas");
    throws(() => E.createCampaign(db, as, { ...base, clientId: "C1", liste: "Kouassi;Awa;awa@alpha.exemple.test;07 00 11 22 33;Production" }, NOW), "autre client refusé");
    const med = acc(db, "VALIDATEUR", "C2");
    const k3 = E.createCampaign(db, med, { ...base, nom: "Campagne médecin-conseil", clientId: "C2" }, NOW);
    eq([k3.psychologueIds, k3.createdBy], [[], med.id], "médecin-conseil (niveau 1) : campagne de sa mutuelle, à attribuer");
    throws(() => E.createCampaign(db, med, { ...base, clientId: "C2", psychologueIds: [psy.id] }, NOW), "le médecin-conseil n'attribue pas");
    throws(() => E.createCampaign(db, med, { ...base, clientId: "C1", liste: "Kouassi;Awa;awa@alpha.exemple.test;07 00 11 22 33;Production" }, NOW), "médecin-conseil : autre client refusé");
    throws(() => E.createCampaign(db, acc(db, "SUP_SECONDAIRE", "C2"), { ...base, clientId: "C2" }, NOW), "le superviseur secondaire ne crée pas de campagne");
    throws(() => E.setCampaignPsychologues(db, as, k2.id, [psy.id], NOW), "attribution par l'assistante sociale refusée");
    throws(() => E.setCampaignPsychologues(db, admin, k2.id, [], NOW), "attribution vide refusée");
    E.setCampaignPsychologues(db, admin, k2.id, [psy.id], NOW);
    eq(k2.psychologueIds, [psy.id], "attribution par Yodan");
  });

  /* ---------- Comptes ---------- */
  test("Comptes · règles d'affectation : région déjà couverte, second superviseur principal, rôle indisponible, Administrateur limité", (db) => {
    const admin = acc(db, "ADMIN_YODAN"), adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const base = { clientId: "C2", nom: "Nouveau compte", email: "nouveau@beta.exemple.test" };
    assert(E.accountErrors(db, adminM, { ...base, role: "VALIDATEUR", units: ["R1"] }).some((e) => e.includes("Abidjan Nord")), "région déjà couverte");
    assert(E.accountErrors(db, adminM, { ...base, role: "VALIDATEUR", units: [] }).length, "médecin-conseil sans région");
    assert(E.accountErrors(db, admin, { ...base, role: "SUP_PRINCIPAL" }).length, "second superviseur principal");
    assert(E.accountErrors(db, admin, { ...base, clientId: "C1", role: "VALIDATEUR", units: ["D1"] }).length, "médecin-conseil sur une Entreprise");
    assert(E.accountErrors(db, admin, { ...base, clientId: "C1", role: "ASSISTANTE_SOCIALE" }).length, "assistante sociale sur une Entreprise");
    eq(E.accountErrors(db, adminM, { ...base, role: "ASSISTANTE_SOCIALE" }), [], "l'Administrateur crée une assistante sociale");
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
    eq(db.log.slice(-2).map((e) => e.onBehalf), [true, false], "mention");
  });

  /* ---------- Journal ---------- */
  test("Historique · aucune donnée de santé : champs fixes, pas de score, de couleur, de niveau, d'IMC, de recommandation ni de valeur de décision", (db) => {
    const k = enCours(db, "C2");
    const r = E.submitResponse(db, k.id, { ...profile("R1"), email: "journal@mail.exemple.test", answers: P.ROUGE }, NOW);
    interview(db, r, NOW + H);
    const forbidden = /score|risque|vigilance|satisfaisant|rouge|orange|vert|imc|antéc|poids|taille|\boui\b|\bnon\b|stress|épuis|bien-être|signal|recommand|urgen|prioritaire|confirm|nuanc|infirm|soutien|orientation|suivi/i;
    db.log.forEach((e) => {
      eq(Object.keys(e).sort(), ["action", "actorId", "at", "clientId", "id", "onBehalf", "target"], `${e.id} : champs`);
      const target = db.campaigns.some((x) => x.nom === e.target) ? "" : e.target; /* nom de campagne choisi par Yodan, pas une donnée de santé */
      assert(!forbidden.test(e.action + " " + target), `${e.id} : « ${e.action} ${e.target} »`);
    });
    assert(db.log.some((e) => e.target === r.pseudo && e.action === "Avis du psychologue validé"), "la validation de l'avis est tracée par pseudonyme");
  });
  test("Historique · l'Administrateur d'une mutuelle ne voit que sa mutuelle ; les autres rôles ne voient rien", (db) => {
    const adminM = acc(db, "ADMIN_MUTUELLE", "C2");
    const h = E.historyFor(db, adminM);
    assert(h.length > 0 && h.every((e) => e.clientId === "C2"), "périmètre");
    ["SUP_PRINCIPAL", "ASSISTANTE_SOCIALE"].forEach((role) => eq(E.historyFor(db, acc(db, role, "C2")), [], role));
    eq(E.historyFor(db, acc(db, "PSYCHOLOGUE")), [], "psychologue");
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
    throws(() => E.createCampaign(db, acc(db, "ADMIN_YODAN"), { clientId: "C1", nom: "Test", test: "BSPA", start: "2026-12-01", end: "2026-11-01", liste: txt, psychologueIds: [acc(db, "PSYCHOLOGUE").id] }, NOW), "dates inversées et liste invalide refusées");
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
  test("Interface · chaque compte actif ouvre son espace sans erreur et sans débordement horizontal en mobile ; fiche d'entretien et validation aussi", () => {
    const A = window.APP, S = A.S;
    const saved = { accountId: S.accountId, mode: S.mode, screen: S.screen, params: S.params, device: S.device, logLen: S.db.log.length, ui: { ...S.ui } };
    const stage = document.getElementById("stage");
    const wasMobile = stage.classList.contains("is-mobile");
    const app = document.getElementById("app");
    const check = (label) => {
      assert(app.querySelector("h1"), `${label} : pas de titre`);
      assert(app.scrollWidth <= app.clientWidth + 2, `${label} : débordement de ${app.scrollWidth - app.clientWidth} px`);
    };
    try {
      stage.classList.add("is-mobile"); S.device = "mobile";
      S.db.accounts.filter((a) => a.active && !a.mustChange && (!a.clientId || E.byId(S.db.clients, a.clientId).active)).forEach((a) => {
        A.loginAs(a.id); check(a.email);
        if (a.role === "PSYCHOLOGUE") { const row = E.psyRows(S.db, a, S.now)[0]; if (row) { A.go("interview", { responseId: row.responseId }); check(`${a.email} / fiche d'entretien`); } }
        if (a.role === "ADMIN_YODAN") { A.go("psychologues"); check("onglet Psychologues"); }
      });
    } finally {
      stage.classList.toggle("is-mobile", wasMobile);
      Object.assign(S, { accountId: saved.accountId, mode: saved.mode, device: saved.device, ui: saved.ui });
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
