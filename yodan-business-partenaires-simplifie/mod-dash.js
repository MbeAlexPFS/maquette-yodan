/*
 * mod-dash.js : « Tableau de bord », un par test.
 *  BSPA → tableau de bord RH · autres tests (KARASEK, COPSOQ, WHO-5) → générique.
 * Partenaire : agrégé, effectifs < 5 masqués. Admin Yodan (médecins, psychologues) : sans masquage + détail individuel.
 */
"use strict";

const dash = {};
function viewDashboard(el, scope, key) {
  const tests = [...new Set(scope.partnerIds.flatMap((id) => partnerOf(id).tests))];
  if (!tests.length) { el.innerHTML = `<p class="empty">Aucun test activé.</p>`; return; }
  const st = dash[key] || (dash[key] = { test: tests[0], campaign: "all", dim: 0 });
  if (!tests.includes(st.test)) st.test = tests[0];
  const censor = scope.actor !== "yodan";
  const T = TESTS[st.test];
  const ag = scope.agencies;
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Tableau de bord</span><h1>${esc(T.label)} — ${esc(T.desc)}</h1>${ag ? `<div class="actions">${ag.map((a) => `<span class="chip">📍 ${esc(a)}</span>`).join("")}<span class="small muted">vos agences</span></div>` : ""}</div><button type="button" class="btn btn-sm" id="db-x">⬇ Exporter</button></div>
    ${tests.length > 1 ? `<div class="test-tabs" role="tablist" aria-label="Tableau de bord par test">${tests.map((t) => `<button type="button" role="tab" aria-selected="${t === st.test}" class="${t === st.test ? "on" : ""}" data-dtest="${t}">${t}</button>`).join("")}</div>` : ""}
    <div id="db-body"></div>${censor ? "" : `<div class="card" id="db-rows"></div>`}`;
  $$("[data-dtest]", el).forEach((b) => b.addEventListener("click", () => { st.test = b.dataset.dtest; st.campaign = "all"; viewDashboard(el, scope, key); }));
  $("#db-x", el).addEventListener("click", () => exportToast(`Tableau de bord ${T.label}`));
  const body = $("#db-body", el), again = () => viewDashboard(el, scope, key);
  if (st.test === "BSPA") dashBspa(body, scope, censor, st, again);
  else dashGeneric(body, scope, censor, st, again);
  bindFolds(el);
  bindFoldAll(el);
  if (!censor) { audit("Consultation détail évaluations", st.test); yodanEvalRows($("#db-rows", el), scope.partnerIds, st.test); }
}
const tooSmallHtml = `<div class="banner banner-warn">Moins de ${MIN_GROUP} évaluations : les chiffres sont masqués pour protéger l'anonymat.</div>`;

/* ---------- BSPA (entreprises, mutuelles) ---------- */
/**
 * Participation en tête du tableau de bord (partenaire et Yodan) : effectif → sélectionnés → ont répondu.
 * Chiffres agrégés seulement ; masqués sous 5 côté partenaire. Pas affiché pour un rôle limité à ses agences
 * (l'effectif est celui de tout le partenaire).
 */
function participationHtml(scope, censor, st, test = "BSPA") {
  if (scope.agencies) return "";
  const pa = participationOf(scope.partnerIds, st.campaign, test);
  const v = (n) => masked(n, censor);
  const pct = (x) => (x == null ? "" : `<small>${String(x).replace(".", ",")} % de l'effectif</small>`);
  const types = [...new Set(scope.partnerIds.map((id) => partnerOf(id).type))];
  const who = types.length === 1 ? HEADCOUNT_LABEL[types[0]] : "personnes";
  const head = pa.headcount == null
    ? kpiTile(`<span class="small muted">non renseigné</span>`, `Effectif total${scope.partnerIds.length > 1 ? " (incomplet)" : ""}`)
    : kpiTile(pa.headcount.toLocaleString("fr-FR"), `Effectif total (${who})<small>${st.campaign === "all" ? "en vigueur à ce jour" : `au début de la campagne (${fmtDate(pa.asOf)})`}</small>`);
  return `<h2 class="section-title">Participation${st.unit !== "all" ? ` <span class="small muted">· tous services confondus</span>` : ""}</h2>
    <div class="tiles participation">${head}${kpiTile(`${v(pa.selected)}${pct(pa.selectedPct)}`, "Sélectionnés pour une campagne", "orange")}${kpiTile(`${v(pa.answered)}${pct(pa.answeredPct)}`, `Ont répondu${pa.answeredOfSelected == null ? "" : ` · ${String(pa.answeredOfSelected).replace(".", ",")} % des sélectionnés`}`, "vert")}</div>
    <p class="small muted" style="margin-top:-.4rem">Les statistiques ci-dessous portent sur les personnes sélectionnées pour une campagne qui ont répondu, pas sur l'effectif total.</p>
    ${st.campaign === "all" ? participationTableHtml(scope, censor, test) : ""}`;
}
/** Une ligne par campagne : effectif en vigueur au début de la campagne (effectif daté), sélectionnés, ont répondu. */
function participationTableHtml(scope, censor, test) {
  const rows = participationByCampaign(scope.partnerIds, test);
  if (!rows.length) return "";
  const v = (n) => masked(n, censor), pc = (x) => (x == null ? "—" : `${String(x).replace(".", ",")} %`);
  const multi = scope.partnerIds.length > 1;
  return foldHtml(`p-camp-${test}`, "Participation par campagne", `<div class="table-wrap"><table class="table"><thead><tr><th>Campagne</th>${multi ? "<th>Partenaire</th>" : ""}<th>Début</th><th class="num-cell">Effectif au début</th><th class="num-cell">Sélectionnés</th><th class="num-cell">Ont répondu</th><th class="num-cell">% de l'effectif</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.campaign.name)}</td>${multi ? `<td class="small">${esc(partnerOf(r.campaign.partnerId).name)}</td>` : ""}<td class="small">${fmtDate(r.campaign.start)}</td><td class="num-cell">${r.headcount == null ? `<span class="muted">non renseigné</span>` : r.headcount.toLocaleString("fr-FR")}</td><td class="num-cell">${v(r.selected)}</td><td class="num-cell">${v(r.answered)}</td><td class="num-cell">${censor && r.answered > 0 && r.answered < MIN_GROUP ? "—" : pc(r.answeredPct)}</td></tr>`).join("")}
    </tbody></table></div><p class="small muted">Effectif daté : chaque campagne utilise l'effectif en vigueur à sa date de début.</p>`);
}
const dimZone = (k, v) => (k === "A" || k === "D" ? (v >= 68 ? "VERT" : v >= 51 ? "ORANGE" : "ROUGE") : v <= 45 ? "VERT" : v <= 65 ? "ORANGE" : "ROUGE");
/* ---------- Parties communes à tous les tests ---------- */
/** Filtres communs : direction / région et campagne (campagnes du test affiché). */
function dashFiltersHtml(scope, st, campaigns) {
  const units = unitsOf(scope.partnerIds), U = unitLabelOf(scope.partnerIds);
  return `<div class="toolbar">${foldAllHtml()}<label class="small">${esc(U.one)} <select id="bs-u"><option value="all">${esc(U.all)}</option>${units.map((u) => `<option ${st.unit === u ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></label>
    <label class="small">Campagne <select id="bs-c"><option value="all">Toutes les campagnes commencées</option>${campaigns.map((c) => `<option value="${c.id}" ${st.campaign === c.id ? "selected" : ""}>${esc(c.name)}${multi(scope) ? ` · ${esc(pName(c.partnerId))}` : ""}</option>`).join("")}</select></label></div>`;
}
function bindDashFilters(el, st, again) {
  $("#bs-c", el).addEventListener("change", (e) => { st.campaign = e.target.value; again(); });
  $("#bs-u", el).addEventListener("change", (e) => { st.unit = e.target.value; again(); });
}
/** Filtres valides pour le test affiché (une campagne d'un autre test ou une valeur retirée repart sur « toutes »). */
function normalizeDashState(scope, st) {
  const units = unitsOf(scope.partnerIds);
  if (!st.unit || (st.unit !== "all" && !units.includes(st.unit))) st.unit = "all";
  if (!st.campaign) st.campaign = "all";
}
/**
 * Un seul bloc « Par groupe » : les tableaux de même format (direction / région, genre, âge, ancienneté, agence)
 * sont regroupés, et un sélecteur choisit le regroupement affiché (au lieu d'un bloc par tableau).
 */
function groupsHtml(m, prefix, st, extra = []) {
  const T = TESTS[m.test], groups = [...m.by, ...extra];
  if (!groups.some((g) => g.label === st.group)) st.group = groups[0].label;
  const g = groups.find((x) => x.label === st.group);
  return foldHtml(`${prefix}-groups`, "Par groupe", `<div class="toolbar"><span class="small muted">Regrouper par</span>${segHtml("grp", groups.map((x) => [x.label, x.label]), st.group)}</div>
    ${stackRowsHtml(g.rows, ZONES.map((z) => zoneColor[z]), ZONES.map((z) => T.zoneText[z][0]), m.censor)}`);
}
function bindGroups(el, st, again) { bindSeg(el, (key, v) => { if (key === "grp") { st.group = v; again(); } }); }
/** Comparaison des campagnes (toutes les campagnes, au moins deux) ; extra = colonne propre au test. */
function compareHtml(m, prefix, extra = null) {
  if (m.campaignId !== "all" || m.compare.length < 2) return "";
  const T = TESTS[m.test], cols = 2 + ZONES.length + (extra ? 1 : 0);
  return foldHtml(`${prefix}-cmp`, "Comparaison des campagnes", `<div class="table-wrap"><table class="table"><thead><tr><th>Campagne</th><th class="num-cell">${m.test === "BSPA" ? "Bilans" : "Évaluations"}</th>${ZONES.map((z) => `<th class="num-cell">${T.zoneText[z][0]}</th>`).join("")}${extra ? `<th class="num-cell">${extra.label}</th>` : ""}</tr></thead><tbody>
    ${m.compare.map((c) => `<tr><td>${esc(c.name)}</td>${m.censor && c.total < MIN_GROUP ? `<td class="num-cell">${masked(c.total, true)}</td><td colspan="${cols - 2}" class="masked small">masqué</td>` : `<td class="num-cell">${c.total}</td>${c.prof.map((n) => `<td class="num-cell">${n}</td>`).join("")}${extra ? `<td class="num-cell">${extra.value(c)}</td>` : ""}`}</tr>`).join("")}</tbody></table></div>`);
}

function dashBspa(el, scope, censor, st, again) {
  normalizeDashState(scope, st);
  const m = bspaModel(scope.partnerIds, censor, st.campaign, scope.agencies, st.unit);
  st.campaign = m.campaignId;
  const v = (n) => masked(n, censor);
  el.innerHTML = `${dashFiltersHtml(scope, st, m.campaigns)}
    ${participationHtml(scope, censor, st, "BSPA")}
    ${m.tooSmall ? tooSmallHtml : `<h2 class="section-title">Bilans</h2><div class="tiles">${kpiTile(v(m.total), "Bilans terminés")}${ZONES.map((z, i) => kpiTile(v(m.prof[i]), TESTS.BSPA.zoneText[z][0], zoneCls[z])).join("")}${kpiTile(v(m.alerts), "Signaux d'alerte forts", "rouge")}</div>
    <div class="grid-2">${foldHtml("b-prof", "Profils", donutHtml(ZONES.map((z, i) => ({ label: TESTS.BSPA.zoneText[z][0], color: zoneColor[z], value: m.prof[i] })), { censor }))}
      ${foldHtml("b-dims", "Dimensions (moyenne sur 100)", `<div class="dims">${BSPA_DIMS.map((k) => { const z = dimZone(k, m.dims[k]); return `<div class="dim-row"><span>${BSPA_DIM_LABEL[k]}</span><div class="meter"><span style="width:${m.dims[k]}%;background:${zoneColor[z]}"></span></div><span class="pill ${zoneCls[z]}">${m.dims[k]}</span></div>`; }).join("")}</div><p class="small muted">Bien-être et vécu : plus c'est haut, mieux c'est. Stress, épuisement, signaux : plus c'est bas, mieux c'est.</p>`)}</div>
    ${groupsHtml(m, "b", st)}
    ${compareHtml(m, "b", { label: "Bien-être moyen", value: (c) => c.wellbeing })}`}`;
  bindDashFilters(el, st, again);
  bindGroups(el, st, again);
}
/* ---------- Autres tests (KARASEK, COPSOQ, WHO-5…) : mêmes filtres, participation, groupes et campagnes que le BSPA ---------- */
function dashGeneric(el, scope, censor, st, again) {
  normalizeDashState(scope, st);
  const m = testModel(scope.partnerIds, st.test, censor, st.campaign, scope.agencies, st.unit);
  st.campaign = m.campaignId;
  const v = (n) => masked(n, censor), T = TESTS[m.test];
  el.innerHTML = `${dashFiltersHtml(scope, st, m.campaigns)}
    ${participationHtml(scope, censor, st, m.test)}
    ${m.tooSmall ? tooSmallHtml : `<h2 class="section-title">Résultats</h2><div class="tiles">${kpiTile(v(m.total), "Évaluations")}${ZONES.map((z) => kpiTile(v(m.zones[z]), T.zoneText[z][0], zoneCls[z])).join("")}</div>
    <div class="grid-2">${foldHtml(`g-z-${m.test}`, "Répartition", donutHtml(ZONES.map((z) => ({ label: T.zoneText[z][0], color: zoneColor[z], value: m.zones[z] })), { censor }))}
      ${foldHtml(`g-w-${m.test}`, "Évolution hebdomadaire", `${histogramSvg(m.weekly.map((w) => ({ label: fmtDate(w.week).slice(0, 5), vals: ZONES.map((z) => w.zones[z]) })), ZONES.map((z) => [T.zoneText[z][0], zoneColor[z]]), { censor })}${ZONE_LEGEND}`)}</div>
    ${groupsHtml(m, `g-${m.test}`, st, [{ label: "Agence / site", rows: m.byAgency }])}
    ${compareHtml(m, `g-${m.test}`)}`}`;
  bindDashFilters(el, st, again);
  bindGroups(el, st, again);
}

/* ---------- Admin Yodan : détail individuel + rapport (accès journalisé) ---------- */
const dashRows = { q: "", zone: "all" };
function yodanEvalRows(box, partnerIds, test) {
  const all = db.evaluations.filter((e) => partnerIds.includes(e.partnerId) && e.test === test).sort((a, b) => b.date.localeCompare(a.date));
  const rows = all.filter((e) => (dashRows.zone === "all" || e.zone === dashRows.zone) && (!dashRows.q || norm(`${e.dossier} ${displayName(personOf(e.personId))} ${personOf(e.personId).id1}`).includes(norm(dashRows.q))));
  const page = pageOf(`yrows-${test}`, rows, 15);
  box.innerHTML = `<h2>Détail des évaluations <span class="pill gris">${rows.length}</span></h2>
    <div class="toolbar"><input type="search" class="grow" id="dr-q" placeholder="Dossier, nom, N° ou e-mail" value="${esc(dashRows.q)}" aria-label="Rechercher une évaluation">
      <select id="dr-z" aria-label="Zone"><option value="all">Toutes les zones</option>${ZONES.map((z) => `<option value="${z}" ${dashRows.zone === z ? "selected" : ""}>${ZONE_LABEL[z]}</option>`).join("")}</select></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th>${partnerIds.length > 1 ? "<th>Partenaire</th>" : ""}<th>Agence / site</th><th>Direction / région</th><th>Date</th><th>Résultat</th><th>Décision</th><th>Prise en charge</th></tr></thead><tbody>
    ${page.rows.map((e) => { const pt = db.patients.find((x) => x.evalId === e.id); return `<tr class="click" data-rep="${e.id}" tabindex="0"><td><strong>${esc(e.dossier)}</strong><div class="small muted">${esc(MODE_LABEL[e.mode])}</div></td><td>${esc(displayName(personOf(e.personId)))}</td>${partnerIds.length > 1 ? `<td class="small">${esc(pName(e.partnerId))}</td>` : ""}<td class="small">${esc(e.agency)}</td><td class="small">${esc(e.profile.unite || "—")}</td><td class="small">${fmtDate(e.date)}</td><td>${zonePill(e.zone)} ${scoreText(e.test, e.score)}</td><td class="small">${OUTCOME_LABEL[outcomeOf(e)]}</td><td>${pt ? statusPill(pt) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="9" class="empty">Aucune évaluation pour ces filtres.</td></tr>`}
    </tbody></table></div>${page.html}`;
  const redraw = () => yodanEvalRows(box, partnerIds, test);
  bindSearch($("#dr-q", box), (v) => { dashRows.q = v; resetPage(`yrows-${test}`); redraw(); });
  $("#dr-z", box).addEventListener("change", (ev) => { dashRows.zone = ev.target.value; resetPage(`yrows-${test}`); redraw(); });
  bindPager(box, `yrows-${test}`, redraw);
  $$("[data-rep]", box).forEach((r) => { const o = () => reportModal(r.dataset.rep); r.addEventListener("click", o); r.addEventListener("keydown", (e) => { if (e.key === "Enter") o(); }); });
}
/** Rapport individuel (médecin Yodan) : résultat, dimensions, réponses. Ouverture journalisée. */
function reportModal(evId) {
  const ev = evaluationOf(evId), T = TESTS[ev.test], person = personOf(ev.personId), p = partnerOf(ev.partnerId);
  audit("Ouverture rapport individuel", ev.dossier);
  modal(`Rapport — ${displayName(person)}`, `<dl class="kv"><dt>Dossier</dt><dd>${esc(ev.dossier)} · ${esc(person.pseudo)}</dd><dt>Partenaire</dt><dd>${esc(p.name)} · ${esc(ev.agency)}</dd><dt>Mode</dt><dd>${esc(MODE_LABEL[ev.mode])}${ev.campaignId ? ` · ${esc(campaignOf(ev.campaignId).name)}` : ""}</dd><dt>Date</dt><dd>${fmtLong(ev.date)}</dd><dt>Décision</dt><dd>${OUTCOME_LABEL[outcomeOf(ev)]}${ev.comment ? ` — « ${esc(ev.comment)} »` : ""}</dd></dl>
    ${resultCardHtml(ev, { withPost: false })}
    <details><summary>Réponses (${T.items.length})</summary><div class="recap-list">${T.items.map((it, i) => `<div class="recap-row"><span>${i + 1}. ${esc(it.t)}</span><strong>${esc(it.o.find(([x]) => x === ev.answers[i])?.[1] ?? "—")}</strong></div>`).join("")}</div></details>
    <h3>Consentements</h3><dl class="kv">${p.consents.map((c) => `<dt>${esc(c.label)}</dt><dd>${(c.moment === "pre" ? ev.consentsPre[c.id] : ev.consentsPost[c.id]) ? "Oui" : "Non"}</dd>`).join("")}</dl>${reportActionsHtml(ev.id)}`, (body) => bindReportActions(body, ev.id), true);
}
/** Actions sur le rapport d'une personne qui demande à le revoir : lien unique par e-mail ou export PDF. */
const reportActionsHtml = (evId) => `<div class="actions modal-actions"><button type="button" class="btn btn-primary btn-sm" data-rsend="${evId}">✉️ Renvoyer le rapport (lien unique)</button><button type="button" class="btn btn-sm" data-rpdf="${evId}">📄 Exporter en PDF</button><span class="small muted" id="rep-msg" role="status"></span></div>`;
function bindReportActions(root, evId) {
  $(`[data-rsend="${evId}"]`, root)?.addEventListener("click", () => { const r = sendReportLink(evId); $("#rep-msg", root).textContent = r.ok ? `Lien à usage unique envoyé à ${r.email}.` : r.err; });
  $(`[data-rpdf="${evId}"]`, root)?.addEventListener("click", () => printReport(evId));
}
/** Export PDF : page de rapport imprimable (« Enregistrer en PDF » du navigateur), export journalisé. */
function printReport(evId) {
  const ev = evaluationOf(evId), person = personOf(ev.personId), T = TESTS[ev.test];
  audit("Export PDF du rapport", ev.dossier);
  const w = window.open("", "_blank");
  if (!w) { toast("Autorisez l'ouverture de fenêtres pour exporter le PDF."); return; }
  const dims = ev.dims ? BSPA_DIMS.map((k) => `<tr><td>${BSPA_DIM_LABEL[k]}</td><td>${ev.dims[k].pct} / 100</td><td>${ZONE_LABEL[ev.dims[k].zone]}</td></tr>`).join("") : "";
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport ${esc(ev.dossier)}</title><style>body{font-family:Arial,sans-serif;color:#13324a;margin:2rem;max-width:720px}h1{color:#002c4c;border-bottom:3px solid #fc5a1b;padding-bottom:.3rem}table{border-collapse:collapse;width:100%;margin:1rem 0}td{border-bottom:1px solid #dfe5ee;padding:.4rem}.fake{background:#ffe9a8;padding:.3rem;text-align:center;font-size:.8rem}</style></head><body>
    <p class="fake">Maquette — données fictives</p><h1>Rapport personnel — ${esc(T.label)}</h1>
    <p><strong>${esc(displayName(person))}</strong><br>Bilan du ${fmtDate(ev.date)} · dossier ${esc(ev.dossier)}</p>
    <h2>${esc(zoneTitle(ev.test, ev))}</h2><p>${esc(T.zoneText[ev.zone][1])}</p>${dims ? `<table>${dims}</table>` : `<p>Score : ${ev.score} / ${T.max}</p>`}
    <p style="font-size:.8rem;color:#576671">Document confidentiel, destiné uniquement à la personne concernée. YODAN — santé mentale au travail.</p>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
