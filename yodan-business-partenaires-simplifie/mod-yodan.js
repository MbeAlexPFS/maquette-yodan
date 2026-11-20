/*
 * mod-yodan.js : « À prendre en charge » (admin Yodan).
 * La prise en charge se fait hors de l'application : on exporte les personnes à prendre en charge,
 * puis on passe le dossier à « Clos » quand le traitement est fini.
 */
"use strict";

const yp = { q: "", status: "A_PRENDRE", exported: "all" };
function viewPatients(el, scope) {
  const base = db.patients.filter((x) => scope.partnerIds.includes(x.partnerId));
  const rows = base.filter((x) => (yp.status === "all" || patientStatus(x) === yp.status)
    && (yp.exported === "all" || (yp.exported === "new" ? !x.exports.length : !!x.exports.length))
    && (!yp.q || norm(`${x.dossier} ${displayName(personOf(x.personId))} ${personOf(x.personId).id1}`).includes(norm(yp.q)))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = pageOf("yo-pat", rows);
  const open = rows.filter((x) => !x.closedAt);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">À prendre en charge</span><h1>${base.filter((x) => !x.closedAt).length} personne(s) à prendre en charge</h1></div>
      <button type="button" class="btn btn-orange" id="pt-export" ${open.length ? "" : "disabled"}>⬇ Exporter la liste (${open.length})</button></div>
    <div class="card"><div class="toolbar"><input type="search" class="grow" id="pt-q" placeholder="Dossier, nom ou e-mail" value="${esc(yp.q)}" aria-label="Rechercher une personne">
      ${segHtml("pt-s", [["A_PRENDRE", "À prendre en charge"], ["CLOS", "Clos"], ["all", "Tous"]], yp.status)}
      ${segHtml("pt-x", [["all", "Toutes"], ["new", "Jamais exportées"], ["done", "Déjà exportées"]], yp.exported)}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Dossier</th><th>Nom</th>${multi(scope) ? "<th>Partenaire</th>" : ""}<th>Profil</th><th>Depuis</th><th>Export</th><th>Statut</th></tr></thead><tbody>
    ${page.rows.map((x) => { const ev = evaluationOf(x.evalId); return `<tr class="click" data-pt="${x.id}" tabindex="0"><td><strong>${esc(x.dossier)}</strong></td><td>${esc(displayName(personOf(x.personId)))}${wantsCallback(x) ? ' <span title="A demandé à être recontacté(e)">📞</span>' : ""}</td>${multi(scope) ? `<td class="small">${esc(pName(x.partnerId))}</td>` : ""}<td>${zonePill(ev.zone)} <span class="small muted">${esc(ev.test)}</span></td><td class="small">${fmtDate(x.createdAt)}</td><td class="small">${x.exports.length ? `le ${fmtDate(x.exports.at(-1))}` : '<span class="pill orange">jamais</span>'}</td><td>${pill(PEC_STATUS[patientStatus(x)])}${x.closedAt ? `<div class="small muted">${esc(x.closedReason)}</div>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Aucune personne pour ces filtres.</td></tr>`}
    </tbody></table></div>${page.html}</div>`;
  const again = () => viewPatients(el, scope);
  bindSearch($("#pt-q", el), (v) => { yp.q = v; resetPage("yo-pat"); again(); });
  bindSeg(el, (k, v) => { if (k === "pt-s") yp.status = v; else yp.exported = v; resetPage("yo-pat"); again(); });
  bindPager(el, "yo-pat", again);
  $("#pt-export", el).addEventListener("click", () => exportModal(open, again));
  $$("[data-pt]", el).forEach((r) => { const o = () => patientModal(r.dataset.pt, again); r.addEventListener("click", o); r.addEventListener("keydown", (e) => { if (e.key === "Enter") o(); }); });
}
/** Export : aperçu des colonnes, puis téléchargement du CSV (données fictives) ; l'export est daté sur chaque dossier. */
function exportModal(list, refresh) {
  modal("Exporter les personnes à prendre en charge", `<p><strong>${list.length}</strong> personne(s) : la liste affichée, sans les dossiers clos.</p>
    <p class="small muted">Colonnes : ${EXPORT_COLUMNS.join(", ")}. Ni réponses, ni dimensions du bilan.</p>
    <div class="banner banner-warn">Ce fichier contient des données personnelles. Transmettez-le uniquement par un canal sécurisé au professionnel qui assure la prise en charge.</div>
    <button type="button" class="btn btn-orange btn-block" id="xp-go">⬇ Télécharger le fichier CSV</button>`, (body, close) => {
    $("#xp-go", body).addEventListener("click", () => {
      const r = exportPatients(list);
      const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `a-prendre-en-charge-${todayIso()}.csv`; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      close(); toast(`${r.count} personne(s) exportée(s). Export tracé dans le journal.`); refresh();
    });
  });
}
function patientModal(id, refresh) {
  const pt = patientOf(id);
  audit("Consultation fiche personne", pt.dossier);
  const draw = (body) => {
    const p = partnerOf(pt.partnerId), person = personOf(pt.personId), ev = evaluationOf(pt.evalId);
    const phone = person.identity.telephone || "";
    body.innerHTML = `<div class="actions" style="margin-bottom:.6rem">${pill(PEC_STATUS[patientStatus(pt)])}<span class="small muted">Dossier ${esc(pt.dossier)} · pseudonyme ${esc(person.pseudo)}${pt.exports.length ? ` · exporté le ${fmtDate(pt.exports.at(-1))}` : " · jamais exporté"}</span></div>
      <div class="grid-2"><div><h3>Personne</h3><dl class="kv"><dt>Nom</dt><dd>${esc(displayName(person))}</dd><dt>E-mail</dt><dd>${esc(person.identity.email || person.id1)}</dd><dt>Téléphone</dt><dd>${esc(phone || "—")}</dd><dt>Partenaire</dt><dd>${esc(p.name)}</dd>
          <dt>Bilan</dt><dd>${zonePill(ev.zone)} ${esc(ev.test)} du ${fmtDate(ev.date)}</dd>${pt.closedAt ? `<dt>Clos le</dt><dd>${fmtDate(pt.closedAt)} · ${esc(pt.closedReason)}</dd>` : ""}</dl>
        <h3 style="margin-top:1rem">Consentements</h3><ul class="consent-list small">${consentMeta(pt).map(([k, v]) => `<li><span>${esc(k)}</span><strong>${esc(v)}</strong></li>`).join("")}</ul></div>
      <div><h3>Appel</h3><div class="actions">${phone ? `<a class="btn btn-primary btn-sm" href="tel:${esc(phone.replace(/\s/g, ""))}" id="pm-call">📞 Appeler ${esc(phone)}</a>` : `<span class="small muted">Pas de téléphone : contact par e-mail.</span>`}</div>
        <form id="pm-ret" style="margin-top:.6rem"><div class="field"><label for="pm-o">Retour d'appel</label><select id="pm-o">${Object.entries(CALL_OUTCOMES).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
          <div class="field"><label for="pm-n">Commentaire (facultatif)</label><input id="pm-n" maxlength="200" placeholder="Ex. : rappeler après 17 h"></div><button class="btn btn-sm" type="submit">Enregistrer le retour</button></form>
        <ul class="small" style="padding-left:1rem">${pt.calls.slice().reverse().map((c) => `<li>${fmtDateTime(c.at)} — ${esc(CALL_OUTCOMES[c.outcome])}${c.note ? ` · <span class="muted">${esc(c.note)}</span>` : ""}</li>`).join("") || `<li class="muted">Aucun appel.</li>`}</ul></div></div>
      ${reportActionsHtml(ev.id)}
      ${pt.closedAt ? "" : `<form class="actions modal-actions" id="pm-close"><label class="small" for="pm-r">Motif</label><select id="pm-r" class="input" style="width:auto">${CLOSE_REASONS.map((r) => `<option>${esc(r)}</option>`).join("")}</select><button type="submit" class="btn btn-orange">Passer à « Clos »</button></form>`}`;
    $("#pm-call", body)?.addEventListener("click", () => audit("Appel", pt.dossier));
    bindReportActions(body, ev.id);
    $("#pm-ret", body).addEventListener("submit", (e) => { e.preventDefault(); logCall(pt.id, $("#pm-o", body).value, $("#pm-n", body).value); toast("Retour d'appel enregistré."); draw(body); refresh(); });
    $("#pm-close", body)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = $("button", e.target);
      if (!btn.dataset.armed) { btn.dataset.armed = "1"; btn.textContent = "Confirmer la clôture"; btn.classList.replace("btn-orange", "btn-danger"); return; }
      closePatient(pt.id, $("#pm-r", body).value); toast(`Dossier ${esc(pt.dossier)} clos.`); draw(body); refresh();
    });
  };
  modal(`${displayName(personOf(pt.personId))} — ${pt.dossier}`, "", draw, true);
}
