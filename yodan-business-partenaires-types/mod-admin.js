/*
 * mod-admin.js : « Comptes » de l'Administrateur (ex-super admin), « Campagnes », et réglages d'un partenaire
 * par l'Admin LAMIFI Business (ex-admin système). Repris de LAMIFI v2 et de BSPA.
 */
"use strict";

/* =====================================================================
 * Comptes (Administrateur) : identifiants et rôles · agences et options · dossiers · historique et exports
 * ===================================================================== */
function viewAdminFeature(el, scope, key) {
  const tabs = [{ id: "accounts", label: "Identifiants et rôles" }, { id: "agencies", label: "Agences et options" }, { id: "files", label: "Recherche de dossier" }, { id: "history", label: "Historique et exports" }];
  const sub = subOf(`adm-${key}`, tabs);
  el.innerHTML = `${subTabsHtml(`adm-${key}`, tabs, sub)}<div id="adm-body"></div>`;
  bindSubTabs(el, () => viewAdminFeature(el, scope, key));
  const body = $("#adm-body", el), p = partnerOf(scope.partnerIds[0]);
  if (sub === "accounts") return viewAccounts(body, scope, key);
  if (sub === "agencies") return agenciesView(body, p);
  if (sub === "files") return dossierSearch(body, p);
  historyView(body, p);
}
function agenciesView(el, p) {
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Agences et options</span><h1>${p.agencies.length} agence(s)</h1></div><button type="button" class="btn btn-orange" id="ag-new">＋ Nouvelle agence</button></div>
    <div class="card table-wrap"><table class="table"><thead><tr><th>Agence</th><th>Délai de recours (jours)</th><th>Zones décidées par un validateur</th><th>QR ouvert autorisé</th><th class="num-cell">Évaluations</th></tr></thead><tbody>
    ${p.agencyOpts.map((o, i) => `<tr><td><strong>${esc(o.name)}</strong></td><td><input type="number" min="0" max="30" value="${o.appealDays}" data-appeal="${i}" class="input" style="max-width:90px" aria-label="Délai de recours ${esc(o.name)}"></td>
      <td><div class="chips-check">${["ORANGE", "ROUGE"].map((z) => `<label><input type="checkbox" data-vz="${i}|${z}" ${o.validateZones.includes(z) ? "checked" : ""}> ${ZONE_LABEL[z]}</label>`).join("")}</div></td>
      <td><label class="switch"><input type="checkbox" data-qr="${i}" ${o.qrAllowed ? "checked" : ""} aria-label="QR ouvert ${esc(o.name)}"><span class="track"></span></label></td><td class="num-cell">${db.evaluations.filter((e) => e.partnerId === p.id && e.agency === o.name).length}</td></tr>`).join("")}</tbody></table>
    <p class="small muted">Vert : toujours sans suite. Une zone non cochée est décidée automatiquement (prise en charge). Le délai de recours s'applique après une décision du validateur.</p></div>`;
  const saved = (what) => { audit("Option d'agence", `${p.name} · ${what}`); toast("Réglage enregistré."); };
  $$("[data-appeal]", el).forEach((x) => x.addEventListener("change", () => { const o = p.agencyOpts[+x.dataset.appeal]; o.appealDays = Math.max(0, Math.min(30, Math.round(+x.value || 0))); saved(`${o.name} : délai ${o.appealDays} j`); }));
  $$("[data-vz]", el).forEach((x) => x.addEventListener("change", () => { const [i, z] = x.dataset.vz.split("|"); const o = p.agencyOpts[+i]; o.validateZones = x.checked ? [...new Set([...o.validateZones, z])] : o.validateZones.filter((y) => y !== z); saved(`${o.name} : zones validées ${o.validateZones.join(", ") || "aucune"}`); }));
  $$("[data-qr]", el).forEach((x) => x.addEventListener("change", () => { const o = p.agencyOpts[+x.dataset.qr]; o.qrAllowed = x.checked; saved(`${o.name} : QR ouvert ${o.qrAllowed ? "autorisé" : "retiré"}`); }));
  $("#ag-new", el).addEventListener("click", () => modal("Nouvelle agence", `<form id="na"><div class="field"><label for="na-n">Nom de l'agence</label><input id="na-n" autocomplete="off"><div class="err" id="na-e"></div></div><button class="btn btn-orange btn-block" type="submit">Créer</button></form>`, (body, close) => {
    $("#na", body).addEventListener("submit", (e) => { e.preventDefault(); const n = $("#na-n", body).value.trim(); if (!n || p.agencies.includes(n)) { $("#na-e", body).textContent = n ? "Cette agence existe déjà." : "Indiquez un nom."; return; } p.agencies.push(n); p.agencyOpts.push(agencyDefaults(n, AGENCY_PRESET[p.type])); audit("Création agence", `${p.name} · ${n}`); close(); agenciesView(el, p); });
  }));
}
/** Fiche d'un dossier trouvé par N° : lecture seule, sans nom ni réponse ni score. */
function dossierSearch(el, p, q = "") {
  const needle = normId(q);
  const evs = needle ? db.evaluations.filter((e) => e.partnerId === p.id && (normId(e.dossier) === needle || normId(personOf(e.personId).id1) === needle)) : [];
  el.innerHTML = `<div class="narrow-page"><form class="card" id="ds"><h2>Recherche de dossier</h2><div class="row"><div class="field"><label for="ds-q">N° de dossier ou ${esc(p.idLabels[0])}</label><input id="ds-q" value="${esc(q)}" autocomplete="off"></div></div><button class="btn btn-primary" type="submit">Rechercher</button></form>
    ${needle ? evs.length ? evs.map((e) => { const pt = db.patients.find((x) => x.evalId === e.id); return `<div class="card"><h3>Dossier ${esc(e.dossier)}</h3><dl class="kv"><dt>Date</dt><dd>${fmtDate(e.date)}</dd><dt>Agence</dt><dd>${esc(e.agency)}</dd><dt>Type</dt><dd>${e.kind} · ${esc(MODE_LABEL[e.mode])}</dd><dt>Décision</dt><dd>${OUTCOME_LABEL[outcomeOf(e)]}</dd><dt>Prise en charge</dt><dd>${pt ? `${PEC_STATUS[patientStatus(pt)][1]} · ${esc(waitingReason(pt))}` : "—"}</dd></dl><p class="small muted">Lecture seule : ni identité, ni réponses, ni score.</p></div>`; }).join("") : `<div class="card"><p class="empty">Aucun dossier.</p></div>` : ""}</div>`;
  $("#ds", el).addEventListener("submit", (e) => { e.preventDefault(); const v = $("#ds-q", el).value; audit("Recherche de dossier", p.name); dossierSearch(el, p, v); });
}
function historyView(el, p) {
  const rows = [...db.audit].reverse().slice(0, 60);
  el.innerHTML = `<div class="grid-2"><div class="card"><h2>Exports</h2><p class="small muted">CSV et XLSX : chiffres agrégés, téléchargement direct. SQL : base ${p.sqlAnon ? "anonymisée" : "complète (identité incluse)"}, code par e-mail requis.</p>
      <div class="actions"><button type="button" class="btn" data-xp="CSV">📄 CSV</button><button type="button" class="btn" data-xp="XLSX">📄 XLSX</button><button type="button" class="btn btn-primary" data-xp="SQL">🔒 SQL</button></div></div>
    <div class="card"><h2>Historique</h2><div class="table-wrap" style="max-height:360px;overflow:auto"><table class="table"><thead><tr><th>Quand</th><th>Qui</th><th>Action</th></tr></thead><tbody>${rows.map((a) => `<tr><td class="small">${fmtDateTime(a.at)}</td><td class="small">${esc(a.who)}</td><td class="small">${esc(a.action)}${a.target ? ` · ${esc(a.target)}` : ""}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Aucune action depuis l'ouverture de la démo.</td></tr>`}</tbody></table></div></div></div>`;
  $$("[data-xp]", el).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.xp !== "SQL") return exportToast(`${p.name} (${b.dataset.xp})`);
    const to = session.identityId ? identityOf(session.identityId) : db.identities.find((i) => i.partnerId === p.id);
    const ch = startOtp(to.id, "EXPORT");
    modal("Export SQL", `<p>Un code a été envoyé à <strong>${esc(to.email)}</strong> pour autoriser l'export de la base ${p.sqlAnon ? "anonymisée" : "complète (identité incluse)"}.</p><form id="xs"><div class="field"><label for="xs-c">Code à 6 chiffres</label><input id="xs-c" inputmode="numeric" maxlength="6"><div class="err" id="xs-e"></div></div><button class="btn btn-orange btn-block" type="submit">Valider</button></form>`, (body, close) => {
      $("#xs", body).addEventListener("submit", (e) => { e.preventDefault(); const r = verifyOtp(ch.id, $("#xs-c", body).value); if (r !== "OK") { $("#xs-e", body).textContent = r === "EXPIRE" ? "Code expiré." : "Code incorrect."; return; } audit("Export SQL", `${p.name} (${p.sqlAnon ? "anonymisé" : "complet"})`); close(); toast(p.sqlAnon ? "Export SQL anonymisé téléchargé : identité retirée, code aléatoire par personne, dates au mois, groupes < 5 regroupés." : "Export SQL complet téléchargé (tracé dans l'historique)."); historyView(el, p); });
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

/* =====================================================================
 * Admin LAMIFI Business : réglages d'un partenaire (identifiants, questionnaire général, bilan, données)
 * ===================================================================== */
const FIELD_TYPES = { text: "Texte court", number: "Nombre", date: "Date", select: "Liste de choix", tel: "Téléphone", email: "E-mail" };
function partnerSettings(el, p) {
  const tabs = [{ id: "ids", label: "Identifiants" }, { id: "fields", label: "Questionnaire général" }, { id: "bilan", label: "Consentements et liens" }, { id: "data", label: "Données et exports" }];
  const sub = subOf(`set-${p.id}`, tabs);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Réglages</span><h1>${esc(p.name)}</h1></div><button type="button" class="btn btn-ghost" id="set-back">← Partenaires</button></div>${subTabsHtml(`set-${p.id}`, tabs, sub)}<div class="card" id="set-body"></div>`;
  bindSubTabs(el, () => partnerSettings(el, p));
  $("#set-back", el).addEventListener("click", () => { ui.lamifiPartner = null; render(); });
  const body = $("#set-body", el), again = () => partnerSettings(el, p);
  const saved = (what) => { audit("Réglage partenaire", `${p.name} · ${what}`); toast("Réglage enregistré."); again(); };
  if (sub === "ids") {
    body.innerHTML = `<h2>Saisie des identifiants</h2><div class="field">${segHtml("idn", [["1", "1 identifiant"], ["2", "2 identifiants"]], p.idLabels.length)}</div>
      ${p.idLabels.map((l, i) => `<div class="field"><label for="idl-${i}">Libellé de l'identifiant ${i + 1}</label><input id="idl-${i}" value="${esc(l)}"></div>`).join("")}<button type="button" class="btn btn-primary" id="idl-save">Enregistrer</button>`;
    bindSeg(body, (k, v) => { p.idLabels = v === "2" ? [p.idLabels[0], p.idLabels[1] || "N° de dossier"] : [p.idLabels[0]]; saved(`${v} identifiant(s)`); });
    $("#idl-save", body).addEventListener("click", () => { p.idLabels = p.idLabels.map((_, i) => $(`#idl-${i}`, body).value.trim() || p.idLabels[i]); saved("libellés des identifiants"); });
  } else if (sub === "fields") {
    body.innerHTML = `<div class="row-between"><h2 style="margin:0">Questionnaire général</h2><button type="button" class="btn btn-orange btn-sm" id="fw-add">＋ Ajouter un champ</button></div><p class="small muted">Champs demandés avant le test. 🔒 = donnée d'identité, rangée dans le coffre identité et jamais dans les statistiques.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Libellé</th><th>Type</th><th>Niveau</th><th>Obligatoire</th><th></th></tr></thead><tbody>${p.fields.map((f, i) => `<tr><td><strong>${esc(f.label)}</strong> ${f.pii ? "🔒" : ""}<div class="small muted">${esc(f.key)}${f.options ? ` · ${f.options.length} choix` : ""}${f.showIf ? ` · si ${esc(f.showIf[0])} = ${esc(f.showIf[1])}` : ""}</div></td><td class="small">${FIELD_TYPES[f.type] || f.type}</td><td class="small">${f.level === "case" ? "📁 Dossier" : "👤 Personne"}</td>
        <td><label class="switch"><input type="checkbox" data-req="${i}" ${f.required ? "checked" : ""} aria-label="Obligatoire : ${esc(f.label)}"><span class="track"></span></label></td><td class="actions"><button type="button" class="btn btn-sm" data-up="${i}" ${i ? "" : "disabled"} aria-label="Monter">↑</button><button type="button" class="btn btn-sm btn-danger" data-del="${i}" aria-label="Retirer ${esc(f.label)}">Retirer</button></td></tr>`).join("")}</tbody></table></div>`;
    $$("[data-req]", body).forEach((x) => x.addEventListener("change", () => { p.fields[+x.dataset.req].required = x.checked; saved(`champ ${p.fields[+x.dataset.req].key}`); }));
    $$("[data-up]", body).forEach((x) => x.addEventListener("click", () => { const i = +x.dataset.up; [p.fields[i - 1], p.fields[i]] = [p.fields[i], p.fields[i - 1]]; saved("ordre des champs"); }));
    $$("[data-del]", body).forEach((x) => x.addEventListener("click", () => { if (!x.dataset.armed) { x.dataset.armed = "1"; x.textContent = "Confirmer"; return; } const f = p.fields.splice(+x.dataset.del, 1)[0]; saved(`retrait du champ ${f.key}`); }));
    $("#fw-add", body).addEventListener("click", () => fieldWizard(p, () => saved("nouveau champ")));
  } else if (sub === "bilan") {
    body.innerHTML = `<h2>Consentements</h2><p class="small muted">« Avant » : demandé avant le questionnaire. « Avec le résultat » : proposé selon la zone.</p>
      <div class="table-wrap"><table class="table"><tbody>${p.consents.map((c, i) => `<tr><td>${esc(c.label)}${c.required ? ' <span class="pill orange">obligatoire</span>' : ""}</td><td class="small">${c.moment === "pre" ? "Avant" : `Avec le résultat · ${(c.zones || ZONES).map((z) => ZONE_LABEL[z]).join(", ")}`}</td><td>${c.required ? "" : `<button type="button" class="btn btn-sm btn-danger" data-rc="${i}">Retirer</button>`}</td></tr>`).join("")}</tbody></table></div>
      <form id="nc2" class="row"><div class="field wide"><label for="nc2-l">Nouveau consentement</label><input id="nc2-l" placeholder="J'accepte…"></div><div class="field"><label for="nc2-m">Moment</label><select id="nc2-m"><option value="post">Avec le résultat (orange, rouge)</option><option value="pre">Avant le questionnaire</option></select></div><div class="field" style="align-self:end"><button class="btn btn-sm btn-primary" type="submit">Ajouter</button></div></form>
      <h2 style="margin-top:1rem">Liens selon la zone</h2><div class="table-wrap"><table class="table"><tbody>${p.links.map((l, i) => `<tr><td>${esc(l.label)}<div class="small muted">${esc(l.url)}</div></td><td class="small">${l.zones.map((z) => ZONE_LABEL[z]).join(", ")}</td><td><button type="button" class="btn btn-sm btn-danger" data-rl="${i}">Retirer</button></td></tr>`).join("") || `<tr><td class="empty">Aucun lien.</td></tr>`}</tbody></table></div>
      <form id="nl" class="row"><div class="field wide"><label for="nl-l">Libellé</label><input id="nl-l"></div><div class="field wide"><label for="nl-u">Adresse (https)</label><input id="nl-u" type="url" placeholder="https://"></div><div class="field"><span class="lbl">Zones</span><div class="chips-check">${ZONES.map((z) => `<label><input type="checkbox" data-lz="${z}" ${z !== "VERT" ? "checked" : ""}> ${ZONE_LABEL[z]}</label>`).join("")}</div></div><div class="field" style="align-self:end"><button class="btn btn-sm btn-primary" type="submit">Ajouter</button></div></form><div class="err" id="nl-e"></div>`;
    $$("[data-rc]", body).forEach((x) => x.addEventListener("click", () => { p.consents.splice(+x.dataset.rc, 1); saved("retrait d'un consentement"); }));
    $$("[data-rl]", body).forEach((x) => x.addEventListener("click", () => { p.links.splice(+x.dataset.rl, 1); saved("retrait d'un lien"); }));
    $("#nc2", body).addEventListener("submit", (e) => { e.preventDefault(); const l = $("#nc2-l", body).value.trim(); if (!l) return; const m = $("#nc2-m", body).value; p.consents.push({ id: `c${Date.now() % 100000}`, moment: m, label: l, ...(m === "post" ? { zones: ["ORANGE", "ROUGE"] } : { required: false }) }); saved("nouveau consentement"); });
    $("#nl", body).addEventListener("submit", (e) => { e.preventDefault(); const l = $("#nl-l", body).value.trim(), u = $("#nl-u", body).value.trim(), zs = $$("[data-lz]:checked", body).map((x) => x.dataset.lz); if (!l || !/^https:\/\//.test(u) || !zs.length) { $("#nl-e", body).textContent = "Libellé, adresse en https:// et au moins une zone."; return; } p.links.push({ label: l, url: u, zones: zs }); saved("nouveau lien"); });
  } else {
    body.innerHTML = `<h2>Données et exports</h2><label class="switch"><input type="checkbox" id="sql-anon" ${p.sqlAnon ? "checked" : ""}><span class="track"></span> Base anonymisée à l'export SQL</label>
      <p class="small muted" style="margin-top:.6rem">Anonymisée : identité retirée, code aléatoire par personne à chaque export, dates au mois, âges en tranches, textes libres et documents retirés, groupes de moins de 5 regroupés. Complète : identité incluse, réservée aux cas prévus au contrat.</p>
      <dl class="kv" style="margin-top:1rem"><dt>Base</dt><dd><code>${esc(p.db.host)}:${p.db.port}/${esc(p.db.database)}</code></dd><dt>Secret</dt><dd>🔒 ${esc(p.db.secretRef)}</dd></dl>`;
    $("#sql-anon", body).addEventListener("change", (e) => { p.sqlAnon = e.target.checked; saved(`export SQL ${p.sqlAnon ? "anonymisé" : "complet"}`); });
  }
}
/** Assistant d'ajout de champ (v2) : type → libellé et clé → choix / bornes → identité et niveau → aperçu. */
function fieldWizard(p, done) {
  const f = { type: "select", label: "", key: "", options: "", min: "", max: "", pii: false, required: true, level: "person" };
  let step = 0;
  const labels = ["Type", "Libellé", "Valeurs", "Identité", "Aperçu"];
  modal("Ajouter un champ", "", (body, close) => {
    const draw = (err = "") => {
      const pane = [
        `<div class="choice-cards">${Object.entries(FIELD_TYPES).map(([k, l]) => `<button type="button" class="choice-card ${f.type === k ? "on" : ""}" data-ft="${k}"><strong>${l}</strong></button>`).join("")}</div>`,
        `<div class="field"><label for="fw-l">Libellé affiché</label><input id="fw-l" value="${esc(f.label)}"></div><div class="field"><label for="fw-k">Clé technique</label><input id="fw-k" value="${esc(f.key)}" placeholder="ex. service"><div class="hint">Minuscules, chiffres et _ ; ne change plus ensuite.</div></div>`,
        f.type === "select" ? `<div class="field"><label for="fw-o">Choix (un par ligne)</label><textarea id="fw-o" rows="4">${esc(f.options)}</textarea></div>` : f.type === "number" ? `<div class="row"><div class="field"><label for="fw-min">Valeur minimale</label><input id="fw-min" type="number" value="${esc(f.min)}"></div><div class="field"><label for="fw-max">Valeur maximale</label><input id="fw-max" type="number" value="${esc(f.max)}"></div></div>` : `<p class="muted">Pas de valeur à définir pour ce type.</p>`,
        `<label class="check"><input type="checkbox" id="fw-pii" ${f.pii ? "checked" : ""}> <span><strong>🔒 Donnée d'identité (PII)</strong> — rangée dans le coffre identité, jamais dans les statistiques ni les exports anonymisés.</span></label>
         <label class="check"><input type="checkbox" id="fw-req" ${f.required ? "checked" : ""}> <span>Obligatoire</span></label>
         <div class="field" style="margin-top:.6rem"><span class="lbl">Niveau</span>${segHtml("fw-lv", [["person", "👤 Personne"], ["case", "📁 Dossier"]], f.level)}</div>`,
        `<div class="card-flat">${fieldHtml({ ...f, options: f.options.split("\n").map((x) => x.trim()).filter(Boolean) }, {}, "fw-prev")}</div><p class="small muted">Question à se poser : à quoi sert ce champ ? Peut-on s'en passer ? (minimisation)</p>`,
      ][step];
      body.innerHTML = `${stepperHtml(labels, step)}${pane}<div class="err" role="alert">${esc(err)}</div><div class="wizard-foot"><button type="button" class="btn btn-ghost" id="fw-b" ${step ? "" : "disabled"}>← Retour</button><button type="button" class="btn btn-orange" id="fw-n">${step === 4 ? "Ajouter le champ" : "Continuer"}</button></div>`;
      $$("[data-ft]", body).forEach((b) => b.addEventListener("click", () => { f.type = b.dataset.ft; draw(); }));
      bindSeg(body, (k, v) => { f.level = v; draw(); });
      const read = () => { if ($("#fw-l", body)) { f.label = $("#fw-l", body).value.trim(); f.key = $("#fw-k", body).value.trim(); } if ($("#fw-o", body)) f.options = $("#fw-o", body).value; if ($("#fw-min", body)) { f.min = $("#fw-min", body).value; f.max = $("#fw-max", body).value; } if ($("#fw-pii", body)) { f.pii = $("#fw-pii", body).checked; f.required = $("#fw-req", body).checked; } };
      $("#fw-b", body).addEventListener("click", () => { read(); step--; draw(); });
      $("#fw-n", body).addEventListener("click", () => {
        read();
        if (step === 1 && (!f.label || !/^[a-z][a-z0-9_]*$/.test(f.key) || p.fields.some((x) => x.key === f.key))) return draw(!f.label ? "Indiquez un libellé." : p.fields.some((x) => x.key === f.key) ? "Cette clé existe déjà." : "Clé : minuscules, chiffres et _.");
        if (step === 2 && f.type === "select" && f.options.split("\n").filter((x) => x.trim()).length < 2) return draw("Au moins deux choix.");
        if (step < 4) { step++; return draw(); }
        p.fields.push({ key: f.key, label: f.label, type: f.type, pii: f.pii, required: f.required, level: f.level, ...(f.type === "select" ? { options: f.options.split("\n").map((x) => x.trim()).filter(Boolean) } : {}), ...(f.type === "number" && f.min !== "" ? { min: +f.min } : {}), ...(f.type === "number" && f.max !== "" ? { max: +f.max } : {}) });
        close(); done();
      });
    };
    draw();
  }, true);
}
