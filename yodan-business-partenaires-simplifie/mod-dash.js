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
  $$("[data-dtest]", el).forEach((b) => b.addEventListener("click", () => { st.test = b.dataset.dtest; viewDashboard(el, scope, key); }));
  $("#db-x", el).addEventListener("click", () => exportToast(`Tableau de bord ${T.label}`));
  const body = $("#db-body", el), again = () => viewDashboard(el, scope, key);
  if (st.test === "BSPA") dashBspa(body, scope, censor, st, again);
  else dashGeneric(body, dashboardModel(scope.partnerIds, st.test, censor, ag), censor);
  bindFolds(el);
  if (!censor) { audit("Consultation détail évaluations", st.test); yodanEvalRows($("#db-rows", el), scope.partnerIds, st.test); }
}
const tooSmallHtml = `<div class="banner banner-warn">Moins de ${MIN_GROUP} évaluations : les chiffres sont masqués pour protéger l'anonymat.</div>`;

/* ---------- BSPA (entreprises, mutuelles) ---------- */
const dimZone = (k, v) => (k === "A" || k === "D" ? (v >= 68 ? "VERT" : v >= 51 ? "ORANGE" : "ROUGE") : v <= 45 ? "VERT" : v <= 65 ? "ORANGE" : "ROUGE");
function dashBspa(el, scope, censor, st, again) {
  const m = bspaModel(scope.partnerIds, censor, st.campaign, scope.agencies);
  const v = (n) => masked(n, censor);
  el.innerHTML = `<div class="toolbar"><label class="small">Campagne <select id="bs-c"><option value="all">Toutes les campagnes commencées</option>${m.campaigns.map((c) => `<option value="${c.id}" ${st.campaign === c.id ? "selected" : ""}>${esc(c.name)}${multi(scope) ? ` · ${esc(pName(c.partnerId))}` : ""}</option>`).join("")}</select></label></div>
    ${m.tooSmall ? tooSmallHtml : `<div class="tiles">${kpiTile(v(m.total), "Bilans terminés")}${ZONES.map((z, i) => kpiTile(v(m.prof[i]), TESTS.BSPA.zoneText[z][0], zoneCls[z])).join("")}${kpiTile(v(m.alerts), "Signaux d'alerte forts", "rouge")}</div>
    <div class="grid-2">${foldHtml("b-prof", "Profils", donutHtml(ZONES.map((z, i) => ({ label: TESTS.BSPA.zoneText[z][0], color: zoneColor[z], value: m.prof[i] })), { censor }))}
      ${foldHtml("b-dims", "Dimensions (moyenne sur 100)", `<div class="dims">${BSPA_DIMS.map((k) => { const z = dimZone(k, m.dims[k]); return `<div class="dim-row"><span>${BSPA_DIM_LABEL[k]}</span><div class="meter"><span style="width:${m.dims[k]}%;background:${zoneColor[z]}"></span></div><span class="pill ${zoneCls[z]}">${m.dims[k]}</span></div>`; }).join("")}</div><p class="small muted">Bien-être et vécu : plus c'est haut, mieux c'est. Stress, épuisement, signaux : plus c'est bas, mieux c'est.</p>`)}</div>
    <h2 class="section-title">Par groupe</h2><div class="grid-3">${m.by.map((g, i) => foldHtml(`b-by${i}`, g.label, stackRowsHtml(g.rows, ZONES.map((z) => zoneColor[z]), ZONES.map((z) => TESTS.BSPA.zoneText[z][0]), censor))).join("")}</div>
    ${st.campaign === "all" && m.compare.length > 1 ? foldHtml("b-cmp", "Comparaison des campagnes", `<div class="table-wrap"><table class="table"><thead><tr><th>Campagne</th><th class="num-cell">Bilans</th>${ZONES.map((z) => `<th class="num-cell">${TESTS.BSPA.zoneText[z][0]}</th>`).join("")}<th class="num-cell">Bien-être moyen</th></tr></thead><tbody>${m.compare.map((c) => `<tr><td>${esc(c.name)}</td>${censor && c.total < MIN_GROUP ? `<td class="num-cell">< 5</td><td colspan="4" class="masked small">masqué</td>` : `<td class="num-cell">${c.total}</td>${c.prof.map((n) => `<td class="num-cell">${n}</td>`).join("")}<td class="num-cell">${c.wellbeing}</td>`}</tr>`).join("")}</tbody></table></div>`) : ""}`}`;
  $("#bs-c", el).addEventListener("change", (e) => { st.campaign = e.target.value; again(); });
}
/* ---------- Générique (KARASEK, COPSOQ, WHO-5…) ---------- */
function dashGeneric(el, m, censor) {
  if (m.tooSmall) { el.innerHTML = tooSmallHtml; return; }
  const v = (n) => masked(n, censor), T = TESTS[m.test];
  el.innerHTML = `<div class="tiles">${kpiTile(v(m.total), "Évaluations")}${ZONES.map((z) => kpiTile(v(m.zones[z]), T.zoneText[z][0], zoneCls[z])).join("")}</div>
    <div class="grid-2">${foldHtml(`g-z-${m.test}`, "Répartition", donutHtml(ZONES.map((z) => ({ label: T.zoneText[z][0], color: zoneColor[z], value: m.zones[z] })), { censor }))}
      ${foldHtml(`g-w-${m.test}`, "Évolution hebdomadaire", `${histogramSvg(m.weekly.map((w) => ({ label: fmtDate(w.week).slice(0, 5), vals: ZONES.map((z) => w.zones[z]) })), ZONES.map((z) => [T.zoneText[z][0], zoneColor[z]]), { censor })}${ZONE_LEGEND}`)}</div>
    ${foldHtml(`g-a-${m.test}`, "Par agence / site", stackRowsHtml(m.byAgency, ZONES.map((z) => zoneColor[z]), ZONES.map((z) => T.zoneText[z][0]), censor))}`;
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
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th>${partnerIds.length > 1 ? "<th>Partenaire</th>" : ""}<th>Agence / site</th><th>Date</th><th>Résultat</th><th>Décision</th><th>Prise en charge</th></tr></thead><tbody>
    ${page.rows.map((e) => { const pt = db.patients.find((x) => x.evalId === e.id); return `<tr class="click" data-rep="${e.id}" tabindex="0"><td><strong>${esc(e.dossier)}</strong><div class="small muted">${esc(MODE_LABEL[e.mode])}</div></td><td>${esc(displayName(personOf(e.personId)))}</td>${partnerIds.length > 1 ? `<td class="small">${esc(pName(e.partnerId))}</td>` : ""}<td class="small">${esc(e.agency)}</td><td class="small">${fmtDate(e.date)}</td><td>${zonePill(e.zone)} ${scoreText(e.test, e.score)}</td><td class="small">${OUTCOME_LABEL[outcomeOf(e)]}</td><td>${pt ? statusPill(pt) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">Aucune évaluation pour ces filtres.</td></tr>`}
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
