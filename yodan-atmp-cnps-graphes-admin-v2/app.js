/*
 * Maquette ATMP CNPS — graphes admin v2. Données 100 % fictives, générées de façon déterministe.
 *
 * Principe (CLAUDE.md §9) : le générateur ne tire que des FAITS (date, profil, score, délais, présences).
 * Statuts, prises en charge, bons, séances, rapports et suivis sont DÉRIVÉS par deriveDossier(),
 * avec les règles de l'application (Evaluation::automaticDecision, PriseEnCharge::isDecisionFinal…).
 * Tous les chiffres affichés sortent des fonctions de STATS ci-dessous, partagées avec tests.js.
 */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const H = 3600e3, D = 24 * H;
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
  const TODAY = "2026-11-17";
  const NOW = new Date(2026, 10, 17, 17, 0).getTime();

  // ---------- Référentiels (repris de l'application) ----------
  const ZONES = [
    ["VERT", "Sous le seuil", "var(--color-success)"],
    ["ORANGE", "Symptômes modérés", "var(--color-warning)"],
    ["ROUGE", "Symptômes significatifs", "var(--color-danger)"],
  ];
  const DECISIONS = [
    ["APPROVED", "Prise en charge", "var(--color-success)"],
    ["PENDING", "En attente", "var(--color-warning)"],
    ["REJECTED", "Non prise en charge", "var(--color-danger)"],
  ];
  const ATTENDANCE = [
    ["PRESENT", "Présent", "var(--color-success)"],
    ["POSTPONED", "Reporté", "var(--color-warning)"],
    ["ABSENT", "Absent", "var(--color-danger)"],
  ];
  /** Pcl5 : score brut 0–80 ; ≤ 42 VERT, 43–50 ORANGE, ≥ 51 ROUGE. */
  const VERT_MAX = 42, ORANGE_MAX = 50;
  const FOLLOW_UP_MONTHS = 2;
  /** Hypothèse à valider : variation d'au moins 10 points = changement réel. */
  const PCL5_CHANGE = 10;
  const MIN_CELL = 5;

  const AGENCIES = [
    { id: "ag-plateau", name: "Agence Plateau", appealHours: 168, weight: 30 },
    { id: "ag-yopougon", name: "Agence Yopougon", appealHours: 168, weight: 24 },
    { id: "ag-bouake", name: "Agence Bouaké", appealHours: 72, weight: 16 },
    { id: "ag-sanpedro", name: "Agence San-Pédro", appealHours: 168, weight: 13 },
    { id: "ag-daloa", name: "Agence Daloa", appealHours: 120, weight: 10 },
    { id: "ag-korhogo", name: "Agence Korhogo", appealHours: 168, weight: 6 },
    { id: "ag-odienne", name: "Agence Odienné (ouverte en nov.)", appealHours: 168, weight: 0 },
  ];
  /** [libellé, poids, effet sur le score] : l'effet rend le croisement agent × zone parlant. */
  const AGENTS = [
    ["Machine", 16, 2], ["Véhicule / accident de la route", 22, 9], ["Outil à main", 12, -6], ["Chute de plain-pied", 14, -5],
    ["Chute de hauteur", 9, 6], ["Manutention / objet lourd", 14, -7], ["Produit chimique", 4, 1], ["Électricité", 3, 4],
    ["Agression", 5, 14], ["Animal", 1, 0],
  ];
  const CITIES = [["Abidjan", 52], ["Bouaké", 9], ["San-Pédro", 8], ["Daloa", 6], ["Yamoussoukro", 5], ["Korhogo", 4], ["Gagnoa", 3], ["Man", 3], ["Divo", 3], ["Abengourou", 2], ["Soubré", 2], ["Bondoukou", 1], ["Odienné", 0.4], ["Boundiali", 0.3]];
  const MATRIMONIAL = [["Marié(e)", 48], ["Célibataire", 38], ["Divorcé(e)", 8], ["Veuf(ve)", 3]];
  const AGE_BANDS = [["18-25 ans", 18, 25], ["26-35 ans", 26, 35], ["36-45 ans", 36, 45], ["46-55 ans", 46, 55], ["56 ans et plus", 56, 120]];
  const NOT_SET = "Non renseigné";

  // ---------- Outils ----------
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
  const addMonths = (t, n) => { const d = new Date(t); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.getTime(); };
  const monday = (t) => { const d = new Date(t); return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), -((d.getDay() + 6) % 7)); };
  const dayMonth = (t) => { const d = new Date(t); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; };
  const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const fmtPct = (v) => `${String(v).replace(".", ",")} %`;
  const fmtNum = (v) => String(v).replace(".", ",");
  const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const svg = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) { el.setAttribute(k, v); } return el; };
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, list) => { const total = sum(list.map((x) => x[1])); let v = r() * total; for (const x of list) { v -= x[1]; if (v < 0) { return x; } } return list[list.length - 1]; };
  const between = (r, a, b) => a + r() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Quantile linéaire ; null si la liste est vide. */
  function quantile(values, q) {
    if (!values.length) { return null; }
    const s = [...values].sort((a, b) => a - b);
    const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  }

  // ============================================================
  // RÈGLES MÉTIER (fonctions pures, partagées avec tests.js)
  // ============================================================
  const zoneOf = (score) => (score <= VERT_MAX ? "VERT" : score <= ORANGE_MAX ? "ORANGE" : "ROUGE");
  const ageBand = (age) => (age == null ? NOT_SET : AGE_BANDS.find(([, a, b]) => age >= a && age <= b)[0]);
  const agencyOf = (id) => AGENCIES.find((a) => a.id === id);

  /**
   * Dérive tout l'état d'un dossier à partir de ses faits, à l'instant `now`.
   * facts : { id, createdAt, agencyId, profile, score, validatorDelayH, orangeApproved, voucherDelayD, assignDelayD,
   *           firstSessionDelayD, plannedSessions, attendanceRolls[], reportDelayD, renew, followUpDeltas[] }
   */
  function deriveDossier(f, now = NOW) {
    const zone = zoneOf(f.score);
    const d = { ...f, zone, decision: "PENDING", automatic: false, decidedAt: null, finalAt: null, care: null };
    if (zone !== "ORANGE") {
      d.decision = zone === "VERT" ? "REJECTED" : "APPROVED";
      d.automatic = true;
      d.decidedAt = f.createdAt;
      d.finalAt = f.createdAt; // décision automatique : définitive dès l'envoi
    } else if (f.createdAt + f.validatorDelayH * H <= now) {
      d.decision = f.orangeApproved ? "APPROVED" : "REJECTED";
      d.decidedAt = f.createdAt + f.validatorDelayH * H;
      d.finalAt = d.decidedAt + agencyOf(f.agencyId).appealHours * H; // fin du délai de recours
    }
    if (d.decision !== "APPROVED") { return d; }

    const care = { openedAt: d.decidedAt, voucherAt: null, assignedAt: null, sessions: [], report: null, followUps: [] };
    d.care = care;
    const voucherAt = Math.max(care.openedAt, d.finalAt) + f.voucherDelayD * D;
    if (voucherAt <= now) {
      care.voucherAt = voucherAt;
      const assignedAt = voucherAt + f.assignDelayD * D;
      if (assignedAt <= now) {
        care.assignedAt = assignedAt;
        // Séances hebdomadaires ; un report ajoute une séance la semaine suivante.
        let at = assignedAt + f.firstSessionDelayD * D, present = 0, k = 0;
        while (present < f.plannedSessions && care.sessions.length < 40) {
          if (at > now) { care.sessions.push({ at, status: "SCHEDULED" }); break; }
          const roll = f.attendanceRolls[k++ % f.attendanceRolls.length];
          const status = roll < 0.78 ? "PRESENT" : roll < 0.88 ? "POSTPONED" : "ABSENT";
          care.sessions.push({ at, status });
          if (status === "PRESENT") { present++; }
          at += 7 * D;
        }
        const last = care.sessions[care.sessions.length - 1];
        if (present >= f.plannedSessions && last.status !== "SCHEDULED") {
          const reportAt = last.at + f.reportDelayD * D;
          if (reportAt <= now) { care.report = { at: reportAt, outcome: f.renew ? "NEW_CARE" : "CLOSED" }; }
        }
      }
    }
    // Tests de suivi tous les 2 mois tant que la prise en charge est ouverte.
    const end = Math.min(now, care.report ? care.report.at : Infinity);
    let score = f.score;
    for (let i = 0, at = addMonths(care.openedAt, FOLLOW_UP_MONTHS); at <= end && i < f.followUpDeltas.length; i++, at = addMonths(at, FOLLOW_UP_MONTHS)) {
      score = clamp(Math.round(score + f.followUpDeltas[i]), 0, 80);
      care.followUps.push({ at, score, zone: zoneOf(score) });
    }
    return d;
  }

  /** Faits fictifs d'un dossier (seul endroit où l'on tire au hasard). */
  function randomFacts(r, id, createdAt, agencyId) {
    const agent = pick(r, AGENTS);
    const age = r() < 0.03 ? null : Math.round(clamp(between(r, 20, 60) + (r() - 0.5) * 10, 18, 64));
    const base = 24 + r() * 40 + agent[2] + (r() - 0.5) * 8;
    const drift = r() < 0.15 ? 4 : -6; // ~15 % de trajectoires défavorables
    const n = 3 + Math.floor(r() * 4);
    return {
      id, createdAt, agencyId,
      profile: {
        sexe: r() < 0.71 ? "Homme" : "Femme",
        age, matrimonial: pick(r, MATRIMONIAL)[0], ville: pick(r, CITIES)[0], agent: agent[0],
        type: r() < 0.86 ? "AT" : "MP",
      },
      score: Math.round(clamp(base, 0, 80)),
      validatorDelayH: Math.round(((x) => (x < 0.4 ? between(r, 2, 48) : x < 0.7 ? between(r, 48, 168) : between(r, 168, 720)))(r())),
      orangeApproved: r() < 0.62,
      voucherDelayD: Math.round(between(r, 0.5, r() < 0.8 ? 8 : 25) * 10) / 10,
      assignDelayD: Math.round(between(r, 0.2, 5) * 10) / 10,
      firstSessionDelayD: Math.round(between(r, 2, 12)),
      plannedSessions: n + Math.floor(r() * 5),
      attendanceRolls: Array.from({ length: 16 }, () => r()),
      reportDelayD: Math.round(between(r, 2, 12)),
      renew: r() < 0.14,
      followUpDeltas: Array.from({ length: 6 }, () => drift + (r() - 0.5) * 20),
    };
  }

  function generate(seed = 20261117) {
    const r = rng(seed);
    const out = [];
    let n = 0;
    for (let t = parseDay("2025-09-01"); t <= NOW; t = addDays(t, 1)) {
      const day = new Date(t).getDay();
      const volume = day === 0 || day === 6 ? (r() < 0.3 ? 1 : 0) : 1 + Math.floor(r() * 5);
      for (let k = 0; k < volume; k++) {
        const createdAt = t + (8 + r() * 9) * H;
        if (createdAt > NOW) { continue; }
        const agency = pick(r, AGENCIES.map((a) => [a.id, a.weight]))[0];
        out.push(randomFacts(r, `D${String(++n).padStart(4, "0")}`, createdAt, agency));
      }
    }
    // Agence ouverte récemment : 3 demandes seulement (cas limite « effectif < 5 »).
    ["2026-11-10", "2026-11-12", "2026-11-16"].forEach((day) => out.push(randomFacts(r, `D${String(++n).padStart(4, "0")}`, parseDay(day) + 10 * H, "ag-odienne")));
    return out.map((f) => deriveDossier(f));
  }

  // ============================================================
  // STATISTIQUES (fonctions pures : (dossiers, filtres) → agrégats)
  // ============================================================
  /** filtres : { start: "AAAA-MM-JJ", end: "AAAA-MM-JJ" (inclus), agencyId: "" | id } */
  const inPeriod = (t, f) => t >= parseDay(f.start) && t < addDays(parseDay(f.end), 1);
  const byAgency = (db, f) => (f.agencyId ? db.filter((d) => d.agencyId === f.agencyId) : db);
  /** Demandes (évaluations initiales) déposées dans la période. */
  const cohort = (db, f) => byAgency(db, f).filter((d) => inPeriod(d.createdAt, f));

  function decisionCounts(list) {
    const c = { APPROVED: 0, PENDING: 0, REJECTED: 0 };
    list.forEach((d) => c[d.decision]++);
    return c;
  }

  /** Évaluations par zone : initiales ET suivis datés dans la période (comme KpiStats::zones). */
  function zoneCounts(db, f) {
    const c = { VERT: 0, ORANGE: 0, ROUGE: 0 };
    byAgency(db, f).forEach((d) => {
      if (inPeriod(d.createdAt, f)) { c[d.zone]++; }
      (d.care?.followUps || []).forEach((u) => { if (inPeriod(u.at, f)) { c[u.zone]++; } });
    });
    return c;
  }

  function tiles(db, f) {
    const list = byAgency(db, f);
    const sessions = list.flatMap((d) => d.care?.sessions || []).filter((s) => inPeriod(s.at, f) && s.status !== "SCHEDULED");
    return {
      newRequests: cohort(db, f).length,
      activeCares: list.filter((d) => d.care && d.care.voucherAt && !d.care.report).length,
      closed: list.filter((d) => d.care?.report?.outcome === "CLOSED" && inPeriod(d.care.report.at, f)).length,
      sessionsPast: sessions.length,
      attendanceRate: sessions.length ? pct(sessions.filter((s) => s.status === "PRESENT").length, sessions.length) : null,
    };
  }

  function funnel(db, f) {
    const c = cohort(db, f);
    const approved = c.filter((d) => d.decision === "APPROVED");
    const voucher = approved.filter((d) => d.care.voucherAt);
    const firstSession = voucher.filter((d) => d.care.sessions.some((s) => s.status === "PRESENT"));
    const report = firstSession.filter((d) => d.care.report);
    return {
      stages: [
        { key: "requests", label: "Demandes déposées", n: c.length },
        { key: "approved", label: "Prise en charge accordée", n: approved.length },
        { key: "voucher", label: "Bon émis", n: voucher.length },
        { key: "session", label: "1re séance réalisée", n: firstSession.length },
        { key: "report", label: "Rapport final remis", n: report.length },
      ],
      rejected: c.filter((d) => d.decision === "REJECTED").length,
      pending: c.filter((d) => d.decision === "PENDING").length,
      renewed: report.filter((d) => d.care.report.outcome === "NEW_CARE").length,
    };
  }

  function delays(db, f) {
    const c = cohort(db, f);
    const stat = (vals) => ({ n: vals.length, median: quantile(vals, 0.5), p25: quantile(vals, 0.25), p75: quantile(vals, 0.75) });
    const cares = c.filter((d) => d.care);
    return [
      { key: "decision", label: "De la demande à la décision", ...stat(c.filter((d) => !d.automatic && d.decidedAt).map((d) => (d.decidedAt - d.createdAt) / D)) },
      { key: "voucher", label: "De la décision au bon", ...stat(cares.filter((d) => d.care.voucherAt).map((d) => (d.care.voucherAt - d.care.openedAt) / D)) },
      { key: "session", label: "Du bon à la 1re séance", ...stat(cares.filter((d) => d.care.voucherAt && d.care.sessions.some((s) => s.status === "PRESENT")).map((d) => (d.care.sessions.find((s) => s.status === "PRESENT").at - d.care.voucherAt) / D)) },
      { key: "duration", label: "Durée de la prise en charge", ...stat(cares.filter((d) => d.care.report).map((d) => (d.care.report.at - d.care.openedAt) / D)) },
    ];
  }

  const PENDING_BUCKETS = [["lt48", "Moins de 48 h", "#9cc9e8"], ["d2to7", "2 à 7 jours", "#3d8fd0"], ["gt7", "Plus de 7 jours", "#0b3f73"]];
  const bucketOf = (ms) => (ms < 48 * H ? "lt48" : ms <= 7 * D ? "d2to7" : "gt7");
  /** Photo d'aujourd'hui (ignore la période) : attente de décision, et attente de bon. */
  function pending(db, f, now = NOW) {
    const list = byAgency(db, f);
    const empty = () => ({ lt48: 0, d2to7: 0, gt7: 0 });
    const decision = empty(), voucher = empty();
    let appeal = 0;
    list.filter((d) => d.decision === "PENDING").forEach((d) => decision[bucketOf(now - d.createdAt)]++);
    list.filter((d) => d.care && !d.care.voucherAt).forEach((d) => {
      if (d.finalAt > now) { appeal++; } else { voucher[bucketOf(now - d.finalAt)]++; }
    });
    return { decision, voucher, appeal };
  }

  /** Prises en charge (demandes de la période) avec au moins un suivi : initial vs dernier suivi. */
  function pcl5(db, f) {
    const pairs = cohort(db, f).filter((d) => d.care && d.care.followUps.length).map((d) => {
      const last = d.care.followUps[d.care.followUps.length - 1];
      return { from: d.zone, to: last.zone, before: d.score, after: last.score };
    });
    const trend = { better: 0, stable: 0, worse: 0 };
    pairs.forEach((p) => { trend[p.after <= p.before - PCL5_CHANGE ? "better" : p.after >= p.before + PCL5_CHANGE ? "worse" : "stable"]++; });
    const rows = ["ROUGE", "ORANGE"].map((z) => {
      const own = pairs.filter((p) => p.from === z);
      const counts = { VERT: 0, ORANGE: 0, ROUGE: 0 };
      own.forEach((p) => counts[p.to]++);
      return { key: z, label: `Initial ${ZONES.find((x) => x[0] === z)[1].toLowerCase()}`, counts };
    });
    const avg = (k) => (pairs.length ? Math.round(sum(pairs.map((p) => p[k])) / pairs.length) : null);
    return { n: pairs.length, trend, rows, avgBefore: avg("before"), avgAfter: avg("after") };
  }

  /** Mois (périodes) qui recoupent la période filtrée, 12 au plus (les plus récents). */
  function monthsOf(f) {
    const list = [];
    const s = new Date(parseDay(f.start)), e = parseDay(f.end);
    for (let t = new Date(s.getFullYear(), s.getMonth(), 1).getTime(); t <= e; t = addMonths(t, 1)) {
      const d = new Date(t);
      const start = Math.max(t, parseDay(f.start)), end = Math.min(addMonths(t, 1), addDays(e, 1));
      list.push({ start: isoDay(start), end: isoDay(end), label: MONTHS_SHORT[d.getMonth()], long: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return list.slice(-12);
  }

  function attendance(db, f) {
    const periods = monthsOf(f);
    const sessions = byAgency(db, f).flatMap((d) => d.care?.sessions || []).filter((s) => s.status !== "SCHEDULED");
    const counts = Object.fromEntries(ATTENDANCE.map(([k]) => [k, periods.map(() => 0)]));
    sessions.forEach((s) => {
      const day = isoDay(s.at);
      const i = periods.findIndex((p) => day >= p.start && day < p.end);
      if (i >= 0) { counts[s.status][i]++; }
    });
    return { periods, counts };
  }

  /**
   * Masquage des petites cases (règle 4.1.7) sur une ligne { clé: effectif }.
   * Cases de 1 à 4 masquées (null). Si une seule case serait masquée, on masque aussi la plus petite
   * case non nulle suivante (sinon on la retrouverait par soustraction du total).
   */
  function maskRow(counts) {
    const out = { ...counts };
    const keys = Object.keys(counts);
    const small = keys.filter((k) => counts[k] > 0 && counts[k] < MIN_CELL);
    small.forEach((k) => { out[k] = null; });
    if (small.length === 1) {
      const next = keys.filter((k) => out[k] !== null && counts[k] > 0).sort((a, b) => counts[a] - counts[b])[0];
      if (next) { out[next] = null; }
    }
    return out;
  }

  const DIMENSIONS = [
    { key: "agent", label: "Agent matériel", of: (d) => d.profile.agent, order: "rouge" },
    { key: "sexe", label: "Sexe", of: (d) => d.profile.sexe, order: ["Homme", "Femme"] },
    { key: "age", label: "Âge", of: (d) => ageBand(d.profile.age), order: [...AGE_BANDS.map((a) => a[0]), NOT_SET] },
    { key: "matrimonial", label: "Situation matrimoniale", of: (d) => d.profile.matrimonial, order: MATRIMONIAL.map((m) => m[0]) },
    { key: "ville", label: "Ville", of: (d) => d.profile.ville, order: "volume", top: 10 },
  ];
  const OTHERS = "Autres";

  /**
   * Zone initiale par catégorie d'une dimension. Lignes < 5 regroupées dans « Autres » ;
   * « Autres » encore < 5 → ligne entièrement masquée. Cases masquées par maskRow().
   */
  function zonesBy(db, f, dimKey) {
    const dim = DIMENSIONS.find((x) => x.key === dimKey);
    const groups = new Map();
    cohort(db, f).forEach((d) => {
      const k = dim.of(d);
      if (!groups.has(k)) { groups.set(k, { VERT: 0, ORANGE: 0, ROUGE: 0 }); }
      groups.get(k)[d.zone]++;
    });
    let rows = [...groups].map(([label, counts]) => ({ label, counts, n: sum(Object.values(counts)) }));
    if (Array.isArray(dim.order)) { rows.sort((a, b) => dim.order.indexOf(a.label) - dim.order.indexOf(b.label)); }
    if (dim.order === "volume") { rows.sort((a, b) => b.n - a.n); }
    if (dim.order === "rouge") { rows.sort((a, b) => b.counts.ROUGE / b.n - a.counts.ROUGE / a.n || b.n - a.n); }
    const kept = rows.filter((r, i) => r.n >= MIN_CELL && (!dim.top || i < dim.top));
    const rest = rows.filter((r) => !kept.includes(r));
    if (rest.length) {
      const counts = { VERT: 0, ORANGE: 0, ROUGE: 0 };
      rest.forEach((r) => Object.keys(counts).forEach((k) => { counts[k] += r.counts[k]; }));
      const n = sum(Object.values(counts));
      kept.push({ label: dim.top && rest.some((r) => r.n >= MIN_CELL) ? `Autres (${rest.length})` : OTHERS, counts, n, isOther: true });
    }
    return kept.map((r) => (r.n < MIN_CELL ? { ...r, hidden: true, shown: { VERT: null, ORANGE: null, ROUGE: null } } : { ...r, shown: maskRow(r.counts) }));
  }

  /** Comparaison des agences : ignore le filtre agence (toutes les agences, ligne sélectionnée mise en évidence). */
  function agencies(db, f, now = NOW) {
    return AGENCIES.map((a) => {
      const c = db.filter((d) => d.agencyId === a.id && inPeriod(d.createdAt, f));
      const dc = decisionCounts(c);
      const decided = dc.APPROVED + dc.REJECTED;
      const manual = c.filter((d) => !d.automatic && d.decidedAt).map((d) => (d.decidedAt - d.createdAt) / D);
      const small = c.length < MIN_CELL;
      return {
        id: a.id, name: a.name, n: c.length, small,
        approvalRate: small || !decided ? null : pct(dc.APPROVED, decided),
        decisionMedian: small || manual.length < MIN_CELL ? null : quantile(manual, 0.5),
        pendingToday: db.filter((d) => d.agencyId === a.id && d.decision === "PENDING" && d.createdAt <= now).length,
      };
    });
  }

  // ---------- Périodes de l'histogramme (identique au partial kpi-charts) ----------
  function periods(mode, anchor) {
    const a = new Date(parseDay(anchor));
    const y = a.getFullYear(), m = a.getMonth();
    const list = [];
    if (mode === "year") {
      for (let i = 0; i < 12; i++) { list.push({ start: isoDay(new Date(y, i, 1).getTime()), end: isoDay(new Date(y, i + 1, 1).getTime()), label: MONTHS_SHORT[i], long: `${MONTHS[i]} ${y}` }); }
      return { title: String(y), periods: list };
    }
    if (mode === "month") {
      const next = new Date(y, m + 1, 1).getTime();
      for (let s = new Date(y, m, 1).getTime(); s < next;) {
        const e = Math.min(addDays(monday(s), 7), next);
        list.push({ start: isoDay(s), end: isoDay(e), label: `${dayMonth(s)}-${dayMonth(addDays(e, -1))}`, long: `Du ${dayMonth(s)} au ${dayMonth(addDays(e, -1))}/${y}` });
        s = e;
      }
      return { title: `${MONTHS[m]} ${y}`, periods: list };
    }
    const first = monday(a.getTime());
    for (let i = 0; i < 7; i++) { const d = addDays(first, i); list.push({ start: isoDay(d), end: isoDay(addDays(d, 1)), label: `${DAYS[i]} ${pad2(new Date(d).getDate())}`, long: `${DAYS[i]} ${dayMonth(d)}/${new Date(d).getFullYear()}` }); }
    const last = addDays(first, 6);
    return { title: `Semaine du ${dayMonth(first)} au ${dayMonth(last)}/${new Date(last).getFullYear()}`, periods: list };
  }
  function shift(mode, anchor, dir) {
    const a = new Date(parseDay(anchor));
    if (mode === "year") { return isoDay(new Date(a.getFullYear() + dir, a.getMonth(), 1).getTime()); }
    if (mode === "month") { return isoDay(new Date(a.getFullYear(), a.getMonth() + dir, 1).getTime()); }
    return isoDay(addDays(a.getTime(), 7 * dir));
  }
  /** Évolution : demandes initiales de chaque période [start ; end[, par décision actuelle (KpiStats::evolution). */
  function evolution(db, agencyId, list) {
    const series = Object.fromEntries(DECISIONS.map(([k]) => [k, list.map(() => 0)]));
    byAgency(db, { agencyId }).forEach((d) => {
      const day = isoDay(d.createdAt);
      const i = list.findIndex((p) => day >= p.start && day < p.end);
      if (i >= 0) { series[d.decision][i]++; }
    });
    return series;
  }

  // ============================================================
  // GRAPHES (version simplifiée : titres, chiffres, détail au survol)
  // ============================================================
  function niceScale(max) {
    if (max <= 0) { return { top: 4, step: 1 }; }
    const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((x) => x * mag).find((s) => s >= raw);
    return { top: Math.ceil(max / step) * step, step };
  }
  const EMPTY = `<p class="empty">Aucune donnée sur cette période.</p>`;
  const MASKED = "moins de 5";

  /** Infobulle partagée d'un conteneur, positionnée près du pointeur (ou de l'élément au clavier). */
  function tooltipFor(container) {
    const tip = document.createElement("div");
    tip.className = "kpi-tooltip";
    tip.hidden = true;
    container.append(tip);
    return {
      show(html, event, el) {
        tip.innerHTML = html;
        tip.hidden = false;
        const box = container.getBoundingClientRect();
        let left, top;
        if (event && event.clientX) { left = event.clientX - box.left + 14; top = event.clientY - box.top + 14; }
        else { const r = el.getBoundingClientRect(); left = r.left - box.left + r.width / 2; top = r.bottom - box.top + 6; }
        tip.style.left = `${Math.min(Math.max(left, 0), Math.max(0, box.width - tip.offsetWidth))}px`;
        tip.style.top = `${top}px`;
      },
      hide() { tip.hidden = true; },
    };
  }
  function bindTips(container) {
    const tip = tooltipFor(container);
    container.querySelectorAll("[data-tip]").forEach((el) => {
      el.addEventListener("mousemove", (e) => tip.show(el.dataset.tip, e, el));
      el.addEventListener("focus", () => tip.show(el.dataset.tip, null, el));
      el.addEventListener("click", (e) => tip.show(el.dataset.tip, e, el));
      ["mouseleave", "blur"].forEach((ev) => el.addEventListener(ev, () => tip.hide()));
    });
  }
  const tipLine = (color, label, value) => `<div>${color ? `<span class="legend-dot" style="background:${color}"></span>` : ""}<span>${escape(label)}</span><span class="v">${value}</span></div>`;
  const legendHtml = (items) => `<ul class="kpi-legend">${items.map(([l, c, cls]) => `<li><span class="legend-dot${cls ? ` ${cls}` : ""}" style="${c ? `background:${c}` : ""}"></span>${escape(l)}</li>`).join("")}</ul>`;

  /** Histogramme empilé (repris de la v1) : unité "count" ou "pct". */
  function columns(container, data) {
    const W = 640, Hh = 250, L = 40, R = 12, T = 20, B = 30;
    const n = data.periods.length;
    const isCount = data.unit === "count";
    const totals = data.periods.map((_, i) => data.series.reduce((s, x) => s + x.counts[i], 0));
    const scale = isCount ? niceScale(Math.max(...totals)) : { top: 100, step: 25 };
    const slot = (W - L - R) / n, barWidth = Math.min(48, slot * 0.7);
    const x = (i) => L + slot * i + slot / 2;
    const y = (v) => T + ((scale.top - v) / scale.top) * (Hh - T - B);
    container.innerHTML = "";
    const root = svg("svg", { viewBox: `0 0 ${W} ${Hh}`, role: "img", "aria-label": data.aria });
    for (let v = 0; v <= scale.top; v += scale.step) {
      root.append(svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "kpi-grid-line" }));
      const t = svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }); t.textContent = isCount ? v : `${v} %`; root.append(t);
    }
    const step = Math.ceil(n / 12);
    data.periods.forEach((p, i) => { if (i % step) { return; } const t = svg("text", { x: x(i), y: Hh - 8, "text-anchor": "middle" }); t.textContent = p.label; root.append(t); });
    data.periods.forEach((_, i) => {
      if (!totals[i]) { return; }
      let base = 0;
      for (const s of data.series) {
        const v = isCount ? s.counts[i] : (s.counts[i] / totals[i]) * 100;
        if (v <= 0) { continue; }
        root.append(svg("rect", { class: "kpi-bar", x: x(i) - barWidth / 2, y: y(base + v), width: barWidth, height: y(base) - y(base + v), fill: s.color, stroke: "var(--color-surface)", "stroke-width": 1 }));
        base += v;
      }
      if (isCount) { const t = svg("text", { x: x(i), y: y(totals[i]) - 5, "text-anchor": "middle", class: "kpi-total" }); t.textContent = totals[i]; root.append(t); }
    });
    const hl = svg("rect", { y: T, width: slot, height: Hh - T - B, fill: "var(--color-text-light)", opacity: 0.08, visibility: "hidden" });
    root.insertBefore(hl, root.firstChild);
    container.append(root);
    const tip = tooltipFor(container);
    data.periods.forEach((p, i) => {
      const band = svg("rect", { x: x(i) - slot / 2, y: T, width: slot, height: Hh - T - B, class: `kpi-band${data.onPick ? " is-pickable" : ""}` });
      band.addEventListener("mousemove", (e) => {
        hl.setAttribute("x", x(i) - slot / 2); hl.setAttribute("visibility", "visible");
        tip.show(`<b>${escape(p.long)}</b>` + (totals[i]
          ? data.series.slice().reverse().map((s) => tipLine(s.color, s.label, `${s.counts[i]} <small>(${fmtPct(pct(s.counts[i], totals[i]))})</small>`)).join("") + tipLine("", "Total", totals[i])
          : "<div><span>Aucune donnée</span></div>"), e);
      });
      band.addEventListener("mouseleave", () => { hl.setAttribute("visibility", "hidden"); tip.hide(); });
      if (data.onPick) { band.addEventListener("click", () => data.onPick(i)); }
      root.append(band);
    });
    container.insertAdjacentHTML("beforeend", legendHtml(data.series.map((s) => [s.label, s.color]))
      + `<details class="kpi-table"><summary>Voir les données</summary><div class="wrap"><table><thead><tr><th>Période</th>${data.series.map((s) => `<th>${escape(s.label)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${data.periods.map((p, i) => `<tr><td>${escape(p.long)}</td>${data.series.map((s) => `<td>${s.counts[i]}${totals[i] ? ` (${fmtPct(pct(s.counts[i], totals[i]))})` : ""}</td>`).join("")}<td>${totals[i]}</td></tr>`).join("")}</tbody></table></div></details>`);
  }

  /** Camembert (repris de la v1) : valeurs dans la légende, % au survol. */
  function pie(container, segments) {
    const total = segments.reduce((s, x) => s + x.n, 0);
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "kpi-pie";
    const root = svg("svg", { viewBox: "-70 -70 140 140", role: "group", "aria-label": `Répartition, total ${total}` });
    const legend = document.createElement("ul");
    legend.className = "pie-legend";
    const items = [];
    let tip;
    const show = (index, event) => {
      const it = items[index];
      wrap.classList.add("is-hovering");
      items.forEach((o, k) => { o.shape?.classList.toggle("is-on", k === index); o.li.classList.toggle("is-on", k === index); });
      if (it.shape) { it.shape.style.transform = `translate(${it.dx}px, ${it.dy}px)`; }
      tip.show(`<div><span class="legend-dot" style="background:${it.s.color}"></span><span>${escape(it.s.label)}</span></div><div class="big">${fmtPct(pct(it.s.n, total))}</div><div class="muted">${it.s.n} sur ${total}</div>`, event, it.shape || it.li);
    };
    const hide = () => { wrap.classList.remove("is-hovering"); items.forEach((o) => { o.shape?.classList.remove("is-on"); o.li.classList.remove("is-on"); if (o.shape) { o.shape.style.transform = ""; } }); tip.hide(); };
    if (!total) { root.append(svg("circle", { r: 64, fill: "var(--color-border)" })); }
    let angle = -Math.PI / 2;
    segments.forEach((s, index) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="legend-dot" style="background:${s.color}"></span><strong>${s.n}</strong><span>${escape(s.label)}</span>`;
      legend.append(li);
      const item = { s, li, shape: null, dx: 0, dy: 0 };
      items.push(item);
      if (total && s.n > 0) {
        const sweep = (s.n / total) * Math.PI * 2, mid = angle + sweep / 2, full = sweep >= Math.PI * 2 - 1e-9;
        const shape = full ? svg("circle", { r: 64, fill: s.color }) : svg("path", { d: `M0 0 L${64 * Math.cos(angle)} ${64 * Math.sin(angle)} A64 64 0 ${sweep > Math.PI ? 1 : 0} 1 ${64 * Math.cos(angle + sweep)} ${64 * Math.sin(angle + sweep)} Z`, fill: s.color, stroke: "var(--color-surface)", "stroke-width": 2, "stroke-linejoin": "round" });
        shape.classList.add("kpi-slice");
        shape.setAttribute("tabindex", "0");
        shape.setAttribute("role", "img");
        shape.setAttribute("aria-label", `${s.label} : ${s.n}, soit ${fmtPct(pct(s.n, total))}`);
        item.shape = shape; item.dx = full ? 0 : 5 * Math.cos(mid); item.dy = full ? 0 : 5 * Math.sin(mid);
        shape.addEventListener("mousemove", (e) => show(index, e));
        shape.addEventListener("mouseleave", hide);
        shape.addEventListener("focus", () => show(index));
        shape.addEventListener("blur", hide);
        shape.addEventListener("click", (e) => show(index, e));
        root.append(shape);
        angle += sweep;
      }
      li.addEventListener("mouseenter", () => { if (item.shape) { show(index); } });
      li.addEventListener("mouseleave", hide);
    });
    wrap.append(root, legend);
    const foot = document.createElement("p");
    foot.className = "pie-total";
    foot.innerHTML = total ? `Total <strong>${total}</strong>` : "Aucune donnée sur cette période.";
    container.append(wrap, foot);
    tip = tooltipFor(container);
  }

  /**
   * Barres horizontales empilées, une ligne par catégorie, sans texte dans les barres.
   * rows : [{ label, n, counts, shown (null = masqué), hidden?, isOther? }]
   * opts : { absolute: max (barres proportionnelles à max au lieu de 100 %), dimLabel, table: bool }
   */
  function stackedRows(container, rows, series, opts = {}) {
    if (!rows.length || !sum(rows.map((r) => r.n))) { container.innerHTML = EMPTY; return; }
    const shown = (r) => r.shown || r.counts;
    let anyMasked = false;
    const html = rows.map((r) => {
      const values = shown(r);
      const masked = r.hidden ? r.n : sum(series.filter(([k]) => values[k] === null).map(([k]) => r.counts[k]));
      anyMasked = anyMasked || masked > 0;
      const width = (v) => (opts.absolute ? `flex:0 0 ${(v / opts.absolute) * 100}%` : `flex:${v}`);
      const segs = r.hidden
        ? `<div class="hseg is-masked" style="flex:1" tabindex="0" data-tip="${escape(`<b>${escape(r.label)}</b><div>Moins de ${MIN_CELL} personnes, détail masqué</div>`)}"></div>`
        : series.filter(([k]) => values[k]).map(([k, label, color]) => `<div class="hseg" style="${width(values[k])};background:${color}" tabindex="0" data-tip="${escape(`<b>${escape(r.label)}</b>${tipLine(color, label, `${values[k]}${opts.absolute ? "" : ` <small>(${fmtPct(pct(values[k], r.n))})</small>`}`)}`)}"></div>`).join("")
          + (masked ? `<div class="hseg is-masked" style="${width(masked)}" tabindex="0" data-tip="${escape(`<b>${escape(r.label)}</b><div>${series.filter(([k]) => values[k] === null && r.counts[k] > 0).map(([, l]) => escape(l)).join(", ")} : masqué</div>`)}"></div>` : "");
      const aria = r.hidden ? `${r.label} : moins de ${MIN_CELL} personnes` : `${r.label} : ${series.map(([k, l]) => `${l} ${values[k] === null ? "masqué" : values[k]}`).join(", ")}`;
      return `<div class="hrow${r.isOther ? " is-other" : ""}"><span class="hlabel" title="${escape(r.label)}">${escape(r.label)}</span><div class="hbar${opts.absolute ? " is-abs" : ""}" role="img" aria-label="${escape(aria)}">${segs}</div><span class="hn">${r.hidden ? "" : r.n}</span></div>`;
    }).join("");
    container.innerHTML = `<div class="hrows">${html}</div>`
      + legendHtml(series.map(([, l, c]) => [l, c]).concat(anyMasked ? [["Masqué", "", "is-masked"]] : []))
      + (opts.table === false ? "" : `<details class="kpi-table"><summary>Voir les données</summary><div class="wrap"><table><thead><tr><th>${escape(opts.dimLabel || "Catégorie")}</th>${series.map(([, l]) => `<th>${escape(l)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escape(r.label)}</td>${series.map(([k]) => `<td>${shown(r)[k] === null ? MASKED : opts.absolute ? shown(r)[k] : `${shown(r)[k]} (${fmtPct(pct(shown(r)[k], r.n))})`}</td>`).join("")}<td>${r.hidden ? MASKED : r.n}</td></tr>`).join("")}</tbody></table></div></details>`);
    bindTips(container);
  }

  const fmtDays = (v) => (v == null ? "" : v < 2 ? `${fmtNum(Math.round(v * 24))} h` : `${fmtNum(v < 10 ? Math.round(v * 10) / 10 : Math.round(v))} j`);

  // ============================================================
  // RENDU
  // ============================================================
  let db = [];
  const $ = (s) => document.querySelector(s);
  const filters = () => ({ start: $("#f-start").value, end: $("#f-end").value, agencyId: $("#f-agency").value });
  const statTile = (label, value, cls = "") => `<div class="tile ${cls}"><span class="tile-label">${escape(label)}</span><strong class="tile-value">${value}</strong></div>`;

  function renderTiles(f) {
    const t = tiles(db, f);
    $("#tiles").innerHTML = [
      ["Nouvelles demandes", t.newRequests], ["Prises en charge en cours", t.activeCares],
      ["Dossiers clos", t.closed], ["Taux de présence", t.attendanceRate == null ? "0 %" : fmtPct(t.attendanceRate)],
    ].map(([l, v]) => statTile(l, v, "card")).join("");
  }

  const curve = { mode: "month", anchor: TODAY, unit: "count" };
  const PARENT = { week: "month", month: "year" };
  function renderCurve() {
    const card = $("#decision-curve-card");
    const { title, periods: list } = periods(curve.mode, curve.anchor);
    card.querySelector("[data-kpi-title]").textContent = title.charAt(0).toUpperCase() + title.slice(1);
    card.querySelectorAll("[data-kpi-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kpiMode === curve.mode)));
    card.querySelectorAll("[data-kpi-unit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kpiUnit === curve.unit)));
    const up = card.querySelector("[data-kpi-up]");
    up.hidden = !PARENT[curve.mode];
    up.textContent = curve.mode === "week" ? "Voir le mois" : "Voir l'année";
    const ev = evolution(db, filters().agencyId, list);
    columns($("#decision-curve"), {
      periods: list, unit: curve.unit, aria: "Demandes par période et par décision",
      series: DECISIONS.map(([k, label, color]) => ({ label, color, counts: ev[k] })),
      onPick: curve.mode === "week" ? null : (i) => { curve.anchor = list[i].start; curve.mode = curve.mode === "year" ? "month" : "week"; renderCurve(); },
    });
  }

  function renderPies(f) {
    const z = zoneCounts(db, f);
    pie($("#zone-pie"), ZONES.map(([k, label, color]) => ({ n: z[k], label, color })));
    const d = decisionCounts(cohort(db, f));
    pie($("#decision-pie"), DECISIONS.map(([k, label, color]) => ({ n: d[k], label, color })));
  }

  function renderFunnel(f) {
    const fu = funnel(db, f);
    const el = $("#funnel");
    const first = fu.stages[0].n;
    if (!first) { el.innerHTML = EMPTY; return; }
    el.innerHTML = `<ol class="funnel">${fu.stages.map((s, i) => {
      const prev = i ? fu.stages[i - 1].n : s.n;
      const tip = `<b>${escape(s.label)}</b>${tipLine("", "Nombre", s.n)}${tipLine("", "Part des demandes", fmtPct(pct(s.n, first)))}${i ? tipLine("", "Part de l'étape précédente", fmtPct(pct(s.n, prev))) : ""}`;
      return `<li><div class="funnel-row"><span>${escape(s.label)}</span><strong>${s.n}</strong></div><div class="funnel-track" tabindex="0" data-tip="${escape(tip)}"><div class="funnel-bar" style="width:${Math.max(pct(s.n, first), 0.5)}%"></div></div></li>`;
    }).join("")}</ol>`;
    bindTips(el);
  }

  function renderDelays(f) {
    $("#delays").innerHTML = `<div class="delay-grid">${delays(db, f).map((d) => statTile(d.label, d.n >= MIN_CELL ? fmtDays(d.median) : `<span class="tile-na">Pas assez de dossiers</span>`, "delay")).join("")}</div>`;
  }

  function renderPending(f) {
    const p = pending(db, f);
    const rows = [["decision", "Décision du validateur"], ["voucher", "Bon de prise en charge"]].map(([k, label]) => ({ label, counts: p[k], n: sum(Object.values(p[k])) }));
    const max = Math.max(...rows.map((r) => r.n));
    if (!max) { $("#pending").innerHTML = `<p class="empty">Aucun dossier en attente.</p>`; return; }
    stackedRows($("#pending"), rows, PENDING_BUCKETS, { absolute: max, table: false });
  }

  function renderPcl5(f) {
    const p = pcl5(db, f);
    const el = $("#pcl5");
    if (p.n < MIN_CELL) { el.innerHTML = p.n ? `<p class="empty">Moins de ${MIN_CELL} personnes suivies sur cette période.</p>` : EMPTY; return; }
    el.innerHTML = `<div class="tiles tiles-3">${statTile("Score moyen au départ", `${p.avgBefore}<small> sur 80</small>`)}${statTile("Score moyen au dernier suivi", `${p.avgAfter}<small> sur 80</small>`)}${statTile("Personnes suivies", p.n)}</div><div id="pcl5-trend"></div>`;
    const row = { label: "Évolution du score", n: p.n, counts: { better: p.trend.better, stable: p.trend.stable, worse: p.trend.worse } };
    row.shown = maskRow(row.counts);
    stackedRows($("#pcl5-trend"), [row], [["better", "Amélioration", "var(--color-success)"], ["stable", "Stable", "#9aa5b1"], ["worse", "Aggravation", "var(--color-danger)"]], { dimLabel: "Évolution" });
  }

  function renderAttendance(f) {
    const a = attendance(db, f);
    if (!a.periods.length) { $("#attendance").innerHTML = EMPTY; return; }
    columns($("#attendance"), { periods: a.periods, unit: "pct", aria: "Séances par mois selon la présence", series: ATTENDANCE.map(([k, label, color]) => ({ label, color, counts: a.counts[k] })) });
  }

  const profile = { dim: "agent" };
  function renderProfile(f) {
    $("#profile-dims").innerHTML = DIMENSIONS.map((d) => `<button type="button" data-dim="${d.key}" aria-pressed="${d.key === profile.dim}">${escape(d.label)}</button>`).join("");
    $("#profile-dims").querySelectorAll("[data-dim]").forEach((b) => b.addEventListener("click", () => { profile.dim = b.dataset.dim; renderProfile(filters()); }));
    stackedRows($("#profile"), zonesBy(db, f, profile.dim), ZONES, { dimLabel: DIMENSIONS.find((d) => d.key === profile.dim).label });
  }

  const agencySort = { key: "n", dir: -1 };
  function renderAgencies(f) {
    const rows = agencies(db, f);
    const cols = [["name", "Agence"], ["n", "Demandes"], ["approvalRate", "Taux de prise en charge"], ["decisionMedian", "Délai de décision"], ["pendingToday", "En attente"]];
    const sorted = [...rows].sort((a, b) => {
      const va = a[agencySort.key], vb = b[agencySort.key];
      if (va == null) { return 1; } if (vb == null) { return -1; }
      return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * agencySort.dir;
    });
    const max = (k) => Math.max(1, ...rows.map((r) => r[k] || 0));
    const cell = (v, m, text) => (v == null ? `<span class="muted">masqué</span>` : `<div class="cellbar"><span style="width:${(v / m) * 100}%"></span><b>${text}</b></div>`);
    $("#agencies").innerHTML = `<div class="wrap"><table class="agency-table"><thead><tr>${cols.map(([k, l]) => `<th aria-sort="${agencySort.key === k ? (agencySort.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-sort="${k}" class="${agencySort.key === k ? `is-sorted ${agencySort.dir > 0 ? "asc" : "desc"}` : ""}">${l}</button></th>`).join("")}</tr></thead><tbody>${sorted.map((r) => `<tr class="${r.id === f.agencyId ? "is-selected" : ""}">
      <td>${escape(r.name)}</td>
      <td>${cell(r.n, max("n"), r.n)}</td>
      <td>${cell(r.approvalRate, 100, r.approvalRate == null ? "" : fmtPct(r.approvalRate))}</td>
      <td>${cell(r.decisionMedian, max("decisionMedian"), fmtDays(r.decisionMedian))}</td>
      <td>${cell(r.pendingToday, max("pendingToday"), r.pendingToday)}</td></tr>`).join("")}</tbody></table></div>`;
    $("#agencies").querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => {
      agencySort.dir = agencySort.key === b.dataset.sort ? -agencySort.dir : (b.dataset.sort === "name" ? 1 : -1);
      agencySort.key = b.dataset.sort;
      renderAgencies(filters());
    }));
  }

  function renderAll() {
    const f = filters();
    if (f.start > f.end) { $("#f-end").value = f.start; return renderAll(); }
    renderTiles(f); renderCurve(); renderPies(f); renderFunnel(f); renderDelays(f); renderPending(f);
    renderPcl5(f); renderAttendance(f); renderProfile(f); renderAgencies(f);
  }

  /** Cartes repliables : le titre est un bouton qui affiche ou masque le contenu. */
  function setFold(button, open) {
    button.setAttribute("aria-expanded", String(open));
    document.getElementById(button.getAttribute("aria-controls")).hidden = !open;
  }

  function boot() {
    db = generate();
    $("#f-agency").innerHTML += AGENCIES.map((a) => `<option value="${a.id}">${escape(a.name)}</option>`).join("");
    ["#f-start", "#f-end", "#f-agency"].forEach((s) => $(s).addEventListener("change", renderAll));
    document.querySelectorAll(".fold").forEach((b) => b.addEventListener("click", () => setFold(b, b.getAttribute("aria-expanded") !== "true")));
    const card = $("#decision-curve-card");
    card.querySelectorAll("[data-kpi-mode]").forEach((b) => b.addEventListener("click", () => { curve.mode = b.dataset.kpiMode; renderCurve(); }));
    card.querySelectorAll("[data-kpi-unit]").forEach((b) => b.addEventListener("click", () => { curve.unit = b.dataset.kpiUnit; renderCurve(); }));
    card.querySelector("[data-kpi-prev]").addEventListener("click", () => { curve.anchor = shift(curve.mode, curve.anchor, -1); renderCurve(); });
    card.querySelector("[data-kpi-next]").addEventListener("click", () => { curve.anchor = shift(curve.mode, curve.anchor, 1); renderCurve(); });
    card.querySelector("[data-kpi-up]").addEventListener("click", () => { curve.mode = PARENT[curve.mode]; renderCurve(); });

    document.querySelectorAll("[data-device]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("[data-device]").forEach((o) => { o.classList.toggle("on", o === b); o.setAttribute("aria-pressed", String(o === b)); });
      $("#stage").classList.toggle("is-mobile", b.dataset.device === "mobile");
      renderAll();
    }));
    const toggle = $("#notes-toggle");
    toggle.addEventListener("click", () => { const on = toggle.getAttribute("aria-pressed") !== "true"; toggle.setAttribute("aria-pressed", String(on)); $("#layout").classList.toggle("with-notes", on); });

    renderAll();
    const box = $("#tests-box");
    if (new URLSearchParams(location.search).has("tests") && window.runTests) {
      const T = window.runTests();
      box.innerHTML = `<div class="tests-box ${T.ko ? "ko" : "ok"}"><strong>Tests : ${T.ok} OK / ${T.ko} KO</strong>${T.ko ? `<ul>${T.failed.map((x) => `<li>${escape(x)}</li>`).join("")}</ul>` : ""}</div>`;
    } else {
      box.innerHTML = `<div class="tests-box"><a href="?tests=1">Lancer les tests de cohérence</a></div>`;
    }
  }

  window.ATMP = {
    boot, setFold, renderAll, get db() { return db; }, set db(v) { db = v; },
    NOW, TODAY, H, D, MIN_CELL, PCL5_CHANGE, FOLLOW_UP_MONTHS, ZONES, DECISIONS, DIMENSIONS, AGENCIES, OTHERS,
    zoneOf, deriveDossier, randomFacts, generate, rng, parseDay, addDays, addMonths, isoDay,
    cohort, decisionCounts, zoneCounts, tiles, funnel, delays, pending, pcl5, attendance, zonesBy, maskRow, agencies, evolution, periods, monthsOf,
  };
})();
