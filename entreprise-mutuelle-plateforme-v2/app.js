/*
 * Maquette Plateforme Entreprise & Mutuelle — interface.
 * Les écrans n'affichent que ce que renvoient les fonctions de data.js (mêmes règles que les tests).
 * Données 100 % fictives.
 */
"use strict";

(function () {
  const E = window.EM, TX = window.EM_TEXTES, NOTES = window.EM_NOTES;
  const S = {
    db: null, now: E.NOW0, accountId: null, mode: "login", screen: null, params: {}, device: "pc", notes: true,
    login: { step: "cred" }, part: { step: "done" }, flash: null, modal: null, blobs: {},
    ui: { cl: {}, kf: {}, pf: {}, care: { state: "ACTIVE" }, hist: {}, val: {}, dash: {}, psy: {}, itw: {}, extraGroups: [] },
  };
  const LOGO_YODAN = "logo-yodan.png?v=1";

  /* ---------- Utilitaires ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const me = () => (S.accountId ? E.byId(S.db.accounts, S.accountId) : null);
  const client = (id) => E.byId(S.db.clients, id);
  const camp = (id) => E.byId(S.db.campaigns, id);
  const unitName = (clientId, unitId) => E.unitOf(S.db, clientId, unitId)?.nom || "—";
  const zoneBadge = (z, txt) => `<span class="badge ${z}">${esc(txt || E.ZONE[z].libelle)}</span>`;
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(sel ?? "") === String(v) ? " selected" : ""}>${esc(label)}</option>`;
  const td = (label, content, cls = "") => `<td data-label="${esc(label)}"${cls ? ` class="${cls}"` : ""}>${content}</td>`;
  const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
  const itwBadge = (st) => `<span class="badge ${st === "VALIDE" ? "VERT" : st === "BROUILLON" ? "info" : "ORANGE"}">${E.INTERVIEW[st]}</span>`;
  const statusBadge = (st) => `<span class="badge ${st === "EN_COURS" ? "VERT" : st === "A_VENIR" ? "info" : "off"}">${E.CAMPAIGN_STATUS[st]}</span>`;

  function download(name, text) {
    const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pushMail(to, mail) {
    const box = $("#mailbox");
    const el = document.createElement("div");
    el.className = "mail";
    el.innerHTML = `<div class="h"><span>Boîte mail simulée · à ${esc(to)}</span><button type="button" aria-label="Fermer">×</button></div><strong>${esc(mail.objet)}</strong><div>${esc(mail.corps)}</div>`;
    el.querySelector("button").onclick = () => el.remove();
    box.prepend(el);
    setTimeout(() => el.remove(), 25000);
  }
  function toast(msg, err = false) {
    const el = document.createElement("div");
    el.className = `mail toast${err ? " err" : ""}`;
    el.setAttribute("role", err ? "alert" : "status");
    el.innerHTML = `<div class="h"><span>${err ? "Action refusée" : "Fait"}</span><button type="button" aria-label="Fermer">×</button></div>${esc(msg)}`;
    el.querySelector("button").onclick = () => el.remove();
    $("#mailbox").prepend(el);
    setTimeout(() => el.remove(), err ? 9000 : 4500);
  }
  function attempt(fn) {
    try { return fn(); } catch (e) { if (e.business) { toast(e.message, true); return undefined; } throw e; }
  }
  function log(action, target, clientId, onBehalf = false) { E.addLog(S.db, { at: S.now, actorId: S.accountId, clientId, action, target, onBehalf }); }

  /* ---------- Navigation ---------- */
  const HOME = { ADMIN_YODAN: "clients", PSYCHOLOGUE: "interviews", SUP_PRINCIPAL: "dashboard", SUP_SECONDAIRE: "dashboard", ADMIN_MUTUELLE: "accounts", ASSISTANTE_SOCIALE: "campaigns", VALIDATEUR: "validation" };
  const NAV = {
    ADMIN_YODAN: [["clients", "Clients"], ["psychologues", "Psychologues"], ["validation", "Validation"], ["care", "À prendre en charge"], ["history", "Historique"]],
    PSYCHOLOGUE: [["interviews", "Mes entretiens"]],
    SUP_PRINCIPAL: [["dashboard", "Tableau de bord"]],
    SUP_SECONDAIRE: [["dashboard", "Tableau de bord"], ["validation", "Décisions"]],
    VALIDATEUR: [["validation", "Décisions"], ["campaigns", "Campagnes"]],
    ADMIN_MUTUELLE: [["accounts", "Comptes"], ["delais", "Délais par région"], ["history", "Historique interne"]],
    ASSISTANTE_SOCIALE: [["campaigns", "Campagnes"]],
  };
  const NAV_PARENT = { clientForm: "clients", campaigns: "clients", campaignForm: "clients", campaign: "clients", interview: "interviews" };

  function go(screen, params = {}) {
    const a = me();
    if (!E.canAccess(a, screen)) { toast("Écran non accessible pour ce rôle.", true); screen = HOME[a.role]; params = {}; }
    if (["ASSISTANTE_SOCIALE", "VALIDATEUR"].includes(a.role) && ["campaigns", "campaignForm"].includes(screen)) { params = { ...params, clientId: a.clientId }; }
    S.screen = screen; S.params = params; S.flash = null; S.modal = null;
    if (screen === "detail" || screen === "interview") {
      const r = E.byId(S.db.responses, params.responseId);
      if (r && E.canSeeResponse(S.db, a, r, S.now)) { log("Consultation d'un dossier individuel", r.pseudo, r.clientId); }
    }
    if (screen === "interview") { S.ui.itw = { responseId: params.responseId, errors: [] }; }
    if (screen === "clientForm") { S.ui.cf = draftFromClient(params.clientId); }
    if (screen === "campaign") { S.ui.dash = { campaignId: params.campaignId }; S.ui.pf = {}; }
    if (screen === "dashboard") { S.ui.dash = { campaignId: latestCampaign(a.clientId)?.id || "" }; }
    render();
    window.scrollTo(0, 0);
  }
  function latestCampaign(clientId) { return S.db.campaigns.filter((k) => k.clientId === clientId && E.day(k.start) <= S.now).sort((x, y) => E.day(y.start) - E.day(x.start))[0]; }
  function loginAs(accountId) { S.accountId = accountId; S.mode = "app"; const a = me(); go(HOME[a.role]); }

  /* ---------- Thème ---------- */
  function currentTheme() {
    if (S.mode === "participant" && S.part.campaignId) { const c = client(camp(S.part.campaignId).clientId); return { ...E.theme(c.theme), logo: c.logo || LOGO_YODAN }; }
    if (S.mode === "app" && me()?.clientId) { const c = client(me().clientId); return { ...E.theme(c.theme), logo: c.logo || LOGO_YODAN }; }
    return { ...E.theme("#296DA8"), logo: LOGO_YODAN };
  }
  function applyTheme() {
    const t = currentTheme(), app = $("#app");
    app.style.setProperty("--brand", t.primary); app.style.setProperty("--on-brand", t.onPrimary);
    app.style.setProperty("--brand-ink", t.ink); app.style.setProperty("--brand-soft", t.soft);
  }

  /* ================= Rendu principal ================= */
  function render() {
    syncMockBar();
    const app = $("#app");
    app.classList.toggle("compact", S.device === "mobile" || window.innerWidth < 700);
    let html;
    if (S.mode === "login") { html = viewLogin(); }
    else if (S.mode === "participant") { html = viewParticipant(); }
    else { html = shell(viewScreen()); }
    const focus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.filter : null;
    const caret = focus ? document.activeElement.selectionStart : null;
    app.innerHTML = html;
    applyTheme();
    if (focus) { const el = app.querySelector(`[data-filter="${focus}"]`); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* select */ } } }
    renderModal();
    renderNotes();
    afterRender();
  }

  function shell(content) {
    const a = me();
    const c = a.clientId ? client(a.clientId) : null;
    const t = currentTheme();
    const active = (["ASSISTANTE_SOCIALE", "VALIDATEUR"].includes(a.role) && S.screen === "campaignForm" ? "campaigns" : NAV_PARENT[S.screen]) || (S.screen === "accounts" && a.role === "ADMIN_YODAN" ? "clients" : S.screen === "detail" ? (S.params.from || "validation") : S.screen);
    return `<header class="topbar">
      <img class="logo" src="${esc(t.logo)}" alt="${esc(c ? c.nom : "YODAN")}">
      <nav class="nav" aria-label="Navigation principale">${NAV[a.role].map(([k, l]) => `<button type="button" data-act="nav" data-screen="${k}"${active === k ? ' aria-current="page"' : ""}>${l}</button>`).join("")}</nav>
      <div class="who"><strong>${esc(a.nom)}</strong>${esc(E.ROLES[a.role])}${c ? ` · ${esc(c.nom)}` : ""}<br><button type="button" class="link small" data-act="logout">Se déconnecter</button></div>
    </header><div class="page">${S.flash ? `<div class="banner ${S.flash.kind || "ok"}">${S.flash.html}</div>` : ""}${content}</div>`;
  }

  function viewScreen() {
    const a = me();
    if (!E.canAccess(a, S.screen)) { return `<div class="banner err">Accès refusé.</div>`; }
    switch (S.screen) {
      case "clients": return viewClients();
      case "clientForm": return viewClientForm();
      case "accounts": return viewAccounts(a.role === "ADMIN_YODAN" ? S.params.clientId : a.clientId);
      case "delais": return `<div class="page-head"><div><p class="eyebrow">${esc(client(a.clientId).nom)}</p><h1>Délais de prise en charge</h1></div></div>${delaysCard(a.clientId)}`;
      case "campaigns": return viewCampaigns();
      case "campaignForm": return viewCampaignForm();
      case "campaign": return viewCampaign();
      case "detail": return viewDetail();
      case "validation": return viewValidation();
      case "care": return viewCare();
      case "history": return viewHistory();
      case "dashboard": return viewSupDashboard();
      case "psychologues": return viewPsychologues();
      case "interviews": return viewInterviews();
      case "interview": return viewInterview();
      default: return "";
    }
  }

  /* ================= Connexion ================= */
  function viewLogin() {
    const L = S.login;
    const err = L.error ? `<div class="banner err" role="alert">${esc(L.error)}</div>` : "";
    const info = L.info ? `<div class="banner ok">${esc(L.info)}</div>` : "";
    let body = "";
    if (L.step === "cred") {
      body = `<h1>Connexion</h1><p class="muted center small" style="text-align:center">Plateforme d'évaluation de la santé psychologique au travail</p>${info}${err}
      <form class="stack-form" data-form="login-cred" novalidate>
        <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" value="${esc(L.email || "")}" required></label>
        <label class="field"><span>Mot de passe</span><input type="password" name="password" autocomplete="current-password" required></label>
        <div class="between"><label class="choices"><label><input type="checkbox" name="remember"${L.remember ? " checked" : ""}> Se souvenir de moi (1 semaine)</label></label>
          <button type="button" class="link" data-act="forgot">Mot de passe oublié ?</button></div>
        <button class="btn" type="submit">Continuer</button>
      </form>`;
    } else if (L.step === "otp") {
      body = `<h1>Code de vérification</h1><p class="small muted">Un code à 6 chiffres a été envoyé à <strong>${esc(L.email)}</strong>. Il expire dans 10 minutes.</p>${err}
      <form class="stack-form" data-form="login-otp" novalidate>
        <label class="field"><span>Code reçu par e-mail</span><input class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
        <button class="btn" type="submit">Valider</button>
        <div class="between"><button type="button" class="link" data-act="otp-resend">Renvoyer le code</button><button type="button" class="link" data-act="login-back">Changer d'e-mail</button></div>
      </form>`;
    } else if (L.step === "change") {
      body = `<h1>Nouveau mot de passe</h1><p class="small muted">${L.flow === "forgot" ? "Choisissez votre nouveau mot de passe." : "Première connexion : remplacez le mot de passe temporaire reçu par e-mail."}</p>${err}
      <form class="stack-form" data-form="login-change" novalidate>
        <label class="field"><span>Nouveau mot de passe</span><input type="password" name="p1" autocomplete="new-password" required><span class="hint">12 caractères minimum, au moins une lettre et un chiffre.</span></label>
        <label class="field"><span>Confirmation</span><input type="password" name="p2" autocomplete="new-password" required></label>
        <button class="btn" type="submit">Enregistrer</button>
      </form>`;
    } else if (L.step === "forgot") {
      body = `<h1>Mot de passe oublié</h1><p class="small muted">Saisissez votre e-mail : vous recevrez un code pour choisir un nouveau mot de passe.</p>${err}
      <form class="stack-form" data-form="login-forgot" novalidate>
        <label class="field"><span>E-mail</span><input type="email" name="email" value="${esc(L.email || "")}" required></label>
        <button class="btn" type="submit">Recevoir un code</button>
        <button type="button" class="link" data-act="login-back">Retour à la connexion</button>
      </form>`;
    }
    return `<div class="login"><div class="card"><img class="logo" src="${LOGO_YODAN}" alt="YODAN">${body}</div></div>`;
  }
  const newOtp = () => String(Math.floor(100000 + Math.random() * 900000));
  function sendOtp(email) { S.login.otp = newOtp(); pushMail(email, TX.emails.otp(S.login.otp)); }

  /* ================= Parcours participant ================= */
  const PRESETS = {
    VERT: [4, 4, 4, 4, 4, 1, 3, 3, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 0, 0, 0],
    ORANGE: [3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 0, 0],
    ROUGE: [1, 1, 1, 1, 1, 3, 1, 1, 3, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 1, 1],
  };
  const PART_STEPS = ["Identité", "Consentement", "Questionnaire", "Test", "Résultat"];
  function partStepIndex(step) { return { email: 0, otp: 0, consent: 1, profile: 2, test: 3, result: 4 }[step]; }

  function viewParticipant() {
    const P = S.part;
    const k = camp(P.campaignId), c = client(k.clientId), t = currentTheme();
    const head = `<div class="part-head"><span class="logo-box"><img src="${esc(t.logo)}" alt="${esc(c.nom)}"></span><div class="t">${esc(k.nom)}<small>${esc(c.nom)} · évaluation confidentielle</small></div></div>`;
    const idx = partStepIndex(P.step);
    const steps = `<div class="steps" aria-label="Étapes">${PART_STEPS.map((s, i) => `<span class="${i === idx ? "on" : ""}">${i + 1}. ${s}</span>`).join(" › ")}</div><div class="progress"><span style="width:${((idx + (P.step === "test" ? P.section / 5 : 0)) / 4) * 100}%"></span></div>`;
    const err = P.error ? `<div class="banner err" role="alert">${P.error}</div>` : "";
    let body = "";
    const st = E.campaignStatus(k, S.now);
    if (P.step === "email") {
      if (!c.active || st !== "EN_COURS") {
        body = `<h1>Évaluation indisponible</h1><div class="banner warn">${esc(E.checkParticipantAccess(S.db, k, "x@x.x", S.now).reason)}</div>`;
      } else {
        body = `${steps}<h1>Bienvenue</h1><p>Ce questionnaire confidentiel évalue votre santé psychologique au travail. Il prend environ 10 minutes. Vos réponses individuelles ne sont jamais transmises à votre hiérarchie.</p>${err}
        <form data-form="part-email" novalidate class="card">
          <label class="field"><span>Votre e-mail${c.emailPro ? " professionnel" : ""} <span class="req">*</span></span><input type="email" name="email" value="${esc(P.email || "")}" autocomplete="email" required>
          <span class="hint">${c.emailPro ? `Adresse en @${esc(E.domainOf(c.emailPro))}. ` : ""}Nous vous envoyons un code pour confirmer qu'elle est à vous.</span></label>
          <div class="form-actions"><button class="btn" type="submit">Recevoir un code</button></div>
        </form>`;
      }
    } else if (P.step === "otp") {
      body = `${steps}<h1>Code de vérification</h1><p class="muted">Code envoyé à <strong>${esc(P.email)}</strong>.</p>${err}
      <form data-form="part-otp" novalidate class="card"><label class="field"><span>Code à 6 chiffres</span><input class="otp-input" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label>
      <div class="form-actions"><button type="button" class="btn ghost" data-act="part-back" data-step="email">Changer d'e-mail</button><button class="btn" type="submit">Valider</button></div></form>`;
    } else if (P.step === "consent") {
      const p = P.profile;
      const mut = c.type === "M";
      body = `${steps}<h1>Votre accord</h1><p>Avant de commencer, nous avons besoin de votre accord sur ${mut ? "trois" : "deux"} points.</p>${err}
      <form data-form="part-consent" novalidate>
        <label class="consent"><input type="checkbox" name="consentDonnees"${p.consentDonnees ? " checked" : ""}><span><strong>Traitement de mes données.</strong> ${esc(TX.consentement.donnees)}</span></label>
        <label class="consent"><input type="checkbox" name="consentContact"${p.consentContact ? " checked" : ""}><span><strong>Entretien avec un psychologue.</strong> ${esc(TX.consentement.contact)}</span></label>
        ${mut ? `<label class="consent"><input type="checkbox" name="consentAvis"${p.consentAvis ? " checked" : ""}><span><strong>Transmission de l'avis à ma mutuelle.</strong> ${esc(TX.consentement.avis)}</span></label>` : ""}
        <p class="small muted">Vous pouvez retirer votre accord à tout moment en écrivant à Yodan. Version du texte : ${esc(TX.consentement.version)}.</p>
        <div class="form-actions"><button class="btn" type="submit">J'accepte et je continue</button></div>
      </form>`;
    } else if (P.step === "profile") {
      body = `${steps}<h1>Questionnaire général</h1>${err}${profileForm(k, c, P.profile)}`;
    } else if (P.step === "test") {
      const sec = E.SECTIONS[P.section];
      let base = 0; for (let i = 0; i < P.section; i++) { base += E.SECTIONS[i].items.length; }
      body = `${steps}<p class="eyebrow muted small">Partie ${P.section + 1} sur 5</p><h1>${esc(sec.titre)}</h1><p>${esc(sec.consigne)}</p>${err}
      <form data-form="part-test" novalidate>
        ${sec.items.map((it, j) => {
          const q = base + j, text = typeof it === "string" ? it : it.text, scale = E.SCALES[typeof it === "string" ? sec.scale : it.scale];
          const miss = P.missing && P.answers[q] == null;
          return `<fieldset class="item${miss ? " missing" : ""}"><legend>${q + 1}. ${esc(text)}</legend><div class="scale">${scale.map((lab, v) => { const val = v + sec.offset; return `<label><input type="radio" name="q${q}" value="${val}"${P.answers[q] === val ? " checked" : ""}> ${esc(lab)}</label>`; }).join("")}</div>${miss ? '<p class="small" style="color:var(--rouge);margin:.3rem 0 0">Réponse obligatoire.</p>' : ""}</fieldset>`;
        }).join("")}
        <div class="form-actions">${P.section > 0 ? '<button type="button" class="btn ghost" data-act="part-prev">Précédent</button>' : ""}<button class="btn" type="submit">${P.section < 4 ? "Suivant" : "Voir mon résultat"}</button></div>
      </form>`;
    } else if (P.step === "done") {
      body = `<h1>Merci</h1><p>Votre participation est enregistrée. Vous pouvez fermer cette page.</p><p class="small muted">${esc(TX.mentionCommune)}</p>`;
    } else if (P.step === "result") {
      const r = E.byId(S.db.responses, P.responseId);
      const z = r.result.profil, I = TX.interpretation[z];
      const v = E.imc(r.poids, r.taille), cat = E.imcCategorie(v);
      body = `${steps}<h1>Votre résultat</h1>
      <div class="result-card ${z}"><h2>${esc(I.titre)}</h2>${I.paragraphes.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      <div class="card" style="margin-bottom:1rem"><h3>Entretien avec un psychologue</h3><p style="margin:0">${esc(TX.entretien)} Numéro indiqué : <strong>${esc(r.tel)}</strong>.</p></div>
      <div class="card imc-box" style="margin-bottom:1rem"><h3>Votre IMC</h3>${imcBlock(v, cat)}</div>
      <p class="small muted">${esc(TX.mentionCommune)}</p>
      <div class="form-actions"><button class="btn ghost" type="button" data-act="part-restart">Terminer</button></div>`;
    }
    return `<div class="part">${head}<div class="part-body">${body}</div></div>`;
  }
  function imcBlock(v, cat) {
    if (v == null) { return '<p class="muted">Renseignez le poids et la taille.</p>'; }
    const pos = Math.max(0, Math.min(100, ((v - 14) / (45 - 14)) * 100));
    return `<p style="margin:0"><strong>${String(v).replace(".", ",")} kg/m²</strong> · ${esc(cat.categorie)}</p><div class="gauge" aria-hidden="true"><i style="left:${pos}%"></i></div><p class="small" style="margin:.3rem 0 0">${esc(E.imcMessage(v))}</p><p class="small muted" style="margin:.2rem 0 0">${esc(TX.imcPrecaution)}</p>`;
  }
  function profileForm(k, c, p) {
    const sel = (name, label, values, cur) => `<label class="field"><span>${label} <span class="req">*</span></span><select name="${name}" required><option value="">Choisir…</option>${values.map((v) => opt(v, v, cur)).join("")}</select></label>`;
    const W = E.UNIT_WORD[c.type];
    const v = E.imc(p.poids, p.taille);
    return `<form data-form="part-profile" novalidate class="card"><div class="form-grid">
      <label class="field"><span>Nom <span class="req">*</span></span><input type="text" name="nom" value="${esc(p.nom)}" autocomplete="family-name"></label>
      <label class="field"><span>Prénom <span class="req">*</span></span><input type="text" name="prenom" value="${esc(p.prenom)}" autocomplete="given-name"></label>
      <label class="field"><span>Téléphone <span class="req">*</span></span><input type="tel" name="tel" value="${esc(p.tel)}" autocomplete="tel"><span class="hint">Pour l'entretien avec un psychologue, proposé à tous.</span></label>
      <label class="field"><span>${W.One} <span class="req">*</span></span><select name="unitId"><option value="">Choisir…</option>${c.units.map((u) => opt(u.id, u.nom, p.unitId)).join("")}</select></label>
      ${sel("genre", "Genre", E.OPTIONS.genre, p.genre)}
      ${sel("age", "Tranche d'âge", E.OPTIONS.age, p.age)}
      ${sel("ancEnt", "Ancienneté dans l'entreprise", E.OPTIONS.anciennete, p.ancEnt)}
      ${sel("ancPoste", "Ancienneté au poste de travail", E.OPTIONS.anciennete, p.ancPoste)}
      <label class="field"><span>Poids (kg) <span class="req">*</span></span><input type="number" name="poids" min="30" max="250" step="1" value="${esc(p.poids ?? "")}" data-imc></label>
      <label class="field"><span>Taille (cm) <span class="req">*</span></span><input type="number" name="taille" min="120" max="230" step="1" value="${esc(p.taille ?? "")}" data-imc></label>
      <div class="full imc-box" id="imc-live">${imcBlock(v, E.imcCategorie(v))}</div>
      <fieldset class="field full"><legend>Antécédents médicaux <span class="req">*</span></legend><div class="choices">
        <label><input type="checkbox" name="aucun" data-ante-none${p.aucunAntecedent ? " checked" : ""}> Aucun</label>
        ${E.OPTIONS.antecedents.map((x) => `<label><input type="checkbox" name="ante" value="${esc(x)}" data-ante${(p.antecedents || []).includes(x) ? " checked" : ""}> ${esc(x)}</label>`).join("")}
      </div></fieldset>
    </div><div class="form-actions"><button class="btn" type="submit">Commencer le test</button></div></form>`;
  }

  /* ================= Clients ================= */
  function viewClients() {
    const f = S.ui.cl;
    const rows = S.db.clients.filter((c) => (!f.nom || c.nom.toLowerCase().includes(f.nom.toLowerCase())) && (!f.secteur || c.secteur === f.secteur) && (!f.type || c.type === f.type) && (!f.statut || (f.statut === "on") === c.active));
    return `<div class="page-head"><div><p class="eyebrow">Admin Yodan</p><h1>Clients</h1></div><button class="btn" type="button" data-act="client-new">+ Créer un client</button></div>
    <div class="filters card">
      <label class="field"><span>Nom</span><input type="text" data-filter="cl.nom" value="${esc(f.nom || "")}"></label>
      <label class="field"><span>Secteur d'activité</span><select data-filter="cl.secteur"><option value="">Tous</option>${E.SECTEURS.map(([k, l]) => opt(k, `${k} — ${l}`, f.secteur)).join("")}</select></label>
      <label class="field"><span>Type</span><select data-filter="cl.type"><option value="">Tous</option>${opt("E", "Entreprise", f.type)}${opt("M", "Mutuelle", f.type)}</select></label>
      <label class="field"><span>Statut</span><select data-filter="cl.statut"><option value="">Tous</option>${opt("on", "Actif", f.statut)}${opt("off", "Désactivé", f.statut)}</select></label>
    </div>
    <p class="count">${plural(rows.length, "client")}</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Client</th><th>Type</th><th>Secteur</th><th class="num">Effectif</th><th class="num">Campagnes</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
    ${rows.length ? rows.map((c) => {
      const eff = c.effectifs[c.effectifs.length - 1];
      return `<tr class="${c.active ? "" : "row-off"}">
        ${td("Client", `<strong>${esc(c.nom)}</strong><br><span class="small muted">${c.emailPro ? "@" + esc(E.domainOf(c.emailPro)) : "Sans e-mail pro (campagnes ouvertes)"}</span>`)}
        ${td("Type", c.type === "E" ? "Entreprise" : "Mutuelle")}
        ${td("Secteur", `<span title="${esc(E.SECTEURS.find(([k]) => k === c.secteur)[1])}">${c.secteur} — ${esc(E.SECTEURS.find(([k]) => k === c.secteur)[1].slice(0, 28))}…</span>`)}
        ${td("Effectif", `${eff.valeur}<br><span class="small muted">au ${E.fmtDate(E.day(eff.date))}</span>`, "num")}
        ${td("Campagnes", S.db.campaigns.filter((k) => k.clientId === c.id).length, "num")}
        ${td("Statut", c.active ? '<span class="badge VERT">Actif</span>' : '<span class="badge off">Désactivé</span>')}
        ${td("Actions", `<div class="actions"><button class="btn sm" type="button" data-act="nav" data-screen="campaigns" data-client="${c.id}">Voir les campagnes</button><button class="btn sm ghost" type="button" data-act="nav" data-screen="clientForm" data-client="${c.id}">Configurer</button><button class="btn sm ghost" type="button" data-act="nav" data-screen="accounts" data-client="${c.id}">Comptes</button><button class="btn sm ${c.active ? "danger" : "ghost"}" type="button" data-act="client-toggle" data-id="${c.id}">${c.active ? "Désactiver" : "Activer"}</button></div>`)}
      </tr>`; }).join("") : `<tr class="empty"><td colspan="7">Aucun client ne correspond aux filtres.</td></tr>`}
    </tbody></table></div>`;
  }

  /* ---------- Fiche client ---------- */
  function draftFromClient(id) {
    if (!id) { return { type: "E", tests: ["BSPA"], effectifDate: E.isoDate(S.now), unitsText: "", theme: "#296DA8", logo: "", errors: [] }; }
    const c = client(id), eff = c.effectifs[c.effectifs.length - 1];
    return { id, nom: c.nom, type: c.type, emailPro: c.emailPro, secteur: c.secteur, effectif: eff.valeur, effectifDate: E.isoDate(S.now), tests: c.tests.slice(), unitsText: "", theme: c.theme || "#296DA8", logo: c.logo, errors: [] };
  }
  function viewClientForm() {
    const d = S.ui.cf, c = d.id ? client(d.id) : null;
    const W = E.UNIT_WORD[d.type];
    const t = E.theme(d.theme);
    return `<div class="crumbs"><button type="button" data-act="nav" data-screen="clients">Clients</button> ›</div>
    <div class="page-head"><div><p class="eyebrow">Admin Yodan</p><h1>${c ? "Configurer " + esc(c.nom) : "Créer un client"}</h1></div></div>
    ${d.errors.length ? `<div class="banner err" role="alert"><strong>À corriger :</strong><ul>${d.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <form data-form="client" novalidate id="client-form">
      <section class="card section-card"><h3>Identité</h3><div class="form-grid">
        <label class="field"><span>Nom <span class="req">*</span></span><input type="text" name="nom" value="${esc(d.nom || "")}"></label>
        <fieldset class="field"><legend>Type <span class="req">*</span></legend><div class="choices">
          <label><input type="radio" name="type" value="E"${d.type === "E" ? " checked" : ""}${c ? " disabled" : ""} data-live> Entreprise</label>
          <label><input type="radio" name="type" value="M"${d.type === "M" ? " checked" : ""}${c ? " disabled" : ""} data-live> Mutuelle / Assurance</label></div>
          <span class="hint">${c ? "Non modifiable après la création." : "Détermine les rôles disponibles et la règle de délai."}</span></fieldset>
        <label class="field"><span>Secteur d'activité <span class="req">*</span></span><select name="secteur"><option value="">Choisir…</option>${E.SECTEURS.map(([k, l]) => opt(k, `${k} — ${l}`, d.secteur)).join("")}</select><span class="hint">Liste officielle CIAP 2014 (21 sections), non modifiable.</span></label>
        <label class="field"><span>E-mail professionnel</span><input type="email" name="emailPro" value="${esc(d.emailPro || "")}"><span class="hint">Son nom de domaine limite l'accès aux campagnes. Vide = campagnes ouvertes à tous.</span></label>
      </div></section>

      <section class="card section-card"><h3>Effectif daté</h3><div class="form-grid">
        <label class="field"><span>Effectif <span class="req">*</span></span><input type="number" name="effectif" min="1" value="${esc(d.effectif ?? "")}"><span class="hint">Nombre de salariés ou d'adhérents.</span></label>
        <label class="field"><span>À la date du <span class="req">*</span></span><input type="date" name="effectifDate" value="${esc(d.effectifDate)}"></label>
        ${c ? `<div class="full small"><strong>Historique :</strong> ${c.effectifs.map((e) => `${e.valeur} au ${E.fmtDate(E.day(e.date))}`).join(" · ")}. <span class="muted">Une nouvelle valeur ajoute une ligne ; chaque campagne garde l'effectif de sa date de lancement.</span></div>` : ""}
      </div></section>

      <section class="card section-card"><h3>Tests proposés</h3><div class="choices">
        <label><input type="checkbox" name="tests" value="BSPA"${d.tests.includes("BSPA") ? " checked" : ""}> BSPA</label>
        <label class="disabled"><input type="checkbox" disabled> Autres tests (après le pilote)</label></div></section>

      <section class="card section-card"><h3>${W.Many}</h3>
        ${c ? `<p class="small">Existantes : ${c.units.map((u) => `<span class="badge plain info">${esc(u.nom)}</span>`).join(" ")}</p>` : ""}
        <label class="field"><span>${c ? `Ajouter des ${W.many}` : `${W.Many} <span class="req">*</span>`} (une par ligne)</span><textarea name="unitsText" rows="5">${esc(d.unitsText)}</textarea></label>
        <label class="field" style="margin-top:.5rem"><span class="hint">ou importer un fichier tableur (.csv, .txt : une valeur par ligne)</span><input type="file" accept=".csv,.txt" data-import-units></label>
      </section>

      ${c ? "" : `<section class="card section-card"><h3>Compte principal · ${d.type === "E" ? "Superviseur principal" : "Administrateur de la mutuelle"}</h3><div class="form-grid">
        <label class="field"><span>Nom <span class="req">*</span></span><input type="text" name="compteNom" value="${esc(d.compteNom || "")}"></label>
        <label class="field"><span>E-mail <span class="req">*</span></span><input type="email" name="compteEmail" value="${esc(d.compteEmail || "")}"><span class="hint">Un mot de passe temporaire y sera envoyé ; il devra être changé à la première connexion.</span></label>
      </div></section>`}

      <section class="card section-card"><h3>Personnalisation de l'espace client</h3><div class="two-col">
        <div>
          <label class="field"><span>Couleur principale</span><span style="display:flex;gap:.5rem;align-items:center"><input type="color" name="theme" value="${esc(t.primary)}" data-theme-input style="width:56px;height:38px;border:0;padding:0"><code id="theme-code">${esc(t.primary)}</code><button type="button" class="btn sm ghost" data-act="theme-reset">Couleurs Yodan</button></span></label>
          <label class="field" style="margin-top:.8rem"><span>Logo (PNG, JPG ou SVG, 2 Mo max.)</span><input type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" data-logo-input><span class="hint">Fond transparent conseillé.</span></label>
          <div style="display:flex;gap:.6rem;align-items:center;margin-top:.5rem"><img id="logo-preview" class="logo-preview" src="${esc(d.logo || LOGO_YODAN)}" alt="Aperçu du logo"><button type="button" class="btn sm ghost" data-act="logo-reset">Logo Yodan</button></div>
        </div>
        <div><p class="small muted" style="margin-top:0">Aperçu (espace client, pages d'évaluation, PDF) :</p><div id="theme-preview">${themePreview(d)}</div></div>
      </div></section>

      <div class="form-actions"><button type="button" class="btn ghost" data-act="nav" data-screen="clients">Annuler</button><button class="btn" type="submit">${c ? "Enregistrer" : "Créer le client"}</button></div>
    </form>`;
  }
  function themePreview(d) {
    const t = E.theme(d.theme);
    return `<div class="theme-preview"><div class="tp-head" style="background:${t.primary};color:${t.onPrimary}"><img src="${esc(d.logo || LOGO_YODAN)}" alt="">${esc(d.nom || "Nom du client")}</div>
      <div class="tp-body"><span class="btn sm" style="background:${t.primary};border-color:${t.primary};color:${t.onPrimary}">Bouton</span><span style="color:${t.ink};text-decoration:underline">Lien</span>
      <span class="small muted">Contraste texte/fond : ${E.contrast(t.primary, t.onPrimary).toFixed(1)} : 1 (≥ 4,5 requis)</span></div></div>`;
  }
  function readClientForm(form) {
    const fd = new FormData(form), d = S.ui.cf;
    ["nom", "emailPro", "secteur", "effectif", "effectifDate", "unitsText", "compteNom", "compteEmail", "theme"].forEach((k) => { if (fd.has(k)) { d[k] = fd.get(k); } });
    if (!d.id && fd.get("type")) { d.type = fd.get("type"); }
    d.tests = fd.getAll("tests");
  }

  /* ================= Comptes ================= */
  function viewAccounts(clientId) {
    const a = me(), c = client(clientId), W = E.UNIT_WORD[c.type];
    const list = S.db.accounts.filter((x) => x.clientId === clientId);
    const cov = c.type === "M" ? E.coverage(S.db, clientId) : null;
    const holes = cov ? cov.filter((x) => x.validateurs.length !== 1 || x.secondaires.length !== 1) : [];
    return `${a.role === "ADMIN_YODAN" ? `<div class="crumbs"><button type="button" data-act="nav" data-screen="clients">Clients</button> › ${esc(c.nom)}</div>` : ""}
    <div class="page-head"><div><p class="eyebrow">${esc(c.nom)} · ${c.type === "E" ? "Entreprise" : "Mutuelle"}</p><h1>Comptes</h1></div><button class="btn" type="button" data-act="account-new" data-client="${c.id}">+ Créer un compte</button></div>
    ${a.role === "ADMIN_YODAN" ? `<div class="banner">Vous agissez <strong>pour le compte de ${esc(c.nom)}</strong>, à sa demande. Chaque action est inscrite dans l'historique avec la mention « par Yodan pour le compte du client ».</div>` : ""}
    ${!c.active ? '<div class="banner warn">Client désactivé : ses comptes ne peuvent pas se connecter.</div>' : ""}
    ${cov ? `<section class="card section-card"><h3>Couverture des régions</h3>${holes.length ? `<div class="banner warn">${plural(holes.length, "région")} sans médecin-conseil ou superviseur secondaire unique : ses cas orange ne pourront pas être décidés.</div>` : '<p class="small muted" style="margin-top:0">Chaque région a un médecin-conseil (niveau 1) et un superviseur secondaire (niveau 2), tous deux décideurs.</p>'}
      <div class="table-wrap"><table class="rt"><thead><tr><th>Région</th><th>Médecin-conseil (niveau 1)</th><th>Superviseur secondaire (niveau 2)</th><th class="num">Délai</th></tr></thead><tbody>
      ${cov.map((x) => `<tr>${td("Région", esc(x.unit.nom))}${td("Médecin-conseil", x.validateurs.length ? esc(x.validateurs.map((v) => v.nom).join(", ")) : '<span class="badge ORANGE">Aucun</span>')}${td("Superviseur secondaire", x.secondaires.length ? esc(x.secondaires.map((v) => v.nom).join(", ")) : '<span class="badge ORANGE">Aucun</span>')}${td("Délai", plural(x.unit.delayDays, "jour"), "num")}</tr>`).join("")}
      </tbody></table></div></section>` : ""}
    <section class="card section-card"><h3>Liste des comptes</h3><div class="table-wrap"><table class="rt"><thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>${W.Many}</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr></thead><tbody>
    ${list.map((x) => {
      const editable = a.role === "ADMIN_YODAN" || x.role !== "ADMIN_MUTUELLE";
      return `<tr class="${x.active ? "" : "row-off"}">${td("Nom", esc(x.nom))}${td("E-mail", esc(x.email))}${td("Rôle", esc(E.ROLES[x.role]))}
      ${td(W.Many, ["VALIDATEUR", "SUP_SECONDAIRE"].includes(x.role) ? esc(x.units.map((u) => unitName(c.id, u)).join(", ")) : '<span class="muted">Toutes</span>')}
      ${td("Statut", x.active ? (x.mustChange ? '<span class="badge info">Actif · mot de passe temporaire</span>' : '<span class="badge VERT">Actif</span>') : '<span class="badge off">Désactivé</span>')}
      ${td("Dernière connexion", x.lastLogin ? E.fmtDateTime(x.lastLogin) : '<span class="muted">Jamais</span>')}
      ${td("Actions", editable ? `<div class="actions"><button class="btn sm ghost" type="button" data-act="account-edit" data-id="${x.id}">Modifier</button><button class="btn sm ghost" type="button" data-act="account-pwd" data-id="${x.id}">Renvoyer le mot de passe</button><button class="btn sm ${x.active ? "danger" : "ghost"}" type="button" data-act="account-toggle" data-id="${x.id}">${x.active ? "Désactiver" : "Réactiver"}</button></div>` : '<span class="small muted">Géré par Yodan</span>')}</tr>`;
    }).join("")}</tbody></table></div></section>
    ${c.type === "M" && a.role === "ADMIN_YODAN" ? delaysCard(c.id) : ""}`;
  }
  function delaysCard(clientId) {
    const c = client(clientId);
    return `<section class="card section-card"><h3>Délai de prise en charge par région</h3>
    <p class="small muted" style="margin-top:0">Période qui démarre à la <strong>validation de l'avis du psychologue</strong> (pas à la fin du test) et pendant laquelle le superviseur secondaire peut revenir sur la décision du médecin-conseil. 7 jours par défaut. Un changement s'applique aux tests terminés ensuite.</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Région</th><th>Délai (jours)</th><th></th></tr></thead><tbody>
    ${c.units.map((u) => `<tr>${td("Région", esc(u.nom))}${td("Délai (jours)", `<input type="number" min="1" max="60" value="${u.delayDays}" id="delay-${u.id}" aria-label="Délai pour ${esc(u.nom)}" style="width:90px;padding:.3rem;border:1px solid #b8c3d0;border-radius:4px">`)}${td("", `<button class="btn sm" type="button" data-act="delay-save" data-client="${c.id}" data-unit="${u.id}">Enregistrer</button>`)}</tr>`).join("")}
    </tbody></table></div></section>`;
  }
  function accountModal(draft, errors = []) {
    const a = me(), c = client(draft.clientId), W = E.UNIT_WORD[c.type];
    const roles = E.ROLES_BY_TYPE[c.type].filter((r) => a.role === "ADMIN_YODAN" || r !== "ADMIN_MUTUELLE");
    const needUnits = ["VALIDATEUR", "SUP_SECONDAIRE"].includes(draft.role);
    const others = S.db.accounts.filter((x) => x.clientId === c.id && x.active && x.id !== draft.id && x.role === draft.role);
    return `<h2>${draft.id ? "Modifier le compte" : "Créer un compte"}</h2>
    ${errors.length ? `<div class="banner err" role="alert"><ul>${errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <form data-form="account" novalidate><div class="form-grid">
      <label class="field"><span>Nom <span class="req">*</span></span><input type="text" name="nom" value="${esc(draft.nom || "")}"></label>
      <label class="field"><span>E-mail <span class="req">*</span></span><input type="email" name="email" value="${esc(draft.email || "")}"></label>
      <label class="field full"><span>Rôle <span class="req">*</span></span><select name="role" data-account-role>${roles.map((r) => opt(r, E.ROLES[r], draft.role)).join("")}</select></label>
      ${needUnits ? `<fieldset class="field full"><legend>${W.Many} attribuées <span class="req">*</span></legend><div class="choices">
        ${c.units.map((u) => { const taken = others.find((x) => x.units.includes(u.id)); return `<label class="${taken ? "disabled" : ""}"><input type="checkbox" name="units" value="${u.id}"${(draft.units || []).includes(u.id) ? " checked" : ""}${taken ? " disabled" : ""}> ${esc(u.nom)}${taken ? ` <span class="small muted">(couverte par ${esc(taken.nom)})</span>` : ""}</label>`; }).join("")}
      </div><span class="hint">Chaque ${W.one} a un et un seul ${E.ROLES[draft.role].toLowerCase()}.</span></fieldset>` : ""}
    </div>
    ${!draft.id ? '<p class="small muted">Un mot de passe temporaire est envoyé par e-mail ; il devra être changé à la première connexion.</p>' : ""}
    <div class="form-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn" type="submit">${draft.id ? "Enregistrer" : "Créer le compte"}</button></div></form>`;
  }

  /* ================= Campagnes ================= */
  function viewCampaigns() {
    const c = client(S.params.clientId), f = S.ui.kf, admin = me().role === "ADMIN_YODAN";
    const rows = S.db.campaigns.filter((k) => k.clientId === c.id
      && (!f.nom || k.nom.toLowerCase().includes(f.nom.toLowerCase())) && (!f.test || k.test === f.test) && (!f.statut || E.campaignStatus(k, S.now) === f.statut)
      && (!f.from || E.day(k.end) >= E.day(f.from)) && (!f.to || E.day(k.start) <= E.day(f.to)))
      .sort((x, y) => E.day(y.start) - E.day(x.start));
    const psyCell = (k) => k.psychologueIds.length
      ? (admin ? esc(k.psychologueIds.map((id) => E.byId(S.db.accounts, id)).map((p) => p.nom + (p.active ? "" : " (désactivé)")).join(", ")) : `<span class="badge VERT plain">${plural(k.psychologueIds.length, "psychologue")} attribué${k.psychologueIds.length > 1 ? "s" : ""}</span>`)
      : `<span class="badge ORANGE">À attribuer${admin ? "" : " par Yodan"}</span>`;
    return `${admin ? `<div class="crumbs"><button type="button" data-act="nav" data-screen="clients">Clients</button> › ${esc(c.nom)}</div>` : ""}
    <div class="page-head"><div><p class="eyebrow">${esc(c.nom)}${admin ? "" : " · " + esc(E.ROLES[me().role])}</p><h1>Campagnes</h1></div><button class="btn" type="button" data-act="nav" data-screen="campaignForm" data-client="${c.id}"${c.active ? "" : " disabled"}>+ Créer une campagne</button></div>
    ${admin ? "" : `<p class="muted small" style="margin-top:-.5rem">Vous lancez les évaluations de votre mutuelle. Les psychologues sont attribués par Yodan.${me().role === "VALIDATEUR" ? " Les dossiers à décider sont dans « Décisions »." : " Les résultats individuels et les décisions ne sont pas visibles ici."}</p>`}
    <div class="filters card">
      <label class="field"><span>Nom</span><input type="text" data-filter="kf.nom" value="${esc(f.nom || "")}"></label>
      <label class="field"><span>Période du</span><input type="date" data-filter="kf.from" value="${esc(f.from || "")}"></label>
      <label class="field"><span>au</span><input type="date" data-filter="kf.to" value="${esc(f.to || "")}"></label>
      <label class="field"><span>Test</span><select data-filter="kf.test"><option value="">Tous</option>${c.tests.map((t) => opt(t, t, f.test)).join("")}</select></label>
      <label class="field"><span>Statut</span><select data-filter="kf.statut"><option value="">Tous</option>${Object.entries(E.CAMPAIGN_STATUS).map(([k, l]) => opt(k, l, f.statut)).join("")}</select></label>
    </div>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Campagne</th><th>Test</th><th>Période</th><th>Statut</th><th>Psychologues</th><th class="num">Personnes sélectionnées</th><th class="num">Bilans</th><th>Actions</th></tr></thead><tbody>
    ${rows.length ? rows.map((k) => `<tr>${td("Campagne", `<strong>${esc(k.nom)}</strong>`)}${td("Test", k.test)}${td("Période", `${E.fmtDate(E.day(k.start))} → ${E.fmtDate(E.day(k.end))}`)}${td("Statut", statusBadge(E.campaignStatus(k, S.now)))}
      ${td("Psychologues", psyCell(k))}
      ${td("Personnes sélectionnées", S.db.invitees.filter((i) => i.campaignId === k.id).length, "num")}${td("Bilans", S.db.responses.filter((r) => r.campaignId === k.id && r.completedAt <= S.now).length, "num")}
      ${td("Actions", `<div class="actions">${admin ? `<button class="btn sm" type="button" data-act="nav" data-screen="campaign" data-campaign="${k.id}">Entrer</button><button class="btn sm ghost" type="button" data-act="psy-assign" data-id="${k.id}">Psychologues</button>` : ""}<button class="btn sm ghost" type="button" data-act="qr" data-id="${k.id}">Voir le QR code</button></div>`)}</tr>`).join("") : `<tr class="empty"><td colspan="8">Aucune campagne.</td></tr>`}
    </tbody></table></div>`;
  }
  function sampleList(c) {
    const dom = c.emailPro ? E.domainOf(c.emailPro) : "mail.exemple.test";
    const ppl = [["Kouassi", "Awa"], ["Traoré", "Yao"], ["Bamba", "Mariam"], ["Diallo", "Serge"], ["Aka", "Esther"], ["Konan", "Ibrahim"]];
    return "nom;prénom;e-mail;téléphone;" + E.UNIT_WORD[c.type].one + "\n" + ppl.map(([n, p], i) => `${n};${p};${p.toLowerCase()}.${n.toLowerCase().replace("é", "e")}${700 + i}@${dom};07 00 11 22 ${String(30 + i)};${c.units[i % c.units.length].nom}`).join("\n");
  }
  function viewCampaignForm() {
    const c = client(S.params.clientId), d = S.ui.kd || (S.ui.kd = { test: c.tests[0], liste: "", psychologueIds: [], errors: [] });
    const parsed = d.checked ? E.parseInviteeList(S.db, c.id, d.liste) : null;
    const admin = me().role === "ADMIN_YODAN";
    const psys = S.db.accounts.filter((x) => x.role === "PSYCHOLOGUE" && x.active);
    const psySection = admin
      ? `<section class="card section-card"><h3>Psychologues chargés des entretiens <span class="req">*</span></h3>
        <fieldset class="field"><legend>Psychologues actifs</legend><div class="choices">${psys.map((p) => `<label><input type="checkbox" name="psychologueIds" value="${p.id}"${(d.psychologueIds || []).includes(p.id) ? " checked" : ""}> ${esc(p.nom)}${p.mustChange ? ' <span class="small muted">(invitation en attente)</span>' : ""}</label>`).join("")}</div>
        <span class="hint">Au moins un. Seuls les psychologues actifs sont proposés. Modifiable ensuite depuis la liste des campagnes.</span></fieldset></section>`
      : '<div class="banner">Les psychologues seront attribués par Yodan. Tant qu\'aucun psychologue n\'est attribué, les entretiens ne peuvent pas commencer.</div>';
    return `${admin ? `<div class="crumbs"><button type="button" data-act="nav" data-screen="clients">Clients</button> › <button type="button" data-act="nav" data-screen="campaigns" data-client="${c.id}">${esc(c.nom)}</button> ›</div>` : '<div class="crumbs"><button type="button" data-act="nav" data-screen="campaigns">← Campagnes</button></div>'}
    <div class="page-head"><div><p class="eyebrow">${esc(c.nom)}</p><h1>Créer une campagne</h1></div></div>
    ${d.errors.length ? `<div class="banner err" role="alert"><strong>À corriger :</strong><ul>${d.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <form data-form="campaign" novalidate>
      <section class="card section-card"><h3>Campagne</h3><div class="form-grid">
        <label class="field"><span>Nom <span class="req">*</span></span><input type="text" name="nom" value="${esc(d.nom || "")}" placeholder="Ex. : Bilan annuel 2027"></label>
        <label class="field"><span>Test <span class="req">*</span></span><select name="test">${c.tests.map((t) => opt(t, t, d.test)).join("")}</select><span class="hint">Parmi les tests activés pour ce client.</span></label>
        <label class="field"><span>Date de début <span class="req">*</span></span><input type="date" name="start" value="${esc(d.start || "")}"></label>
        <label class="field"><span>Date de fin <span class="req">*</span></span><input type="date" name="end" value="${esc(d.end || "")}"></label>
      </div><p class="small muted">Le statut (à venir, en cours, terminée) découle des dates. Effectif retenu : celui enregistré à la date de début.</p></section>
      <section class="card section-card"><h3>Personnes à évaluer</h3>
        <p class="small muted" style="margin-top:0">Une personne par ligne : <code>nom ; prénom ; e-mail professionnel ; téléphone ; ${E.UNIT_WORD[c.type].one}</code>. Le téléphone est obligatoire (appel d'entretien). Cette liste sert au suivi et aux relances ; elle ne limite pas l'accès.</p>
        <label class="field"><span>Liste <span class="req">*</span></span><textarea name="liste" rows="8">${esc(d.liste)}</textarea></label>
        <div class="actions" style="margin-top:.5rem"><label class="btn sm ghost">Importer un fichier (.csv)<input type="file" accept=".csv,.txt" data-import-list hidden></label><button type="button" class="btn sm ghost" data-act="list-check">Vérifier la liste</button></div>
        ${parsed ? `<div class="banner ${parsed.errors.length ? "warn" : "ok"}" style="margin-top:.7rem">${parsed.rows.length} personne${parsed.rows.length > 1 ? "s" : ""} valide${parsed.rows.length > 1 ? "s" : ""}${parsed.errors.length ? `, ${plural(parsed.errors.length, "erreur")} :<ul>${parsed.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "."}</div>` : ""}
      </section>
      ${psySection}
      <div class="form-actions"><button type="button" class="btn ghost" data-act="nav" data-screen="campaigns" data-client="${c.id}">Annuler</button><button class="btn" type="submit">Créer la campagne</button></div>
    </form>`;
  }
  function readCampaignForm(form) { const fd = new FormData(form), d = S.ui.kd; ["nom", "test", "start", "end", "liste"].forEach((k) => { d[k] = fd.get(k); }); d.psychologueIds = fd.getAll("psychologueIds"); }
  function psyAssignModal(k, error = "") {
    const psys = S.db.accounts.filter((x) => x.role === "PSYCHOLOGUE" && (x.active || k.psychologueIds.includes(x.id)));
    return `<h2>Psychologues de la campagne</h2><p class="muted" style="margin-top:0">${esc(k.nom)} · ${esc(client(k.clientId).nom)}</p>
    ${error ? `<div class="banner err" role="alert">${esc(error)}</div>` : ""}
    <form data-form="psy-assign" data-id="${k.id}" novalidate><div class="choices">${psys.map((p) => `<label class="${p.active ? "" : "disabled"}"><input type="checkbox" name="psychologueIds" value="${p.id}"${k.psychologueIds.includes(p.id) && p.active ? " checked" : ""}${p.active ? "" : " disabled"}> ${esc(p.nom)}${p.active ? "" : ' <span class="small muted">(désactivé : rapports conservés)</span>'}</label>`).join("")}</div>
    <p class="small muted">Un psychologue retiré perd l'accès aux dossiers de la campagne ; ses rapports et avis déjà saisis sont conservés.</p>
    <div class="form-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form>`;
  }

  function qrCanvasUrl(text) {
    if (typeof window.qrcode !== "function") { return null; }
    const qr = window.qrcode(0, "M"); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), cell = 8, m = 4, size = (n + m * 2) * cell;
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) { for (let c = 0; c < n; c++) { if (qr.isDark(r, c)) { g.fillRect((c + m) * cell, (r + m) * cell, cell, cell); } } }
    return cv.toDataURL("image/png");
  }
  function qrModal(k, created = false) {
    const link = E.campaignLink(k), url = qrCanvasUrl(link);
    return `<h2>${created ? "Campagne créée" : "QR code de la campagne"}</h2><p class="muted" style="margin-top:0">${esc(k.nom)} · ${esc(client(k.clientId).nom)}</p>
    <div class="qr-box">${url ? `<img src="${url}" alt="QR code du lien de la campagne">` : '<div class="banner warn">QR code indisponible (bibliothèque non chargée, hors ligne).</div>'}</div>
    <p class="small"><strong>Lien unique :</strong></p><div class="copy-line"><span style="flex:1">${esc(link)}</span><button type="button" class="btn sm ghost" data-act="copy" data-text="${esc(link)}">Copier</button></div>
    <div class="form-actions">${url ? `<a class="btn ghost" href="${url}" download="qr-campagne-${esc(k.token)}.png">Télécharger le QR code (PNG)</a>` : ""}${created ? `<button type="button" class="btn" data-act="nav" data-screen="campaign" data-campaign="${k.id}">Entrer dans la campagne</button>` : '<button type="button" class="btn" data-act="modal-close">Fermer</button>'}</div>`;
  }

  /* ================= Campagne : tableau de bord + participants ================= */
  function viewCampaign() {
    const k = camp(S.params.campaignId), c = client(k.clientId), tab = S.params.tab || "dash";
    return `<div class="crumbs"><button type="button" data-act="nav" data-screen="clients">Clients</button> › <button type="button" data-act="nav" data-screen="campaigns" data-client="${c.id}">${esc(c.nom)}</button> ›</div>
    <div class="page-head"><div><p class="eyebrow">${esc(c.nom)} · ${k.test}</p><h1>${esc(k.nom)}</h1><div class="small">${statusBadge(E.campaignStatus(k, S.now))} ${E.fmtDate(E.day(k.start))} → ${E.fmtDate(E.day(k.end))}</div>
      <div class="small" style="margin-top:.3rem">Psychologues : ${k.psychologueIds.length ? esc(k.psychologueIds.map((id) => E.byId(S.db.accounts, id).nom).join(", ")) : '<span class="badge ORANGE">à attribuer</span>'}</div></div>
      <div class="actions"><button class="btn ghost" type="button" data-act="psy-assign" data-id="${k.id}">Psychologues</button><button class="btn ghost" type="button" data-act="qr" data-id="${k.id}">Lien et QR code</button></div></div>
    <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab === "dash"}" data-act="tab" data-tab="dash">Tableau de bord</button><button type="button" role="tab" aria-selected="${tab === "parts"}" data-act="tab" data-tab="parts">Participants</button></div>
    ${tab === "dash" ? dashboardBlock(me(), { ...S.ui.dash, clientId: c.id }) : participantsBlock(k)}`;
  }

  function viewSupDashboard() {
    const a = me(), c = client(a.clientId);
    return `<div class="page-head"><div><p class="eyebrow">${esc(c.nom)} · ${esc(E.ROLES[a.role])}</p><h1>Tableau de bord</h1></div></div>
    ${a.role === "SUP_SECONDAIRE" ? `<div class="banner">Vos régions : ${esc(a.units.map((u) => unitName(c.id, u)).join(", "))}.</div>` : ""}
    ${dashboardBlock(a, { ...S.ui.dash, clientId: c.id })}`;
  }

  function dashboardBlock(a, f) {
    const c = client(f.clientId), W = E.UNIT_WORD[c.type];
    const units = E.allowedUnits(S.db, a, c.id);
    const d = E.dashboard(S.db, a, f, S.now);
    const g = f.popKey ? E.GROUPS.find((x) => x.key === f.popKey) : null;
    const filters = `<div class="filters card">
      <label class="field"><span>${W.One}</span><select data-filter="dash.unitId"><option value="">${a.role === "SUP_SECONDAIRE" ? "Toutes mes régions" : "Toutes"}</option>${units.map((u) => opt(u, unitName(c.id, u), f.unitId)).join("")}</select></label>
      <label class="field"><span>Campagne</span><select data-filter="dash.campaignId"><option value="">Toutes les campagnes</option>${S.db.campaigns.filter((k) => k.clientId === c.id).sort((x, y) => E.day(y.start) - E.day(x.start)).map((k) => opt(k.id, k.nom, f.campaignId)).join("")}</select></label>
      <label class="field"><span>Population</span><select data-filter="dash.popKey"><option value="">Tout le monde</option>${E.GROUPS.map((x) => opt(x.key, x.label, f.popKey)).join("")}</select></label>
      ${g ? `<label class="field"><span>${esc(g.label)}</span><select data-filter="dash.popValue"><option value="">Choisir…</option>${g.values.map((v) => opt(v, v, f.popValue)).join("")}</select></label>` : ""}
      <div class="grow"><button class="btn ghost" type="button" data-act="dash-export">Exporter (tableur)</button></div>
    </div>`;
    if (!d) { return filters + '<div class="banner err">Accès refusé.</div>'; }
    const p = d.participation;
    const part = `<div class="particip">
      <div class="card"><div class="v">${p.effectif ?? "—"}</div><div class="l">Effectif total à la date de la campagne${p.effectif == null ? (a.role === "SUP_SECONDAIRE" ? " (non affiché par région)" : " (choisir une campagne, sans filtre de région)") : ""}</div></div>
      <div class="card"><div class="v">${p.selectionnes}</div><div class="l">Personnes sélectionnées</div></div>
      <div class="card"><div class="v">${p.repondu}${p.taux != null ? ` <span class="small muted">(${String(p.taux).replace(".", ",")} % de l'effectif)</span>` : ""}</div><div class="l">Personnes ayant répondu</div></div>
      <div class="card"><div class="v">${p.horsListe}</div><div class="l">dont hors liste</div></div></div>`;
    if (d.masked) { return filters + part + `<div class="card masked-card"><h3>Statistiques masquées</h3><p class="muted">Moins de ${E.SEUIL_ANONYMAT} réponses pour cette sélection : les résultats ne sont pas affichés, pour qu'aucune personne ne puisse être reconnue.</p></div>`; }
    const K = d.kpis, tot = K.bilans || 1;
    const tiles = `<div class="tiles">
      <div class="tile"><div class="v">${K.bilans}</div><div class="l">Bilans terminés</div></div>
      <div class="tile VERT"><div class="v">${K.VERT}</div><div class="l">Satisfaisant</div></div>
      <div class="tile ORANGE"><div class="v">${K.ORANGE}</div><div class="l">Vigilance</div></div>
      <div class="tile ROUGE"><div class="v">${K.ROUGE}</div><div class="l">À prendre en charge</div></div>
      <div class="tile ALERT"><div class="v">${K.signauxForts}</div><div class="l">Signaux d'alerte forts</div></div></div>`;
    const donut = (() => {
      const R = 52, C = 2 * Math.PI * R; let off = 0;
      const segs = E.ZONES.map((z) => { const len = (K[z] / tot) * C; const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--${z.toLowerCase()})" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"></circle>`; off += len; return s; }).join("");
      return `<div class="donut-wrap"><svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Répartition des profils">${segs}<text x="70" y="78" text-anchor="middle" font-family="Bebas Neue, Impact" font-size="28" fill="#002C4C">${K.bilans}</text></svg>
        <ul class="legend">${E.ZONES.map((z) => `<li><span><span class="sw s-${z}"></span>${E.ZONE[z].libelle}</span><strong>${K[z]}</strong><span class="muted">${Math.round((K[z] / tot) * 100)} %</span></li>`).join("")}</ul></div>`;
    })();
    const dims = `<div class="dims">${d.dims.map((x) => `<div class="dim"><span>${esc(x.label)}${x.source ? ` <span class="muted small">(${x.source})</span>` : ""}</span><div class="bar"><span style="width:${x.moyenne}%"></span></div><span class="val">${x.moyenne}</span></div>`).join("")}
      <p class="small muted" style="margin:.5rem 0 0">Bien-être et vécu au travail : plus c'est haut, mieux c'est. Stress, épuisement et signaux d'alerte : plus c'est bas, mieux c'est.</p></div>`;
    const shown = E.GROUPS.filter((x) => x.defaut || S.ui.extraGroups.includes(x.key)).map((x) => x.key);
    const groups = `<div class="chips" role="group" aria-label="Groupes affichés">${E.GROUPS.map((x) => `<button type="button" data-act="group-toggle" data-key="${x.key}" aria-pressed="${shown.includes(x.key)}">${esc(x.label)}</button>`).join("")}</div>
      <div class="group-grid">${d.groups.filter((x) => shown.includes(x.key)).map((grp) => `<div class="card"><h3>${esc(grp.label)}</h3>
        ${grp.rows.map((r) => r.masked
          ? `<div class="grow-row"><span>${esc(r.label)}</span><div class="stack masked" title="Moins de ${E.SEUIL_ANONYMAT} réponses"></div><span class="small muted">&lt; 5</span></div>`
          : `<div class="grow-row"><span>${esc(r.label)}</span><div class="stack" aria-label="${esc(`${r.label} : ${r.VERT} satisfaisant, ${r.ORANGE} vigilance, ${r.ROUGE} à prendre en charge`)}">${r.total ? E.ZONES.map((z) => `<span class="s-${z}" style="width:${(r[z] / r.total) * 100}%"></span>`).join("") : ""}</div><strong>${r.total}</strong></div>`).join("")}
        <div class="mini-legend"><span><i class="s-VERT"></i>Satisfaisant</span><span><i class="s-ORANGE"></i>Vigilance</span><span><i class="s-ROUGE"></i>À prendre en charge</span>${grp.rows.some((r) => r.masked) ? "<span>▨ moins de 5</span>" : ""}</div>
        ${grp.multi ? '<p class="small muted" style="margin:.3rem 0 0">Plusieurs choix possibles par personne.</p>' : ""}</div>`).join("")}</div>`;
    const comp = `<div class="card"><h3>Comparaison des campagnes</h3><div class="table-wrap"><table class="rt"><thead><tr><th>Campagne</th><th class="num">Bilans</th><th class="num">Satisfaisant</th><th class="num">Vigilance</th><th class="num">À prendre en charge</th><th class="num">Bien-être moyen</th></tr></thead><tbody>
      ${d.comparison.map((x) => x.masked ? `<tr>${td("Campagne", esc(x.nom))}${td("Bilans", '<span class="muted">moins de 5</span>', "num")}${td("Satisfaisant", "—", "num")}${td("Vigilance", "—", "num")}${td("À prendre en charge", "—", "num")}${td("Bien-être moyen", "—", "num")}</tr>`
        : `<tr${x.campaignId === f.campaignId ? ' style="font-weight:700"' : ""}>${td("Campagne", esc(x.nom))}${td("Bilans", x.bilans, "num")}${td("Satisfaisant", x.VERT, "num")}${td("Vigilance", x.ORANGE, "num")}${td("À prendre en charge", x.ROUGE, "num")}${td("Bien-être moyen", x.bienEtre ?? "—", "num")}</tr>`).join("")}
    </tbody></table></div></div>`;
    return `${filters}${!d.threshold ? '<div class="banner small">Vue Admin Yodan : le seuil d\'anonymat (moins de 5) ne s\'applique pas.</div>' : ""}${tiles}${part}
      <div class="dash-row"><div class="card"><h3>Profils</h3>${donut}</div><div class="card"><h3>Dimensions (moyenne sur 100)</h3>${dims}</div></div>
      <h2>Par groupe</h2>${groups}${comp}`;
  }

  function participantsBlock(k) {
    const f = S.ui.pf, c = client(k.clientId);
    const all = E.participantRows(S.db, me(), k.id, S.now);
    const q = (s) => String(s || "").toLowerCase();
    const rows = all.filter((r) => (!f.nom || q(r.nom).includes(q(f.nom))) && (!f.email || q(r.email).includes(q(f.email))) && (!f.tel || r.tel.replace(/\s/g, "").includes(String(f.tel).replace(/\s/g, "")))
      && (!f.statut || r.statut === f.statut) && (!f.zone || r.zone === f.zone) && (!f.entretien || r.entretien === f.entretien));
    S.ui.lastParticipantRows = rows;
    return `<div class="filters card">
      <label class="field"><span>Nom</span><input type="text" data-filter="pf.nom" value="${esc(f.nom || "")}"></label>
      <label class="field"><span>E-mail</span><input type="text" data-filter="pf.email" value="${esc(f.email || "")}"></label>
      <label class="field"><span>Téléphone</span><input type="text" data-filter="pf.tel" value="${esc(f.tel || "")}"></label>
      <label class="field"><span>Statut</span><select data-filter="pf.statut"><option value="">Tous</option>${["Sans réponse", "Risque faible", "Risque modéré", "Risque critique"].map((s) => opt(s, s, f.statut)).join("")}</select></label>
      <label class="field"><span>Couleur</span><select data-filter="pf.zone"><option value="">Toutes</option>${E.ZONES.map((z) => opt(z, E.ZONE[z].couleur, f.zone)).join("")}</select></label>
      <label class="field"><span>Entretien</span><select data-filter="pf.entretien"><option value="">Tous</option>${Object.entries(E.INTERVIEW).map(([k2, l]) => opt(k2, l, f.entretien)).join("")}</select></label>
      <div class="grow"><button class="btn ghost" type="button" data-act="parts-export" data-id="${k.id}">Exporter (tableur)</button></div>
    </div>
    <p class="count">${rows.length} sur ${plural(all.length, "participant")}</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>${E.UNIT_WORD[c.type].One}</th><th>Statut</th><th>Couleur</th><th>Entretien</th><th>Dernière relance</th><th>Actions</th></tr></thead><tbody>
    ${rows.length ? rows.slice(0, 150).map((r) => `<tr>${td("Nom", `${esc(r.nom)}${r.horsListe ? ' <span class="badge plain info">hors liste</span>' : ""}`)}${td("E-mail", esc(r.email))}${td("Téléphone", `<span class="nowrap">${esc(r.tel)}</span>`)}${td(E.UNIT_WORD[c.type].One, esc(unitName(c.id, r.unitId)))}
      ${td("Statut", r.zone ? `${esc(r.statut)} <span class="muted small">· score ${r.scoreGlobal}/10</span>` : '<span class="muted">Sans réponse</span>')}
      ${td("Couleur", r.zone ? zoneBadge(r.zone, E.ZONE[r.zone].couleur) : "—")}
      ${td("Entretien", r.entretien ? itwBadge(r.entretien) : "—")}
      ${td("Dernière relance", r.lastReminder ? E.fmtDate(r.lastReminder) : "—")}
      ${td("Actions", `<div class="actions">${r.responseId ? `<button class="btn sm ghost" type="button" data-act="detail" data-id="${r.responseId}" data-from="campaign">Voir le détail</button>` : `<button class="btn sm ghost" type="button" data-act="remind" data-id="${r.inviteeId}">Relancer par e-mail</button>`}</div>`)}</tr>`).join("")
      : '<tr class="empty"><td colspan="9">Aucun participant ne correspond aux filtres.</td></tr>'}
    </tbody></table></div>${rows.length > 150 ? '<p class="count">150 premières lignes affichées (maquette).</p>' : ""}`;
  }

  /* ================= Détail d'un participant ================= */
  function viewDetail() {
    const a = me(), r = E.byId(S.db.responses, S.params.responseId);
    const back = S.params.from === "campaign" ? `<button type="button" data-act="nav" data-screen="campaign" data-campaign="${r?.campaignId}">← Retour aux participants</button>` : S.params.from === "care" ? '<button type="button" data-act="nav" data-screen="care">← Retour à « À prendre en charge »</button>' : '<button type="button" data-act="nav" data-screen="validation">← Retour à la validation</button>';
    if (!r || !E.canSeeResponse(S.db, a, r, S.now)) { return `<div class="crumbs">${back}</div><div class="banner err">Ce dossier n'est pas (ou plus) dans votre périmètre.</div>`; }
    const admin = a.role === "ADMIN_YODAN", c = client(r.clientId), k = camp(r.campaignId), z = r.result.profil;
    const st = E.careState(S.db, r, S.now);
    const v = E.imc(r.poids, r.taille), cat = E.imcCategorie(v);
    const names = (id) => { const x = E.byId(S.db.accounts, id); return x ? `${x.nom} (${E.ROLES[x.role]})` : "—"; };
    const decLabel = (d) => d.role === "ADMIN_YODAN" ? ' <span class="badge yodan plain">validée par YODAN</span>' : "";
    return `<div class="crumbs no-print">${back}</div>
    <div class="print-head"><img src="${esc(c.logo || LOGO_YODAN)}" alt=""><div><strong>Bilan individuel — confidentiel</strong><br><span class="small">${esc(k.nom)} · édité le ${E.fmtDate(S.now)}</span></div></div>
    <div class="page-head"><div><p class="eyebrow">${esc(c.nom)} · ${esc(k.nom)} · ${esc(unitName(c.id, r.unitId))}</p><h1>${admin ? esc(`${r.prenom} ${r.nom}`) : "Participant " + esc(r.pseudo)}</h1>
      <div class="small muted">Identifiant ${esc(r.pseudo)} · test terminé le ${E.fmtDateTime(r.completedAt)}</div></div>
      ${admin ? `<div class="actions no-print"><button class="btn ghost" type="button" data-act="print" data-id="${r.id}">Exporter en PDF</button><button class="btn ghost" type="button" data-act="send-result" data-id="${r.id}">Envoyer le résultat au participant</button></div>` : ""}</div>
    <div class="two-col">
      <section class="card"><h3>Résultat</h3><div class="result-head"><span class="big-badge ${z}">${esc(E.ZONE[z].libelle)}</span><div><strong>${esc(E.ZONE[z].risque)}</strong><br>Score global : <strong>${r.result.scoreGlobal}/10</strong>${r.result.signalFort ? ' · <span class="badge ROUGE">signal d\'alerte fort</span>' : ""}</div></div>
        <div class="table-wrap" style="margin-top:.8rem"><table class="rt"><thead><tr><th>Partie</th><th class="num">Score brut</th><th class="num">Sur 100</th><th>Niveau</th></tr></thead><tbody>
        ${E.DIMS.map((d) => { const x = r.result.dims[d.key]; return `<tr>${td("Partie", `${esc(d.label)}${d.source ? ` <span class="muted small">${d.source}</span>` : ""}`)}${td("Score brut", `${x.brut} <span class="muted small">(${x.echelle})</span>`, "num")}${td("Sur 100", Math.round(x.s100), "num")}${td("Niveau", zoneBadge(x.zone, x.zone === "VERT" ? "Bon" : x.zone === "ORANGE" ? "Modéré" : "Préoccupant"))}</tr>`; }).join("")}
        </tbody></table></div>
        <h3 style="margin-top:1rem">Interprétation</h3>${TX.interpretation[z].paragraphes.map((p) => `<p class="small">${esc(p)}</p>`).join("")}</section>
      <div>
        <section class="card section-card"><h3>Prise en charge</h3><p style="margin-top:0"><strong>${esc(E.careLabel(S.db, r, S.now))}</strong>${st.since ? ` · depuis le ${E.fmtDate(st.since)}` : ""}${st.closedAt ? ` · close le ${E.fmtDate(st.closedAt)}` : ""}</p>
          ${c.type === "M" ? `<p class="small muted">Délai de la région : ${plural(r.delayDays, "jour")}, ${E.deadlineOf(S.db, r, S.now) ? `échéance le ${E.fmtDateTime(E.deadlineOf(S.db, r, S.now))}` : "il démarrera à la validation de l'avis du psychologue"}.</p>` : ""}
          ${r.decisions.length ? `<ul class="timeline">${r.decisions.filter((d) => d.at <= S.now).map((d) => `<li class="${d.revokedAt != null && d.revokedAt <= S.now ? "revoked" : ""}">${E.fmtDateTime(d.at)} · ${esc(names(d.by))} : prise en charge <strong>${d.value ? "Oui" : "Non"}</strong>${decLabel(d)}${d.revokedAt != null && d.revokedAt <= S.now ? ` — annulée le ${E.fmtDate(d.revokedAt)} par ${esc(names(d.revokedBy))}` : ""}</li>`).join("")}</ul>` : ""}
          ${decisionButtons(a, r, st)}
        </section>
        ${interviewSection(a, r)}
        ${admin && r.resultSentAt ? `<p class="small muted">Résultat envoyé le ${E.fmtDateTime(r.resultSentAt)} (lien sécurisé).</p>` : ""}
        ${admin ? `
        <section class="card section-card"><h3>Questionnaire général</h3><dl class="kv">
          <dt>E-mail</dt><dd>${esc(r.email)}</dd><dt>Genre</dt><dd>${esc(r.genre)}</dd><dt>Tranche d'âge</dt><dd>${esc(r.age)}</dd>
          <dt>Ancienneté entreprise</dt><dd>${esc(r.ancEnt)}</dd><dt>Ancienneté au poste</dt><dd>${esc(r.ancPoste)}</dd>
          <dt>Poids / taille</dt><dd>${r.poids} kg · ${r.taille} cm</dd><dt>IMC</dt><dd>${String(v).replace(".", ",")} kg/m² · ${esc(cat.categorie)}</dd>
          <dt>Antécédents</dt><dd>${r.antecedents.length ? esc(r.antecedents.join(", ")) : "Aucun"}</dd>
          <dt>Consentement</dt><dd>${E.fmtDateTime(r.consentAt)} · ${esc(r.consentVersion)}${r.consentAvis ? " · transmission de l'avis acceptée" : ""}</dd><dt>Liste de campagne</dt><dd>${r.inviteeId ? "Oui" : "Hors liste"}</dd></dl></section>` : ""}
      </div></div>`;
  }
  function decisionButtons(a, r, st, short = false) {
    if (r.result.profil !== "ORANGE") { return ""; }
    const yesNo = (off = false) => `<div class="actions no-print">${short ? "" : '<span class="small" style="align-self:center">Prise en charge :</span>'}<button class="btn sm yes" type="button" data-act="decide" data-id="${r.id}" data-value="1"${off ? " disabled" : ""}>Oui</button><button class="btn sm no" type="button" data-act="decide" data-id="${r.id}" data-value="0"${off ? " disabled" : ""}>Non</button></div>${off ? '<p class="small muted" style="margin:.3rem 0 0">Disponible après la validation de l\'avis du psychologue.</p>' : ""}`;
    if (!["ADMIN_YODAN", "VALIDATEUR", "SUP_SECONDAIRE"].includes(a.role)) { return ""; }
    if (st.state === "INTERVIEW") { return yesNo(true); }
    if (E.yodanDecision(r, S.now)) { return '<p class="small" style="margin:.3rem 0 0"><span class="badge yodan plain">Validée par YODAN</span> décision définitive</p>'; }
    if (a.role === "ADMIN_YODAN") { return st.state === "PENDING" ? yesNo() : ""; }
    if (st.state === "PENDING") { return yesNo(); }
    if (st.state === "PROVISIONAL" && a.role === "SUP_SECONDAIRE") { return `<div class="actions no-print"><button class="btn sm danger" type="button" data-act="revoke" data-id="${r.id}">${short ? "Annuler" : "Annuler la décision"}</button><button class="btn sm ghost" type="button" data-act="decide" data-id="${r.id}" data-value="${st.decision.value ? 0 : 1}">${short ? "" : "Décider à sa place : "}${st.decision.value ? "Non" : "Oui"}</button></div>`; }
    return "";
  }
  /** Avis orienté décision (champs fermés), en lecture. */
  function avisBlock(av) {
    const A = TX.avis, psy = E.byId(S.db.accounts, av.by);
    return `<dl class="kv"><dt>Entretien réalisé le</dt><dd>${av.date ? E.fmtDate(E.day(av.date)) : "—"}</dd>
      <dt>Risque du test</dt><dd>${esc(A.risque[av.risque] || "—")}</dd>
      <dt>Recommandation</dt><dd>${av.reco === true ? "Prise en charge recommandée" : av.reco === false ? "Pas de prise en charge recommandée" : "—"}</dd>
      ${av.reco ? `<dt>Accompagnement</dt><dd>${esc(A.type[av.type] || "—")}</dd><dt>Urgence</dt><dd>${av.urgence === "PRIORITAIRE" ? '<span class="badge ROUGE plain">Prioritaire</span>' : esc(A.urgence[av.urgence] || "—")}</dd>` : ""}
      <dt>Commentaire</dt><dd>${av.commentaire ? esc(av.commentaire) : '<span class="muted">—</span>'}</dd>
      <dt>Psychologue</dt><dd>${esc(psy ? psy.nom : "—")}${av.validatedAt ? ` · validé le ${E.fmtDateTime(av.validatedAt)}` : ' · <span class="badge info plain">brouillon</span>'}</dd></dl>`;
  }
  /** Section Entretien de la fiche : ce que voit le rôle (interviewView). */
  function interviewSection(a, r) {
    const V = E.interviewView(S.db, a, r, S.now), st = E.interviewState(r, S.now);
    if (!["ADMIN_YODAN", "VALIDATEUR", "SUP_SECONDAIRE"].includes(a.role)) { return ""; }
    const status = `<p style="margin-top:0">${itwBadge(st)}${r.interview.report && r.interview.report.savedAt <= S.now && a.role === "ADMIN_YODAN" ? ` · ${esc(E.byId(S.db.accounts, r.interview.report.by).nom)}` : ""}${a.role === "ADMIN_YODAN" ? ` · téléphone <strong>${esc(r.tel)}</strong>` : ""}</p>`;
    const avis = V.avis ? `<h4 style="margin:.6rem 0 .3rem">Avis orienté décision</h4>${avisBlock(V.avis)}` : `<p class="small muted">${st === "VALIDE" ? "" : "L'avis n'existe pour les décideurs qu'une fois validé par le psychologue."}</p>`;
    const report = V.canSeeReport
      ? `<h4 style="margin:.8rem 0 .3rem">Rapport d'entretien <span class="badge off plain">PDF · reste chez Yodan</span></h4>${V.report ? reportFileLine(r, V.report) : '<p class="small muted">Pas encore déposé.</p>'}`
      : '<p class="small muted" style="margin-bottom:0">Le rapport d\'entretien (PDF du psychologue) reste chez Yodan : il n\'est pas visible ici.</p>';
    return `<section class="card section-card"><h3>Entretien psychologue</h3>${status}${avis}${report}</section>`;
  }

  /* ================= Validation ================= */
  function viewValidation() {
    const a = me(), f = S.ui.val;
    const rows = E.validationQueue(S.db, a, S.now, f);
    const isAdmin = a.role === "ADMIN_YODAN";
    const clients = S.db.clients.filter((c) => c.active);
    const campaigns = S.db.campaigns.filter((k) => (isAdmin ? !f.clientId || k.clientId === f.clientId : k.clientId === a.clientId));
    const c = a.clientId ? client(a.clientId) : null;
    const avisCell = (r, st) => {
      const V = E.interviewView(S.db, a, r, S.now);
      if (!V.avis) { return `<span class="badge ORANGE">${E.INTERVIEW[E.interviewState(r, S.now)]}</span>`; }
      return `${V.avis.reco ? `<span class="badge VERT plain">Prise en charge recommandée</span>` : '<span class="badge off plain">Prise en charge non recommandée</span>'}${V.avis.urgence === "PRIORITAIRE" ? ' <span class="badge ROUGE plain">prioritaire</span>' : ""}<br><span class="small muted">${esc(TX.avis.risque[V.avis.risque])}</span>`;
    };
    const waitCell = (r, st) => {
      if (st.state === "INTERVIEW") { return '<span class="badge off plain">Entretien en attente</span><br><span class="small muted">délai non démarré</span>'; }
      if (E.yodanDecision(r, S.now)) { return `<span class="badge yodan plain">Validée par YODAN</span><br><span class="small muted">le ${E.fmtDate(E.yodanDecision(r, S.now).at)}</span>`; }
      if (st.state === "PROVISIONAL") { return `<span class="badge info">${esc(E.careLabel(S.db, r, S.now))}</span><br><span class="small muted">par ${esc(E.byId(S.db.accounts, st.decision.by).nom)}</span>`; }
      return `<span class="badge ${st.overdueDays != null ? "ROUGE" : "ORANGE"} plain">Décision ouverte · ${esc(E.waitLabel(S.db, r, S.now))}</span>`;
    };
    return `<div class="page-head"><div><p class="eyebrow">${isAdmin ? "Admin Yodan · cas orange de tous les clients" : `${esc(c.nom)} · ${esc(E.ROLES[a.role])} · ${esc(a.units.map((u) => unitName(c.id, u)).join(", "))}`}</p><h1>${isAdmin ? "Validation" : "Décisions de prise en charge"}</h1></div></div>
    <p class="muted small" style="margin-top:-.5rem">${isAdmin ? "Vous voyez le rapport et l'avis de chaque dossier. Votre décision est immédiate et définitive, pour une Entreprise comme pour une Mutuelle (mention « validée par YODAN »)." : a.role === "VALIDATEUR" ? "La décision s'ouvre quand l'avis du psychologue est validé ; le délai de la région démarre à ce moment. Votre décision s'applique à la fin du délai ; le superviseur secondaire peut l'annuler d'ici là." : "Vous pouvez annuler une décision du médecin-conseil ou décider à sa place tant que le délai court. Rien n'est possible avant la validation de l'avis."}</p>
    <div class="filters card">
      ${isAdmin ? `<label class="field"><span>Client</span><select data-filter="val.clientId"><option value="">Tous</option>${clients.map((x) => opt(x.id, `${x.nom} (${x.type === "E" ? "Entreprise" : "Mutuelle"})`, f.clientId)).join("")}</select></label>` : ""}
      <label class="field"><span>Campagne</span><select data-filter="val.campaignId"><option value="">Toutes</option>${campaigns.map((k) => opt(k.id, (isAdmin && !f.clientId ? client(k.clientId).nom + " · " : "") + k.nom, f.campaignId)).join("")}</select></label>
      <label class="field"><span>État</span><select data-filter="val.etat"><option value="">Tous</option>${opt("INTERVIEW", "Entretien en attente", f.etat)}${opt("PENDING", "Décision ouverte", f.etat)}${isAdmin ? "" : opt("PROVISIONAL", "Décision pendant le délai", f.etat) + opt("YODAN", "Validée par YODAN", f.etat)}</select></label>
    </div>
    <p class="count">${rows.length} cas</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Identifiant</th><th>${isAdmin ? "Client" : "Région"}</th><th>Campagne</th><th class="num">Score global</th><th>Avis du psychologue</th><th>Attente</th><th>Actions · prise en charge ?</th></tr></thead><tbody>
    ${rows.length ? rows.map((r) => { const st = E.careState(S.db, r, S.now); const see = E.canSeeResponse(S.db, a, r, S.now); return `<tr>${td("Identifiant", `<strong>${esc(r.pseudo)}</strong>`)}${td(isAdmin ? "Client" : "Région", esc(isAdmin ? client(r.clientId).nom : unitName(r.clientId, r.unitId)))}${td("Campagne", esc(camp(r.campaignId).nom))}${td("Score global", `${r.result.scoreGlobal}/10`, "num")}
      ${td("Avis du psychologue", avisCell(r, st))}${td("Attente", waitCell(r, st))}
      ${td("Actions", `<div class="actions">${see ? `<button class="btn sm ghost" type="button" data-act="detail" data-id="${r.id}" data-from="validation">${isAdmin ? "Rapport, avis et détail" : "Voir le détail et l'avis"}</button>` : ""}</div><div style="margin-top:.3rem">${decisionButtons(a, r, st, true)}</div>`)}</tr>`; }).join("")
      : '<tr class="empty"><td colspan="7">Aucun cas orange à traiter.</td></tr>'}
    </tbody></table></div>`;
  }

  /* ================= À prendre en charge ================= */
  function viewCare() {
    const f = S.ui.care, q = (s) => String(s || "").toLowerCase();
    const all = E.careRows(S.db, me(), S.now, f);
    const rows = all.filter((r) => (!f.nom || q(r.nom).includes(q(f.nom))) && (!f.email || q(r.email).includes(q(f.email))) && (!f.tel || r.tel.replace(/\s/g, "").includes(String(f.tel).replace(/\s/g, ""))) && (!f.zone || r.zone === f.zone) && (!f.state || r.state === f.state));
    S.ui.lastCareRows = rows;
    return `<div class="page-head"><div><p class="eyebrow">Admin Yodan</p><h1>À prendre en charge</h1></div></div>
    <p class="muted small" style="margin-top:-.5rem">Prises en charge confirmées, toujours après l'avis validé du psychologue : risque critique, ou risque modéré décidé « Oui ». « Passer à clos » ne concerne que la prise en charge.</p>
    <div class="filters card">
      <label class="field"><span>Nom</span><input type="text" data-filter="care.nom" value="${esc(f.nom || "")}"></label>
      <label class="field"><span>E-mail</span><input type="text" data-filter="care.email" value="${esc(f.email || "")}"></label>
      <label class="field"><span>Téléphone</span><input type="text" data-filter="care.tel" value="${esc(f.tel || "")}"></label>
      <label class="field"><span>Niveau de risque</span><select data-filter="care.zone"><option value="">Tous</option>${opt("ORANGE", "Risque modéré", f.zone)}${opt("ROUGE", "Risque critique", f.zone)}</select></label>
      <label class="field"><span>Client</span><select data-filter="care.clientId"><option value="">Tous</option>${S.db.clients.map((c) => opt(c.id, c.nom, f.clientId)).join("")}</select></label>
      <label class="field"><span>Campagne</span><select data-filter="care.campaignId"><option value="">Toutes</option>${S.db.campaigns.filter((k) => !f.clientId || k.clientId === f.clientId).map((k) => opt(k.id, k.nom, f.campaignId)).join("")}</select></label>
      <label class="field"><span>État</span><select data-filter="care.state"><option value="">Tous</option>${opt("ACTIVE", "En cours", f.state)}${opt("CLOSED", "Close", f.state)}</select></label>
      <div class="grow"><button class="btn ghost" type="button" data-act="care-export">Exporter les prises en charge en cours</button></div>
    </div>
    <p class="count">${plural(rows.length, "personne")}</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Statut</th><th>Depuis</th><th>Campagne</th><th>Action</th></tr></thead><tbody>
    ${rows.length ? rows.slice(0, 150).map((r) => `<tr>${td("Nom", `<button type="button" class="link" data-act="detail" data-id="${r.responseId}" data-from="care">${esc(r.nom)}</button>`)}${td("E-mail", esc(r.email))}${td("Téléphone", `<span class="nowrap">${esc(r.tel)}</span>`)}
      ${td("Statut", `${zoneBadge(r.zone, E.ZONE[r.zone].risque)} <span class="badge ${r.state === "ACTIVE" ? "info" : "off"} plain">${r.state === "ACTIVE" ? "En cours" : "Close le " + E.fmtDate(r.closedAt)}</span>`)}
      ${td("Depuis", E.fmtDate(r.since))}${td("Campagne", `<button type="button" class="link" data-act="nav" data-screen="campaign" data-campaign="${r.campaignId}">${esc(camp(r.campaignId).nom)}</button><br><span class="small muted">${esc(client(r.clientId).nom)}</span>`)}
      ${td("Action", r.state === "ACTIVE" ? `<button class="btn sm" type="button" data-act="care-close" data-id="${r.responseId}">Passer à clos</button>` : "—")}</tr>`).join("")
      : '<tr class="empty"><td colspan="7">Aucune prise en charge ne correspond aux filtres.</td></tr>'}
    </tbody></table></div>`;
  }

  /* ================= Psychologues (Admin Yodan) ================= */
  function viewPsychologues() {
    const list = S.db.accounts.filter((x) => x.role === "PSYCHOLOGUE");
    return `<div class="page-head"><div><p class="eyebrow">Admin Yodan</p><h1>Psychologues</h1></div><button class="btn" type="button" data-act="psy-new">+ Créer un compte psychologue</button></div>
    <p class="muted small" style="margin-top:-.5rem">Le psychologue rédige le rapport d'entretien et l'avis orienté décision pour les campagnes qui lui sont attribuées. Il voit les participants sous pseudonyme, sans coordonnées.</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Nom</th><th>E-mail</th><th>Statut</th><th class="num">Campagnes</th><th class="num">Rapports en cours</th><th class="num">Avis validés</th><th>Dernière connexion</th><th>Actions</th></tr></thead><tbody>
    ${list.map((p) => { const s = E.psychologueStats(S.db, p.id, S.now); return `<tr class="${p.active ? "" : "row-off"}">${td("Nom", `<strong>${esc(p.nom)}</strong>`)}${td("E-mail", esc(p.email))}
      ${td("Statut", p.active ? (p.mustChange ? '<span class="badge info">Invitation envoyée</span>' : '<span class="badge VERT">Actif</span>') : '<span class="badge off">Désactivé</span>')}
      ${td("Campagnes", s.campagnes, "num")}${td("Rapports en cours", s.enCours, "num")}${td("Avis validés", s.valides, "num")}
      ${td("Dernière connexion", p.lastLogin ? E.fmtDateTime(p.lastLogin) : '<span class="muted">Jamais</span>')}
      ${td("Actions", `<div class="actions">${p.active && p.mustChange ? `<button class="btn sm ghost" type="button" data-act="account-pwd" data-id="${p.id}">Renvoyer l'invitation</button>` : ""}<button class="btn sm ${p.active ? "danger" : "ghost"}" type="button" data-act="psy-toggle" data-id="${p.id}">${p.active ? "Désactiver" : "Réactiver"}</button></div>`)}</tr>`; }).join("")}
    </tbody></table></div>`;
  }
  function psyModal(d, errors = []) {
    return `<h2>Créer un compte psychologue</h2>${errors.length ? `<div class="banner err" role="alert"><ul>${errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <form data-form="psy" novalidate><div class="form-grid">
      <label class="field"><span>Nom <span class="req">*</span></span><input type="text" name="nom" value="${esc(d.nom || "")}"></label>
      <label class="field"><span>E-mail <span class="req">*</span></span><input type="email" name="email" value="${esc(d.email || "")}"></label></div>
    <p class="small muted">Une invitation est envoyée par e-mail pour définir le mot de passe. Double authentification (code par e-mail) à chaque connexion.</p>
    <div class="form-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn" type="submit">Créer et inviter</button></div></form>`;
  }

  /* ================= Espace Psychologue ================= */
  function viewInterviews() {
    const a = me(), f = S.ui.psy;
    const mine = S.db.campaigns.filter((k) => k.psychologueIds.includes(a.id));
    const rows = E.psyRows(S.db, a, S.now, f);
    const all = E.psyRows(S.db, a, S.now);
    const count = (st) => all.filter((x) => x.state === st).length;
    return `<div class="page-head"><div><p class="eyebrow">${esc(a.nom)} · Psychologue</p><h1>Mes entretiens</h1></div></div>
    <div class="tiles"><div class="tile ORANGE"><div class="v">${count("A_FAIRE")}</div><div class="l">Entretiens à faire</div></div><div class="tile"><div class="v">${count("BROUILLON")}</div><div class="l">Rapports en cours</div></div><div class="tile VERT"><div class="v">${count("VALIDE")}</div><div class="l">Avis validés</div></div></div>
    <div class="filters card">
      <label class="field"><span>Campagne</span><select data-filter="psy.campaignId"><option value="">Toutes mes campagnes</option>${mine.map((k) => opt(k.id, `${client(k.clientId).nom} · ${k.nom}`, f.campaignId)).join("")}</select></label>
      <label class="field"><span>Statut du rapport</span><select data-filter="psy.state"><option value="">Tous</option>${Object.entries(E.INTERVIEW).map(([k, l]) => opt(k, l, f.state)).join("")}</select></label>
    </div>
    <p class="count">${plural(rows.length, "participant")}</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Identifiant</th><th>Client · campagne</th><th>Test terminé le</th><th>Résultat du test</th><th>Statut du rapport</th><th>Action</th></tr></thead><tbody>
    ${rows.length ? rows.slice(0, 150).map((x) => `<tr>${td("Identifiant", `<strong>${esc(x.pseudo)}</strong>`)}${td("Client · campagne", `${esc(client(x.clientId).nom)}<br><span class="small muted">${esc(camp(x.campaignId).nom)}</span>`)}
      ${td("Test terminé le", E.fmtDate(x.completedAt))}${td("Résultat du test", `${zoneBadge(x.zone)} <span class="small muted">${x.scoreGlobal}/10</span>`)}${td("Statut du rapport", itwBadge(x.state))}
      ${td("Action", `<button class="btn sm${x.state === "VALIDE" ? " ghost" : ""}" type="button" data-act="nav-itw" data-id="${x.responseId}">${x.state === "VALIDE" ? "Consulter" : x.state === "BROUILLON" ? "Reprendre" : "Ouvrir"}</button>`)}</tr>`).join("")
      : '<tr class="empty"><td colspan="6">Aucun participant ne correspond aux filtres.</td></tr>'}
    </tbody></table></div>${rows.length > 150 ? '<p class="count">150 premières lignes affichées (maquette).</p>' : ""}`;
  }

  function viewInterview() {
    const a = me(), r = E.byId(S.db.responses, S.params.responseId);
    const back = '<div class="crumbs"><button type="button" data-act="nav" data-screen="interviews">← Mes entretiens</button></div>';
    if (!r || !E.canSeeResponse(S.db, a, r, S.now)) { return `${back}<div class="banner err">Ce dossier n'est pas dans vos campagnes.</div>`; }
    const k = camp(r.campaignId), c = client(r.clientId), z = r.result.profil, A = TX.avis;
    const V = E.interviewView(S.db, a, r, S.now), st = E.interviewState(r, S.now), locked = st === "VALIDE";
    const ui = S.ui.itw;
    const av = ui.avis || (V.avis ? { ...V.avis } : { date: E.isoDate(S.now), risque: "", reco: null, type: "", urgence: "", commentaire: "" });
    ui.avis = av;
    const radio = (name, value, label, cur, dis) => `<label${dis ? ' class="disabled"' : ""}><input type="radio" name="${name}" value="${value}"${String(cur) === String(value) ? " checked" : ""}${dis ? " disabled" : ""} data-avis-live> ${esc(label)}</label>`;
    const avisForm = locked ? `${avisBlock(V.avis)}<div class="banner ok" style="margin-top:.8rem">Avis validé et verrouillé. Il est visible par les décideurs (médecin-conseil et superviseur secondaire de la mutuelle, ou Yodan).</div>`
      : `${ui.errors.length ? `<div class="banner err" role="alert"><strong>À corriger avant validation :</strong><ul>${ui.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <form data-form="avis" novalidate><div class="form-grid">
        <label class="field"><span>Entretien réalisé le <span class="req">*</span></span><input type="date" name="date" value="${esc(av.date)}" min="${E.isoDate(r.completedAt)}" max="${E.isoDate(S.now)}"></label>
        <fieldset class="field full"><legend>Niveau de risque du test (${esc(E.ZONE[z].risque.toLowerCase())}) <span class="req">*</span></legend><div class="choices">${E.RISQUES.map((x) => radio("risque", x, A.risque[x], av.risque)).join("")}</div></fieldset>
        <fieldset class="field full"><legend>Recommandation de prise en charge <span class="req">*</span></legend><div class="choices">${radio("reco", "1", "Oui", av.reco === true ? "1" : "")}${radio("reco", "0", "Non", av.reco === false ? "0" : "")}</div></fieldset>
        <fieldset class="field"><legend>Type d'accompagnement${av.reco ? ' <span class="req">*</span>' : ""}</legend><div class="choices">${E.TYPES.map((x) => radio("type", x, A.type[x], av.type, av.reco !== true)).join("")}</div>${av.reco !== true ? '<span class="hint">Seulement si la recommandation est « Oui ».</span>' : ""}</fieldset>
        <fieldset class="field"><legend>Degré d'urgence${av.reco ? ' <span class="req">*</span>' : ""}</legend><div class="choices">${E.URGENCES.map((x) => radio("urgence", x, A.urgence[x], av.urgence, av.reco !== true)).join("")}</div></fieldset>
        <label class="field full"><span>Commentaire court destiné au décideur</span><textarea name="commentaire" rows="3" maxlength="${A.commentaireMax}">${esc(av.commentaire)}</textarea><span class="hint"><strong>${esc(A.consigneCommentaire)}</strong> ${A.commentaireMax} caractères maximum.</span></label>
      </div>
      <div class="form-actions"><button class="btn ghost" type="submit" name="intent" value="save">Enregistrer le brouillon</button><button class="btn" type="submit" name="intent" value="validate">Valider l'avis…</button></div></form>`;
    return `${back}
    <div class="page-head"><div><p class="eyebrow">${esc(c.nom)} · ${esc(k.nom)}</p><h1>Participant ${esc(r.pseudo)}</h1><div class="small muted">Test terminé le ${E.fmtDateTime(r.completedAt)} · ${itwBadge(st)}</div></div></div>
    <div class="banner small">Vous voyez le participant sous pseudonyme, sans coordonnées${c.type === "M" ? " ; il a accepté la transmission de l'avis à sa mutuelle" : ""}. Les coordonnées pour l'appel sont gérées par Yodan.</div>
    <div class="two-col">
      <section class="card"><h3>Résultat du test <span class="badge off plain">lecture seule</span></h3><div class="result-head"><span class="big-badge ${z}">${esc(E.ZONE[z].libelle)}</span><div><strong>${esc(E.ZONE[z].risque)}</strong><br>Score global : <strong>${r.result.scoreGlobal}/10</strong>${r.result.signalFort ? ' · <span class="badge ROUGE">signal d\'alerte fort</span>' : ""}</div></div>
        <div class="table-wrap" style="margin-top:.8rem"><table class="rt"><thead><tr><th>Partie</th><th class="num">Sur 100</th><th>Niveau</th></tr></thead><tbody>
        ${E.DIMS.map((d) => { const x = r.result.dims[d.key]; return `<tr>${td("Partie", `${esc(d.label)}${d.source ? ` <span class="muted small">${d.source}</span>` : ""}`)}${td("Sur 100", Math.round(x.s100), "num")}${td("Niveau", zoneBadge(x.zone, x.zone === "VERT" ? "Bon" : x.zone === "ORANGE" ? "Modéré" : "Préoccupant"))}</tr>`; }).join("")}
        </tbody></table></div></section>
      <div>
        <section class="card section-card"><h3>1. Rapport d'entretien <span class="badge off plain">PDF · reste chez Yodan</span></h3>
          ${V.report ? reportFileLine(r, V.report) : '<p class="small muted" style="margin-top:0">Aucun rapport déposé.</p>'}
          <label class="field"><span>${V.report ? "Remplacer le PDF" : "Déposer le rapport (PDF)"}</span><input type="file" accept=".pdf,application/pdf" data-report-upload></label>
          <span class="hint">Rédigé hors de la plateforme. PDF uniquement, 10 Mo maximum. Jamais transmis ni exporté vers la mutuelle ou l'employeur.${V.report ? " Un nouveau dépôt remplace la version précédente." : ""}</span></section>
        <section class="card section-card"><h3>2. Avis orienté décision</h3>
          <p class="small muted" style="margin-top:0">Seule cette couche sort de Yodan, en champs fermés. Tant qu'il n'est pas validé, l'avis n'existe pour personne d'autre.</p>
          ${avisForm}</section>
      </div></div>`;
  }
  function readAvisForm(form) {
    const fd = new FormData(form), av = S.ui.itw.avis;
    av.date = String(fd.get("date") || ""); av.risque = String(fd.get("risque") || "");
    const reco = fd.get("reco"); av.reco = reco === "1" ? true : reco === "0" ? false : null;
    av.type = av.reco ? String(fd.get("type") || "") : ""; av.urgence = av.reco ? String(fd.get("urgence") || "") : "";
    av.commentaire = String(fd.get("commentaire") || "");
  }
  /** Ligne « fichier PDF » du rapport. Maquette : le fichier déposé reste dans ce navigateur (aucun envoi). */
  function reportFileLine(r, rep) {
    const blob = S.blobs[r.id];
    return `<p class="small" style="margin:0 0 .5rem"><strong>${esc(rep.fileName)}</strong> · ${Math.max(1, Math.round(rep.size / 1024))} Ko · version ${rep.version || 1} · déposé le ${E.fmtDateTime(rep.savedAt)}
      <button type="button" class="btn sm ghost" data-act="report-open" data-id="${r.id}">${blob ? "Ouvrir le PDF" : "Ouvrir le PDF (fictif)"}</button></p>`;
  }

  /* ================= Historique ================= */
  function viewHistory() {
    const a = me(), f = S.ui.hist;
    const list = E.historyFor(S.db, a, f);
    const actorIds = [...new Set(E.historyFor(S.db, a, {}).map((e) => e.actorId).filter(Boolean))];
    const who = (e) => { if (!e.actorId) { return '<span class="muted">Participant (sans compte)</span>'; } const x = E.byId(S.db.accounts, e.actorId); return `${esc(x.nom)}<br><span class="small muted">${esc(E.ROLES[x.role])}${x.clientId ? " · " + esc(client(x.clientId).nom) : ""}</span>`; };
    return `<div class="page-head"><div><p class="eyebrow">${a.role === "ADMIN_YODAN" ? "Admin Yodan" : esc(client(a.clientId).nom)}</p><h1>${a.role === "ADMIN_YODAN" ? "Historique" : "Historique interne"}</h1></div></div>
    <p class="muted small" style="margin-top:-.5rem">Journal en écriture seule. Il ne contient aucune donnée de santé : ni score, ni réponse, ni résultat de décision.</p>
    <div class="filters card">
      <label class="field"><span>Compte</span><select data-filter="hist.actorId"><option value="">Tous</option>${actorIds.map((id) => { const x = E.byId(S.db.accounts, id); return opt(id, `${x.nom} (${E.ROLES[x.role]})`, f.actorId); }).join("")}</select></label>
      <label class="field"><span>Du</span><input type="date" data-filter="hist.from" value="${esc(f.from || "")}"></label>
      <label class="field"><span>Au</span><input type="date" data-filter="hist.to" value="${esc(f.to || "")}"></label>
    </div>
    <p class="count">${plural(list.length, "action")}${list.length > 200 ? " · 200 plus récentes affichées" : ""}</p>
    <div class="table-wrap"><table class="rt"><thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Information</th></tr></thead><tbody>
    ${list.length ? list.slice(0, 200).map((e) => `<tr>${td("Date", `<span class="nowrap">${E.fmtDateTime(e.at)}</span>`)}${td("Auteur", who(e))}${td("Action", `${esc(e.action)}${e.onBehalf ? ' <span class="badge yodan plain">par Yodan pour le compte du client</span>' : ""}`)}${td("Information", `${esc(e.target)}${e.clientId && a.role === "ADMIN_YODAN" ? `<br><span class="small muted">${esc(client(e.clientId).nom)}</span>` : ""}`)}</tr>`).join("") : '<tr class="empty"><td colspan="4">Aucune action sur cette période.</td></tr>'}
    </tbody></table></div>`;
  }

  /* ================= Modale ================= */
  function openModal(html, wide = false) { S.modal = { html, wide }; renderModal(); }
  function closeModal() { S.modal = null; renderModal(); }
  function renderModal() {
    const root = $("#modal-root");
    root.innerHTML = S.modal ? `<div class="modal${S.modal.wide ? " wide" : ""}" role="dialog" aria-modal="true">${S.modal.html}</div>` : "";
    if (S.modal) { applyThemeTo(root); const f = root.querySelector("input, select, button"); if (f) { f.focus(); } }
  }
  function applyThemeTo(el) { const t = currentTheme(); el.style.setProperty("--brand", t.primary); el.style.setProperty("--on-brand", t.onPrimary); el.style.setProperty("--brand-ink", t.ink); el.style.setProperty("--brand-soft", t.soft); }
  function confirmModal(title, text, act, data, label = "Confirmer") {
    openModal(`<h2>${esc(title)}</h2><p>${text}</p><div class="form-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button type="button" class="btn" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>${esc(label)}</button></div>`);
  }

  /* ================= Actions (clics) ================= */
  const ACT = {
    nav(el) { const p = {}; if (el.dataset.client) { p.clientId = el.dataset.client; } if (el.dataset.campaign) { p.campaignId = el.dataset.campaign; } if (el.dataset.screen === "campaignForm") { S.ui.kd = null; } if (el.dataset.screen === "campaigns") { S.ui.kf = {}; } go(el.dataset.screen, p); },
    logout() { S.mode = "login"; S.accountId = null; S.login = { step: "cred", info: "Vous êtes déconnecté(e)." }; render(); },
    tab(el) { S.params.tab = el.dataset.tab; render(); },
    detail(el) { go("detail", { responseId: el.dataset.id, from: el.dataset.from }); },
    "modal-close": closeModal,
    copy(el) { (navigator.clipboard ? navigator.clipboard.writeText(el.dataset.text) : Promise.reject()).then(() => toast("Lien copié."), () => toast("Copie impossible dans ce navigateur.", true)); },
    print(el) { const r = E.byId(S.db.responses, el.dataset.id); log("Export PDF du bilan individuel", r.pseudo, r.clientId); window.print(); },
    "send-result"(el) {
      const r = E.byId(S.db.responses, el.dataset.id);
      confirmModal("Envoyer le résultat", `Un e-mail <strong>sans aucune donnée de santé</strong> sera envoyé à ${esc(r.email)} avec un lien sécurisé. Le participant confirme son identité par un code OTP avant de télécharger son PDF.`, "send-result-ok", { id: r.id }, "Envoyer");
    },
    "send-result-ok"(el) { const r = E.byId(S.db.responses, el.dataset.id); r.resultSentAt = S.now; log("Envoi du résultat au participant (lien sécurisé)", r.pseudo, r.clientId); pushMail(r.email, TX.emails.resultat()); closeModal(); render(); },
    decide(el) {
      const r = E.byId(S.db.responses, el.dataset.id), v = el.dataset.value === "1", c = client(r.clientId), st = E.careState(S.db, r, S.now);
      const txt = me().role === "ADMIN_YODAN" ? `Décision prise par Yodan${c.type === "M" ? " pour le compte de la mutuelle" : ""} : elle s'applique immédiatement, ne peut plus être modifiée et apparaît « validée par YODAN ».`
        : st.deadline && S.now < st.deadline ? `La décision s'appliquera à la fin du délai, le ${E.fmtDateTime(st.deadline)}. D'ici là, le superviseur secondaire peut l'annuler.` : "Le délai est écoulé : la décision s'applique immédiatement.";
      confirmModal(`Prise en charge : ${v ? "Oui" : "Non"} pour ${r.pseudo}`, esc(txt) + (v ? " La prise en charge se fait toujours avec l'accord de la personne." : ""), "decide-ok", { id: r.id, value: v ? 1 : 0 });
    },
    "decide-ok"(el) { attempt(() => { E.decide(S.db, me(), el.dataset.id, el.dataset.value === "1", S.now); toast("Décision enregistrée."); }); closeModal(); render(); },
    revoke(el) { confirmModal("Annuler la décision du médecin-conseil", "Le cas redevient « décision ouverte » ; le médecin-conseil ou vous-même pourrez décider à nouveau tant que le délai court.", "revoke-ok", { id: el.dataset.id }, "Annuler la décision"); },
    "revoke-ok"(el) { attempt(() => { E.revoke(S.db, me(), el.dataset.id, S.now); toast("Décision annulée : le cas est de nouveau en attente."); }); closeModal(); render(); },
    "care-close"(el) { const r = E.byId(S.db.responses, el.dataset.id); confirmModal("Clore la prise en charge", `Clore la prise en charge de ${esc(r.prenom + " " + r.nom)} ? Le statut de l'entretien n'est pas modifié.`, "care-close-ok", { id: r.id }, "Passer à clos"); },
    "care-close-ok"(el) { attempt(() => { E.closeCare(S.db, me(), el.dataset.id, S.now); toast("Prise en charge close."); }); closeModal(); render(); },
    "nav-itw"(el) { go("interview", { responseId: el.dataset.id }); },
    "report-open"(el) {
      const r = E.byId(S.db.responses, el.dataset.id), a = me();
      if (!E.interviewView(S.db, a, r, S.now).canSeeReport) { toast("Accès refusé.", true); return; }
      log("Consultation du rapport d'entretien (PDF)", r.pseudo, r.clientId);
      if (S.blobs[r.id]) { window.open(S.blobs[r.id], "_blank", "noopener"); } else { toast("Maquette : rapport fictif, aucun fichier à ouvrir. La consultation est tracée dans l'historique."); }
    },
    "psy-new"() { S.ui.pd = {}; openModal(psyModal(S.ui.pd)); },
    "psy-toggle"(el) { attempt(() => { const x = E.byId(S.db.accounts, el.dataset.id); E.setAccountActive(S.db, me(), x.id, !x.active, S.now); toast(x.active ? "Compte réactivé." : "Compte désactivé : sessions fermées, rapports et avis conservés."); }); render(); },
    "psy-assign"(el) { openModal(psyAssignModal(camp(el.dataset.id))); },
    "avis-validate-ok"() {
      const r = E.byId(S.db.responses, S.ui.itw.responseId);
      try {
        E.saveAvis(S.db, me(), r.id, S.ui.itw.avis, S.now);
        E.validateAvis(S.db, me(), r.id, S.now);
        S.ui.itw = { responseId: r.id, errors: [] }; closeModal(); toast("Avis validé : il est maintenant visible des décideurs."); render();
      } catch (e) { if (!e.business) { throw e; } S.ui.itw.errors = e.list || [e.message]; closeModal(); render(); }
    },
    remind(el) { attempt(() => { const i = E.byId(S.db.invitees, el.dataset.id); const m = E.remind(S.db, me(), i.id, S.now); pushMail(i.email, m); toast("Relance envoyée."); }); render(); },
    qr(el) { openModal(qrModal(camp(el.dataset.id))); },
    "client-new"() { go("clientForm", {}); },
    "client-toggle"(el) {
      const c = client(el.dataset.id);
      confirmModal(c.active ? "Désactiver le client" : "Activer le client", c.active ? `${esc(c.nom)} n'aura plus accès à la plateforme et ses liens de campagne seront fermés. Ses données sont conservées.` : `${esc(c.nom)} retrouvera l'accès à la plateforme.`, "client-toggle-ok", { id: c.id }, c.active ? "Désactiver" : "Activer");
    },
    "client-toggle-ok"(el) { const c = client(el.dataset.id); c.active = !c.active; log(c.active ? "Activation du client" : "Désactivation du client", c.nom, c.id); closeModal(); toast(c.active ? "Client activé." : "Client désactivé."); render(); },
    "theme-reset"() { const inp = $("[data-theme-input]"); inp.value = "#296da8"; inp.dispatchEvent(new Event("input", { bubbles: true })); },
    "logo-reset"() { S.ui.cf.logo = ""; $("#logo-preview").src = LOGO_YODAN; refreshThemePreview(); },
    "account-new"(el) { const c = client(el.dataset.client); S.ui.ad = { clientId: c.id, role: E.ROLES_BY_TYPE[c.type].find((r) => me().role === "ADMIN_YODAN" || r !== "ADMIN_MUTUELLE"), units: [] }; openModal(accountModal(S.ui.ad)); },
    "account-edit"(el) { const x = E.byId(S.db.accounts, el.dataset.id); S.ui.ad = { id: x.id, clientId: x.clientId, nom: x.nom, email: x.email, role: x.role, units: x.units.slice(), active: x.active }; openModal(accountModal(S.ui.ad)); },
    "account-pwd"(el) { const x = E.byId(S.db.accounts, el.dataset.id); pushMail(x.email, E.resendPassword(S.db, me(), x.id, S.now)); toast("Mot de passe temporaire renvoyé."); render(); },
    "account-toggle"(el) { attempt(() => { const x = E.byId(S.db.accounts, el.dataset.id); E.setAccountActive(S.db, me(), x.id, !x.active, S.now); toast(x.active ? "Compte réactivé." : "Compte désactivé."); }); render(); },
    "delay-save"(el) { attempt(() => { E.setDelay(S.db, me(), el.dataset.client, el.dataset.unit, $(`#delay-${el.dataset.unit}`).value, S.now); toast("Délai enregistré (s'applique aux prochains tests terminés)."); }); render(); },
    "list-sample"(el) { readCampaignForm($('[data-form="campaign"]')); S.ui.kd.liste = sampleList(client(el.dataset.client)); S.ui.kd.checked = true; render(); },
    "list-check"() { readCampaignForm($('[data-form="campaign"]')); S.ui.kd.checked = true; render(); },
    "dash-export"() {
      const a = me(), clientId = a.role === "ADMIN_YODAN" ? camp(S.params.campaignId).clientId : a.clientId;
      const d = E.dashboard(S.db, a, { ...S.ui.dash, clientId }, S.now);
      download("tableau-de-bord.csv", E.dashboardCsv(d)); log("Export tableur du tableau de bord (agrégé)", "", clientId);
    },
    "parts-export"(el) {
      const k = camp(el.dataset.id), rows = S.ui.lastParticipantRows || [];
      download("participants.csv", E.toCsv([["Nom", "E-mail", "Téléphone", E.UNIT_WORD[client(k.clientId).type].One, "Statut", "Score global", "Couleur", "Entretien", "Dernière relance", "Hors liste"],
        ...rows.map((r) => [r.nom, r.email, r.tel, unitName(k.clientId, r.unitId), r.statut, r.scoreGlobal ?? "", r.zone ? E.ZONE[r.zone].couleur : "", r.entretien ? E.INTERVIEW[r.entretien] : "", r.lastReminder ? E.fmtDate(r.lastReminder) : "", r.horsListe ? "oui" : ""])]));
      log(`Export tableur des participants (${rows.length} lignes)`, k.nom, k.clientId);
    },
    "care-export"() {
      const rows = (S.ui.lastCareRows || []).filter((r) => r.state === "ACTIVE");
      download("prises-en-charge-en-cours.csv", E.toCsv([["Nom", "E-mail", "Téléphone", "Niveau de risque", "Depuis", "Campagne", "Client"], ...rows.map((r) => [r.nom, r.email, r.tel, E.ZONE[r.zone].risque, E.fmtDate(r.since), camp(r.campaignId).nom, client(r.clientId).nom])]));
      log(`Export tableur des prises en charge en cours (${rows.length} lignes)`, "", null);
    },
    "group-toggle"(el) { const k = el.dataset.key, g = E.GROUPS.find((x) => x.key === k); if (g.defaut) { return; } const l = S.ui.extraGroups; S.ui.extraGroups = l.includes(k) ? l.filter((x) => x !== k) : [...l, k]; render(); },
    /* Connexion */
    "fill-login"(el) { S.login.email = el.dataset.email; S.login.error = null; render(); const p = $('[name="password"]'); if (p) { p.value = "motdepasse-demo-1"; p.focus(); } },
    forgot() { S.login = { step: "forgot", email: S.login.email }; render(); },
    "login-back"() { S.login = { step: "cred", email: S.login.email }; render(); },
    "otp-resend"() { sendOtp(S.login.email); toast("Nouveau code envoyé."); },
    /* Participant */
    "part-open"(el) { openCampaign(el.dataset.id); render(); },
    "part-fill-email"(el) { S.part.email = el.dataset.email; render(); },
    "part-back"(el) { S.part.step = el.dataset.step; S.part.error = null; render(); },
    "part-prev"() { savePartAnswers(); S.part.section -= 1; S.part.missing = false; S.part.error = null; render(); },
    "part-preset"(el) { S.part.answers = PRESETS[el.dataset.zone].slice(); S.part.section = 4; S.part.missing = false; render(); },
    "part-random-profile"() {
      const p = S.part.profile, k = camp(S.part.campaignId), c = client(k.clientId), pk = (a) => a[Math.floor(Math.random() * a.length)];
      Object.assign(p, { nom: p.nom || "Exemple", prenom: p.prenom || "Camille", tel: p.tel || "07 00 99 88 77", unitId: p.unitId || c.units[0].id, genre: pk(E.OPTIONS.genre), age: pk(E.OPTIONS.age), ancEnt: pk(E.OPTIONS.anciennete), ancPoste: pk(E.OPTIONS.anciennete), poids: 60 + Math.floor(Math.random() * 35), taille: 155 + Math.floor(Math.random() * 30), antecedents: [], aucunAntecedent: true });
      render();
    },
    "part-restart"() { S.part = { ...S.part, step: "done" }; render(); },
  };
  function openCampaign(id) { S.part = { step: "email", campaignId: id, profile: { antecedents: [] }, answers: Array(E.N_ITEMS).fill(null), section: 0 }; }
  function savePartAnswers() {
    const form = $('[data-form="part-test"]'); if (!form) { return; }
    new FormData(form).forEach((v, k) => { S.part.answers[Number(k.slice(1))] = Number(v); });
  }
  function refreshThemePreview() { const el = $("#theme-preview"); if (el) { el.innerHTML = themePreview(S.ui.cf); } }

  /* ================= Formulaires ================= */
  const FORMS = {
    "login-cred"(fd) {
      const email = String(fd.get("email") || "").trim().toLowerCase(), pwd = String(fd.get("password") || "");
      S.login.email = email; S.login.remember = !!fd.get("remember");
      const a = S.db.accounts.find((x) => x.email === email);
      if (!a || !pwd) { S.login.error = "E-mail ou mot de passe incorrect."; E.addLog(S.db, { at: S.now, actorId: null, clientId: a?.clientId, action: "Échec de connexion", target: "" }); return render(); }
      if (!a.active || (a.clientId && !client(a.clientId).active)) { S.login.error = "Accès désactivé. Contactez votre interlocuteur Yodan."; return render(); }
      S.login = { ...S.login, step: "otp", accountId: a.id, flow: "login", error: null };
      sendOtp(email); render();
    },
    "login-otp"(fd) {
      if (String(fd.get("code")).trim() !== S.login.otp) { S.login.error = "Code incorrect ou expiré."; return render(); }
      const a = E.byId(S.db.accounts, S.login.accountId);
      if (S.login.flow === "forgot") { S.login = { ...S.login, step: "change", error: null }; return render(); }
      if (a.mustChange) { S.login = { ...S.login, step: "change", error: null }; return render(); }
      finishLogin(a);
    },
    "login-change"(fd) {
      const p1 = String(fd.get("p1")), p2 = String(fd.get("p2"));
      if (p1.length < 12 || !/[a-z]/i.test(p1) || !/\d/.test(p1)) { S.login.error = "12 caractères minimum, avec au moins une lettre et un chiffre."; return render(); }
      if (p1 !== p2) { S.login.error = "Les deux mots de passe sont différents."; return render(); }
      const a = E.byId(S.db.accounts, S.login.accountId);
      a.mustChange = false;
      E.addLog(S.db, { at: S.now, actorId: a.id, clientId: a.clientId, action: "Changement du mot de passe", target: "" });
      if (S.login.flow === "forgot") { S.login = { step: "cred", email: a.email, info: "Mot de passe modifié. Connectez-vous." }; return render(); }
      finishLogin(a);
    },
    "login-forgot"(fd) {
      const email = String(fd.get("email") || "").trim().toLowerCase();
      const a = S.db.accounts.find((x) => x.email === email && x.active);
      S.login = { step: "otp", email, flow: "forgot", accountId: a?.id, info: null };
      if (a) { sendOtp(email); } else { S.login.otp = "______"; }
      render();
      toast("Si un compte existe pour cette adresse, un code vient d'être envoyé.");
    },
    "part-email"(fd) {
      const k = camp(S.part.campaignId), email = String(fd.get("email") || "").trim();
      S.part.email = email;
      const acc = E.checkParticipantAccess(S.db, k, email, S.now);
      if (!acc.ok) { S.part.error = esc(acc.reason); return render(); }
      S.part.otp = newOtp(); pushMail(email, TX.emails.otp(S.part.otp));
      S.part.step = "otp"; S.part.error = null; render();
    },
    "part-otp"(fd) {
      if (String(fd.get("code")).trim() !== S.part.otp) { S.part.error = "Code incorrect ou expiré."; return render(); }
      const k = camp(S.part.campaignId), inv = S.db.invitees.find((i) => i.campaignId === k.id && i.email === S.part.email.toLowerCase());
      if (inv) { Object.assign(S.part.profile, { nom: inv.nom, prenom: inv.prenom, tel: inv.tel, unitId: inv.unitId }); }
      S.part.step = "consent"; S.part.error = null; render();
    },
    "part-consent"(fd) {
      const p = S.part.profile, mut = client(camp(S.part.campaignId).clientId).type === "M";
      p.consentDonnees = !!fd.get("consentDonnees"); p.consentContact = !!fd.get("consentContact"); p.consentAvis = mut ? !!fd.get("consentAvis") : null;
      if (!p.consentDonnees || !p.consentContact || (mut && !p.consentAvis)) { S.part.error = mut ? "Les trois accords sont nécessaires pour commencer. Sans la transmission de l'avis, le parcours de prise en charge ne peut pas continuer." : "Les deux accords sont nécessaires pour commencer le test."; return render(); }
      p.consentAt = S.now; S.part.step = "profile"; S.part.error = null; render();
    },
    "part-profile"(fd) {
      const p = S.part.profile;
      ["nom", "prenom", "tel", "unitId", "genre", "age", "ancEnt", "ancPoste"].forEach((k) => { p[k] = String(fd.get(k) || "").trim(); });
      p.poids = Number(fd.get("poids")) || null; p.taille = Number(fd.get("taille")) || null;
      p.aucunAntecedent = !!fd.get("aucun"); p.antecedents = fd.getAll("ante");
      const errs = E.profileErrors(S.db, camp(S.part.campaignId), p);
      if (errs.length) { S.part.error = `<ul>${errs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`; return render(); }
      S.part.step = "test"; S.part.section = 0; S.part.error = null; render();
    },
    "part-test"() {
      savePartAnswers();
      const P = S.part; let base = 0; for (let i = 0; i < P.section; i++) { base += E.SECTIONS[i].items.length; }
      const n = E.SECTIONS[P.section].items.length;
      if (P.answers.slice(base, base + n).some((v) => v == null)) { P.missing = true; P.error = "Répondez à toutes les questions de cette page."; return render(); }
      P.missing = false; P.error = null;
      if (P.section < 4) { P.section += 1; render(); window.scrollTo(0, 0); return; }
      attempt(() => {
        const r = E.submitResponse(S.db, P.campaignId, { ...P.profile, email: P.email, answers: P.answers }, S.now);
        P.responseId = r.id; P.step = "result";
      });
      render();
    },
    client(fd, form) {
      readClientForm(form);
      const d = S.ui.cf, existing = d.id ? client(d.id) : null;
      const newUnits = String(d.unitsText || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const allUnits = existing ? [...existing.units.map((u) => u.nom), ...newUnits] : newUnits;
      d.errors = E.clientErrors(S.db, { ...d, units: allUnits });
      if (!d.effectifDate) { d.errors.push("Indiquez la date de l'effectif."); }
      if (d.errors.length) { render(); window.scrollTo(0, 0); return; }
      const theme = d.theme && d.theme.toLowerCase() !== "#296da8" ? d.theme : "";
      if (existing) {
        Object.assign(existing, { nom: d.nom.trim(), emailPro: (d.emailPro || "").trim().toLowerCase(), secteur: d.secteur, tests: d.tests, theme, logo: d.logo || "" });
        newUnits.forEach((n, i) => existing.units.push({ id: `${existing.id}-${existing.units.length + 1 + i}`, nom: n, delayDays: existing.type === "M" ? 7 : null }));
        const last = existing.effectifs[existing.effectifs.length - 1];
        if (Number(d.effectif) !== last.valeur) { existing.effectifs = existing.effectifs.filter((e) => e.date !== d.effectifDate); existing.effectifs.push({ date: d.effectifDate, valeur: Number(d.effectif) }); existing.effectifs.sort((x, y) => E.day(x.date) - E.day(y.date)); }
        log("Configuration du client", existing.nom, existing.id);
        go("clients"); S.flash = { html: `Client « ${esc(existing.nom)} » enregistré.` }; render();
      } else {
        S.db.seq.client += 1;
        const id = "C" + (S.db.seq.client);
        const c = { id, nom: d.nom.trim(), type: d.type, emailPro: (d.emailPro || "").trim().toLowerCase(), secteur: d.secteur, tests: d.tests, effectifs: [{ date: d.effectifDate, valeur: Number(d.effectif) }],
          units: newUnits.map((n, i) => ({ id: `${id}-${i + 1}`, nom: n, delayDays: d.type === "M" ? 7 : null })), theme, logo: d.logo || "", active: true, createdAt: S.now };
        S.db.clients.push(c);
        log("Création de client", c.nom, c.id);
        const acc = E.saveAccount(S.db, me(), { clientId: id, nom: d.compteNom, email: d.compteEmail, role: d.type === "E" ? "SUP_PRINCIPAL" : "ADMIN_MUTUELLE", units: [] }, S.now);
        pushMail(acc.email, TX.emails.motDePasseTemporaire());
        go("clients"); S.flash = { html: `Client « ${esc(c.nom)} » créé. Le compte principal (${esc(acc.email)}) a reçu son mot de passe temporaire.` }; render();
      }
    },
    account(fd) {
      const d = S.ui.ad;
      d.nom = String(fd.get("nom") || ""); d.email = String(fd.get("email") || ""); d.role = fd.get("role"); d.units = fd.getAll("units");
      try {
        const a = E.saveAccount(S.db, me(), d, S.now);
        if (!d.id) { pushMail(a.email, TX.emails.motDePasseTemporaire()); }
        closeModal(); toast(d.id ? "Compte modifié." : "Compte créé ; mot de passe temporaire envoyé."); render();
      } catch (e) { if (!e.business) { throw e; } openModal(accountModal(d, e.list || [e.message])); }
    },
    campaign(fd, form) {
      readCampaignForm(form);
      const d = S.ui.kd;
      try {
        const k = E.createCampaign(S.db, me(), { ...d, clientId: S.params.clientId }, S.now);
        S.ui.kd = null;
        if (me().role === "ADMIN_YODAN") { go("campaign", { campaignId: k.id }); } else { go("campaigns"); S.flash = { html: "Campagne créée. Yodan va attribuer les psychologues." }; render(); }
        openModal(qrModal(k, true));
      } catch (e) { if (!e.business) { throw e; } d.errors = e.list || [e.message]; d.checked = true; render(); window.scrollTo(0, 0); }
    },
    psy(fd) {
      const d = S.ui.pd; d.nom = String(fd.get("nom") || ""); d.email = String(fd.get("email") || "");
      try { const p = E.createPsychologue(S.db, me(), d, S.now); pushMail(p.email, TX.emails.invitationPsychologue()); closeModal(); toast("Compte créé ; invitation envoyée."); render(); }
      catch (e) { if (!e.business) { throw e; } openModal(psyModal(d, e.list || [e.message])); }
    },
    "psy-assign"(fd, form) {
      const k = camp(form.dataset.id);
      try { E.setCampaignPsychologues(S.db, me(), k.id, fd.getAll("psychologueIds"), S.now); closeModal(); toast("Psychologues enregistrés."); render(); }
      catch (e) { if (!e.business) { throw e; } openModal(psyAssignModal(k, e.message)); }
    },
    avis(fd, form, submitter) {
      readAvisForm(form);
      const r = E.byId(S.db.responses, S.ui.itw.responseId);
      if (!submitter || submitter.value !== "validate") {
        attempt(() => { E.saveAvis(S.db, me(), r.id, S.ui.itw.avis, S.now); S.ui.itw.errors = []; toast("Brouillon enregistré (invisible pour les décideurs)."); });
        return render();
      }
      const errs = E.avisErrors(S.db, r, S.ui.itw.avis, S.now);
      if (errs.length) { S.ui.itw.errors = errs; return render(); }
      confirmModal("Valider l'avis", `Après validation, l'avis de ${esc(r.pseudo)} est verrouillé et devient visible des décideurs. ${client(r.clientId).type === "M" ? "Le délai de la région démarre maintenant." : ""} Le rapport d'entretien, lui, reste chez Yodan.`, "avis-validate-ok", {}, "Valider l'avis");
    },
  };
  function finishLogin(a) {
    a.lastLogin = S.now;
    E.addLog(S.db, { at: S.now, actorId: a.id, clientId: a.clientId, action: "Connexion", target: S.login.remember ? "se souvenir de moi" : "" });
    S.login = { step: "cred" };
    loginAs(a.id);
  }

  /* ================= Événements ================= */
  function bind() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-act]");
      if (!el || !(el.closest("#app") || el.closest("#modal-root") || el.closest("#notes"))) { return; }
      if (el.disabled) { return; }
      const fn = ACT[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-form]");
      if (!form) { return; }
      e.preventDefault();
      FORMS[form.dataset.form](new FormData(form), form, e.submitter);
    });
    const onFilter = (e) => {
      const el = e.target;
      if (el.dataset.filter) {
        const [grp, key] = el.dataset.filter.split(".");
        S.ui[grp] = { ...S.ui[grp], [key]: el.value };
        if (grp === "dash" && key === "popKey") { S.ui.dash.popValue = ""; }
        if (grp === "val" && key === "clientId") { S.ui.val.campaignId = ""; }
        if (grp === "care" && key === "clientId") { S.ui.care.campaignId = ""; }
        render(); return;
      }
      if (el.matches("[data-imc]")) {
        const f = el.form, v = E.imc(Number(f.poids.value), Number(f.taille.value));
        $("#imc-live").innerHTML = imcBlock(v, E.imcCategorie(v)); return;
      }
      if (el.matches("[data-theme-input]")) { S.ui.cf.theme = el.value; $("#theme-code").textContent = el.value; refreshThemePreview(); return; }
    };
    document.addEventListener("input", (e) => { if (e.target.matches("input[type=text][data-filter], [data-imc], [data-theme-input]")) { onFilter(e); } });
    document.addEventListener("change", (e) => {
      const el = e.target;
      if (el.matches("select[data-filter], input[type=date][data-filter]")) { return onFilter(e); }
      if (el.matches("[data-live]")) { readClientForm(el.form); render(); return; }
      if (el.matches("[data-avis-live]")) { readAvisForm(el.form); render(); return; }
      if (el.matches("[data-report-upload]")) {
        const f = el.files[0]; if (!f) { return; }
        const avisForm = document.querySelector('[data-form="avis"]'); if (avisForm) { readAvisForm(avisForm); }
        const rid = S.ui.itw.responseId;
        attempt(() => {
          E.saveReport(S.db, me(), rid, { name: f.name, size: f.size, type: f.type }, S.now);
          if (S.blobs[rid]) { URL.revokeObjectURL(S.blobs[rid]); }
          S.blobs[rid] = URL.createObjectURL(f); /* reste dans ce navigateur : aucun envoi (maquette) */
          toast("Rapport déposé.");
        });
        el.value = ""; render(); return;
      }
      if (el.matches("[data-account-role]")) { const f = el.form; Object.assign(S.ui.ad, { nom: f.nom.value, email: f.email.value, role: el.value, units: [] }); openModal(accountModal(S.ui.ad)); return; }
      if (el.matches("[data-ante-none]") && el.checked) { el.form.querySelectorAll("[data-ante]").forEach((x) => { x.checked = false; }); return; }
      if (el.matches("[data-ante]") && el.checked) { el.form.querySelector("[data-ante-none]").checked = false; return; }
      if (el.matches("[data-logo-input]")) { return readLogo(el); }
      if (el.matches("[data-import-units]")) { return readText(el, (t) => { readClientForm(el.form); S.ui.cf.unitsText = [S.ui.cf.unitsText, t].filter(Boolean).join("\n"); render(); }); }
      if (el.matches("[data-import-list]")) { return readText(el, (t) => { readCampaignForm(el.form); S.ui.kd.liste = t; S.ui.kd.checked = true; render(); }); }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.modal) { closeModal(); } });
  }
  function readText(input, cb) { const f = input.files[0]; if (!f) { return; } const rd = new FileReader(); rd.onload = () => cb(String(rd.result)); rd.readAsText(f); }
  function readLogo(input) {
    const f = input.files[0]; if (!f) { return; }
    if (!/^image\/(png|jpeg|svg\+xml)$/.test(f.type)) { toast("Format refusé : PNG, JPG ou SVG uniquement.", true); input.value = ""; return; }
    if (f.size > 2 * 1024 * 1024) { toast("Logo trop lourd : 2 Mo maximum.", true); input.value = ""; return; }
    const rd = new FileReader();
    rd.onload = () => { S.ui.cf.logo = rd.result; S.ui.cf.logoSize = f.size; $("#logo-preview").src = rd.result; refreshThemePreview(); };
    rd.readAsDataURL(f);
  }

  /* ================= Barre de maquette et notes ================= */
  function syncMockBar() {
    const sel = $("#role-select");
    const cur = S.mode === "app" ? S.accountId : S.mode;
    if (!sel.options.length) {
      const groups = [["Sans compte", [["login", "Page de connexion"], ["participant", "Participant (lien de campagne)"]]]];
      const yodan = S.db.accounts.filter((a) => !a.clientId).map((a) => [a.id, `${E.ROLES[a.role]} — ${a.nom}${a.active ? "" : " · désactivé"}${a.mustChange ? " · invitation" : ""}`]);
      groups.push(["Yodan", yodan]);
      S.db.clients.forEach((c) => groups.push([`${c.nom}${c.active ? "" : " · désactivé"}`, S.db.accounts.filter((a) => a.clientId === c.id).map((a) => [a.id, `${E.ROLES[a.role]} — ${a.nom}${a.units.length ? " (" + a.units.map((u) => unitName(c.id, u)).join(", ") + ")" : ""}${a.mustChange ? " · 1re connexion" : ""}`])]));
      sel.innerHTML = groups.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([v, l]) => opt(v, l, cur)).join("")}</optgroup>`).join("");
    }
    sel.value = cur;
    $("#now-label").textContent = E.fmtDateTime(S.now);
  }
  function rebuildRoleSelect() { $("#role-select").innerHTML = ""; }
  function noteKey() {
    if (S.mode === "login") { return "login"; }
    if (S.mode === "participant") { return "participant"; }
    return S.screen === "campaign" && S.params.tab !== "parts" ? "dashboard" : S.screen;
  }
  function renderNotes() {
    const k = noteKey(), n = NOTES[k] || NOTES[S.screen];
    const extra = S.screen === "campaign" && k === "dashboard" ? NOTES.campaign : null;
    const block = (x) => `<h2>${esc(x.titre)}</h2><span class="tag">Choix</span><ul class="choix">${x.choix.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>${x.questions.length ? `<span class="tag">Questions à valider</span><ol class="questions">${x.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}`;
    $("#notes-body").innerHTML = `${demoAids()}${extra ? block(extra) : ""}${n ? block(n) : ""}<span class="tag">Points transverses</span><ul>${NOTES.transverse.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <span class="tag">Maquette</span><ul><li>Sélecteur « Rôle / compte » : voir l'application avec chaque profil. Les comptes sont fictifs.</li><li>« +1 jour » fait avancer la date simulée : statuts, délais et attentes sont recalculés.</li><li>E-mails envoyés : boîte mail simulée en bas à droite (aucun envoi réel).</li></ul>`;
  }
  /** Aides de démonstration : uniquement dans le panneau Notes UX, jamais dans l'écran maquetté. */
  function demoAids() {
    const items = [];
    const link = (act, label, data = {}) => `<button type="button" class="link" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>${esc(label)}</button>`;
    const otpHint = "Le code OTP s'affiche dans la boîte mail simulée, en bas à droite.";
    if (S.mode === "login") {
      if (S.login.step === "cred") {
        items.push(`Cliquez un compte fictif pour remplir l'e-mail (mot de passe : n'importe lequel) :<ul>${S.db.accounts.map((a) => `<li>${link("fill-login", a.email, { email: a.email })} — ${esc(E.ROLES[a.role])}${a.clientId ? ` (${esc(client(a.clientId).nom)})` : ""}${a.mustChange ? " · <strong>1re connexion</strong>" : ""}${a.clientId && !client(a.clientId).active ? " · <strong>client désactivé</strong>" : ""}</li>`).join("")}</ul>`);
      }
      if (S.login.step === "otp") { items.push(otpHint); }
    }
    if (S.mode === "participant") {
      const P = S.part;
      items.push(`En réalité, le participant arrive directement par le lien unique ou le QR code. Ouvrir un autre lien :<ul>${S.db.campaigns.map((k) => { const c = client(k.clientId); return `<li>${link("part-open", k.nom, { id: k.id })} — ${esc(c.nom)} · ${E.CAMPAIGN_STATUS[E.campaignStatus(k, S.now)]}${c.active ? "" : " · client désactivé"} · ${c.emailPro ? "@" + esc(E.domainOf(c.emailPro)) + " uniquement" : "ouvert à tous"}</li>`; }).join("")}</ul>`);
      if (P.step === "email") {
        const inv = S.db.invitees.filter((i) => i.campaignId === P.campaignId && !S.db.responses.some((r) => r.inviteeId === i.id)).slice(0, 3);
        items.push(`Invités de la liste (identité préremplie ensuite) : ${inv.map((i) => link("part-fill-email", i.email, { email: i.email })).join(", ") || "—"}. Une adresse hors liste du bon domaine est aussi acceptée.`);
      }
      if (P.step === "otp") { items.push(otpHint); }
      if (P.step === "profile") { items.push(`Questionnaire : ${link("part-random-profile", "remplir au hasard")}.`); }
      if (P.step === "test") { items.push(`Remplir tout le test pour un résultat ${link("part-preset", "vert", { zone: "VERT" })}, ${link("part-preset", "orange", { zone: "ORANGE" })} ou ${link("part-preset", "rouge", { zone: "ROUGE" })}.`); }
    }
    if (S.mode === "app") {
      if (S.screen === "campaignForm") { items.push(`Liste des personnes : ${link("list-sample", "insérer un exemple", { client: S.params.clientId })}.`); }
      if (S.screen === "validation" || S.screen === "detail") { items.push("« +1 jour » (barre du haut) fait courir les délais Mutuelle, qui démarrent à la validation de l'avis : décision appliquée à l'échéance, puis « délai dépassé de X jours » sans décision."); }
      if (S.screen === "validation") { items.push("Pour voir le verrou de séquence : filtre « État : Entretien en attente » (boutons grisés), puis validez l'avis du dossier en vous connectant comme psychologue (sélecteur Rôle / compte)."); }
      if (S.screen === "detail" && me().role !== "ADMIN_YODAN") { items.push("Médecin-conseil et superviseur secondaire voient l'identifiant (P-XXXXX), le rapport du test et l'avis du psychologue ; jamais le nom, les coordonnées ni le rapport d'entretien."); }
      if (S.screen === "interviews") { items.push("Filtrez sur « Entretien à faire » puis ouvrez un dossier : enregistrez le rapport, remplissez l'avis et validez-le. Revenez ensuite côté médecin-conseil ou Admin Yodan."); }
      if (S.screen === "interview") { items.push("Déposez n'importe quel PDF comme rapport (il reste dans votre navigateur, rien n'est envoyé). Essayez un autre format, ou de valider sans rapport ou avec « Oui » sans type ni urgence : refus avec la liste des points à corriger."); }
      if (S.screen === "campaigns" && ["ASSISTANTE_SOCIALE", "VALIDATEUR"].includes(me().role)) { items.push("La campagne « Adhérents région Ouest » a été créée par l'assistante sociale : ses psychologues sont « à attribuer » par l'Admin Yodan (bouton « Psychologues » dans Clients › Mutuelle Beta › Campagnes)."); }
      if (S.screen === "dashboard" || S.screen === "campaign") { items.push("Seuil d'anonymat : comparez l'Admin Yodan et le superviseur principal d'Alpha, ou filtrez sur la direction « Finances »."); }
    }
    return items.length ? `<h2>Aides de démonstration</h2><div class="mock-help small"><ul style="margin:0;padding-left:1rem">${items.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : "";
  }
  function renderTestsBox() {
    const box = $("#tests-box");
    if (new URLSearchParams(location.search).has("tests") && window.runTests) {
      const T = window.runTests();
      box.innerHTML = `<div class="tests-box ${T.ko ? "ko" : "ok"}"><strong>Tests : ${T.ok} OK / ${T.ko} KO</strong>${T.ko ? `<ul>${T.failed.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>`;
    } else {
      box.innerHTML = '<div class="tests-box"><a href="?tests=1">Lancer les tests de cohérence</a></div>';
    }
  }
  function afterRender() { /* réservé */ }

  function boot() {
    S.db = E.generate();
    bind();
    $("#role-select").addEventListener("change", (e) => {
      const v = e.target.value;
      S.modal = null;
      if (v === "login") { S.mode = "login"; S.accountId = null; S.login = { step: "cred" }; return render(); }
      if (v === "participant") { S.mode = "participant"; S.accountId = null; openCampaign(S.db.campaigns.find((k) => E.campaignStatus(k, S.now) === "EN_COURS" && client(k.clientId).active).id); return render(); }
      const a = E.byId(S.db.accounts, v);
      if (a.mustChange || !a.active || (a.clientId && !client(a.clientId).active)) {
        S.mode = "login"; S.accountId = null; S.login = { step: "cred", email: a.email, info: null };
        return render();
      }
      loginAs(a.id);
    });
    $("#time-plus").onclick = () => { S.now += E.D; render(); toast(`Date simulée : ${E.fmtDate(S.now)}.`); };
    $("#time-reset").onclick = () => { S.db = E.generate(); S.now = E.NOW0; rebuildRoleSelect(); const a = me(); if (S.mode === "app" && a) { go(HOME[a.role]); } else { render(); } };
    document.querySelectorAll("[data-device]").forEach((b) => b.addEventListener("click", () => {
      S.device = b.dataset.device;
      document.querySelectorAll("[data-device]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
      $("#stage").classList.toggle("is-mobile", S.device === "mobile");
      render();
    }));
    $("#notes-toggle").addEventListener("click", (e) => { S.notes = !S.notes; e.target.setAttribute("aria-pressed", String(S.notes)); $("#layout").classList.toggle("with-notes", S.notes); });
    window.addEventListener("resize", () => $("#app").classList.toggle("compact", S.device === "mobile" || window.innerWidth < 700));
    S.mode = "login"; S.login = { step: "cred" }; render();
    renderTestsBox();
  }

  window.APP = { boot, S, render, go, loginAs, ACT, FORMS, PRESETS, dashboardBlock };
})();
