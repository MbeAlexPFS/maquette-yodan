/*
 * ui.js : cadre de la maquette (barre, PC / mobile, notes UX), page de connexion commune,
 * barre d'outils de démo (horloge simulée + boîte e-mail simulée).
 */
"use strict";

/* =====================================================================
 * Petits composants
 * ===================================================================== */
function toast(msg) {
  const el = document.createElement("div");
  el.innerHTML = msg;
  $("#toast").append(el);
  setTimeout(() => el.remove(), 3800);
}
function bind(root, handlers, evt = "click") {
  $$(`[data-act]`, root).forEach((el) => {
    const fn = handlers[el.dataset.act];
    if (fn) el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" || el.type === "radio" ? "change" : evt, (e) => { if (el.tagName === "BUTTON" || el.tagName === "A") e.preventDefault(); fn(el, e); });
  });
}
/** Fenêtre modale accessible (Échap ferme, focus sur le 1er champ). */
function modal(title, html, onMount, wide = false) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button type="button" aria-label="Fermer">×</button></div><div class="modal-body">${html}</div></div>`;
  document.body.append(back);
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  $(".modal-head button", back).addEventListener("click", close);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  const body = $(".modal-body", back);
  onMount?.(body, close);
  ($("input:not([type=hidden]), select, textarea", body) || $(".modal-head button", back)).focus();
  return close;
}
const pill = ([cls, label]) => `<span class="pill ${cls}">${esc(label)}</span>`;
const statusPill = (pt) => pill(PEC_STATUS[patientStatus(pt)]);
const zonePill = (z) => `<span class="pill ${{ VERT: "vert", ORANGE: "jaune", ROUGE: "rouge" }[z]}">${ZONE_LABEL[z]}</span>`;
const yodanLogo = (sub = "") => `<span class="brand"><img class="logo-img" src="logo-yodan.png?v=1" alt="YODAN">${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span>`;
const errBox = (e, k) => `<div class="err" id="err-${k}">${esc(e?.[k] || "")}</div>`;

/* =====================================================================
 * État de l'interface et navigation
 * ===================================================================== */
const SPACES = [
  { id: "login", label: "Connexion" },
  { id: "lamifi", label: "Admin LAMIFI Business" },
  { id: "yodan", label: "Admin Yodan" },
  { id: "console", label: "Console" },
  { id: "partner", label: "Espace partenaire" },
  { id: "praticien", label: "Praticien" },
  { id: "public", label: "Patient / participant" },
];
const ui = {
  space: "login", partnerId: null, role: null, tabs: {}, device: "pc", notes: true,
  auth: { screen: "login", email: "", identityId: null, challengeId: null, purpose: "LOGIN", err: "", info: "" },
};
const RENDER = {};
const isMobile = () => ui.device === "mobile";
const tabOf = (key, fallback) => ui.tabs[key] || fallback;
function setTab(key, tab) { ui.tabs[key] = tab; render(); scrollTopStage(); }
function scrollTopStage() { $("#stage .phone-screen")?.scrollTo(0, 0); window.scrollTo(0, 0); }

/** Accès direct par la barre de maquette (sans connexion) : pratique pour la démo. */
function go(space, opts = {}) {
  ui.space = space;
  if (space === "public") { ui.partnerId = opts.partnerId || ui.partnerId || db.partners[0].id; }
  if (space === "lamifi") ui.lamifiPartner = null;
  if (space === "partner") {
    ui.partnerId = opts.partnerId || ui.partnerId || db.partners[0].id;
    const p = partnerOf(ui.partnerId);
    ui.role = opts.role && p.roles[opts.role]?.on ? opts.role : (p.roles[ui.role]?.on ? ui.role : highestRole(p));
  }
  if (space === "login" && !opts.keepAuth) resetAuth();
  $$(".modal-back").forEach((m) => m.remove());
  render();
  scrollTopStage();
}
/** Barre de maquette : ferme la session en cours (sans message) pour un accès direct de démo. */
function directAccess(space, opts = {}) {
  if (session.identityId) { audit("Déconnexion", "accès direct démo"); session.identityId = null; }
  go(space, opts);
}
function resetAuth(info = "") { Object.assign(ui.auth, { screen: "login", identityId: null, challengeId: null, purpose: "LOGIN", err: "", info }); }

function render() {
  renderMockBar();
  const stage = $("#stage");
  let root = stage;
  if (isMobile()) {
    stage.innerHTML = `<div class="phone-wrap"><div class="phone"><div class="phone-screen is-mobile" id="screen"></div></div></div>`;
    root = $("#screen");
  } else stage.innerHTML = "";
  RENDER[ui.space](root);
  renderNotes();
  renderDemoBadge();
}
function renderMockBar() {
  $("#role-switch").innerHTML = SPACES.map((s) => `<button type="button" data-space="${s.id}" class="${ui.space === s.id ? "active" : ""}">${esc(s.label)}</button>`).join("");
  $$("#role-switch [data-space]").forEach((b) => b.addEventListener("click", () => directAccess(b.dataset.space)));
  $("#role-select").innerHTML = SPACES.map((s) => `<option value="${s.id}" ${ui.space === s.id ? "selected" : ""}>${esc(s.label)}</option>`).join("");
  const showP = ui.space === "partner", showPub = ui.space === "public";
  const ps = $("#partner-select"), rs = $("#prole-select");
  ps.hidden = !(showP || showPub); rs.hidden = !showP;
  if (showPub) ps.innerHTML = db.partners.map((x) => `<option value="${x.id}" ${x.id === ui.partnerId ? "selected" : ""}>${esc(x.name)} · ${esc(PARTNER_TYPES[x.type].label)}</option>`).join("");
  if (showP) {
    const p = partnerOf(ui.partnerId);
    ps.innerHTML = db.partners.map((x) => `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)} · ${esc(PARTNER_TYPES[x.type].label)}</option>`).join("");
    rs.innerHTML = rolesDesc().filter((r) => p.roles[r].on).map((r) => `<option value="${r}" ${r === ui.role ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("");
  }
  $$(".device-switch button").forEach((b) => b.classList.toggle("on", b.dataset.device === ui.device));
}

/** Barre de l'application. En session réelle : « Se déconnecter » ; en accès direct de démo : « Quitter ». */
function appBar(brandHtml, roleLabel, name, extra = "") {
  const i = session.identityId ? identityOf(session.identityId) : null;
  const who = i ? i.name : name;
  const initials = who.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return `<header class="app-bar">${brandHtml}${extra}<div class="spacer"></div>
    <div class="who"><span class="role-pill">${esc(roleLabel)}</span><span class="who-name small">${esc(who)}</span><span class="avatar" title="${esc(who)}">${esc(initials)}</span>
    <button type="button" class="btn btn-ghost btn-sm" id="btn-logout">${i ? "Se déconnecter" : "Quitter"}</button></div></header>`;
}
function bindAppBar(root) { $("#btn-logout", root)?.addEventListener("click", () => { if (session.identityId) logout(); else go("login"); }); }
function tabsHtml(key, tabs, current) {
  return `<nav class="tabs" role="tablist" aria-label="Onglets">${tabs.map((t) => `<button type="button" role="tab" data-tabkey="${key}" data-tab="${t.id}" class="${t.id === current ? "on" : ""}" aria-selected="${t.id === current}">${t.icon ? `${t.icon} ` : ""}${esc(t.label)}${t.inh ? `<span class="inh">(${esc(t.inh)})</span>` : ""}${t.count != null ? ` <span class="count ${t.hot && t.count ? "hot" : ""}">${t.count}</span>` : ""}</button>`).join("")}</nav>`;
}
function bindTabs(root) { $$("[data-tabkey]", root).forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabkey, b.dataset.tab))); }

/* =====================================================================
 * Notes UX
 * ===================================================================== */
const NOTES = {}; // rempli par spaces.js : clé = espace ou « espace:onglet »
function notesKey() {
  if (ui.space === "login") return `login:${ui.auth.screen}`;
  if (ui.space === "partner") return `partner:${currentPartnerTab()}`;
  if (ui.space === "public") return `public:${pub.entry || "choix"}`;
  if (ui.space === "lamifi" && ui.lamifiPartner) return "lamifi:settings";
  const t = { lamifi: tabOf("lamifi", "partners"), yodan: tabOf("yodan", "dashboard"), console: tabOf("console", "pec"), praticien: tabOf("praticien", "today") }[ui.space];
  return t ? `${ui.space}:${t}` : ui.space;
}
function renderNotes() {
  const key = notesKey();
  const n = NOTES[key] || NOTES[key.split(":")[0]] || { title: "Notes", choix: [], questions: [] };
  const demo = (typeof demoHints === "function" ? demoHints() : []) || [];
  const acts = (typeof demoActions === "function" ? demoActions() : []) || [];
  const aside = $("#notes");
  aside.innerHTML = `<button type="button" class="notes-close" aria-label="Fermer les notes">×</button>
    <h2>${esc(n.title)}</h2>
    ${n.choix?.length ? `<span class="tag">Choix UX</span><ul class="choices">${n.choix.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
    ${n.questions?.length ? `<span class="tag">Questions à valider</span><ul class="questions">${n.questions.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
    ${demo.length ? `<span class="tag">Pour la démo</span><ul class="demo">${demo.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
    ${acts.length ? `<div class="actions" style="margin-top:.5rem">${acts.map(([l], k) => `<button type="button" class="btn btn-sm" data-demo="${k}">${esc(l)}</button>`).join("")}</div>` : ""}
    ${testsBoxHtml()}`;
  $(".notes-close", aside).addEventListener("click", () => setNotes(false));
  $$("[data-demo]", aside).forEach((b) => b.addEventListener("click", () => acts[+b.dataset.demo][1]()));
}
function testsBoxHtml() {
  const r = window.__testResults;
  if (!r) return `<p class="small muted" style="margin-top:1rem">Tests de cohérence : ouvrir <code>index.html?tests=1</code>.</p>`;
  const ko = r.filter((x) => !x.ok);
  return `<div class="tests-box ${ko.length ? "ko" : "ok"}"><strong>Tests : ${r.length - ko.length} OK / ${ko.length} KO</strong>
    ${ko.length ? `<ul>${ko.map((x) => `<li><strong>${esc(x.name)}</strong> — ${esc(x.err)}</li>`).join("")}</ul>` : ""}
    <details><summary>Voir les ${r.length} règles</summary><ul>${r.map((x) => `<li>${x.ok ? "✅" : "❌"} ${esc(x.name)}</li>`).join("")}</ul></details></div>`;
}
function setNotes(on) {
  ui.notes = on;
  $("#notes-toggle").setAttribute("aria-pressed", String(on));
  $("#layout").classList.toggle("with-notes", on);
  $("#notes").hidden = !on;
}

/* =====================================================================
 * Page de connexion — la même pour tous les profils
 * ===================================================================== */
const ACISE = [["A", "Agilité & Authenticité"], ["C", "Conformité"], ["I", "Innovation"], ["S", "Sécurité"], ["E", "Éthique"]];

function loginSteps() {
  const a = ui.auth;
  const activation = a.purpose === "ACTIVATION";
  const forced = a.purpose === "LOGIN" && a.identityId && identityOf(a.identityId)?.mustChangePassword;
  const labels = activation ? ["Lien d'activation", "Code", "Mot de passe", "Entrer"] : forced ? ["Identifiants", "Code", "Nouveau mot de passe", "Entrer"] : ["Identifiants", "Code", "Entrer"];
  const idx = a.screen === "login" ? 0 : a.screen === "otp" ? 1 : 2;
  return `<div class="steps" aria-label="Étapes">${labels.map((l, i) => `<span class="${i < idx || (activation && i === 0) ? "done" : i === idx ? "on" : ""}">${i < idx || (activation && i === 0) ? "✓ " : ""}${esc(l)}</span>`).join("")}</div>`;
}

RENDER.login = (root) => {
  const a = ui.auth;
  const i = a.identityId ? identityOf(a.identityId) : null;
  // Même bandeau que la maquette LAMIFI Business v2 : logo, accroche, phrase, repères, devise en pied.
  const hero = `<section class="login-hero" aria-label="YODAN">
      <span class="dots" aria-hidden="true"></span><span class="blob b1" aria-hidden="true"></span><span class="blob b2" aria-hidden="true"></span><span class="blob b3" aria-hidden="true"></span>
      <svg class="pulse" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 H380 L420 70 L445 25 L470 105 L495 45 L515 70 H760 L790 70 L810 40 L832 92 L850 70 H1200"/></svg>
      <div><span class="logo-box"><img class="logo-img" src="logo-yodan.png?v=1" alt="YODAN — Santé et psychologie d'entreprises"></span></div>
      <div>
        <span class="eyebrow">Santé mentale au travail · LAMIFI Business</span>
        <h1>Bienvenue sur votre <em>espace</em>.</h1>
        <p class="lead">Mesurer, Assister, Piloter et Transformer pour une performance durable et la santé mentale de vos équipes.</p>
        <div class="trust"><span>🔒 Données de santé protégées</span><span>🤝 Psychologues et praticiens</span><span>📊 Pilotage anonymisé</span></div>
      </div>
      <div class="motto" title="Nos valeurs ACISE">${ACISE.map(([, t]) => t).join(" · ")}</div>
    </section>`;
  let card = "";
  const msg = `${a.err ? `<div class="banner banner-err" role="alert">${esc(a.err)}</div>` : ""}${a.info ? `<div class="banner banner-info">${esc(a.info)}</div>` : ""}`;
  if (a.screen === "login") {
    card = `<span class="eyebrow">Connexion</span><h2>Ravi de vous revoir</h2>${loginSteps()}${msg}
      <form id="f-login" novalidate>
        <div class="field"><label for="l-email">Adresse e-mail</label><input id="l-email" type="email" autocomplete="username" value="${esc(a.email)}" required></div>
        <div class="field"><label for="l-pw">Mot de passe</label><input id="l-pw" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-orange btn-lg btn-block" type="submit">Continuer →</button>
      </form>
      <p class="small muted" style="margin-top:.8rem">Nouveau compte ? Ouvrez le <strong>lien d'activation</strong> reçu par e-mail.</p>`;
  } else if (a.screen === "otp") {
    card = `<span class="eyebrow">Vérification</span><h2>Code reçu par e-mail</h2>${loginSteps()}${msg}
      <p class="small muted" style="margin-top:0">Saisissez les 6 chiffres envoyés à <strong>${esc(i.email)}</strong>. Valable ${OTP_VALID_MIN} minutes.</p>
      <form id="f-otp" novalidate><div class="otp">${[0, 1, 2, 3, 4, 5].map((k) => `<input inputmode="numeric" maxlength="1" data-otp="${k}" aria-label="Chiffre ${k + 1}" autocomplete="${k === 0 ? "one-time-code" : "off"}">`).join("")}</div>
      <button class="btn btn-orange btn-lg btn-block" type="submit">Vérifier</button></form>
      <p class="small" style="text-align:center;margin-top:.7rem"><button type="button" class="link-btn" id="otp-resend">Renvoyer un code</button> · <button type="button" class="link-btn" id="otp-cancel">Annuler</button></p>`;
  } else if (a.screen === "password") {
    card = `<span class="eyebrow">${a.purpose === "ACTIVATION" ? "Activation" : "Sécurité"}</span><h2>${a.purpose === "ACTIVATION" ? "Choisissez votre mot de passe" : "Changez votre mot de passe"}</h2>${loginSteps()}${msg}
      ${a.purpose !== "ACTIVATION" ? `<p class="small muted" style="margin-top:0">Votre compte a été créé avec un mot de passe provisoire : remplacez-le avant d'entrer.</p>` : ""}
      <form id="f-pw" novalidate>
        <div class="field"><label for="p1">Nouveau mot de passe</label><input id="p1" type="password" autocomplete="new-password"></div>
        <ul class="pw-rules" id="pw-rules"></ul>
        <div class="field"><label for="p2">Confirmer</label><input id="p2" type="password" autocomplete="new-password"></div>
        <button class="btn btn-orange btn-lg btn-block" type="submit">Enregistrer et entrer</button>
      </form>`;
  }
  root.innerHTML = `<div class="login-split">${hero}<div class="login-side"><div class="login-card">${card}
    <div class="login-foot">🔒 Connexion chiffrée (HTTPS) · code de vérification à chaque connexion · déconnexion après ${IDLE_MIN} min d'inactivité.</div></div></div></div>`;

  if (a.screen === "login") {
    $("#f-login", root).addEventListener("submit", (e) => {
      e.preventDefault();
      a.email = $("#l-email", root).value;
      const r = login(a.email, $("#l-pw", root).value);
      if (!r.ok) { a.err = r.err; a.info = ""; return render(); }
      const c = startOtp(r.identity.id, "LOGIN");
      Object.assign(a, { screen: "otp", identityId: r.identity.id, challengeId: c.id, purpose: "LOGIN", err: "", info: "" });
      render();
    });
  }
  if (a.screen === "otp") {
    const boxes = $$("[data-otp]", root);
    boxes[0].focus();
    boxes.forEach((b, k) => {
      b.addEventListener("input", () => { b.value = b.value.replace(/\D/g, "").slice(-1); if (b.value && boxes[k + 1]) boxes[k + 1].focus(); });
      b.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !b.value && boxes[k - 1]) boxes[k - 1].focus(); });
      b.addEventListener("paste", (e) => { const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (t.length) { e.preventDefault(); t.split("").forEach((d, j) => { if (boxes[j]) boxes[j].value = d; }); boxes[Math.min(t.length, 5)].focus(); } });
    });
    $("#f-otp", root).addEventListener("submit", (e) => {
      e.preventDefault();
      const res = verifyOtp(a.challengeId, boxes.map((b) => b.value).join(""));
      const left = OTP_TRIES - (db.challenges.find((c) => c.id === a.challengeId)?.tries || 0);
      if (res === "FAUX") { a.err = `Code incorrect. ${left} essai(s) restant(s).`; return render(); }
      if (res === "EXPIRE") { a.err = "Code expiré. Demandez un nouveau code."; return render(); }
      if (res === "BLOQUE" || res === "INCONNU") { a.err = "Trop d'essais : demandez un nouveau code."; return render(); }
      a.err = "";
      const idn = identityOf(a.identityId);
      if (a.purpose === "ACTIVATION" || idn.mustChangePassword) { a.screen = "password"; return render(); }
      finishLogin(idn.id);
    });
    $("#otp-resend", root).addEventListener("click", () => { const c = startOtp(a.identityId, a.purpose); a.challengeId = c.id; a.err = ""; a.info = "Nouveau code envoyé."; render(); });
    $("#otp-cancel", root).addEventListener("click", () => go("login"));
  }
  if (a.screen === "password") {
    const rules = () => { $("#pw-rules", root).innerHTML = passwordChecks($("#p1", root).value, i).map(([ok, l]) => `<li class="${ok ? "ok" : ""}">${esc(l)}</li>`).join(""); };
    $("#p1", root).addEventListener("input", rules);
    rules();
    $("#p1", root).focus();
    $("#f-pw", root).addEventListener("submit", (e) => {
      e.preventDefault();
      const r = setPassword(a.identityId, $("#p1", root).value, $("#p2", root).value);
      if (!r.ok) { a.err = r.err; return render(); }
      finishLogin(a.identityId);
    });
  }
};
function finishLogin(identityId) {
  const land = enterSession(identityId);
  resetAuth();
  ui.space = land.space;
  if (land.space === "partner") { ui.partnerId = land.partnerId; ui.role = land.role; }
  ui.tabs = {};
  toast(`Bienvenue ${esc(identityOf(identityId).name)} !`);
  render();
}
/** Ouverture du lien d'activation depuis la boîte e-mail simulée. */
function openActivationLink(token) {
  const r = activationIdentity(token);
  ui.space = "login";
  if (session.identityId) logout("Ouverture d'un lien d'activation");
  if (!r.ok) { resetAuth(); ui.auth.err = r.err; return render(); }
  const c = startOtp(r.identity.id, "ACTIVATION");
  Object.assign(ui.auth, { screen: "otp", identityId: r.identity.id, challengeId: c.id, purpose: "ACTIVATION", err: "", info: "Lien vérifié : un code vient de vous être envoyé." });
  render();
}
onLogout = (reason) => { ui.space = "login"; resetAuth(reason ? `Vous avez été déconnecté(e) : ${reason}` : "Vous êtes déconnecté(e)."); ui.tabs = {}; render(); };

/* =====================================================================
 * Barre d'outils de démo : horloge simulée + boîte e-mail simulée
 * ===================================================================== */
const demo = { open: false, tab: "clock", mail: null, filter: "" };
function renderDemoBadge() {
  const unread = db.outbox.filter((m) => !m.read).length;
  $("#demo-fab").innerHTML = `🛠${unread ? `<span class="badge">${unread}</span>` : ""}`;
  $("#demo-fab").setAttribute("aria-label", `Outils de démo (horloge et e-mails)${unread ? `, ${unread} e-mail(s) non lu(s)` : ""}`);
  if (demo.open) renderDemoPanel();
}
function renderDemoPanel() {
  const p = $("#demo-panel");
  p.hidden = !demo.open;
  if (!demo.open) return;
  const d = new Date(clock.now);
  let body = "";
  if (demo.tab === "clock") {
    body = `<div class="clock-face">${fmtTime(clock.now)}</div><div class="muted small" style="margin-bottom:.8rem">${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      <div class="actions">${[["+5 min", 5 * MIN], ["+15 min", 15 * MIN], ["+1 h", HOUR], ["+1 jour", DAY], ["+3 jours", 3 * DAY]].map(([l, v]) => `<button type="button" class="btn btn-sm" data-adv="${v}">${l}</button>`).join("")}</div>
      <p style="margin-top:.6rem"><button type="button" class="link-btn small" data-reset>Revenir au ${fmtDateTime(CLOCK_START)}</button></p>
      <ul class="small muted" style="padding-left:1rem;margin-top:.6rem"><li>Code de vérification : valable ${OTP_VALID_MIN} min.</li><li>Lien d'activation : valable ${ACTIVATION_HOURS} h.</li><li>Session : déconnexion après ${IDLE_MIN} min sans action.</li></ul>
      ${session.identityId ? `<div class="banner banner-info">Session ouverte : ${esc(identityOf(session.identityId).email)} · dernière action à ${fmtTime(session.lastActivity)}.</div>` : `<div class="banner banner-info">Aucune session : accès direct de démo par la barre du haut.</div>`}`;
  } else {
    const list = [...db.outbox].reverse().filter((m) => !demo.filter || m.to === demo.filter);
    const recipients = [...new Set(db.outbox.map((m) => m.to))];
    const m = demo.mail ? db.outbox.find((x) => x.id === demo.mail) : null;
    body = m ? `<button type="button" class="link-btn small" data-back>← Boîte de réception</button>
        <div class="mail-view" style="margin-top:.5rem"><div class="small muted">De : LAMIFI Business &lt;ne-pas-repondre@yodan.exemple.test&gt;<br>À : ${esc(m.to)}<br>${fmtDateTime(m.at)}</div>
        <h3 style="margin:.5rem 0">${esc(m.subject)}</h3>${m.code ? `<div class="code">${esc(m.code)}</div>` : ""}${m.lines.map((l) => `<p>${esc(l)}</p>`).join("")}
        ${m.link ? `<button type="button" class="btn btn-orange btn-block" data-link>${m.kind === "ACTIVATION" ? "Activer mon compte" : "Ouvrir le lien"}</button><div class="small muted" style="margin-top:.3rem;word-break:break-all">${esc(m.link)}</div>` : ""}</div>`
      : `<div class="toolbar"><select class="grow" data-filter aria-label="Destinataire"><option value="">Tous les destinataires (${db.outbox.length})</option>${recipients.map((r) => `<option value="${esc(r)}" ${demo.filter === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
        ${list.length ? list.map((x) => `<button type="button" class="mail-item ${x.read ? "" : "unread"}" data-mail="${x.id}"><strong>${esc(x.subject)}</strong><span class="meta">${esc(x.to)} · ${fmtDateTime(x.at)}</span></button>`).join("") : `<p class="empty">Aucun e-mail.</p>`}`;
  }
  p.innerHTML = `<header><strong>Outils de démo</strong><button type="button" aria-label="Fermer" data-close>×</button></header>
    <div class="dp-tabs" role="tablist"><button type="button" data-dtab="clock" class="${demo.tab === "clock" ? "on" : ""}">🕒 Horloge</button><button type="button" data-dtab="mail" class="${demo.tab === "mail" ? "on" : ""}">✉️ E-mails${db.outbox.filter((x) => !x.read).length ? ` (${db.outbox.filter((x) => !x.read).length})` : ""}</button></div>
    <div class="dp-body">${body}</div>`;
  $("[data-close]", p).addEventListener("click", () => { demo.open = false; p.hidden = true; });
  $$("[data-dtab]", p).forEach((b) => b.addEventListener("click", () => { demo.tab = b.dataset.dtab; demo.mail = null; renderDemoPanel(); }));
  $$("[data-adv]", p).forEach((b) => b.addEventListener("click", () => advanceClock(+b.dataset.adv)));
  $("[data-reset]", p)?.addEventListener("click", () => advanceClock(CLOCK_START - clock.now));
  $("[data-filter]", p)?.addEventListener("change", (e) => { demo.filter = e.target.value; renderDemoPanel(); });
  $$("[data-mail]", p).forEach((b) => b.addEventListener("click", () => { demo.mail = b.dataset.mail; db.outbox.find((x) => x.id === demo.mail).read = true; renderDemoBadge(); renderDemoPanel(); }));
  $("[data-back]", p)?.addEventListener("click", () => { demo.mail = null; renderDemoPanel(); });
  $("[data-link]", p)?.addEventListener("click", () => {
    const m = db.outbox.find((x) => x.id === demo.mail);
    if (m.kind === "ACTIVATION") { demo.open = false; p.hidden = true; openActivationLink(m.token); }
    else toast("Parcours participant : hors périmètre (voir Notes UX).");
  });
}
function advanceClock(ms) {
  clock.now += ms;
  if (idleExpired()) { logout(`${IDLE_MIN} min sans activité`); }
  render();
  renderDemoPanel();
}

/* =====================================================================
 * Démarrage
 * ===================================================================== */
function boot() {
  $("#role-select").addEventListener("change", (e) => directAccess(e.target.value));
  $("#partner-select").addEventListener("change", (e) => directAccess(ui.space === "public" ? "public" : "partner", { partnerId: e.target.value }));
  $("#prole-select").addEventListener("change", (e) => directAccess("partner", { role: e.target.value }));
  $$(".device-switch button").forEach((b) => b.addEventListener("click", () => { ui.device = b.dataset.device; render(); }));
  $("#notes-toggle").addEventListener("click", () => setNotes(!ui.notes));
  $("#demo-fab").addEventListener("click", () => { demo.open = !demo.open; renderDemoPanel(); });
  // Toute action dans l'application compte comme activité (session courte : 30 min).
  $("#stage").addEventListener("pointerdown", () => { if (!session.identityId) return; if (idleExpired()) logout(`${IDLE_MIN} min sans activité`); else session.lastActivity = clock.now; }, true);
  const syncBar = () => document.documentElement.style.setProperty("--bar-h", `${$("#mock-bar").offsetHeight}px`);
  new ResizeObserver(() => requestAnimationFrame(syncBar)).observe($("#mock-bar"));
  syncBar();
  if (matchMedia("(max-width: 760px)").matches) { ui.device = "mobile"; setNotes(false); }
  if (/[?&]tests=1/.test(location.search) && typeof runTests === "function") window.__testResults = runTests();
  render();
}
