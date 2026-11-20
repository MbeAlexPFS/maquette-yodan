/*
 * mod-work.js : « Validation » (validateur, rôles parents, admin Yodan) et « Suivi des agences » (superviseur adjoint).
 * Repris de LAMIFI Business v2 : files « À décider », « À appeler », « Traités », pilotage, hors délai, bons, équipe, QR ouvert.
 */
"use strict";

const inScope = (scope) => (x) => scope.partnerIds.includes(x.partnerId) && (!scope.agencies || scope.agencies.includes(x.agency ?? evaluationOf(x.evalId)?.agency));
const agencyOfItem = (x) => x.agency ?? evaluationOf(x.evalId)?.agency;
const agencyFilter = {};
function agencyFilterHtml(key, list, count) {
  if (list.length < 2) return "";
  return `<div class="toolbar">${segHtml(`ag-${key}`, [["", `Toutes (${count("")})`], ...list.map((a) => [a, `${a.replace(/^Agence /, "")} (${count(a)})`])], agencyFilter[key] || "")}</div>`;
}
const byAgency = (key) => (x) => !agencyFilter[key] || agencyOfItem(x) === agencyFilter[key];
const nameOrDossier = (ev, hidden) => (hidden ? `Dossier ${ev.dossier}` : displayName(personOf(ev.personId)));

/* ---------- Détail d'un dossier à décider ---------- */
const decideState = {};
function decideRow(ev, hidden) {
  return `<span class="t">${esc(nameOrDossier(ev, hidden))}</span><span class="pill ${zoneCls[ev.zone]}">${scoreText(ev.test, ev.score)}</span><span class="s">📍 ${esc(ev.agency.replace(/^Agence /, ""))} · évalué ${rel(ev.date)}${isLate(ev) ? " · <strong class='late'>hors délai</strong>" : ""}</span>`;
}
function decideDetail(el, ev, done, { hidden = false, partnerLabel = false } = {}) {
  const p = partnerOf(ev.partnerId), T = TESTS[ev.test], person = personOf(ev.personId);
  const st = decideState[ev.id] || (decideState[ev.id] = { comment: false });
  const by = ev.by ? identityOf(ev.by)?.name : MODE_LABEL[ev.mode];
  el.innerHTML = `<div class="row-between"><div><h2 style="margin:0">${esc(nameOrDossier(ev, hidden))}</h2><span class="muted small">${partnerLabel ? `${esc(p.name)} · ` : ""}${esc(ev.agency)} · ${esc(by || "—")} · ${fmtLong(ev.date)}</span></div><span class="pill ${zoneCls[ev.zone]}">${esc(zoneTitle(ev.test, ev))}</span></div>
    <div class="score z-${ev.zone}"><div class="n">${ev.score}<span class="small">/${T.max}</span></div><div class="score-bar" aria-hidden="true"><i style="left:${(ev.score / T.max) * 100}%"></i></div></div>
    <dl class="kv"><dt>${esc(p.idLabels[0])}</dt><dd>${esc(hidden ? "masqué" : person.id1)}</dd>${p.idLabels[1] ? `<dt>${esc(p.idLabels[1])}</dt><dd>${esc(hidden ? "masqué" : ev.id2 || "—")}</dd>` : ""}
      ${ev.profile.type_sinistre ? `<dt>Type</dt><dd>${esc(ev.profile.type_sinistre)}</dd>` : ""}<dt>Test</dt><dd>${esc(T.label)}</dd><dt>Décision possible jusqu'au</dt><dd>${fmtLong(decisionDeadline(ev))}</dd>
      <dt>Délai de recours</dt><dd>${agencyOpt(p, ev.agency).appealDays} jour(s) après la décision</dd></dl>
    ${hidden ? "" : `<details><summary>Voir les réponses au questionnaire</summary><div class="recap-list">${T.items.map((it, i) => `<div class="recap-row"><span>${esc(it.t)}</span><strong>${esc(it.o.find(([v]) => v === ev.answers[i])?.[1] ?? "—")}</strong></div>`).join("")}</div></details>`}
    <div class="field" id="cm-box" ${st.comment ? "" : "hidden"} style="margin-top:.6rem"><label for="d-comment">Commentaire (facultatif)</label><textarea id="d-comment" rows="2" maxlength="300" placeholder="Motif, éléments utiles au suivi…"></textarea></div>
    ${st.comment ? "" : `<button type="button" class="link-btn small" id="cm-add">+ Ajouter un commentaire</button>`}
    <div class="decide"><button type="button" class="btn btn-success" id="d-yes">✓ Prise en charge <span class="kbd">O</span></button><button type="button" class="btn btn-danger" id="d-no">✕ Pas de prise en charge <span class="kbd">N</span></button></div>`;
  const resolve = (yes) => {
    decide(ev.id, yes, { by: session.identityId, comment: $("#d-comment", el)?.value || "" });
    toast(`${yes ? "Prise en charge" : "Pas de prise en charge"} — ${esc(nameOrDossier(ev, hidden))}${yes ? ` · ${p.pec.mode === "bon" ? "bon attendu du superviseur adjoint" : "le dossier part chez Yodan"}` : ""}`);
    qKeys = null; done();
  };
  $("#cm-add", el)?.addEventListener("click", () => { st.comment = true; $("#cm-box", el).hidden = false; $("#d-comment", el).focus(); $("#cm-add", el).remove(); });
  $("#d-yes", el).addEventListener("click", () => resolve(true));
  $("#d-no", el).addEventListener("click", () => resolve(false));
  qKeys = (e) => { if (e.key.toLowerCase() === "o") resolve(true); if (e.key.toLowerCase() === "n") resolve(false); };
}
/* ---------- Accord du patient (type budget) ---------- */
function accordRow(pt) { const ev = evaluationOf(pt.evalId); return `<span class="t">${esc(displayName(personOf(pt.personId)))}</span><span class="pill bleu">Accord attendu</span><span class="s">📍 ${esc(ev.agency.replace(/^Agence /, ""))} · ${rel(pt.createdAt)}${pt.accordCalls ? ` · ${pt.accordCalls} tentative(s)` : ""}</span>`; }
function accordDetail(el, pt, done, { partnerLabel = false } = {}) {
  const ev = evaluationOf(pt.evalId), person = personOf(pt.personId), phone = person.identity.telephone || (String(person.id1).includes("@") ? "" : person.id1);
  el.innerHTML = `<div class="row-between"><h2 style="margin:0">${esc(displayName(person))}</h2><span class="pill ${zoneCls[ev.zone]}">${esc(zoneTitle(ev.test, ev))}</span></div>
    <p class="muted small">${partnerLabel ? `${esc(pName(pt.partnerId))} · ` : ""}${esc(ev.agency)} · l'accord du patient est nécessaire pour démarrer la prise en charge.</p>
    ${phone ? `<a class="btn btn-primary btn-lg btn-block" href="tel:${esc(phone.replace(/\s/g, ""))}">📞 Appeler ${esc(phone)}</a>` : `<p class="banner banner-warn">Pas de numéro : contact par e-mail (${esc(person.id1)}).</p>`}
    <h3>Choix du patient avec son résultat</h3><ul class="small">${consentsOf(partnerOf(pt.partnerId), "post", ev.zone).map((c) => `<li>${esc(c.label)} : <strong>${ev.consentsPost[c.id] ? "oui" : "non"}</strong></li>`).join("") || "<li>—</li>"}</ul>
    <h3>Issue de l'appel</h3><div class="choice-cards"><button type="button" class="choice-card" data-o="ACCEPTE"><span class="ico">👍</span><strong>Il accepte</strong><span class="muted small">Le dossier part chez Yodan (praticien, attestation).</span></button>
      <button type="button" class="choice-card" data-o="REFUSE"><span class="ico">👎</span><strong>Il refuse</strong><span class="muted small">Le dossier sera clos.</span></button>
      <button type="button" class="choice-card" data-o="INJOIGNABLE"><span class="ico">📵</span><strong>Injoignable</strong><span class="muted small">Reste dans la liste.</span></button></div>`;
  $$("[data-o]", el).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.o === "REFUSE" && !b.dataset.armed) { b.dataset.armed = "1"; b.innerHTML = `<span class="ico">⚠️</span><strong>Confirmer le refus</strong><span class="muted small">Cliquez encore pour clore le dossier.</span>`; b.classList.add("armed"); return; }
    recordAccord(pt.id, b.dataset.o);
    toast({ ACCEPTE: "Accord enregistré : le dossier part chez Yodan.", REFUSE: "Refus enregistré : dossier clos.", INJOIGNABLE: `Tentative n° ${pt.accordCalls} notée.` }[b.dataset.o]);
    done();
  }));
}
/* ---------- Dossiers traités ---------- */
function doneTable(el, scope, key, hidden) {
  const st = subs[`done-q-${key}`] || "";
  const rows = db.evaluations.filter((e) => inScope(scope)(e) && byAgency(key)(e) && e.kind === "Initiale" && outcomeOf(e) !== "PENDING" && (!st || norm(`${hidden ? "" : displayName(personOf(e.personId))} ${e.dossier} ${personOf(e.personId).id1}`).includes(norm(st)))).sort((a, b) => (b.decidedAt || b.date).localeCompare(a.decidedAt || a.date));
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
  const yodan = scope.actor === "yodan";
  const pending = () => pendingDecisions(scope.partnerIds).filter(inScope(scope));
  // Accord du patient : chez le validateur du partenaire ; chez Yodan pour les partenaires sans validateur (onglet Patients).
  const accords = () => accordQueue(scope.partnerIds).filter(inScope(scope)).filter((x) => !yodan || partnerValidates(partnerOf(x.partnerId)));
  const tabs = [{ id: "decide", label: "À décider", count: pending().length, hot: true }, ...(accords().length || scope.partnerIds.some((id) => partnerOf(id).pec.mode === "budget") ? [{ id: "accord", label: "À appeler", count: accords().length, hot: true }] : []), { id: "done", label: "Traités" }];
  const sub = subOf(`val-${key}`, tabs);
  const src = { decide: pending, accord: accords, done: () => db.evaluations.filter((e) => inScope(scope)(e) && e.kind === "Initiale" && outcomeOf(e) !== "PENDING") }[sub];
  const agencies = scope.agencies || [...new Set(scope.partnerIds.flatMap((id) => partnerOf(id).agencies))];
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Validation</span><h1>${pending().length} à décider${accords().length ? ` · ${accords().length} accord(s) à recueillir` : ""}</h1></div></div>
    ${subTabsHtml(`val-${key}`, tabs, sub)}<div id="va-ag">${multi(scope) ? "" : agencyFilterHtml(key, agencies, (a) => src().filter((x) => !a || agencyOfItem(x) === a).length)}</div><div id="va-body"></div>`;
  bindSubTabs(el, () => viewValidation(el, scope, key));
  bindSeg($("#va-ag", el), (k, v) => { agencyFilter[key] = v; Object.values(inboxStates).forEach((s) => { s.sel = null; }); viewValidation(el, scope, key); });
  const body = $("#va-body", el);
  const again = () => viewValidation(el, scope, key);
  if (sub === "done") return doneTable(body, scope, key, false);
  if (sub === "accord") return inboxInto(body, { key: `acc-${key}`, state: ibState(`acc-${key}`), items: () => accords().filter(byAgency(key)), text: (x) => `${displayName(personOf(x.personId))} ${x.dossier}`, row: accordRow, detail: (d, x) => accordDetail(d, x, again, { partnerLabel: multi(scope) }), empty: "Aucun accord à recueillir.", search: "Rechercher un nom ou un N°…" });
  inboxInto(body, { key: `dec-${key}`, state: ibState(`dec-${key}`), items: () => pending().filter(byAgency(key)), text: (e) => `${displayName(personOf(e.personId))} ${e.dossier} ${personOf(e.personId).id1}`, row: (e) => decideRow(e, false), detail: (d, e) => decideDetail(d, e, again, { partnerLabel: multi(scope) }), empty: "Les dossiers verts (et rouges, selon l'agence) sont décidés automatiquement. Seuls les autres arrivent ici.", search: "Rechercher un nom ou un N°…" });
}

/* =====================================================================
 * Suivi des agences (Superviseur adjoint)
 * ===================================================================== */
function viewSuivi(el, scope, key) {
  const p = partnerOf(scope.partnerIds[0]);
  const agencies = scope.agencies || p.agencies;
  const sc = { ...scope, agencies };
  const late = () => pendingDecisions([p.id]).filter(inScope(sc)).filter(isLate);
  const bons = () => db.patients.filter((x) => x.partnerId === p.id && inScope(sc)(x) && patientStatus(x) === "PAS_DE_BON");
  const tabs = [{ id: "dossiers", label: "Suivi des dossiers" },
    ...(partnerValidates(p) ? [{ id: "late", label: "Hors délai", count: late().length, hot: true }] : []),
    ...(p.pec.mode === "bon" ? [{ id: "bons", label: "Bons de prise en charge", count: bons().filter((x) => !inAppeal(x)).length, hot: true }] : []),
    { id: "team", label: "Équipe" }, { id: "qr", label: "Lien QR ouvert" }];
  const sub = subOf(`sv-${key}`, tabs);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Suivi des agences</span><h1>${agencies.length > 1 ? `${agencies.length} agences` : esc(agencies[0])}</h1></div></div>${subTabsHtml(`sv-${key}`, tabs, sub)}<div id="sv-body"></div>`;
  bindSubTabs(el, () => viewSuivi(el, scope, key));
  const body = $("#sv-body", el), again = () => viewSuivi(el, scope, key);
  if (sub === "late") { body.innerHTML = `<div id="late-box"></div>`; return inboxInto($("#late-box", body), { key: `late-${key}`, state: ibState(`late-${key}`), items: late, text: (e) => e.dossier, row: (e) => decideRow(e, true), detail: (d, e) => decideDetail(d, e, again, { hidden: true }), empty: "Aucun dossier hors délai : l'équipe est à jour.", search: "Rechercher un N°…" }); }
  if (sub === "bons") return inboxInto(body, { key: `bon-${key}`, state: ibState(`bon-${key}`), items: bons, text: (x) => x.dossier, row: (x) => `<span class="t">Dossier ${esc(x.dossier)}</span>${inAppeal(x) ? `<span class="pill gris">le ${fmtDate(x.availableAt)}</span>` : `<span class="pill orange">${x.bons.length ? "Nouveau bon" : "Bon"}</span>`}<span class="s">📍 ${esc(agencyOfItem(x).replace(/^Agence /, ""))} · validé ${rel(x.createdAt)} · ${consumedOf(x)} consultation(s)</span>`, detail: (d, x) => bonDetail(d, x, again), empty: "Aucun bon à déposer.", search: "Rechercher un N°…" });
  if (sub === "dossiers") return dossiersTable(body, sc, key);
  if (sub === "team") return teamTable(body, p, agencies);
  qrPosters(body, p, agencies);
}
function bonDetail(el, pt, done) {
  const p = partnerOf(pt.partnerId);
  if (inAppeal(pt)) { el.innerHTML = `<h2>Dossier ${esc(pt.dossier)}</h2><div class="banner banner-info">⏳ Délai de recours en cours. Dépôt du bon possible à partir du <strong>${fmtLong(pt.availableAt)}</strong>. Le dossier remontera tout seul.</div>`; return; }
  const st = decideState[`bon-${pt.id}`] || (decideState[`bon-${pt.id}`] = { file: null });
  el.innerHTML = `<h2>Bon de prise en charge — dossier ${esc(pt.dossier)}</h2><p class="small muted">${pt.bons.length ? `${pt.bons.length} bon(s) déjà consommé(s) : ${consumedOf(pt)} consultations réalisées.` : "Premier bon : il couvre"} ${p.pec.max} consultations.</p>
    ${st.file ? `<div class="card-flat row-between"><div><strong>📄 ${esc(st.file)}</strong><div class="small muted">PDF · 1 page · 240 Ko</div></div><button type="button" class="link-btn" id="bn-pick">Changer</button></div><div class="banner banner-warn" style="margin-top:1rem">Après l'envoi, le bon part chez Yodan et vous ne pourrez plus l'ouvrir. Vérifiez qu'il s'agit du bon document.</div>`
      : `<button type="button" class="choice-card drop" id="bn-pick"><span class="ico">⬆️</span><strong>Déposer le bon ici</strong><span class="muted small">ou ${isMobile() ? "prendre une photo" : "cliquer pour choisir"} · PDF, JPG, PNG · 10 Mo max.</span></button>`}
    <div class="wizard-foot"><span></span><button type="button" class="btn btn-orange btn-lg" id="bn-send" ${st.file ? "" : "disabled"}>Envoyer le bon à Yodan</button></div>`;
  $("#bn-pick", el).addEventListener("click", () => { st.file = `bon_${pt.dossier}.pdf`; bonDetail(el, pt, done); });
  $("#bn-send", el).addEventListener("click", () => { depositBon(pt.id, st.file); delete decideState[`bon-${pt.id}`]; toast("Bon transmis à Yodan : le patient va être orienté vers un praticien."); done(); });
}
function dossiersTable(el, scope, key) {
  const f = subs[`dos-f-${key}`] || "all";
  const rows = db.patients.filter((x) => inScope(scope)(x) && (f === "all" || patientStatus(x) === f)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = pageOf(`dos-${key}`, rows);
  const p = partnerOf(scope.partnerIds[0]);
  el.innerHTML = `<div class="card"><div class="toolbar">${segHtml(`dos-${key}`, [["all", "Tous"], ...statusesFor(p.pec.mode).map((s) => [s, PEC_STATUS[s][1]])], f)}<span class="grow"></span><button type="button" class="btn btn-sm" id="dos-x">⬇ Exporter</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Agence</th><th>Depuis</th><th>Statut</th><th>Étape</th></tr></thead><tbody>
    ${page.rows.map((x) => `<tr><td><strong>${esc(x.dossier)}</strong></td><td class="small">${esc(agencyOfItem(x))}</td><td class="small">${fmtDate(x.createdAt)}</td><td>${statusPill(x)}</td><td class="small">${esc(waitingReason(x))}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Aucun dossier.</td></tr>`}</tbody></table></div>${page.html}</div>`;
  bindSeg(el, (k, v) => { subs[`dos-f-${key}`] = v; resetPage(`dos-${key}`); dossiersTable(el, scope, key); });
  bindPager(el, `dos-${key}`, () => dossiersTable(el, scope, key));
  $("#dos-x", el).addEventListener("click", () => exportToast("Suivi des dossiers (N° seulement)"));
}
function teamTable(el, p, agencies) {
  const rows = db.assignments.filter((a) => a.partnerId === p.id && ["EVAL", "VALID"].includes(a.role) && a.agencies.some((x) => agencies.includes(x)));
  el.innerHTML = `<div class="card table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Rôle</th><th>Agences</th><th class="num-cell">Évaluations</th><th class="num-cell">Décisions</th><th class="num-cell">En attente</th></tr></thead><tbody>
    ${rows.map((a) => { const i = identityOf(a.identityId); const ag = a.agencies.filter((x) => agencies.includes(x)); return `<tr><td><strong>${esc(i.name)}</strong>${a.active && !i.disabled ? "" : ' <span class="pill gris">désactivé</span>'}</td><td>${ROLE_LABEL[a.role]}</td><td>${ag.map((x) => `<span class="chip">${esc(x.replace(/^Agence /, ""))}</span>`).join(" ")}</td><td class="num-cell">${db.evaluations.filter((e) => e.by === i.id).length}</td><td class="num-cell">${a.role === "VALID" ? db.evaluations.filter((e) => e.decidedBy === i.id).length : "—"}</td><td class="num-cell">${a.role === "VALID" ? pendingDecisions([p.id]).filter((e) => ag.includes(e.agency)).length : "—"}</td></tr>`; }).join("") || `<tr><td colspan="6" class="empty">Aucun évaluateur ni validateur.</td></tr>`}</tbody></table>
    <p class="small muted">La création, la migration et la désactivation des comptes se font dans « Comptes » (Administrateur).</p></div>`;
}
function qrPosters(el, p, agencies) {
  el.innerHTML = `<div class="grid-3">${agencies.map((a) => { const o = agencyOpt(p, a); return `<div class="card"><div class="row-between"><h3 style="margin:0">${esc(a)}</h3><span class="pill ${o.qrAllowed && o.qrActive ? "vert" : "gris"}">${o.qrAllowed && o.qrActive ? "Actif" : "Inactif"}</span></div>
      ${!o.qrAllowed ? `<p class="muted small">Désactivé par l'Administrateur (Agences et options).</p>` : o.qrActive ? `<div class="qr-box small-qr">${qrSvg(a, 140)}</div>` : `<p class="muted small">Aucune affiche en service.</p>`}
      ${o.qrAllowed ? `<div class="actions">${o.qrActive ? `<button type="button" class="btn btn-sm" data-print="${esc(a)}">🖨 Imprimer l'affiche</button>` : ""}<button type="button" class="btn btn-sm ${o.qrActive ? "" : "btn-primary"}" data-regen="${esc(a)}">${o.qrActive ? "Régénérer" : "Activer"}</button></div>` : ""}</div>`; }).join("")}</div>`;
  $$("[data-print]", el).forEach((b) => b.addEventListener("click", () => toast("Ouverture de l'affiche à imprimer.")));
  $$("[data-regen]", el).forEach((b) => b.addEventListener("click", () => {
    const o = agencyOpt(p, b.dataset.regen);
    if (!o.qrActive) { o.qrActive = true; audit("Activation QR ouvert", b.dataset.regen); toast("Affiche activée."); return render(); }
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.className = "btn btn-sm btn-danger"; b.textContent = "Confirmer : l'ancienne affiche ne marchera plus"; return; }
    audit("Régénération QR ouvert", b.dataset.regen); toast("Nouvelle affiche générée."); render();
  }));
}
