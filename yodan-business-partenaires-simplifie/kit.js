/*
 * kit.js : composants d'interface partagés par les modules (repris de LAMIFI v2, Lonaci et BSPA) :
 * étapes, choix segmentés, liste + détail, pagination, histogramme empilé, anneau, barres empilées, QR fictif.
 */
"use strict";

const stepperHtml = (labels, i) => `<ol class="stepper" aria-label="Étapes">${labels.map((l, k) => `<li class="${k < i ? "done" : k === i ? "on" : ""}" ${k === i ? 'aria-current="step"' : ""}><span class="dot">${k < i ? "✓" : k + 1}</span><span class="lbl">${esc(l)}</span></li>`).join("")}</ol>`;
const segHtml = (key, options, current) => `<div class="segmented" role="group" data-seg="${key}">${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${String(current) === String(v) ? "on" : ""}" aria-pressed="${String(current) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
function bindSeg(root, onChange) { $$("[data-seg] [data-v]", root).forEach((b) => b.addEventListener("click", () => onChange(b.closest("[data-seg]").dataset.seg, b.dataset.v))); }
const kpiTile = (n, l, cls = "") => `<div class="tile ${cls}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
const zoneCls = { VERT: "vert", ORANGE: "jaune", ROUGE: "rouge" };
const zoneColor = { VERT: "var(--vert)", ORANGE: "var(--orange)", ROUGE: "var(--rouge)" };
const ZONE_LEGEND = `<div class="legend">${ZONES.map((z) => `<span><i style="background:${zoneColor[z]}"></i>${ZONE_LABEL[z]}</span>`).join("")}</div>`;
const fmtLong = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const rel = (iso) => { const n = daysBetween(iso, todayIso()); return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : n > 1 ? `il y a ${n} j` : `dans ${-n} j`; };

/* ---------- Pagination + recherche (10, 20, 50 ou tout) ---------- */
const pagers = {};
function pageOf(key, rows, size = 10) {
  const st = pagers[key] || (pagers[key] = { page: 1, size });
  const pages = st.size === "all" ? 1 : Math.max(1, Math.ceil(rows.length / st.size));
  st.page = Math.min(st.page, pages);
  const from = st.size === "all" ? 0 : (st.page - 1) * st.size;
  const slice = st.size === "all" ? rows : rows.slice(from, from + st.size);
  const html = rows.length > 10 ? `<div class="pager"><span class="small muted">${from + 1}–${from + slice.length} sur ${rows.length}</span>
    <span class="grow"></span><button type="button" class="btn btn-sm" data-pg="prev" ${st.page <= 1 ? "disabled" : ""} aria-label="Page précédente">‹</button><span class="small">${st.page} / ${pages}</span><button type="button" class="btn btn-sm" data-pg="next" ${st.page >= pages ? "disabled" : ""} aria-label="Page suivante">›</button>
    <select data-pgsize aria-label="Lignes par page">${[10, 20, 50, "all"].map((s) => `<option value="${s}" ${String(st.size) === String(s) ? "selected" : ""}>${s === "all" ? "Tout" : s}</option>`).join("")}</select></div>` : "";
  return { rows: slice, html };
}
function bindPager(root, key, redraw) {
  const st = pagers[key];
  $$("[data-pg]", root).forEach((b) => b.addEventListener("click", () => { st.page += b.dataset.pg === "next" ? 1 : -1; redraw(); }));
  $("[data-pgsize]", root)?.addEventListener("change", (e) => { st.size = e.target.value === "all" ? "all" : +e.target.value; st.page = 1; redraw(); });
}
const resetPage = (key) => { if (pagers[key]) pagers[key].page = 1; };
/** Saisie de recherche qui garde le focus quand la liste se redessine. */
function bindSearch(input, onChange) {
  input.addEventListener("input", () => { const pos = input.selectionStart, id = input.id; onChange(input.value); const again = document.getElementById(id); if (again) { again.focus(); again.setSelectionRange(pos, pos); } });
}

/* ---------- File de travail : liste à gauche, détail à droite (plein écran sur mobile) ---------- */
function inboxInto(root, cfg) {
  const all = cfg.items();
  if (!all.length) { root.innerHTML = `<div class="card empty"><div class="big">🎉</div><p><strong>Rien à faire ici.</strong></p><p class="small">${cfg.empty}</p></div>`; return; }
  const q = norm(cfg.state.q || "");
  const items = all.filter((it) => !q || norm(cfg.text(it)).includes(q));
  const page = pageOf(`inbox-${cfg.key}`, items);
  const sel = items.find((x) => x.id === cfg.state.sel) || items[0];
  cfg.state.sel = sel?.id ?? null;
  const list = `<div class="inbox-col"><input type="search" id="ib-q-${cfg.key}" value="${esc(cfg.state.q || "")}" placeholder="${esc(cfg.search || "Rechercher…")}" aria-label="Rechercher dans la file" class="input" style="margin-bottom:.5rem">
    <div class="inbox-list">${page.rows.map((it) => `<div class="item ${it.id === sel?.id && !isMobile() ? "on" : ""}" data-pick="${it.id}" role="button" tabindex="0">${cfg.row(it)}</div>`).join("") || `<div class="empty small">Aucun dossier ne correspond.</div>`}</div>${page.html}</div>`;
  const wire = () => {
    bindSearch($(`#ib-q-${cfg.key}`, root), (v) => { cfg.state.q = v; cfg.state.sel = null; resetPage(`inbox-${cfg.key}`); inboxInto(root, cfg); });
    bindPager(root, `inbox-${cfg.key}`, () => inboxInto(root, cfg));
    $$("[data-pick]", root).forEach((el) => { const go2 = () => { cfg.state.sel = el.dataset.pick; cfg.state.open = true; inboxInto(root, cfg); }; el.addEventListener("click", go2); el.addEventListener("keydown", (e) => { if (e.key === "Enter") go2(); }); });
  };
  if (isMobile() && !cfg.state.open) { root.innerHTML = list; wire(); return; }
  if (isMobile()) {
    root.innerHTML = `<div class="actions" style="margin-bottom:.6rem"><button type="button" class="btn btn-ghost btn-sm" id="ib-back">← Liste</button><span class="small muted">${items.indexOf(sel) + 1} / ${items.length}</span></div><div class="card detail" id="ib-detail"></div>`;
    $("#ib-back", root).addEventListener("click", () => { cfg.state.open = false; inboxInto(root, cfg); });
  } else {
    root.innerHTML = `<div class="inbox">${list}<div class="card detail" id="ib-detail"></div></div>`;
    wire();
  }
  if (sel) cfg.detail($("#ib-detail", root), sel, () => { cfg.state.sel = null; cfg.state.open = false; render(); });
  else $("#ib-detail", root).innerHTML = `<p class="empty">Aucun dossier ne correspond à la recherche.</p>`;
}

/* ---------- Graphiques SVG (lecture sans couleur : légende chiffrée, libellés) ---------- */
const niceMax = (v) => { if (v <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
/** Histogramme empilé : cols = [{label, vals:[a,b,c]|null}], cats = [[libellé, couleur]]. Censure : colonnes < 5 hachurées. */
function histogramSvg(cols, cats, { censor = false, pct = false, label = "Histogramme" } = {}) {
  const W = 680, H = 230, ml = 34, mr = 6, mt = 10, mb = 26, pw = W - ml - mr, ph = H - mt - mb;
  const totals = cols.map((c) => (c.vals ? c.vals.reduce((a, b) => a + b, 0) : 0));
  const max = pct ? 100 : niceMax(Math.max(1, ...totals));
  const bw = pw / Math.max(1, cols.length), barW = Math.max(3, Math.min(40, bw * 0.66));
  const every = Math.ceil(cols.length / (isMobile() ? 6 : 14));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" class="chart">`;
  [0, 0.5, 1].forEach((g) => { const y = mt + ph * (1 - g); s += `<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" class="grid"/><text x="${ml - 6}" y="${y + 4}" text-anchor="end" class="ax">${Math.round(max * g)}${pct ? "%" : ""}</text>`; });
  cols.forEach((c, i) => {
    const x = ml + i * bw + (bw - barW) / 2;
    if (i % every === 0) s += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" class="ax">${esc(c.label)}</text>`;
    if (!c.vals) return;
    const tot = totals[i];
    if (censor && tot > 0 && tot < MIN_GROUP) { const hh = ph * (pct ? 1 : tot / max); s += `<rect x="${x}" y="${mt + ph - hh}" width="${barW}" height="${hh}" class="hatch"><title>${esc(c.label)} : moins de 5, masqué</title></rect>`; return; }
    let y = mt + ph;
    c.vals.forEach((v, k) => { if (!v) return; const hh = ph * (pct ? v / tot : v / max); y -= hh; s += `<rect x="${x}" y="${y}" width="${barW}" height="${hh}" fill="${cats[k][1]}"><title>${esc(c.label)} · ${esc(cats[k][0])} : ${v}</title></rect>`; });
  });
  return `${s}</svg>`;
}
/** Anneau (parts d'un total) avec légende chiffrée. */
function donutHtml(parts, { censor = false, center = "" } = {}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const R0 = 52, C = 2 * Math.PI * R0;
  let off = 0;
  const arcs = total ? parts.map((p) => { const len = (p.value / total) * C; const a = `<circle r="${R0}" cx="70" cy="70" fill="none" stroke="${p.color}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"><title>${esc(p.label)} : ${p.value}</title></circle>`; off += len; return a; }).join("") : `<circle r="${R0}" cx="70" cy="70" fill="none" stroke="var(--gris-soft)" stroke-width="22"/>`;
  return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Répartition">${censor && total > 0 && total < MIN_GROUP ? `<circle r="${R0}" cx="70" cy="70" fill="none" class="hatch-stroke" stroke-width="22"/>` : `<g transform="rotate(-90 70 70)">${arcs}</g>`}<text x="70" y="76" text-anchor="middle" class="donut-n">${center || masked(total, censor)}</text></svg>
    <ul class="donut-legend">${parts.map((p) => `<li><i style="background:${p.color}"></i>${esc(p.label)}<b>${masked(p.value, censor)}${total && !(censor && p.value < MIN_GROUP && p.value > 0) ? ` <span class="muted small">${Math.round((p.value / total) * 100)} %</span>` : ""}</b></li>`).join("")}</ul></div>`;
}
/** Lignes de barres empilées par groupe ; un groupe de moins de 5 est masqué côté partenaire. */
function stackRowsHtml(rows, colors, labels, censor, { valuesKey = "zones", keys = ZONES } = {}) {
  if (!rows.length) return `<p class="empty small">Aucune donnée.</p>`;
  return `<div class="bars">${rows.map((r) => {
    const vals = Array.isArray(r[valuesKey]) ? r[valuesKey] : keys.map((k) => r[valuesKey][k]);
    const hide = censor && r.total > 0 && r.total < MIN_GROUP;
    return `<div class="bar-row"><span title="${esc(r.group ?? r.agency)}">${esc(r.group ?? r.agency)}</span>${hide ? `<span class="masked small">moins de ${MIN_GROUP} : masqué</span>` : `<div class="stack" role="img" aria-label="${esc(r.group ?? r.agency)} : ${vals.map((v, k) => `${labels[k]} ${v}`).join(", ")}">${vals.map((v, k) => (v ? `<span style="width:${(v / r.total) * 100}%;background:${colors[k]}" title="${esc(labels[k])} : ${v}"></span>` : "")).join("")}</div>`}<span class="num-cell">${masked(r.total, censor)}</span></div>`;
  }).join("")}</div><div class="legend">${labels.map((l, k) => `<span><i style="background:${colors[k]}"></i>${esc(l)}</span>`).join("")}</div>`;
}
/** QR code fictif (motif déterministe, ne mène nulle part). */
function qrSvg(seed = 7, size = 168) {
  const r = rng(hash(String(seed))), n = 21, cell = size / n;
  let s = `<svg class="qr" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QR code fictif"><rect width="${size}" height="${size}" fill="#fff"/>`;
  const finder = (x, y) => `<rect x="${x * cell}" y="${y * cell}" width="${7 * cell}" height="${7 * cell}" fill="#0b1c2a"/><rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/><rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="#0b1c2a"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!inF && r() < 0.47) s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#0b1c2a"/>`; }
  return `${s}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}
/** Section repliable (graphes ATMP v2) : titre-bouton, état gardé. */
const folds = {};
const foldHtml = (id, title, body, open = true) => { const o = folds[id] ?? open; return `<section class="card fold-card"><h3 class="fold-h"><button type="button" class="fold" data-fold="${id}" aria-expanded="${o}">${esc(title)}</button></h3><div class="fold-body" ${o ? "" : "hidden"}>${body}</div></section>`; };
/** Bouton « Tout replier / Tout déplier » : agit sur tous les blocs repliables de root. */
const foldAllHtml = () => `<button type="button" class="btn btn-sm" id="fold-all" aria-label="Ouvrir ou fermer tous les blocs">▾ Tout replier</button>`;
function bindFoldAll(root) {
  const btn = $("#fold-all", root);
  if (!btn) return;
  const anyOpen = () => $$("[data-fold]", root).some((b) => b.getAttribute("aria-expanded") === "true");
  const label = () => { const open = anyOpen(); btn.textContent = open ? "▾ Tout replier" : "▸ Tout déplier"; btn.setAttribute("aria-pressed", String(!open)); };
  btn.addEventListener("click", () => {
    const open = !anyOpen();
    $$("[data-fold]", root).forEach((b) => { folds[b.dataset.fold] = open; b.setAttribute("aria-expanded", String(open)); b.closest(".fold-card").querySelector(".fold-body").hidden = !open; });
    label();
  });
  $$("[data-fold]", root).forEach((b) => b.addEventListener("click", () => setTimeout(label)));
  label();
}
function bindFolds(root) { $$("[data-fold]", root).forEach((b) => b.addEventListener("click", () => { const o = b.getAttribute("aria-expanded") !== "true"; folds[b.dataset.fold] = o; b.setAttribute("aria-expanded", String(o)); b.closest(".fold-card").querySelector(".fold-body").hidden = !o; })); }
/** Sous-onglets internes à une fonctionnalité (ex. Validation : À décider / À appeler / Traités). */
const subs = {};
function subTabsHtml(key, tabs, current) { return `<div class="subtabs" role="tablist">${tabs.map((t) => `<button type="button" role="tab" data-sub="${key}" data-v="${t.id}" class="${t.id === current ? "on" : ""}" aria-selected="${t.id === current}">${esc(t.label)}${t.count != null ? ` <span class="count ${t.hot && t.count ? "hot" : ""}">${t.count}</span>` : ""}</button>`).join("")}</div>`; }
function bindSubTabs(root, redraw) { $$("[data-sub]", root).forEach((b) => b.addEventListener("click", () => { subs[b.dataset.sub] = b.dataset.v; redraw(); })); }
const subOf = (key, tabs) => (tabs.some((t) => t.id === subs[key]) ? subs[key] : tabs[0].id);
/** Téléchargement simulé d'un export agrégé (aucun fichier réel, aucune donnée individuelle). */
function exportToast(what) { audit("Export", what); toast(`Export « ${esc(what)} » téléchargé (chiffres agrégés, effectifs < 5 regroupés).`); }
