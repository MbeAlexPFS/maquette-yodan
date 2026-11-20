/*
 * mod-dash.js : « Tableau de bord », un par test.
 *  PCL-5 → graphes admin ATMP v2 · ICJE → tableau de bord Jouons responsable · BSPA → tableau de bord RH · autres → générique.
 * Partenaire : agrégé, effectifs < 5 masqués. Admin Yodan (médecins, psychologues) : sans masquage + détail individuel.
 */
"use strict";

const dash = {};
const ICJE_COLORS = ["#94a3b8", "var(--vert)", "var(--orange)", "var(--rouge)"];
const DEC_COLORS = [["Prise en charge", "var(--vert)"], ["En attente", "var(--jaune)"], ["Pas de prise en charge", "var(--rouge)"]];
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
  if (st.test === "PCL-5") dashPcl5(body, pcl5Model(scope.partnerIds, censor, ag), censor, st, again);
  else if (st.test === "ICJE") dashIcje(body, icjeModel(scope.partnerIds, censor, ag), censor);
  else if (st.test === "BSPA") dashBspa(body, scope, censor, st, again);
  else dashGeneric(body, dashboardModel(scope.partnerIds, st.test, censor, ag), censor);
  bindFolds(el);
  if (!censor) { audit("Consultation détail évaluations", st.test); yodanEvalRows($("#db-rows", el), scope.partnerIds, st.test); }
}
const tooSmallHtml = `<div class="banner banner-warn">Moins de ${MIN_GROUP} évaluations : les chiffres sont masqués pour protéger l'anonymat.</div>`;

/* ---------- PCL-5 (CNPS) ---------- */
function dashPcl5(el, m, censor, st, again) {
  if (m.tooSmall) { el.innerHTML = tooSmallHtml; return; }
  const v = (n) => masked(n, censor);
  const acc = m.outcomes.AUTO_YES + m.outcomes.YES, rej = m.outcomes.AUTO_NO + m.outcomes.NO;
  const fmax = Math.max(1, m.funnel[0][1]);
  const dim = m.profile[st.dim] || m.profile[0];
  el.innerHTML = `<div class="tiles">${kpiTile(v(m.total), "Évaluations")}${kpiTile(v(m.zones.ORANGE + m.zones.ROUGE), "Orange ou rouge", "orange")}${kpiTile(v(acc), "Prises en charge", "vert")}${kpiTile(v(m.outcomes.PENDING), "En attente de décision", "jaune")}</div>
    <h2 class="section-title">Vue d'ensemble</h2>
    ${foldHtml("p-curve", "À prendre en charge, évolution (12 semaines)", `${histogramSvg(m.weeklyCare.map((w) => ({ label: fmtDate(w.week).slice(0, 5), vals: [w.accepted, w.pending] })), [["Prises en charge", "var(--vert)"], ["En attente de décision", "var(--jaune)"]], { censor })}<div class="legend"><span><i style="background:var(--vert)"></i>Prises en charge</span><span><i style="background:var(--jaune)"></i>En attente de décision</span></div>`)}
    <div class="grid-2">${foldHtml("p-zone", "Évaluations par zone", donutHtml(ZONES.map((z) => ({ label: TESTS["PCL-5"].zoneText[z][0], color: zoneColor[z], value: m.zones[z] })), { censor }))}
      ${foldHtml("p-dec", "Prise en charge", donutHtml([{ label: "Prise en charge", color: "var(--vert)", value: acc }, { label: "En attente", color: "var(--jaune)", value: m.outcomes.PENDING }, { label: "Non prise en charge", color: "var(--rouge)", value: rej }], { censor }))}</div>
    <h2 class="section-title">Parcours et délais</h2>
    <div class="grid-3">${foldHtml("p-funnel", "Parcours des demandes", `<div class="funnel">${m.funnel.map(([l, n]) => `<div class="f-row"><span>${esc(l)}</span><div class="f-bar"><i style="width:${(n / fmax) * 100}%"></i></div><b>${v(n)}</b></div>`).join("")}</div>`, false)}
      ${foldHtml("p-delays", "Délais médians", `<dl class="kv">${m.delays.map(([l, d]) => `<dt>${esc(l)}</dt><dd>${d == null ? "—" : `${d} j`}</dd>`).join("")}</dl>`, false)}
      ${foldHtml("p-pending", "Dossiers en attente aujourd'hui", `<div class="funnel">${m.pending.map(([l, n]) => `<div class="f-row"><span>${esc(l)}</span><div class="f-bar warn"><i style="width:${(n / Math.max(1, ...m.pending.map((x) => x[1]))) * 100}%"></i></div><b>${v(n)}</b></div>`).join("")}</div>`, false)}</div>
    <h2 class="section-title">Accompagnement</h2>
    <div class="grid-2">${foldHtml("p-pcl", "Évolution du score PCL-5 (test de suivi)", `${donutHtml([{ label: "Amélioration (≥ 10 points)", color: "var(--vert)", value: m.trend.better }, { label: "Stable", color: "#94a3b8", value: m.trend.stable }, { label: "Aggravation (≥ 10 points)", color: "var(--rouge)", value: m.trend.worse }], { censor })}<p class="small muted">Écart entre l'évaluation initiale et le dernier test de suivi.</p>`, false)}
      ${foldHtml("p-att", "Assiduité aux séances", donutHtml(Object.entries(SESSION_STATUS).map(([k, [, l]], i) => ({ label: l, color: ["var(--vert)", "var(--jaune)", "var(--rouge)"][i], value: m.attendance[k] })), { censor }), false)}</div>
    <h2 class="section-title">Profil des sinistres</h2>
    ${foldHtml("p-prof", "Zone selon le profil", `<div class="toolbar">${segHtml("pdim", m.profile.map((d, i) => [i, d.label]), st.dim)}</div>${stackRowsHtml(dim.rows, ZONES.map((z) => zoneColor[z]), ZONES.map((z) => TESTS["PCL-5"].zoneText[z][0]), censor)}`, false)}
    <h2 class="section-title">Agences</h2>
    ${foldHtml("p-ag", "Comparaison des agences", `<div class="table-wrap"><table class="table"><thead><tr><th>Agence</th><th class="num-cell">Évaluations</th><th class="num-cell">Orange + rouge</th><th class="num-cell">Prises en charge</th><th class="num-cell">En attente</th><th class="num-cell">Délai médian de décision</th></tr></thead><tbody>${m.agencies.map((a) => `<tr><td><strong>${esc(a.agency)}</strong></td><td class="num-cell">${v(a.total)}</td><td class="num-cell">${censor && a.total < MIN_GROUP ? "—" : `${Math.round(((a.zones.ORANGE + a.zones.ROUGE) / Math.max(1, a.total)) * 100)} %`}</td><td class="num-cell">${v(a.accepted)}</td><td class="num-cell">${v(a.pending)}</td><td class="num-cell">${a.delay == null ? "—" : `${a.delay} j`}</td></tr>`).join("")}</tbody></table></div>`, false)}`;
  bindSeg(el, (k, val) => { if (k === "pdim") { st.dim = +val; folds["p-prof"] = true; again(); } });
}
/* ---------- ICJE (LONACI) ---------- */
function dashIcje(el, m, censor) {
  if (m.tooSmall) { el.innerHTML = tooSmallHtml; return; }
  const v = (n) => masked(n, censor), pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "—");
  const rows = (list) => stackRowsHtml(list, ICJE_COLORS, ICJE_CATS, censor, { valuesKey: "cats" });
  el.innerHTML = `<div class="tiles">${kpiTile(v(m.total), "Tests complétés")}${kpiTile(`${v(m.risk)} <small>${pct(m.risk, m.total)}</small>`, "À risque (modéré ou excessif)", "orange")}${kpiTile(v(m.excessif), "Jeu excessif", "rouge")}${kpiTile(`${v(m.callback)} <small>${pct(m.callback, m.risk)}</small>`, "Demandes d'appel (à risque)")}${kpiTile(v(m.support), "Accompagnement demandé")}${kpiTile(v(m.inCare), "Pris en charge", "vert")}</div>
    <div class="grid-2">${foldHtml("l-cat", "Répartition des catégories de risque", donutHtml(ICJE_CATS.map((label, i) => ({ label, color: ICJE_COLORS[i], value: m.cats[i] })), { censor }))}
      ${foldHtml("l-week", "Évolution hebdomadaire (12 semaines)", `${histogramSvg(m.weeklyCats.map((w) => ({ label: fmtDate(w.week).slice(0, 5), vals: w.cats })), ICJE_CATS.map((l, i) => [l, ICJE_COLORS[i]]), { censor })}<div class="legend">${ICJE_CATS.map((l, i) => `<span><i style="background:${ICJE_COLORS[i]}"></i>${l}</span>`).join("")}</div>`)}</div>
    <h2 class="section-title">Profil des joueurs</h2>
    <div class="grid-3">${foldHtml("l-sexe", "Sexe", rows(m.bySexe))}${foldHtml("l-geo", "Abidjan / intérieur", rows(m.byGeo))}${foldHtml("l-canal", "Canal", rows(m.byCanal))}</div>
    <div class="grid-2">${foldHtml("l-ville", "Villes", rows(m.byVille), false)}${foldHtml("l-plat", "Plateformes de jeux", rows(m.byPlat), false)}</div>
    ${foldHtml("l-items", "Réponses moyennes par question (0 = jamais, 3 = presque toujours)", `<div class="bars">${m.items.map((it, i) => `<div class="bar-row wide"><span title="${esc(it.q)}">${i + 1}. ${esc(it.q)}</span><div class="meter"><span style="width:${(it.mean / 3) * 100}%;background:var(--orange)"></span></div><span class="num-cell">${it.mean.toFixed(2)}</span></div>`).join("")}</div>`, false)}`;
}
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
    ${page.rows.map((e) => { const pt = db.patients.find((x) => x.evalId === e.id || (e.patientId && x.id === e.patientId)); return `<tr class="click" data-rep="${e.id}" tabindex="0"><td><strong>${esc(e.dossier)}</strong><div class="small muted">${e.kind}</div></td><td>${esc(displayName(personOf(e.personId)))}</td>${partnerIds.length > 1 ? `<td class="small">${esc(pName(e.partnerId))}</td>` : ""}<td class="small">${esc(e.agency)}</td><td class="small">${fmtDate(e.date)}</td><td>${zonePill(e.zone)} ${scoreText(e.test, e.score)}</td><td class="small">${OUTCOME_LABEL[outcomeOf(e)]}</td><td>${pt ? statusPill(pt) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">Aucune évaluation pour ces filtres.</td></tr>`}
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
    <h3>Consentements</h3><dl class="kv">${p.consents.map((c) => `<dt>${esc(c.label)}</dt><dd>${(c.moment === "pre" ? ev.consentsPre[c.id] : ev.consentsPost[c.id]) ? "Oui" : "Non"}</dd>`).join("")}</dl>`, null, true);
}
