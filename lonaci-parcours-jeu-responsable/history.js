/* Maquette Lonaci — Historique et journaux internes (Admin YODAN), sur le modèle de l'application CNPS (AccessLog).
   Données 100 % FICTIVES. Comme dans l'application actuelle, un seul compte gère le système : l'admin YODAN.
   Seules ses actions sont enregistrées : LONACI n'a pas de compte utilisateur
   et le joueur passe le test sans compte. Le journal est reconstruit à partir des dossiers de la maquette (mêmes faits que le
   tableau de bord), puis alimenté en direct par les actions YODAN faites dans la maquette (contact, recherche, prise en charge, exports).
   Jamais de contenu de santé, de téléphone ni d'e-mail dans le journal (règle 4.1.4). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DAY = 864e5, MIN = 6e4;
  const TODAY = new Date(2026, 10, 17, 11, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const isoDay = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fmtDT = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  function prng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = prng(9999);

  /* ---------- Vocabulaire du journal (codes comme l'application CNPS) ---------- */
  const LABEL = {
    'auth.login_mfa': 'Connexion (code e-mail)',
    'contact.view': 'Affichage du contact d\'un dossier',
    'contact.search': 'Recherche par contact',
    'care.call': 'Appel : prise en charge validée',
    'care.unreachable': 'Appel : injoignable',
    'care.refused': 'Appel : prise en charge refusée',
    'care.take': 'Prise en charge (appel reçu au 9999)',
    'export.aggregates': 'Export des indicateurs (CSV)',
    'export.list': 'Export de la liste des dossiers (CSV)',
    'logs.view': 'Consultation d\'un journal interne',
    'logs.download': 'Téléchargement d\'un journal interne',
  };
  /** Compte unique de l'application actuelle : l'admin YODAN (le seul à être journalisé). */
  const ADMIN = 'admin@yodan.exemple.test';
  const USERS = [ADMIN];
  /** IP fictive (plage réservée à la documentation : aucune vraie adresse). */
  const ipOf = (who) => '192.0.2.' + (1 + (who.length * 37 + who.charCodeAt(6)) % 250);

  const entries = [];
  let seq = 0;
  /** Entrée figée : écriture seule, ni modification ni suppression possible depuis l'application. */
  function push(at, action, o) {
    const who = o.who || USERS[0];
    entries.push(Object.freeze({ id: ++seq, at: new Date(at), who, action, dossier: o.dossier || null, ip: ipOf(who), details: Object.freeze(o.details || {}) }));
  }

  /* ---------- Reconstruction à partir des faits de la maquette ---------- */
  function seed() {
    const recs = window.PJR.dash.data;
    const specs = [];
    const add = (at, action, o) => { if (+at <= +TODAY) specs.push([+at, action, o]); };
    /* Heure de l'issue en heures ouvrées (8 h 30 – 17 h), même jour que la date enregistrée sur le dossier. */
    const work = (d, k) => { const p = new Date(d); return p.getHours() >= 8 && p.getHours() < 17 ? +p : +new Date(p.getFullYear(), p.getMonth(), p.getDate(), 8 + (k % 8), 30 + (k % 25)); };
    recs.filter((r) => r.completed && !r.mine).forEach((r, k) => {
      const who = ADMIN;
      (r.attempts || []).forEach((t, i) => {
        add(+t - 4 * MIN, 'contact.view', { who, dossier: r.id });
        add(t, 'care.unreachable', { who, dossier: r.id, details: { tentative: i + 1 } });
      });
      const out = r.status === 'done' ? r.pecAt : r.status === 'refus' ? r.refusAt : null;
      if (out) {
        const at = work(out, k);
        const asked = r.callback === 'Oui' || r.support === 'Oui';
        if (!asked) add(at - 9 * MIN, 'contact.search', { who, details: { type: k % 3 ? 'téléphone' : 'e-mail', resultats: 1 } });
        add(at - 6 * MIN, 'contact.view', { who, dossier: r.id });
        if (r.status === 'refus') add(at, 'care.refused', { who, dossier: r.id });
        else add(at, asked ? 'care.call' : 'care.take', { who, dossier: r.id, details: asked ? { issue: 'Prise en charge validée' } : { origine: 'Appel reçu (9999)' } });
      }
    });
    for (let d = 45; d >= 0; d--) {
      const day = new Date(TODAY - d * DAY); const wd = day.getDay();
      if (wd === 0 || wd === 6) continue;
      const at = (h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      if (R() < 0.92) add(at(8, Math.floor(R() * 40)), 'auth.login_mfa', { who: ADMIN });
      if (wd === 1) add(at(10, 15), 'export.aggregates', { who: ADMIN, details: { periode: '90 jours' } });
      if (wd === 5) add(at(16, 40), 'export.list', { who: ADMIN, details: { liste: 'À appeler', telephone: 'non inclus' } });
    }
    specs.sort((a, b) => a[0] - b[0]).forEach(([at, action, o]) => push(at, action, o));
  }
  /** Actions faites dans la maquette : horodatées juste après « maintenant » (heure fixe de la maquette), dans l'ordre.
   *  Vue LONACI : rien n'est enregistré (pas de compte utilisateur côté LONACI). */
  let live = 0;
  function log(action, o) {
    if (window.PJR.state.role === 'lonaci') return;
    push(+TODAY + (++live) * MIN, action, o || {});
    if (!$('#history').hidden) render();
  }

  /* ---------- Écran : Historique / Journaux internes ---------- */
  const st = { tab: 'hist', q: '', from: '', to: '', page: 1, size: 25 };
  const fileName = (iso) => 'access-' + iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) + '.log';
  const line = (e) => JSON.stringify({ created_at: e.at.toISOString(), user_id: e.who, action: e.action, evaluation_id: e.dossier, ip: e.ip, details: e.details });
  function files() {
    const by = {};
    entries.forEach((e) => { const d = isoDay(e.at); (by[d] = by[d] || []).push(e); });
    return Object.keys(by).sort().reverse().map((d) => { const content = by[d].map(line).join('\n') + '\n'; return { day: d, name: fileName(d), lines: by[d].length, size: new Blob([content]).size, content }; });
  }
  const td = (l, html) => '<td data-l="' + l + '"><span>' + html + '</span></td>';
  function pager(total) {
    const pages = Math.max(1, Math.ceil(total / st.size));
    st.page = Math.min(st.page, pages);
    return pages > 1 ? '<div class="pager-row"><p class="small muted">Page ' + st.page + ' / ' + pages + '</p><nav class="pager" aria-label="Pagination de l\'historique">' +
      '<button type="button" data-hpage="' + (st.page - 1) + '"' + (st.page === 1 ? ' disabled' : '') + '>‹ Préc.</button><button type="button" data-hpage="' + (st.page + 1) + '"' + (st.page === pages ? ' disabled' : '') + '>Suiv. ›</button></nav></div>' : '';
  }
  function render() {
    const box = $('#hist-body');
    if (!box) return;
    document.querySelectorAll('[data-htab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.htab === st.tab)));
    if (st.tab === 'logs') {
      const fs = files();
      box.innerHTML = '<p class="sub">Copie quotidienne du journal : un fichier par jour, une ligne JSON par accès, écrite <b>avant</b> la base de données pour que la trace subsiste même si la base est inaccessible. Lecture seule.</p>' +
        '<div class="table-wrap"><table class="qtable"><thead><tr><th>Fichier</th><th>Lignes</th><th>Taille</th><th></th></tr></thead><tbody>' +
        fs.slice(0, 30).map((f) => '<tr>' + td('Fichier', '<code>' + f.name + '</code>') + td('Lignes', f.lines) + td('Taille', (f.size / 1024).toFixed(1) + ' Ko') +
          td('Actions', '<button type="button" class="btn-act sec" data-fview="' + f.day + '">Voir</button> <button type="button" class="btn-act sec" data-fdl="' + f.day + '">Télécharger</button>') + '</tr>').join('') +
        '</tbody></table></div><p class="small muted">30 derniers jours affichés.</p><pre class="log-view" id="log-view" hidden></pre>';
      return;
    }
    const rows = entries.filter((e) => (!st.from || isoDay(e.at) >= st.from) && (!st.to || isoDay(e.at) <= st.to)
      && (!st.q || (e.action + ' ' + (LABEL[e.action] || '') + ' ' + (e.dossier || '')).toLowerCase().includes(st.q.toLowerCase()))).reverse();
    const shown = rows.slice((st.page - 1) * st.size, st.page * st.size);
    box.innerHTML = '<div class="hist-filters">' +
      '<label class="mini">Recherche<input class="q-input" id="h-q" type="search" placeholder="Action, n° de dossier…" value="' + esc(st.q) + '"></label>' +
      '<label class="mini">Du<input class="q-input" id="h-from" type="date" value="' + st.from + '"></label><label class="mini">Au<input class="q-input" id="h-to" type="date" value="' + st.to + '"></label>' +
      '<p class="small muted hist-count">' + rows.length.toLocaleString('fr-FR') + ' entrée(s)</p></div>' +
      '<div class="table-wrap"><table class="qtable"><thead><tr><th>Date</th><th>Action</th><th>Dossier</th><th>Détails</th></tr></thead><tbody>' +
      (shown.map((e) => '<tr>' + td('Date', fmtDT(e.at)) +
        td('Action', '<b>' + esc(LABEL[e.action] || e.action) + '</b> <code class="muted">' + e.action + '</code>') + td('Dossier', e.dossier || '—') +
        td('Détails', esc(Object.entries(e.details).map(([k, v]) => k.replace(/_/g, ' ') + ' : ' + v).join(' · '))) + '</tr>').join('') || '<tr><td colspan="4" class="muted">Aucune entrée pour ces filtres.</td></tr>') +
      '</tbody></table></div>' + pager(rows.length);
    const on = (id, k) => $('#' + id).addEventListener(id === 'h-q' ? 'input' : 'change', (ev) => { st[k] = ev.target.value; st.page = 1; render(); if (id === 'h-q') { const q = $('#h-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });
    on('h-q', 'q'); on('h-from', 'from'); on('h-to', 'to');
  }
  function bindSection() {
    const sec = $('#history');
    sec.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-htab],[data-hpage],[data-fview],[data-fdl]');
      if (!t || t.disabled) return;
      if (t.dataset.htab) { st.tab = t.dataset.htab; render(); return; }
      if (t.dataset.hpage) { st.page = +t.dataset.hpage; render(); return; }
      const f = files().find((x) => x.day === (t.dataset.fview || t.dataset.fdl));
      if (t.dataset.fview) { log('logs.view', { details: { fichier: f.name } }); const v = $('#log-view'); v.textContent = f.content; v.hidden = false; v.scrollIntoView({ block: 'nearest' }); return; }
      log('logs.download', { details: { fichier: f.name } });
      const url = URL.createObjectURL(new Blob([f.content], { type: 'application/x-ndjson' }));
      const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }

  /* ---------- Tests de cohérence du journal (index.html?tests=1, ou PJR.journal.runTests()) ---------- */
  function runTests() {
    const res = [], recs = window.PJR.dash.data;
    const test = (name, fn) => { try { fn(); res.push({ name, ok: true }); } catch (e) { res.push({ name, ok: false, err: e.message }); } };
    const assert = (c, m) => { if (!c) throw new Error(m); };
    test('Chaque prise en charge a son entrée datée du même jour', () => {
      recs.filter((r) => r.status === 'done' && r.pecAt && !r.mine && +r.pecAt <= +TODAY).forEach((r) => assert(entries.some((e) => ['care.call', 'care.take'].includes(e.action) && e.dossier === r.id && isoDay(e.at) === isoDay(r.pecAt)), r.id + ' : prise en charge non tracée'));
    });
    test('Le contact est toujours affiché (et tracé) avant une prise en charge', () => {
      entries.filter((e) => ['care.call', 'care.take', 'care.unreachable', 'care.refused'].includes(e.action) && +e.at <= +TODAY).forEach((e) => assert(entries.some((v) => v.action === 'contact.view' && v.dossier === e.dossier && v.at <= e.at), e.dossier));
    });
    test('Issues d\'appel : refus ⇒ date + motif de la liste, sans date de prise en charge ; injoignable ⇒ reste « À appeler » ; tentatives avant l\'issue ; tout est tracé', () => {
      const motifs = window.PJR.dash.REFUS_MOTIFS;
      recs.filter((r) => r.completed).forEach((r) => {
        if (r.status === 'refus') assert(r.refusAt && motifs.includes(r.refusMotif) && !r.pecAt, r.id + ' : refus incomplet');
        else assert(!r.refusAt && !r.refusMotif, r.id + ' : motif sans refus');
        const end = r.status === 'done' ? r.pecAt : r.status === 'refus' ? r.refusAt : TODAY;
        (r.attempts || []).forEach((t, i) => { assert(+t > +r.date && +t <= +end, r.id + ' : tentative hors période'); if (i) assert(+t >= +r.attempts[i - 1], r.id + ' : ordre des tentatives'); });
        if ((r.attempts || []).length) assert(['wait', 'done', 'refus'].includes(r.status) && (r.callback === 'Oui' || r.support === 'Oui'), r.id + ' : tentative sans demande de contact');
        if (r.mine) return;
        if (r.status === 'refus' && +r.refusAt <= +TODAY) assert(entries.some((e) => e.action === 'care.refused' && e.dossier === r.id), r.id + ' : refus non tracé');
        assert(entries.filter((e) => e.action === 'care.unreachable' && e.dossier === r.id).length === (r.attempts || []).length, r.id + ' : tentatives non tracées');
      });
      assert(!entries.some((e) => motifs.some((m) => JSON.stringify(e.details).includes(m))), 'motif de refus dans le journal');
    });
    test('Fiche d\'appel de bout en bout : injoignable puis refus (motif obligatoire), chiffres et journal à jour', () => {
      const keep = window.PJR.state.role; window.PJR.state.role = 'yodan';
      const r = recs.find((x) => x.status === 'wait' && !x.mine);
      const snap = { status: r.status, attempts: r.attempts, refusAt: r.refusAt, refusMotif: r.refusMotif }, n = entries.length;
      const f = $('#call-form'), pick = (v) => { f.elements.issue.value = v; f.dispatchEvent(new Event('change')); }, submit = () => f.dispatchEvent(new Event('submit', { cancelable: true }));
      const before = recs.filter((x) => x.status === 'refus').length, tries0 = (r.attempts || []).length;
      window.PJR.dash.openCall(r.id); pick('injoignable'); submit();
      assert(r.status === 'wait' && r.attempts.length === tries0 + 1, 'injoignable');
      window.PJR.dash.openCall(r.id); pick('refus'); submit();
      assert(r.status === 'wait' && !$('#call-err').hidden && $('#call-dlg').open, 'refus sans motif accepté');
      $('#call-motif').value = window.PJR.dash.REFUS_MOTIFS[1]; submit();
      assert(r.status === 'refus' && r.refusMotif && !r.pecAt && recs.filter((x) => x.status === 'refus').length === before + 1, 'refus');
      const acts = entries.slice(n).map((e) => e.action);
      assert(acts.includes('care.unreachable') && acts.includes('care.refused'), 'journal : ' + acts.join(','));
      Object.assign(r, snap); entries.length = n; window.PJR.state.role = keep; window.PJR.dash.render();
    });
    test('Jamais de téléphone, d\'e-mail de joueur, de score ni de niveau de risque dans le journal (règle 4.1.4)', () => {
      const text = JSON.stringify(entries);
      recs.filter((r) => r.completed).slice(0, 400).forEach((r) => { assert(!text.includes(r.phone), 'téléphone ' + r.id); if (r.email) assert(!text.includes(r.email), 'e-mail ' + r.id); });
      assert(!/score|risque|excessif|modéré/i.test(entries.map((e) => JSON.stringify(e.details)).join(' ')), 'résultat dans les détails');
    });
    test('Seules les actions de l\'admin YODAN (compte unique) sont enregistrées (ni LONACI, ni joueur)', () => {
      entries.forEach((e) => assert(e.who === ADMIN, e.id + ' : ' + e.who));
      const keep = window.PJR.state.role, n = entries.length;
      window.PJR.state.role = 'lonaci'; log('export.aggregates', { details: { periode: '90 jours' } }); window.PJR.state.role = keep;
      assert(entries.length === n, 'export LONACI journalisé');
    });
    test('Écriture seule : une entrée ne peut pas être modifiée', () => {
      const e = entries[0]; let n = 0;
      try { e.action = 'x'; } catch (x) { n++; } try { e.details.canal = 'x'; } catch (x) { n++; }
      assert(n === 2 && e.action !== 'x', 'modification acceptée');
    });
    test('Journaux internes : une ligne JSON par entrée, un fichier access-jj-mm-aaaa.log par jour', () => {
      const fs = files(); assert(fs.reduce((s, f) => s + f.lines, 0) === entries.length, 'lignes perdues');
      fs.forEach((f) => { assert(/^access-\d{2}-\d{2}-\d{4}\.log$/.test(f.name), f.name); f.content.trim().split('\n').forEach((l) => { const o = JSON.parse(l); ['created_at', 'user_id', 'action', 'evaluation_id', 'ip', 'details'].forEach((k) => assert(k in o, k)); }); });
    });
    test('L\'historique n\'est visible que pour YODAN', () => {
      const keep = window.PJR.state.role;
      window.PJR.state.role = 'lonaci'; window.PJR.dash.render(); const hiddenL = $('#history').hidden;
      window.PJR.state.role = 'yodan'; window.PJR.dash.render(); const shownY = !$('#history').hidden;
      window.PJR.state.role = keep; window.PJR.dash.render();
      assert(hiddenL && shownY, 'visibilité');
    });
    const ko = res.filter((r) => !r.ok);
    console.log('%cTests journal et appels : ' + (res.length - ko.length) + ' OK / ' + ko.length + ' KO', 'font-weight:bold;color:' + (ko.length ? '#c93a3a' : '#1f8a4c'));
    ko.forEach((r) => console.warn('❌ ' + r.name + ' — ' + r.err));
    return res;
  }

  /* ---------- Notes UX : complément pour le profil YODAN ---------- */
  const baseNotes = window.PJR.dash.notes;
  window.PJR.dash.notes = function () {
    const extra = window.PJR.state.role === 'lonaci' ? '' :
      '<span class="tag">Historique et journaux internes (YODAN)</span><ul>' +
      '<li>Repris de l\'application CNPS (journal des accès, onglet Historique) : date, action (libellé + code), n° de dossier, détails non sensibles. Filtres : recherche, Du → Au.</li>' +
      '<li><b>Un seul compte gère le système</b> (comme l\'application actuelle) : l\'admin YODAN. Pas de colonne ni de filtre « Utilisateur » à l\'écran ; le fichier journal garde quand même <code>user_id</code> pour le jour où il y aura plusieurs comptes.</li>' +
      '<li>LONACI n\'a pas de compte utilisateur et le joueur passe le test sans compte : rien n\'est tracé depuis la vue LONACI ni depuis le formulaire.</li>' +
      '<li><b>Fiche d\'appel</b> : « Appeler » affiche le contact (tracé) puis demande l\'issue : <i>validée</i> (care.call), <i>injoignable</i> (care.unreachable, n° de tentative) ou <i>refusée</i> (care.refused). Le motif du refus reste dans le dossier, <b>jamais dans le journal</b> (« Déjà suivi ailleurs » est une information de santé).</li>' +
      '<li>Les actions de l\'admin dans la maquette sont réellement tracées : afficher un contact, rechercher, prendre en charge, appeler, exporter. Essayez puis ouvrez l\'historique.</li>' +
      '<li>Jamais de téléphone, d\'e-mail de joueur, de score ni de niveau de risque dans le journal : seulement le n° de dossier.</li>' +
      '<li><b>Journaux internes</b> : copie quotidienne <code>access-jj-mm-aaaa.log</code>, une ligne JSON par accès, écrite avant la base. « Voir » et « Télécharger » sont eux-mêmes tracés.</li>' +
      '<li>Écriture seule : aucune entrée ne peut être modifiée (en production, retirer aussi les droits UPDATE / DELETE au compte SQL).</li>' +
      (window.__journalTests ? '<li><b>Tests du journal et des appels : ' + window.__journalTests.filter((t) => t.ok).length + ' OK / ' + window.__journalTests.filter((t) => !t.ok).length + ' KO</b></li>' : '<li>Tests du journal : ouvrir <code>index.html?tests=1</code>.</li>') +
      '</ul><ol class="questions"><li>Liste des motifs de refus à valider ; faut-il un champ « Autre » en texte libre (déconseillé : risque de saisir des informations de santé) ?</li><li>Après combien d\'appels « injoignable » le dossier sort-il de « À appeler » (ex. 3 tentatives) ?</li><li>Un refus est-il définitif, ou la personne peut-elle être reprise en charge si elle rappelle le 9999 ?</li><li>Compte unique partagé : le journal dit « l\'admin YODAN » mais pas <i>quelle personne</i> a consulté un dossier. Si plusieurs personnes utilisent ce compte, faut-il passer à des comptes nominatifs (recommandé pour ISO 27001 / 27799) ?</li><li>Durée de conservation de l\'historique et des journaux internes ?</li><li>L\'accès LONACI au tableau de bord (sans compte) doit-il laisser une trace technique (journal du serveur web, sans utilisateur) ?</li></ol>';
    return baseNotes() + extra;
  };

  /* ---------- Démarrage (après dash.js) ---------- */
  seed();
  bindSection();
  window.PJR.log = log;
  window.PJR.journal = { entries, render, files, runTests, log };
  if (/[?&]tests=1/.test(location.search)) window.__journalTests = runTests();
})();
