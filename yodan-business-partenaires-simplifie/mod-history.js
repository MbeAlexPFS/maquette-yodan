/*
 * mod-history.js : « Historique » (lecture seule) et « Journaux internes », sur le modèle de l'application CNPS :
 *  - historique = table du journal des accès (filtres partenaire, côté, recherche, Du → Au) ;
 *  - journaux internes = copie quotidienne access-jj-mm-aaaa.log, une ligne JSON par accès
 *    (écrite avant la base pour que la trace subsiste si la base est inaccessible).
 * Aucun contenu de santé n'y figure (règle 4.1.4).
 */
"use strict";

const histState = {};
/** Entrées visibles : tout pour l'admin LAMIFI ; seulement les actions de son côté pour un partenaire (comme la CNPS). */
const historyScope = (opts) => db.audit.filter((a) => !opts.partnerId || (a.partnerId === opts.partnerId && a.side === "PARTENAIRE"));
function historyView(el, opts = {}) {
  const key = opts.key || "lamifi";
  const st = histState[key] || (histState[key] = { partner: "", side: "", q: "", from: "", to: "" });
  const base = historyScope(opts);
  const rows = base.filter((a) => (!st.partner || (st.partner === "none" ? !a.partnerId : a.partnerId === st.partner))
    && (!st.side || a.side === st.side)
    && (!st.from || isoOf(a.at) >= st.from) && (!st.to || isoOf(a.at) <= st.to)
    && (!st.q || norm(`${a.who || ""} ${a.label} ${a.action} ${a.dossier || ""} ${a.details.cible || ""}`).includes(norm(st.q)))).slice().reverse();
  const page = pageOf(`hist-${key}`, rows, 20);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Lecture seule</span><h1>Historique</h1></div><span class="small muted">${rows.length} entrée(s)</span></div>
    <div class="card"><div class="toolbar hist-filters">
      ${opts.partnerId ? "" : `<label class="small">Partenaire <select id="h-partner"><option value="">Tous</option><option value="none" ${st.partner === "none" ? "selected" : ""}>Hors partenaire (LAMIFI, YODAN)</option>${db.partners.map((p) => `<option value="${p.id}" ${st.partner === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label class="small">Côté <select id="h-side"><option value="">Tous</option>${Object.entries(SIDE_LABEL).map(([k, l]) => `<option value="${k}" ${st.side === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`}
      <input type="search" class="grow" id="h-q" placeholder="Utilisateur, action, dossier…" value="${esc(st.q)}" aria-label="Rechercher dans l'historique">
      <label class="small">Du <input type="date" id="h-from" value="${st.from}"></label><label class="small">Au <input type="date" id="h-to" value="${st.to}"></label></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Date</th>${opts.partnerId ? "" : "<th>Côté</th><th>Partenaire</th>"}<th>Utilisateur</th><th>Action</th><th>Dossier</th><th>Détails</th></tr></thead><tbody>
    ${page.rows.map((a) => `<tr><td class="small nowrap">${fmtDateTime(a.at)}</td>${opts.partnerId ? "" : `<td><span class="pill ${{ LAMIFI: "orange", YODAN: "bleu", PARTENAIRE: "vert", PUBLIC: "gris", SYSTEME: "gris" }[a.side]}">${SIDE_LABEL[a.side]}</span></td><td class="small">${a.partnerId ? esc(pName(a.partnerId)) : "—"}</td>`}
      <td class="small">${a.who ? esc(a.who) : '<span class="muted">participant</span>'}</td><td><strong>${esc(a.label)}</strong><div class="small muted"><code>${esc(a.action)}</code></div></td><td class="small">${esc(a.dossier || "—")}</td><td class="small">${esc(a.details.cible || "")}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Aucune entrée pour ces filtres.</td></tr>`}
    </tbody></table></div>${page.html}</div>`;
  const again = () => historyView(el, opts);
  $("#h-partner", el)?.addEventListener("change", (e) => { st.partner = e.target.value; resetPage(`hist-${key}`); again(); });
  $("#h-side", el)?.addEventListener("change", (e) => { st.side = e.target.value; resetPage(`hist-${key}`); again(); });
  bindSearch($("#h-q", el), (v) => { st.q = v; resetPage(`hist-${key}`); again(); });
  $("#h-from", el).addEventListener("change", (e) => { st.from = e.target.value; resetPage(`hist-${key}`); again(); });
  $("#h-to", el).addEventListener("change", (e) => { st.to = e.target.value; resetPage(`hist-${key}`); again(); });
  bindPager(el, `hist-${key}`, again);
}

/* ---------- Journaux internes : une ligne JSON par accès, un fichier par jour ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const logFileName = (iso) => `access-${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}.log`;
/** Ligne du fichier, mêmes champs que la copie de l'application CNPS (+ tenant, base commune). */
const logLine = (a) => JSON.stringify({ created_at: new Date(a.at).toISOString(), user_id: a.who, tenant: a.partnerId ? partnerOf(a.partnerId).tenant : null, side: a.side, action: a.action, evaluation_id: a.dossier, ip: a.ip, details: a.details });
function logFiles() {
  const byDay = {};
  db.audit.forEach((a) => { const d = isoOf(a.at); (byDay[d] = byDay[d] || []).push(a); });
  return Object.keys(byDay).sort().reverse().map((d) => { const content = byDay[d].map(logLine).join("\n") + "\n"; return { day: d, name: logFileName(d), lines: byDay[d].length, bytes: new Blob([content]).size, content }; });
}
function logsView(el) {
  const files = logFiles();
  const page = pageOf("logs", files, 15);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Journaux internes</span><h1>Copie quotidienne du journal des accès</h1></div></div>
    <div class="card"><p class="small muted" style="margin-top:0">Un fichier par jour, une ligne JSON par accès, écrite <strong>avant</strong> la base de données pour que la trace subsiste même si la base est inaccessible. Lecture seule : rien ne peut être modifié ni supprimé ici.</p>
    <div class="table-wrap"><table class="table"><thead><tr><th>Fichier</th><th class="num-cell">Lignes</th><th class="num-cell">Taille</th><th></th></tr></thead><tbody>
    ${page.rows.map((f) => `<tr><td><code>${esc(f.name)}</code></td><td class="num-cell">${f.lines}</td><td class="num-cell">${(f.bytes / 1024).toFixed(1)} Ko</td><td class="actions"><button type="button" class="btn btn-sm" data-view="${f.day}">Voir</button><button type="button" class="btn btn-sm btn-ghost" data-dl="${f.day}">⬇ Télécharger</button></td></tr>`).join("")}
    </tbody></table></div>${page.html}</div>`;
  bindPager(el, "logs", () => logsView(el));
  const file = (d) => logFiles().find((f) => f.day === d);
  $$("[data-view]", el).forEach((b) => b.addEventListener("click", () => { const f = file(b.dataset.view); audit("Consultation journal interne", f.name); modal(f.name, `<p class="small muted" style="margin-top:0">${f.lines} ligne(s) · lecture seule</p><pre class="log-view">${esc(f.content)}</pre>`, null, true); }));
  $$("[data-dl]", el).forEach((b) => b.addEventListener("click", () => {
    const f = file(b.dataset.dl); audit("Téléchargement journal interne", f.name);
    const url = URL.createObjectURL(new Blob([f.content], { type: "application/x-ndjson" }));
    const a = document.createElement("a"); a.href = url; a.download = f.name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }));
}
