/*
 * mod-admin.js : « Comptes » de l'Administrateur (ex-super admin), « Campagnes », et réglages d'un partenaire
 * par l'Admin LAMIFI Business (ex-admin système). Repris de LAMIFI v2 et de BSPA.
 */
"use strict";

/* =====================================================================
 * Comptes (Administrateur) : identifiants et rôles · agences et options · dossiers · historique et exports
 * ===================================================================== */
function viewAdminFeature(el, scope, key) {
  const tabs = [{ id: "accounts", label: "Identifiants et rôles" }, { id: "agencies", label: "Agences" }, { id: "files", label: "Recherche de dossier" }, { id: "history", label: "Historique et exports" }];
  const sub = subOf(`adm-${key}`, tabs);
  el.innerHTML = `${subTabsHtml(`adm-${key}`, tabs, sub)}<div id="adm-body"></div>`;
  bindSubTabs(el, () => viewAdminFeature(el, scope, key));
  const body = $("#adm-body", el), p = partnerOf(scope.partnerIds[0]);
  if (sub === "accounts") return viewAccounts(body, scope, key);
  if (sub === "agencies") return agenciesView(body, p);
  if (sub === "files") return dossierSearch(body, p);
  partnerHistoryView(body, p);
}
function agenciesView(el, p) {
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Agences</span><h1>${p.agencies.length} agence(s)</h1></div><button type="button" class="btn btn-orange" id="ag-new">＋ Nouvelle agence</button></div>
    <div class="card table-wrap"><table class="table"><thead><tr><th>Agence</th><th class="num-cell">Comptes</th><th class="num-cell">Bilans</th></tr></thead><tbody>
    ${p.agencies.map((a) => `<tr><td><strong>${esc(a)}</strong></td><td class="num-cell">${db.assignments.filter((x) => x.partnerId === p.id && x.active && x.agencies.includes(a)).length}</td><td class="num-cell">${db.evaluations.filter((e) => e.partnerId === p.id && e.agency === a).length}</td></tr>`).join("")}</tbody></table></div>`;
  $("#ag-new", el).addEventListener("click", () => modal("Nouvelle agence", `<form id="na"><div class="field"><label for="na-n">Nom de l'agence</label><input id="na-n" autocomplete="off"><div class="err" id="na-e"></div></div><button class="btn btn-orange btn-block" type="submit">Créer</button></form>`, (body, close) => {
    $("#na", body).addEventListener("submit", (e) => { e.preventDefault(); const n = $("#na-n", body).value.trim(); if (!n || p.agencies.includes(n)) { $("#na-e", body).textContent = n ? "Cette agence existe déjà." : "Indiquez un nom."; return; } p.agencies.push(n); p.agencyOpts.push(agencyDefaults(n, p.type)); audit("Création agence", `${p.name} · ${n}`); close(); agenciesView(el, p); });
  }));
}
/** Fiche d'un dossier trouvé par N° : lecture seule, sans nom ni réponse ni score. */
function dossierSearch(el, p, q = "") {
  const needle = normId(q);
  const evs = needle ? db.evaluations.filter((e) => e.partnerId === p.id && (normId(e.dossier) === needle || normId(personOf(e.personId).id1) === needle)) : [];
  el.innerHTML = `<div class="narrow-page"><form class="card" id="ds"><h2>Recherche de dossier</h2><div class="row"><div class="field"><label for="ds-q">N° de dossier ou ${esc(p.idLabels[0])}</label><input id="ds-q" value="${esc(q)}" autocomplete="off"></div></div><button class="btn btn-primary" type="submit">Rechercher</button></form>
    ${needle ? evs.length ? evs.map((e) => { const pt = db.patients.find((x) => x.evalId === e.id); return `<div class="card"><h3>Dossier ${esc(e.dossier)}</h3><dl class="kv"><dt>Date</dt><dd>${fmtDate(e.date)}</dd><dt>Agence</dt><dd>${esc(e.agency)}</dd><dt>Mode</dt><dd>${esc(MODE_LABEL[e.mode])}</dd><dt>Décision</dt><dd>${OUTCOME_LABEL[outcomeOf(e)]}</dd><dt>Prise en charge</dt><dd>${pt ? PEC_STATUS[patientStatus(pt)][1] : "—"}</dd></dl><p class="small muted">Lecture seule : ni identité, ni réponses, ni score.</p></div>`; }).join("") : `<div class="card"><p class="empty">Aucun dossier.</p></div>` : ""}</div>`;
  $("#ds", el).addEventListener("submit", (e) => { e.preventDefault(); const v = $("#ds-q", el).value; audit("Recherche de dossier", p.name); dossierSearch(el, p, v); });
}
function partnerHistoryView(el, p) {
  el.innerHTML = `<div><div class="card"><h2>Exports</h2><p class="small muted">CSV et XLSX : chiffres agrégés, téléchargement direct. SQL : base ${p.sqlAnon ? "anonymisée" : "complète (identité incluse)"}, code par e-mail requis.</p>
      <div class="actions"><button type="button" class="btn" data-xp="CSV">📄 CSV</button><button type="button" class="btn" data-xp="XLSX">📄 XLSX</button><button type="button" class="btn btn-primary" data-xp="SQL">🔒 SQL</button></div></div>
    </div><div id="p-hist"></div>`;
  // Historique du partenaire : uniquement son tenant et les actions de son côté (comme la CNPS).
  historyView($("#p-hist", el), { partnerId: p.id, key: `p-${p.id}` });
  $$("[data-xp]", el).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.xp !== "SQL") return exportToast(`${p.name} (${b.dataset.xp})`);
    const to = session.identityId ? identityOf(session.identityId) : db.identities.find((i) => i.partnerId === p.id);
    const ch = startOtp(to.id, "EXPORT");
    modal("Export SQL", `<p>Un code a été envoyé à <strong>${esc(to.email)}</strong> pour autoriser l'export de la base ${p.sqlAnon ? "anonymisée" : "complète (identité incluse)"}.</p><form id="xs"><div class="field"><label for="xs-c">Code à 6 chiffres</label><input id="xs-c" inputmode="numeric" maxlength="6"><div class="err" id="xs-e"></div></div><button class="btn btn-orange btn-block" type="submit">Valider</button></form>`, (body, close) => {
      $("#xs", body).addEventListener("submit", (e) => { e.preventDefault(); const r = verifyOtp(ch.id, $("#xs-c", body).value); if (r !== "OK") { $("#xs-e", body).textContent = r === "EXPIRE" ? "Code expiré." : "Code incorrect."; return; } audit("Export SQL", `${p.name} (${p.sqlAnon ? "anonymisé" : "complet"})`); close(); toast(p.sqlAnon ? "Export SQL anonymisé téléchargé : identité retirée, code aléatoire par personne, dates au mois, groupes < 5 regroupés." : "Export SQL complet téléchargé (tracé dans l'historique)."); partnerHistoryView(el, p); });
    });
  }));
}

/* =====================================================================
 * Campagnes (BSPA) : le partenaire crée et envoie ; seul l'admin Yodan consulte les participants
 * ===================================================================== */
function viewCampaigns(el, scope) {
  const pids = scope.partnerIds.filter((id) => partnerOf(id).campaign.on);
  if (!pids.length) { el.innerHTML = `<div class="banner banner-info">Aucun partenaire de cette sélection n'a activé la campagne.</div>`; return; }
  const yodan = scope.actor === "yodan";
  const camps = db.campaigns.filter((c) => pids.includes(c.partnerId)).sort((a, b) => b.start.localeCompare(a.start));
  const stats = (c) => { const ps = db.participants.filter((x) => x.campaignId === c.id); return { inv: ps.length, done: ps.filter((x) => x.completedAt).length, started: ps.filter((x) => x.startedAt && !x.completedAt).length }; };
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Campagnes</span><h1>${yodan ? "Campagnes et participants" : "Campagnes"}</h1></div><button type="button" class="btn btn-orange" id="c-new">＋ Nouvelle campagne</button></div>
    <div class="card table-wrap"><table class="table"><thead><tr><th>Campagne</th>${pids.length > 1 ? "<th>Partenaire</th>" : ""}<th>Test</th><th>Période</th><th>État</th>${yodan ? `<th class="num-cell">Invités</th><th class="num-cell">Non terminés</th><th class="num-cell">Terminés</th>` : ""}</tr></thead><tbody>
    ${camps.map((c) => { const s = stats(c); return `<tr class="click" data-c="${c.id}" tabindex="0"><td><strong>${esc(c.name)}</strong></td>${pids.length > 1 ? `<td class="small">${esc(pName(c.partnerId))}</td>` : ""}<td>${c.test}</td><td class="small">${fmtDate(c.start)} → ${fmtDate(c.end)}</td><td>${pill(CAMP_STATE[campaignState(c)])}</td>${yodan ? `<td class="num-cell">${s.inv}</td><td class="num-cell">${s.started}</td><td class="num-cell">${s.done} <span class="muted small">(${s.inv ? Math.round((s.done / s.inv) * 100) : 0} %)</span></td>` : ""}</tr>`; }).join("") || `<tr><td colspan="8" class="empty">Aucune campagne.</td></tr>`}
    </tbody></table></div>`;
  const open = (id) => campaignModal(id, scope, () => viewCampaigns(el, scope));
  $$("[data-c]", el).forEach((r) => { r.addEventListener("click", () => open(r.dataset.c)); r.addEventListener("keydown", (e) => { if (e.key === "Enter") open(r.dataset.c); }); });
  $("#c-new", el).addEventListener("click", () => modal("Nouvelle campagne", `<form id="nc" novalidate>
      ${pids.length > 1 ? `<div class="field"><label for="nc-p">Partenaire</label><select id="nc-p">${pids.map((id) => `<option value="${id}">${esc(pName(id))}</option>`).join("")}</select></div>` : ""}
      <div class="field"><label for="nc-n">Nom</label><input id="nc-n" placeholder="Ex. : Bilan du 1er semestre"><div class="err" id="nc-en"></div></div>
      <div class="field"><label for="nc-t">Test</label><select id="nc-t"></select></div>
      <div class="row"><div class="field"><label for="nc-s">Début</label><input id="nc-s" type="date" value="${todayIso()}"></div><div class="field"><label for="nc-e">Fin</label><input id="nc-e" type="date" value="${addDays(todayIso(), 21)}"></div></div><div class="err" id="nc-ed"></div>
      <button class="btn btn-orange btn-block" type="submit">Créer puis envoyer le lien</button></form>`, (body, close) => {
    const pSel = () => $("#nc-p", body)?.value || pids[0];
    const fill = () => { $("#nc-t", body).innerHTML = partnerOf(pSel()).tests.map((t) => `<option>${t}</option>`).join(""); };
    fill(); $("#nc-p", body)?.addEventListener("change", fill);
    $("#nc", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const r = createCampaign({ partnerId: pSel(), name: $("#nc-n", body).value, test: $("#nc-t", body).value, start: $("#nc-s", body).value, end: $("#nc-e", body).value });
      if (!r.ok) { $("#nc-en", body).textContent = r.errors.name || ""; $("#nc-ed", body).textContent = r.errors.dates || r.errors.test || ""; return; }
      close(); viewCampaigns(el, scope); open(r.campaign.id);
    });
  }));
}
function campaignModal(id, scope, refresh) {
  const c = campaignOf(id), p = partnerOf(c.partnerId), yodan = scope.actor === "yodan";
  const f = { q: "", st: "all" };
  const draw = (body, res = null) => {
    const ps = db.participants.filter((x) => x.campaignId === id && (f.st === "all" || participantStatus(x) === f.st) && (!f.q || norm(x.email).includes(norm(f.q))));
    body.innerHTML = `<dl class="kv"><dt>Partenaire</dt><dd>${esc(p.name)}</dd><dt>Test</dt><dd>${c.test}</dd><dt>Période</dt><dd>${fmtDate(c.start)} → ${fmtDate(c.end)} ${pill(CAMP_STATE[campaignState(c)])}</dd><dt>Lien</dt><dd><code>${esc(`${APP_URL}/c/${c.code}`)}</code></dd>${p.campaign.emailPro ? `<dt>Domaines</dt><dd>${esc(p.campaign.domains.join(", "))}</dd>` : ""}</dl>
      ${campaignState(c) === "TERMINEE" ? "" : `<form id="inv" style="margin-top:1rem"><div class="field"><label for="inv-t">Envoyer le lien à des participants</label><textarea id="inv-t" rows="3" placeholder="prenom.nom@${esc(p.campaign.domains[0] || "exemple.test")}"></textarea><div class="hint">Adresses séparées par des espaces, virgules ou retours à la ligne.</div></div>
        <div class="field"><label for="inv-f">ou importer un fichier CSV</label><input id="inv-f" type="file" accept=".csv,text/csv"><div class="hint">Seule la colonne e-mail est lue ; les autres colonnes sont ignorées.</div></div>
        ${res ? `${res.added.length ? `<div class="banner banner-ok">${res.added.length} invitation(s) envoyée(s).</div>` : ""}${res.refused.length ? `<div class="banner banner-warn">Refusé : ${res.refused.map(([m, w]) => `${esc(m)} (${w})`).join(", ")}</div>` : ""}` : ""}
        <button class="btn btn-primary btn-sm" type="submit">Envoyer le lien</button></form>`}
      ${yodan ? `<h3 style="margin-top:1rem">Participants</h3><div class="toolbar"><input type="search" class="grow" id="pp-q" placeholder="Rechercher un e-mail" value="${esc(f.q)}" aria-label="Rechercher un participant"><select id="pp-s" aria-label="État"><option value="all">Tous</option>${Object.entries(PART_STATUS).map(([k, [, l]]) => `<option value="${k}" ${f.st === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="table-wrap" style="max-height:300px;overflow:auto"><table class="table"><thead><tr><th>E-mail</th><th>Invité le</th><th>État</th><th>Profil</th></tr></thead><tbody>
      ${ps.map((x) => { const ev = x.evalId && evaluationOf(x.evalId); return `<tr><td>${esc(x.email)}</td><td class="small">${fmtDate(x.invitedAt)}</td><td>${pill(PART_STATUS[participantStatus(x)])}</td><td>${ev ? `<button type="button" class="link-btn" data-rep="${ev.id}">${esc(zoneTitle(ev.test, ev))}</button>` : "—"}</td></tr>`; }).join("") || `<tr><td colspan="4" class="empty">Aucun participant.</td></tr>`}</tbody></table></div>` : ""}`;
    $("#inv", body)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = $("#inv-f", body).files[0];
      const csv = file ? await file.text() : "";
      const r = inviteToCampaign(id, $("#inv-t", body).value, csv);
      draw(body, r); refresh();
    });
    if (yodan) {
      bindSearch($("#pp-q", body), (v) => { f.q = v; draw(body); });
      $("#pp-s", body).addEventListener("change", (e) => { f.st = e.target.value; draw(body); });
      $$("[data-rep]", body).forEach((b) => b.addEventListener("click", () => reportModal(b.dataset.rep)));
    }
  };
  modal(c.name, "", (body) => draw(body), true);
}
