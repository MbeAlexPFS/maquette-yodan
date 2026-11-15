/*
 * Maquette BSPA — parcours QR code + vérification OTP par e-mail.
 * Toutes les données sont fictives (noms « Démo / Test », domaines *.exemple.test).
 * Aucun appel réseau : envois d'e-mails, OTP et exports sont simulés.
 */
"use strict";

/* =====================================================================
 * Outils
 * ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

function toast(msg) {
  const el = h(`<div class="toast">${msg}</div>`);
  $("#toast").append(el);
  setTimeout(() => el.remove(), 3200);
}
function bind(root, handlers) {
  $$("[data-act]", root).forEach((el) => {
    const fn = handlers[el.dataset.act];
    if (fn) el.addEventListener(el.dataset.ev || "click", (e) => fn(el, e));
  });
}
function modal(title, html, mount) {
  const back = h(`<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" aria-label="Fermer">×</button></div>
    <div class="modal-body">${html}</div></div></div>`);
  const close = () => { back.remove(); document.removeEventListener("keydown", onEsc); };
  const onEsc = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onEsc);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  $(".modal-head button", back).addEventListener("click", close);
  ($("#stage .phone") || document.body).append(back);
  mount?.($(".modal-body", back), close);
  $("button, input, select", $(".modal-body", back))?.focus();
  return close;
}
/** Faux QR code (motif déterministe) : purement illustratif, non scannable. */
function qrSvg(seed) {
  const n = 25; let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const finder = (x, y) => [[0, 7], [1, 5], [2, 3]].map(([o, w], i) =>
    `<rect x="${x + o}" y="${y + o}" width="${w + (i === 0 ? 0 : 0)}" height="${w}" fill="${i === 1 ? "#fff" : "#0f2f47"}"/>`).join("");
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  let cells = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  return `<svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR code fictif" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><g fill="#0f2f47">${cells}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

/* =====================================================================
 * Questionnaire (libellés repris de app/bspa_core.py)
 * ===================================================================== */
const SCALE_A = ["Jamais", "De temps en temps", "Moins de la moitié du temps", "Plus de la moitié du temps", "La plupart du temps", "Tout le temps"];
const SCALE_B = ["Jamais", "Presque jamais", "Parfois", "Assez souvent", "Très souvent"];
const SCALE_C = ["Jamais", "Quelques fois par an", "Une fois par mois", "Quelques fois par mois", "Une fois par semaine", "Quelques fois par semaine", "Chaque jour"];
const SCALE_D = ["Pas du tout d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "Tout à fait d'accord"];
const opts = (labels, start = 0) => labels.map((l, i) => [i + start, l]);

const SECTIONS = [
  { key: "A", short: "Bien-être", title: "Au cours des deux dernières semaines…", items: [
    "Je me suis senti(e) de bonne humeur et joyeux(se)", "Je me suis senti(e) calme et détendu(e)",
    "Je me suis senti(e) actif(ve) et plein(e) d'énergie", "Je me suis réveillé(e) reposé(e) et prêt(e) pour la journée",
    "Ma vie quotidienne a été remplie de choses qui m'intéressent"].map((t) => ({ t, o: opts(SCALE_A) })) },
  { key: "B", short: "Stress", title: "Au cours du dernier mois, à quelle fréquence…", items: [
    "Vous avez été incapable de contrôler les choses importantes dans votre vie",
    "Vous vous êtes senti(e) confiant(e) dans votre capacité à gérer vos problèmes",
    "Vous avez eu l'impression que les choses allaient dans le bon sens pour vous",
    "Les difficultés ont tellement pesé que vous ne pouviez plus y faire face"].map((t) => ({ t, o: opts(SCALE_B) })) },
  { key: "C", short: "Épuisement", title: "Votre ressenti au travail", items: [
    "Je me sens vidé(e) émotionnellement par mon travail", "Je me sens épuisé(e) en fin de journée de travail",
    "Le matin, je me sens fatigué(e) à l'idée d'aller travailler", "Mon travail me demande un effort qui me pèse de plus en plus",
    "J'ai l'impression d'être à bout"].map((t) => ({ t, o: opts(SCALE_C) })) },
  { key: "D", short: "Vécu au travail", title: "Votre vécu au travail", items: [
    "Ma charge de travail quotidienne est raisonnable et gérable", "Je me sens soutenu(e) par mon responsable quand j'en ai besoin",
    "Mon travail est reconnu à sa juste valeur", "Je trouve du sens dans ce que je fais au quotidien",
    "Les relations avec mes collègues sont globalement satisfaisantes"].map((t) => ({ t, o: opts(SCALE_D, 1) })) },
  { key: "E", short: "Signaux", title: "Quelques questions complémentaires", items: [
    { t: "Dormez-vous suffisamment et vous sentez-vous reposé(e) au réveil la plupart du temps ?", o: opts(["Oui, presque toujours", "Parfois", "Rarement ou jamais"]) },
    { t: "Avez-vous augmenté votre consommation de substances pour tenir (café, alcool, tabac, médicaments) ?", o: opts(["Non, pas de changement", "Légèrement", "Oui, nettement"]) },
    { t: "Traversez-vous actuellement un évènement de vie difficile (deuil, séparation, maladie, difficultés financières) ?", o: opts(["Non", "Oui, mais je le gère bien", "Oui, cela m'affecte fortement"]) }] },
];
const DEMO_FIELDS = [
  ["genre", "Genre", ["Femme", "Homme", "Je préfère ne pas répondre"]],
  ["tranche_age", "Tranche d'âge", ["18-25 ans", "26-35 ans", "36-45 ans", "46-55 ans", "56 ans et +"]],
  ["anciennete", "Ancienneté dans l'entreprise", ["Moins d'1 an", "1 à 5 ans", "6 à 10 ans", "Plus de 10 ans"]],
];
const ZONE_LABEL = { VERT: "Satisfaisant", ORANGE: "Vigilance", ROUGE: "À prendre en charge" };
const ZONE_CLS = { VERT: "vert", ORANGE: "orange", ROUGE: "rouge" };
const DIM_LABEL = { A: "Bien-être (WHO-5)", B: "Stress perçu (PSS-4)", C: "Épuisement (MBI-EE)", D: "Vécu au travail (QVT-5)", E: "Signaux d'alerte" };

/** Calcul simplifié pour la maquette (les vrais seuils restent dans bspa_core.py). */
function score(ans) {
  const v = (k, i) => Number(ans[`${k}${i}`] ?? 0);
  const sum = (k, n) => Array.from({ length: n }, (_, i) => v(k, i)).reduce((a, b) => a + b, 0);
  const a = sum("A", 5) * 4;
  const b = v("B", 0) + (4 - v("B", 1)) + (4 - v("B", 2)) + v("B", 3);
  const c = sum("C", 5), d = sum("D", 5), e = sum("E", 3);
  const strong = [0, 1, 2].some((i) => v("E", i) === 2);
  const dims = {
    A: { pct: a, zone: a >= 68 ? "VERT" : a >= 51 ? "ORANGE" : "ROUGE" },
    B: { pct: (b / 16) * 100, zone: b <= 7 ? "VERT" : b <= 11 ? "ORANGE" : "ROUGE" },
    C: { pct: (c / 30) * 100, zone: c <= 8 ? "VERT" : c <= 14 ? "ORANGE" : "ROUGE" },
    D: { pct: ((d - 5) / 20) * 100, zone: d >= 20 ? "VERT" : d >= 13 ? "ORANGE" : "ROUGE" },
    E: { pct: (e / 6) * 100, zone: strong ? "ROUGE" : e <= 1 ? "VERT" : "ORANGE" },
  };
  const reds = ["A", "B", "C", "D"].filter((k) => dims[k].zone === "ROUGE").length;
  const pts = Object.values(dims).reduce((s, x) => s + ({ VERT: 0, ORANGE: 1, ROUGE: 2 }[x.zone]), 0);
  const profil = strong || reds >= 2 ? "ROUGE" : reds === 1 || pts >= 3 ? "ORANGE" : "VERT";
  return { dims, profil };
}

/* =====================================================================
 * Données fictives
 * ===================================================================== */
const FIRST = ["Aya", "Koffi", "Mariam", "Yao", "Fatou", "Serge", "Adjoua", "Ibrahim", "Clarisse", "Moussa", "Estelle", "Didier", "Nadia", "Paul", "Awa", "Hervé", "Salimata", "Franck"];
const STATUSES = ["TERMINE", "TERMINE", "TERMINE", "TERMINE", "VERIFIE", "INVITE", "TERMINE", "TERMINE", "EXPIRE", "TERMINE", "TERMINE", "INVITE", "TERMINE", "TERMINE", "TERMINE", "VERIFIE", "TERMINE", "TERMINE"];
const PROFILS = ["VERT", "ORANGE", "VERT", "ROUGE", null, null, "VERT", "ORANGE", null, "VERT", "VERT", null, "ORANGE", "VERT", "VERT", null, "ORANGE", "VERT"];
const STATUS_PILL = { INVITE: ["gris", "Invité"], VERIFIE: ["bleu", "E-mail vérifié"], TERMINE: ["vert", "Terminé"], EXPIRE: ["rouge", "Lien expiré"] };

/** Une seule entreprise cliente pour l'instant ; ses domaines e-mail valent pour toutes ses campagnes. */
const COMPANY = { name: "Entreprise Démo Alpha", domains: ["alpha.exemple.test"] };
/** Décision de l'employé sur la proposition d'accompagnement (null = pas encore répondu / non proposé). */
const ACCOMP = [null, "OUI", null, "NON", null, null, null, "OUI", null, null, null, null, null, null, null, null, null, null];
const ACCOMP_PILL = { OUI: ["vert", "Accepté"], NON: ["gris", "Refusé"] };
/*
 * pec = « prise en charge proposée par l'entreprise » pour cette campagne.
 * Si oui, l'employé en Vigilance / À prendre en charge indique s'il est d'accord (information indicative,
 * aucune attribution de praticien dans l'app).
 */
const db = {
  campaigns: [
    { id: "c1", name: "Bilan T4 2026", domains: COMPANY.domains, mode: "qr", created: "02/11/2026", expires: "16/11/2026", code: "T4-26", open: true, pec: true },
    { id: "c2", name: "Bilan T2 2026", domains: COMPANY.domains, mode: "liens", created: "05/05/2026", expires: "19/05/2026", code: "T2-26", open: false, pec: true },
  ],
  people: {
    c1: FIRST.map((f, i) => ({ id: `p${i}`, name: `${f} Démo`, email: `${f.toLowerCase()}.demo@alpha.exemple.test`, status: STATUSES[i], profil: PROFILS[i], accomp: ACCOMP[i], sent: false, via: i % 3 === 0 ? "Lien individuel" : "QR code" })),
    c2: FIRST.slice(0, 9).map((f, i) => ({ id: `q${i}`, name: `${f} Démo`, email: `${f.toLowerCase()}.demo@alpha.exemple.test`, status: i < 7 ? "TERMINE" : "EXPIRE", profil: i < 7 ? ["VERT", "ORANGE", "VERT"][i % 3] : null, accomp: i === 1 ? "OUI" : i === 4 ? "NON" : null, sent: i < 4, via: "Lien individuel" })),
  },
};
// Campagnes passées fictives (pour la pagination et la comparaison côté RH).
[["T1 2026", "03/02/2026", "17/02/2026", "qr", true], ["T4 2025", "03/11/2025", "17/11/2025", "qr", false], ["T3 2025", "04/08/2025", "18/08/2025", "liens", false],
 ["T2 2025", "05/05/2025", "19/05/2025", "liens", true], ["T1 2025", "03/02/2025", "17/02/2025", "qr", false]].forEach(([t, cr, ex, mode, pec], k) => {
  const id = `c${k + 3}`;
  db.campaigns.push({ id, name: `Bilan ${t}`, domains: COMPANY.domains, mode, created: cr, expires: ex, code: t.replace(" 20", "-"), open: false, pec });
  db.people[id] = FIRST.slice(0, 12 + k).map((f, i) => {
    const done = (i + k) % 6 !== 5, profil = done ? ["VERT", "VERT", "ORANGE", "VERT", "ROUGE", "ORANGE"][(i + k) % 6] : null;
    return { id: `${id}p${i}`, name: `${f} ${i % 2 ? "Test" : "Démo"}`, email: `${f.toLowerCase()}.${i % 2 ? "test" : "demo"}@alpha.exemple.test`, status: done ? "TERMINE" : "EXPIRE", profil,
      accomp: pec && profil && profil !== "VERT" ? [null, "OUI", "NON", "OUI"][i % 4] : null, sent: done, via: mode === "qr" && i % 3 ? "QR code" : "Lien individuel" };
  });
});
const statsOf = (cid) => {
  const ps = db.people[cid];
  const done = ps.filter((p) => p.status === "TERMINE");
  const cnt = (z) => done.filter((p) => p.profil === z).length;
  return { total: ps.length, done: done.length, vert: cnt("VERT"), orange: cnt("ORANGE"), rouge: cnt("ROUGE") };
};

/* =====================================================================
 * État + rendu général
 * ===================================================================== */
const ROLES = [
  { id: "yodan", label: "Yodan (administration)" },
  { id: "entreprise", label: "Entreprise (RH)" },
  { id: "employe", label: "Employé" },
];
const state = {
  role: "yodan", device: "pc", notes: true,
  yodan: { view: "list", cid: "c1", tab: "diffusion", sel: new Set(),
    cf: { q: "", etat: "all", mode: "all", pec: "all", page: 1, size: 5 },
    pf: { q: "", status: "all", profil: "all", accomp: "all", via: "all", page: 1, size: 10 } },
  ent: { by: "tranche_age", cid: "all", cmp: { page: 1, size: 5 } },
  emp: { step: "email", email: "", fromLink: false, otpTries: 0, page: 0, ans: {}, consent: false, result: null, accomp: null },
};

function render() {
  $$("#role-switch button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
  $("#role-select").value = state.role;
  $$(".device-switch button").forEach((b) => b.classList.toggle("on", b.dataset.device === state.device));
  const stage = $("#stage");
  stage.innerHTML = "";
  let root = stage;
  if (state.device === "mobile") {
    const wrap = h(`<div class="phone-wrap"><div class="phone"><div class="phone-screen"></div></div></div>`);
    stage.append(wrap);
    root = $(".phone-screen", wrap);
  }
  ({ yodan: renderYodan, entreprise: renderEntreprise, employe: renderEmploye })[state.role](root);
  renderNotes();
}
function notesKey() {
  if (state.role === "yodan") return state.yodan.view === "list" ? "yodan-list" : `yodan-${state.yodan.tab}`;
  if (state.role === "entreprise") return "entreprise";
  return `emp-${state.emp.step}`;
}
function renderNotes() {
  const n = NOTES[notesKey()];
  const aside = $("#notes");
  const li = (arr) => arr.map((x) => `<li>${x}</li>`).join("");
  aside.innerHTML = `<button type="button" class="notes-close" aria-label="Fermer les notes">×</button>
    <span class="kicker">Notes UX</span><h2>${n.title}</h2>
    <span class="tag">Choix de l'écran</span><ul>${li(n.why)}</ul>
    ${n.secu ? `<span class="tag">Sécurité / conformité</span><ul class="secu">${li(n.secu)}</ul>` : ""}
    ${n.q ? `<span class="tag">Questions à valider</span><ul class="q">${li(n.q)}</ul>` : ""}
    ${state.role === "employe" ? `<span class="tag">Raccourcis démo</span><div class="row">${["email", "otp", "form", "done", "mail", "bilan"].map((s) => `<button type="button" class="btn btn-sm" data-jump="${s}">${s}</button>`).join("")}</div>` : ""}`;
  $(".notes-close", aside).addEventListener("click", () => setNotes(false));
  $$("[data-jump]", aside).forEach((b) => b.addEventListener("click", () => {
    const e = state.emp;
    if (["done", "mail", "bilan"].includes(b.dataset.jump) && !e.result) { randomFill(); e.email ||= "aya.demo@alpha.exemple.test"; e.result = score(e.ans); }
    if (b.dataset.jump === "form") { e.email ||= "aya.demo@alpha.exemple.test"; e.page = 0; }
    if (b.dataset.jump === "otp") e.email ||= "aya.demo@alpha.exemple.test";
    e.step = b.dataset.jump; render();
  }));
}
function setNotes(on) {
  state.notes = on;
  $("#notes-toggle").setAttribute("aria-pressed", String(on));
  $("#layout").classList.toggle("with-notes", on);
  $("#notes").hidden = !on;
}
/* ---------- Filtres + pagination (communs à toutes les listes) ---------- */
function paginate(list, f) {
  const pages = Math.max(1, Math.ceil(list.length / f.size));
  f.page = Math.min(Math.max(1, f.page), pages);
  return { rows: list.slice((f.page - 1) * f.size, f.page * f.size), pages };
}
function pagerHtml(total, f, pages, sizes = [5, 10, 25]) {
  const from = total ? (f.page - 1) * f.size + 1 : 0, to = Math.min(f.page * f.size, total);
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - f.page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return `<nav class="pager" aria-label="Pagination"><span class="small muted">${from}–${to} sur ${total}</span>
    <label class="small muted">Par page <select data-pg="size">${sizes.map((s) => `<option ${s === f.size ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <div class="pg-btns"><button type="button" data-pg="prev" ${f.page === 1 ? "disabled" : ""} aria-label="Page précédente">‹</button>
    ${nums.map((p) => p === "…" ? `<span class="muted">…</span>` : `<button type="button" data-pg="${p}" class="${p === f.page ? "on" : ""}" ${p === f.page ? 'aria-current="page"' : ""}>${p}</button>`).join("")}
    <button type="button" data-pg="next" ${f.page === pages ? "disabled" : ""} aria-label="Page suivante">›</button></div></nav>`;
}
function bindPager(root, f) {
  $$("[data-pg]", root).forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "click", () => {
    const v = el.dataset.pg;
    if (v === "size") { f.size = Number(el.value); f.page = 1; } else if (v === "prev") f.page--; else if (v === "next") f.page++; else f.page = Number(v);
    render();
  }));
}
const fSearch = (key, ph, f) => `<input type="search" data-f="${key}" value="${esc(f[key])}" placeholder="${ph}" aria-label="${ph}">`;
const fSelect = (key, label, options, f) => `<select data-f="${key}" aria-label="${label}">${options.map(([v, l]) => `<option value="${v}" ${f[key] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
const filtersActive = (f, keys) => keys.some((k) => (k === "q" ? f.q.trim() !== "" : f[k] !== "all"));
function bindFilters(root, f, keys) {
  $$("[data-f]", root).forEach((el) => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
    f[el.dataset.f] = el.value; f.page = 1; render();
    const again = $(`#stage [data-f="${el.dataset.f}"]`);
    if (again && el.tagName === "INPUT") { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  }));
  $$("[data-freset]", root).forEach((b) => b.addEventListener("click", () => { keys.forEach((k) => (f[k] = k === "q" ? "" : "all")); f.page = 1; render(); }));
}
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const appBar = (who, tabs = "") => `<header class="app-bar"><img class="logo-img" src="logo-yodan.png" alt="YODAN">${tabs}<div class="spacer"></div>
  <div class="who"><span class="role-pill">${who}</span></div></header>`;

/* =====================================================================
 * Profil YODAN
 * ===================================================================== */
function renderYodan(root) {
  const y = state.yodan;
  if (y.view === "list") return renderCampaigns(root);
  const c = db.campaigns.find((x) => x.id === y.cid);
  const st = statsOf(c.id);
  root.append(h(`<div>${appBar("Admin Yodan")}<div class="page">
    <button type="button" class="btn btn-ghost btn-sm" data-act="back">← Toutes les campagnes</button>
    <div class="page-head"><div><span class="kicker">${esc(COMPANY.name)} · campagne ${esc(c.code)} · ${c.open ? "en cours" : "clôturée"}</span><h1 class="display">${esc(c.name)}</h1>
      <p class="muted small">Créée le ${c.created} · liens valables jusqu'au ${c.expires} · domaines autorisés : ${c.domains.map((d) => `<strong>@${esc(d)}</strong>`).join(", ")}<br>
      Prise en charge proposée par l'entreprise : ${c.pec ? `<span class="pill vert">Oui</span>` : `<span class="pill gris">Non</span>`}</p></div>
      <div class="seg" role="tablist">
        <button type="button" role="tab" class="${y.tab === "diffusion" ? "on" : ""}" data-act="tab" data-v="diffusion">1. Diffusion</button>
        <button type="button" role="tab" class="${y.tab === "resultats" ? "on" : ""}" data-act="tab" data-v="resultats">2. Participants & résultats</button>
      </div></div>
    <div class="grid-4 kpis" style="margin-bottom:1rem">
      ${kpi(st.total, "personnes invitées / inscrites")}${kpi(st.done, "bilans terminés", (st.done / st.total) * 100)}
      ${kpi(db.people[c.id].filter((p) => p.status === "INVITE" || p.status === "VERIFIE").length, "en attente")}
      ${c.pec ? kpi(db.people[c.id].filter((p) => p.accomp === "OUI").length, "employés d'accord pour un accompagnement") : kpi("—", "prise en charge non proposée")}
    </div>
    <div id="tab"></div></div></div>`));
  bind(root, {
    back: () => { y.view = "list"; render(); },
    tab: (b) => { y.tab = b.dataset.v; y.sel.clear(); y.pf.page = 1; render(); },
  });
  (y.tab === "diffusion" ? renderDiffusion : renderResults)($("#tab", root), c);
}
const kpi = (v, l, pct) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${l}</div>${pct != null ? `<div class="meter"><span style="width:${pct}%"></span></div>` : ""}</div>`;

const CF_KEYS = ["q", "etat", "mode", "pec"];
function renderCampaigns(root) {
  const f = state.yodan.cf;
  const list = db.campaigns.filter((c) =>
    (!f.q.trim() || norm(c.name + " " + c.code).includes(norm(f.q.trim()))) &&
    (f.etat === "all" || (f.etat === "open") === c.open) &&
    (f.mode === "all" || f.mode === c.mode) &&
    (f.pec === "all" || (f.pec === "oui") === c.pec));
  const { rows, pages } = paginate(list, f);
  root.append(h(`<div>${appBar("Admin Yodan")}<div class="page">
    <div class="page-head"><div><span class="kicker">Yodan · ${esc(COMPANY.name)}</span><h1 class="display">Campagnes de bilan</h1>
      <p class="muted">Domaines e-mail autorisés pour toutes les campagnes : ${COMPANY.domains.map((d) => `<strong>@${esc(d)}</strong>`).join(", ")}</p></div>
      <button type="button" class="btn btn-primary" data-act="new">+ Nouvelle campagne</button></div>
    <div class="card">
      <div class="filters">${fSearch("q", "Rechercher une campagne…", f)}
        ${fSelect("etat", "État", [["all", "Tous les états"], ["open", "En cours"], ["closed", "Clôturées"]], f)}
        ${fSelect("mode", "Diffusion", [["all", "Toutes diffusions"], ["qr", "QR code collectif"], ["liens", "Liens individuels"]], f)}
        ${fSelect("pec", "Prise en charge", [["all", "Prise en charge : toutes"], ["oui", "Prise en charge proposée"], ["non", "Sans prise en charge"]], f)}
        ${filtersActive(f, CF_KEYS) ? `<button type="button" class="btn btn-ghost btn-sm" data-freset>Effacer les filtres</button>` : ""}</div>
      <div class="table-wrap"><table><thead><tr><th>Campagne</th><th>Diffusion</th><th class="hide-m">État</th><th>Participation</th><th class="hide-m">Prise en charge</th><th class="hide-m">Fin</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((c) => { const s = statsOf(c.id); return `<tr>
        <td><strong>${esc(c.name)}</strong><div class="small muted">${esc(c.code)}</div></td>
        <td>${c.mode === "qr" ? `<span class="pill bleu">QR code collectif</span>` : `<span class="pill gris">Liens individuels</span>`}</td>
        <td class="hide-m">${c.open ? `<span class="pill vert">En cours</span>` : `<span class="pill gris">Clôturée</span>`}</td>
        <td>${s.done} / ${s.total}<div class="meter" style="width:100px"><span style="width:${s.total ? (s.done / s.total) * 100 : 0}%"></span></div></td>
        <td class="hide-m small">${c.pec ? `Proposée · <strong>${db.people[c.id].filter((p) => p.accomp === "OUI").length}</strong> employé(s) d'accord` : `<span class="muted">Non proposée</span>`}</td>
        <td class="hide-m small">${c.expires}</td>
        <td><button type="button" class="btn btn-sm" data-act="open" data-id="${c.id}">Ouvrir</button></td></tr>`; }).join("")
        : `<tr><td colspan="7" class="empty">Aucune campagne ne correspond aux filtres.</td></tr>`}
      </tbody></table></div>
      ${pagerHtml(list.length, f, pages)}</div></div></div>`));
  bind(root, {
    open: (b) => {
      Object.assign(state.yodan, { view: "detail", cid: b.dataset.id, tab: "diffusion" });
      Object.assign(state.yodan.pf, { q: "", status: "all", profil: "all", accomp: "all", via: "all", page: 1 });
      state.yodan.sel.clear(); render();
    },
    new: () => newCampaign(),
  });
  bindFilters(root, f, CF_KEYS);
  bindPager(root, f);
}

function newCampaign() {
  let mode = "qr";
  modal("Nouvelle campagne", `
    <div class="field"><label for="nc-co">Nom de la campagne</label><input id="nc-co" value="Bilan T1 2027"></div>
    <p class="small muted">Entreprise : <strong>${esc(COMPANY.name)}</strong> · domaines autorisés : ${COMPANY.domains.map((d) => "@" + esc(d)).join(", ")} (réglage commun à toutes les campagnes).</p>
    <div class="field"><span class="lbl">Mode de diffusion</span><div class="option-cards">
      <button type="button" class="option-card on" data-m="qr"><strong>QR code collectif</strong><span class="small muted">Une affiche / un lien pour tous. Chacun s'identifie avec son e-mail pro + code.</span></button>
      <button type="button" class="option-card" data-m="liens"><strong>Liens individuels</strong><span class="small muted">Import CSV (nom, prénom, e-mail). Chacun reçoit son lien unique.</span></button>
    </div></div>
    <div class="field hidden" id="nc-csv"><label for="nc-file">Fichier CSV</label><input id="nc-file" type="file" accept=".csv"><div class="hint">Colonnes : nom, prenom, email</div></div>
    <div class="field"><label for="nc-exp">Validité des liens</label><select id="nc-exp"><option>7 jours</option><option selected>14 jours</option><option>30 jours</option></select></div>
    <div class="field"><label class="row" style="align-items:flex-start;gap:.5rem;font-weight:400"><input type="checkbox" id="nc-pec" checked style="margin-top:.3rem;width:auto">
      <span><strong>L'entreprise propose une prise en charge</strong><br><span class="small muted">Les employés en Vigilance ou À prendre en charge pourront indiquer s'ils sont d'accord pour être accompagnés (information indicative).</span></span></label></div>
    <div class="row end"><button type="button" class="btn" data-x>Annuler</button><button type="button" class="btn btn-primary" data-ok>Créer la campagne</button></div>`,
  (body, close) => {
    $$("[data-m]", body).forEach((b) => b.addEventListener("click", () => {
      mode = b.dataset.m; $$("[data-m]", body).forEach((x) => x.classList.toggle("on", x === b));
      $("#nc-csv", body).classList.toggle("hidden", mode !== "liens");
    }));
    $("[data-x]", body).addEventListener("click", close);
    $("[data-ok]", body).addEventListener("click", () => {
      const id = "c" + (db.campaigns.length + 1);
      db.campaigns.unshift({ id, name: $("#nc-co", body).value || "Nouvelle campagne", domains: COMPANY.domains, mode, created: "15/11/2026", expires: "29/11/2026", code: "T1-27", open: true, pec: $("#nc-pec", body).checked });
      db.people[id] = mode === "liens" ? ["Aya", "Koffi", "Mariam"].map((f, i) => ({ id: `g${i}`, name: `${f} Démo`, email: `${f.toLowerCase()}.demo@${COMPANY.domains[0]}`, status: "INVITE", profil: null, accomp: null, sent: false, via: "Lien individuel" })) : [{ id: "g0", name: "—", email: "(aucun inscrit)", status: "INVITE", profil: null, accomp: null, sent: false, via: "QR code" }];
      close(); Object.assign(state.yodan, { view: "detail", cid: id, tab: "diffusion" }); render(); toast("Campagne créée (simulation)");
    });
  });
}

function renderDiffusion(el, c) {
  const url = `https://bspa.yodan.exemple.test/c/${c.code.toLowerCase()}`;
  el.append(h(`<div class="grid-2">
    <div class="card"><h2>QR code de la campagne</h2>
      <p class="muted small">À afficher en salle de pause, intranet, réunion… Le QR code ne donne accès à rien seul : l'employé doit prouver qu'il possède une adresse <strong>@${esc(c.domains[0])}</strong>.</p>
      <div class="qr-box"><div class="qr">${qrSvg(c.code)}</div>
        <div class="stack" style="flex:1;min-width:180px"><div class="linkline">${url}</div>
          <div class="row"><button type="button" class="btn btn-sm" data-act="copy">Copier le lien</button>
          <button type="button" class="btn btn-sm" data-act="poster">Affiche PDF (A4)</button>
          <button type="button" class="btn btn-sm" data-act="png">QR en PNG</button></div></div></div>
      <div class="row" style="margin-top:1rem"><button type="button" class="btn btn-primary btn-sm" data-act="try">▶ Tester comme un employé</button></div>
    </div>
    <div class="card"><h2>Liens individuels</h2>
      <p class="muted small">Pour les personnes qu'on veut inviter nominativement. Chaque lien est unique, à usage unique, et pré-remplit l'adresse e-mail (le code OTP reste demandé).</p>
      <div class="field"><label for="one-mail">Inviter une personne</label><div class="row"><input id="one-mail" style="flex:1" placeholder="prenom.nom@${esc(c.domains[0])}"><button type="button" class="btn" data-act="one">Envoyer</button></div><div class="err hidden" id="one-err"></div></div>
      <div class="field"><span class="lbl">Inviter en lot</span><div class="row"><button type="button" class="btn" data-act="csv">Importer un CSV…</button><span class="small muted">nom, prenom, email</span></div></div>
      <div class="field"><span class="lbl">Relancer</span><div class="row"><button type="button" class="btn" data-act="remind">Relancer les ${db.people[c.id].filter((p) => p.status === "INVITE" || p.status === "VERIFIE").length} personnes en attente</button></div></div>
    </div></div>`));
  bind(el, {
    copy: () => toast("Lien copié"),
    poster: () => toast("Affiche PDF générée (simulation)"),
    png: () => toast("QR code téléchargé (simulation)"),
    try: () => { state.role = "employe"; Object.assign(state.emp, { step: "email", email: "", fromLink: false, page: 0, ans: {}, result: null, consent: false, accomp: null }); render(); },
    one: () => {
      const v = $("#one-mail", el).value.trim(), err = $("#one-err", el);
      const ok = c.domains.some((d) => v.toLowerCase().endsWith("@" + d));
      err.classList.toggle("hidden", ok);
      if (!ok) { err.textContent = `Adresse refusée : le domaine doit être ${c.domains.map((d) => "@" + d).join(" ou ")}.`; return; }
      db.people[c.id].unshift({ id: "n" + Date.now(), name: v.split("@")[0], email: v, status: "INVITE", profil: null, sent: false, via: "Lien individuel" });
      toast(`Lien unique envoyé à ${esc(v)}`); render();
    },
    csv: () => modal("Import CSV", `<p>Aperçu du fichier <strong>liste-demo.csv</strong> :</p>
      <table><thead><tr><th>Nom</th><th>Prénom</th><th>E-mail</th><th></th></tr></thead><tbody>
      <tr><td>Démo</td><td>Inès</td><td>ines.demo@${esc(c.domains[0])}</td><td><span class="pill vert">OK</span></td></tr>
      <tr><td>Démo</td><td>Jules</td><td>jules.demo@${esc(c.domains[0])}</td><td><span class="pill vert">OK</span></td></tr>
      <tr><td>Test</td><td>Léa</td><td>lea.test@gmail.exemple.test</td><td><span class="pill rouge">Domaine refusé</span></td></tr></tbody></table>
      <p class="small muted" style="margin-top:.6rem">Les lignes refusées ne sont pas importées et sont listées dans un rapport.</p>
      <div class="row end"><button type="button" class="btn btn-primary" data-ok>Importer 2 personnes et envoyer les liens</button></div>`,
      (b, close) => $("[data-ok]", b).addEventListener("click", () => {
        ["Inès", "Jules"].forEach((f) => db.people[c.id].unshift({ id: "n" + f, name: `${f} Démo`, email: `${f.toLowerCase().replace("è", "e")}.demo@${c.domains[0]}`, status: "INVITE", profil: null, sent: false, via: "Lien individuel" }));
        close(); toast("2 liens envoyés"); render();
      })),
    remind: () => toast("Relance envoyée (simulation)"),
  });
}

const PF_KEYS = ["q", "status", "profil", "accomp", "via"];
/** Valeur d'accompagnement d'une ligne : OUI / NON / SANS (proposé, pas de réponse) / NA (non proposé). */
const accompOf = (p, c) => p.accomp || (c.pec && p.status === "TERMINE" && p.profil && p.profil !== "VERT" ? "SANS" : "NA");
function renderResults(el, c) {
  const y = state.yodan, f = y.pf;
  const people = db.people[c.id];
  const filtered = people.filter((p) =>
    (!f.q.trim() || norm(p.name + " " + p.email).includes(norm(f.q.trim()))) &&
    (f.status === "all" || p.status === f.status) &&
    (f.profil === "all" || (f.profil === "none" ? !p.profil : p.profil === f.profil)) &&
    (f.accomp === "all" || accompOf(p, c) === f.accomp) &&
    (f.via === "all" || p.via === f.via));
  const { rows, pages } = paginate(filtered, f);
  const done = filtered.filter((p) => p.status === "TERMINE");
  const pageDone = rows.filter((p) => p.status === "TERMINE");
  const sel = [...y.sel].map((id) => people.find((p) => p.id === id)).filter(Boolean);
  el.append(h(`<div class="card">
    <div class="filters">${fSearch("q", "Nom ou e-mail…", f)}
      ${fSelect("status", "Statut", [["all", "Tous les statuts"], ...Object.entries(STATUS_PILL).map(([k, [, l]]) => [k, l])], f)}
      ${fSelect("profil", "Profil", [["all", "Tous les profils"], ["VERT", "Satisfaisant"], ["ORANGE", "Vigilance"], ["ROUGE", "À prendre en charge"], ["none", "Pas encore de profil"]], f)}
      ${c.pec ? fSelect("accomp", "Accompagnement", [["all", "Accompagnement : tous"], ["OUI", "D'accord"], ["NON", "Pas d'accord"], ["SANS", "Sans réponse"], ["NA", "Non concerné"]], f) : ""}
      ${fSelect("via", "Arrivée par", [["all", "QR code et liens"], ["QR code", "QR code"], ["Lien individuel", "Lien individuel"]], f)}
      ${filtersActive(f, PF_KEYS) ? `<button type="button" class="btn btn-ghost btn-sm" data-freset>Effacer les filtres</button>` : ""}</div>
    <div class="toolbar"><span class="count">${sel.length ? `${sel.length} sélectionné(s)` : "Aucune sélection"}</span>
      <button type="button" class="btn btn-sm" data-act="selDone" ${done.length ? "" : "disabled"}>Sélectionner les ${done.length} terminés${filtersActive(f, PF_KEYS) ? " (filtrés)" : ""}</button>
      ${sel.length ? `<button type="button" class="btn btn-ghost btn-sm" data-act="selNone">Tout désélectionner</button>` : ""}
      <span style="flex:1"></span>
      <button type="button" class="btn btn-sm btn-primary" data-act="sendRes" ${sel.length ? "" : "disabled"}>✉ Envoyer les résultats</button>
      <button type="button" class="btn btn-sm" data-act="pdf" ${sel.length ? "" : "disabled"}>⬇ PDF ${sel.length > 1 ? "(ZIP)" : ""}</button>
      <button type="button" class="btn btn-sm" data-act="xlsx">⬇ Export XLSX</button></div>
    <div class="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Sélectionner les terminés de cette page" data-act="all" data-ev="change" ${pageDone.length && pageDone.every((p) => y.sel.has(p.id)) ? "checked" : ""}></th><th>Personne</th><th class="hide-m">Arrivée par</th><th>Statut</th><th>Profil</th><th>Accompagnement</th><th class="hide-m">Résultat envoyé</th><th></th></tr></thead><tbody>
    ${rows.length ? "" : `<tr><td colspan="8" class="empty">Aucune personne ne correspond aux filtres.</td></tr>`}
    ${rows.map((p) => { const [cls, lbl] = STATUS_PILL[p.status]; const can = p.status === "TERMINE"; return `<tr class="${y.sel.has(p.id) ? "sel" : ""}">
      <td><input type="checkbox" aria-label="Sélectionner ${esc(p.name)}" data-act="pick" data-ev="change" data-id="${p.id}" ${y.sel.has(p.id) ? "checked" : ""} ${can ? "" : "disabled"}></td>
      <td><strong>${esc(p.name)}</strong><div class="small muted">${esc(p.email)}</div></td>
      <td class="hide-m small">${p.via}</td>
      <td><span class="pill ${cls}">${lbl}</span></td>
      <td>${p.profil ? `<span class="pill ${ZONE_CLS[p.profil]}">${ZONE_LABEL[p.profil]}</span>` : `<span class="muted">—</span>`}</td>
      <td>${{ OUI: `<span class="pill vert">D'accord</span>`, NON: `<span class="pill gris">Pas d'accord</span>`, SANS: `<span class="small muted">Sans réponse</span>`, NA: `<span class="muted">—</span>` }[accompOf(p, c)]}</td>
      <td class="hide-m">${p.sent ? "✓" : can ? "<span class='muted'>Non</span>" : ""}</td>
      <td style="white-space:nowrap">${can ? `<button type="button" class="btn btn-sm" data-act="one" data-id="${p.id}" title="Envoyer le résultat">✉</button> <button type="button" class="btn btn-sm" data-act="onepdf" data-id="${p.id}" title="Télécharger le PDF">PDF</button>`
        : `<button type="button" class="btn btn-sm" data-act="resend" data-id="${p.id}">Renvoyer le lien</button>`}</td></tr>`; }).join("")}
    </tbody></table></div>
    ${pagerHtml(filtered.length, f, pages, [10, 25, 50])}</div>`));
  const sendTo = (list) => modal("Envoyer les résultats", `
    <p>${list.length} personne(s) vont recevoir un e-mail <strong>neutre</strong> les invitant à consulter leur bilan.</p>
    <div class="mail"><div class="mail-head"><div><strong>Objet :</strong> Votre bilan est disponible</div><div><strong>À :</strong> ${esc(list[0].email)}${list.length > 1 ? ` + ${list.length - 1} autre(s)` : ""}</div></div>
    <div class="mail-body small">Bonjour,<br>Votre bilan de santé psychologique est disponible dans votre espace sécurisé. Pour le consulter, cliquez sur le lien ci-dessous puis saisissez le code reçu par e-mail.<br><br><span class="btn btn-primary btn-sm">Consulter mon bilan</span></div></div>
    <p class="small muted" style="margin-top:.6rem">Aucun score ni profil dans l'e-mail, pas de PDF en pièce jointe.</p>
    <div class="row end"><button type="button" class="btn btn-primary" data-ok>Envoyer</button></div>`,
  (b, close) => $("[data-ok]", b).addEventListener("click", () => { list.forEach((p) => (p.sent = true)); y.sel.clear(); close(); toast(`${list.length} e-mail(s) envoyé(s)`); render(); }));
  bind(el, {
    pick: (b) => { b.checked ? y.sel.add(b.dataset.id) : y.sel.delete(b.dataset.id); render(); },
    all: (b) => { pageDone.forEach((p) => (b.checked ? y.sel.add(p.id) : y.sel.delete(p.id))); render(); },
    selDone: () => { done.forEach((p) => y.sel.add(p.id)); render(); },
    selNone: () => { y.sel.clear(); render(); },
    sendRes: () => sendTo(sel),
    one: (b) => sendTo([people.find((p) => p.id === b.dataset.id)]),
    pdf: () => toast(sel.length > 1 ? `ZIP de ${sel.length} PDF téléchargé (simulation)` : "PDF téléchargé (simulation)"),
    onepdf: () => toast("PDF téléchargé (simulation)"),
    xlsx: () => toast("Export XLSX téléchargé (simulation)"),
    resend: () => toast("Nouveau lien envoyé (l'ancien est désactivé)"),
  });
  bindFilters(el, f, PF_KEYS);
  bindPager(el, f);
}

/* =====================================================================
 * Profil ENTREPRISE — tableau de bord agrégé
 * ===================================================================== */
const MIN_GROUP = 5;
/** Statistiques agrégées fictives par campagne (côté RH, jamais de ligne individuelle). */
const DASH = {
  c1: { invited: 48, n: 36, prof: [20, 12, 4], dims: { A: 64, B: 41, C: 38, D: 58, E: 22 }, accomp: 7, left: "11 j restants",
    by: {
      tranche_age: [["18-25 ans", [2, 1, 0]], ["26-35 ans", [8, 4, 2]], ["36-45 ans", [6, 4, 1]], ["46-55 ans", [3, 2, 1]], ["56 ans et +", [1, 1, 0]]],
      genre: [["Femme", [10, 5, 2]], ["Homme", [9, 5, 2]], ["Non précisé", [1, 2, 0]]],
      anciennete: [["Moins d'1 an", [3, 1, 0]], ["1 à 5 ans", [8, 5, 2]], ["6 à 10 ans", [5, 3, 2]], ["Plus de 10 ans", [4, 3, 0]]],
    } },
  c2: { invited: 45, n: 31, prof: [14, 11, 6], dims: { A: 58, B: 47, C: 44, D: 54, E: 28 }, accomp: 8, left: "Clôturée",
    by: {
      tranche_age: [["18-25 ans", [1, 1, 1]], ["26-35 ans", [6, 4, 2]], ["36-45 ans", [4, 4, 2]], ["46-55 ans", [2, 2, 1]], ["56 ans et +", [1, 0, 0]]],
      genre: [["Femme", [7, 6, 3]], ["Homme", [7, 4, 3]], ["Non précisé", [0, 1, 0]]],
      anciennete: [["Moins d'1 an", [2, 1, 0]], ["1 à 5 ans", [6, 5, 3]], ["6 à 10 ans", [4, 3, 2]], ["Plus de 10 ans", [2, 2, 1]]],
    } },
};
// Statistiques fictives des campagnes passées : variantes de c2.
["c3", "c4", "c5", "c6", "c7"].forEach((id, k) => {
  const shift = (arr) => arr.map((x, i) => Math.max(0, x + ((i + k) % 3) - 1));
  const by = Object.fromEntries(Object.entries(DASH.c2.by).map(([g, rows]) => [g, rows.map(([l, z]) => [l, shift(z)])]));
  const prof = [0, 1, 2].map((i) => Object.values(by)[0].reduce((s, [, z]) => s + z[i], 0));
  const n = prof[0] + prof[1] + prof[2];
  const c = db.campaigns.find((x) => x.id === id);
  DASH[id] = { invited: n + 10 + k * 2, n, prof, dims: { A: 55 + k * 2, B: 50 - k, C: 46 - k, D: 52 + k, E: 30 - k }, accomp: c.pec ? Math.round((prof[1] + prof[2]) / 2) : 0, left: "Clôturée", by };
});
/** « Toutes les campagnes » : sommes, et moyennes pondérées par le nombre de répondants. */
function dashFor(cid) {
  const ids = cid === "all" ? Object.keys(DASH) : [cid];
  const ds = ids.map((k) => DASH[k] || { invited: 0, n: 0, prof: [0, 0, 0], dims: { A: 0, B: 0, C: 0, D: 0, E: 0 }, accomp: 0, left: "En cours", by: { tranche_age: [], genre: [], anciennete: [] } });
  const n = ds.reduce((s, d) => s + d.n, 0);
  const sum3 = (arrs) => arrs.reduce((s, a) => s.map((x, i) => x + a[i]), [0, 0, 0]);
  const by = {};
  Object.keys(DASH.c1.by).forEach((k) => {
    by[k] = DASH.c1.by[k].map(([lbl], i) => [lbl, sum3(ds.map((d) => d.by[k][i]?.[1] || [0, 0, 0]))]);
  });
  return {
    invited: ds.reduce((s, d) => s + d.invited, 0), n,
    prof: sum3(ds.map((d) => d.prof)),
    dims: Object.fromEntries(["A", "B", "C", "D", "E"].map((k) => [k, n ? Math.round(ds.reduce((s, d) => s + d.dims[k] * d.n, 0) / n) : 0])),
    accomp: ds.reduce((s, d) => s + d.accomp, 0),
    left: cid === "all" ? `${db.campaigns.length} campagnes` : ds[0].left, by,
  };
}
const dimZone = (k, v) => (k === "A" || k === "D" ? (v >= 68 ? "VERT" : v >= 51 ? "ORANGE" : "ROUGE") : v <= 45 ? "VERT" : v <= 65 ? "ORANGE" : "ROUGE");
function renderEntreprise(root) {
  const ent = state.ent;
  const D = dashFor(ent.cid);
  const tot = D.prof, n = D.n, invited = D.invited;
  const camp = db.campaigns.find((c) => c.id === ent.cid);
  const bar = ([v, o, r], total) => `<div class="stack-bar" role="img" aria-label="${v} satisfaisant, ${o} vigilance, ${r} à prendre en charge">
    ${[["vert", v], ["orange", o], ["rouge", r]].map(([c, x]) => `<div class="${c}" style="width:${(x / total) * 100}%">${Math.round((x / total) * 100)}%</div>`).join("")}</div>`;
  const dims = ["A", "B", "C", "D", "E"].map((k) => [k, D.dims[k], dimZone(k, D.dims[k])]);
  const by = ent.by;
  const empty = n < MIN_GROUP;
  root.append(h(`<div>${appBar("RH · " + esc(COMPANY.name))}<div class="page">
    <div class="page-head"><div><span class="kicker">Tableau de bord · ${camp ? `${esc(camp.name)} (${camp.open ? "en cours" : "clôturée"})` : "toutes les campagnes"}</span><h1 class="display">Santé psychologique de vos équipes</h1>
      <p class="muted">Résultats <strong>agrégés et anonymes</strong>. Aucun résultat individuel n'est visible ici.</p></div>
      <div class="row"><div class="field" style="margin:0"><label for="f-camp" class="small">Campagne</label>
        <select id="f-camp" data-act="camp" data-ev="change" style="min-width:220px">
          <option value="all" ${ent.cid === "all" ? "selected" : ""}>Toutes les campagnes</option>
          ${db.campaigns.map((c) => `<option value="${c.id}" ${ent.cid === c.id ? "selected" : ""}>${esc(c.name)}${c.open ? " · en cours" : ""}</option>`).join("")}</select></div>
        <button type="button" class="btn" data-act="pdf" style="align-self:flex-end">⬇ Rapport PDF</button></div></div>
    <div class="grid-4 kpis" style="margin-bottom:1rem">${kpi(invited, "salariés invités")}${kpi(n, "bilans terminés")}${kpi((invited ? Math.round((n / invited) * 100) : 0) + " %", "taux de participation", invited ? (n / invited) * 100 : 0)}${kpi(D.left.split(" ")[0], D.left.split(" ").slice(1).join(" ") || "&nbsp;")}</div>
    ${empty ? `<div class="card"><div class="masked">🔒 Moins de ${MIN_GROUP} bilans terminés pour cette campagne : les résultats s'afficheront dès qu'il y en aura assez pour garantir l'anonymat.</div></div>` : `
    <div class="grid-2">
      <div class="card"><h2>Répartition des profils</h2><p class="small muted">${n} répondants</p>${bar(tot, n)}
        <div class="legend"><span><i style="background:var(--vert)"></i>Satisfaisant</span><span><i style="background:var(--orange)"></i>Vigilance</span><span><i style="background:var(--rouge)"></i>À prendre en charge</span></div></div>
      <div class="card"><h2>Moyennes par dimension</h2><p class="small muted">0 à 100 · plus la barre est longue, plus le score est élevé</p>
        ${dims.map(([k, v, z]) => `<div class="dim-row"><span>${DIM_LABEL[k]}</span><div class="meter"><span style="width:${v}%;background:var(--${ZONE_CLS[z]})"></span></div><span class="pill ${ZONE_CLS[z]}">${v}</span></div>`).join("")}</div>
    </div>
    <div class="card" style="margin-top:1rem"><div class="row between"><h2>Par groupe</h2>
      <div class="seg">${[["tranche_age", "Âge"], ["genre", "Genre"], ["anciennete", "Ancienneté"]].map(([k, l]) => `<button type="button" class="${by === k ? "on" : ""}" data-act="by" data-v="${k}">${l}</button>`).join("")}</div></div>
      <p class="small muted">Un groupe de moins de ${MIN_GROUP} répondants est masqué pour qu'on ne puisse reconnaître personne.</p>
      <div class="stack">${D.by[by].map(([lbl, z]) => { const cnt = z[0] + z[1] + z[2]; return `<div><div class="row between small"><strong>${lbl}</strong><span class="muted">${cnt >= MIN_GROUP ? cnt + " répondants" : "moins de " + MIN_GROUP}</span></div>
        ${cnt >= MIN_GROUP ? bar(z, cnt) : `<div class="masked">🔒 Groupe trop petit pour être affiché</div>`}</div>`; }).join("")}</div></div>
    ${ent.cid === "all" ? (() => { const cmpList = db.campaigns.filter((c) => DASH[c.id] && DASH[c.id].n >= MIN_GROUP); const { rows, pages } = paginate(cmpList, ent.cmp); return `<div class="card" id="cmp" style="margin-top:1rem"><h2>Comparaison des campagnes</h2><div class="table-wrap"><table>
      <thead><tr><th>Campagne</th><th>Participation</th><th>Satisfaisant</th><th>Vigilance</th><th>À prendre en charge</th><th class="hide-m">Bien-être moyen</th><th></th></tr></thead><tbody>
      ${rows.map((c) => { const d = DASH[c.id], pc = (x) => Math.round((x / d.n) * 100) + " %"; return `<tr>
        <td><strong>${esc(c.name)}</strong><div class="small muted">${c.created} → ${c.expires}</div></td>
        <td>${Math.round((d.n / d.invited) * 100)} %</td><td>${pc(d.prof[0])}</td><td>${pc(d.prof[1])}</td><td>${pc(d.prof[2])}</td><td class="hide-m">${d.dims.A}</td>        <td><button type="button" class="btn btn-sm" data-act="camp1" data-id="${c.id}">Voir</button></td></tr>`; }).join("")}
      </tbody></table></div>${pagerHtml(cmpList.length, ent.cmp, pages)}</div>`; })() : ""}`}
  </div></div>`));
  bind(root, {
    by: (b) => { ent.by = b.dataset.v; render(); },
    camp: (s) => { ent.cid = s.value; render(); },
    camp1: (b) => { ent.cid = b.dataset.id; render(); window.scrollTo(0, 0); },
    pdf: () => toast("Rapport agrégé téléchargé (simulation)"),
  });
  if ($("#cmp", root)) bindPager($("#cmp", root), ent.cmp);
}

/* =====================================================================
 * Profil EMPLOYÉ
 * ===================================================================== */
const CAMPAIGN = db.campaigns[0];
const FAKE_OTP = "482913";
const EMP_STEPS = [["email", "E-mail"], ["otp", "Code"], ["form", "Questionnaire"], ["done", "Résultat"]];
function empShell(root, title, sub, body) {
  const order = ["email", "otp", "form", "done", "mail", "bilan"];
  const idx = Math.min(order.indexOf(state.emp.step), 3);
  root.append(h(`<div class="emp-shell"><div class="emp-top"><img src="logo-yodan.png" alt="YODAN"><span class="conf">🔒 Confidentiel</span></div>
    <div class="emp-hero"><div class="stepper">${EMP_STEPS.map(([, l], k) => `<div class="${k < idx ? "done" : k === idx ? "on" : ""}"><div class="bar"></div><div class="lbl">${k + 1}. ${l}</div></div>`).join("")}</div>
      <h1 class="display">${title}</h1><p>${sub}</p></div>
    <div class="emp-main">${body}</div></div>`));
}
function randomFill() {
  const a = state.emp.ans;
  DEMO_FIELDS.forEach(([k, , ch]) => (a[k] = ch[Math.floor(Math.random() * ch.length)]));
  SECTIONS.forEach((s) => s.items.forEach((it, i) => (a[`${s.key}${i}`] = it.o[Math.floor(Math.random() * it.o.length)][0])));
  state.emp.consent = true;
}
function renderEmploye(root) {
  const e = state.emp;
  const go = (step) => { e.step = step; render(); $("#stage .phone-screen")?.scrollTo(0, 0); window.scrollTo(0, 0); };

  if (e.step === "email") {
    empShell(root, "Bilan de santé psychologique", `${esc(CAMPAIGN.name)} · proposé par ${esc(COMPANY.name)} avec YODAN · 8 à 10 minutes`, `
      <div class="card">
        <form id="f-mail" novalidate>
          <div class="field"><label for="mail">Votre adresse e-mail professionnelle</label>
            <input id="mail" type="email" autocomplete="email" inputmode="email" placeholder="prenom.nom@${CAMPAIGN.domains[0]}" value="${esc(e.email)}" ${e.fromLink ? "readonly" : ""} aria-describedby="mail-hint mail-err">
            <div class="hint" id="mail-hint">Nous vous envoyons un code à 6 chiffres pour vérifier que c'est bien vous.</div>
            <div class="err hidden" id="mail-err" role="alert"></div></div>
          <button class="btn btn-primary btn-block" type="submit">Recevoir mon code</button>
        </form>
        <p class="small muted" style="margin-top:.8rem">Essayez <strong>aya.demo@alpha.exemple.test</strong> (accepté) ou <strong>aya@gmail.exemple.test</strong> (refusé).</p>
      </div>
      <div class="card"><h3>Ce que voit votre employeur</h3><p class="small">Uniquement des statistiques globales et anonymes. <strong>Jamais vos réponses ni votre résultat.</strong></p></div>
      <p class="small muted" style="text-align:center;margin-top:1rem"><button type="button" class="btn btn-ghost btn-sm" data-act="link">Simuler l'ouverture d'un lien individuel</button></p>`);
    bind(root, { link: () => { e.email = "koffi.demo@alpha.exemple.test"; e.fromLink = true; render(); toast("Lien individuel : e-mail pré-rempli"); } });
    $("#f-mail", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = $("#mail", root).value.trim().toLowerCase(), err = $("#mail-err", root);
      let msg = "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = "Saisissez une adresse e-mail valide.";
      else if (!CAMPAIGN.domains.some((d) => v.endsWith("@" + d))) msg = `Cette adresse n'est pas reconnue pour ce bilan. Utilisez votre e-mail professionnel (@${CAMPAIGN.domains[0]}).`;
      err.textContent = msg; err.classList.toggle("hidden", !msg); $("#mail", root).setAttribute("aria-invalid", String(!!msg));
      if (!msg) { e.email = v; e.otpTries = 0; go("otp"); toast("Code envoyé (simulation)"); }
    });
    return;
  }

  if (e.step === "otp") {
    empShell(root, "Vérifiez votre e-mail", `Code envoyé à <strong>${esc(e.email)}</strong>`, `
      <div class="card">
        <div class="mailbox-hint">📬 <strong>Boîte mail simulée :</strong> « Votre code de vérification YODAN : <strong>${FAKE_OTP}</strong>. Il expire dans 10 minutes. »</div>
        <form id="f-otp" novalidate><div class="otp" role="group" aria-label="Code à 6 chiffres">
          ${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" aria-label="Chiffre ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : ""}>`).join("")}</div>
          <div class="err hidden" id="otp-err" role="alert" style="text-align:center"></div>
          <button class="btn btn-primary btn-block" type="submit">Valider</button></form>
        <div class="row between small" style="margin-top:.8rem"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← Changer d'adresse</button><button type="button" class="btn btn-ghost btn-sm" data-act="resend">Renvoyer le code</button></div>
      </div>`);
    const inputs = $$(".otp input", root);
    inputs.forEach((inp, i) => {
      inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); if (inp.value && inputs[i + 1]) inputs[i + 1].focus(); });
      inp.addEventListener("keydown", (ev) => { if (ev.key === "Backspace" && !inp.value && inputs[i - 1]) inputs[i - 1].focus(); });
      inp.addEventListener("paste", (ev) => { const d = (ev.clipboardData.getData("text").match(/\d/g) || []).slice(0, 6); if (d.length) { ev.preventDefault(); d.forEach((x, k) => (inputs[k].value = x)); inputs[Math.min(d.length, 5)].focus(); } });
    });
    inputs[0].focus();
    bind(root, { back: () => { e.fromLink = false; go("email"); }, resend: () => toast("Nouveau code envoyé — le précédent ne fonctionne plus") });
    $("#f-otp", root).addEventListener("submit", (ev) => {
      ev.preventDefault();
      const code = inputs.map((x) => x.value).join(""), err = $("#otp-err", root);
      if (code === FAKE_OTP) { e.page = 0; go("form"); return; }
      e.otpTries++;
      err.textContent = e.otpTries >= 5 ? "Trop d'essais. Demandez un nouveau code." : `Code incorrect. Il vous reste ${5 - e.otpTries} essai(s).`;
      err.classList.remove("hidden");
    });
    return;
  }

  if (e.step === "form") {
    const pages = [{ key: "INFO", short: "Vous" }, ...SECTIONS];
    const p = pages[e.page];
    const answered = Object.keys(e.ans).filter((k) => /^[A-E]\d$/.test(k)).length;
    const total = SECTIONS.reduce((s, x) => s + x.items.length, 0);
    let body;
    if (p.key === "INFO") {
      body = `<div class="card"><h2>Avant de commencer</h2>
        <p class="small">Il n'y a pas de bonne ou de mauvaise réponse : répondez selon ce que vous ressentez réellement.</p>
        ${DEMO_FIELDS.map(([k, l, ch]) => `<div class="field"><label for="d-${k}">${l}</label><select id="d-${k}" data-demo="${k}"><option value="">Choisir…</option>${ch.map((c) => `<option ${e.ans[k] === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>`).join("")}
        <label class="row" style="align-items:flex-start;gap:.5rem;margin-top:.4rem"><input type="checkbox" id="consent" ${e.consent ? "checked" : ""} style="margin-top:.3rem">
          <span class="small">J'accepte que mes réponses soient traitées par YODAN pour produire mon bilan personnel et des statistiques <strong>anonymes</strong> pour mon entreprise. Mes résultats individuels ne seront jamais transmis à mon employeur. <a href="#" data-act="policy">Politique de confidentialité (v1.2)</a></span></label>
        <div class="err hidden" id="form-err" role="alert"></div></div>`;
    } else {
      body = `<div class="card"><span class="kicker">Partie ${e.page} / ${SECTIONS.length} · ${p.short}</span><h2>${p.title}</h2>
        ${p.items.map((it, i) => { const name = `${p.key}${i}`; return `<fieldset class="q-block" data-q="${name}" style="border:0;margin:0;padding-left:0;padding-right:0"><legend class="q-text">${esc(it.t)}</legend>
          <div class="choices">${it.o.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(e.ans[name]) === String(v) ? "checked" : ""}>${l}</label>`).join("")}</div></fieldset>`; }).join("")}
        <div class="err hidden" id="form-err" role="alert"></div></div>`;
    }
    empShell(root, "Questionnaire", `${answered} / ${total} réponses · enregistré automatiquement`, `${body}
      <div class="row between" style="margin-top:1rem">
        <button type="button" class="btn" data-act="prev" ${e.page === 0 ? "disabled" : ""}>← Précédent</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="fill">Remplir au hasard (démo)</button>
        <button type="button" class="btn btn-primary" data-act="next">${e.page === pages.length - 1 ? "Envoyer mes réponses" : "Suivant →"}</button></div>`);
    $$("input[type=radio]", root).forEach((r) => r.addEventListener("change", () => { e.ans[r.name] = Number(r.value); r.closest(".q-block").classList.remove("missing"); }));
    $$("[data-demo]", root).forEach((s) => s.addEventListener("change", () => (e.ans[s.dataset.demo] = s.value)));
    $("#consent", root)?.addEventListener("change", (ev) => (e.consent = ev.target.checked));
    bind(root, {
      policy: (_, ev) => { ev.preventDefault(); toast("Politique de confidentialité (à rédiger)"); },
      prev: () => { e.page--; render(); },
      fill: () => { randomFill(); render(); },
      next: () => {
        const err = $("#form-err", root);
        let missing = [];
        if (p.key === "INFO") {
          missing = DEMO_FIELDS.filter(([k]) => !e.ans[k]).map(([, l]) => l);
          if (!e.consent) missing.push("le consentement");
        } else {
          $$(".q-block", root).forEach((q) => { const m = e.ans[q.dataset.q] == null; q.classList.toggle("missing", m); if (m) missing.push(q); });
        }
        if (missing.length) {
          err.textContent = p.key === "INFO" ? `Il manque : ${missing.join(", ")}.` : `${missing.length} question(s) sans réponse (en rouge).`;
          err.classList.remove("hidden"); return;
        }
        if (e.page < pages.length - 1) { e.page++; render(); $("#stage .phone-screen")?.scrollTo(0, 0); window.scrollTo(0, 0); }
        else { e.result = score(e.ans); go("done"); }
      },
    });
    return;
  }

  if (e.step === "done") {
    empShell(root, "Merci !", "Vos réponses sont enregistrées.", `
      <div class="card" style="text-align:center"><div style="font-size:2.4rem">✉️</div>
        <h2>Votre bilan vous a été envoyé</h2>
        <p class="small">Un e-mail a été envoyé à <strong>${esc(e.email)}</strong>. Il contient un lien sécurisé vers votre bilan.</p>
        <div class="row" style="justify-content:center;margin-top:.6rem"><button type="button" class="btn btn-primary" data-act="mail">Voir l'e-mail (simulation)</button><button type="button" class="btn" data-act="now">Voir mon bilan maintenant</button></div></div>
      <div class="card"><h3>Besoin de parler à quelqu'un ?</h3><p class="small">Centre d'écoute YODAN : <strong>+225 00 00 00 00</strong> (numéro fictif), du lundi au vendredi.</p></div>`);
    bind(root, { mail: () => go("mail"), now: () => go("bilan") });
    return;
  }

  if (e.step === "mail") {
    empShell(root, "Votre boîte mail", "Aperçu de l'e-mail reçu", `
      <div class="mail"><div class="mail-head"><div><strong>De :</strong> YODAN &lt;ne-pas-repondre@yodan.exemple.test&gt;</div><div><strong>À :</strong> ${esc(e.email)}</div><div><strong>Objet :</strong> Votre bilan est disponible</div></div>
        <div class="mail-body"><p>Bonjour,</p><p>Merci d'avoir pris le temps de répondre. Votre bilan de santé psychologique est disponible dans votre espace sécurisé.</p>
          <p><button type="button" class="btn btn-primary" data-act="open">Consulter mon bilan</button></p>
          <p class="small muted">Ce lien est personnel et valable 14 jours. Un code de vérification vous sera demandé à l'ouverture.</p></div></div>`);
    bind(root, { open: () => go("bilan") });
    return;
  }

  if (e.step === "bilan") {
    const r = e.result || score(e.ans);
    const reco = { VERT: "Aucune action particulière requise à ce stade.", ORANGE: "Une vigilance est recommandée ; un entretien de bilan est conseillé.", ROUGE: "Un entretien avec un professionnel est recommandé sans délai." }[r.profil];
    empShell(root, "Mon bilan", "Accès vérifié par code · visible par vous seul(e)", `
      <div class="result-head ${ZONE_CLS[r.profil]}"><span class="kicker" style="color:inherit">Profil global</span><div class="display">${ZONE_LABEL[r.profil]}</div><p style="margin:0">${reco}</p></div>
      <div class="card" style="margin-top:1rem"><h2>Vos 5 dimensions</h2>
        ${Object.entries(r.dims).map(([k, d]) => `<div class="dim-row"><span>${DIM_LABEL[k]}</span><div class="meter"><span style="width:${Math.round(d.pct)}%;background:var(--${ZONE_CLS[d.zone]})"></span></div><span class="pill ${ZONE_CLS[d.zone]}">${Math.round(d.pct)}</span></div>`).join("")}
        <p class="disclaimer" style="margin-top:.8rem">Ce test est un outil d'interprétation et ne permet pas d'établir un diagnostic. Parlez-en à un professionnel pour bénéficier d'une meilleure orientation.</p></div>
      ${CAMPAIGN.pec && r.profil !== "VERT" ? `<div class="card" id="accomp"><h3>Acceptez-vous d'être accompagné(e) ?</h3>
        <p class="small">Votre entreprise propose une prise en charge par un professionnel. Votre réponse nous indique si vous seriez d'accord ; elle ne vous engage à rien. Elle est transmise <strong>uniquement à l'équipe YODAN</strong>, jamais à votre employeur.</p>
        ${e.accomp ? `<p class="pill ${ACCOMP_PILL[e.accomp][0]}" style="margin:.2rem 0 .6rem">${e.accomp === "OUI" ? "✓ Vous avez indiqué être d'accord pour être accompagné(e)" : "Vous avez indiqué ne pas souhaiter d'accompagnement"}</p>
          <div><button type="button" class="btn btn-ghost btn-sm" data-act="accomp" data-v="${e.accomp === "OUI" ? "NON" : "OUI"}">${e.accomp === "OUI" ? "Finalement, je ne souhaite pas être accompagné(e)" : "J'ai changé d'avis, j'accepte d'être accompagné(e)"}</button></div>`
        : `<div class="row" role="group" aria-label="Accepter l'accompagnement"><button type="button" class="btn btn-primary" data-act="accomp" data-v="OUI">Oui, j'accepte</button><button type="button" class="btn" data-act="accomp" data-v="NON">Non merci</button></div>`}
        <p class="small muted" style="margin-top:.6rem">Vous pouvez changer d'avis à tout moment depuis le lien reçu par e-mail.</p></div>` : ""}
      <div class="row" style="margin-top:1rem"><button type="button" class="btn" data-act="pdf">⬇ Télécharger en PDF</button><button type="button" class="btn btn-ghost" data-act="restart">Recommencer la démo</button></div>`);
    bind(root, {
      pdf: () => toast("PDF téléchargé (simulation)"),
      accomp: (b) => {
        e.accomp = b.dataset.v;
        // Simulation : la décision apparaît dans « Participants & résultats » côté admin Yodan.
        const list = db.people[CAMPAIGN.id];
        let p = list.find((x) => x.email === e.email);
        if (!p) { p = { id: "e" + Date.now(), name: e.email.split("@")[0], email: e.email, sent: true, via: e.fromLink ? "Lien individuel" : "QR code" }; list.unshift(p); }
        Object.assign(p, { status: "TERMINE", profil: r.profil, accomp: e.accomp });
        toast("Votre réponse est enregistrée");
        render();
      },
      restart: () => { Object.assign(e, { step: "email", email: "", fromLink: false, page: 0, ans: {}, result: null, consent: false, accomp: null }); render(); },
    });
  }
}

/* =====================================================================
 * Notes UX
 * ===================================================================== */
const NOTES = {
  "yodan-list": {
    title: "Yodan · liste des campagnes",
    why: ["Une seule entreprise cliente pour l'instant : la liste montre ses campagnes (une ligne par période).", "Les <strong>domaines e-mail autorisés</strong> sont un réglage de l'entreprise, commun à toutes ses campagnes : c'est le losange « Email de l'entreprise ? » du diagramme.", "Colonne « Prise en charge » : l'entreprise la propose-t-elle sur cette campagne, et combien d'employés sont d'accord (information indicative).", "Filtres : recherche (nom / code), état, mode de diffusion, prise en charge. Pagination 5 / 10 / 25 par page ; les filtres ramènent à la page 1."],
    secu: ["Le domaine autorisé est le seul filtre d'accès pour le QR collectif : pas de domaine public type gmail."],
    q: ["Une campagne peut-elle mélanger QR collectif et liens individuels ? (la maquette l'autorise)", "Peut-on avoir deux campagnes en cours en même temps ? Si oui, quel QR l'employé doit-il utiliser ?", "Le modèle actuel (Patient / Evaluation) n'a pas de notion de campagne : à ajouter (table campaigns + evaluation.campaign_id). Prévoir dès maintenant un company_id pour l'arrivée d'autres entreprises ?"],
  },
  "yodan-diffusion": {
    title: "Yodan · diffusion (QR + liens)",
    why: ["Les deux modes du diagramme côte à côte : QR code unique de campagne (gauche) et liens uniques individuels ou en lot (droite).", "Affiche A4 prête à imprimer pour le QR.", "L'import CSV montre un aperçu et rejette les domaines non autorisés avant l'envoi.", "Bouton « Tester comme un employé » pour vérifier le parcours."],
    secu: ["Le QR code seul ne donne accès à rien : e-mail du domaine + code OTP obligatoires.", "Renvoyer un lien désactive le précédent (un seul lien valide à la fois).", "Limiter le nombre de demandes de code par adresse et par IP (rate_limit.py existe déjà)."],
    q: ["Que faire pour les salariés <strong>sans e-mail professionnel</strong> (terrain, usine) ? Pistes : code OTP par SMS, ou code de campagne + matricule.", "Le lien individuel doit-il aussi demander le code OTP ? (proposé : oui, pour éviter qu'un lien transféré donne accès)"],
  },
  "yodan-resultats": {
    title: "Yodan · participants & résultats",
    why: ["Sélection multiple → actions en lot (envoyer les résultats, PDF en ZIP, XLSX) ; boutons par ligne pour l'individuel.", "Seuls les bilans « Terminé » sont sélectionnables.", "Statuts du parcours : Invité → E-mail vérifié → Terminé (ou Lien expiré).", "Colonne <strong>Accompagnement</strong> (si l'entreprise propose une prise en charge) : D'accord / Pas d'accord / Sans réponse. Purement indicatif : aucune attribution de praticien dans l'app. Testez : parcours employé, répondez, puis revenez ici (ligne Aya Démo).", "Filtres : recherche nom / e-mail, statut, profil, accompagnement, arrivée par. Pagination 10 / 25 / 50.", "« Sélectionner les terminés » prend tous les résultats filtrés (toutes pages) ; la case d'en-tête ne prend que la page affichée."],
    secu: ["L'e-mail de résultat est <strong>neutre</strong> (« votre bilan est disponible ») : pas de score, pas de PDF joint (ISO 27799 — pas de donnée de santé dans les e-mails).", "Chaque export PDF/XLSX est journalisé (qui, quand, combien de dossiers).", "La colonne « Profil » est une donnée de santé individuelle."],
    q: ["Qui chez Yodan doit voir les colonnes Profil et Accompagnement ? Proposé : seulement un rôle praticien ; un rôle admin/technique ne voit que les statuts.", "Que fait-on des « Sans réponse » en Vigilance / À prendre en charge : une relance automatique ?", "Le diagramme dit « réception du résultat par email » : valider la version e-mail neutre + lien sécurisé.", "L'export XLSX doit-il être nominatif ou pseudonymisé ?"],
  },
  entreprise: {
    title: "Entreprise · tableau de bord",
    why: ["Filtre <strong>Campagne</strong> en haut à droite : « Toutes les campagnes » (par défaut) ou une campagne précise ; tout l'écran suit le filtre.", "Sur « Toutes », un tableau compare les campagnes entre elles (évolution dans le temps).", "Indicateurs de participation en haut : c'est ce que le RH pilote au quotidien.", "Répartition des profils + moyenne par dimension, sans jamais descendre à l'individu.", "Aucune information sur l'accord d'accompagnement des employés : c'est une indication pour YODAN, croisée avec l'accord de l'entreprise ; la prise en charge se décide et se fait en interne.","Tableau comparatif paginé (5 par page) ; « Voir » ouvre le détail de la campagne. Les campagnes de moins de 5 bilans n'y figurent pas."],
    secu: ["Règle non négociable 4.1.7 : <strong>aucune donnée individuelle</strong> côté employeur, ni qui a accepté un accompagnement.", "Seuil de 5 répondants : un groupe plus petit est masqué (essayez Âge : 18-25 ans et 56+). Une campagne entière avec moins de 5 bilans n'affiche rien (créez une campagne côté Yodan pour le voir).", "Attention au croisement de filtres (campagne × groupe) : le seuil s'applique au résultat final.", "Pas d'export de la liste des participants ni de qui a répondu."],
    q: ["Sur « Toutes les campagnes », une personne ayant répondu à 2 campagnes compte deux fois : acceptable, ou faut-il ne garder que son dernier bilan ?", "Accès RH : compte nominatif + MFA à prévoir."],
  },
  "emp-email": {
    title: "Employé · arrivée par QR code",
    why: ["Écran unique et court : une seule question (l'e-mail pro).", "Message rassurant sur ce que voit l'employeur, dès la première seconde.", "Erreur claire si le domaine n'est pas celui de l'entreprise (losange « Email de l'entreprise ? »).", "Avec un lien individuel, l'e-mail est pré-rempli et verrouillé."],
    secu: ["Ne pas révéler si une adresse existe déjà (message identique dans tous les cas après la vérification du domaine).", "Pas de donnée de santé ni de nom dans l'URL."],
    q: ["Le message de refus doit-il citer le domaine attendu ? (aide l'utilisateur, mais révèle le domaine à qui scanne l'affiche — risque faible)"],
  },
  "emp-otp": {
    title: "Employé · code OTP par e-mail",
    why: ["6 cases, avance automatique, collage du code accepté, autocomplete « one-time-code » (mobile).", "Lien « Changer d'adresse » si faute de frappe.", "Saisir <strong>482913</strong> pour continuer."],
    secu: ["OTP (mot de passe à usage unique) : code valable 10 min, 5 essais max, l'ancien code est invalidé au renvoi.", "Le code est stocké haché en base (le champ verification_code existe déjà dans Evaluation)."],
    q: ["Durée de validité du code : 10 min ?", "Après validation, combien de temps la session reste ouverte pour remplir ? (proposé : 30 min d'inactivité, réponses sauvegardées)"],
  },
  "emp-form": {
    title: "Employé · questionnaire",
    why: ["Une partie par écran (6 au total) au lieu d'une longue page : moins intimidant sur téléphone.", "Réponses en « pastilles » cliquables, grandes zones tactiles.", "Les questions sans réponse passent en rouge, avec un message en haut.", "Consentement au début, avec version de la politique (v1.2)."],
    secu: ["Consentement enregistré avec date, version du texte et périmètre (ISO 27701).", "Sauvegarde automatique côté serveur, pas dans le navigateur (téléphone partagé)."],
    q: ["Garder les 3 champs démographiques ? Le formulaire actuel demande aussi téléphone, poids, taille, maladie chronique : à quoi servent-ils ? (minimisation)", "Pouvoir reprendre plus tard via le même QR + code ?"],
  },
  "emp-done": {
    title: "Employé · confirmation",
    why: ["Confirmation immédiate + numéro du centre d'écoute toujours visible.", "Deux chemins : attendre l'e-mail, ou voir le bilan tout de suite (déjà authentifié)."],
    q: ["Afficher le bilan directement à l'écran, ou uniquement via l'e-mail ?"],
  },
  "emp-mail": {
    title: "Employé · e-mail reçu",
    why: ["Version conforme de « réception du résultat par email » : l'e-mail annonce le bilan sans le contenir."],
    secu: ["Un e-mail peut être lu par un tiers (boîte pro, messagerie partagée) : pas de profil, pas de score, pas de PDF en pièce jointe.", "Le lien est personnel, limité dans le temps, et redemande un code à l'ouverture."],
    q: ["Le comportement actuel (envoi du PDF par e-mail ?) est-il à modifier en conséquence ?"],
  },
  "emp-bilan": {
    title: "Employé · mon bilan",
    why: ["Profil global en gros, couleur + texte (pas seulement la couleur, pour l'accessibilité).", "5 dimensions en barres avec la même échelle 0-100.", "Avertissement « pas un diagnostic » repris de bspa_core.py.", "Si la campagne propose une prise en charge et que le profil est Vigilance ou À prendre en charge : « Acceptez-vous d'être accompagné(e) ? » (Oui / Non). Réponse indicative, visible côté admin Yodan ; aucune promesse de rappel dans l'app. Choix modifiable."],
    secu: ["Chaque consultation du bilan est journalisée (accès en lecture, ISO 27799).", "La réponse à l'accompagnement est un <strong>consentement</strong> : enregistré avec la date et le texte affiché, retirable aussi simplement (ISO 27701).", "Cette décision n'est jamais visible par l'employeur.", "Calcul simplifié dans la maquette : les vrais seuils restent ceux de bspa_core.py (relancez « Remplir au hasard » si le profil est Satisfaisant)."],
    q: ["Proposer aussi l'accompagnement aux profils Satisfaisant ?", "Que dit-on à l'employé sur la suite après un « Oui » ? (la maquette ne promet rien : à aligner avec le processus hors app)", "Afficher les scores chiffrés à l'employé, ou seulement les zones ?", "Garder la mention de l'application LAMIFI ?"],
  },
};

/* =====================================================================
 * Démarrage
 * ===================================================================== */
$("#role-switch").innerHTML = ROLES.map((r) => `<button type="button" data-role="${r.id}">${r.label}</button>`).join("");
$("#role-select").innerHTML = ROLES.map((r) => `<option value="${r.id}">${r.label}</option>`).join("");
$$("#role-switch button").forEach((b) => b.addEventListener("click", () => { state.role = b.dataset.role; render(); }));
$("#role-select").addEventListener("change", (e) => { state.role = e.target.value; render(); });
$$(".device-switch button").forEach((b) => b.addEventListener("click", () => { state.device = b.dataset.device; render(); }));
$("#notes-toggle").addEventListener("click", () => setNotes(!state.notes));
const measureBar = () => document.documentElement.style.setProperty("--bar-h", $("#mock-bar").offsetHeight + "px");
window.addEventListener("resize", measureBar);
if (matchMedia("(max-width: 760px)").matches) { state.device = "mobile"; setNotes(false); }
measureBar();
render();
