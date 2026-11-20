/*
 * mod-work.js : « Validation » (validateur, rôles qui l'incluent, admin Yodan) et « Suivi des agences » (superviseur secondaire).
 * Repris de la maquette CNPS (LAMIFI v2) : file « À décider » liste + détail, « Traités », hors délai, équipe.
 */
"use strict";

const inScope = (scope) => (x) => scope.partnerIds.includes(x.partnerId) && (!scope.agencies || scope.agencies.includes(x.agency ?? evaluationOf(x.evalId)?.agency));
const agencyOfItem = (x) => x.agency ?? evaluationOf(x.evalId)?.agency;
const agencyFilter = {};
function agencyFilterHtml(key, list, count) {
  if (list.length < 2) return "";
  return `<div class="toolbar">${segHtml(`ag-${key}`, [["", `Toutes (${count("")})`], ...list.map((a) => [a, `${a} (${count(a)})`])], agencyFilter[key] || "")}</div>`;
}
const byAgency = (key) => (x) => !agencyFilter[key] || agencyOfItem(x) === agencyFilter[key];
const nameOrDossier = (ev, hidden) => (hidden ? `Dossier ${ev.dossier}` : displayName(personOf(ev.personId)));

/* ---------- Dossier à décider ---------- */
const decideState = {};
function decideRow(ev, hidden) {
  return `<span class="t">${esc(nameOrDossier(ev, hidden))}</span><span class="pill ${zoneCls[ev.zone]}">${esc(zoneTitle(ev.test, ev))}</span><span class="s">📍 ${esc(ev.agency)} · ${esc(ev.test)} · ${rel(ev.date)}${isLate(ev) ? " · <strong class='late'>hors délai</strong>" : ""}</span>`;
}
function decideDetail(el, ev, done, { hidden = false, partnerLabel = false } = {}) {
  const p = partnerOf(ev.partnerId), T = TESTS[ev.test];
  const st = decideState[ev.id] || (decideState[ev.id] = { comment: false });
  el.innerHTML = `<div class="row-between"><div><h2 style="margin:0">${esc(nameOrDossier(ev, hidden))}</h2><span class="muted small">${partnerLabel ? `${esc(p.name)} · ` : ""}${esc(ev.agency)} · ${esc(MODE_LABEL[ev.mode])} · ${fmtLong(ev.date)}</span></div><span class="pill ${zoneCls[ev.zone]}">${esc(zoneTitle(ev.test, ev))}</span></div>
    ${ev.dims ? `<div class="dims" style="margin-top:1rem">${BSPA_DIMS.map((k) => `<div class="dim-row"><span>${BSPA_DIM_LABEL[k]}</span><div class="meter"><span style="width:${ev.dims[k].pct}%;background:${zoneColor[ev.dims[k].zone]}"></span></div><span class="pill ${zoneCls[ev.dims[k].zone]}">${ev.dims[k].pct}</span></div>`).join("")}</div>` : `<p>Score : <strong>${ev.score}</strong> / ${T.max}</p>`}
    <dl class="kv"><dt>Dossier</dt><dd>${esc(ev.dossier)}</dd><dt>Décision possible jusqu'au</dt><dd>${fmtLong(decisionDeadline(ev))}</dd></dl>
    ${hidden ? "" : `<details><summary>Voir les réponses</summary><div class="recap-list">${T.items.map((it, i) => `<div class="recap-row"><span>${esc(it.t)}</span><strong>${esc(it.o.find(([v]) => v === ev.answers[i])?.[1] ?? "—")}</strong></div>`).join("")}</div></details>`}
    <div class="field" id="cm-box" ${st.comment ? "" : "hidden"} style="margin-top:.6rem"><label for="d-comment">Commentaire (facultatif)</label><textarea id="d-comment" rows="2" maxlength="300"></textarea></div>
    ${st.comment ? "" : `<button type="button" class="link-btn small" id="cm-add">+ Ajouter un commentaire</button>`}
    <div class="decide"><button type="button" class="btn btn-success" id="d-yes">✓ À prendre en charge <span class="kbd">O</span></button><button type="button" class="btn btn-danger" id="d-no">✕ Pas de prise en charge <span class="kbd">N</span></button></div>`;
  const resolve = (yes) => {
    decide(ev.id, yes, { by: session.identityId, comment: $("#d-comment", el)?.value || "" });
    toast(`${yes ? "À prendre en charge : la personne apparaît chez Yodan" : "Pas de prise en charge"} — ${esc(nameOrDossier(ev, hidden))}`);
    qKeys = null; done();
  };
  $("#cm-add", el)?.addEventListener("click", () => { st.comment = true; $("#cm-box", el).hidden = false; $("#d-comment", el).focus(); $("#cm-add", el).remove(); });
  $("#d-yes", el).addEventListener("click", () => resolve(true));
  $("#d-no", el).addEventListener("click", () => resolve(false));
  qKeys = (e) => { if (e.key.toLowerCase() === "o") resolve(true); if (e.key.toLowerCase() === "n") resolve(false); };
}
/* ---------- Dossiers traités ---------- */
function doneTable(el, scope, key, hidden) {
  const st = subs[`done-q-${key}`] || "";
  const rows = db.evaluations.filter((e) => inScope(scope)(e) && byAgency(key)(e) && outcomeOf(e) !== "PENDING" && (!st || norm(`${hidden ? "" : displayName(personOf(e.personId))} ${e.dossier}`).includes(norm(st)))).sort((a, b) => (b.decidedAt || b.date).localeCompare(a.decidedAt || a.date));
  const page = pageOf(`done-${key}`, rows);
  el.innerHTML = `<div class="card"><div class="toolbar"><input type="search" class="grow" id="done-q-${key}" placeholder="Rechercher ${hidden ? "un N°" : "un nom ou un N°"}…" value="${esc(st)}" aria-label="Rechercher"></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th>${multi(scope) ? "<th>Partenaire</th>" : ""}<th>Agence</th><th>Résultat</th><th>Décision</th><th>Par</th><th>Date</th></tr></thead><tbody>
    ${page.rows.map((e) => `<tr><td><strong>${esc(nameOrDossier(e, hidden))}</strong>${hidden ? "" : `<div class="small muted">${esc(e.dossier)}</div>`}</td>${multi(scope) ? `<td class="small">${esc(pName(e.partnerId))}</td>` : ""}<td class="small">${esc(e.agency)}</td><td>${zonePill(e.zone)}</td><td><span class="pill ${OUTCOME_PILL[outcomeOf(e)]}">${OUTCOME_LABEL[outcomeOf(e)]}</span>${e.comment ? ` <span title="${esc(e.comment)}">💬</span>` : ""}</td><td class="small">${e.decidedBy ? esc(identityOf(e.decidedBy)?.name || "—") : "Automatique"}</td><td class="small">${fmtDate(e.decidedAt || e.date)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Aucun dossier.</td></tr>`}</tbody></table></div>${page.html}</div>`;
  bindSearch($(`#done-q-${key}`, el), (v) => { subs[`done-q-${key}`] = v; resetPage(`done-${key}`); doneTable(el, scope, key, hidden); });
  bindPager(el, `done-${key}`, () => doneTable(el, scope, key, hidden));
}

/* =====================================================================
 * Validation
 * ===================================================================== */
const inboxStates = {};
const ibState = (k) => inboxStates[k] || (inboxStates[k] = { sel: null, q: "", open: false });
function viewValidation(el, scope, key) {
  const pending = () => pendingDecisions(scope.partnerIds).filter(inScope(scope));
  const tabs = [{ id: "decide", label: "À décider", count: pending().length, hot: true }, { id: "done", label: "Traités" }];
  const sub = subOf(`val-${key}`, tabs);
  const src = sub === "decide" ? pending : () => db.evaluations.filter((e) => inScope(scope)(e) && outcomeOf(e) !== "PENDING");
  const agencies = scope.agencies || [...new Set(scope.partnerIds.flatMap((id) => partnerOf(id).agencies))];
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Validation</span><h1>${pending().length} à décider</h1></div></div>
    ${subTabsHtml(`val-${key}`, tabs, sub)}<div id="va-ag">${multi(scope) ? "" : agencyFilterHtml(key, agencies, (a) => src().filter((x) => !a || agencyOfItem(x) === a).length)}</div><div id="va-body"></div>`;
  bindSubTabs(el, () => viewValidation(el, scope, key));
  bindSeg($("#va-ag", el), (k, v) => { agencyFilter[key] = v; Object.values(inboxStates).forEach((s) => { s.sel = null; }); viewValidation(el, scope, key); });
  const body = $("#va-body", el);
  if (sub === "done") return doneTable(body, scope, key, false);
  inboxInto(body, { key: `dec-${key}`, state: ibState(`dec-${key}`), items: () => pending().filter(byAgency(key)), text: (e) => `${displayName(personOf(e.personId))} ${e.dossier}`, row: (e) => decideRow(e, false), detail: (d, e) => decideDetail(d, e, () => viewValidation(el, scope, key), { partnerLabel: multi(scope) }), empty: "Les bilans verts sont sans suite ; les autres zones non validées partent directement chez Yodan.", search: "Rechercher un nom ou un N°…" });
}

/* =====================================================================
 * Suivi des agences (Superviseur secondaire) : dossiers, hors délai, équipe
 * ===================================================================== */
function viewSuivi(el, scope, key) {
  const p = partnerOf(scope.partnerIds[0]);
  const agencies = scope.agencies || p.agencies;
  const sc = { ...scope, agencies };
  const late = () => pendingDecisions([p.id]).filter(inScope(sc)).filter(isLate);
  const tabs = [{ id: "dossiers", label: "Suivi des dossiers" }, ...(partnerValidates(p) ? [{ id: "late", label: "Hors délai", count: late().length, hot: true }] : []), { id: "team", label: "Équipe" }];
  const sub = subOf(`sv-${key}`, tabs);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Suivi des agences</span><h1>${agencies.map(esc).join(", ")}</h1></div></div>${subTabsHtml(`sv-${key}`, tabs, sub)}<div id="sv-body"></div>`;
  bindSubTabs(el, () => viewSuivi(el, scope, key));
  const body = $("#sv-body", el);
  if (sub === "late") return inboxInto(body, { key: `late-${key}`, state: ibState(`late-${key}`), items: late, text: (e) => e.dossier, row: (e) => decideRow(e, true), detail: (d, e) => decideDetail(d, e, () => viewSuivi(el, scope, key), { hidden: true }), empty: "Aucun dossier hors délai.", search: "Rechercher un N°…" });
  if (sub === "team") return teamTable(body, p, agencies);
  dossiersTable(body, sc, key);
}
/** Suivi des dossiers : N° et statut seulement, jamais l'identité. */
function dossiersTable(el, scope, key) {
  const f = subs[`dos-f-${key}`] || "all";
  const rows = db.patients.filter((x) => inScope(scope)(x) && (f === "all" || patientStatus(x) === f)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = pageOf(`dos-${key}`, rows);
  el.innerHTML = `<div class="card"><div class="toolbar">${segHtml(`dos-${key}`, [["all", "Tous"], ...Object.entries(PEC_STATUS).map(([s, [, l]]) => [s, l])], f)}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Agence</th><th>Depuis</th><th>Statut</th></tr></thead><tbody>
    ${page.rows.map((x) => `<tr><td><strong>${esc(x.dossier)}</strong></td><td class="small">${esc(agencyOfItem(x))}</td><td class="small">${fmtDate(x.createdAt)}</td><td>${pill(PEC_STATUS[patientStatus(x)])}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">Aucun dossier.</td></tr>`}</tbody></table></div>${page.html}</div>`;
  bindSeg(el, (k, v) => { subs[`dos-f-${key}`] = v; resetPage(`dos-${key}`); dossiersTable(el, scope, key); });
  bindPager(el, `dos-${key}`, () => dossiersTable(el, scope, key));
}
function teamTable(el, p, agencies) {
  const rows = db.assignments.filter((a) => a.partnerId === p.id && ["EVAL", "VALID"].includes(a.role) && a.agencies.some((x) => agencies.includes(x)));
  el.innerHTML = `<div class="card table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Rôle</th><th>Agences</th><th class="num-cell">Décisions</th><th class="num-cell">En attente</th></tr></thead><tbody>
    ${rows.map((a) => { const i = identityOf(a.identityId); const ag = a.agencies.filter((x) => agencies.includes(x)); return `<tr><td><strong>${esc(i.name)}</strong>${a.active && !i.disabled ? "" : ' <span class="pill gris">désactivé</span>'}</td><td>${ROLE_LABEL[a.role]}</td><td>${ag.map((x) => `<span class="chip">${esc(x)}</span>`).join(" ")}</td><td class="num-cell">${db.evaluations.filter((e) => e.decidedBy === i.id).length}</td><td class="num-cell">${pendingDecisions([p.id]).filter((e) => ag.includes(e.agency)).length}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">Aucun évaluateur ni validateur sur ces agences.</td></tr>`}</tbody></table></div>`;
}
