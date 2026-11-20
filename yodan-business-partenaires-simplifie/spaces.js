/*
 * spaces.js : espaces de la maquette simplifiée.
 *  - Admin LAMIFI Business : partenaires + création par type (en un écran court)
 *  - Admin Yodan : onglets communs à tous les partenaires
 *  - Espace partenaire : onglets calculés selon le rôle et les fonctionnalités incluses
 */
"use strict";

/* =====================================================================
 * Seul réglage d'un partenaire : inclure une fonctionnalité d'un rôle dans un autre rôle
 * ===================================================================== */
function includeEditorHtml(cfg) {
  return `<div class="roles-ed">${rolesDesc().filter((r) => cfg.roles[r].on).map((r) => {
    const feats = featuresAvailable(cfg, r);
    return `<div class="role-row"><div class="role-head"><span class="rname">${ROLE_LABEL[r]}</span>${ROLE_OLD[r] ? `<span class="old">${ROLE_OLD[r]}</span>` : ""}<span class="grow"></span>${feats.filter((f) => f.own).map((f) => `<span class="feat own">${FEATURE_ICON[f.key]} ${FEATURE_LABEL[f.key]}</span>`).join("")}</div>
      <div class="role-body"><span class="small muted">Inclure :</span>${feats.filter((f) => !f.own).map((f) => `<label class="feat inh"><input type="checkbox" data-inc="${r}|${f.key}" ${cfg.roles[r].inherit[f.key] ? "checked" : ""}> ${FEATURE_ICON[f.key]} ${FEATURE_LABEL[f.key]} <span class="from">· ${ROLE_LABEL[f.from]}</span></label>`).join("")}</div></div>`;
  }).join("")}</div>`;
}
function bindIncludeEditor(root, cfg, onChange) {
  $$("[data-inc]", root).forEach((el) => el.addEventListener("change", () => { const [r, k] = el.dataset.inc.split("|"); setInclude(cfg, r, k, el.checked); onChange(); }));
}
const tabsSummaryHtml = (cfg) => `<dl class="kv">${rolesDesc().filter((r) => cfg.roles[r].on).map((r) => `<dt>${ROLE_LABEL[r]}</dt><dd>${tabsFor(cfg, r).map((k) => `${FEATURE_ICON[k]} ${FEATURE_LABEL[k]}`).join(" · ")}</dd>`).join("")}</dl>`;
/** Fenêtre « Rôles » d'un partenaire (Admin LAMIFI et Admin Yodan). */
function rolesModal(p, done) {
  modal(`Rôles — ${p.name}`, "", (body) => {
    const draw = () => {
      body.innerHTML = `<p class="small muted" style="margin-top:0">${esc(PARTNER_TYPES[p.type].label)} : les rôles sont fixés par le type. Vous pouvez seulement donner à un rôle l'onglet d'un autre rôle.</p>${includeEditorHtml(p)}<h3 style="margin-top:1rem">Onglets par rôle</h3>${tabsSummaryHtml(p)}`;
      bindIncludeEditor(body, p, () => { p.customized = !sameConfig(p, presetFor(p.type)); audit("Inclusion de fonctionnalité", p.name); toast("Réglage enregistré."); draw(); done?.(); });
    };
    draw();
  }, true);
}

/* =====================================================================
 * Admin LAMIFI Business
 * ===================================================================== */
RENDER.lamifi = (root) => {
  const tab = tabOf("lamifi", "partners");
  root.innerHTML = `${appBar(yodanLogo("LAMIFI Business"), "Admin LAMIFI Business", ENV.LAMIFI_ADMIN_NAME)}
    ${tabsHtml("lamifi", [{ id: "partners", icon: "🏢", label: "Partenaires", count: db.partners.length }, { id: "create", icon: "＋", label: "Créer un partenaire" }, { id: "sectors", icon: "🏷", label: "Secteurs d'activité", count: db.settings.sectors.length }, { id: "units", icon: "🧭", label: "Directions et régions" }, { id: "history", icon: "🕘", label: "Historique" }, { id: "logs", icon: "🗂", label: "Journaux internes" }], tab)}
    <div class="page" id="body"></div>`;
  bindAppBar(root);
  bindTabs(root);
  ({ create: renderCreatePartner, sectors: renderSectors, units: renderDefaultUnits, history: (el) => historyView(el, { key: "lamifi" }), logs: logsView }[tab] || renderPartnerList)($("#body", root));
};
const lamifiList = { sector: "all" };
function renderPartnerList(el) {
  if (lamifiList.sector !== "all" && !db.settings.sectors.includes(lamifiList.sector)) lamifiList.sector = "all";
  const list = db.partners.filter((p) => lamifiList.sector === "all" || p.sector === lamifiList.sector);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Partenaires</span><h1>Espaces partenaires</h1></div>
      <button type="button" class="btn btn-orange" id="to-create">＋ Créer un partenaire</button></div>
    <div class="toolbar"><label class="small">Secteur <select id="pl-s"><option value="all">Tous les secteurs</option>${db.settings.sectors.map((x) => `<option ${lamifiList.sector === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label><span class="small muted">${list.length} partenaire(s)</span></div>
    <div class="card table-wrap"><table class="table"><thead><tr><th>Partenaire</th><th>Type</th><th>Secteur</th><th>Tests</th><th>E-mail pro</th><th>Tenant</th><th class="num-cell">Comptes</th><th></th></tr></thead><tbody>
    ${list.map((p) => `<tr><td><strong>${esc(p.name)}</strong><div class="small muted">créé le ${fmtDate(p.createdAt)}</div></td>
      <td>${PARTNER_TYPES[p.type].ico} ${esc(PARTNER_TYPES[p.type].label)}${p.customized ? ` <span class="pill bleu" title="Une fonctionnalité a été incluse dans un autre rôle">inclusions</span>` : ""}</td>
      <td class="small">${esc(p.sector)}<div class="muted">${p.units.length} ${esc(UNIT_LABEL[p.type].list.toLowerCase())}</div></td>
      <td>${p.tests.map((t) => `<span class="pill bleu">${t}</span>`).join(" ")}</td><td class="small">${p.campaign.emailPro ? esc(p.campaign.domains.join(", ")) : '<span class="muted">non exigé</span>'}</td>
      <td class="small"><code>${esc(p.tenant)}</code></td>
      <td class="num-cell">${db.identities.filter((i) => i.partnerId === p.id).length}</td>
      <td class="actions"><button type="button" class="btn btn-sm" data-roles="${p.id}">Rôles</button><button type="button" class="btn btn-sm btn-ghost" data-open="${p.id}">Ouvrir l'espace</button></td></tr>`).join("")}
    </tbody></table></div>`;
  $("#to-create", el).addEventListener("click", () => setTab("lamifi", "create"));
  $("#pl-s", el).addEventListener("change", (e) => { lamifiList.sector = e.target.value; renderPartnerList(el); });
  $$("[data-open]", el).forEach((b) => b.addEventListener("click", () => go("partner", { partnerId: b.dataset.open })));
  $$("[data-roles]", el).forEach((b) => b.addEventListener("click", () => rolesModal(partnerOf(b.dataset.roles), () => renderPartnerList(el))));
}

const newDraft = () => ({ name: "", type: "ENTREPRISE", sector: "", cfg: presetFor("ENTREPRISE"), domainsText: "", fa: { name: "", email: "" }, errors: {} });
let cd = newDraft();
/** Création par type, en un écran : nom, type, tests, domaines, premier compte. Inclusions : facultatives, repliées. */
function renderCreatePartner(el) {
  const c = cd.cfg, e = cd.errors;
  const err = (k) => (e[k] ? "has-err" : "");
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Nouveau partenaire</span><h1>Créer un partenaire</h1></div></div>
    <div class="split"><form class="card" id="cp" novalidate>
      <div class="section-title"><span class="num">1</span><h2>Partenaire</h2></div>
      <div class="field ${err("name")}"><label for="cp-name">Nom</label><input id="cp-name" value="${esc(cd.name)}" placeholder="Ex. : Entreprise Démo Gamma" autocomplete="off">${errBox(e, "name")}</div>
      <div class="field ${err("sector")}"><label for="cp-sector">Secteur d'activité</label><select id="cp-sector"><option value="">Choisir…</option>${db.settings.sectors.map((x) => `<option ${cd.sector === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select><div class="hint">Liste gérée dans l'onglet « Secteurs d'activité ». Sert uniquement de filtre.</div>${errBox(e, "sector")}</div>
      <div class="type-cards" role="radiogroup" aria-label="Type de partenaire">${Object.entries(PARTNER_TYPES).map(([k, t]) => `<button type="button" role="radio" aria-checked="${cd.type === k}" class="type-card ${cd.type === k ? "on" : ""}" data-type="${k}"><span class="ico">${t.ico}</span><strong>${esc(t.label)}</strong><span class="small">${esc(t.desc)}</span></button>`).join("")}</div>

      <div class="banner banner-info small">${esc(UNIT_LABEL[cd.type].list)} : la liste par défaut (onglet « Directions et régions ») est copiée à la création (${db.settings.defaultUnits[cd.type].map(esc).join(", ") || "vide"}). Elle sert de champ « ${esc(UNIT_LABEL[cd.type].one)} » dans le questionnaire et de filtre dans le tableau de bord ; l'admin Yodan peut l'ajuster ensuite.</div>
      <div class="section-title"><span class="num">2</span><h2>Tests et campagnes</h2></div>
      <div class="field"><span class="lbl">Tests proposés</span><div class="chips-check">${TEST_KEYS.map((t) => `<label><input type="checkbox" data-test="${t}" ${c.tests.includes(t) ? "checked" : ""}> ${t} <span class="small muted">· ${TESTS[t].desc}</span></label>`).join("")}</div>${errBox(e, "tests")}</div>
      <label class="switch"><input type="checkbox" id="cp-pro" ${c.campaign.emailPro ? "checked" : ""}><span class="track"></span> Exiger une adresse e-mail professionnelle <span class="small muted">(facultatif)</span></label>
      ${c.campaign.emailPro ? `<div class="field ${err("domains")}" style="margin-top:.6rem"><label for="cp-dom">Domaines autorisés</label><textarea id="cp-dom" rows="2" placeholder="partenaire.exemple.test">${esc(cd.domainsText)}</textarea><div class="hint">Un par ligne. Les messageries publiques (gmail…) sont refusées.</div>${errBox(e, "domains")}</div>` : ""}

      <div class="section-title"><span class="num">3</span><h2>Premier compte</h2></div>
      <div class="banner banner-info">Rôle : <strong>${ROLE_LABEL[highestRole(c)]}</strong></div>
      <div class="row"><div class="field ${err("faName")}"><label for="fa-name">Nom du titulaire</label><input id="fa-name" value="${esc(cd.fa.name)}" autocomplete="off">${errBox(e, "faName")}</div>
        <div class="field ${err("faEmail")}"><label for="fa-email">E-mail</label><input id="fa-email" type="email" value="${esc(cd.fa.email)}" autocomplete="off">${errBox(e, "faEmail")}</div></div>

      <details class="include-box" ${cd.openInclude ? "open" : ""}><summary>Inclure une fonctionnalité dans un autre rôle (facultatif)</summary>${includeEditorHtml(c)}</details>
      ${Object.keys(e).length ? `<div class="banner banner-err" role="alert">Corrigez les ${Object.keys(e).length} point(s) signalé(s).</div>` : ""}
      <button type="submit" class="btn btn-orange btn-lg btn-block">Créer le partenaire</button>
    </form>
    <aside class="card sticky"><span class="eyebrow">Aperçu</span><h2>Onglets par rôle</h2>${tabsSummaryHtml(c)}</aside></div>`;
  const keep = () => {
    cd.name = $("#cp-name", el).value;
    cd.sector = $("#cp-sector", el).value;
    if ($("#cp-dom", el)) { cd.domainsText = $("#cp-dom", el).value; c.campaign.domains = parseDomains(cd.domainsText); }
    cd.fa = { name: $("#fa-name", el).value, email: $("#fa-email", el).value };
    cd.openInclude = $(".include-box", el).open;
  };
  const again = () => { const y = window.scrollY; renderCreatePartner(el); window.scrollTo(0, y); };
  $$("[data-type]", el).forEach((b) => b.addEventListener("click", () => { keep(); const tests = c.tests; cd.type = b.dataset.type; const pro = c.campaign.emailPro; cd.cfg = presetFor(cd.type); cd.cfg.tests = tests; cd.cfg.campaign.emailPro = pro; cd.cfg.campaign.domains = pro ? parseDomains(cd.domainsText) : []; cd.errors = {}; again(); }));
  $$("[data-test]", el).forEach((x) => x.addEventListener("change", () => { keep(); c.tests = TEST_KEYS.filter((t) => $(`[data-test="${t}"]`, el).checked); again(); }));
  bindIncludeEditor(el, c, () => { keep(); again(); });
  $("#cp-pro", el).addEventListener("change", (ev) => { keep(); c.campaign.emailPro = ev.target.checked; if (!c.campaign.emailPro) c.campaign.domains = []; else c.campaign.domains = parseDomains(cd.domainsText); again(); });
  $("#cp", el).addEventListener("submit", (ev) => {
    ev.preventDefault(); keep();
    const r = createPartner({ name: cd.name, type: cd.type, sector: cd.sector, cfg: c, firstAccount: cd.fa });
    if (!r.ok) { cd.errors = r.errors; again(); $(".has-err input, .has-err textarea", el)?.focus(); return; }
    toast(`Partenaire « ${esc(r.partner.name)} » créé. Lien d'activation envoyé à ${esc(r.identity.email)} (${ROLE_LABEL[r.role]}).`);
    cd = newDraft();
    setTab("lamifi", "partners");
  });
}

/** Admin LAMIFI : liste des secteurs d'activité (choisie à la création d'un partenaire, sert de filtre). */
function renderSectors(el, err = "") {
  const usage = (x) => db.partners.filter((p) => p.sector === x).length;
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Réglages</span><h1>Secteurs d'activité</h1><p class="small muted" style="margin:0">Métadonnée des partenaires : sert uniquement de filtre (listes, tableaux de bord Yodan).</p></div></div>
    <div class="split"><form class="card" id="sec-f"><div class="field"><label for="sec-t">Un secteur par ligne</label><textarea id="sec-t" rows="12">${esc(db.settings.sectors.join("\n"))}</textarea><div class="hint">Un secteur utilisé par un partenaire ne peut pas être retiré.</div></div>
      ${err ? `<div class="banner banner-err" role="alert">${esc(err)}</div>` : ""}<button class="btn btn-primary" type="submit">Enregistrer</button></form>
    <aside class="card sticky"><h2>Utilisation</h2><div class="table-wrap"><table class="table"><thead><tr><th>Secteur</th><th class="num-cell">Partenaires</th></tr></thead><tbody>${db.settings.sectors.map((x) => `<tr><td>${esc(x)}</td><td class="num-cell">${usage(x)}</td></tr>`).join("")}</tbody></table></div></aside></div>`;
  $("#sec-f", el).addEventListener("submit", (e) => {
    e.preventDefault();
    const r = setSectors($("#sec-t", el).value);
    if (!r.ok) return renderSectors(el, r.err);
    toast("Secteurs enregistrés."); render();
  });
}

/* =====================================================================
 * Fonctionnalités partagées (partenaire et admin Yodan)
 * scope = { partnerIds, censor, actor: "partner" | "yodan", role, agencies }
 * ===================================================================== */
const multi = (scope) => scope.partnerIds.length > 1;
const pName = (id) => partnerOf(id)?.name || "—";

/* ---------- Comptes : identifiant d'abord, puis rôles ; migration ; désactivation ciblée ---------- */
const accState = {};
function viewAccounts(el, scope, key) {
  const st = accState[key] || (accState[key] = { sel: null, q: "" });
  const list = db.identities.filter((i) => i.kind === "PARTNER" && scope.partnerIds.includes(i.partnerId) && (!st.q || norm(`${i.name} ${i.email}`).includes(norm(st.q))));
  if (st.sel && !list.some((i) => i.id === st.sel)) st.sel = null;
  const sel = st.sel ? identityOf(st.sel) : null;
  const redraw = () => viewAccounts(el, scope, key);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Comptes</span><h1>Identifiants et rôles</h1></div>
      <button type="button" class="btn btn-orange" id="a-new">＋ Nouvel identifiant</button></div>
    <div class="split"><div class="card"><div class="toolbar"><input type="search" class="grow" id="a-q" placeholder="Rechercher un nom ou un e-mail" value="${esc(st.q)}" aria-label="Rechercher"></div>
      <div class="id-list">${list.length ? list.map((i) => `<button type="button" class="id-item ${i.id === st.sel ? "sel" : ""}" data-id="${i.id}"><span class="top"><strong>${esc(i.name)}</strong>${pill(ID_STATUS[identityStatus(i)])}</span><span class="small muted">${esc(i.email)}${multi(scope) ? ` · ${esc(pName(i.partnerId))}` : ""}</span>
        <span class="role-chips">${assignmentsOf(i.id).map((a) => `<span class="pill ${a.active && partnerOf(a.partnerId).roles[a.role].on ? "bleu" : "off"}">${ROLE_LABEL[a.role]}</span>`).join("") || `<span class="pill orange">Aucun rôle</span>`}</span></button>`).join("") : `<p class="empty">Aucun identifiant.</p>`}</div></div>
      <div class="card sticky" id="a-detail">${sel ? "" : `<p class="empty">Sélectionnez un identifiant pour gérer ses rôles.</p>`}</div></div>`;
  $("#a-q", el).addEventListener("input", (e) => { st.q = e.target.value; const pos = e.target.selectionStart; redraw(); const q = $("#a-q", el); q.focus(); q.setSelectionRange(pos, pos); });
  $$("[data-id]", el).forEach((b) => b.addEventListener("click", () => { st.sel = b.dataset.id; redraw(); }));
  $("#a-new", el).addEventListener("click", () => newIdentityModal(scope, (id) => { st.sel = id; redraw(); }));
  if (!sel) return;
  const p = partnerOf(sel.partnerId);
  const asg = assignmentsOf(sel.id);
  const status = identityStatus(sel);
  const d = $("#a-detail", el);
  d.innerHTML = `<h2>${esc(sel.name)} ${pill(ID_STATUS[status])}</h2>
    <dl class="kv"><dt>Identifiant</dt><dd>${esc(sel.email)}</dd><dt>Partenaire</dt><dd>${esc(p.name)}</dd><dt>Créé le</dt><dd>${fmtDateTime(sel.createdAt)}</dd>${sel.activatedAt ? `<dt>Activé le</dt><dd>${fmtDateTime(sel.activatedAt)}</dd>` : ""}</dl>
    <div class="actions" style="margin:.8rem 0">${!sel.activatedAt && !sel.disabled ? `<button type="button" class="btn btn-sm" data-act="resend">✉️ Renvoyer l'invitation</button>` : ""}
      <button type="button" class="btn btn-sm ${sel.disabled ? "" : "btn-danger"}" data-act="toggleId">${sel.disabled ? "Réactiver l'identifiant" : "Désactiver l'identifiant"}</button></div>
    <h3>Rôles (${asg.length})</h3>
    ${asg.map((a) => { const roleOff = !p.roles[a.role].on; return `<div class="asg ${a.active ? "" : "inactive"}"><div class="grow"><strong>${ROLE_LABEL[a.role]}</strong> ${a.active ? (roleOff ? `<span class="pill gris">rôle désactivé chez le partenaire</span>` : `<span class="pill vert">actif</span>`) : `<span class="pill gris">désactivé</span>`}
      <div class="small muted">${esc(a.agencies.join(", "))}${a.history.length ? ` · migré depuis ${esc(a.history.at(-1).from)}` : ""}</div></div>
      <button type="button" class="btn btn-sm" data-toggle="${a.id}">${a.active ? "Désactiver" : "Réactiver"}</button>
      <button type="button" class="btn btn-sm" data-migrate="${a.id}">⇄ Migrer</button></div>`; }).join("") || `<div class="banner banner-warn">Aucun rôle : cet identifiant ne peut pas encore se connecter. Ajoutez-lui un rôle.</div>`}
    <button type="button" class="btn btn-primary btn-sm" data-act="addRole" ${sel.disabled ? "disabled" : ""}>＋ Ajouter un rôle</button>`;
  bind(d, {
    resend: () => { resendActivation(sel.id); toast(`Nouveau lien d'activation envoyé à ${esc(sel.email)}.`); redraw(); },
    toggleId: () => { setIdentityDisabled(sel.id, !sel.disabled); toast(sel.disabled ? "Identifiant désactivé : plus aucune connexion possible." : "Identifiant réactivé."); if (ui.space !== "login") redraw(); },
    addRole: () => addRoleModal(sel, redraw),
  });
  $$("[data-toggle]", d).forEach((b) => b.addEventListener("click", () => { const a = db.assignments.find((x) => x.id === b.dataset.toggle); setAssignmentActive(a.id, !a.active); toast(`Rôle ${ROLE_LABEL[a.role]} ${a.active ? "réactivé" : "désactivé"} ; les autres rôles ne changent pas.`); redraw(); }));
  $$("[data-migrate]", d).forEach((b) => b.addEventListener("click", () => migrateModal(db.assignments.find((x) => x.id === b.dataset.migrate), redraw)));
}
function newIdentityModal(scope, done) {
  modal("Nouvel identifiant", `<div class="steps"><span class="on">1. Identifiant</span><span>2. Rôles</span></div><form id="ni" novalidate>
    ${multi(scope) ? `<div class="field"><label for="ni-p">Partenaire</label><select id="ni-p">${scope.partnerIds.map((id) => `<option value="${id}">${esc(pName(id))}</option>`).join("")}</select></div>` : ""}
    <div class="field"><label for="ni-n">Nom et prénom</label><input id="ni-n" autocomplete="off"><div class="err" id="ni-en"></div></div>
    <div class="field"><label for="ni-e">E-mail</label><input id="ni-e" type="email" autocomplete="off"><div class="err" id="ni-ee"></div></div>
    
    <button class="btn btn-orange btn-block" type="submit">Créer l'identifiant →</button></form>`, (body, close) => {
    $("#ni", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const r = createIdentity({ partnerId: $("#ni-p", body)?.value || scope.partnerIds[0], name: $("#ni-n", body).value, email: $("#ni-e", body).value });
      if (!r.ok) { $("#ni-en", body).textContent = r.errors.name || ""; $("#ni-ee", body).textContent = r.errors.email || ""; return; }
      close(); toast("Identifiant créé, lien d'activation envoyé. Étape 2 : ajoutez un rôle."); done(r.identity.id); addRoleModal(r.identity, () => done(r.identity.id));
    });
  });
}
function addRoleModal(i, done) {
  const p = partnerOf(i.partnerId);
  const free = rolesDesc().filter((r) => p.roles[r].on && !assignmentsOf(i.id).some((a) => a.role === r));
  if (!free.length) { toast("Cet identifiant a déjà tous les rôles actifs du partenaire."); return; }
  const agHtml = (role) => p.agencies.map((a, k) => `<label><input type="${role === "EVAL" ? "radio" : "checkbox"}" name="ar-ag" data-ag value="${esc(a)}" ${role !== "EVAL" || k === 0 ? "checked" : ""}> ${esc(a)}</label>`).join("");
  modal(`Ajouter un rôle — ${i.name}`, `<div class="steps"><span class="done">✓ 1. Identifiant</span><span class="on">2. Rôles</span></div><form id="ar">
    <div class="field"><span class="lbl">Rôle</span><div class="chips-check" role="radiogroup">${free.map((r, k) => `<label><input type="radio" name="ar-r" value="${r}" ${k === 0 ? "checked" : ""}> ${ROLE_LABEL[r]}</label>`).join("")}</div></div>
    <div class="field"><span class="lbl" id="ar-ag-l">Agences / sites</span><div class="chips-check" id="ar-ag"></div></div>
    <div class="err" id="ar-err"></div><button class="btn btn-orange btn-block" type="submit">Ajouter le rôle</button></form>`, (body, close) => {
    const syncAg = () => { const role = $("input[name=ar-r]:checked", body).value; $("#ar-ag", body).innerHTML = agHtml(role); $("#ar-ag-l", body).textContent = role === "EVAL" ? "Agence (une seule pour un évaluateur)" : "Agences / sites"; };
    $$("input[name=ar-r]", body).forEach((x) => x.addEventListener("change", syncAg)); syncAg();
    $("#ar", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const ags = $$("[data-ag]:checked", body).map((x) => x.value);
      if (!ags.length) { $("#ar-err", body).textContent = "Choisissez au moins une agence."; return; }
      const r = addRole(i.id, $("input[name=ar-r]:checked", body).value, ags);
      if (!r.ok) { $("#ar-err", body).textContent = r.err; return; }
      close(); toast(`Rôle ${ROLE_LABEL[r.assignment.role]} ajouté.`); done();
    });
  });
}
function migrateModal(a, done) {
  const from = identityOf(a.identityId);
  const targets = db.identities.filter((i) => i.partnerId === a.partnerId && i.id !== from.id && !i.disabled && !assignmentsOf(i.id).some((x) => x.role === a.role));
  modal(`Migrer le rôle ${ROLE_LABEL[a.role]}`, `<p>Le rôle <strong>${ROLE_LABEL[a.role]}</strong> (agences : ${esc(a.agencies.join(", "))}) passe de <strong>${esc(from.email)}</strong> à un autre identifiant. L'historique et les dossiers suivent le rôle ; ${esc(from.name)} garde ses autres rôles.</p>
    ${targets.length ? `<form id="mg"><div class="field"><label for="mg-t">Vers l'identifiant</label><select id="mg-t">${targets.map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.email)} (${ID_STATUS[identityStatus(t)][1]})</option>`).join("")}</select></div>
      <div class="err" id="mg-err"></div><button class="btn btn-orange btn-block" type="submit">Migrer</button></form>` : `<div class="banner banner-warn">Aucun identifiant cible disponible. Créez d'abord le nouvel identifiant (étape 1), puis revenez migrer le rôle.</div>`}`, (body, close) => {
    $("#mg", body)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = migrateAssignment(a.id, $("#mg-t", body).value);
      if (!r.ok) { $("#mg-err", body).textContent = r.err; return; }
      close(); toast("Rôle migré."); done();
    });
  });
}

/* =====================================================================
 * Admin Yodan — onglets communs à tous les partenaires
 * ===================================================================== */
const yo = { partner: "all", sector: "all" };
const YODAN_TABS = [
  { id: "dashboard", icon: "📊", label: "Tableau de bord" },
  { id: "campagnes", icon: "📣", label: "Campagnes et participants" },
  { id: "evaluation", icon: "📝", label: "Évaluation" },
  { id: "validation", icon: "✅", label: "Validation" },
  { id: "comptes", icon: "👥", label: "Comptes" },
  { id: "patients", icon: "🩺", label: "À prendre en charge" },
  { id: "partenaires", icon: "🧩", label: "Rôles du partenaire" },
  { id: "listes", icon: "🗂", label: "Directions et régions" },
];
RENDER.yodan = (root) => {
  const tab = tabOf("yodan", "dashboard");
  if (yo.sector !== "all" && !db.settings.sectors.includes(yo.sector)) yo.sector = "all";
  // Filtre secteur : limite les partenaires de tous les onglets (métadonnée, filtre seulement).
  const inSector = db.partners.filter((p) => yo.sector === "all" || p.sector === yo.sector);
  if (yo.partner !== "all" && !inSector.some((p) => p.id === yo.partner)) yo.partner = "all";
  const pids = yo.partner === "all" ? inSector.map((p) => p.id) : [yo.partner];
  // Compteur : personnes à prendre en charge jamais exportées.
  const counts = { validation: pendingDecisions(pids).length, patients: db.patients.filter((x) => pids.includes(x.partnerId) && !x.closedAt && !x.exports.length).length };
  const sectorSel = `<label class="small" style="display:flex;gap:.4rem;align-items:center"><span class="muted">Secteur</span><select id="yo-s" class="input" style="width:auto"><option value="all">Tous les secteurs</option>${db.settings.sectors.map((x) => `<option ${yo.sector === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>`;
  const filter = `${sectorSel}<label class="small" style="display:flex;gap:.4rem;align-items:center"><span class="muted">Partenaire</span><select id="yo-p" class="input" style="width:auto">${tab === "partenaires" ? "" : `<option value="all">Tous les partenaires</option>`}${inSector.map((p) => `<option value="${p.id}" ${yo.partner === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`;
  root.innerHTML = `${appBar(yodanLogo("Admin Yodan"), "Admin Yodan", "Admin Yodan Démo", filter)}
    ${tabsHtml("yodan", YODAN_TABS.map((t) => ({ ...t, count: counts[t.id], hot: true })), tab)}<div class="page" id="body"></div>`;
  bindAppBar(root); bindTabs(root);
  if (tab === "partenaires" && yo.partner === "all") { if (!inSector.length) yo.sector = "all"; yo.partner = (inSector[0] || db.partners[0]).id; return render(); }
  $("#yo-p", root).addEventListener("change", (e) => { yo.partner = e.target.value; render(); });
  $("#yo-s", root).addEventListener("change", (e) => { yo.sector = e.target.value; yo.partner = "all"; render(); });
  const scope = { partnerIds: pids, censor: false, actor: "yodan" };
  const body = $("#body", root);
  ({
    dashboard: () => viewDashboard(body, scope, "yodan"),
    campagnes: () => viewCampaigns(body, scope),
    evaluation: () => viewEvaluation(body, scope, "yodan"),
    validation: () => viewValidation(body, scope, "yodan"),
    comptes: () => viewAccounts(body, scope, "yodan"),
    patients: () => viewPatients(body, scope),
    partenaires: () => viewPartnerRoles(body, partnerOf(yo.partner)),
    listes: () => viewUnitLists(body, pids),
  })[tab]();
};
/* ---------- Directions (entreprise) / structures géographiques (mutuelle) ---------- */
/** Admin LAMIFI : listes par défaut par type, copiées à la création d'un partenaire. */
function renderDefaultUnits(el, errs = {}) {
  const card = (type) => `<form class="card" data-def="${type}"><h2>${PARTNER_TYPES[type].ico} ${esc(UNIT_LABEL[type].list)} par défaut <span class="pill gris">${esc(PARTNER_TYPES[type].label)}</span></h2>
    <div class="field"><label for="def-${type}">Une valeur par ligne (ex. ${esc(UNIT_LABEL[type].ex)})</label><textarea id="def-${type}" rows="8">${esc(db.settings.defaultUnits[type].join("\n"))}</textarea>
    <div class="hint">Copiée à la création d'un partenaire de ce type. La modifier ne change pas les partenaires existants : l'admin Yodan personnalise ensuite la liste de chaque partenaire.</div></div>
    ${errs[type] ? `<div class="banner banner-err" role="alert">${esc(errs[type])}</div>` : ""}<button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></form>`;
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Réglages</span><h1>Directions et régions par défaut</h1><p class="small muted" style="margin:0">Métadonnées : servent uniquement de filtre (champ du questionnaire, regroupement du tableau de bord).</p></div></div>
    <div class="grid-2">${card("ENTREPRISE")}${card("MUTUELLE")}</div>`;
  $$("[data-def]", el).forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = f.dataset.def, r = setDefaultUnits(type, $(`#def-${type}`, f).value);
    if (!r.ok) return renderDefaultUnits(el, { [type]: r.err });
    toast("Liste par défaut enregistrée."); renderDefaultUnits(el);
  }));
}

/**
 * Admin Yodan : personnalisation de la liste de chaque partenaire.
 * Le tableau garde tous les partenaires affichés ; « Modifier » ouvre l'éditeur à côté, sans toucher
 * au filtre partenaire de la barre du haut (sinon les autres partenaires disparaissaient du tableau).
 */
const unitEdit = { id: null, draft: null };
function viewUnitLists(el, pids, err = "") {
  const partners = pids.map(partnerOf);
  if (!partners.some((p) => p.id === unitEdit.id)) Object.assign(unitEdit, { id: partners.length === 1 ? partners[0].id : null, draft: null });
  const one = unitEdit.id ? partnerOf(unitEdit.id) : null;
  const used = (p, u) => db.evaluations.filter((e) => e.partnerId === p.id && e.profile.unite === u).length;
  const isDefault = (p) => JSON.stringify(p.units) === JSON.stringify(db.settings.defaultUnits[p.type]);
  const table = `<div class="card"><h2>Partenaires</h2><div class="table-wrap"><table class="table"><thead><tr><th>Partenaire</th><th>Secteur</th><th>Liste</th><th></th></tr></thead><tbody>
    ${partners.map((p) => `<tr class="${p.id === unitEdit.id ? "sel" : ""}"><td><strong>${esc(p.name)}</strong><div class="small muted">${esc(PARTNER_TYPES[p.type].label)}</div></td><td class="small">${esc(p.sector)}</td>
      <td class="small">${p.units.map(esc).join(" · ")}${isDefault(p) ? ` <span class="pill gris">par défaut</span>` : ` <span class="pill bleu">personnalisée</span>`}</td>
      <td><button type="button" class="btn btn-sm" data-pick="${p.id}" ${p.id === unitEdit.id ? 'aria-pressed="true"' : ""}>Modifier</button></td></tr>`).join("") || `<tr><td colspan="4" class="empty">Aucun partenaire pour ce secteur.</td></tr>`}</tbody></table></div></div>`;
  const editor = one ? `<form class="card sticky" id="own-f"><span class="eyebrow">${esc(PARTNER_TYPES[one.type].label)}</span><h2>${esc(UNIT_LABEL[one.type].list)} — ${esc(one.name)}</h2>
      <div class="field"><label for="own-u">Une valeur par ligne</label><textarea id="own-u" rows="9">${esc(unitEdit.draft ?? one.units.join("\n"))}</textarea>
      <div class="hint">Proposée dans le questionnaire (champ « ${esc(UNIT_LABEL[one.type].one)} ») et en filtre du tableau de bord. Retirer une valeur ne modifie pas les bilans déjà enregistrés.</div></div>
      ${err ? `<div class="banner banner-err" role="alert">${esc(err)}</div>` : ""}
      <div class="small muted" style="margin-bottom:.6rem">Bilans par valeur : ${one.units.map((u) => `${esc(u)} (${used(one, u)})`).join(" · ")}</div>
      <div class="actions"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button><button type="button" class="btn btn-ghost btn-sm" id="own-reset">Reprendre la liste par défaut</button><button type="button" class="btn btn-ghost btn-sm" id="own-close">Fermer</button></div></form>`
    : `<aside class="card sticky"><p class="empty">Choisissez « Modifier » sur un partenaire pour personnaliser sa liste.</p></aside>`;
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Métadonnées</span><h1>Directions et régions des partenaires</h1><p class="small muted" style="margin:0">Les listes par défaut sont gérées par l'admin LAMIFI Business ; ici, Yodan personnalise la liste de chaque partenaire.</p></div></div>
    <div class="split">${table}${editor}</div>`;
  $$("[data-pick]", el).forEach((b) => b.addEventListener("click", () => { Object.assign(unitEdit, { id: b.dataset.pick, draft: null }); viewUnitLists(el, pids); }));
  $("#own-close", el)?.addEventListener("click", () => { Object.assign(unitEdit, { id: null, draft: null }); viewUnitLists(el, pids); });
  $("#own-reset", el)?.addEventListener("click", () => { $("#own-u", el).value = db.settings.defaultUnits[one.type].join("\n"); });
  $("#own-f", el)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#own-u", el).value, r = setPartnerUnits(one.id, text);
    if (!r.ok) { unitEdit.draft = text; return viewUnitLists(el, pids, r.err); }
    unitEdit.draft = null; toast(`Liste de ${esc(one.name)} enregistrée.`); viewUnitLists(el, pids);
  });
}

/* ---------- Rôles du partenaire : inclure une fonctionnalité d'un rôle dans un autre ---------- */
function viewPartnerRoles(el, p) {
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Rôles du partenaire</span><h1>${esc(p.name)}</h1><p class="small muted" style="margin:0">${esc(PARTNER_TYPES[p.type].label)} : rôles fixés par le type.</p></div></div>
    <div class="split"><div class="card">${includeEditorHtml(p)}</div><aside class="card sticky"><h2>Onglets par rôle</h2>${tabsSummaryHtml(p)}</aside></div>`;
  bindIncludeEditor(el, p, () => { p.customized = !sameConfig(p, presetFor(p.type)); audit("Inclusion de fonctionnalité", p.name); toast("Réglage enregistré."); viewPartnerRoles(el, p); });
}

/* =====================================================================
 * Espace partenaire (onglets calculés selon le rôle)
 * ===================================================================== */
function currentPartnerTab() {
  const p = partnerOf(ui.partnerId);
  if (!p) return "none";
  const tabs = tabsFor(p, ui.role);
  const k = `p:${p.id}:${ui.role}`;
  return tabs.includes(ui.tabs[k]) ? ui.tabs[k] : tabs[0] || "none";
}
RENDER.partner = (root) => {
  const p = partnerOf(ui.partnerId);
  if (!p.roles[ui.role]?.on) ui.role = highestRole(p);
  const tabs = tabsFor(p, ui.role);
  const k = `p:${p.id}:${ui.role}`;
  const tab = currentPartnerTab();
  const own = featuresAvailable(p, ui.role);
  const i = session.identityId ? identityOf(session.identityId) : null;
  const myRoles = i && i.kind === "PARTNER" ? landingOf(i).roles : null;
  const roleSel = myRoles && myRoles.length > 1 ? `<select id="my-role" class="input" style="width:auto" aria-label="Changer de rôle">${myRoles.map((r) => `<option value="${r}" ${r === ui.role ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select>` : "";
  root.innerHTML = `${appBar(`<span class="brand"><span class="brand-dot">${esc(p.name[0])}</span><span>${esc(p.name)}<span class="small muted" style="display:block;font-weight:500">avec <b>YODAN</b> · LAMIFI Business</span></span></span>`, ROLE_LABEL[ui.role], `${ROLE_LABEL[ui.role]} Démo`, roleSel)}
    ${tabsHtml(k, tabs.map((t) => ({ id: t, icon: FEATURE_ICON[t], label: FEATURE_LABEL[t], inh: own.find((f) => f.key === t && !f.own) ? "inclus" : "" })), tab)}<div class="page" id="body"></div>`;
  bindAppBar(root); bindTabs(root);
  $("#my-role", root)?.addEventListener("change", (e) => { ui.role = e.target.value; render(); });
  const body = $("#body", root);
  // Périmètre : agences du rôle de la personne connectée (accès direct de démo : toutes les agences).
  // Accès direct de démo : on prend le premier compte actif de ce rôle chez le partenaire (même périmètre d'agences).
  const asg = i && i.kind === "PARTNER" ? assignmentsOf(i.id, true).find((a) => a.role === ui.role) : db.assignments.find((a) => a.partnerId === p.id && a.role === ui.role && a.active);
  const scope = { partnerIds: [p.id], censor: true, actor: "partner", role: ui.role, agencies: asg && AGENCY_SCOPED.includes(ui.role) ? asg.agencies.filter((a) => p.agencies.includes(a)) : null };
  const key = `p-${p.id}-${ui.role}`;
  ({
    dashboard: () => viewDashboard(body, scope, key),
    campagne: () => viewCampaigns(body, scope),
    evaluation: () => viewEvaluation(body, scope, key),
    validation: () => viewValidation(body, scope, key),
    suivi: () => viewSuivi(body, scope, key),
    comptes: () => viewAdminFeature(body, scope, `p-${p.id}`),
    none: () => { body.innerHTML = `<p class="empty">Aucun onglet pour ce rôle.</p>`; },
  })[tab]();
};
