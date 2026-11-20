/*
 * mod-yodan.js : Patients (admin Yodan), Console de prise en charge, espace Praticien.
 * Repris de LAMIFI v2 (À faire, rappels, attestation en ligne / présentiel, agenda obligatoire, séances, scan QR).
 */
"use strict";

/* =====================================================================
 * Prise en charge : praticien (agenda en place) → attestation → envoi du lien
 * ===================================================================== */
function takeChargeWizard(ptId, done) {
  const pt = patientOf(ptId), ev = evaluationOf(pt.evalId), p = partnerOf(pt.partnerId), name = displayName(personOf(pt.personId));
  const sug = suggestPractitioner();
  const d = { prId: sug?.id || "", kind: sug?.kind === "externe" ? "IN_PERSON" : "ONLINE", agency: ev.agency, until: addDays(todayIso(), ATTESTATION_MONTHS * 30) };
  let step = 0;
  modal(`Attribution — ${name}`, "", (body, close) => {
    const draw = (err = "") => {
      const prs = db.practitioners.filter((x) => x.active);
      const panes = [
        `<h3>Praticien</h3><p class="small muted">Seuls les praticiens dont l'agenda est en place peuvent recevoir un patient.</p><div class="choice-cards one">${prs.map((x) => `<button type="button" class="choice-card ${d.prId === x.id ? "on" : ""}" data-pr="${x.id}" ${hasAgenda(x) ? "" : "disabled"}><strong>${esc(x.name)}${sug?.id === x.id ? ' <span class="pill vert">suggéré</span>' : ""}</strong><span class="muted small">${x.kind === "externe" ? "Externe · séances sur place (scan du QR)" : "Interne · consultation en ligne LAMIFI"} · ${practitionerLoad(x.id)} patient(s) en cours${hasAgenda(x) ? "" : " · ⛔ aucun jour de travail renseigné"}</span></button>`).join("")}</div>`,
        `<h3>Où se déroulent les séances ?</h3>${segHtml("att-kind", [["ONLINE", "💻 En ligne"], ["IN_PERSON", "🏢 En présentiel"]], d.kind)}
          ${d.kind === "IN_PERSON" ? `<div class="field" style="margin-top:.8rem"><label for="att-ag">Agence des séances</label><select id="att-ag">${p.agencies.map((a) => `<option ${a === d.agency ? "selected" : ""}>${esc(a)}</option>`).join("")}</select><div class="hint">Présélectionnée : agence du dossier.</div></div>` : ""}
          <div class="field" style="margin-top:.8rem"><label for="att-u">Attestation valable jusqu'au</label><input type="date" id="att-u" value="${d.until}" min="${todayIso()}"><div class="hint">3 mois par défaut.</div></div>`,
        `<div class="banner banner-ok">✓ Prise en charge activée pour <strong>${esc(name)}</strong> avec ${esc(practitionerOf(d.prId)?.name || "")}</div>
          <div class="field" style="margin-top:1rem"><label for="att-link">Lien de l'attestation à envoyer au patient</label><div class="actions"><input type="text" id="att-link" class="input grow" readonly value="${APP_URL}/att/${pt.attestation?.token || ""}"><button type="button" class="btn btn-primary" id="att-copy">Copier</button></div><div class="hint">Affiché une seule fois. Le lien ne contient aucune donnée de santé.</div></div>
          <div class="grid-2"><a class="btn" href="sms:?body=${encodeURIComponent(`Votre attestation : ${APP_URL}/att/${pt.attestation?.token || ""}`)}">✉️ Par SMS</a><a class="btn" href="mailto:?subject=${encodeURIComponent("Votre attestation")}&body=${encodeURIComponent(`${APP_URL}/att/${pt.attestation?.token || ""}`)}">📧 Par e-mail</a></div>`,
      ];
      body.innerHTML = `${stepperHtml(["Praticien", "Attestation", "Envoi du lien"], step)}${panes[step]}<div class="err" role="alert">${esc(err)}</div>
        <div class="wizard-foot">${step === 1 ? `<button type="button" class="btn btn-ghost" id="tc-b">← Retour</button>` : "<span></span>"}<button type="button" class="btn btn-orange btn-lg" id="tc-n">${["Continuer", "Émettre l'attestation", "Terminé"][step]}</button></div>`;
      $$("[data-pr]", body).forEach((b) => b.addEventListener("click", () => { d.prId = b.dataset.pr; d.kind = practitionerOf(d.prId).kind === "externe" ? "IN_PERSON" : "ONLINE"; draw(); }));
      bindSeg(body, (k, v) => { d.kind = v; draw(); });
      $("#att-ag", body)?.addEventListener("change", (e) => { d.agency = e.target.value; });
      $("#att-u", body)?.addEventListener("change", (e) => { d.until = e.target.value; });
      $("#att-copy", body)?.addEventListener("click", (e) => { navigator.clipboard?.writeText($("#att-link", body).value).catch(() => {}); e.target.textContent = "✓ Copié"; });
      $("#tc-b", body)?.addEventListener("click", () => { step--; draw(); });
      $("#tc-n", body).addEventListener("click", () => {
        if (step === 0) { if (!d.prId) return draw("Choisissez un praticien."); step++; return draw(); }
        if (step === 1) { if (!assignPractitioner(pt.id, d.prId, { kind: d.kind, agency: d.agency, until: d.until })) return draw("Prise en charge impossible (statut ou agenda)."); step++; return draw(); }
        close(); toast("Prise en charge activée, attestation émise."); done();
      });
    };
    draw();
  }, true);
}

/* =====================================================================
 * Admin Yodan — Patients
 * ===================================================================== */
const yp = { q: "", status: "all", quick: "all" };
const QUICK = {
  all: ["Tous", () => true],
  rappel: ["Rappels demandés", wantsCallback],
  accord: ["Accord à recueillir", (x) => x.accord === null && !x.closedAt && !inAppeal(x) && !partnerValidates(partnerOf(x.partnerId))],
  take: ["Prise en charge à valider", canTakeCharge],
  unlock: ["À débloquer", canUnlock],
};
function viewPatients(el, scope) {
  const base = db.patients.filter((x) => scope.partnerIds.includes(x.partnerId));
  const modes = [...new Set(scope.partnerIds.map((id) => partnerOf(id).pec.mode))];
  const statuses = Object.keys(PEC_STATUS).filter((s) => modes.some((m) => statusesFor(m).includes(s)));
  const rows = base.filter((x) => QUICK[yp.quick][1](x) && (yp.status === "all" || patientStatus(x) === yp.status) && (!yp.q || norm(`${x.dossier} ${displayName(personOf(x.personId))} ${personOf(x.personId).id1}`).includes(norm(yp.q)))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = pageOf("yo-pat", rows);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Patients</span><h1>Patients orientés vers Yodan</h1></div></div>
    <div class="toolbar">${Object.entries(QUICK).map(([k, [l, f]]) => `<button type="button" class="chip-btn ${yp.quick === k ? "on" : ""}" data-quick="${k}">${esc(l)} <span class="count ${k !== "all" && base.filter(f).length ? "hot" : ""}">${base.filter(f).length}</span></button>`).join("")}</div>
    <div class="card"><div class="toolbar"><input type="search" class="grow" id="pt-q" placeholder="Dossier, nom, N° ou e-mail" value="${esc(yp.q)}" aria-label="Rechercher un patient">
      <select id="pt-s" aria-label="Statut"><option value="all">Tous les statuts</option>${statuses.map((s) => `<option value="${s}" ${yp.status === s ? "selected" : ""}>${PEC_STATUS[s][1]}</option>`).join("")}</select></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th>${multi(scope) ? "<th>Partenaire</th>" : ""}<th>Statut</th><th>Étape</th><th class="num-cell">Consult.</th><th></th></tr></thead><tbody>
    ${page.rows.map((x) => `<tr class="click" data-pt="${x.id}" tabindex="0"><td><strong>${esc(x.dossier)}</strong></td><td>${esc(displayName(personOf(x.personId)))}${wantsCallback(x) ? ' <span title="A demandé à être rappelé(e)">📞</span>' : ""}</td>${multi(scope) ? `<td class="small">${esc(pName(x.partnerId))}</td>` : ""}<td>${statusPill(x)}</td><td class="small">${esc(waitingReason(x))}</td><td class="num-cell">${consumedOf(x)} / ${capacityOf(x) || "—"}</td>
      <td>${canTakeCharge(x) ? `<span class="pill bleu">Prise en charge</span>` : canUnlock(x) ? `<span class="pill orange">Débloquer</span>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Aucun patient pour ces filtres.</td></tr>`}
    </tbody></table></div>${page.html}</div>`;
  const again = () => viewPatients(el, scope);
  $$("[data-quick]", el).forEach((b) => b.addEventListener("click", () => { yp.quick = b.dataset.quick; resetPage("yo-pat"); again(); }));
  bindSearch($("#pt-q", el), (v) => { yp.q = v; resetPage("yo-pat"); again(); });
  $("#pt-s", el).addEventListener("change", (e) => { yp.status = e.target.value; resetPage("yo-pat"); again(); });
  bindPager(el, "yo-pat", again);
  $$("[data-pt]", el).forEach((r) => { const o = () => patientModal(r.dataset.pt, again); r.addEventListener("click", o); r.addEventListener("keydown", (e) => { if (e.key === "Enter") o(); }); });
}
function patientModal(id, refresh) {
  const pt = patientOf(id);
  audit("Consultation fiche patient", pt.dossier);
  const draw = (body, close) => {
    const p = partnerOf(pt.partnerId), person = personOf(pt.personId), pr = practitionerOf(pt.practitionerId), ev = evaluationOf(pt.evalId), s = patientStatus(pt);
    const phone = person.identity.telephone || (String(person.id1).includes("@") ? "" : person.id1);
    body.innerHTML = `<div class="actions" style="margin-bottom:.6rem">${statusPill(pt)}<span class="small muted">Dossier ${esc(pt.dossier)} · pseudonyme ${esc(person.pseudo)} · ${esc(waitingReason(pt))}</span></div>
      <div class="grid-2"><div><h3>Personne</h3><dl class="kv"><dt>Nom</dt><dd>${esc(displayName(person))}</dd><dt>${esc(p.idLabels[0])}</dt><dd>${esc(person.id1)}</dd><dt>Partenaire</dt><dd>${esc(p.name)} · ${esc(ev.agency)}</dd><dt>Résultat</dt><dd>${zonePill(ev.zone)} ${esc(zoneTitle(ev.test, ev))} (${esc(ev.test)} ${scoreText(ev.test, ev.score)})</dd>
          <dt>Prise en charge</dt><dd>${PEC_MODE_LABEL[p.pec.mode]} · ${consumedOf(pt)} / ${capacityOf(pt) || 0} consultations</dd><dt>Praticien</dt><dd>${pr ? esc(pr.name) : "—"}</dd>${pt.attestation ? `<dt>Attestation</dt><dd>${pt.attestation.kind === "ONLINE" ? "En ligne" : `Présentiel · ${esc(pt.attestation.agency)}`} · jusqu'au ${fmtDate(pt.attestation.until)}</dd>` : ""}</dl>
        <h3 style="margin-top:1rem">Consentements</h3><dl class="kv">${consentMeta(pt).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
      <div><h3>Appel</h3>${pt.accord === null && !pt.closedAt ? `<div class="banner banner-info">Accord du patient à recueillir pendant l'appel.</div>` : ""}<div class="actions"><button type="button" class="btn btn-primary btn-sm" id="pm-call">📞 Appeler</button><span id="pm-num"></span></div>
        <form id="pm-ret" style="margin-top:.6rem"><div class="field"><label for="pm-o">Retour d'appel</label><select id="pm-o">${Object.entries(CALL_OUTCOMES).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
          <div class="field"><label for="pm-n">Commentaire (facultatif)</label><input id="pm-n" maxlength="200" placeholder="Ex. : rappeler après 17 h"></div><button class="btn btn-sm" type="submit">Enregistrer le retour</button></form>
        <ul class="small" style="padding-left:1rem">${pt.calls.slice().reverse().map((c) => `<li>${fmtDateTime(c.at)} — ${esc(CALL_OUTCOMES[c.outcome])}${c.note ? ` · <span class="muted">${esc(c.note)}</span>` : ""}</li>`).join("") || `<li class="muted">Aucun appel.</li>`}</ul></div></div>
      <div class="actions modal-actions">
        ${canTakeCharge(pt) ? `<button type="button" class="btn btn-orange" id="pm-take">Prise en charge</button><span class="small muted">Le dossier part dans la Console pour l'attribution d'un praticien.</span>` : ""}
        ${canUnlock(pt) ? `<button type="button" class="btn btn-orange" id="pm-unlock">🔓 Débloquer — ${s === "PAS_DE_BON" ? "enregistrer le bon reçu" : "nouveau budget"} (${p.pec.max} consult.)</button>` : ""}
        ${!canTakeCharge(pt) && !canUnlock(pt) ? `<span class="small muted">${esc(waitingReason(pt))}${s === "EN_COURS" ? " · suivi dans la Console" : ""}</span>` : ""}</div>`;
    $("#pm-call", body).addEventListener("click", () => { $("#pm-num", body).innerHTML = phone ? `<a href="tel:${esc(phone.replace(/\s/g, ""))}">${esc(phone)}</a>` : `<span class="muted">Pas de numéro (${esc(person.id1)})</span>`; audit("Appel patient", pt.dossier); });
    $("#pm-ret", body).addEventListener("submit", (e) => { e.preventDefault(); logCall(pt.id, $("#pm-o", body).value, $("#pm-n", body).value); toast("Retour d'appel enregistré."); draw(body, close); refresh(); });
    $("#pm-take", body)?.addEventListener("click", () => { transferToConsole(pt.id); toast("Prise en charge validée : le dossier est transmis à la Console pour l'attribution."); draw(body, close); refresh(); });
    $("#pm-unlock", body)?.addEventListener("click", () => { unlockPatient(pt.id); toast(s === "PAS_DE_BON" ? "Bon enregistré." : "Nouveau budget ouvert."); draw(body, close); refresh(); });
  };
  modal(`${displayName(personOf(pt.personId))} — ${pt.dossier}`, "", draw, true);
}

/* =====================================================================
 * Console — prise en charge
 * ===================================================================== */
function consolePec(el, pids) {
  const rows = db.patients.filter((x) => pids.includes(x.partnerId) && x.practitionerId).sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  const page = pageOf("co-pec", rows);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Prise en charge</span><h1>Patients pris en charge</h1></div></div>
    <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th><th>Partenaire</th><th>Praticien</th><th>Attestation</th><th class="num-cell">Consult.</th><th>Statut</th><th></th></tr></thead><tbody>
    ${page.rows.map((x) => `<tr><td><strong>${esc(x.dossier)}</strong></td><td>${esc(displayName(personOf(x.personId)))}</td><td class="small">${esc(pName(x.partnerId))}</td><td class="small">${esc(practitionerOf(x.practitionerId).name)}</td><td class="small">${x.attestation.kind === "ONLINE" ? "En ligne" : "Présentiel"} · ${fmtDate(x.attestation.until)}</td><td class="num-cell">${consumedOf(x)} / ${capacityOf(x)}</td><td>${statusPill(x)}</td><td><button type="button" class="btn btn-sm" data-h="${x.id}">Historique</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty">Aucun patient pris en charge.</td></tr>`}
    </tbody></table></div>${page.html}</div>`;
  bindPager(el, "co-pec", () => consolePec(el, pids));
  $$("[data-h]", el).forEach((b) => b.addEventListener("click", () => historyModal(b.dataset.h, () => consolePec(el, pids))));
}
function historyModal(id, refresh) {
  const pt = patientOf(id);
  audit("Consultation historique prise en charge", pt.dossier);
  modal(`Historique — ${pt.dossier}`, "", (body) => {
    const draw = () => {
      const fus = db.evaluations.filter((e) => e.patientId === pt.id);
      const ev0 = evaluationOf(pt.evalId);
      body.innerHTML = `<div class="actions" style="margin-bottom:.6rem">${statusPill(pt)}<span class="small muted">${esc(pName(pt.partnerId))} · ${consumedOf(pt)} / ${capacityOf(pt)} consultations · depuis le ${fmtDate(pt.assignedAt)}</span></div>
        <h3>Consultations</h3><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Date</th><th>Praticien</th><th>Présence</th><th>Rapport</th></tr></thead><tbody>
        ${pt.sessions.map((s, k) => `<tr><td>${k + 1}</td><td>${fmtDate(s.date)}</td><td class="small">${esc(practitionerOf(s.practitionerId)?.name || "—")}</td><td>${s.status ? pill(SESSION_STATUS[s.status]) : `<span class="pill bleu">Prévue</span>`}</td><td>${s.report ? `<button type="button" class="btn btn-sm btn-ghost" data-rep="${k}">📄 Rapport de séance</button>` : "—"}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Aucune séance.</td></tr>`}</tbody></table></div>
        ${ev0.test === "PCL-5" ? `<h3>Suivi PCL-5</h3><p class="small">Initial : <strong>${ev0.score}/80</strong> (${fmtDate(ev0.date)})${fus.map((f) => ` → suivi : <strong>${f.score}/80</strong> (${fmtDate(f.date)})`).join("") || " · aucun test de suivi pour l'instant"}</p>` : ""}
        <div class="actions" style="margin-top:.8rem">${patientStatus(pt) === "EN_COURS" ? `<button type="button" class="btn btn-sm btn-danger" id="h-close">Clore la prise en charge</button>` : ""}</div>`;
      $$("[data-rep]", body).forEach((b) => b.addEventListener("click", () => { audit("Ouverture rapport de séance", `${pt.dossier} #${+b.dataset.rep + 1}`); toast("Ouverture du rapport tracée dans le journal des accès."); }));
      $("#h-close", body)?.addEventListener("click", (e) => { if (!e.target.dataset.armed) { e.target.dataset.armed = "1"; e.target.textContent = "Confirmer la clôture"; return; } closePatient(pt.id); draw(); refresh(); });
    };
    draw();
  }, true);
}
/** Console : un sous-onglet par file (attribution, plafonds) pour ne pas cacher une file sous l'autre. */
function consoleAssign(el, pids) {
  const take = db.patients.filter((x) => pids.includes(x.partnerId) && canAssign(x));
  // Plafond atteint = bon ou budget réellement consommé (un premier bon encore attendu n'est pas un plafond).
  const unlock = db.patients.filter((x) => pids.includes(x.partnerId) && canUnlock(x) && capacityOf(x) > 0);
  const tabs = [{ id: "assign", label: "À attribuer", count: take.length, hot: true }, { id: "unlock", label: "Plafonds atteints", count: unlock.length, hot: true }];
  const sub = subOf("co-att", tabs);
  const sug = suggestPractitioner();
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Attribution</span><h1>À faire</h1></div></div>${subTabsHtml("co-att", tabs, sub)}
    ${sub === "assign" ? `<div class="card"><p class="small muted" style="margin-top:0">Dossiers dont la prise en charge a été validée par l'admin Yodan.</p><div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th><th>Partenaire</th><th>Transmis</th><th>Praticien suggéré</th><th></th></tr></thead><tbody>
    ${take.map((x) => `<tr><td><strong>${esc(x.dossier)}</strong></td><td>${esc(displayName(personOf(x.personId)))}</td><td class="small">${esc(pName(x.partnerId))}</td><td class="small">${rel(x.transferredAt)}</td><td class="small">${esc(sug?.name || "aucun agenda en place")}</td><td><button type="button" class="btn btn-sm btn-orange" data-tk="${x.id}">Attribuer un praticien</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">🎉 Personne en attente d'attribution.</td></tr>`}</tbody></table></div></div>`
    : `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th><th>Partenaire</th><th>Consultations</th><th></th></tr></thead><tbody>
    ${unlock.map((x) => `<tr><td><strong>${esc(x.dossier)}</strong></td><td>${esc(displayName(personOf(x.personId)))}</td><td class="small">${esc(pName(x.partnerId))}</td><td class="small">${consumedOf(x)} / ${capacityOf(x)} · ${esc(waitingReason(x))}</td><td><button type="button" class="btn btn-sm" data-ul="${x.id}">🔓 Débloquer</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty">Aucun plafond atteint.</td></tr>`}</tbody></table></div></div>`}`;
  bindSubTabs(el, () => consoleAssign(el, pids));
  $$("[data-tk]", el).forEach((b) => b.addEventListener("click", () => takeChargeWizard(b.dataset.tk, render)));
  $$("[data-ul]", el).forEach((b) => b.addEventListener("click", () => { unlockPatient(b.dataset.ul); toast("Déblocage enregistré."); render(); }));
}
function consoleDash(el, pids) {
  const m = pecDashboard(pids);
  const cls = { EN_ATTENTE: "", PAS_DE_BON: "orange", BUDGET_ATTEINT: "orange", EN_COURS: "vert", CLOS: "jaune" };
  const col = { EN_ATTENTE: "var(--sky)", PAS_DE_BON: "var(--orange)", BUDGET_ATTEINT: "#f59e0b", EN_COURS: "var(--vert)", CLOS: "#94a3b8" };
  const S = Object.keys(PEC_STATUS);
  const tabs = [{ id: "overview", label: "Vue d'ensemble" }, { id: "partners", label: "Par partenaire" }, { id: "practitioners", label: "Par praticien" }];
  const sub = subOf("co-dash", tabs);
  const views = {
    overview: () => `<div class="tiles">${kpiTile(m.total, "Patients")}${S.map((s) => kpiTile(m.byStatus[s], PEC_STATUS[s][1], cls[s])).join("")}${kpiTile(m.consultations, "Consultations réalisées")}</div>
      <div class="grid-2"><div class="card"><h2>Patients par statut</h2>${donutHtml(S.map((s) => ({ label: PEC_STATUS[s][1], color: col[s], value: m.byStatus[s] })))}</div>
        <div class="card"><h2>Assiduité aux séances</h2>${donutHtml(Object.entries(SESSION_STATUS).map(([k, [, l]], i) => ({ label: l, color: ["var(--vert)", "var(--jaune)", "var(--rouge)"][i], value: m.attendance[k] })))}</div></div>`,
    partners: () => `<div class="card">${stackRowsHtml(m.byPartner.map((b) => ({ group: pName(b.partnerId), total: b.total, zones: b.byStatus })), S.map((s) => col[s]), S.map((s) => PEC_STATUS[s][1]), false, { keys: S })}
      <div class="table-wrap" style="margin-top:1rem"><table class="table"><thead><tr><th>Partenaire</th>${S.map((s) => `<th class="num-cell">${PEC_STATUS[s][1]}</th>`).join("")}<th class="num-cell">Total</th><th class="num-cell">Consult.</th></tr></thead><tbody>
      ${m.byPartner.map((b) => `<tr><td>${esc(pName(b.partnerId))}</td>${S.map((s) => `<td class="num-cell">${statusesFor(partnerOf(b.partnerId).pec.mode).includes(s) ? b.byStatus[s] : "—"}</td>`).join("")}<td class="num-cell"><strong>${b.total}</strong></td><td class="num-cell">${b.consultations}</td></tr>`).join("")}</tbody></table></div></div>`,
    practitioners: () => `<div class="card table-wrap"><table class="table"><thead><tr><th>Praticien</th><th>Agenda</th><th class="num-cell">En cours</th><th class="num-cell">Séances réalisées</th></tr></thead><tbody>${db.practitioners.map((x) => `<tr><td>${esc(x.name)}</td><td>${hasAgenda(x) ? '<span class="pill vert">En place</span>' : '<span class="pill orange">Aucun jour</span>'}</td><td class="num-cell">${practitionerLoad(x.id)}</td><td class="num-cell">${db.patients.flatMap((y) => y.sessions).filter((s) => s.practitionerId === x.id && s.status === "PRESENT").length}</td></tr>`).join("")}</tbody></table></div>`,
  };
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Tableau de bord</span><h1>Prise en charge</h1></div></div>${subTabsHtml("co-dash", tabs, sub)}${views[sub]()}`;
  bindSubTabs(el, () => consoleDash(el, pids));
}
function consolePractitioners(el) {
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Praticiens</span><h1>Réseau de praticiens</h1></div><button type="button" class="btn btn-orange" id="pr-new">＋ Nouveau praticien</button></div>
    <div class="card table-wrap"><table class="table"><thead><tr><th>Nom</th><th>E-mail</th><th>Exercice</th><th>Agenda</th><th class="num-cell">En cours</th><th>Compte</th></tr></thead><tbody>
    ${db.practitioners.map((x) => `<tr><td><strong>${esc(x.name)}</strong></td><td class="small">${esc(x.email)}</td><td class="small">${x.kind === "externe" ? "Externe (sur place)" : "Interne (en ligne)"}</td><td>${hasAgenda(x) ? '<span class="pill vert">En place</span>' : '<span class="pill orange">Aucun jour de travail</span>'}</td><td class="num-cell">${practitionerLoad(x.id)}</td><td>${pill(ID_STATUS[identityStatus(identityOf(x.identityId))])}</td></tr>`).join("")}
    </tbody></table></div>`;
  $("#pr-new", el).addEventListener("click", () => modal("Nouveau praticien", `<form id="np" novalidate>
      <div class="field"><label for="np-n">Nom et prénom</label><input id="np-n" autocomplete="off"><div class="err" id="np-en"></div></div>
      <div class="field"><label for="np-e">E-mail</label><input id="np-e" type="email" autocomplete="off"><div class="err" id="np-ee"></div></div>
      <button class="btn btn-orange btn-block" type="submit">Créer le praticien</button></form>`, (body, close) => {
    $("#np", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const r = createPractitioner({ name: $("#np-n", body).value, email: $("#np-e", body).value });
      if (!r.ok) { $("#np-en", body).textContent = r.errors.name || ""; $("#np-ee", body).textContent = r.errors.email || ""; return; }
      close(); toast(`Praticien créé : lien d'activation envoyé à ${esc(r.practitioner.email)}.`); consolePractitioners(el);
    });
  }));
}

/* =====================================================================
 * Espace praticien (v2) : séances du jour, patients, agenda, scan du QR (externe)
 * ===================================================================== */
const pra = { me: null, scanned: {} };
RENDER.praticien = (root) => {
  const i = session.identityId ? identityOf(session.identityId) : null;
  const mine = i && i.kind === "PRACTITIONER" ? db.practitioners.find((x) => x.identityId === i.id) : null;
  if (mine) pra.me = mine.id;
  if (!practitionerOf(pra.me)) pra.me = db.practitioners[0].id;
  const me = practitionerOf(pra.me);
  const tab = tabOf("praticien", "today");
  const pick = mine ? "" : `<select id="pr-me" class="input" style="width:auto" aria-label="Praticien affiché">${db.practitioners.map((x) => `<option value="${x.id}" ${x.id === me.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`;
  root.innerHTML = `${appBar(yodanLogo("Praticien"), me.kind === "externe" ? "Praticien externe" : "Praticien", me.name, pick)}
    ${tabsHtml("praticien", [{ id: "today", icon: "📅", label: "Aujourd'hui", count: sessionsToday(me.id).filter(({ s }) => !s.status).length, hot: true }, { id: "patients", icon: "👥", label: "Mes patients" }, { id: "settings", icon: "⚙️", label: "Agenda et réglages" }], tab)}<div class="page" id="body"></div>`;
  bindAppBar(root); bindTabs(root);
  $("#pr-me", root)?.addEventListener("change", (e) => { pra.me = e.target.value; render(); });
  const body = $("#body", root);
  if (!hasAgenda(me) && tab !== "settings") { body.innerHTML = `<div class="card"><h2>Agenda obligatoire avant tout patient</h2><p>Cochez au moins un jour de travail pour recevoir vos premiers patients.</p><button type="button" class="btn btn-orange" id="go-set">Indiquer mes jours de travail</button></div>`; $("#go-set", body).addEventListener("click", () => setTab("praticien", "settings")); return; }
  if (tab === "today") {
    const list = sessionsToday(me.id);
    body.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">${fmtLong(todayIso())}</span><h1>Séances du jour</h1></div></div>
      ${list.length ? list.map(({ pt, s, i: k }) => { const att = pt.attestation; const needScan = att?.kind === "IN_PERSON" && !s.status && !pra.scanned[`${pt.id}-${k}`]; return `<div class="card session"><div class="row-between"><div><strong>${esc(displayName(personOf(pt.personId)))}</strong><div class="small muted">${esc(pName(pt.partnerId))} · séance ${pt.sessions.slice(0, k + 1).filter((x) => x.status === "PRESENT" || x === s).length} / ${capacityOf(pt)} · ${att?.kind === "IN_PERSON" ? `présentiel · ${esc(att.agency)}` : "en ligne"}</div></div>${s.status ? pill(SESSION_STATUS[s.status]) : ""}</div>
        ${s.status ? "" : needScan ? `<button type="button" class="btn btn-primary" data-scan="${pt.id}-${k}">📷 Scanner le QR de l'attestation</button>` : `<div class="actions">${Object.entries(SESSION_STATUS).map(([st, [, l]]) => `<button type="button" class="btn btn-sm ${st === "PRESENT" ? "btn-success" : ""}" data-mark="${pt.id}|${k}|${st}">${l}</button>`).join("")}</div>`}</div>`; }).join("") : `<div class="card empty">Aucune séance prévue aujourd'hui.</div>`}`;
    $$("[data-scan]", body).forEach((b) => b.addEventListener("click", () => { const [ptId] = b.dataset.scan.split("-"); const pt = patientOf(ptId); if (!pt.attestation || pt.attestation.until < todayIso()) return toast("Attestation expirée : contactez Yodan."); pra.scanned[b.dataset.scan] = true; audit("Scan attestation", pt.dossier); toast("Attestation valide."); render(); }));
    $$("[data-mark]", body).forEach((b) => b.addEventListener("click", () => { const [ptId, k, st] = b.dataset.mark.split("|"); if (!markSession(ptId, +k, st)) return toast("Séance impossible : plafond de consultations atteint."); toast(`Séance notée : ${SESSION_STATUS[st][1]}.`); render(); }));
  } else if (tab === "patients") {
    const rows = db.patients.filter((x) => x.practitionerId === me.id).sort((a, b) => patientStatus(a).localeCompare(patientStatus(b)));
    body.innerHTML = `<div class="card table-wrap"><table class="table"><thead><tr><th>Patient</th><th>Partenaire</th><th>Séances</th><th>Statut</th><th>Attestation</th><th></th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td><strong>${esc(displayName(personOf(x.personId)))}</strong><div class="small muted">${esc(x.dossier)}</div></td><td class="small">${esc(pName(x.partnerId))}</td><td>${consumedOf(x)} / ${capacityOf(x)}</td><td>${statusPill(x)}</td><td class="small">${x.attestation ? `jusqu'au ${fmtDate(x.attestation.until)}` : "—"}</td><td>${patientStatus(x) === "EN_COURS" && !x.sessions.some((s) => !s.status && s.date >= todayIso()) ? `<button type="button" class="btn btn-sm" data-plan="${x.id}">＋ Séance aujourd'hui</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Aucun patient.</td></tr>`}</tbody></table></div>`;
    $$("[data-plan]", body).forEach((b) => b.addEventListener("click", () => { const pt = patientOf(b.dataset.plan); pt.sessions.push({ date: todayIso(), status: null, practitionerId: me.id, report: false }); toast("Séance ajoutée à l'agenda du jour."); setTab("praticien", "today"); }));
  } else {
    const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    body.innerHTML = `<div class="card"><h2>Mes jours de travail</h2><div class="chips-check">${days.map((d, k) => `<label><input type="checkbox" data-wd="${k}" ${me.weekdays[k] ? "checked" : ""}> ${d}</label>`).join("")}</div>
      <p style="margin-top:1rem">${hasAgenda(me) ? `<span class="pill vert">Agenda en place</span> <span class="small muted">${me.weekdays.filter(Boolean).length} jour(s) : vous pouvez recevoir des patients.</span>` : `<span class="pill orange">Agenda pas encore en place</span> <span class="small muted">Cochez au moins un jour.</span>`}</p>
      <dl class="kv" style="margin-top:1rem"><dt>Exercice</dt><dd>${me.kind === "externe" ? "Externe : séances sur place, scan du QR de l'attestation à chaque séance" : "Interne : consultations en ligne LAMIFI"}</dd><dt>Compte</dt><dd>${esc(me.email)}</dd></dl></div>`;
    // Agenda en place = au moins un jour coché (calculé, aucune bascule manuelle).
    $$("[data-wd]", body).forEach((x) => x.addEventListener("change", () => {
      const before = hasAgenda(me);
      me.weekdays[+x.dataset.wd] = x.checked;
      audit("Agenda praticien", `${me.name} : ${me.weekdays.filter(Boolean).length} jour(s)`);
      if (before !== hasAgenda(me)) toast(hasAgenda(me) ? "Agenda en place : vous pouvez recevoir des patients." : "Plus aucun jour coché : vous ne recevrez plus de nouveaux patients.");
      render();
    }));
  }
};
