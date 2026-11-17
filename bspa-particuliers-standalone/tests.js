/*
 * Tests de cohérence (règles métier) — CLAUDE.md §9.
 * Lancement : ouvrir index.html?tests=1 (résultat dans la console + encadré du panneau Notes UX),
 * ou `agent-browser eval "runTests()"`.
 * Une fois la maquette validée, ces noms de règles deviennent les tests Pytest du projet.
 */
"use strict";

function runTests() {
  const results = [];
  const snapshot = JSON.stringify(db), companiesSnap = JSON.stringify(COMPANIES), sessionSnap = session.accountId;
  const restore = () => {
    const s = JSON.parse(snapshot);
    Object.keys(s).forEach((k) => (db[k] = s[k]));
    COMPANIES.splice(0, COMPANIES.length, ...JSON.parse(companiesSnap));
    session.accountId = sessionSnap;
  };
  const test = (name, fn) => {
    try { fn(); results.push({ name, ok: true }); }
    catch (err) { results.push({ name, ok: false, err: err.message }); }
    finally { restore(); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
  const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)})`);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const fullAnswers = (v) => Object.fromEntries(ITEM_KEYS.map((k) => {
    const s = SECTIONS.find((x) => x.key === k[0]), it = s.items[Number(k.slice(1))];
    return [k, v === "min" ? it.o[0][0] : v === "max" ? it.o[it.o.length - 1][0] : it.o[Math.floor(it.o.length / 2)][0]];
  }));
  const DEMO = { genre: "Femme", tranche_age: "26-35 ans", anciennete: "1 à 5 ans" };
  const openCamp = () => db.campaigns.find((c) => campaignState(c) === "EN_COURS");

  /* ---------- Invariants des données ---------- */
  test("Invariant · un bilan terminé a des réponses complètes, un profil, un consentement et un rapport envoyé", () => {
    db.evals.filter((e) => statusOf(e) === "TERMINE").forEach((e) => {
      assert(isComplete(e.answers), `${e.id} : réponses incomplètes`);
      assert(resultOf(e) && ZONES.includes(resultOf(e).profil), `${e.id} : pas de profil`);
      assert(e.consent && e.consent.version && e.consent.at, `${e.id} : consentement manquant`);
      assert(e.reportSends.length >= 1 && e.reportSends[0] === e.completedAt, `${e.id} : rapport non envoyé à la fin de saisie`);
      assert(DEMO_FIELDS.every(([k]) => e.demo && e.demo[k]), `${e.id} : données démographiques manquantes`);
    });
  });
  test("Invariant · « Non terminé » et « Pas de réponse » n'ont ni réponses, ni profil, ni rapport", () => {
    db.evals.filter((e) => statusOf(e) !== "TERMINE").forEach((e) => {
      assert(!e.answers && !resultOf(e) && !e.reportSends.length && !e.completedAt && !e.demo && !e.consent, `${e.id} : champ de bilan terminé présent`);
    });
  });
  test("Invariant · « Pas de réponse » = invité par e-mail, jamais ouvert ; « Non terminé » = lien ouvert ; « Terminé » = lien ouvert", () => {
    db.evals.forEach((e) => {
      const st = statusOf(e);
      if (st === "PAS_DE_REPONSE") assert(e.invitedAt && !e.startedAt, `${e.id} : pas de réponse sans invitation`);
      else assert(e.startedAt, `${e.id} : ${st} sans date d'ouverture`);
      assert(e.invitedAt || e.startedAt, `${e.id} : ligne sans aucun fait`);
    });
  });
  test("Invariant · les dates d'une participation sont cohérentes avec sa campagne et pas dans le futur", () => {
    db.evals.forEach((e) => {
      const c = campOf(e.campaignId);
      if (e.invitedAt) assert(e.invitedAt >= c.createdAt && e.invitedAt <= c.end && e.invitedAt <= TODAY, `${e.id} : invitation hors période`);
      if (e.invitedAt && e.startedAt) assert(e.invitedAt <= e.startedAt, `${e.id} : ouvert avant d'être invité`);
      if (e.startedAt) assert(e.startedAt >= c.start && e.startedAt <= c.end && e.startedAt <= TODAY, `${e.id} : ouverture hors période`);
      if (e.completedAt) assert(e.completedAt >= e.startedAt && e.completedAt <= c.end && e.completedAt <= TODAY, `${e.id} : fin hors période`);
    });
    db.campaigns.forEach((c) => assert(c.createdAt <= TODAY, `${c.id} créée dans le futur`));
  });
  test("Invariant · campagne à venir : des invitations possibles, mais aucune réponse commencée", () => {
    db.evals.filter((e) => campaignState(campOf(e.campaignId)) === "AVENIR").forEach((e) => eq(statusOf(e), "PAS_DE_REPONSE", e.id));
    assert(db.evals.some((e) => e.campaignId === "a4"), "les données de démo doivent avoir des invitations sur une campagne à venir");
  });
  test("Invariant · une personne qui n'a jamais ouvert le lien n'a pas de nom (seul l'e-mail est connu)", () => {
    db.people.forEach((p) => {
      const opened = db.evals.some((e) => e.personId === p.id && e.startedAt);
      if (!opened) assert(!p.prenom && !p.nom, `${p.email} a un nom sans avoir rempli le formulaire`);
    });
  });
  test("Invariant · l'e-mail du participant est du domaine de l'entreprise de la campagne", () => {
    db.evals.forEach((e) => {
      const p = personOf(e.personId), c = campOf(e.campaignId);
      assert(p.companyId === c.companyId && emailAllowed(p.email, companyOf(c.companyId)), `${e.id} : ${p.email} hors domaine`);
    });
  });
  test("Invariant · une seule participation par personne et par campagne ; e-mails uniques", () => {
    const keys = db.evals.map((e) => e.campaignId + "|" + e.personId);
    eq(new Set(keys).size, keys.length, "doublon de participation");
    eq(new Set(db.people.map((p) => p.email)).size, db.people.length, "doublon d'e-mail");
  });
  test("Invariant · plus aucune notion d'accompagnement (décision de réunion) dans les données ni dans les écrans", () => {
    db.evals.forEach((e) => assert(!Object.keys(e).some((k) => /accomp/i.test(k)), `${e.id} : champ d'accompagnement présent`));
    const keep = { tab: state.yodan.tab, part: state.part }, div = document.createElement("div");
    const closeModals = () => $$(".modal-back").forEach((m) => m.parentNode.removeChild(m));
    try {
      const ev = db.evals.find((e) => e.completedAt && resultOf(e).profil !== "VERT");
      [() => { state.yodan.tab = "tb"; renderYodan(div); }, () => renderRH(div),
       () => { state.part = { ...keep.part, campaignId: ev.campaignId, step: "bilan", evId: ev.id, email: personOf(ev.personId).email }; renderParticipant(div); }]
        .forEach((r) => { div.innerHTML = ""; r(); assert(!/accompagn/i.test(div.textContent), "texte d'accompagnement affiché"); });
      reportModal(ev.id);
      const m = document.querySelector(".modal-back");
      assert(m && !/accompagn/i.test(m.textContent), "le rapport médecin mentionne l'accompagnement");
    } finally { closeModals(); state.yodan.tab = keep.tab; state.part = keep.part; }
  });
  test("Invariant · les données de démo contiennent les trois profils et les trois statuts", () => {
    const A = aggregate(db.evals);
    assert(A.prof.every((x) => x > 0), `profils manquants ${A.prof}`);
    assert(A.pasDeReponse > 0 && A.nonTermine > 0 && A.done > 0, "statuts manquants");
    eq(Object.keys(STATUS_PILL), ["TERMINE", "NON_TERMINE", "PAS_DE_REPONSE"], "liste des statuts");
  });

  /* ---------- Cohérence entre blocs ---------- */
  test("Cohérence · profils (V+O+R) = bilans terminés ; terminés + non terminés + pas de réponse = participations", () => {
    [...db.campaigns.map((c) => ({ campaign: c.id })), ...COMPANIES.map((c) => ({ company: c.id })), {}].forEach((f) => {
      const A = aggregate(scopeEvals(f));
      eq(sum(A.prof), A.done, `profils ${JSON.stringify(f)}`);
      eq(A.done + A.nonTermine + A.pasDeReponse, A.participations, `statuts ${JSON.stringify(f)}`);
    });
  });
  test("Cohérence · somme des campagnes = vue « toutes les campagnes » (par entreprise et au total)", () => {
    [...COMPANIES.map((c) => c.id), "all"].forEach((co) => {
      const parts = db.campaigns.filter((c) => co === "all" || c.companyId === co).map((c) => aggregate(scopeEvals({ campaign: c.id })));
      const all = aggregate(scopeEvals({ company: co }));
      eq(sum(parts.map((a) => a.done)), all.done, `terminés ${co}`);
      eq([0, 1, 2].map((i) => sum(parts.map((a) => a.prof[i]))), all.prof, `profils ${co}`);
    });
  });
  test("Cohérence · le tableau de bord Yodan et la liste des participants comptent les mêmes bilans (chaque filtre)", () => {
    const filters = [{ company: "all", campaign: "all", person: "" }, ...COMPANIES.map((c) => ({ company: c.id, campaign: "all", person: "" })),
      ...db.campaigns.map((c) => ({ company: c.companyId, campaign: c.id, person: "" })), { company: "alpha", campaign: "all", person: "alpha-p0" }];
    filters.forEach((f) => {
      const A = aggregate(scopeEvals(f)), rows = listRows(f);
      eq(rows.length, A.participations, `participations ${JSON.stringify(f)}`);
      eq(rows.filter((x) => x.st === "TERMINE").length, A.done, `terminés ${JSON.stringify(f)}`);
      ZONES.forEach((z, i) => eq(rows.filter((x) => x.r && x.r.profil === z).length, A.prof[i], `${z} ${JSON.stringify(f)}`));
    });
  });
  test("Cohérence · le tableau de bord RH et le tableau de bord Yodan donnent les mêmes chiffres", () => {
    COMPANIES.forEach((co) => {
      const M = rhModel(co.id, "all");
      const A = aggregate(scopeEvals({ company: co.id }).filter((e) => campaignState(campOf(e.campaignId)) !== "AVENIR"));
      eq([M.done, M.nonTermine, M.pasDeReponse], [A.done, A.nonTermine, A.pasDeReponse], `statuts ${co.id}`);
      if (!M.masked) { eq(M.prof, A.prof, `profils ${co.id}`); eq(M.dims, A.dims, `dimensions ${co.id}`); }
      M.campaigns.forEach((c) => {
        const m = rhModel(co.id, c.id), a = aggregate(scopeEvals({ campaign: c.id }));
        eq([m.done, m.nonTermine, m.pasDeReponse], [a.done, a.nonTermine, a.pasDeReponse], `statuts ${c.id}`);
        if (!m.masked) eq(m.prof, a.prof, `profils ${c.id}`);
      });
    });
  });
  test("Cohérence · RH « toutes les campagnes » ne compte pas les invitations d'une campagne à venir", () => {
    const fromStarted = rhModel("alpha").campaigns.reduce((s, c) => s + rhModel("alpha", c.id).pasDeReponse, 0);
    eq(rhModel("alpha").pasDeReponse, fromStarted, "somme des campagnes commencées");
    assert(aggregate(scopeEvals({ campaign: "a4" })).pasDeReponse > 0, "a4 doit avoir des invitations pour que ce test ait un sens");
  });
  test("Cohérence · chaque groupe démographique (âge, genre, ancienneté) totalise les bilans terminés", () => {
    [{}, { company: "alpha" }, { campaign: "a3" }].forEach((f) => {
      const A = aggregate(scopeEvals(f));
      Object.entries(A.by).forEach(([k, rows]) => {
        eq(sum(rows.map(([, z]) => sum(z))), A.done, `${k} ${JSON.stringify(f)}`);
        [0, 1, 2].forEach((i) => eq(sum(rows.map(([, z]) => z[i])), A.prof[i], `${k} zone ${i}`));
      });
    });
  });

  /* ---------- Disponibilité du formulaire ---------- */
  test("Disponibilité · fermé la veille du début, ouvert le premier et le dernier jour, fermé le lendemain de la fin", () => {
    const c = { start: "2026-12-01", end: "2026-12-12" };
    eq(availability(c, "2026-11-30").open, false, "veille");
    eq(availability(c, "2026-12-01").open, true, "premier jour");
    eq(availability(c, "2026-12-12").open, true, "dernier jour");
    eq(availability(c, "2026-12-13").open, false, "lendemain");
    eq([campaignState(c, "2026-11-30"), campaignState(c, "2026-12-05"), campaignState(c, "2026-12-13")], ["AVENIR", "EN_COURS", "TERMINEE"], "états");
  });
  test("Disponibilité · le message indique la date d'ouverture (à venir) ou la période passée (terminée)", () => {
    const c = { start: "2026-12-01", end: "2026-12-12" };
    const before = availability(c, "2026-11-17"), after = availability(c, "2026-12-20");
    assert(before.message.includes(fmtLong("2026-12-01")) && before.message.includes("à partir du"), "date d'ouverture absente");
    assert(after.message.includes(fmtLong("2026-12-12")) && after.title.includes("terminé"), "date de fin absente");
  });

  /* ---------- Création de campagne ---------- */
  test("Création · nom, entreprise et période obligatoires ; fin ≥ début ; fin pas passée ; nom unique par entreprise", () => {
    const ok = { name: "Bilan T1 2027 bis", companyId: "alpha", start: TODAY, end: addDays(TODAY, 10) };
    eq(Object.keys(validateCampaign(ok)), [], "cas valide refusé");
    assert(validateCampaign({ ...ok, name: "  " }).name, "nom vide accepté");
    assert(validateCampaign({ ...ok, name: "x".repeat(81) }).name, "nom de 81 caractères accepté");
    assert(!validateCampaign({ ...ok, name: "x".repeat(80) }).name, "nom de 80 caractères refusé");
    assert(validateCampaign({ ...ok, companyId: "" }).companyId, "entreprise vide acceptée");
    assert(validateCampaign({ ...ok, companyId: "inconnue" }).companyId, "entreprise inconnue acceptée");
    assert(validateCampaign({ ...ok, end: addDays(TODAY, -1), start: addDays(TODAY, -5) }).end, "fin passée acceptée");
    assert(validateCampaign({ ...ok, end: addDays(TODAY, 1), start: addDays(TODAY, 3) }).end, "fin avant début acceptée");
    assert(!validateCampaign({ ...ok, start: TODAY, end: TODAY }).end, "campagne d'un seul jour refusée");
    assert(validateCampaign({ ...ok, name: "bilan t4 2026" }).name, "doublon de nom (casse) accepté dans la même entreprise");
    assert(!validateCampaign({ ...ok, name: "Bilan T4 2026", companyId: "beta" }).name, "même nom refusé dans une autre entreprise");
  });
  test("Création · une campagne créée a un code de lien, l'état calculé et 0 participation", () => {
    const r1 = createCampaign({ name: "Nouvelle", companyId: "gamma", start: TODAY, end: addDays(TODAY, 5) });
    const r2 = createCampaign({ name: "Plus tard", companyId: "gamma", start: addDays(TODAY, 3), end: addDays(TODAY, 5) });
    assert(r1.ok && r2.ok, "création refusée");
    eq([campaignState(r1.campaign), campaignState(r2.campaign)], ["EN_COURS", "AVENIR"], "état");
    assert(/^[A-Z0-9]{6}$/.test(r1.campaign.code) && !campaignUrl(r1.campaign).includes("gamma"), "le lien doit être un code neutre");
    eq(aggregate(scopeEvals({ campaign: r1.campaign.id })).participations, 0, "participations");
  });

  /* ---------- Contrôle e-mail + diffusion ---------- */
  test("Contrôle e-mail · seul le domaine exact de l'entreprise est accepté", () => {
    const co = companyOf("alpha");
    eq(["a.b@alpha.exemple.test", "A.B@ALPHA.exemple.test", "x@beta.exemple.test", "x@evil-alpha.exemple.test", "x@alpha.exemple.test.evil", "x@sous.alpha.exemple.test", "alpha.exemple.test", "x@@alpha.exemple.test"].map((m) => emailAllowed(m, co)),
      [true, true, false, false, false, false, false, false], "résultats");
  });
  test("Diffusion · les adresses hors domaine, invalides ou en double sont refusées avec une raison", () => {
    const r = parseRecipients("a@alpha.exemple.test, b@alpha.exemple.test;\nA@alpha.exemple.test x@gmail.exemple.test pasunemail", companyOf("alpha"));
    eq(r.ok, ["a@alpha.exemple.test", "b@alpha.exemple.test"], "acceptées");
    eq(r.refused.map((x) => x.reason.split(" ")[0]), ["En", "Domaine", "Adresse"], "raisons");
    eq(parseRecipients("", companyOf("alpha")), { ok: [], refused: [] }, "liste vide");
  });

  test("Diffusion CSV · colonne « email » trouvée quel que soit le séparateur ; guillemets et BOM gérés ; autres colonnes ignorées", () => {
    eq(parseCsvEmails("nom;prenom;email\r\nDémo;Inès;ines@alpha.exemple.test").emails, ["ines@alpha.exemple.test"], "point-virgule + CRLF");
    eq(parseCsvEmails("﻿Email,nom\nb@alpha.exemple.test,Test").emails, ["b@alpha.exemple.test"], "virgule + BOM + en-tête en majuscule");
    eq(parseCsvEmails("nom\tE-mail\nX\tc@alpha.exemple.test").emails, ["c@alpha.exemple.test"], "tabulation + « E-mail »");
    eq(parseCsvEmails('nom;email\n"Exemple; Jr";d@alpha.exemple.test\n"Dit ""Jo""";e@alpha.exemple.test').emails, ["d@alpha.exemple.test", "e@alpha.exemple.test"], "guillemets");
    eq(parseCsvEmails("courriel\nf@alpha.exemple.test").emails, ["f@alpha.exemple.test"], "en-tête « courriel »");
    eq(parseCsvEmails("g@alpha.exemple.test;Démo\nh@alpha.exemple.test;Test").emails, ["g@alpha.exemple.test", "h@alpha.exemple.test"], "sans en-tête");
    const r = parseCsvEmails("nom;email\n\nA;i@alpha.exemple.test\nB;\n");
    eq([r.emails, r.missing], [["i@alpha.exemple.test"], [4]], "ligne vide ignorée, ligne sans adresse signalée avec son numéro");
  });
  test("Diffusion CSV · fichier vide, sans colonne e-mail ou sans données : erreur claire, rien n'est envoyé", () => {
    assert(parseCsvEmails("").error && parseCsvEmails("\n \n").error, "fichier vide accepté");
    assert(/email/.test(parseCsvEmails("nom;prenom\nDémo;Aya").error), "absence de colonne e-mail non signalée");
    assert(parseCsvEmails("nom;email\n").error, "en-tête seul accepté");
    const r = collectRecipients("a@alpha.exemple.test", "nom;prenom\nDémo;Aya", companyOf("alpha"));
    assert(r.error && !r.ok.length, "un CSV invalide ne doit rien envoyer, même avec des adresses collées");
  });
  test("Diffusion CSV · fichier d'exemple + adresses collées : contrôle de domaine et doublons entre les deux sources", () => {
    const co = companyOf("alpha");
    const r = collectRecipients(`ines.demo@${co.domain}\nautre.test@${co.domain}`, sampleCsv(co), co);
    eq(r.ok, [`ines.demo@${co.domain}`, `autre.test@${co.domain}`, `jules.test@${co.domain}`, `noe.exemple@${co.domain}`], "acceptées");
    eq(r.refused.map((x) => x.reason.split(" ")[0]).sort(), ["Adresse", "Domaine", "En", "En"], "refus : hors domaine, 2 doublons, ligne sans adresse");
    eq(collectRecipients("", null, co), { ok: [], refused: [] }, "rien à envoyer");
    eq(collectRecipients("", sampleCsv(companyOf("beta")), co).ok.length, 0, "CSV d'une autre entreprise : tout refusé");
  });

  /* ---------- Parcours de bout en bout ---------- */
  test("Parcours · e-mail → formulaire → envoi : +1 bilan dans la liste, le TB Yodan et le TB RH ; rapport envoyé", () => {
    const c = db.campaigns.find((x) => x.id === "a3");
    const before = { y: aggregate(scopeEvals({ campaign: c.id })), rh: rhModel("alpha", c.id), l: listRows({ company: "alpha", campaign: c.id, person: "" }).length };
    const st = startParticipation(c.id, "nouveau.test@alpha.exemple.test");
    assert(st.ok, "démarrage refusé");
    eq(aggregate(scopeEvals({ campaign: c.id })).nonTermine, before.y.nonTermine + 1, "« non terminé » non compté");
    const res = submitEvaluation({ campaignId: c.id, email: "Nouveau.Test@alpha.exemple.test ", prenom: "Nouveau", nom: "Test", demo: DEMO, answers: fullAnswers("mid"), consent: true });
    assert(res.ok, "envoi refusé : " + res.reason);
    const y = aggregate(scopeEvals({ campaign: c.id }));
    eq(y.done, before.y.done + 1, "TB Yodan");
    eq(y.nonTermine, before.y.nonTermine, "le « non terminé » devient terminé (pas de doublon)");
    eq(rhModel("alpha", c.id).done, before.rh.done + 1, "TB RH");
    eq(listRows({ company: "alpha", campaign: c.id, person: "" }).length, before.l + 1, "liste");
    eq(res.evaluation.reportSends, [TODAY], "rapport envoyé par e-mail à la fin");
    eq(personOf(res.evaluation.personId).email, "nouveau.test@alpha.exemple.test", "e-mail normalisé");
  });
  test("Parcours · invitation → « Pas de réponse » → lien ouvert → « Non terminé » → envoi → « Terminé », toujours la même ligne", () => {
    const email = "invite.parcours@alpha.exemple.test", n = db.evals.length, before = aggregate(scopeEvals({ campaign: "a3" }));
    const inv = inviteRecipients("a3", [email, "Invite.Parcours@ALPHA.exemple.test", "x@beta.exemple.test"]);
    eq([inv.invited, inv.reminded, inv.skipped.map((s) => s.reason)], [1, 1, ["DOMAIN"]], "envoi : 1 invité, 1 relance (même adresse), 1 hors domaine");
    eq(db.evals.length, n + 1, "une seule ligne créée");
    const row = () => listRows({ company: "alpha", campaign: "a3", person: "" }).find((x) => x.p.email === email);
    eq(row().st, "PAS_DE_REPONSE", "après invitation");
    eq(displayName(row().p), "(nom non saisi)", "aucun nom connu avant le formulaire");
    eq(aggregate(scopeEvals({ campaign: "a3" })).pasDeReponse, before.pasDeReponse + 1, "compteur « pas de réponse »");
    assert(startParticipation("a3", email).ok, "ouverture");
    eq(row().st, "NON_TERMINE", "après ouverture du lien");
    assert(submitEvaluation({ campaignId: "a3", email, prenom: "Invité", nom: "Parcours", demo: DEMO, answers: fullAnswers("mid"), consent: true }).ok, "envoi");
    eq([row().st, db.evals.length], ["TERMINE", n + 1], "après envoi, même ligne");
    const a = aggregate(scopeEvals({ campaign: "a3" }));
    eq([a.done, a.nonTermine, a.pasDeReponse], [before.done + 1, before.nonTermine, before.pasDeReponse], "compteurs finaux");
    eq(inviteRecipients("a3", [email]).skipped[0].reason, "ALREADY", "une personne qui a terminé n'est pas relancée");
  });
  test("Parcours · invitations : possibles sur une campagne à venir, refusées sur une campagne terminée", () => {
    assert(inviteRecipients("a4", ["avance.test@alpha.exemple.test"]).ok, "campagne à venir refusée");
    eq(inviteRecipients("a2", ["tard.test@alpha.exemple.test"]).reason, "CLOSED", "campagne terminée acceptée");
  });
  test("Parcours · un second envoi par la même personne est refusé (pas de doublon)", () => {
    const ev = db.evals.find((e) => e.campaignId === "a3" && e.completedAt), p = personOf(ev.personId);
    const n = db.evals.length;
    eq(startParticipation("a3", p.email).reason, "ALREADY", "démarrage");
    eq(submitEvaluation({ campaignId: "a3", email: p.email, prenom: "X", nom: "Y", demo: DEMO, answers: fullAnswers("max"), consent: true }).reason, "ALREADY", "envoi");
    eq(db.evals.length, n, "nouvelle ligne créée");
    eq(ev.answers, JSON.parse(snapshot).evals.find((x) => x.id === ev.id).answers, "réponses écrasées");
  });
  test("Parcours · campagne à venir ou terminée : démarrage et envoi refusés", () => {
    ["a4", "a2"].forEach((id) => {
      eq(startParticipation(id, "z.test@alpha.exemple.test").reason, "CLOSED", `démarrage ${id}`);
      eq(submitEvaluation({ campaignId: id, email: "z.test@alpha.exemple.test", prenom: "Z", nom: "T", demo: DEMO, answers: fullAnswers("mid"), consent: true }).reason, "CLOSED", `envoi ${id}`);
    });
  });
  test("Parcours · envoi refusé sans consentement, réponses incomplètes ou e-mail hors domaine", () => {
    const base = { campaignId: "a3", email: "k.test@alpha.exemple.test", prenom: "K", nom: "T", demo: DEMO, answers: fullAnswers("mid"), consent: true };
    eq(submitEvaluation({ ...base, consent: false }).reason, "CONSENT", "consentement");
    const partial = fullAnswers("mid"); delete partial.E2;
    eq(submitEvaluation({ ...base, answers: partial }).reason, "INCOMPLETE", "incomplet");
    eq(submitEvaluation({ ...base, email: "k@beta.exemple.test" }).reason, "DOMAIN", "domaine");
  });
  test("Parcours · renvoyer le lien du rapport : seulement pour un bilan terminé, chaque envoi est tracé", () => {
    const ev = db.evals.find((e) => e.completedAt), pending = db.evals.find((e) => !e.completedAt);
    assert(sendReportLink(ev.id) && ev.reportSends.length === 2, "renvoi");
    eq(sendReportLink(pending.id), false, "renvoi d'un bilan non terminé");
  });

  /* ---------- Visibilité par rôle ---------- */
  test("Rôle RH · aucune donnée individuelle (nom, e-mail, identifiant) dans le modèle RH", () => {
    const forbidden = [...db.people.map((p) => p.email), ...db.people.filter((p) => p.prenom).map(displayName), ...db.evals.map((e) => e.id), ...db.people.map((p) => p.id)];
    COMPANIES.forEach((co) => ["all", ...db.campaigns.map((c) => c.id)].forEach((cid) => {
      const txt = JSON.stringify(rhModel(co.id, cid));
      forbidden.forEach((x) => assert(!txt.includes(`"${x}"`) && !txt.includes(x + " "), `${co.id}/${cid} expose ${x}`));
      assert(!/alerte|email|personId|answers/i.test(txt), `${co.id}/${cid} expose un champ individuel`);
    }));
  });
  test("Rôle RH · l'écran RH affiché ne contient aucune adresse e-mail ni nom de participant", () => {
    const keep = { ...state.rh }, div = document.createElement("div");
    try {
      COMPANIES.forEach((co) => {
        session.accountId = rhOf(co.id)?.id || null; // connecté comme le RH de l'entreprise (son propre e-mail peut apparaître)
        Object.assign(state.rh, { company: co.id, campaign: "all" });
        div.innerHTML = ""; renderRH(div);
        const txt = div.textContent;
        db.people.forEach((p) => assert(!txt.includes(p.email), `${co.id} : e-mail de participant affiché`));
        const others = db.accounts.filter((a) => a.id !== session.accountId).map((a) => a.email);
        others.forEach((m) => assert(!txt.includes(m), `${co.id} : e-mail d'un autre compte affiché`));
        db.people.filter((p) => p.prenom).forEach((p) => assert(!txt.includes(displayName(p)), `${co.id} : ${displayName(p)} affiché`));
      });
    } finally { Object.assign(state.rh, keep); }
  });
  test("Rôle RH · campagne de moins de 5 bilans masquée ; groupe de moins de 5 masqué", () => {
    const pilot = rhModel("beta", "b1");
    assert(pilot.done < MIN_GROUP && pilot.masked && !pilot.prof && !pilot.dims && !pilot.by, "Pilote 2026 non masqué");
    COMPANIES.forEach((co) => ["all", ...rhModel(co.id).campaigns.map((c) => c.id)].forEach((cid) => {
      const M = rhModel(co.id, cid);
      if (M.by) Object.values(M.by).flat().forEach((g) => assert(g.masked ? !("z" in g) && !("n" in g) : g.n >= MIN_GROUP, `${co.id}/${cid} groupe ${g.label}`));
      (M.compare || []).forEach((c) => assert(c.done >= MIN_GROUP, `${c.name} dans la comparaison avec ${c.done}`));
    }));
    const someMasked = Object.values(rhModel("alpha", "a3").by).flat().some((g) => g.masked);
    assert(someMasked, "les données de démo doivent montrer au moins un groupe masqué");
  });
  test("Rôle RH · ne voit que les campagnes commencées de son entreprise ; une autre campagne est refusée", () => {
    const M = rhModel("alpha");
    assert(M.campaigns.every((c) => campOf(c.id).companyId === "alpha" && c.state !== "AVENIR"), "campagne étrangère ou à venir");
    eq(rhModel("alpha", "b2").error, "FORBIDDEN", "campagne d'une autre entreprise");
    eq(rhModel("alpha", "a4").error, "FORBIDDEN", "campagne à venir");
    eq(rhModel("inconnue").error, "FORBIDDEN", "entreprise inconnue");
    eq(rhModel("gamma").campaigns.length, 0, "Gamma n'a aucune campagne commencée");
  });

  /* ---------- Filtres ---------- */
  test("Filtres · changer d'entreprise remet à zéro la campagne et le patient qui n'en font pas partie", () => {
    eq(normalizeFilters({ company: "beta", campaign: "a3", person: "alpha-p0" }), { company: "beta", campaign: "all", person: "" }, "autre entreprise");
    eq(normalizeFilters({ company: "alpha", campaign: "a3", person: "alpha-p0" }), { company: "alpha", campaign: "a3", person: "alpha-p0" }, "même entreprise conservée");
    eq(normalizeFilters({ company: "all", campaign: "inconnue", person: "inconnu" }), { company: "all", campaign: "all", person: "" }, "identifiants inconnus");
  });
  test("Filtres · patient sélectionné : tableau de bord et liste limités à ses bilans", () => {
    const pid = db.evals.find((e) => e.completedAt).personId;
    const rows = listRows({ company: "all", campaign: "all", person: pid });
    assert(rows.length >= 1 && rows.every((x) => x.p.id === pid), "lignes d'un autre patient");
    eq(aggregate(scopeEvals({ person: pid })).participations, rows.length, "TB patient");
  });
  test("Filtres · combinaison sans résultat : 0 partout, sans erreur", () => {
    const f = { company: "gamma", campaign: "g1", person: "" };
    const A = aggregate(scopeEvals(f));
    eq([A.participations, A.done, sum(A.prof), listRows(f).length], [0, 0, 0, 0], "compteurs");
    DIMS.forEach((k) => eq(A.dims[k], 0, `moyenne ${k}`));
    eq(listRows({ company: "all", campaign: "all", person: "" }, { q: "zzzz", status: "all", profil: "all" }).length, 0, "recherche vide");
  });
  test("Filtres · filtres de liste (statut, profil) cohérents avec le tableau de bord", () => {
    const f = { company: "alpha", campaign: "all", person: "" }, A = aggregate(scopeEvals(f));
    const L = (o) => listRows(f, { q: "", status: "all", profil: "all", ...o }).length;
    eq(L({ status: "TERMINE" }), A.done, "terminés");
    eq(L({ status: "NON_TERMINE" }), A.nonTermine, "non terminés");
    eq(L({ status: "PAS_DE_REPONSE" }), A.pasDeReponse, "pas de réponse");
    eq(L({ profil: "ROUGE" }), A.prof[2], "à prendre en charge");
    eq(L({ profil: "none" }), A.participations - A.done, "sans profil");
    eq(L({ profil: "VERT" }) + L({ profil: "ORANGE" }) + L({ profil: "ROUGE" }), A.done, "profils = terminés");
  });

  /* ---------- Journal ---------- */
  test("Journal · ouvrir un rapport et renvoyer un lien sont journalisés, sans donnée de santé", () => {
    const ev = db.evals.find((e) => e.completedAt), n = db.audit.length;
    reportModal(ev.id); $$(".modal-back").forEach((m) => m.remove());
    sendReportLink(ev.id);
    const added = db.audit.slice(n);
    eq(added.map((a) => a.action), ["RAPPORT_CONSULTE", "RAPPORT_LIEN_RENVOYE"], "actions");
    const txt = JSON.stringify(added);
    assert(!/VERT|ORANGE|ROUGE|Satisfaisant|Vigilance|prendre en charge|answers|pct/.test(txt), "contenu de santé dans le journal");
  });

  /* ---------- Cas limites ---------- */
  test("Cas limites · réponses minimales et maximales : profil valide et scores entre 0 et 100", () => {
    ["min", "mid", "max"].forEach((v) => {
      const r = score(fullAnswers(v));
      assert(ZONES.includes(r.profil), `profil ${v}`);
      DIMS.forEach((k) => assert(r.dims[k].pct >= 0 && r.dims[k].pct <= 100, `${k} ${v} = ${r.dims[k].pct}`));
    });
    eq(isComplete({}), false, "réponses vides complètes");
  });

  /* ---------- Entreprises et comptes RH (version autonome) ---------- */
  const NEWCO = { name: "Société Exemple Epsilon", domain: "epsilon.exemple.test", rhEmail: "rh.demo@epsilon.exemple.test" };
  const lastMail = (to, kind) => db.outbox.filter((m) => m.to === to && (!kind || m.kind === kind)).pop();
  const linkOf = (email) => (lastMail(email, "INVITATION").lines.find((l) => l.includes(ACTIVATION_URL)) || "").split(ACTIVATION_URL)[1];
  const STRONG = "Nouveau-Mdp-2026x";

  test("Entreprise · nom, domaine et e-mail RH obligatoires et valides ; domaine et nom uniques ; messagerie publique refusée", () => {
    eq(Object.keys(validateCompany(NEWCO)), [], "cas valide refusé");
    assert(validateCompany({ ...NEWCO, name: " " }).name, "nom vide");
    assert(validateCompany({ ...NEWCO, name: "entreprise démo ALPHA" }).name, "nom en double (casse, accents)");
    assert(validateCompany({ ...NEWCO, domain: "" }).domain, "domaine vide");
    assert(validateCompany({ ...NEWCO, domain: "pas un domaine" }).domain, "domaine invalide");
    assert(validateCompany({ ...NEWCO, domain: "gmail.com", rhEmail: "rh@gmail.com" }).domain, "messagerie publique acceptée");
    assert(validateCompany({ ...NEWCO, domain: "alpha.exemple.test", rhEmail: "x@alpha.exemple.test" }).domain, "domaine déjà utilisé");
    eq(cleanDomain(" contact@Epsilon.Exemple.Test "), "epsilon.exemple.test", "adresse collée → domaine");
    eq(cleanDomain("@epsilon.exemple.test"), "epsilon.exemple.test", "« @domaine »");
  });
  test("Entreprise · l'e-mail du RH doit être du domaine de l'entreprise et ne pas avoir déjà de compte", () => {
    assert(validateCompany({ ...NEWCO, rhEmail: "" }).rhEmail, "vide");
    assert(validateCompany({ ...NEWCO, rhEmail: "rh.demo" }).rhEmail, "invalide");
    assert(/@epsilon/.test(validateCompany({ ...NEWCO, rhEmail: "rh@autre.exemple.test" }).rhEmail), "autre domaine accepté");
    assert(validateCompany({ ...NEWCO, rhEmail: "rh@sous.epsilon.exemple.test" }).rhEmail, "sous-domaine accepté");
    assert(validateCompany({ ...NEWCO, domain: "alpha2.exemple.test", rhEmail: "rh.demo@alpha.exemple.test" }).rhEmail, "compte existant accepté");
  });
  test("Entreprise · création → entreprise + compte RH « invitation envoyée » + e-mail avec lien d'activation (aucun mot de passe)", () => {
    const n = COMPANIES.length, r = createCompany({ ...NEWCO, domain: "@Epsilon.exemple.test", rhEmail: " RH.Demo@epsilon.exemple.test " });
    assert(r.ok, "création refusée");
    eq([COMPANIES.length, r.company.domain, r.account.email, r.account.role, r.account.companyId], [n + 1, "epsilon.exemple.test", NEWCO.rhEmail, "RH", r.company.id], "données");
    eq(accountStatus(r.account), "INVITE", "état du compte");
    const m = lastMail(NEWCO.rhEmail, "INVITATION");
    assert(m && linkOf(NEWCO.rhEmail) === r.account.activation.token, "e-mail d'invitation avec le lien d'activation");
    assert(r.account.activation.token.length >= 24, "jeton trop court");
    // Le seul secret de l'e-mail est le lien : aucune ligne « mot de passe : xxx » hors de la ligne du lien.
    assert(!m.lines.some((l) => !l.includes(ACTIVATION_URL) && /mot de passe\s*(temporaire)?\s*:/i.test(l)), "un mot de passe circule par e-mail");
    assert(m.lines.some((l) => l.includes(fmt(r.account.activation.expires))), "date d'expiration dans l'e-mail");
    eq(r.account.activation.expires, addDays(TODAY, ACTIVATION_DAYS), "validité");
    assert(!r.account.pw, "pas de mot de passe définitif avant la première connexion");
    assert(db.campaigns.every((c) => c.companyId !== r.company.id), "aucune campagne");
  });
  test("Entreprise · la nouvelle entreprise est utilisable : campagne, contrôle du domaine des participants, tableau RH vide", () => {
    const { company } = createCompany(NEWCO);
    const c = createCampaign({ name: "Bilan pilote", companyId: company.id, start: TODAY, end: addDays(TODAY, 7) });
    assert(c.ok, "campagne refusée");
    assert(startParticipation(c.campaign.id, "salarie.test@epsilon.exemple.test").ok, "participant du domaine refusé");
    eq(startParticipation(c.campaign.id, "salarie.test@alpha.exemple.test").reason, "DOMAIN", "participant d'un autre domaine accepté");
    const M = rhModel(company.id);
    eq([M.campaigns.length, M.done, M.masked], [1, 0, true], "tableau RH");
  });
  test("Compte RH · un seul compte RH non désactivé par entreprise (données de démo et après remplacement)", () => {
    const check = () => COMPANIES.forEach((co) => assert(db.accounts.filter((a) => a.role === "RH" && a.companyId === co.id && !a.disabled).length <= 1, `${co.id} : plusieurs RH actifs`));
    check();
    const old = rhOf("alpha"), r = replaceRh("alpha", "nouvelle.rh@alpha.exemple.test");
    assert(r.ok && old.disabled && rhOf("alpha").id === r.account.id && accountStatus(r.account) === "INVITE", "remplacement");
    check();
    eq(setRhDisabled(old.id, false).ok, false, "réactiver l'ancien alors qu'un RH existe");
    eq(replaceRh("alpha", "autre@beta.exemple.test").ok, false, "remplacement par une adresse hors domaine");
    eq(login(old.email, old.pw).reason, "BAD", "l'ancien RH peut encore se connecter");
  });
  test("Compte RH · chaque compte RH a une adresse du domaine de son entreprise", () => {
    db.accounts.filter((a) => a.role === "RH").forEach((a) => eq(a.email.split("@")[1], companyOf(a.companyId).domain, a.email));
  });
  test("Compte RH · renvoyer l'invitation : nouveau lien, l'ancien ne marche plus ; impossible sur un compte actif", () => {
    const a = accountOf("u-beta"), before = a.activation.token;
    assert(resendInvitation(a.id), "renvoi refusé");
    assert(a.activation.token !== before && linkOf(a.email) === a.activation.token, "nouveau lien");
    eq(activationAccount(before).reason, "INVALID", "l'ancien lien fonctionne encore");
    eq(resendInvitation("u-alpha"), false, "renvoi sur un compte actif");
    assert(resendInvitation("u-delta") && accountStatus(accountOf("u-delta")) === "INVITE", "renvoi d'une invitation expirée");
  });
  test("Compte RH · états déduits : invitation envoyée, expirée, actif, désactivé", () => {
    eq(["u-beta", "u-delta", "u-alpha", "u-gamma-old"].map((id) => accountStatus(accountOf(id))), ["INVITE", "EXPIREE", "ACTIF", "DESACTIVE"], "états");
  });

  /* ---------- Connexion ---------- */
  test("Activation · lien → choix du mot de passe → connexion (mot de passe + code) → espace RH de son entreprise", () => {
    const a = accountOf("u-beta"), token = a.activation.token;
    eq(login(a.email, "n'importe quoi").reason, "BAD", "connexion possible avant activation");
    eq(canAccess(a.id, "rh"), false, "accès avant activation");
    eq(activationAccount(token).accountId, a.id, "lien reconnu");
    eq(activateAccount(token, "faible", "faible").reason, "RULES", "règles du mot de passe");
    assert(activateAccount(token, STRONG, STRONG).ok, "activation refusée");
    eq([accountStatus(a), a.activation], ["ACTIF", null], "compte activé, lien supprimé");
    eq(activationAccount(token).reason, "INVALID", "lien réutilisable");
    eq(login(a.email, STRONG).next, "MFA", "code demandé après activation");
    eq(verifyMfa(a.id, FAKE_OTP).next, "HOME", "accueil");
    eq([canAccess(a.id, "rh", "beta"), canAccess(a.id, "rh", "alpha"), canAccess(a.id, "yodan")], [true, false, false], "droits");
    assert(db.audit.some((e) => e.action === "COMPTE_ACTIVE" && e.target === a.id), "activation non journalisée");
  });
  test("Activation · lien expiré, inconnu, ou d'un compte désactivé : refusé", () => {
    eq(activationAccount(accountOf("u-delta").activation.token).reason, "EXPIRED", "expiré");
    eq(activateAccount(accountOf("u-delta").activation.token, STRONG, STRONG).reason, "EXPIRED", "activation d'un lien expiré");
    eq(activationAccount("inconnu").reason, "INVALID", "inconnu");
    eq(activationAccount("").reason, "INVALID", "vide");
    const b = accountOf("u-beta"), token = b.activation.token;
    setRhDisabled(b.id, true);
    eq(activationAccount(token).reason, "INVALID", "compte désactivé");
  });
  test("Connexion · admin Yodan : mot de passe → code → espace Yodan ; pas d'accès à l'espace RH", () => {
    const a = accountOf("u-yodan");
    eq(login(a.email, a.pw).next, "MFA", "code demandé");
    eq(verifyMfa(a.id, FAKE_OTP).next, "HOME", "accueil");
    eq([canAccess(a.id, "yodan"), canAccess(a.id, "rh")], [true, false], "droits");
  });
  test("Connexion · message identique pour adresse inconnue, compte désactivé et mauvais mot de passe", () => {
    const old = accountOf("u-gamma-old");
    eq([login("inconnu@alpha.exemple.test", "x").reason, login(old.email, old.pw).reason, login("rh.demo@alpha.exemple.test", "mauvais").reason], ["BAD", "BAD", "BAD"], "raisons");
  });
  test(`Connexion · blocage après ${MAX_FAILS} échecs, même avec le bon mot de passe ; débloqué par « mot de passe oublié »`, () => {
    const a = accountOf("u-alpha");
    for (let i = 0; i < MAX_FAILS - 1; i++) eq(login(a.email, "mauvais").reason, "BAD", `échec ${i + 1}`);
    eq(login(a.email, "mauvais").reason, "LOCKED", "dernier échec");
    eq(login(a.email, a.pw).reason, "LOCKED", "bon mot de passe pendant le blocage");
    forgotStart(a.email);
    const v = forgotVerify(a.email, FAKE_OTP);
    assert(v.ok && setPassword(v.accountId, STRONG, STRONG, "RESET").ok, "réinitialisation");
    eq(login(a.email, STRONG).ok, true, "débloqué");
  });
  test("Connexion · code MFA : faux code refusé, 5 essais max, renvoi invalide l'ancien ; appareil de confiance", () => {
    const a = accountOf("u-alpha");
    login(a.email, a.pw);
    eq(verifyMfa(a.id, "000000").reason, "BAD", "faux code");
    for (let i = 0; i < CODE_TRIES - 2; i++) verifyMfa(a.id, "000000");
    eq(verifyMfa(a.id, "000000").reason, "TOO_MANY", "trop d'essais");
    eq(verifyMfa(a.id, FAKE_OTP).reason, "TOO_MANY", "bon code après trop d'essais");
    login(a.email, a.pw);
    eq(verifyMfa(a.id, FAKE_OTP, true).next, "HOME", "nouveau code");
    eq(verifyMfa(a.id, FAKE_OTP).reason, "EXPIRED", "code réutilisé");
    eq(login(a.email, a.pw).next, "HOME", "appareil de confiance : pas de code");
    setPassword(a.id, STRONG, STRONG);
    eq(login(a.email, STRONG).next, "MFA", "changement de mot de passe : appareils de confiance oubliés");
  });
  test("Mot de passe · règles : longueur, majuscule/minuscule, chiffre, pas l'adresse, pas le mot de passe actuel ; confirmation", () => {
    const a = accountOf("u-beta");
    const failed = (pw) => passwordChecks(pw, a).filter((c) => !c.ok).map((c) => c.id);
    eq(failed("Court-1a"), ["min"], "trop court");
    eq(failed("tout-en-minuscule-12"), ["case"], "sans majuscule");
    eq(failed("Sans-Chiffre-Ici"), ["digit"], "sans chiffre");
    eq(failed("Rh.Test-2026-Abc"), ["email"], "contient l'adresse");
    const act = accountOf("u-alpha");
    eq(passwordChecks(act.pw, act).filter((c) => !c.ok).map((c) => c.id), ["reuse"], "réutilise le mot de passe actuel");
    eq(failed(STRONG), [], "mot de passe valide");
    eq(setPassword(a.id, STRONG, STRONG + "x").reason, "CONFIRM", "confirmation différente");
    eq(setPassword(a.id, "faible", "faible").reason, "RULES", "règles");
    assert(!a.pw, "mot de passe enregistré malgré l'erreur");
  });
  test("Mot de passe oublié · réponse identique et aucun e-mail pour une adresse inconnue ou désactivée", () => {
    const n = db.outbox.length;
    eq(forgotStart("inconnu@alpha.exemple.test"), { ok: true }, "inconnue");
    eq(forgotStart("ancien.rh@gamma.exemple.test"), { ok: true }, "désactivée");
    eq(db.outbox.length, n, "e-mail envoyé");
    eq(forgotVerify("inconnu@alpha.exemple.test", FAKE_OTP).ok, false, "code accepté pour une adresse inconnue");
  });
  test("Mot de passe oublié · code → nouveau mot de passe → l'ancien ne marche plus ; active aussi une invitation expirée", () => {
    const a = accountOf("u-gamma"), old = a.pw;
    forgotStart(a.email);
    assert(lastMail(a.email, "CODE_REINIT"), "code envoyé");
    eq(forgotVerify(a.email, "123456").reason, "BAD", "faux code");
    const v = forgotVerify(a.email, FAKE_OTP);
    assert(v.ok && setPassword(v.accountId, STRONG, STRONG, "RESET").ok, "réinitialisation");
    eq(login(a.email, old).reason, "BAD", "ancien mot de passe");
    const d = accountOf("u-delta");
    forgotStart(d.email);
    const vd = forgotVerify(d.email, FAKE_OTP);
    assert(vd.ok && setPassword(vd.accountId, STRONG, STRONG, "RESET").ok && accountStatus(d) === "ACTIF", "invitation expirée activée");
  });
  test("Journal · comptes et connexion journalisés sans mot de passe, code ni adresse e-mail en clair", () => {
    const n = db.audit.length;
    const r = createCompany(NEWCO);
    login(NEWCO.rhEmail, "mauvais"); login("inconnu@alpha.exemple.test", "x");
    const token = r.account.activation.token;
    activateAccount(token, STRONG, STRONG); login(NEWCO.rhEmail, STRONG); verifyMfa(r.account.id, FAKE_OTP);
    forgotStart(NEWCO.rhEmail); replaceRh(r.company.id, "autre.rh@epsilon.exemple.test");
    const added = db.audit.slice(n), txt = JSON.stringify(added);
    ["ENTREPRISE_CREEE", "COMPTE_RH_CREE", "CONNEXION_ECHEC", "CONNEXION_OK", "COMPTE_ACTIVE", "MDP_OUBLIE_DEMANDE", "COMPTE_RH_DESACTIVE"].forEach((x) => assert(added.some((e) => e.action === x), `${x} absent`));
    assert(!txt.includes("@"), "adresse e-mail en clair dans le journal");
    assert(!txt.includes(STRONG) && !txt.includes(FAKE_OTP) && !txt.includes(token) && !txt.includes("mauvais"), "secret dans le journal");
  });
  test("Écran · l'admin Yodan ne voit jamais le lien d'activation (aperçu masqué, liste des entreprises)", () => {
    const r = createCompany(NEWCO), token = r.account.activation.token;
    const html = mailHtml(lastMail(NEWCO.rhEmail, "INVITATION"), true);
    assert(!html.includes(token) && html.includes("••••"), "lien visible dans l'aperçu");
    const div = document.createElement("div");
    session.accountId = "u-yodan"; state.yodan.tab = "entreprises"; renderYCompanies(div);
    assert(!div.innerHTML.includes(token) && div.textContent.includes(NEWCO.rhEmail), "liste des entreprises");
    state.yodan.tab = "campagnes";
  });

  /* ---------- Modification d'une entreprise ---------- */
  test("Entreprise · modifier le nom (unique, hors elle-même) sans toucher au compte RH", () => {
    const rh = rhOf("alpha");
    assert(updateCompany("alpha", { name: "Entreprise Démo Alpha", domain: "alpha.exemple.test" }).ok, "garder son propre nom refusé");
    assert(updateCompany("alpha", { name: "Groupe Démo Alpha", domain: "alpha.exemple.test" }).ok, "renommage refusé");
    eq([companyOf("alpha").name, rhOf("alpha").id], ["Groupe Démo Alpha", rh.id], "nom modifié, RH inchangé");
    assert(updateCompany("alpha", { name: "Société Test Beta", domain: "alpha.exemple.test" }).errors.name, "nom d'une autre entreprise accepté");
    assert(updateCompany("alpha", { name: " ", domain: "alpha.exemple.test" }).errors.name, "nom vide accepté");
  });
  test("Entreprise · domaine verrouillé dès qu'une campagne a commencé ou qu'une invitation est partie", () => {
    eq(["alpha", "beta", "gamma", "delta"].map(domainLocked), [true, true, false, false], "verrous des données de démo");
    assert(updateCompany("alpha", { name: "Entreprise Démo Alpha", domain: "alpha2.exemple.test", rhEmail: "rh@alpha2.exemple.test" }).errors.domain, "domaine modifié malgré une campagne commencée");
    eq(companyOf("alpha").domain, "alpha.exemple.test", "domaine changé");
    createCampaign({ name: "Plus tard", companyId: "delta", start: addDays(TODAY, 5), end: addDays(TODAY, 9) });
    eq(domainLocked("delta"), false, "une campagne à venir sans invitation ne verrouille pas");
    inviteRecipients(db.campaigns[db.campaigns.length - 1].id, ["salarie@delta.exemple.test"]);
    eq(domainLocked("delta"), true, "une invitation envoyée verrouille");
  });
  test("Entreprise · changer le domaine oblige à remplacer le RH par une adresse du nouveau domaine", () => {
    const old = rhOf("delta");
    assert(updateCompany("delta", { name: "Entreprise Exemple Delta", domain: "delta2.exemple.test", rhEmail: "" }).errors.rhEmail, "sans nouveau RH");
    assert(/@delta2/.test(updateCompany("delta", { name: "Entreprise Exemple Delta", domain: "delta2.exemple.test", rhEmail: "rh@delta.exemple.test" }).errors.rhEmail), "RH de l'ancien domaine accepté");
    assert(updateCompany("delta", { name: "Entreprise Exemple Delta", domain: "gmail.com", rhEmail: "rh@gmail.com" }).errors.domain, "messagerie publique");
    assert(updateCompany("delta", { name: "Entreprise Exemple Delta", domain: "alpha.exemple.test", rhEmail: "x@alpha.exemple.test" }).errors.domain, "domaine d'une autre entreprise");
    const r = updateCompany("delta", { name: "Entreprise Exemple Delta", domain: "@Delta2.exemple.test", rhEmail: "rh.demo@delta2.exemple.test" });
    assert(r.ok, "modification refusée");
    eq([companyOf("delta").domain, old.disabled, rhOf("delta").email, accountStatus(rhOf("delta"))], ["delta2.exemple.test", true, "rh.demo@delta2.exemple.test", "INVITE"], "nouveau domaine + nouveau RH invité");
    assert(linkOf("rh.demo@delta2.exemple.test"), "lien d'activation envoyé");
  });

  /* ---------- Déconnexion après inactivité ---------- */
  test(`Session · déconnexion automatique après ${SESSION_IDLE_MIN} minutes d'inactivité, pas avant`, () => {
    const t0 = Date.parse("2026-11-17T09:00:00Z"), min = 60000;
    eq([isIdleExpired(t0, t0), isIdleExpired(t0, t0 + 29 * min + 59000), isIdleExpired(t0, t0 + 30 * min), isIdleExpired(t0, t0 + 2 * 60 * min)], [false, false, true, true], "seuil");
    const keep = { role: state.role, auth: state.auth };
    try {
      openSession("u-alpha");
      session.lastActivity = Date.now() - (SESSION_IDLE_MIN * min + 1000);
      checkIdle();
      eq(session.accountId, null, "toujours connecté");
      assert(/inactivité/.test(state.auth.info), "message de déconnexion absent");
      assert(db.audit.some((e) => e.action === "DECONNEXION_INACTIVITE" && e.target === "u-alpha"), "non journalisé");
      openSession("u-alpha");
      session.lastActivity = Date.now() - 10 * min;
      checkIdle();
      eq(session.accountId, "u-alpha", "déconnecté trop tôt");
    } finally { state.role = keep.role; state.auth = keep.auth; session.accountId = null; }
  });

  const ok = results.filter((r) => r.ok).length, ko = results.length - ok;
  console.group(`Tests de cohérence : ${ok} OK / ${ko} KO`);
  results.forEach((r) => (r.ok ? console.log("✔", r.name) : console.error("✘", r.name, "→", r.err)));
  console.groupEnd();
  window.TEST_RESULTS = { ok, ko, failed: results.filter((r) => !r.ok).map((r) => `${r.name} → ${r.err}`), results };
  renderNotes();
  return `${ok} OK / ${ko} KO` + (ko ? "\n" + window.TEST_RESULTS.failed.join("\n") : "");
}

if (new URLSearchParams(location.search).has("tests")) runTests();
