/*
 * mod-eval.js : fonctionnalité « Évaluation » (évaluateur, rôles qui en héritent, admin Yodan)
 * et parcours publics (patient par QR, joueur Lonaci, participant d'une campagne BSPA).
 */
"use strict";

/* =====================================================================
 * Briques communes : champs du questionnaire général, consentements, résultat
 * ===================================================================== */
const fieldVisible = (f, values) => !f.showIf || values[f.showIf[0]] === f.showIf[1];
function fieldHtml(f, values, prefix) {
  const id = `${prefix}-${f.key}`, v = values[f.key] ?? "";
  const lbl = `<label for="${id}">${esc(f.label)}${f.required ? "" : ' <span class="muted small">(facultatif)</span>'}${f.pii ? ' <span class="pii" title="Donnée d\'identité : rangée dans le coffre identité">🔒</span>' : ""}</label>`;
  if (f.type === "select") return `<div class="field">${lbl}<select id="${id}" data-field="${f.key}"><option value="">Choisir…</option>${f.options.map((o) => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
  return `<div class="field">${lbl}<input id="${id}" data-field="${f.key}" type="${f.type === "number" ? "number" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"}" value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.type === "date" ? `max="${todayIso()}"` : ""} autocomplete="off"></div>`;
}
function readFields(root, values) { $$("[data-field]", root).forEach((el) => { values[el.dataset.field] = el.value.trim(); }); return values; }
const missingFields = (fields, values) => fields.filter((f) => f.required && fieldVisible(f, values) && !String(values[f.key] ?? "").trim()).map((f) => f.label.toLowerCase());
/** Sépare identité (coffre identité) et profil (non identifiant, utilisé dans les statistiques). */
const splitValues = (p, values) => ({ identity: Object.fromEntries(p.fields.filter((f) => f.pii).map((f) => [f.key, values[f.key] || ""])), profile: Object.fromEntries(p.fields.filter((f) => !f.pii && fieldVisible(f, values)).map((f) => [f.key, values[f.key] || ""])) });
const consentsHtml = (list, values, prefix) => list.map((c) => `<label class="check consent-row"><input type="checkbox" data-consent="${c.id}" id="${prefix}-${c.id}" ${values[c.id] ? "checked" : ""}> <span>${esc(c.label)}${c.required ? ' <span class="req">*</span>' : ""}</span></label>`).join("");
function readConsents(root, values) { $$("[data-consent]", root).forEach((el) => { values[el.dataset.consent] = el.checked; }); return values; }
/** Carte résultat : zone, libellé du test, message ; puis post-consentements et liens de la zone. */
function resultCardHtml(ev, { withPost = true, forPatient = false, postOnly = false } = {}) {
  const p = partnerOf(ev.partnerId), T = TESTS[ev.test];
  const [title, msg] = [zoneTitle(ev.test, ev), T.zoneText[ev.zone][1]];
  const post = consentsOf(p, "post", ev.zone), links = p.links.filter((l) => l.zones.includes(ev.zone));
  const postHtml = withPost && post.length && ev.kind !== "Suivi" ? `<form class="post" id="post-form"><h3>${forPatient ? "Et maintenant ?" : "Choix du patient avec son résultat"}</h3>${consentsHtml(post, ev.consentsPost, "post")}<button type="submit" class="btn btn-primary btn-sm">Enregistrer mon choix</button><p class="small" id="post-saved" role="status"></p></form>` : "";
  const linksHtml = links.length ? `<div class="links"><h3>Ressources utiles</h3><ul>${links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join("")}</ul></div>` : "";
  if (postOnly) return `<div class="result">${postHtml}${linksHtml}</div>`;
  return `<div class="result z-${ev.zone}"><div class="result-head"><span class="result-dot"></span><div><span class="eyebrow">${esc(T.label)}${ev.kind === "Suivi" ? " · test de suivi" : ""}</span><h2>${esc(title)}</h2></div>${ev.dims ? "" : `<span class="result-score">${scoreText(ev.test, ev.score)}</span>`}</div><p>${esc(msg)}</p>
    ${ev.dims ? `<div class="dims">${BSPA_DIMS.map((k) => `<div class="dim-row"><span>${BSPA_DIM_LABEL[k]}</span><div class="meter"><span style="width:${ev.dims[k].pct}%;background:${zoneColor[ev.dims[k].zone]}"></span></div><span class="pill ${zoneCls[ev.dims[k].zone]}">${ev.dims[k].pct}</span></div>`).join("")}</div>` : ""}
    ${postHtml}${linksHtml}</div>`;
}
function bindPostForm(root, ev) {
  $("#post-form", root)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = readConsents($("#post-form", root), {});
    setPostConsents(ev.id, v);
    const phone = personOf(ev.personId).identity.telephone || personOf(ev.personId).id1;
    $("#post-saved", root).textContent = `Merci, votre choix a bien été enregistré.${v.callback || v.support ? ` Nous vous contacterons dans les meilleurs délais${phone && !String(phone).includes("@") ? ` au ${phone}` : ""}.` : ""}`;
  });
}
/** Une question par écran (v2 / Lonaci) : choix → question suivante automatiquement ; touches 0 à 9. */
function questionScreenHtml(test, i, answers, { intro = true } = {}) {
  const T = TESTS[test], it = T.items[i], n = T.items.length, done = answers.filter((a) => a != null).length;
  const section = T.sections?.find((s) => s.key === it.section);
  return `<div class="row-between small muted"><span>Question ${i + 1} sur ${n}</span><span>${Math.round((done / n) * 100)} %</span></div>
    <div class="progress"><i style="width:${(done / n) * 100}%"></i></div>
    <div class="question"><div class="idx">${esc(section ? section.title : intro ? T.intro : "")}</div><p id="q-title">${esc(it.t)}</p>
      <div class="answers" role="group" aria-labelledby="q-title">${it.o.map(([v, l], k) => `<button type="button" class="answer ${answers[i] === v ? "on" : ""}" data-ans="${v}" aria-pressed="${answers[i] === v}"><span class="k">${k}</span>${esc(l)}</button>`).join("")}</div></div>`;
}
let qKeys = null;
document.addEventListener("keydown", (e) => { if (!qKeys || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || $(".modal-back")) return; qKeys(e); });

/* =====================================================================
 * Évaluation par un agent (évaluateur, validateur, rôles parents, admin Yodan)
 * ===================================================================== */
const evx = {};
const blankEval = (partnerId) => ({ step: "home", partnerId, test: null, ids: { id1: "", id2: "" }, agency: null, look: null, values: {}, consentsPre: {}, answers: [], q: 0, fromRecap: false, wz: 0, result: null, err: "", qrLeft: 900 });
let qrTimer = null;
function viewEvaluation(el, scope, key) {
  clearInterval(qrTimer); qKeys = null;
  const st = evx[key] || (evx[key] = blankEval(scope.partnerIds[0]));
  if (!scope.partnerIds.includes(st.partnerId)) Object.assign(st, blankEval(scope.partnerIds[0]));
  const p = partnerOf(st.partnerId);
  if (!p.tests.includes(st.test)) st.test = p.tests[0];
  const myAgencies = scope.agencies || p.agencies;
  if (!myAgencies.includes(st.agency)) st.agency = myAgencies[0];
  const redraw = () => viewEvaluation(el, scope, key);
  if (st.step === "wizard") return evWizard(el, st, scope, redraw);
  if (st.step === "qr") return evQr(el, st, redraw);
  evHome(el, st, scope, myAgencies, redraw);
}
function evHome(el, st, scope, myAgencies, redraw) {
  const p = partnerOf(st.partnerId);
  const mine = db.evaluations.filter((e) => scope.partnerIds.includes(e.partnerId) && ["agent", "qr"].includes(e.mode) && (session.identityId ? e.by === session.identityId : myAgencies.includes(e.agency))).sort((a, b) => b.date.localeCompare(a.date));
  const q = norm(st.q || "");
  const rows = mine.filter((e) => !q || norm(`${displayName(personOf(e.personId))} ${personOf(e.personId).id1} ${e.dossier}`).includes(q));
  const page = pageOf(`ev-${p.id}`, rows);
  const week = mine.filter((e) => daysBetween(e.date, todayIso()) < 7).length;
  const groups = [["Aujourd'hui", (e) => e.date === todayIso()], ["Cette semaine", (e) => e.date !== todayIso() && daysBetween(e.date, todayIso()) < 7], ["Plus ancien", (e) => daysBetween(e.date, todayIso()) >= 7]];
  el.innerHTML = `<div class="narrow-page"><div class="card"><span class="eyebrow">Évaluation</span><h1>Nouvelle évaluation</h1>
      <form id="ev-start" novalidate>
        <div class="row">${multi(scope) ? `<div class="field"><label for="ev-p">Partenaire</label><select id="ev-p">${scope.partnerIds.filter((id) => partnerOf(id).tests.length).map((id) => `<option value="${id}" ${id === p.id ? "selected" : ""}>${esc(pName(id))}</option>`).join("")}</select></div>` : ""}
          ${p.tests.length > 1 ? `<div class="field"><label for="ev-t">Test</label><select id="ev-t">${p.tests.map((t) => `<option ${t === st.test ? "selected" : ""}>${t}</option>`).join("")}</select></div>` : ""}
          ${myAgencies.length > 1 ? `<div class="field"><label for="ev-a">Agence</label><select id="ev-a">${myAgencies.map((a) => `<option ${a === st.agency ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></div>` : ""}</div>
        <div class="row">${p.idLabels.map((l, i) => `<div class="field"><label for="ev-id${i + 1}">${esc(l)}</label><input id="ev-id${i + 1}" value="${esc(st.ids[`id${i + 1}`])}" autocomplete="off" ${i === 0 ? "autofocus" : ""}></div>`).join("")}</div>
        ${st.err ? `<div class="banner banner-warn" role="alert">⛔ ${esc(st.err)}</div>` : ""}
        <button type="submit" class="btn btn-orange btn-lg btn-block">Commencer</button></form></div>
    <div class="card"><div class="row-between"><h2 style="margin:0">Mes évaluations</h2><span class="muted small">${week} cette semaine</span></div>
      <div class="toolbar" style="margin-top:.6rem"><input type="search" class="grow" id="ev-q" placeholder="Rechercher un nom ou un N°…" value="${esc(st.q || "")}" aria-label="Rechercher"></div>
      ${rows.length ? groups.map(([l, f]) => { const g = page.rows.filter(f); return g.length ? `<p class="small muted group-lbl">${l}</p>${g.map((e) => `<div class="item" data-ev="${e.id}" role="button" tabindex="0"><span class="t">${esc(displayName(personOf(e.personId)))}</span><span class="pill gris">${e.kind}</span><span class="s">${esc(personOf(e.personId).id1)} · ${esc(MODE_LABEL[e.mode])} · ${fmtDate(e.date)} · ✓ transmise</span></div>`).join("")}` : ""; }).join("") + page.html : `<p class="empty">Aucune évaluation.</p>`}</div></div>`;
  $("#ev-p", el)?.addEventListener("change", (e) => { Object.assign(st, blankEval(e.target.value)); redraw(); });
  $("#ev-t", el)?.addEventListener("change", (e) => { st.test = e.target.value; });
  $("#ev-a", el)?.addEventListener("change", (e) => { st.agency = e.target.value; });
  bindSearch($("#ev-q", el), (v) => { st.q = v; resetPage(`ev-${p.id}`); redraw(); });
  bindPager(el, `ev-${p.id}`, redraw);
  $$("[data-ev]", el).forEach((r) => r.addEventListener("click", () => { const e = evaluationOf(r.dataset.ev); modal(displayName(personOf(e.personId)), `<dl class="kv"><dt>${esc(p.idLabels[0])}</dt><dd>${esc(personOf(e.personId).id1)}</dd><dt>Dossier</dt><dd>${esc(e.dossier)}</dd><dt>Type</dt><dd>${e.kind}</dd><dt>Mode</dt><dd>${esc(MODE_LABEL[e.mode])}</dd><dt>Transmise le</dt><dd>${fmtLong(e.date)}</dd></dl>`); }));
  $("#ev-start", el).addEventListener("submit", (e) => {
    e.preventDefault();
    p.idLabels.forEach((_, i) => { st.ids[`id${i + 1}`] = $(`#ev-id${i + 1}`, el).value.trim(); });
    if ($("#ev-a", el)) st.agency = $("#ev-a", el).value;
    if ($("#ev-t", el)) st.test = $("#ev-t", el).value;
    const missing = p.idLabels.filter((_, i) => !st.ids[`id${i + 1}`]);
    if (missing.length) { st.err = `Saisissez : ${missing.join(", ")}.`; return redraw(); }
    const look = lookupDossier(p.id, st.ids.id1);
    if (look.blocker) { st.err = look.blocker; return redraw(); }
    Object.assign(st, { step: "wizard", look, err: "", wz: 0, answers: [], q: 0, consentsPre: {}, values: look.person ? { ...look.person.identity } : {}, result: null });
    redraw();
  });
}
const evSteps = (st) => (st.look.path === "followup" ? ["Dossier", "Questionnaire", "Vérification", "Résultat"] : ["Dossier", "Consentements", "Identité", "Questionnaire", "Vérification", "Résultat"]);
function evWizard(el, st, scope, redraw) {
  const p = partnerOf(st.partnerId), T = TESTS[st.test], steps = evSteps(st), step = steps[st.wz];
  const go2 = (name) => { st.wz = steps.indexOf(name); redraw(); };
  const next = () => { if (st.fromRecap) { st.fromRecap = false; go2("Vérification"); } else { st.wz++; redraw(); } };
  el.innerHTML = `<div class="narrow-page"><div class="card"><div class="actions" style="margin-bottom:.4rem"><span class="chip">Dossier ${esc(st.ids.id1)}</span><span class="chip">📍 ${esc(st.agency)}</span><span class="chip">${esc(T.label)}</span></div>${stepperHtml(steps, st.wz)}<div id="wz"></div></div>
    ${step !== "Résultat" ? `<p style="text-align:center"><button type="button" class="btn btn-ghost btn-sm" id="wz-quit">Abandonner cette évaluation</button></p>` : ""}</div>`;
  $("#wz-quit", el)?.addEventListener("click", () => { toast("Évaluation abandonnée : rien n'a été transmis."); Object.assign(st, blankEval(st.partnerId)); redraw(); });
  const body = $("#wz", el);
  const look = st.look;
  if (step === "Dossier") {
    const person = look.person;
    const info = { new: ["🆕", "banner-info", "Nouvelle personne", "Consentements, identification puis questionnaire."], known: ["👤", "banner-ok", `Personne connue : ${displayName(person)}`, "Son identité est déjà enregistrée : vous vérifierez le reste."], followup: ["🔁", "banner-warn", `Prise en charge en cours : ${displayName(person)}`, "Test de suivi : questionnaire seul, à titre informatif."] }[look.path];
    body.innerHTML = `<div class="banner ${info[1]} lookup"><span class="big-ico">${info[0]}</span><div><strong>${esc(info[2])}</strong><br><span class="small">${esc(info[3])}</span></div></div>
      <h2>Comment le questionnaire est-il rempli ?</h2>
      <div class="choice-cards"><button type="button" class="choice-card" id="m-agent"><span class="ico">🤝</span><strong>Avec le patient <span class="kbd">1</span></strong><span class="muted small">Vous remplissez ensemble sur cet écran.</span></button>
        <button type="button" class="choice-card" id="m-qr"><span class="ico">📱</span><strong>Par QR code <span class="kbd">2</span></strong><span class="muted small">Le patient remplit seul sur son téléphone (15 min, un seul appareil).</span></button></div>
      <div class="wizard-foot"><button type="button" class="btn btn-ghost" id="wz-back">← Changer de N°</button><span></span></div>`;
    const agent = () => { st.mode = "agent"; next(); }, qr = () => { st.mode = "qr"; st.step = "qr"; st.qrLeft = 900; redraw(); };
    $("#m-agent", body).addEventListener("click", agent); $("#m-qr", body).addEventListener("click", qr);
    $("#wz-back", body).addEventListener("click", () => { st.step = "home"; redraw(); });
    qKeys = (e) => { if (e.key === "1") agent(); if (e.key === "2") qr(); };
  } else if (step === "Consentements") {
    const pre = consentsOf(p, "pre");
    body.innerHTML = `<h2>Consentements</h2><p class="muted small">À lire avec la personne avant le questionnaire. Si elle refuse, l'évaluation s'arrête ici et rien n'est enregistré.</p>${consentsHtml(pre, st.consentsPre, "pre")}<div class="err" id="pre-err" role="alert"></div>
      <div class="wizard-foot"><button type="button" class="btn btn-ghost" id="wz-back">← Retour</button><button type="button" class="btn btn-primary btn-lg" id="wz-next">Continuer</button></div>`;
    $("#wz-back", body).addEventListener("click", () => { st.wz--; redraw(); });
    $("#wz-next", body).addEventListener("click", () => { readConsents(body, st.consentsPre); if (pre.some((c) => c.required && !st.consentsPre[c.id])) { $("#pre-err", body).textContent = "Sans ce consentement, l'évaluation ne peut pas continuer."; return; } next(); });
  } else if (step === "Identité") {
    const known = look.path === "known";
    const lockedPii = known ? p.fields.filter((f) => f.pii && st.values[f.key]) : [];
    const shown = p.fields.filter((f) => !lockedPii.includes(f) && fieldVisible(f, st.values));
    body.innerHTML = `<div class="row-between"><h2 style="margin:0">Identité</h2><span class="chip">📍 ${esc(st.agency)} (automatique)</span></div>
      ${lockedPii.length ? `<div class="card-flat"><strong>✓ Déjà enregistré</strong> <span class="muted small">(non modifiable ici)</span><div class="small">${lockedPii.map((f) => `${esc(f.label)} : ${esc(st.values[f.key])}`).join(" · ")}</div></div><p class="muted small">Vérifiez seulement ce qui peut avoir changé :</p>` : ""}
      <div class="grid-2" id="id-fields">${shown.map((f) => fieldHtml(f, st.values, "idf")).join("")}</div><div class="err" id="id-err" role="alert"></div>
      <div class="wizard-foot"><button type="button" class="btn btn-ghost" id="wz-back">← Retour</button><button type="button" class="btn btn-primary btn-lg" id="wz-next">Continuer vers le questionnaire</button></div>`;
    $$("select[data-field]", body).forEach((s) => s.addEventListener("change", () => { readFields(body, st.values); if (p.fields.some((f) => f.showIf?.[0] === s.dataset.field)) redraw(); }));
    $("#wz-back", body).addEventListener("click", () => { readFields(body, st.values); st.wz--; redraw(); });
    $("#wz-next", body).addEventListener("click", () => { readFields(body, st.values); const m = missingFields(p.fields, st.values); if (m.length) { $("#id-err", body).textContent = `Complétez : ${m.join(", ")}.`; return; } next(); });
  } else if (step === "Questionnaire") {
    body.innerHTML = `${questionScreenHtml(st.test, st.q, st.answers)}<div class="wizard-foot"><button type="button" class="btn btn-ghost" id="q-prev">← ${st.q === 0 ? "Étape précédente" : "Question précédente"}</button><span class="small muted">Touches 0 à ${T.items[st.q].o.length - 1} · passage automatique</span></div>`;
    const choose = (v) => {
      st.answers[st.q] = v;
      $$(".answer", body).forEach((b) => b.classList.toggle("on", +b.dataset.ans === v));
      setTimeout(() => { if (st.fromRecap) { st.fromRecap = false; go2("Vérification"); } else if (st.q < T.items.length - 1) { st.q++; redraw(); } else next(); }, 200);
    };
    $$("[data-ans]", body).forEach((b) => b.addEventListener("click", () => choose(+b.dataset.ans)));
    $("#q-prev", body).addEventListener("click", () => { if (st.q === 0) { st.wz--; } else st.q--; redraw(); });
    qKeys = (e) => { const it = T.items[st.q]; if (/^[0-9]$/.test(e.key) && it.o[+e.key]) choose(it.o[+e.key][0]); };
  } else if (step === "Vérification") {
    const missing = T.items.filter((_, i) => st.answers[i] == null).length;
    const name = `${st.values.prenom || ""} ${st.values.nom || ""}`.trim() || st.ids.id1;
    body.innerHTML = `<h2>Vérification avant envoi</h2>
      ${look.path !== "followup" ? `<div class="card-flat"><div class="row-between"><strong>${esc(name)}</strong><button class="link-btn" type="button" data-edit="Identité">Modifier</button></div><div class="small muted">${esc(st.ids.id1)}${st.ids.id2 ? ` · ${esc(st.ids.id2)}` : ""} · ${p.fields.filter((f) => !f.pii && st.values[f.key]).map((f) => esc(st.values[f.key])).join(" · ")}</div>
        <div class="row-between small"><span>Consentements : ${consentsOf(p, "pre").filter((c) => st.consentsPre[c.id]).length} accepté(s)</span><button class="link-btn" type="button" data-edit="Consentements">Modifier</button></div></div>` : ""}
      <div class="recap-list">${T.items.map((it, i) => `<div class="recap-row"><span>${i + 1}. ${esc(it.t)}</span><span class="nowrap"><strong>${st.answers[i] != null ? esc(it.o.find(([v]) => v === st.answers[i])[1]) : "<span class='zone-ROUGE'>Sans réponse</span>"}</strong> <button class="link-btn" type="button" data-q="${i}">Modifier</button></span></div>`).join("")}</div>
      <div class="err" id="send-err" role="alert"></div>
      <div class="wizard-foot"><button type="button" class="btn btn-ghost" id="wz-back">← Retour</button><button type="button" class="btn btn-orange btn-lg" id="wz-send" ${missing ? "disabled" : ""}>Transmettre et voir le résultat</button></div>`;
    $$("[data-edit]", body).forEach((b) => b.addEventListener("click", () => { st.fromRecap = true; go2(b.dataset.edit); }));
    $$("[data-q]", body).forEach((b) => b.addEventListener("click", () => { st.q = +b.dataset.q; st.fromRecap = true; go2("Questionnaire"); }));
    $("#wz-back", body).addEventListener("click", () => { st.q = T.items.length - 1; st.wz--; redraw(); });
    $("#wz-send", body).addEventListener("click", () => {
      const { identity, profile } = splitValues(p, st.values);
      const r = recordEvaluation({ partnerId: p.id, test: st.test, ids: st.ids, agency: st.agency, identity, profile, answers: st.answers, consentsPre: look.path === "followup" ? { traitement: true } : st.consentsPre, mode: "agent", by: session.identityId });
      if (!r.ok) { $("#send-err", body).textContent = r.err; return; }
      audit("Évaluation transmise", r.evaluation.dossier);
      st.result = r.evaluation.id; next();
    });
  } else {
    const ev = evaluationOf(st.result);
    const out = outcomeOf(ev);
    body.innerHTML = `<div class="banner banner-ok">✓ ${ev.kind === "Suivi" ? "Test de suivi enregistré" : "Dossier transmis"} — résultat à montrer au patient</div>${resultCardHtml(ev)}
      <p class="small muted">${{ AUTO_NO: "Zone verte : pas de prise en charge à ce stade.", AUTO_YES: "La personne est ajoutée à la liste « À prendre en charge » de YODAN.", PENDING: "Le dossier part en validation." }[out] || ""}</p>
      <div class="wizard-foot"><button type="button" class="btn btn-ghost" id="wz-done">Terminer</button><button type="button" class="btn btn-orange btn-lg" id="wz-again">＋ Nouvelle évaluation</button></div>`;
    bindPostForm(body, ev);
    const reset = () => { Object.assign(st, blankEval(st.partnerId)); redraw(); };
    $("#wz-done", body).addEventListener("click", reset); $("#wz-again", body).addEventListener("click", reset);
  }
}
function evQr(el, st, redraw) {
  const mmss = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  el.innerHTML = `<div class="narrow-page"><div class="card" style="text-align:center"><span class="chip">Dossier ${esc(st.ids.id1)}</span>
    <h1 style="margin-top:.6rem">Faites scanner ce code au patient</h1><p class="muted">Il donne ses consentements, répond, puis voit son résultat sur son téléphone.</p>
    <div class="qr-box">${qrSvg(st.ids.id1, 190)}</div><p><span class="pill ${st.result ? "vert" : "jaune"}" id="qr-status">${st.result ? "✓ Transmis — le patient voit son résultat sur son téléphone" : "⏳ En attente du patient…"}</span></p>
    <p class="small muted">Expire dans <strong id="qr-left">${mmss(st.qrLeft)}</strong></p>
    <div class="wizard-foot" style="justify-content:center"><button type="button" class="btn btn-ghost" id="qr-cancel">${st.result ? "Terminer" : "Annuler"}</button></div></div></div>`;
  $("#qr-cancel", el).addEventListener("click", () => { clearInterval(qrTimer); Object.assign(st, blankEval(st.partnerId)); redraw(); });
  if (!st.result) qrTimer = setInterval(() => { st.qrLeft = Math.max(0, st.qrLeft - 1); const x = $("#qr-left"); if (x) x.textContent = mmss(st.qrLeft); else clearInterval(qrTimer); }, 1000);
}
/** Démo : le patient a fini de répondre sur son téléphone (réponses tirées au hasard). */
function qrPatientDone() {
  const key = Object.keys(evx).find((k) => evx[k].step === "qr" && !evx[k].result);
  if (!key) return toast("Aucun QR en attente.");
  const st = evx[key], p = partnerOf(st.partnerId), T = TESTS[st.test], r0 = rng(clock.now);
  const answers = T.items.map((it) => it.o[Math.floor(r0() * it.o.length)][0]);
  const values = st.look.person ? { ...st.look.person.identity } : { nom: "Patient", prenom: "QR Démo", sexe: "Femme" };
  const { identity, profile } = splitValues(p, values);
  const r = recordEvaluation({ partnerId: p.id, test: st.test, ids: st.ids, agency: st.agency, identity, profile, answers, consentsPre: { traitement: true }, mode: "qr", by: session.identityId });
  if (!r.ok) return toast(esc(r.err));
  st.result = r.evaluation.id; clearInterval(qrTimer); toast("Évaluation par QR code reçue."); render();
}
/** Démo : remplit les questions restantes du questionnaire affiché (zone visée). */
function fillEvaluationDemo(zone) {
  const key = Object.keys(evx).find((k) => evx[k].step === "wizard");
  if (!key) return;
  const st = evx[key], T = TESTS[st.test], r0 = rng(clock.now + zone.length);
  const lvl = { VERT: 0.1, ORANGE: 0.55, ROUGE: 0.95 }[zone];
  st.answers = st.test === "BSPA" ? bspaAnswers(lvl, r0) : answersForTotal(T.items.length, 3, Math.round(lvl * T.items.length * 3), r0);
  st.wz = evSteps(st).indexOf("Vérification");
  render();
}

/* =====================================================================
 * Parcours publics : patient (QR), joueur (site Lonaci), participant (campagne BSPA)
 * ===================================================================== */
const pub = { entry: null, partnerId: null, step: "start", values: {}, consents: {}, answers: [], q: 0, ids: {}, err: "", ev: null, campaignId: null, email: "", challengeId: null, participantId: null, section: 0, info: "" };
const resetPub = (keep = {}) => Object.assign(pub, { entry: null, step: "start", values: {}, consents: {}, answers: [], q: 0, ids: {}, err: "", ev: null, campaignId: null, email: "", challengeId: null, participantId: null, section: 0, info: "", ...keep });
const entriesFor = (p) => [["campagne", "📧", "Lien de campagne", "Le participant ouvre le lien reçu par e-mail, vérifie son adresse par un code, puis répond."]]
  .concat(hasFeature(p, "evaluation") ? [["qr", "📱", "QR donné par un agent", "La personne scanne le code affiché par l'évaluateur."]] : []);
RENDER.public = (root) => {
  qKeys = null;
  const p = partnerOf(ui.partnerId) || db.partners[0];
  if (pub.partnerId !== p.id) resetPub({ partnerId: p.id });
  const entries = entriesFor(p);
  if (!pub.entry && entries.length === 1) pub.entry = entries[0][0];
  root.innerHTML = `<div class="public"><header class="pub-head"><span class="brand"><span class="brand-dot">${esc(p.name[0])}</span><span>${esc(p.name)}</span></span><span class="small muted">avec <b>YODAN</b></span></header><main class="pub-main" id="pub"></main><footer class="pub-foot small">Vos réponses sont confidentielles et traitées par YODAN. Aucun résultat n'est communiqué à ${esc(p.name)}.</footer></div>`;
  const box = $("#pub", root);
  if (!pub.entry) {
    box.innerHTML = entries.length ? `<div class="card"><h1>Comment arrivez-vous ?</h1><div class="choice-cards">${entries.map(([id, ico, l, d]) => `<button type="button" class="choice-card" data-entry="${id}"><span class="ico">${ico}</span><strong>${esc(l)}</strong><span class="muted small">${esc(d)}</span></button>`).join("")}</div></div>` : `<div class="card"><p class="empty">Aucun parcours public pour ce partenaire.</p></div>`;
    $$("[data-entry]", box).forEach((b) => b.addEventListener("click", () => { resetPub({ partnerId: p.id, entry: b.dataset.entry }); render(); }));
    return;
  }
  ({ campagne: pubCampaign, qr: pubQr })[pub.entry](box, p);
};
/** Questions une par écran pour les parcours publics. */
function pubQuestions(box, test, onDone) {
  const T = TESTS[test];
  box.innerHTML = `<div class="card">${questionScreenHtml(test, pub.q, pub.answers)}<div class="wizard-foot"><button type="button" class="btn btn-ghost" id="pq-prev">← Précédent</button>${pub.q === T.items.length - 1 && pub.answers[pub.q] != null ? `<button type="button" class="btn btn-orange" id="pq-ok">✓ Valider</button>` : "<span></span>"}</div></div>`;
  const choose = (v) => { pub.answers[pub.q] = v; setTimeout(() => { if (pub.q < T.items.length - 1) { pub.q++; render(); } else render(); }, 180); $$(".answer", box).forEach((b) => b.classList.toggle("on", +b.dataset.ans === v)); };
  $$("[data-ans]", box).forEach((b) => b.addEventListener("click", () => choose(+b.dataset.ans)));
  $("#pq-prev", box).addEventListener("click", () => { if (pub.q === 0) { pub.step = "info"; } else pub.q--; render(); });
  $("#pq-ok", box)?.addEventListener("click", onDone);
  qKeys = (e) => { const it = T.items[pub.q]; if (/^[0-9]$/.test(e.key) && it.o[+e.key]) choose(it.o[+e.key][0]); };
}
/* ---------- BSPA : participant d'une campagne (e-mail pro → code → questionnaire → bilan) ---------- */
function pubCampaign(box, p) {
  const camps = db.campaigns.filter((c) => c.partnerId === p.id);
  const c = campaignOf(pub.campaignId) || camps.find((x) => campaignState(x) === "EN_COURS") || camps[0];
  if (!c) { box.innerHTML = `<div class="card"><p class="empty">Aucune campagne.</p></div>`; return; }
  pub.campaignId = c.id;
  const T = TESTS[c.test];
  const head = `<div class="test-head"><p class="pill bleu">${esc(T.label)} · ${esc(T.desc)}</p><h1>${esc(c.name)}</h1><p class="muted small">Ouvert du ${fmtDate(c.start)} au ${fmtDate(c.end)}</p></div>`;
  if (pub.step === "start" || pub.step === "email") {
    box.innerHTML = `${head}<form class="card" id="cp-mail" novalidate><h2>Vérifions votre adresse</h2><div class="field"><label for="cp-em">${esc(p.campaign.emailPro ? "Adresse e-mail professionnelle" : "Adresse e-mail")}</label><input id="cp-em" type="email" value="${esc(pub.email)}" autocomplete="email"></div>${pub.err ? `<div class="banner banner-warn" role="alert">${esc(pub.err)}</div>` : ""}<button class="btn btn-orange btn-lg btn-block" type="submit">Recevoir un code</button></form>`;
    $("#cp-mail", box).addEventListener("submit", (e) => { e.preventDefault(); pub.email = $("#cp-em", box).value; const r = startParticipation(c.id, pub.email); if (!r.ok) { pub.err = r.err; return render(); } Object.assign(pub, { err: "", step: "otp", participantId: r.participant.id, challengeId: r.challengeId }); render(); });
    return;
  }
  if (pub.step === "otp") {
    box.innerHTML = `${head}<form class="card" id="cp-otp" novalidate><h2>Code reçu par e-mail</h2><p class="small muted">Envoyé à <strong>${esc(pub.email)}</strong>, valable ${OTP_VALID_MIN} minutes.</p><div class="field"><label for="cp-code">Code à 6 chiffres</label><input id="cp-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>${pub.err ? `<div class="banner banner-warn" role="alert">${esc(pub.err)}</div>` : ""}<button class="btn btn-orange btn-lg btn-block" type="submit">Vérifier</button></form>`;
    $("#cp-otp", box).addEventListener("submit", (e) => { e.preventDefault(); const r = verifyParticipant(pub.challengeId, $("#cp-code", box).value); if (r !== "OK") { pub.err = { FAUX: "Code incorrect.", EXPIRE: "Code expiré : recommencez.", BLOQUE: "Trop d'essais : recommencez." }[r] || "Code invalide."; return render(); } Object.assign(pub, { err: "", step: "consent" }); render(); });
    return;
  }
  if (pub.step === "consent") {
    box.innerHTML = `${head}<form class="card" id="cp-cons"><h2>Avant de commencer</h2>${consentsHtml(consentsOf(p, "pre"), pub.consents, "cpc")}${pub.err ? `<div class="banner banner-warn">${esc(pub.err)}</div>` : ""}<button class="btn btn-orange btn-lg btn-block" type="submit">Commencer</button></form>`;
    $("#cp-cons", box).addEventListener("submit", (e) => { e.preventDefault(); readConsents(box, pub.consents); if (consentsOf(p, "pre").some((x) => x.required && !pub.consents[x.id])) { pub.err = "Le consentement est nécessaire pour participer."; return render(); } Object.assign(pub, { err: "", step: "form", section: 0 }); render(); });
    return;
  }
  if (pub.step === "form") {
    // BSPA : une section par page (comme la maquette BSPA) ; autres tests : une page.
    const sections = T.sections || [{ key: "-", title: T.intro, items: T.items }];
    const sec = sections[pub.section];
    const offset = sections.slice(0, pub.section).reduce((n, s) => n + s.items.length, 0);
    const last = pub.section === sections.length - 1;
    box.innerHTML = `${head}${stepperHtml([...sections.map((s) => s.short || "Questions"), "Vous"], pub.section)}<form class="card" id="cp-sec"><h2>${esc(sec.title)}</h2>
      ${sec.items.map((it, j) => { const i = offset + j; return `<fieldset class="q-block"><legend>${esc(it.t)}</legend><div class="scale">${it.o.map(([v, l]) => `<label><input type="radio" name="q${i}" value="${v}" ${pub.answers[i] === v ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div></fieldset>`; }).join("")}
      <div class="err" id="sec-err" role="alert"></div><div class="wizard-foot">${pub.section ? `<button type="button" class="btn btn-ghost" id="sec-prev">← Précédent</button>` : "<span></span>"}<button class="btn btn-orange" type="submit">${last ? "Continuer" : "Suivant"}</button></div></form>`;
    const read = () => sec.items.forEach((_, j) => { const x = $(`input[name=q${offset + j}]:checked`, box); if (x) pub.answers[offset + j] = +x.value; });
    $("#sec-prev", box)?.addEventListener("click", () => { read(); pub.section--; render(); });
    $("#cp-sec", box).addEventListener("submit", (e) => { e.preventDefault(); read(); if (sec.items.some((_, j) => pub.answers[offset + j] == null)) { $("#sec-err", box).textContent = "Répondez à toutes les questions de cette page."; return; } if (last) pub.step = "about"; else pub.section++; render(); scrollTopStage(); });
    return;
  }
  if (pub.step === "about") {
    box.innerHTML = `${head}<form class="card" id="cp-about" novalidate><h2>Quelques informations</h2><p class="small muted">Elles servent uniquement aux statistiques anonymes (groupes d'au moins 5 personnes).</p><div class="grid-2">${p.fields.map((f) => fieldHtml(f, pub.values, "ab")).join("")}</div>${pub.err ? `<div class="banner banner-warn" role="alert">${esc(pub.err)}</div>` : ""}<button class="btn btn-orange btn-lg btn-block" type="submit">Envoyer mes réponses</button></form>`;
    $("#cp-about", box).addEventListener("submit", (e) => {
      e.preventDefault(); readFields(box, pub.values);
      const m = missingFields(p.fields, pub.values); if (m.length) { pub.err = `Complétez : ${m.join(", ")}.`; return render(); }
      const { identity, profile } = splitValues(p, pub.values);
      const r = submitParticipation(pub.participantId, { identity, profile, answers: pub.answers, consentsPre: pub.consents });
      if (!r.ok) { pub.err = r.err; return render(); }
      Object.assign(pub, { err: "", step: "bilan", ev: r.evaluation.id }); render(); scrollTopStage();
    });
    return;
  }
  const ev = evaluationOf(pub.ev);
  box.innerHTML = `${head}<div class="banner banner-ok">✓ Merci, vos réponses sont enregistrées.</div><div class="card"><span class="eyebrow">Votre bilan personnel</span>${resultCardHtml(ev, { forPatient: true })}</div>
    <p class="small muted" style="text-align:center">Ce bilan n'est visible que par vous et par les professionnels de YODAN. Il ne vous sera pas envoyé par e-mail : pour le revoir plus tard, contactez YODAN.</p>`;
  bindPostForm(box, ev);
}
/* ---------- QR donné par un agent ---------- */
function pubQr(box, p) {
  const open = pub.entry === "qr_ouvert";
  const test = p.tests[0];
  if (pub.step === "result") { const ev = evaluationOf(pub.ev); box.innerHTML = `<div class="card">${resultCardHtml(ev, { forPatient: true })}</div><p class="small muted" style="text-align:center">Vous pouvez fermer cette page.</p>`; bindPostForm(box, ev); return; }
  if (pub.step === "questions") return pubQuestions(box, test, () => {
    const { identity, profile } = splitValues(p, pub.values);
    const r = recordEvaluation({ partnerId: p.id, test, ids: pub.ids, agency: p.agencies[0], identity, profile, answers: pub.answers, consentsPre: pub.consents, mode: open ? "qr_ouvert" : "qr" });
    if (!r.ok) { pub.err = r.err; pub.step = "info"; return render(); }
    pub.ev = r.evaluation.id; pub.step = "result"; render();
  });
  if (open && pub.step === "start") {
    const active = p.agencies.filter((a) => agencyOpt(p, a).qrAllowed && agencyOpt(p, a).qrActive);
    box.innerHTML = active.length ? `<form class="card" id="qo" novalidate><span class="eyebrow">${esc(active[0])}</span><h1>${esc(TESTS[test].desc)}</h1><p class="muted">Commençons par votre numéro.</p><div class="row">${p.idLabels.map((l, i) => `<div class="field"><label for="qo-${i}">${esc(l)}</label><input id="qo-${i}" autocomplete="off"></div>`).join("")}</div>${pub.err ? `<div class="banner banner-warn" role="alert">${esc(pub.err)}</div>` : ""}<button class="btn btn-orange btn-lg btn-block" type="submit">Continuer</button></form>` : `<div class="card"><p class="empty">Aucune affiche QR active pour ce partenaire.</p></div>`;
    $("#qo", box)?.addEventListener("submit", (e) => {
      e.preventDefault(); pub.ids = Object.fromEntries(p.idLabels.map((_, i) => [`id${i + 1}`, $(`#qo-${i}`, box).value.trim()]));
      if (!pub.ids.id1) { pub.err = `Saisissez votre ${p.idLabels[0]}.`; return render(); }
      // Une personne déjà connue est orientée vers un agent (suivi possible seulement avec lui).
      if (findPerson(p.id, pub.ids.id1)) { pub.err = "Vous êtes déjà suivi(e) : rapprochez-vous d'un agent de l'accueil, il vous accompagnera."; return render(); }
      pub.err = ""; pub.step = "info"; render();
    });
    return;
  }
  if (!open && !pub.ids.id1) pub.ids = { id1: `DEMO-9${String(clock.now).slice(-5)}`, id2: "SIN-QR" };
  box.innerHTML = `<form class="card" id="qi" novalidate><h1>${esc(TESTS[test].desc)}</h1><p class="muted">Vos réponses sont confidentielles.</p>${consentsHtml(consentsOf(p, "pre"), pub.consents, "qi")}
    ${open ? `<h2>Vous</h2><div class="grid-2">${p.fields.filter((f) => f.level === "person" || f.required).map((f) => fieldHtml(f, pub.values, "qf")).join("")}</div>` : ""}${pub.err ? `<div class="banner banner-warn" role="alert">${esc(pub.err)}</div>` : ""}
    <button class="btn btn-orange btn-lg btn-block" type="submit">Commencer le questionnaire</button></form>`;
  $("#qi", box).addEventListener("submit", (e) => {
    e.preventDefault(); readConsents(box, pub.consents); readFields(box, pub.values);
    if (consentsOf(p, "pre").some((c) => c.required && !pub.consents[c.id])) { pub.err = "Sans ce consentement, le questionnaire ne peut pas commencer."; return render(); }
    const m = open ? missingFields(p.fields.filter((f) => f.level === "person" || f.required), pub.values) : [];
    if (m.length) { pub.err = `Complétez : ${m.join(", ")}.`; return render(); }
    pub.err = ""; pub.step = "questions"; pub.q = 0; render();
  });
}
/** Démo : remplit le questionnaire public affiché. */
function fillPublicDemo(level) {
  const p = partnerOf(pub.partnerId); if (!p) return;
  const test = pub.entry === "campagne" ? campaignOf(pub.campaignId).test : p.tests[0];
  const r0 = rng(clock.now + level * 100), T = TESTS[test];
  pub.answers = test === "BSPA" ? bspaAnswers(level, r0) : answersForTotal(T.items.length, T.items[0].o.length - 1, Math.round(level * T.items.length * (T.items[0].o.length - 1)), r0);
  if (pub.step === "questions") pub.q = T.items.length - 1;
  if (pub.step === "form") pub.section = (T.sections || [1]).length - 1;
  render();
}
