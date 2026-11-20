/*
 * spaces.js : espaces de la maquette et fonctionnalités partagées.
 *  - Admin LAMIFI Business (ex-Admin système) : partenaires + création (type connu / personnalisé)
 *  - Admin Yodan : onglets communs à tous les partenaires
 *  - Console : prise en charge (patients, attribution, tableau de bord, praticiens)
 *  - Espace partenaire : onglets calculés par tabsFor() selon le rôle
 */
"use strict";

/* =====================================================================
 * Éditeur « Rôles et fonctionnalités » (création personnalisée + onglet Partenaire de l'admin Yodan)
 * ===================================================================== */
function roleEditorHtml(cfg) {
  return `<div class="roles-ed">${rolesDesc().map((r) => {
    const on = cfg.roles[r].on;
    const feats = featuresAvailable(cfg, r);
    return `<div class="role-row ${on ? "" : "off"}">
      <div class="role-head"><span class="rname">${ROLE_LABEL[r]}</span>${ROLE_OLD[r] ? `<span class="old">${ROLE_OLD[r]}</span>` : ""}<span class="grow"></span>
        ${r === ESSENTIAL_ROLE ? `<span class="lock">🔒 toujours actif</span>` : ""}
        <label class="switch"><input type="checkbox" data-role-toggle="${r}" ${on ? "checked" : ""} ${r === ESSENTIAL_ROLE ? "disabled" : ""} aria-label="Activer le rôle ${ROLE_LABEL[r]}"><span class="track"></span></label></div>
      <div class="role-body">
        ${feats.filter((f) => f.own).map((f) => `<span class="feat own" title="Fonctionnalité propre au rôle">${FEATURE_ICON[f.key]} ${FEATURE_LABEL[f.key]}</span>`).join("")}
        ${feats.filter((f) => !f.own).map((f) => `<label class="feat inh"><input type="checkbox" data-inh="${r}|${f.key}" ${cfg.roles[r].inherit[f.key] ? "checked" : ""} ${on ? "" : "disabled"}> ${FEATURE_ICON[f.key]} ${FEATURE_LABEL[f.key]} <span class="from">· ${ROLE_LABEL[f.from]}</span></label>`).join("")}
      </div>
      ${on ? `<div class="tab-preview">Onglets : ${tabsFor(cfg, r).map((k) => FEATURE_LABEL[k]).join(" · ")}</div>` : `<div class="tab-preview">Rôle désactivé : aucun compte ne peut l'utiliser.</div>`}
    </div>`;
  }).join("")}</div>`;
}
function bindRoleEditor(root, cfg, onChange) {
  $$("[data-role-toggle]", root).forEach((el) => el.addEventListener("change", () => { setRoleEnabled(cfg, el.dataset.roleToggle, el.checked); onChange(); }));
  $$("[data-inh]", root).forEach((el) => el.addEventListener("change", () => { const [r, k] = el.dataset.inh.split("|"); cfg.roles[r].inherit[k] = el.checked; onChange(); }));
}
const tabsSummaryHtml = (cfg) => `<dl class="kv">${rolesDesc().filter((r) => cfg.roles[r].on).map((r) => `<dt>${ROLE_LABEL[r]}</dt><dd>${tabsFor(cfg, r).map((k) => `${FEATURE_ICON[k]} ${FEATURE_LABEL[k]}`).join(" · ")}</dd>`).join("")}</dl>`;

/* =====================================================================
 * Admin LAMIFI Business (ex-Admin système)
 * ===================================================================== */
RENDER.lamifi = (root) => {
  const tab = tabOf("lamifi", "partners");
  root.innerHTML = `${appBar(yodanLogo("LAMIFI Business"), "Admin LAMIFI Business", ENV.LAMIFI_ADMIN_NAME)}
    ${tabsHtml("lamifi", [{ id: "partners", icon: "🏢", label: "Partenaires", count: db.partners.length }, { id: "create", icon: "＋", label: "Créer un partenaire" }], tab)}
    <div class="page" id="body"></div>`;
  bindAppBar(root);
  bindTabs(root);
  const lp = partnerOf(ui.lamifiPartner);
  (tab === "create" ? renderCreatePartner : lp ? (el) => partnerSettings(el, lp) : renderPartnerList)($("#body", root));
};

function renderPartnerList(el) {
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Partenaires</span><h1>Espaces partenaires</h1></div>
      <button type="button" class="btn btn-orange" id="to-create">＋ Créer un partenaire</button></div>
    <div class="card table-wrap"><table class="table"><thead><tr><th>Partenaire</th><th>Type</th><th>Tests</th><th>Rôles actifs</th><th>Campagne</th><th>Prise en charge</th><th>Base</th><th>Comptes</th><th></th></tr></thead><tbody>
    ${db.partners.map((p) => `<tr><td><strong>${esc(p.name)}</strong><div class="small muted">créé le ${fmtDate(p.createdAt)}</div></td>
      <td>${PARTNER_TYPES[p.type].ico} ${esc(PARTNER_TYPES[p.type].label)}${p.customized ? ` <span class="pill orange">modifié</span>` : ""}</td>
      <td>${p.tests.map((t) => `<span class="pill bleu">${t}</span>`).join(" ")}</td>
      <td class="small">${rolesDesc().filter((r) => p.roles[r].on).map((r) => ROLE_LABEL[r]).join(", ")}</td>
      <td class="small">${p.campaign.on ? `${p.campaign.roles.map((r) => ROLE_LABEL[r]).join(", ")}${p.campaign.emailPro ? `<div class="muted">e-mail pro : ${esc(p.campaign.domains.join(", "))}</div>` : ""}` : "—"}</td>
      <td class="small">${PEC_MODE_LABEL[p.pec.mode]}<div class="muted">${p.pec.max} consultations max</div></td>
      <td class="small"><code>${esc(p.db.host)}:${p.db.port}/${esc(p.db.database)}</code><div class="muted">🔒 ${esc(p.db.secretRef)}</div></td>
      <td class="num-cell">${db.identities.filter((i) => i.partnerId === p.id).length}</td>
      <td class="actions"><button type="button" class="btn btn-sm" data-set="${p.id}">⚙ Réglages</button><button type="button" class="btn btn-sm btn-ghost" data-open="${p.id}">Ouvrir l'espace</button></td></tr>`).join("")}
    </tbody></table></div>`;
  $("#to-create", el).addEventListener("click", () => setTab("lamifi", "create"));
  $$("[data-open]", el).forEach((b) => b.addEventListener("click", () => go("partner", { partnerId: b.dataset.open })));
  $$("[data-set]", el).forEach((b) => b.addEventListener("click", () => { ui.lamifiPartner = b.dataset.set; render(); }));
}

const DB_FIELDS = [["host", "HOST", "text", "db.interne.exemple.test"], ["port", "PORT", "number", "3306"], ["username", "USERNAME", "text", "pec_partenaire"], ["password", "PASSWORD", "password", ""], ["database", "DATABASE", "text", "pec_partenaire"]];
const newDraft = () => ({ name: "", db: { host: "", port: "3306", username: "", password: "", database: "" }, type: "CNPS", detail: false, cfg: presetFor("CNPS"), domainsText: "", fa: { name: "", email: "" }, dbTest: null, errors: {} });
let cd = newDraft();

function renderCreatePartner(el) {
  const c = cd.cfg, e = cd.errors;
  const known = cd.type !== "PERSO";
  const showDetail = !known || cd.detail;
  const fieldErr = (k) => (e[k] ? "has-err" : "");
  const domainsField = `<div class="field ${fieldErr("domains")}"><label for="cp-dom">Domaines e-mail professionnels autorisés</label><textarea id="cp-dom" rows="2" placeholder="partenaire.exemple.test">${esc(cd.domainsText)}</textarea><div class="hint">Un par ligne. Les messageries publiques (gmail…) sont refusées.</div>${errBox(e, "domains")}</div>`;
  const testsChips = (list) => `<div class="chips-check" role="group" aria-label="Tests">${list.map((t) => `<label><input type="checkbox" data-test="${t}" ${c.tests.includes(t) ? "checked" : ""}> ${t} <span class="small muted">· ${TESTS[t].desc}</span></label>`).join("")}</div>${errBox(e, "tests")}`;

  const summary = known && !cd.detail ? `<div class="card" style="margin-top:.8rem;background:var(--surface-2)">
      <span class="eyebrow">Préréglage ${esc(PARTNER_TYPES[cd.type].label)}</span>
      <dl class="kv" style="margin-top:.5rem">
        <dt>Test${c.tests.length > 1 ? "s" : ""}</dt><dd>${cd.type === "ENTREPRISE" ? `${c.tests.join(", ")} <span class="muted small">(choix multiple ci-dessous)</span>` : c.tests.map((t) => `${t} — ${TESTS[t].desc}`).join(", ")}</dd>
        <dt>Rôles</dt><dd>${rolesDesc().filter((r) => c.roles[r].on).map((r) => ROLE_LABEL[r]).join(", ")}</dd>
        <dt>Héritage</dt><dd>${{ CNPS: "Les rôles parents ont toutes les fonctionnalités des rôles enfants (ex. l'Administrateur a l'onglet Évaluation).", LONACI: "Aucun : le Superviseur principal n'a que son tableau de bord.", ENTREPRISE: "Aucun : le Superviseur principal n'a que ses propres onglets.", MUTUELLE: "Les parents reprennent les fonctionnalités des enfants, sauf l'Évaluation : aucun rôle n'évalue." }[cd.type]}</dd>
        <dt>Campagne</dt><dd>${c.campaign.on ? `Activée sur ${c.campaign.roles.map((r) => ROLE_LABEL[r]).join(", ")}${c.campaign.emailPro ? " · e-mail pro activé" : ""}` : "Non"}</dd>
        <dt>Prise en charge</dt><dd>${c.pec.max} consultations max · ${PEC_MODE_LABEL[c.pec.mode]}</dd>
      </dl>
      ${cd.type === "ENTREPRISE" ? `<div style="margin-top:.8rem"><span class="lbl">Tests (choix multiple)</span>${testsChips(ENTREPRISE_TESTS)}</div>` : ""}
      ${c.campaign.emailPro ? `<div style="margin-top:.8rem">${domainsField}</div>` : ""}
      <button type="button" class="btn btn-ghost" id="cp-detail" style="margin-top:.4rem">🔎 Voir en détail</button>
    </div>` : "";

  const detail = showDetail ? `
    ${known ? `<div class="banner banner-info" style="margin-top:.8rem">Préréglage <strong>${esc(PARTNER_TYPES[cd.type].label)}</strong> en détail. <button type="button" class="link-btn" id="cp-reset">Revenir au préréglage</button></div>` : ""}
    <h3 style="margin-top:1rem">Rôles et fonctionnalités</h3>
    ${roleEditorHtml(c)}${errBox(e, "roles")}
    <h3 style="margin-top:1rem">Tests</h3>${testsChips(TEST_KEYS)}
    <h3 style="margin-top:1rem">Campagne</h3>
    <label class="switch"><input type="checkbox" id="cp-camp" ${c.campaign.on ? "checked" : ""}><span class="track"></span> Activer les campagnes</label>
    ${c.campaign.on ? `<div style="margin-top:.6rem"><span class="lbl">Sur quel(s) rôle(s) ?</span><div class="chips-check">${rolesDesc().filter((r) => c.roles[r].on).map((r) => `<label><input type="checkbox" data-camp-role="${r}" ${c.campaign.roles.includes(r) ? "checked" : ""}> ${ROLE_LABEL[r]}</label>`).join("")}</div>${errBox(e, "campaign")}
      <div style="margin-top:.7rem"><label class="switch"><input type="checkbox" id="cp-pro" ${c.campaign.emailPro ? "checked" : ""}><span class="track"></span> E-mail professionnel obligatoire</label></div>
      ${c.campaign.emailPro ? `<div style="margin-top:.6rem">${domainsField}</div>` : ""}</div>` : ""}
    <h3 style="margin-top:1rem">Prise en charge</h3>
    <div class="row"><div class="field ${fieldErr("max")}" style="max-width:220px"><label for="cp-max">Consultations max</label><input id="cp-max" type="number" min="1" max="50" value="${c.pec.max}">${errBox(e, "max")}</div>
      <div class="field wide"><span class="lbl">Type</span><div class="chips-check" role="radiogroup" aria-label="Type de prise en charge">${["bon", "budget"].map((m) => `<label><input type="radio" name="cp-mode" value="${m}" ${c.pec.mode === m ? "checked" : ""}> ${PEC_MODE_LABEL[m]}</label>`).join("")}</div>
</div></div>` : "";

  const fr = highestRole(c);
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Nouveau partenaire</span><h1>Créer un partenaire</h1></div></div>
    <div class="split"><form class="card" id="cp" novalidate>
      <div class="section-title"><span class="num">1</span><h2>Nom du partenaire</h2></div>
      <div class="field ${fieldErr("name")}"><label for="cp-name">Nom</label><input id="cp-name" value="${esc(cd.name)}" placeholder="Ex. : Entreprise Démo Gamma" autocomplete="off">${errBox(e, "name")}</div>

      <div class="section-title"><span class="num">2</span><h2>Base de données</h2></div>
      <div class="row">${DB_FIELDS.map(([k, l, t, ph]) => `<div class="field ${fieldErr(k)}" ${k === "port" ? 'style="max-width:130px"' : ""}><label for="db-${k}">${l}</label><input id="db-${k}" type="${t}" value="${esc(cd.db[k])}" placeholder="${esc(ph)}" autocomplete="${k === "password" ? "new-password" : "off"}" ${k === "port" ? 'min="1" max="65535"' : ""}>${errBox(e, k)}</div>`).join("")}</div>
      <div class="actions"><button type="button" class="btn btn-sm" id="cp-dbtest">🔌 Tester la connexion</button>${cd.dbTest ? `<span class="pill ${cd.dbTest.ok ? "vert" : "rouge"}">${esc(cd.dbTest.msg)}</span>` : ""}</div>

      <div class="section-title"><span class="num">3</span><h2>Type</h2></div>
      <div class="type-cards" role="radiogroup" aria-label="Type de partenaire">${Object.entries(PARTNER_TYPES).map(([k, t]) => `<button type="button" role="radio" aria-checked="${cd.type === k}" class="type-card ${cd.type === k ? "on" : ""}" data-type="${k}"><span class="ico">${t.ico}</span><strong>${esc(t.label)}</strong><span class="small">${esc(t.desc)}</span></button>`).join("")}</div>
      ${summary}${detail}

      <div class="section-title"><span class="num">4</span><h2>Premier compte</h2></div>
      <div class="banner banner-info">Rôle : <strong>${ROLE_LABEL[fr]}</strong></div>
      <div class="row"><div class="field ${fieldErr("faName")}"><label for="fa-name">Nom du titulaire</label><input id="fa-name" value="${esc(cd.fa.name)}" autocomplete="off">${errBox(e, "faName")}</div>
        <div class="field ${fieldErr("faEmail")}"><label for="fa-email">E-mail</label><input id="fa-email" type="email" value="${esc(cd.fa.email)}" autocomplete="off">${errBox(e, "faEmail")}</div></div>
      ${Object.keys(e).length ? `<div class="banner banner-err" role="alert">Corrigez les ${Object.keys(e).length} point(s) signalé(s).</div>` : ""}
      <button type="submit" class="btn btn-orange btn-lg btn-block">Créer le partenaire</button>
    </form>
    <aside class="card sticky"><span class="eyebrow">Aperçu</span><h2>Onglets par rôle</h2>${tabsSummaryHtml(c)}
      <hr style="border:0;border-top:1px solid var(--border);margin:1rem 0"><dl class="kv"><dt>Tests</dt><dd>${c.tests.join(", ") || "—"}</dd><dt>Campagne</dt><dd>${c.campaign.on ? c.campaign.roles.map((r) => ROLE_LABEL[r]).join(", ") : "—"}</dd><dt>Prise en charge</dt><dd>${c.pec.max} · ${c.pec.mode}</dd></dl></aside></div>`;

  const keep = () => {
    cd.name = $("#cp-name", el).value;
    DB_FIELDS.forEach(([k]) => { cd.db[k] = $(`#db-${k}`, el).value; });
    if ($("#cp-dom", el)) { cd.domainsText = $("#cp-dom", el).value; c.campaign.domains = parseDomains(cd.domainsText); }
    if ($("#cp-max", el)) c.pec.max = Number($("#cp-max", el).value);
    const m = $("input[name=cp-mode]:checked", el); if (m) c.pec.mode = m.value;
    cd.fa = { name: $("#fa-name", el).value, email: $("#fa-email", el).value };
  };
  const redraw = () => { keep(); renderCreatePartner(el); };
  const reRender = () => { const y = window.scrollY; renderCreatePartner(el); window.scrollTo(0, y); };
  $$("[data-type]", el).forEach((b) => b.addEventListener("click", () => { keep(); cd.type = b.dataset.type; cd.cfg = presetFor(cd.type); cd.cfg.campaign.domains = parseDomains(cd.domainsText); cd.detail = false; cd.errors = {}; reRender(); }));
  $("#cp-detail", el)?.addEventListener("click", () => { keep(); cd.detail = true; reRender(); });
  $("#cp-reset", el)?.addEventListener("click", () => { keep(); cd.cfg = presetFor(cd.type); cd.cfg.campaign.domains = parseDomains(cd.domainsText); reRender(); });
  $("#cp-dbtest", el).addEventListener("click", () => { keep(); cd.dbTest = testDbConnection(cd.db); reRender(); });
  $$("[data-test]", el).forEach((x) => x.addEventListener("change", () => { keep(); c.tests = x.checked ? [...new Set([...c.tests, x.dataset.test])] : c.tests.filter((t) => t !== x.dataset.test); reRender(); }));
  bindRoleEditor(el, c, () => { keep(); reRender(); });
  $("#cp-camp", el)?.addEventListener("change", (ev) => { keep(); c.campaign.on = ev.target.checked; normalizeConfig(c); reRender(); });
  $("#cp-pro", el)?.addEventListener("change", (ev) => { keep(); c.campaign.emailPro = ev.target.checked; reRender(); });
  $$("[data-camp-role]", el).forEach((x) => x.addEventListener("change", () => { keep(); const r = x.dataset.campRole; c.campaign.roles = x.checked ? [...c.campaign.roles, r] : c.campaign.roles.filter((y) => y !== r); normalizeConfig(c); reRender(); }));
  $$("input[name=cp-mode]", el).forEach((x) => x.addEventListener("change", redraw));
  $("#cp", el).addEventListener("submit", (ev) => {
    ev.preventDefault();
    keep();
    const r = createPartner({ name: cd.name, type: cd.type, cfg: c, db: cd.db, firstAccount: cd.fa });
    if (!r.ok) { cd.errors = r.errors; reRender(); $(".has-err input, .has-err textarea", el)?.focus(); return; }
    toast(`Partenaire « ${esc(r.partner.name)} » créé. Lien d'activation envoyé à ${esc(r.identity.email)} (${ROLE_LABEL[r.role]}).`);
    cd = newDraft();
    setTab("lamifi", "partners");
  });
}

/* =====================================================================
 * Fonctionnalités partagées (partenaire et admin Yodan)
 * scope = { partnerIds, censor, actor: "partner" | "yodan", role }
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
const yo = { partner: "all", pq: "", pstatus: "all" };
const YODAN_TABS = [
  { id: "dashboard", icon: "📊", label: "Tableau de bord" },
  { id: "campagnes", icon: "📣", label: "Campagnes et participants" },
  { id: "evaluation", icon: "📝", label: "Évaluation" },
  { id: "validation", icon: "✅", label: "Validation" },
  { id: "comptes", icon: "👥", label: "Comptes" },
  { id: "patients", icon: "🩺", label: "Patients" },
  { id: "partenaires", icon: "🧩", label: "Partenaire" },
];
RENDER.yodan = (root) => {
  const tab = tabOf("yodan", "dashboard");
  const pids = yo.partner === "all" ? db.partners.map((p) => p.id) : [yo.partner];
  const counts = { validation: pendingDecisions(pids).length, patients: db.patients.filter((x) => pids.includes(x.partnerId) && (canTakeCharge(x) || canUnlock(x) || wantsCallback(x) || QUICK.accord[1](x))).length };
  // L'attribution d'un praticien se fait dans la Console ; l'admin Yodan décide la prise en charge.
  const filter = `<label class="small" style="display:flex;gap:.4rem;align-items:center"><span class="muted">Partenaire</span><select id="yo-p" class="input" style="width:auto">${tab === "partenaires" ? "" : `<option value="all">Tous les partenaires</option>`}${db.partners.map((p) => `<option value="${p.id}" ${yo.partner === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`;
  root.innerHTML = `${appBar(yodanLogo("Admin Yodan"), "Admin Yodan", "Admin Yodan Démo", filter)}
    ${tabsHtml("yodan", YODAN_TABS.map((t) => ({ ...t, count: counts[t.id], hot: true })), tab)}<div class="page" id="body"></div>`;
  bindAppBar(root); bindTabs(root);
  if (tab === "partenaires" && yo.partner === "all") { yo.partner = db.partners[0].id; return render(); }
  $("#yo-p", root).addEventListener("change", (e) => { yo.partner = e.target.value; render(); });
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
  })[tab]();
};

/* ---------- Partenaire : attribuer des fonctionnalités aux rôles (Admin Yodan) ---------- */
function viewPartnerRoles(el, p) {
  const active = (r) => db.assignments.filter((a) => a.partnerId === p.id && a.role === r && a.active).length;
  el.innerHTML = `<div class="page-head"><div class="grow"><span class="eyebrow">Partenaire</span><h1>${esc(p.name)} — rôles et fonctionnalités</h1>
      <p class="small muted" style="margin:0">${esc(PARTNER_TYPES[p.type].label)}${p.customized ? " · modifié" : ""}</p></div></div>
    <div class="split"><div class="card">${roleEditorHtml(p)}</div><aside class="card sticky"><h2>Onglets par rôle</h2>${tabsSummaryHtml(p)}</aside></div>`;
  bindRoleEditor(el, p, () => {
    p.customized = p.type !== "PERSO" && !sameConfig(p, presetFor(p.type));
    audit("Modification rôles partenaire", p.name);
    toast("Réglage enregistré.");
    viewPartnerRoles(el, p);
  });
  $$("[data-role-toggle]", el).forEach((x) => x.addEventListener("click", (e) => {
    const r = x.dataset.roleToggle;
    if (p.roles[r].on && active(r) && !confirmInline(`${active(r)} compte(s) ont le rôle ${ROLE_LABEL[r]} : ils perdront ces onglets. Continuer ?`)) e.preventDefault();
  }));
}
/** Confirmation simple (maquette) : en production, une fenêtre dédiée. */
const confirmInline = (msg) => window.confirm(msg);

/* =====================================================================
 * Console — prise en charge
 * ===================================================================== */
const co = { partner: "all" };
RENDER.console = (root) => {
  const tab = tabOf("console", "pec");
  const pids = co.partner === "all" ? db.partners.map((p) => p.id) : [co.partner];
  const waiting = db.patients.filter((x) => pids.includes(x.partnerId) && canTakeCharge(x)).length;
  root.innerHTML = `${appBar(yodanLogo("Console prise en charge"), "Console", "Console Démo", `<label class="small" style="display:flex;gap:.4rem;align-items:center"><span class="muted">Partenaire</span><select id="co-p" class="input" style="width:auto"><option value="all">Tous</option>${db.partners.map((p) => `<option value="${p.id}" ${co.partner === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`)}
    ${tabsHtml("console", [{ id: "pec", icon: "🩺", label: "Patients pris en charge" }, { id: "attribution", icon: "🔗", label: "Attribution", count: waiting, hot: true }, { id: "dashboard", icon: "📊", label: "Tableau de bord" }, { id: "praticiens", icon: "🧑‍⚕️", label: "Praticiens", count: db.practitioners.length }], tab)}<div class="page" id="body"></div>`;
  bindAppBar(root); bindTabs(root);
  $("#co-p", root).addEventListener("change", (e) => { co.partner = e.target.value; render(); });
  const body = $("#body", root);
  ({ pec: () => consolePec(body, pids), attribution: () => consoleAssign(body, pids), dashboard: () => consoleDash(body, pids), praticiens: () => consolePractitioners(body) })[tab]();
};
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
    ${tabsHtml(k, tabs.map((t) => ({ id: t, icon: FEATURE_ICON[t], label: FEATURE_LABEL[t], inh: own.find((f) => f.key === t && !f.own) ? "hérité" : "" })), tab)}<div class="page" id="body"></div>`;
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
