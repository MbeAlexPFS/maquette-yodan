/*
 * Tests de cohérence (règles métier) — CLAUDE.md §9.
 * Lancement : ouvrir index.html?tests=1 (résultat dans la console + encadré du panneau Notes UX),
 * ou `agent-browser eval "JSON.stringify(runTests())"`.
 * Une fois la maquette validée, ces noms de règles deviennent les tests PHPUnit du projet
 * (KpiStats et les nouvelles méthodes de statistiques).
 */
"use strict";

function runTests() {
  const A = window.ATMP;
  const results = [];
  const original = A.db;
  const test = (name, fn) => {
    try { fn(); results.push({ name, ok: true }); } catch (err) { results.push({ name, ok: false, err: err.message }); } finally { A.db = original; }
  };
  const assert = (cond, msg) => { if (!cond) { throw new Error(msg); } };
  const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)})`);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const db = original;
  const ALL = { start: "2025-09-01", end: A.TODAY, agencyId: "" };
  const YEAR = { start: "2026-01-01", end: "2026-12-31", agencyId: "" };
  const DEFAULT = { start: "2026-01-01", end: A.TODAY, agencyId: "" };
  const FUTURE = { start: "2027-01-01", end: "2027-03-31", agencyId: "" };

  /* ---------- Invariants des données ---------- */
  test("Invariant · zone = seuils PCL-5 (≤ 42 vert, 43–50 orange, ≥ 51 rouge), initiale et suivis", () => {
    eq([0, 42, 43, 50, 51, 80].map(A.zoneOf), ["VERT", "VERT", "ORANGE", "ORANGE", "ROUGE", "ROUGE"], "seuils");
    db.forEach((d) => {
      assert(d.zone === A.zoneOf(d.score), `${d.id} : zone initiale incohérente`);
      (d.care?.followUps || []).forEach((u) => assert(u.zone === A.zoneOf(u.score) && u.score >= 0 && u.score <= 80, `${d.id} : suivi incohérent`));
    });
  });
  test("Invariant · vert ⇒ refus automatique ; rouge ⇒ accord automatique ; orange ⇒ jamais automatique", () => {
    db.forEach((d) => {
      if (d.zone === "VERT") { assert(d.decision === "REJECTED" && d.automatic && d.decidedAt === d.createdAt, `${d.id} vert`); }
      if (d.zone === "ROUGE") { assert(d.decision === "APPROVED" && d.automatic && d.decidedAt === d.createdAt, `${d.id} rouge`); }
      if (d.zone === "ORANGE") { assert(!d.automatic, `${d.id} orange automatique`); }
    });
  });
  test("Invariant · « en attente » ⇒ ni date de décision, ni prise en charge ; décidé ⇒ date ≥ dépôt", () => {
    db.forEach((d) => {
      if (d.decision === "PENDING") { assert(d.decidedAt === null && d.care === null && d.zone === "ORANGE", `${d.id}`); }
      else { assert(d.decidedAt >= d.createdAt && d.decidedAt <= A.NOW, `${d.id} date de décision`); }
    });
  });
  test("Invariant · prise en charge ⇔ accord, ouverte à la date de décision", () => {
    db.forEach((d) => {
      assert(!!d.care === (d.decision === "APPROVED"), `${d.id} : prise en charge sans accord (ou l'inverse)`);
      if (d.care) { assert(d.care.openedAt === d.decidedAt, `${d.id} : ouverture ≠ décision`); }
    });
  });
  test("Invariant · bon émis seulement après la décision définitive (fin du délai de recours pour un orange)", () => {
    db.filter((d) => d.care?.voucherAt).forEach((d) => {
      assert(d.care.voucherAt >= d.finalAt && d.care.voucherAt <= A.NOW, `${d.id} : bon avant la décision définitive`);
      if (!d.automatic) { assert(d.finalAt === d.decidedAt + A.AGENCIES.find((a) => a.id === d.agencyId).appealHours * A.H, `${d.id} : délai de recours`); }
    });
  });
  test("Invariant · affectation après le bon ; séances après l'affectation ; passé ⇒ statut réel, futur ⇒ planifiée", () => {
    db.filter((d) => d.care).forEach((d) => {
      const c = d.care;
      if (c.assignedAt) { assert(c.voucherAt && c.assignedAt >= c.voucherAt, `${d.id} : affecté avant le bon`); }
      if (c.sessions.length) { assert(c.assignedAt, `${d.id} : séance sans praticien`); }
      c.sessions.forEach((s) => {
        assert(s.at >= c.assignedAt, `${d.id} : séance avant l'affectation`);
        assert(s.at > A.NOW ? s.status === "SCHEDULED" : s.status !== "SCHEDULED", `${d.id} : statut de séance incohérent avec la date`);
      });
    });
  });
  test("Invariant · rapport final ⇒ au moins une séance réalisée, après la dernière séance, aucune séance planifiée ensuite", () => {
    db.filter((d) => d.care?.report).forEach((d) => {
      const c = d.care;
      assert(c.sessions.some((s) => s.status === "PRESENT"), `${d.id} : rapport sans séance`);
      assert(c.report.at >= c.sessions[c.sessions.length - 1].at && c.report.at <= A.NOW, `${d.id} : date du rapport`);
      assert(!c.sessions.some((s) => s.status === "SCHEDULED"), `${d.id} : séance planifiée après clôture`);
      assert(["CLOSED", "NEW_CARE"].includes(c.report.outcome), `${d.id} : issue inconnue`);
    });
  });
  test("Invariant · suivis espacés de 2 mois, après l'ouverture, avant la clôture et pas dans le futur", () => {
    db.filter((d) => d.care).forEach((d) => {
      let prev = d.care.openedAt;
      d.care.followUps.forEach((u) => {
        assert(u.at === A.addMonths(prev, A.FOLLOW_UP_MONTHS), `${d.id} : intervalle de suivi`);
        assert(u.at <= A.NOW && (!d.care.report || u.at <= d.care.report.at), `${d.id} : suivi hors période de prise en charge`);
        prev = u.at;
      });
    });
  });

  /* ---------- Cohérence entre blocs ---------- */
  test("Cohérence · Nouvelles demandes = 1re étape du parcours = total du camembert Prise en charge", () => {
    [DEFAULT, ALL, { ...DEFAULT, agencyId: "ag-bouake" }].forEach((f) => {
      const n = A.tiles(db, f).newRequests;
      eq(A.funnel(db, f).stages[0].n, n, `parcours (${f.agencyId || "toutes"})`);
      eq(sum(Object.values(A.decisionCounts(A.cohort(db, f)))), n, "camembert décisions");
    });
  });
  test("Cohérence · histogramme de l'année = camembert Prise en charge sur l'année, décision par décision", () => {
    const { periods } = A.periods("year", A.TODAY);
    const ev = A.evolution(db, "", periods);
    const dc = A.decisionCounts(A.cohort(db, YEAR));
    A.DECISIONS.forEach(([k]) => eq(sum(ev[k]), dc[k], `décision ${k}`));
  });
  test("Cohérence · parcours : chaque étape ≤ la précédente ; accordées + refusées + en attente = demandes", () => {
    [DEFAULT, ALL].forEach((f) => {
      const fu = A.funnel(db, f);
      fu.stages.forEach((s, i) => { if (i) { assert(s.n <= fu.stages[i - 1].n, `${s.key} > étape précédente`); } });
      eq(fu.stages[1].n + fu.rejected + fu.pending, fu.stages[0].n, "partition des demandes");
    });
  });
  test("Cohérence · camembert Zones = zones des demandes + zones des suivis de la période", () => {
    const z = A.zoneCounts(db, DEFAULT);
    const follow = db.flatMap((d) => d.care?.followUps || []).filter((u) => u.at >= A.parseDay(DEFAULT.start) && u.at < A.addDays(A.parseDay(DEFAULT.end), 1)).length;
    eq(sum(Object.values(z)), A.cohort(db, DEFAULT).length + follow, "total");
  });
  test("Cohérence · profil : pour chaque dimension, la somme des lignes (Autres compris) = demandes", () => {
    const n = A.cohort(db, DEFAULT).length;
    A.DIMENSIONS.forEach((dim) => eq(sum(A.zonesBy(db, DEFAULT, dim.key).map((r) => r.n)), n, dim.label));
  });
  test("Cohérence · agences : somme des demandes = total sans filtre ; somme des « en attente » = bloc En attente", () => {
    const rows = A.agencies(db, DEFAULT);
    eq(sum(rows.map((r) => r.n)), A.cohort(db, DEFAULT).length, "demandes");
    eq(sum(rows.map((r) => r.pendingToday)), sum(Object.values(A.pending(db, DEFAULT).decision)), "en attente");
  });
  test("Cohérence · filtre agence : la somme des agences filtrées une à une = toutes agences (tous les blocs)", () => {
    const per = (fn) => sum(A.AGENCIES.map((a) => fn({ ...DEFAULT, agencyId: a.id })));
    eq(per((f) => A.cohort(db, f).length), A.cohort(db, DEFAULT).length, "demandes");
    eq(per((f) => A.tiles(db, f).closed), A.tiles(db, DEFAULT).closed, "dossiers clos");
    eq(per((f) => A.pcl5(db, f).n), A.pcl5(db, DEFAULT).n, "PCL-5");
    eq(per((f) => sum(Object.values(A.attendance(db, f).counts).flat())), sum(Object.values(A.attendance(db, DEFAULT).counts).flat()), "séances");
  });
  test("Cohérence · taux de présence (tuile) = séances « présent » / séances passées du graphe Assiduité", () => {
    const a = A.attendance(db, DEFAULT);
    const all = sum(Object.values(a.counts).flat());
    const t = A.tiles(db, DEFAULT);
    eq(all, t.sessionsPast, "séances passées");
    eq(Math.round((sum(a.counts.PRESENT) / all) * 1000) / 10, t.attendanceRate, "taux");
  });
  test("Cohérence · PCL-5 : amélioration + stable + aggravation = transitions = prises en charge suivies", () => {
    const p = A.pcl5(db, DEFAULT);
    eq(sum(Object.values(p.trend)), p.n, "tendance");
    eq(sum(p.rows.map((r) => sum(Object.values(r.counts)))), p.n, "transitions");
    assert(p.n > 0, "aucune paire : données de démonstration insuffisantes");
  });

  /* ---------- Visibilité / protection (règle 4.1.7) ---------- */
  test("Masquage · aucune case affichée entre 1 et 4 (profil, PCL-5), et jamais une seule case masquée dans une ligne", () => {
    const rows = A.DIMENSIONS.flatMap((dim) => A.zonesBy(db, DEFAULT, dim.key)).concat(A.zonesBy(db, { ...DEFAULT, agencyId: "ag-korhogo" }, "ville"));
    rows.forEach((r) => {
      Object.values(r.shown).forEach((v) => assert(v === null || v === 0 || v >= A.MIN_CELL, `${r.label} : case de ${v} affichée`));
      if (!r.hidden) { assert(Object.keys(r.shown).filter((k) => r.shown[k] === null && r.counts[k] > 0).length !== 1, `${r.label} : une seule case masquée`); }
    });
  });
  test("Masquage · maskRow : masquage secondaire et cas limites", () => {
    eq(A.maskRow({ a: 10, b: 3, c: 20 }), { a: null, b: null, c: 20 }, "une petite case ⇒ masquer aussi la plus petite suivante");
    eq(A.maskRow({ a: 10, b: 3, c: 2 }), { a: 10, b: null, c: null }, "deux petites cases");
    eq(A.maskRow({ a: 10, b: 0, c: 20 }), { a: 10, b: 0, c: 20 }, "zéro reste affiché");
    eq(A.maskRow({ a: 4, b: 0, c: 0 }), { a: null, b: 0, c: 0 }, "seule case non nulle");
  });
  test("Masquage · lignes < 5 regroupées dans « Autres » ; « Autres » < 5 entièrement masqué", () => {
    A.DIMENSIONS.forEach((dim) => A.zonesBy(db, { ...DEFAULT, agencyId: "ag-korhogo" }, dim.key).forEach((r) => {
      if (!r.isOther) { assert(r.n >= A.MIN_CELL, `${dim.label} / ${r.label} : ligne de ${r.n} non regroupée`); }
      if (r.n < A.MIN_CELL) { assert(r.hidden && Object.values(r.shown).every((v) => v === null), `${r.label} : petite ligne visible`); }
    }));
  });
  test("Masquage · agence de moins de 5 demandes : taux et délai non affichés", () => {
    const small = A.agencies(db, DEFAULT).filter((r) => r.small);
    assert(small.length >= 1, "le jeu de démonstration doit contenir une petite agence");
    small.forEach((r) => assert(r.approvalRate === null && r.decisionMedian === null, `${r.name}`));
  });

  /* ---------- Parcours de bout en bout ---------- */
  test("Parcours · un orange déposé hier puis accordé : en attente +1, puis prise en charge +1, sans doublon", () => {
    const facts = A.randomFacts(A.rng(7), "TEST", A.NOW - 20 * A.H, "ag-plateau");
    facts.score = 46;
    facts.validatorDelayH = 30; // décision dans 10 h
    facts.orangeApproved = true;
    const before = A.funnel(db, DEFAULT), pendBefore = A.pending(db, DEFAULT).decision;
    A.db = [...db, A.deriveDossier(facts)];
    const mid = A.funnel(A.db, DEFAULT);
    eq(mid.stages[0].n, before.stages[0].n + 1, "demandes +1");
    eq(mid.pending, before.pending + 1, "en attente +1");
    eq(A.pending(A.db, DEFAULT).decision.lt48, pendBefore.lt48 + 1, "attente < 48 h +1");
    const later = A.NOW + 12 * A.H;
    A.db = [...db, A.deriveDossier(facts, later)];
    const after = A.funnel(A.db, DEFAULT);
    eq(after.pending, before.pending, "plus en attente");
    eq(after.stages[1].n, before.stages[1].n + 1, "prise en charge +1");
    eq(after.stages[2].n, before.stages[2].n, "pas de bon pendant le délai de recours");
  });

  /* ---------- Cas limites ---------- */
  test("Cas limite · période sans donnée : tout vaut 0 ou « — », aucun NaN", () => {
    const t = A.tiles(db, FUTURE);
    eq([t.newRequests, t.closed, t.attendanceRate], [0, 0, null], "tuiles");
    assert(A.funnel(db, FUTURE).stages.every((s) => s.n === 0), "parcours");
    assert(A.delays(db, FUTURE).every((d) => d.n === 0 && d.median === null), "délais");
    eq(A.pcl5(db, FUTURE).n, 0, "PCL-5");
    assert(A.DIMENSIONS.every((dim) => A.zonesBy(db, FUTURE, dim.key).length === 0), "profil");
    assert(!JSON.stringify(A.agencies(db, FUTURE)).includes("NaN"), "agences");
  });
  test("Cas limite · scores extrêmes 0 et 80 : décision et suivis dans les bornes", () => {
    [0, 80].forEach((score) => {
      const f = A.randomFacts(A.rng(score + 1), `X${score}`, A.parseDay("2026-01-05"), "ag-daloa");
      f.score = score;
      f.followUpDeltas = [-40, -40, 40, 40, 40, 40];
      const d = A.deriveDossier(f);
      eq(d.decision, score ? "APPROVED" : "REJECTED", `score ${score}`);
      (d.care?.followUps || []).forEach((u) => assert(u.score >= 0 && u.score <= 80, "suivi hors bornes"));
    });
  });
  test("Cas limite · délais : 1 seul dossier ⇒ médiane = sa valeur ; jour sans dépôt ⇒ « — »", () => {
    const one = db.find((d) => !d.automatic && d.decidedAt);
    A.db = [one];
    const dl = A.delays(A.db, ALL).find((x) => x.key === "decision");
    eq(dl.n, 1, "effectif");
    eq(Math.round(dl.median * 1000), Math.round(((one.decidedAt - one.createdAt) / A.D) * 1000), "médiane");
    A.db = original;
    eq(A.delays(db, { start: "2025-08-01", end: "2025-08-01", agencyId: "" })[0].median, null, "jour avant le début des données");
  });

  /* ---------- Interface ---------- */
  test("Interface · aucun caractère spécial dans les textes, infobulles et libellés accessibles (tous les profils affichés)", () => {
    const FORBIDDEN = /[→←↑↓·≥≤«»▲▼‹›–—…<>]|\p{Extended_Pictographic}/u;
    const strip = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent; };
    const scan = () => {
      const texts = [document.querySelector(".mock-bar").textContent, document.getElementById("app").textContent];
      document.querySelectorAll("#app [data-tip]").forEach((el) => texts.push(strip(el.dataset.tip)));
      document.querySelectorAll("#app [aria-label]").forEach((el) => texts.push(el.getAttribute("aria-label")));
      texts.forEach((t) => { const m = t.match(FORBIDDEN); assert(!m, `caractère « ${m && m[0]} » trouvé dans : ${t.slice(Math.max(0, t.indexOf(m && m[0]) - 30), t.indexOf(m && m[0]) + 10)}`); });
    };
    try {
      A.DIMENSIONS.forEach((dim) => { document.querySelector(`[data-dim="${dim.key}"]`).click(); scan(); });
    } finally { document.querySelector('[data-dim="agent"]').click(); }
  });
  test("Interface · chaque carte se replie et se déplie ; vue d'ensemble dépliée, autres cartes repliées au chargement", () => {
    const folds = [...document.querySelectorAll("#app .fold")];
    assert(folds.length === 10, `10 cartes attendues, ${folds.length} trouvées`);
    folds.forEach((b) => {
      const body = document.getElementById(b.getAttribute("aria-controls"));
      const initial = b.getAttribute("aria-expanded") === "true";
      eq(body.hidden, !initial, `${b.textContent} : état initial`);
      eq(initial, ["b-curve", "b-zone", "b-decision"].includes(body.id), `${b.textContent} : dépliée par défaut`);
      b.click(); eq(body.hidden, initial, `${b.textContent} : après un clic`);
      b.click(); eq(body.hidden, !initial, `${b.textContent} : après deux clics`);
    });
  });

  test("Interface · en mobile, cartes dépliées : aucune carte ne déborde du cadre du téléphone", () => {
    const folds = [...document.querySelectorAll("#app .fold")];
    const before = folds.map((b) => b.getAttribute("aria-expanded") === "true");
    const stage = document.getElementById("stage");
    const wasMobile = stage.classList.contains("is-mobile");
    try {
      stage.classList.add("is-mobile");
      folds.forEach((b) => A.setFold(b, true));
      const app = document.getElementById("app").getBoundingClientRect();
      document.querySelectorAll("#app .card").forEach((c) => {
        const r = c.getBoundingClientRect();
        assert(r.right <= app.right + 1, `${(c.querySelector(".fold") || c).textContent.trim().slice(0, 40)} déborde de ${Math.round(r.right - app.right)} px`);
      });
    } finally {
      stage.classList.toggle("is-mobile", wasMobile);
      folds.forEach((b, i) => A.setFold(b, before[i]));
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
