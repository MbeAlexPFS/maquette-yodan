/* Maquette Lonaci — tableau de bord Jeu responsable (v2, retours du 17/11/2026).
   Données 100 % FICTIVES, générées dans le navigateur (aucun appel réseau, aucune vraie donnée).
   Un seul tableau de bord ; le profil « LONACI » masque ce qui est individuel ou trop petit (n < 5, zéros compris). */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. Générateur de données fictives (déterministe)
   * ------------------------------------------------------------------ */
  function prng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = prng(20261117);
  const pick = (list) => {
    const tot = list.reduce((s, x) => s + x[1], 0);
    let r = R() * tot;
    for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; }
    return list[list.length - 1][0];
  };

  const DAY = 864e5;
  const TODAY = new Date(2026, 10, 17, 11, 0);
  const HISTORY_DAYS = 150;
  const M = 5; // seuil de masquage côté LONACI : 0 à 4 masqués

  const CATS = [
    { k: 'no_risk', l: 'Sans risque', c: 'var(--r0)' },
    { k: 'low', l: 'À faible risque', c: 'var(--r1)' },
    { k: 'mid', l: 'À risque modéré', c: 'var(--r2)' },
    { k: 'high', l: 'Jeu excessif', c: 'var(--r3)' },
  ];
  const catOf = (s) => (s === 0 ? 0 : s <= 2 ? 1 : s <= 7 ? 2 : 3);

  // Ville saisie ; à Abidjan, la commune (district autonome d'Abidjan)
  const COMMUNES = [['Yopougon', 14], ['Abobo', 12], ['Cocody', 9], ['Adjamé', 6], ['Koumassi', 6], ['Port-Bouët', 5], ['Marcory', 5],
    ['Treichville', 4], ['Attécoubé', 4], ['Anyama', 3], ['Bingerville', 3], ['Plateau', 1.5], ['Songon', 1.2]];
  const VILLES = [['Bouaké', 9], ['Yamoussoukro', 6], ['San-Pédro', 5], ['Daloa', 5], ['Korhogo', 4], ['Man', 3], ['Gagnoa', 2.2],
    ['Abengourou', 2], ['Divo', 1.6], ['Soubré', 1.4], ['Bondoukou', .8], ['Odienné', .6], ['Séguéla', .5]];
  const COMMUNE_NAMES = COMMUNES.map((c) => c[0]);

  const CANAUX = [['Au point de vente', 45], ['Campagne nationale 2026', 40], ['Autres', 15]];
  const SEXES = [['H', 'Hommes'], ['F', 'Femmes']];
  const PLATS = [['1XBET', 22, .5], ['PREMIER BET', 14, .2], ['SportCash', 10, 0], ['Loto Bonheur', 9, -.6], ['PMU', 8, -.2],
    ['BETCLIC.COM', 5, .1], ['MELBET', 5, .5], ['JEUX VIRTUELS', 4, .8], ['BETWINNER', 3, .3], ['AKWABET', 3, .1],
    ['PARIPESA', 2, .3], ['SCRATCH', 2, -.3], ['BETPAWA', 1.5, .2], ['CHOPLIFE', 1, .2], ['BETMOMO', 1, .2],
    ['CASINOCASH', .5, .7], ['AFRO PARI', .6, 0], ['BETCHOC', .5, 0], ['VIP SLOT', .4, .7], ['WINNABET', .4, 0], ['YBET', .3, 0]];
  const ITEMS = [
    ['Misé plus que ce qu\'on peut perdre', 1.3], ['Miser plus pour la même excitation', .9],
    ['Rejouer pour récupérer ses pertes', 1.4], ['Vendre ou emprunter pour jouer', .6],
    ['Sentir avoir un problème avec le jeu', 1.1], ['Stress, angoisse, santé', .9],
    ['Être critiqué pour ses habitudes de jeu', .8], ['Difficultés financières (soi, foyer)', .9],
    ['Se sentir coupable de sa façon de jouer', 1.2],
  ];
  const AGE_GROUPS = [['18–24', 18, 24], ['25–34', 25, 34], ['35–44', 35, 44], ['45–54', 45, 54], ['55 +', 55, 99]];
  const ageGroup = (a) => AGE_GROUPS.find((g) => a >= g[1] && a <= g[2])[0];
  const expo = (mean) => -Math.log(1 - R()) * mean;
  const d2 = () => String(Math.floor(R() * 100)).padStart(2, '0');

  /* Un enregistrement = un test commencé (étape « Informations » validée).
     completed = false : questions jamais envoyées (abandon) → pas de score, pas de suivi. */
  const records = [];
  for (let i = 0; i < 2000; i++) {
    const daysAgo = HISTORY_DAYS * Math.pow(R(), 0.75);
    const date = new Date(TODAY - daysAgo * DAY - R() * 6 * 36e5);
    const zone = R() < .55 ? 'Abidjan' : 'Intérieur';
    const city = zone === 'Abidjan' ? pick(COMMUNES) : pick(VILLES);
    const age = 18 + Math.floor(Math.pow(R(), 1.5) * 50);
    const sexe = R() < .74 ? 'H' : 'F';
    const platName = pick(PLATS.map((p) => [p[0], p[1]]));
    const platRow = PLATS.find((p) => p[0] === platName);
    const canal = daysAgo > 75 ? pick([['Au point de vente', 70], ['Autres', 30]]) : pick(CANAUX);
    const base = { id: 'D-' + (10241 + i), date, ageDays: Math.floor((TODAY - date) / DAY), city, zone, age, sexe, plat: platName, canal };

    let pDone = .85;
    if (canal === 'Campagne nationale 2026') pDone -= .09;
    if (age > 54) pDone -= .07;
    if (R() > pDone) { records.push(Object.assign(base, { completed: false })); continue; }

    const bias = platRow[2] + (age < 25 ? .5 : age < 35 ? .2 : age > 54 ? -.4 : 0) + (sexe === 'H' ? .1 : -.15);
    const w = [.30, .22, .28, .20].map((b, j) => b * Math.exp(bias * [-.6, -.2, .2, .6][j]));
    const cat = pick(w.map((x, j) => [j, x]));
    const score = cat === 0 ? 0 : cat === 1 ? 1 + Math.floor(R() * 2) : cat === 2 ? 3 + Math.floor(R() * 5) : 8 + Math.floor(Math.pow(R(), 1.8) * 20);
    const answers = ITEMS.map(() => 0);
    for (let s = score; s > 0; s--) {
      const open = ITEMS.map((it, j) => [j, answers[j] < 3 ? it[1] : 0]).filter((x) => x[1] > 0);
      answers[pick(open)]++;
    }

    /* Comme dans l'application (AdminTestController::followupLabel) :
       - demande d'appel proposée aux zones orange et rouge, accompagnement à la zone rouge seulement ;
       - si proposé : Oui (case cochée), Non (formulaire envoyé sans cocher), Sans réponse (page quittée sans envoyer) ;
       - '-' = non proposé pour la zone du test. */
    let callback = '-', support = '-';
    if (cat >= 2) callback = pick([['Oui', 45], ['Non', 20], ['Sans réponse', 35]]);
    if (cat === 3) support = pick([['Oui', 32], ['Non', 25], ['Sans réponse', 43]]);

    /* Statut du dossier :
       clos  = zone verte, aucune action ;
       wait  = a demandé un appel, pas encore pris en charge ;
       done  = pris en charge (date enregistrée) ;
       none  = à risque sans demande d'appel (Non / Sans réponse) : pas d'appel sortant. */
    let status = 'clos', pecAt = null;
    if (cat >= 2) {
      if (callback === 'Oui') {
        let p = daysAgo < 2 ? .2 : daysAgo < 7 ? .7 : daysAgo < 14 ? .93 : .995;
        if (daysAgo < 14 && zone === 'Intérieur') p *= .9;
        if (daysAgo < 14 && age < 25) p *= .93;
        status = R() < p ? 'done' : 'wait';
      } else {
        status = R() < .08 ? 'done' : 'none'; // a appelé le 9999 de lui-même
      }
      if (status === 'done') pecAt = new Date(+date + Math.min(daysAgo, expo(2) + .1) * DAY);
    }

    records.push(Object.assign(base, {
      completed: true, score, cat, answers, callback, support, status, pecAt,
      phone: '00 00 ' + d2() + ' ' + d2() + ' ' + d2(), // numéro volontairement invalide (fictif)
      email: R() < .35 ? 'joueur' + (10241 + i) + '@exemple.test' : null, // e-mail facultatif, domaine fictif
    }));
  }

  /* ------------------------------------------------------------------
   * 2. État, filtres, masquage
   * ------------------------------------------------------------------ */
  const state = { role: 'lonaci', period: '90', zone: '', sexe: '', canal: '', plat: '', qfilter: 'todo', page: 1, size: 10, search: null };
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => n.toLocaleString('fr-FR');
  const isL = () => window.PJR.state.role === 'lonaci'; // profil choisi dans la barre de maquette
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const shortDate = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  function started() {
    return records.filter((r) =>
      (state.period === 'all' || r.ageDays < +state.period) &&
      (!state.zone || r.zone === state.zone) &&
      (!state.sexe || r.sexe === state.sexe) &&
      (!state.canal || r.canal === state.canal) &&
      (!state.plat || r.plat === state.plat));
  }

  /** Masquage LONACI : 1 = effectif de 0 à 4 (primaire) ; 2 = secondaire
   *  (si une seule case d'un groupe est masquée, la plus petite suivante l'est aussi,
   *  sinon on la retrouverait par soustraction avec le total). Côté YODAN : rien n'est masqué. */
  function suppress(counts) {
    const mk = counts.map((c) => (isL() && c < M ? 1 : 0));
    if (isL() && mk.filter(Boolean).length === 1) {
      let idx = -1;
      counts.forEach((c, i) => { if (!mk[i] && (idx < 0 || c < counts[idx])) idx = i; });
      if (idx >= 0) mk[idx] = 2;
    }
    return mk;
  }
  const small = (n) => isL() && n < M;
  const MASK = '<span class="mask">&lt;5</span>';
  const nTxt = (n) => (small(n) ? MASK : fmt(n));
  /** Taux : masqué si le numérateur ou le dénominateur est sous le seuil. */
  const rate = (num, den) => (!den || (isL() && (den < M || num < M)) ? null : num / den);
  const pTxt = (r) => (r == null ? '<span class="mask">masqué</span>' : Math.round(r * 100) + ' %');
  const pPlain = (r) => (r == null ? 'masqué' : Math.round(r * 100) + ' %');
  const HATCH = 'repeating-linear-gradient(45deg,#d6d1cc 0 3px,#eeeae6 3px 6px)';

  /** Barre 100 % empilée. Les cases masquées sont fusionnées en un seul segment hachuré. */
  function stack(counts, colors, labels, lightIdx) {
    const total = sum(counts);
    if (!total && !isL()) return '<div class="stack"><div class="hatch light" style="flex:1;color:#57504c">Aucun test</div></div>';
    if (small(total)) return '<div class="stack"><div class="hatch light" style="flex:1;color:#57504c" data-tip="Moins de 5 tests : groupe masqué côté LONACI">Effectif &lt; 5 — masqué</div></div>';
    const mk = suppress(counts);
    let html = '';
    counts.forEach((c, i) => {
      if (!c || mk[i]) return;
      const w = (c / total) * 100;
      html += '<div class="' + ((lightIdx || []).includes(i) ? 'light' : '') + '" style="flex:0 0 ' + w + '%;background:' + colors[i] + '" data-tip="' + esc(labels[i] + ' : ' + fmt(c) + ' (' + Math.round(w) + ' %)') + '">' + (w >= 7 ? Math.round(w) + ' %' : '') + '</div>';
    });
    if (mk.some(Boolean)) {
      const masked = counts.reduce((s, c, i) => s + (mk[i] ? c : 0), 0);
      const names = labels.filter((_, i) => mk[i]).join(', ');
      html += '<div class="hatch light" style="flex:1 1 ' + Math.max(3, (masked / total) * 100) + '%;color:#57504c" data-tip="' + esc('Masqué (moins de 5) : ' + names) + '">' + (masked / total >= .07 ? 'masqué' : '') + '</div>';
    }
    return '<div class="stack">' + html + '</div>';
  }
  const legend = (labels, colors) => '<div class="legend">' + labels.map((l, i) => '<span><i style="background:' + colors[i] + '"></i>' + esc(l) + '</span>').join('') + '</div>';
  const hatchDefs = (id) => '<defs><pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#eeeae6"/><rect width="3" height="6" fill="#d6d1cc"/></pattern></defs>';

  /* ------------------------------------------------------------------
   * 3. Rendu des blocs
   * ------------------------------------------------------------------ */
  const CAT_COLORS = CATS.map((c) => c.c);
  const CAT_LABELS = CATS.map((c) => c.l);
  const atRisk = (r) => r.cat >= 2;

  function render() {
    const st = started();
    const rs = st.filter((r) => r.completed);
    const risk = rs.filter(atRisk);
    renderWho(); renderKpis(st, rs, risk); renderFunnel(st, rs, risk); renderConsent(risk); renderRisk(rs);
    renderPec(rs, risk); renderWeekly(rs); renderHeat(rs); renderProfile(rs); renderCities(rs); renderPlats(rs);
    renderItems(rs); renderCompletion(st); renderEquity(risk);
    $('#queue').hidden = isL(); $('#ghost').hidden = !isL();
    if (!isL()) renderQueue(risk);
    $('#unit-note').innerHTML = isL() ? 'Agrégats anonymes · groupes de 0 à 4 tests masqués' : 'Vue clinique · effectifs non masqués';
    $('#exp-list').hidden = isL();
  }

  function renderWho() {
    const w = $('#who');
    w.className = 'who' + (isL() ? '' : ' yodan');
    w.textContent = isL() ? 'LONACI · pilotage' : 'YODAN · centre d\'écoute';
  }

  function renderKpis(st, rs, risk) {
    const oui = risk.filter((r) => r.callback === 'Oui');
    const sr = risk.filter((r) => r.callback === 'Sans réponse').length;
    const done = risk.filter((r) => r.status === 'done').length;
    const ouiDone = oui.filter((r) => r.status === 'done').length;
    const wait = risk.filter((r) => r.status === 'wait').length;
    const days = state.period === 'all' ? HISTORY_DAYS : +state.period;
    const k = (lbl, val, hint, cls) => '<div class="kpi ' + (cls || '') + '"><div class="lbl">' + lbl + '</div><div class="val">' + val + '</div><div class="hint">' + hint + '</div></div>';
    $('#kpis').innerHTML =
      k('Tests terminés', nTxt(rs.length), '≈ ' + (rs.length / days).toFixed(1).replace('.', ',') + ' par jour') +
      k('Taux de complétion', pTxt(rate(rs.length, st.length)), nTxt(st.length - rs.length) + ' tests commencés non terminés') +
      k('Joueurs à risque', nTxt(risk.length), pTxt(rate(risk.length, rs.length)) + ' des tests (modéré + excessif)') +
      k('Demandes d\'appel', nTxt(oui.length), 'acceptation ' + pTxt(rate(oui.length, risk.length)) + ' · ' + nTxt(sr) + ' sans réponse') +
      k('Pris en charge', nTxt(done), pTxt(rate(ouiDone, oui.length)) + ' des demandes d\'appel') +
      k('À appeler', nTxt(wait), 'demandes d\'appel en attente', wait ? 'alert' : '');
  }

  function renderFunnel(st, rs, risk) {
    const oui = risk.filter((r) => r.callback === 'Oui');
    const steps = [
      ['Tests commencés', 'étape « Informations » validée', st.length],
      ['Tests terminés', 'questions envoyées', rs.length],
      ['Joueurs à risque', 'modéré + excessif', risk.length],
      ['Demandent un appel', 'demande d\'appel = Oui', oui.length],
      ['Pris en charge', 'parmi ceux qui ont demandé', oui.filter((r) => r.status === 'done').length],
    ];
    const max = st.length || 1;
    let html = '';
    steps.forEach((s, i) => {
      const masked = small(s[2]);
      const w = masked ? 3 : (s[2] / max) * 100;
      html += '<div class="funnel-row"><div class="name">' + s[0] + '<small>' + s[1] + '</small></div>' +
        '<div class="funnel-track"><div class="funnel-bar' + (masked ? ' hatch' : '') + '" style="width:' + w + '%" data-tip="' + esc(s[0] + ' : ' + (masked ? 'moins de 5' : fmt(s[2]))) + '"></div></div>' +
        '<div class="num">' + nTxt(s[2]) + '</div></div>';
      if (i < steps.length - 1) html += '<div class="funnel-step">↓ ' + pTxt(rate(steps[i + 1][2], s[2])) + ' passent à l\'étape suivante</div>';
    });
    $('#funnel').innerHTML = html;
  }

  function renderConsent(risk) {
    const L3 = ['Oui', 'Non', 'Sans réponse'];
    const C3 = ['#2a78d6', '#8a837d', '#d6d1cc'];
    const block = (title, pop, field, popLabel) => {
      const counts = L3.map((v) => pop.filter((r) => r[field] === v).length);
      return '<div class="consent-block"><div class="consent-title"><span style="color:var(--text);font-weight:700;font-size:.84rem">' + title + ' <span>· ' + popLabel + ' (' + nTxt(pop.length) + ')</span></span><span>acceptation <b>' + pTxt(rate(counts[0], sum(counts))) + '</b></span></div>' +
        stack(counts, C3, L3, [2]) + '</div>';
    };
    $('#consent-chart').innerHTML = legend(L3, C3) +
      block('Demande d\'appel', risk, 'callback', 'proposée aux joueurs à risque') +
      block('Accompagnement', risk.filter((r) => r.cat === 3), 'support', 'proposé au jeu excessif') +
      '<p class="small muted" style="margin:10px 0 0">Acceptation = Oui ÷ (Oui + Non + Sans réponse). <b>Non</b> = formulaire envoyé sans cocher ; <b>Sans réponse</b> = page résultat quittée sans rien envoyer. Zone verte : rien n\'est proposé (tests clos).</p>';
  }

  function renderRisk(rs) {
    const counts = CATS.map((_, j) => rs.filter((r) => r.cat === j).length);
    $('#risk-bar').innerHTML = legend(CATS.map((c, j) => c.l + ' · ' + (small(counts[j]) ? '<5' : fmt(counts[j]))), CAT_COLORS) + stack(counts, CAT_COLORS, CAT_LABELS, [0]);

    // Histogramme : côté LONACI, scores ≥ 20 regroupés ; barres masquées hachurées jusqu'au seuil
    const bins = [];
    for (let s = 0; s <= 27; s++) bins.push({ lab: String(s), from: s, n: rs.filter((r) => r.score === s).length });
    if (isL()) { const tail = bins.splice(20); bins.push({ lab: '20+', from: 20, n: sum(tail.map((b) => b.n)) }); }
    const W = 560, H = 170, pl = 30, pb = 22, pt = 8;
    const max = Math.max(M, ...bins.map((b) => b.n));
    const bw = (W - pl) / bins.length;
    const y = (v) => pt + (H - pb - pt) * (1 - v / max);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Distribution du score ICJE">' + hatchDefs('hp1');
    [0, Math.round(max / 2), max].forEach((t) => { svg += '<line class="gridline" x1="' + pl + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (pl - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '</text>'; });
    bins.forEach((b, i) => {
      const x = pl + i * bw + 1;
      const masked = small(b.n);
      const v = masked ? M : b.n;
      if (v) svg += '<rect x="' + x + '" y="' + y(v) + '" width="' + (bw - 2) + '" height="' + (H - pb - y(v)) + '" rx="2" fill="' + (masked ? 'url(#hp1)' : CATS[catOf(b.from)].c) + '"/>';
      svg += '<rect class="hit" x="' + (x - 1) + '" y="' + pt + '" width="' + bw + '" height="' + (H - pb - pt) + '" data-tip="' + esc('Score ' + b.lab + ' · ' + CATS[catOf(b.from)].l + ' : ' + (masked ? 'moins de 5 tests (masqué)' : fmt(b.n) + ' tests')) + '"/>';
      if ([0, 1, 3, 8, 12, 16, 20, 24, 27].includes(b.from)) svg += '<text x="' + (x + (bw - 2) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + b.lab + '</text>';
    });
    svg += '<line class="axis" x1="' + pl + '" x2="' + W + '" y1="' + (H - pb) + '" y2="' + (H - pb) + '"/></svg>';
    $('#histo').innerHTML = svg + (isL() ? '<p class="small muted" style="margin:4px 0 0">Scores 20 à 27 regroupés ; barres hachurées = moins de 5 tests (hauteur plafonnée au seuil).</p>' : '');
  }

  function renderPec(rs, risk) {
    const clos = rs.filter((r) => r.status === 'clos').length;
    const labels = ['Pris en charge', 'En attente d\'appel', 'Non', 'Sans réponse'];
    const cols = ['#2a78d6', '#eda100', '#8a837d', '#d6d1cc'];
    const counts = [
      risk.filter((r) => r.status === 'done').length,
      risk.filter((r) => r.status === 'wait').length,
      risk.filter((r) => r.status === 'none' && r.callback === 'Non').length,
      risk.filter((r) => r.status === 'none' && r.callback === 'Sans réponse').length,
    ];
    const mk = small(sum(counts)) ? counts.map(() => 1) : suppress(counts);
    const total = sum(counts) || 1;
    const oui = risk.filter((r) => r.callback === 'Oui');
    const real = rate(oui.filter((r) => r.status === 'done').length, oui.length);
    const Rr = 58, C = 2 * Math.PI * Rr;
    let off = 0, arcs = '';
    const seg = (n, color, tip) => {
      const len = Math.max((n / total) * C, C * .02);
      arcs += '<circle r="' + Rr + '" cx="80" cy="80" fill="none" stroke="' + color + '" stroke-width="22" stroke-dasharray="' + Math.max(len - 2, 0.5) + ' ' + C + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 80 80)" data-tip="' + esc(tip) + '"/>';
      off += len;
    };
    counts.forEach((c, i) => { if (c && !mk[i]) seg(c, cols[i], labels[i] + ' : ' + fmt(c)); });
    if (mk.some(Boolean)) seg(counts.reduce((s, c, i) => s + (mk[i] ? c : 0), 0), 'url(#hp3)', 'Masqué (moins de 5) : ' + labels.filter((_, i) => mk[i]).join(', '));
    const svg = '<svg class="chart" viewBox="0 0 160 160" style="max-width:160px" role="img" aria-label="Statut des dossiers à risque">' + hatchDefs('hp3') + arcs +
      '<text x="80" y="78" text-anchor="middle" style="font-size:22px;font-weight:800;fill:#2b2523">' + (real == null ? '—' : Math.round(real * 100) + ' %') + '</text><text x="80" y="95" text-anchor="middle" style="font-size:10px">des demandes</text><text x="80" y="107" text-anchor="middle" style="font-size:10px">prises en charge</text></svg>';
    const fig = (i) => '<div><span><i class="cat-dot" style="background:' + cols[i] + '"></i>' + labels[i] + '</span><b>' + (mk[i] === 2 ? '<span class="mask">masqué</span>' : nTxt(counts[i])) + '</b></div>';
    $('#pec').innerHTML =
      '<div class="closed"><span class="lock" aria-hidden="true">✓</span><div><b>' + nTxt(clos) + '</b> tests <b style="font-size:inherit;font-family:inherit">clos</b> — zone verte (sans risque, faible risque), aucune action. ' + pTxt(rate(clos, rs.length)) + ' des tests terminés.</div></div>' +
      '<p class="sec-title">Dossiers à risque (' + nTxt(risk.length) + ') — nécessitent un suivi</p>' +
      '<div class="pec">' + svg + '<div class="pec-figs">' + fig(0) + fig(1) + fig(2) + fig(3) + '</div></div>' +
      '<p class="small muted" style="margin:10px 0 0">« Non » et « Sans réponse » : pas d\'appel sortant. Un joueur peut toujours appeler le 9999 ; il passe alors en « Pris en charge ».</p>';
  }

  function renderWeekly(rs) {
    const nW = state.period === 'all' ? Math.ceil(HISTORY_DAYS / 7) : Math.ceil(+state.period / 7);
    const weeks = [];
    for (let w = nW - 1; w >= 0; w--) {
      const inW = rs.filter((r) => Math.floor(r.ageDays / 7) === w);
      weeks.push({ start: new Date(TODAY - (w * 7 + 6) * DAY), counts: CATS.map((_, j) => inW.filter((r) => r.cat === j).length) });
    }
    const W = 1000, H = 220, pl = 34, pb = 24, pt = 18;
    const max = Math.max(M, ...weeks.map((w) => sum(w.counts)));
    const bw = (W - pl) / weeks.length;
    const y = (v) => pt + (H - pb - pt) * (1 - v / max);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tests par semaine et par niveau de risque">' + hatchDefs('hp2');
    [0, Math.round(max / 2), max].forEach((t) => { svg += '<line class="gridline" x1="' + pl + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (pl - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '</text>'; });
    const every = Math.ceil(weeks.length / 11);
    weeks.forEach((wk, i) => {
      const x = pl + i * bw + bw * .18, cw = bw * .64;
      const total = sum(wk.counts);
      const mk = suppress(wk.counts);
      const dl = wk.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      let tip = 'Semaine du ' + dl + ' : ' + (small(total) ? 'moins de 5 tests' : fmt(total) + ' tests');
      if (small(total)) {
        svg += '<rect x="' + x + '" y="' + y(M) + '" width="' + cw + '" height="' + (H - pb - y(M)) + '" rx="3" fill="url(#hp2)"/>';
      } else {
        let base = 0;
        wk.counts.forEach((c, j) => {
          if (!c || mk[j]) return;
          const top = y(base + c);
          svg += '<rect x="' + x + '" y="' + top + '" width="' + cw + '" height="' + Math.max(y(base) - top - 2, 1) + '" rx="2" fill="' + CATS[j].c + '"/>';
          base += c; tip += ' · ' + CATS[j].l + ' ' + fmt(c);
        });
        const masked = wk.counts.reduce((s, c, j) => s + (mk[j] ? c : 0), 0);
        if (masked) {
          const top = y(base + masked);
          svg += '<rect x="' + x + '" y="' + top + '" width="' + cw + '" height="' + Math.max(y(base) - top - 2, 1) + '" rx="2" fill="url(#hp2)"/>';
        }
        if (mk.some(Boolean)) tip += ' · masqué : ' + CATS.filter((_, j) => mk[j]).map((c) => c.l).join(', ');
        svg += '<text x="' + (x + cw / 2) + '" y="' + (y(total) - 5) + '" text-anchor="middle" style="font-weight:600">' + total + '</text>';
      }
      svg += '<rect class="hit" x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + (H - pb - pt) + '" data-tip="' + esc(tip) + '"/>';
      if (i % every === 0) svg += '<text x="' + (x + cw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + dl + '</text>';
    });
    svg += '<line class="axis" x1="' + pl + '" x2="' + W + '" y1="' + (H - pb) + '" y2="' + (H - pb) + '"/></svg>';
    $('#weekly').innerHTML = legend(CAT_LABELS.concat(isL() ? ['Masqué (moins de 5)'] : []), CAT_COLORS.concat(isL() ? [HATCH] : [])) + svg;
  }

  const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
  function renderHeat(rs) {
    let html = '<div class="heat" style="grid-template-columns:70px repeat(4,minmax(0,1fr)) 56px"><div></div>' +
      CATS.map((c) => '<div class="h">' + c.l + '</div>').join('') + '<div class="h">Tests</div>';
    AGE_GROUPS.forEach((g) => {
      const row = rs.filter((r) => ageGroup(r.age) === g[0]);
      const counts = CATS.map((_, j) => row.filter((r) => r.cat === j).length);
      const tot = row.length;
      const mk = small(tot) ? counts.map(() => 1) : suppress(counts);
      html += '<div class="rl">' + g[0] + '</div>';
      counts.forEach((c, j) => {
        if (mk[j]) { html += '<div class="c hatch mask" data-tip="' + esc(g[0] + ' · ' + CATS[j].l + ' : masqué (moins de 5)') + '">' + (mk[j] === 1 ? '&lt;5' : 'masqué') + '</div>'; return; }
        const p = tot ? c / tot : 0;
        const k = Math.min(SEQ.length - 1, Math.floor(p * 10));
        html += '<div class="c" style="background:' + SEQ[k] + ';color:' + (k >= 3 ? '#fff' : '#1b2b44') + '" data-tip="' + esc(g[0] + ' · ' + CATS[j].l + ' : ' + fmt(c) + ' tests sur ' + fmt(tot)) + '">' + Math.round(p * 100) + ' %</div>';
      });
      html += '<div class="c" style="color:#57504c">' + nTxt(tot) + '</div>';
    });
    $('#heat-age').innerHTML = html + '</div>';
  }

  function stackRows(rs, groups, fn) {
    return groups.map((g) => {
      const row = rs.filter((r) => fn(r) === g[0]);
      const counts = CATS.map((_, j) => row.filter((r) => r.cat === j).length);
      return '<div class="stack-row"><span>' + esc(g[1]) + '</span>' + stack(counts, CAT_COLORS, CAT_LABELS, [0]) + '<span class="n">' + nTxt(row.length) + '</span></div>';
    }).join('');
  }
  function renderProfile(rs) {
    $('#profile').innerHTML = legend(CAT_LABELS, CAT_COLORS) +
      '<h3 style="margin-top:4px">Sexe</h3>' + stackRows(rs, SEXES, (r) => r.sexe) +
      '<h3>Zone</h3>' + stackRows(rs, [['Abidjan', 'Abidjan'], ['Intérieur', 'Intérieur']], (r) => r.zone) +
      '<h3>Canal</h3>' + stackRows(rs, CANAUX.map((c) => [c[0], c[0]]), (r) => r.canal);
  }

  /** Liste « nom / nombre de tests / % à risque ». Côté LONACI, les lignes sous le seuil sont regroupées. */
  function riskList(rs, names, keyFn, title) {
    let rows = names.map((name) => {
      const row = rs.filter((r) => keyFn(r) === name);
      return { name, n: row.length, risk: row.filter(atRisk).length };
    }).filter((p) => p.n > 0).sort((a, b) => b.n - a.n);
    if (isL()) {
      const smallRows = rows.filter((p) => p.n < M);
      rows = rows.filter((p) => p.n >= M);
      if (smallRows.length) rows.push({ name: 'Autres (' + smallRows.length + (smallRows.length > 1 ? ' regroupées)' : ' regroupée)'), n: sum(smallRows.map((p) => p.n)), risk: sum(smallRows.map((p) => p.risk)), grouped: smallRows.map((p) => p.name) });
    }
    const maxN = Math.max(1, ...rows.map((p) => p.n));
    const bar = (w, color, masked, tip) => '<span style="height:14px;background:var(--grid);border-radius:4px;display:block"><span class="' + (masked ? 'hatch' : '') + '" style="display:block;height:100%;border-radius:4px;background:' + color + ';width:' + (masked ? 4 : w) + '%" data-tip="' + esc(tip) + '"></span></span>';
    return '<div><div class="plat-head"><span>' + title + '</span><span>Tests</span><span>% à risque</span></div>' + rows.map((p) => {
      const r = rate(p.risk, p.n);
      const m = small(p.n);
      return '<div class="plat-row"><span class="lab"' + (p.grouped ? ' data-tip="' + esc(p.grouped.join(', ')) + '"' : '') + '>' + esc(p.name) + '</span>' +
        '<span class="cell">' + bar((p.n / maxN) * 100, '#2a78d6', m, p.name + ' : ' + (m ? 'moins de 5' : fmt(p.n)) + ' tests') + '<b>' + nTxt(p.n) + '</b></span>' +
        '<span class="cell">' + bar(r == null ? 0 : r * 100, 'var(--r3)', r == null, p.name + ' : ' + pPlain(r) + ' à risque') + '<b>' + pTxt(r) + '</b></span></div>';
    }).join('') + '</div>';
  }
  function renderCities(rs) {
    $('#cities').innerHTML = '<div class="plats">' +
      riskList(rs, COMMUNE_NAMES, (r) => r.city, 'Abidjan — commune') +
      riskList(rs, VILLES.map((v) => v[0]), (r) => r.city, 'Intérieur — ville') + '</div>';
  }
  function renderPlats(rs) {
    const names = PLATS.map((p) => p[0]);
    const all = riskList(rs, names, (r) => r.plat, 'Plateforme');
    // deux colonnes : on découpe la liste triée en deux moitiés
    const tmp = document.createElement('div'); tmp.innerHTML = all;
    const rows = [...tmp.querySelectorAll('.plat-row')].map((n) => n.outerHTML);
    const head = tmp.querySelector('.plat-head').outerHTML;
    const half = Math.ceil(rows.length / 2);
    $('#plats').innerHTML = '<div class="plats"><div>' + head + rows.slice(0, half).join('') + '</div><div>' + head + rows.slice(half).join('') + '</div></div>';
  }

  function renderItems(rs) {
    $('#items').innerHTML = ITEMS.map((it, j) => {
      const n = rs.filter((r) => r.answers[j] >= 2).length;
      const r = rate(n, rs.length);
      return '<div class="hbar"><span class="lab" title="' + esc(it[0]) + '">' + esc(it[0]) + '</span><span class="track"><span class="fill ' + (r == null ? 'hatch' : '') + '" style="display:block;width:' + (r == null ? 3 : r * 100) + '%" data-tip="' + esc(it[0] + ' : ' + (r == null ? 'masqué' : fmt(n) + ' tests (' + pPlain(r) + ')')) + '"></span></span><span class="v">' + pTxt(r) + '</span></div>';
    }).join('');
  }

  function rateBars(groups, pop, fn, numFn, overall, color) {
    return groups.map((g) => {
      const p = pop.filter((r) => fn(r) === g[0]);
      const num = p.filter(numFn).length;
      const r = rate(num, p.length);
      return '<div class="hbar"><span class="lab">' + esc(g[1]) + '</span><span class="track"><span class="fill ' + (r == null ? 'hatch' : '') + '" style="display:block;background:' + color + ';width:' + (r == null ? 3 : r * 100) + '%" data-tip="' + esc(g[1] + ' : ' + (r == null ? 'masqué (moins de 5)' : fmt(num) + ' sur ' + fmt(p.length))) + '"></span>' +
        (overall == null ? '' : '<span class="ref" style="left:' + overall * 100 + '%" data-tip="' + esc('Moyenne générale : ' + Math.round(overall * 100) + ' %') + '"></span>') + '</span><span class="v">' + pTxt(r) + '</span></div>';
    }).join('');
  }
  function renderCompletion(st) {
    const done = (r) => r.completed;
    const overall = rate(st.filter(done).length, st.length);
    $('#completion').innerHTML =
      '<div class="consent-title"><span style="color:var(--text);font-weight:700;font-size:.84rem">Ensemble <span>· ' + nTxt(st.length) + ' tests commencés</span></span><span>complétion <b>' + pTxt(overall) + '</b></span></div>' +
      '<p class="sec-title">Par canal</p>' + rateBars(CANAUX.map((c) => [c[0], c[0]]), st, (r) => r.canal, done, overall, '#1baf7a') +
      '<p class="sec-title">Par tranche d\'âge</p>' + rateBars(AGE_GROUPS.map((g) => [g[0], g[0]]), st, (r) => ageGroup(r.age), done, overall, '#1baf7a');
  }

  function renderEquity(risk) {
    const oui = risk.filter((r) => r.callback === 'Oui');
    const isDone = (r) => r.status === 'done';
    const overall = oui.length ? oui.filter(isDone).length / oui.length : null;
    const g = (title, groups, fn) => '<div><h3>' + title + '</h3>' + rateBars(groups, oui, fn, isDone, overall, '#2a78d6') + '</div>';
    $('#equity').innerHTML = '<div class="equity">' +
      g('Zone', [['Abidjan', 'Abidjan'], ['Intérieur', 'Intérieur']], (r) => r.zone) +
      g('Sexe', SEXES, (r) => r.sexe) +
      g('Tranche d\'âge', AGE_GROUPS.map((a) => [a[0], a[0]]), (r) => ageGroup(r.age)) +
      g('Canal', CANAUX.map((c) => [c[0], c[0]]), (r) => r.canal) + '</div>';
  }

  /* ------------------------------------------------------------------
   * 4. Dossiers à risque (YODAN uniquement)
   * ------------------------------------------------------------------ */
  const PRIO = { 1: 'Jeu excessif + demande d\'appel', 2: 'Risque modéré + demande d\'appel' };
  const revealed = new Set();

  /* Recherche par contact : correspondance EXACTE seulement (numéro normalisé ou e-mail complet),
     pour qu'on ne puisse pas parcourir les contacts avec un morceau de numéro. */
  const normPhone = (s) => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('225') && d.length > 10) d = d.slice(3); return d; };
  const normEmail = (s) => String(s || '').trim().toLowerCase();
  function parseSearch(term) {
    const t = term.trim();
    if (!t) return { error: 'Saisissez un numéro de téléphone ou une adresse e-mail.' };
    if (t.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { type: 'email', value: normEmail(t) } : { error: 'Adresse e-mail incomplète : saisissez l\'adresse entière.' };
    const d = normPhone(t);
    return d.length >= 8 ? { type: 'phone', value: d } : { error: 'Numéro incomplet : saisissez le numéro entier (8 chiffres ou plus).' };
  }
  // Exemple pour les notes : un dossier « Sans réponse » avec e-mail (montre la prise en charge sur appel entrant)
  const exampleContact = () => records.find((r) => r.completed && r.cat >= 2 && r.status === 'none' && r.email && r.ageDays > 20);
  const maskEmail = (e) => { const [u, dom] = String(e).split('@'); return u.charAt(0) + '•••@' + dom; };
  const matches = (r, s) => (s.type === 'phone' ? normPhone(r.phone) === s.value : normEmail(r.email) === s.value);

  function renderQueue(risk) {
    const s = state.search;
    let q;
    if (s) {
      // La recherche porte sur tous les dossiers à risque, quels que soient la période et les filtres du tableau de bord
      q = records.filter((r) => r.completed && atRisk(r) && matches(r, s));
    } else {
      q = state.qfilter === 'todo' ? risk.filter((r) => r.status === 'wait') : risk.slice();
    }
    q = q.map((r) => ({ r, p: r.status === 'wait' ? (r.cat === 3 ? 1 : 2) : 9 }))
      .sort((a, b) => a.p - b.p || (a.p < 9 ? b.r.ageDays - a.r.ageDays : b.r.date - a.r.date));
    const pages = Math.max(1, Math.ceil(q.length / state.size));
    state.page = Math.min(state.page, pages);
    const from = (state.page - 1) * state.size;
    const shown = q.slice(from, from + state.size);
    $('#q-filter-wrap').hidden = !!s;
    $('#q-clear').hidden = !s;
    $('#q-banner').hidden = !s;
    if (s) $('#q-banner').textContent = (q.length ? q.length + ' dossier' + (q.length > 1 ? 's' : '') + ' trouvé' + (q.length > 1 ? 's' : '') : 'Aucun dossier à risque trouvé') +
      ' pour ' + (s.type === 'phone' ? 'ce numéro' : 'cet e-mail') + ' (toutes périodes, filtres du tableau de bord ignorés).';
    const chip = (v) => (v === 'Oui' ? '<span class="chip oui">Oui</span>' : v === 'Non' ? '<span class="chip">Non</span>' : v === 'Sans réponse' ? '<span class="chip sr">Sans réponse</span>' : '<span class="muted" title="Non proposé pour cette zone">—</span>');
    const statusCell = (r) => (r.status === 'wait'
      ? '<button type="button" class="btn-act" data-act="call" data-id="' + r.id + '">Appeler</button>'
      : r.status === 'done'
        ? '<span class="stat-done">Pris en charge le ' + shortDate(r.pecAt) + '</span>'
        : s // trouvé par recherche = le joueur appelle lui-même (9999) : on peut le prendre en charge
          ? '<button type="button" class="btn-act sec" data-act="take" data-id="' + r.id + '" data-tip="' + esc('Appel entrant : la personne a contacté le 9999 (demande d\'appel : ' + r.callback + ')') + '">Prendre en charge</button>'
          : '<span class="btn-act none">' + r.callback + ' · pas d\'appel</span>');
    const td = (l, html) => '<td data-l="' + l + '"><span>' + html + '</span></td>';
    $('#qtable tbody').innerHTML = shown.map(({ r, p }) => {
      // Contact proposé pour les dossiers à appeler, ou pour un dossier retrouvé par recherche
      const eligible = r.status === 'wait' || !!s;
      const shownC = eligible && revealed.has(r.id);
      const phone = !eligible ? '<span class="muted">—</span>'
        : shownC ? '<span class="phone-num">' + esc(r.phone) + '</span>'
          : '<button type="button" class="btn-phone" data-act="phone" data-id="' + r.id + '">Afficher le contact</button>';
      // E-mail : « aucun » s'il n'a pas été saisi ; masqué tant que le contact n'est pas affiché (affichage journalisé)
      const mail = !r.email ? '<span class="muted">Aucun</span>'
        : shownC ? '<span class="contact-mail">' + esc(r.email) + '</span>'
          : '<span class="mail-mask" data-tip="Masqué : « Afficher le contact » l\'affiche en entier">' + esc(maskEmail(r.email)) + '</span>';
      const dt = r.date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + r.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return '<tr' + (r.mine ? ' class="mine"' : '') + '>' +
        td('Priorité', p < 9 ? '<span class="prio p' + (p === 1 ? 1 : 3) + '" data-tip="' + esc(PRIO[p]) + '">' + p + '</span>' : '<span class="muted">—</span>') +
        td('Dossier', '<b>' + r.id + '</b>' + (r.mine ? '<span class="badge-mine" data-tip="Test passé dans l\'écran ① de la maquette">votre test</span>' : '')) +
        td('Téléphone', phone) +
        td('E-mail', mail) +
        td('Date du test', dt) +
        td('Ancienneté', '<b>' + r.ageDays + ' j</b>') +
        td('Commune / ville', esc(r.city) + ' <span class="muted">· ' + r.zone + '</span>') +
        td('Âge · sexe', r.age + ' ans · ' + r.sexe) +
        td('Plateforme', esc(r.plat)) +
        td('Score', '<span class="cat-dot" style="background:' + CATS[r.cat].c + '"></span><b>' + r.score + '</b> <span class="muted">· ' + CATS[r.cat].l + '</span>') +
        td('Canal', esc(r.canal)) +
        td('Appel', chip(r.callback)) +
        td('Accomp.', chip(r.support)) +
        td('Statut / action', statusCell(r)) + '</tr>';
    }).join('') || '<tr><td colspan="14" class="muted">' + (s ? 'Aucun dossier à risque pour ce contact.' : 'Aucun dossier pour ces filtres.') + '</td></tr>';
    const waits = q.filter((x) => x.p < 9);
    $('#q-count').textContent = (q.length ? (from + 1) + '–' + (from + shown.length) : '0') + ' sur ' + fmt(q.length) + ' dossiers' +
      (s ? '' : ' · à appeler : ' + waits.length + ' (priorité 1 : ' + waits.filter((x) => x.p === 1).length + ', priorité 2 : ' + waits.filter((x) => x.p === 2).length + ')');
    renderPager(pages);
  }

  /** Pagination : Précédent, 1 … 4 5 6 … 12, Suivant. */
  function renderPager(pages) {
    const p = state.page;
    const btn = (label, page, opts) => '<button type="button" data-page="' + page + '"' + (opts || '') + '>' + label + '</button>';
    let nums = [];
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - p) <= 1) nums.push(i);
    let html = btn('‹ Préc.', p - 1, p === 1 ? ' disabled aria-label="Page précédente"' : ' aria-label="Page précédente"');
    nums.forEach((n, k) => {
      if (k && n - nums[k - 1] > 1) html += '<span class="gap" aria-hidden="true">…</span>';
      html += btn(n, n, (n === p ? ' aria-current="page"' : '') + ' aria-label="Page ' + n + '"');
    });
    html += btn('Suiv. ›', p + 1, p === pages ? ' disabled aria-label="Page suivante"' : ' aria-label="Page suivante"');
    $('#q-pager').innerHTML = pages > 1 ? html : '';
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  /* ------------------------------------------------------------------
   * 5. Notes UX
   * ------------------------------------------------------------------ */
  function renderNotes() {
    const roleNotes = isL()
      ? '<ul><li>Uniquement des <b>agrégats</b> : totaux, taux, tendances. Aucune ligne individuelle, aucun téléphone, aucun n° de dossier.</li>' +
        '<li>Tout groupe de <b>0 à 4 tests</b> est masqué (« &lt;5 », hachures). Si une seule case d\'un groupe est masquée, la plus petite suivante l\'est aussi (« masqué »), sinon on la retrouverait par soustraction.</li>' +
        '<li>Histogramme : scores 20–27 regroupés ; communes, villes et plateformes de moins de 5 tests regroupées en « Autres ».</li>' +
        '<li>La liste des dossiers n\'existe pas pour ce profil (le cadre hachuré n\'est qu\'un repère de maquette).</li>' +
        '<li>Essayez : <i>Période = 30 jours</i> + <i>Sexe = Femmes</i> + <i>Plateforme = BETWINNER</i> pour voir le masquage.</li></ul>'
      : '<ul><li>Mêmes blocs que LONACI, <b>sans masquage</b> (besoin clinique), plus la <b>liste des dossiers à risque</b> en bas de page.</li>' +
        '<li><b>À appeler</b> = demande d\'appel « Oui », pas encore prise en charge. Tri : ① jeu excessif, ② risque modéré ; puis du plus ancien au plus récent.</li>' +
        '<li>« Non » et « Sans réponse » : visibles avec le filtre <i>Tous les dossiers à risque</i>, jamais appelés.</li>' +
        '<li>Colonne Accomp. : « — » pour le risque modéré (accompagnement non proposé à cette zone).</li>' +
        '<li>Le contact n\'est proposé que pour les dossiers à appeler ou retrouvés par recherche. La colonne E-mail indique « Aucun » ou une adresse masquée (<code>j•••@exemple.test</code>) ; « Afficher le contact » affiche le téléphone et l\'e-mail en entier et <b>journalise l\'accès</b>.</li>' +
        '<li>Les blocs du tableau de bord sont <b>repliables</b> : seuls les deux premiers et la liste des dossiers sont ouverts au départ, pour alléger l\'écran.</li>' +
        '<li>Un dossier pris en charge affiche sa <b>date de prise en charge</b> (pas de calcul de délai).</li></ul>' +
        '<span class="tag">Recherche et pagination</span>' +
        '<ul><li><b>Recherche par téléphone ou e-mail</b> : usage typique, une personne appelle le 9999 et l\'écoutant retrouve son dossier. La recherche porte sur <b>tous</b> les dossiers à risque, quels que soient la période et les filtres.</li>' +
        '<li><b>Correspondance exacte</b> uniquement : numéro complet (espaces, indicatif +225 ignorés) ou e-mail complet. Un morceau de numéro ne renvoie rien, pour qu\'on ne puisse pas parcourir les contacts.</li>' +
        '<li>Un dossier retrouvé « Non » ou « Sans réponse » peut être <b>pris en charge</b> (appel entrant) ; la date est enregistrée.</li>' +
        '<li>Chaque recherche est <b>journalisée</b> (utilisateur, date, type, nombre de résultats), <b>sans</b> le numéro ni l\'e-mail saisi.</li>' +
        '<li><b>Pagination</b> : 10, 25 ou 50 dossiers par page ; tout changement de filtre revient à la page 1.</li>' +
        (exampleContact() ? '<li>Essayez : <code>' + esc(exampleContact().phone) + '</code>' + (exampleContact().email ? ' ou <code>' + esc(exampleContact().email) + '</code>' : '') + ' (données fictives).</li>' : '') + '</ul>';
    return '<h2>③ Tableau de bord</h2>' +
      (myRec() ? '<p class="small"><b>Votre test</b> (dossier ' + myRec().id + ', ' + CATS[myRec().cat].l + ') est compté dans les chiffres' + (myRec().cat >= 2 ? ' ; côté YODAN, filtre <i>Tous les dossiers à risque</i> pour le retrouver' + (myRec().status === 'wait' ? ' (il est aussi dans « À appeler »)' : '') : '') + '.</p>' : '') +
      '<p>Un seul écran pour LONACI et YODAN. Les données sont saisies une fois ; ce qui change selon le profil, c\'est <b>ce qui est caché</b>.</p>' +
      '<span class="tag">Profil affiché : ' + (isL() ? 'LONACI (pilotage)' : 'YODAN (clinique)') + '</span>' + roleNotes +
      '<span class="tag">Changements v2 (retours du 17/11)</span>' +
      '<ul><li><b>Ville</b> : à Abidjan, la commune (Abobo, Yopougon, Anyama, Bingerville…). Zone Abidjan = communes du district.</li>' +
      '<li><b>Sexe</b> ajouté : filtre, profil × risque, équité.</li>' +
      '<li><b>Taux de complétion</b> : tests terminés ÷ tests commencés, par canal et par âge.</li>' +
      '<li>Zone verte : statut <b>« Clos »</b>, compté à part ; les dossiers à risque sont seuls suivis.</li>' +
      '<li><b>« Sans réponse »</b> = indicateur de gestion, pas de rappel (le joueur peut appeler le 9999).</li>' +
      '<li>Réponses alignées sur l\'application : <b>Oui / Non / Sans réponse</b> pour les joueurs à qui le choix est proposé (appel : modéré + excessif ; accompagnement : excessif). Acceptation = Oui ÷ (Oui + Non + Sans réponse).</li>' +
      '<li>Plus de délai : seule la <b>date de prise en charge</b> est enregistrée.</li>' +
      '<li>Masquage LONACI : <b>0 à 4</b> (zéros compris).</li>' +
      '<li>Mise à jour et <b>export en temps réel</b> : le CSV reprend les chiffres à l\'instant du clic, avec les filtres en cours et le même masquage que l\'écran. Export YODAN de la liste : <b>jamais de téléphone</b>. Chaque export est journalisé.</li>' +
      '<li>Un test abandonné peut être <b>repris</b> : le joueur refait le test et le même dossier passe de « commencé » à « terminé » (voir la note technique de l\'écran ①).</li></ul>' +
      '<span class="tag">Périmètre : 1 test = 1 enregistrement, ICJE seul</span>' +
      '<ul><li>On compte des <b>tests</b>, pas des personnes.</li>' +
      '<li>Champs déjà en base : date, ville, canal, âge, plateforme, score, catégorie, réponses aux 9 items, demande d\'appel, accompagnement, date de prise en charge, téléphone (YODAN seulement).</li>' +
      '<li>Champs à ajouter : <b>sexe</b>, <b>commune</b> (dans le champ ville), <b>statut « commencé / terminé »</b> du test.</li></ul>' +
      '<span class="tag">Non retenus</span>' +
      '<ul class="out"><li>Plusieurs tests par personne : beneficiary_id, suivi J30/J90/J180, score apparié.</li>' +
      '<li>Autres questionnaires : WHO-5, PREM.</li>' +
      '<li>Délais (réponse, accès au soin), motif d\'appel, orientation, consultation, incidents.</li></ul>' +
      '<span class="tag">Sécurité (pour l\'implémentation)</span>' +
      '<ul><li>Agrégats LONACI <b>calculés et masqués côté serveur</b> : le navigateur LONACI ne reçoit jamais de ligne individuelle.</li>' +
      '<li>Téléphone et liste : rôle YODAN clinique uniquement, MFA, chaque affichage de numéro journalisé (sans le numéro dans le log).</li>' +
      '<li>Test abandonné : on ne garde que ce qui sert au taux de complétion (date + profil), <b>pas le téléphone</b>.</li>' +
      '<li>Le sexe est un nouveau champ personnel : finalité = équité d\'accès ; à signaler au service central de purge.</li></ul>' +
      '<span class="tag">Questions encore ouvertes</span>' +
      '<ol class="questions">' +
      '<li><b>Sexe</b> : uniquement Homme / Femme, ou ajouter « Ne souhaite pas répondre » ?</li>' +
      '<li><b>Liste des communes</b> à valider (13 communes et sous-préfectures du district d\'Abidjan ici).</li>' +
      '<li>Le masquage secondaire peut cacher une grande case : acceptable pour LONACI ?</li>' +
      '<li>Format d\'export : CSV suffit, ou faut-il aussi un PDF / Excel mis en page ?</li></ol>';
  }

  /* ------------------------------------------------------------------
   * 5 bis. Export en temps réel (données au moment du clic, filtres en cours)
   * ------------------------------------------------------------------ */
  const nPlain = (n) => (small(n) ? '<5' : String(n));
  const mkPlain = (n, m) => (m === 1 ? '<5' : m === 2 ? 'masqué' : String(n));

  function exportAggregates() {
    const st = started();
    const rs = st.filter((r) => r.completed);
    const risk = rs.filter(atRisk);
    const oui = risk.filter((r) => r.callback === 'Oui');
    const rows = [];
    const add = (bloc, ind, grp, val) => rows.push([bloc, ind, grp, val]);
    const cats = (bloc, grp, pop) => {
      const counts = CATS.map((_, j) => pop.filter((r) => r.cat === j).length);
      const mk = small(pop.length) ? counts.map(() => 1) : suppress(counts);
      counts.forEach((c, j) => add(bloc, 'Tests ' + CATS[j].l, grp, mkPlain(c, mk[j])));
    };
    const groups = (bloc, names, keyFn, pop) => {
      let list = names.map((name) => { const p = pop.filter((r) => keyFn(r) === name); return { name, n: p.length, risk: p.filter(atRisk).length }; }).filter((x) => x.n > 0);
      if (isL()) {
        const sm = list.filter((x) => x.n < M);
        list = list.filter((x) => x.n >= M);
        if (sm.length) list.push({ name: 'Autres (regroupées)', n: sum(sm.map((x) => x.n)), risk: sum(sm.map((x) => x.risk)) });
      }
      list.forEach((x) => { add(bloc, 'Tests', x.name, nPlain(x.n)); add(bloc, '% à risque', x.name, pPlain(rate(x.risk, x.n))); });
    };

    add('Contexte', 'Tests commencés', 'Ensemble', nPlain(st.length));
    add('Contexte', 'Tests terminés', 'Ensemble', nPlain(rs.length));
    add('Contexte', 'Taux de complétion', 'Ensemble', pPlain(rate(rs.length, st.length)));
    cats('Risque', 'Ensemble', rs);
    [['callback', 'Demande d\'appel', risk], ['support', 'Accompagnement', risk.filter((r) => r.cat === 3)]].forEach(([f, l, pop]) => {
      const vals = ['Oui', 'Non', 'Sans réponse'];
      const counts = vals.map((v) => pop.filter((r) => r[f] === v).length);
      const mk = suppress(counts);
      vals.forEach((v, i) => add('Consentement', l, v, mkPlain(counts[i], mk[i])));
      add('Consentement', l, 'Taux d\'acceptation = Oui ÷ (Oui + Non + Sans réponse)', pPlain(rate(counts[0], sum(counts))));
    });
    add('Suivi', 'Tests clos (zone verte)', 'Ensemble', nPlain(rs.filter((r) => r.status === 'clos').length));
    const sc = [risk.filter((r) => r.status === 'done').length, risk.filter((r) => r.status === 'wait').length,
      risk.filter((r) => r.status === 'none' && r.callback === 'Non').length, risk.filter((r) => r.status === 'none' && r.callback === 'Sans réponse').length];
    const smk = suppress(sc);
    ['Pris en charge', 'En attente d\'appel', 'Non', 'Sans réponse'].forEach((l, i) => add('Suivi', 'Dossiers à risque', l, mkPlain(sc[i], smk[i])));
    add('Suivi', 'Demandes d\'appel prises en charge', 'Ensemble', pPlain(rate(oui.filter((r) => r.status === 'done').length, oui.length)));
    SEXES.forEach((s) => cats('Profil', 'Sexe ' + s[1], rs.filter((r) => r.sexe === s[0])));
    ['Abidjan', 'Intérieur'].forEach((z) => cats('Profil', 'Zone ' + z, rs.filter((r) => r.zone === z)));
    AGE_GROUPS.forEach((g) => cats('Profil', 'Âge ' + g[0], rs.filter((r) => ageGroup(r.age) === g[0])));
    CANAUX.forEach((c) => cats('Profil', 'Canal ' + c[0], rs.filter((r) => r.canal === c[0])));
    groups('Communes d\'Abidjan', COMMUNE_NAMES, (r) => r.city, rs);
    groups('Villes de l\'intérieur', VILLES.map((v) => v[0]), (r) => r.city, rs);
    groups('Plateformes', PLATS.map((p) => p[0]), (r) => r.plat, rs);
    ITEMS.forEach((it, j) => add('Réponses ICJE', '% « La plupart du temps » ou « Presque toujours »', it[0], pPlain(rate(rs.filter((r) => r.answers[j] >= 2).length, rs.length))));
    CANAUX.forEach((c) => { const p = st.filter((r) => r.canal === c[0]); add('Complétion', 'Taux de complétion', 'Canal ' + c[0], pPlain(rate(p.filter((r) => r.completed).length, p.length))); });
    AGE_GROUPS.forEach((g) => { const p = st.filter((r) => ageGroup(r.age) === g[0]); add('Complétion', 'Taux de complétion', 'Âge ' + g[0], pPlain(rate(p.filter((r) => r.completed).length, p.length))); });
    const eq = (label, fn, val) => { const p = oui.filter((r) => fn(r) === val); add('Équité', 'Demandes prises en charge', label, pPlain(rate(p.filter((r) => r.status === 'done').length, p.length))); };
    ['Abidjan', 'Intérieur'].forEach((z) => eq('Zone ' + z, (r) => r.zone, z));
    SEXES.forEach((s) => eq('Sexe ' + s[1], (r) => r.sexe, s[0]));
    AGE_GROUPS.forEach((g) => eq('Âge ' + g[0], (r) => ageGroup(r.age), g[0]));
    CANAUX.forEach((c) => eq('Canal ' + c[0], (r) => r.canal, c[0]));

    download('indicateurs', [['Bloc', 'Indicateur', 'Groupe', 'Valeur']].concat(rows));
  }

  function exportDossiers() {
    if (isL()) return; // n'existe pas côté LONACI
    const risk = started().filter((r) => r.completed && atRisk(r));
    const head = ['Dossier', 'Date du test', 'Commune / ville', 'Zone', 'Âge', 'Sexe', 'Plateforme', 'Score', 'Catégorie', 'Canal', 'Demande d\'appel', 'Accompagnement', 'Statut', 'Pris en charge le'];
    const label = { done: 'Pris en charge', wait: 'En attente d\'appel', none: 'Pas d\'appel' };
    const rows = risk.map((r) => [r.id, r.date.toLocaleString('fr-FR'), r.city, r.zone, r.age, r.sexe, r.plat, r.score, CATS[r.cat].l, r.canal,
      r.callback, r.support === '-' ? '-' : r.support, label[r.status], r.pecAt ? shortDate(r.pecAt) : '']);
    download('dossiers-a-risque', [head].concat(rows)); // jamais de colonne téléphone
  }

  function download(name, rows) {
    const now = new Date();
    const filters = ['période ' + (state.period === 'all' ? 'depuis le début' : state.period + ' j'), state.zone || 'toutes zones', state.sexe || 'tous sexes', state.canal || 'tous canaux', state.plat || 'toutes plateformes'].join(', ');
    const meta = [['MAQUETTE — DONNÉES FICTIVES'], ['Profil', isL() ? 'LONACI (agrégats, n < 5 masqués)' : 'YODAN (clinique)'], ['Extrait le', now.toLocaleString('fr-FR')], ['Filtres', filters], []];
    const csv = '﻿' + meta.concat(rows).map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'jeu-responsable-' + name + '-' + (isL() ? 'lonaci' : 'yodan') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Export généré à l\'instant (données en temps réel). Export journalisé : utilisateur, date, filtres.');
  }

  /* ------------------------------------------------------------------
   * 6. Interactions
   * ------------------------------------------------------------------ */
  const canalSel = $('#f-canal');
  CANAUX.forEach((c) => canalSel.insertAdjacentHTML('beforeend', '<option>' + esc(c[0]) + '</option>'));
  const platSel = $('#f-plat');
  [...PLATS].sort((a, b) => a[0].localeCompare(b[0])).forEach((p) => platSel.insertAdjacentHTML('beforeend', '<option>' + esc(p[0]) + '</option>'));

  const bind = (sel, key) => $(sel).addEventListener('change', (e) => { state[key] = e.target.value; state.page = 1; render(); });
  bind('#f-period', 'period'); bind('#f-zone', 'zone'); bind('#f-sexe', 'sexe'); bind('#f-canal', 'canal'); bind('#f-plat', 'plat'); bind('#q-filter', 'qfilter');
  $('#exp-agg').addEventListener('click', exportAggregates);
  $('#exp-list').addEventListener('click', exportDossiers);

  $('#q-size').addEventListener('change', (e) => { state.size = +e.target.value; state.page = 1; render(); });
  $('#q-pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    state.page = +b.dataset.page; render();
    $('#queue').scrollIntoView({ block: 'start' });
  });
  $('#q-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parseSearch($('#q-term').value);
    const err = $('#q-err');
    if (parsed.error) { err.textContent = parsed.error; err.hidden = false; $('#q-term').setAttribute('aria-invalid', 'true'); return; }
    err.hidden = true; $('#q-term').removeAttribute('aria-invalid');
    state.search = parsed; state.page = 1; render();
    toast('Recherche journalisée : utilisateur, date, type (' + (parsed.type === 'phone' ? 'téléphone' : 'e-mail') + '), nombre de résultats. Le numéro ou l\'e-mail saisi n\'est pas écrit dans le journal.');
  });
  $('#q-clear').addEventListener('click', () => {
    state.search = null; state.page = 1; $('#q-term').value = ''; $('#q-err').hidden = true; render();
  });

  $('#qtable').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'phone') {
      revealed.add(id); render();
      toast('Affichage du contact du dossier ' + id + ' journalisé (utilisateur, date, dossier).');
    } else if (b.dataset.act === 'take') {
      const rec = records.find((r) => r.id === id);
      rec.status = 'done'; rec.pecAt = new Date(TODAY);
      render(); window.PJR.refreshNotes();
      toast('Dossier ' + id + ' pris en charge (appel entrant), date enregistrée.');
    } else {
      toast('Maquette : ouvre la fiche d\'appel du dossier ' + id + ' (joint → « Pris en charge », date enregistrée · injoignable → reste « À appeler »).');
    }
  });

  /* ------------------------------------------------------------------
   * 7. Lien avec le formulaire et la page résultat (même base de données)
   * ------------------------------------------------------------------ */
  let myId = null;
  const myRec = () => records.find((r) => r.id === myId);
  const statusOf = (r) => (r.cat < 2 ? 'clos' : r.callback === 'Oui' ? 'wait' : 'none');

  /** Test terminé dans l'écran ① : nouveau dossier, daté de maintenant. */
  function add(t) {
    const rec = Object.assign({
      id: 'D-' + (10241 + records.length), date: new Date(TODAY), ageDays: 0, completed: true, pecAt: null, mine: true,
    }, t);
    rec.status = statusOf(rec);
    records.unshift(rec);
    myId = rec.id;
    return rec;
  }
  /** Choix enregistrés sur la page résultat (écran ②). */
  function update(id, patch) {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    Object.assign(rec, patch);
    rec.status = statusOf(rec);
  }

  /* ------------------------------------------------------------------
   * 8. Blocs repliables : seuls les deux premiers et la liste des dossiers sont ouverts au départ
   * ------------------------------------------------------------------ */
  const cards = [...document.querySelectorAll('#scr-dash .grid > .card:not(.ghost):not(.queue)')];
  function setOpen(card, open) {
    card.classList.toggle('collapsed', !open);
    card.querySelector('.card-toggle').setAttribute('aria-expanded', String(open));
  }
  cards.forEach((card, i) => {
    const h2 = card.querySelector('h2');
    const body = document.createElement('div');
    body.className = 'card-body';
    body.id = 'card-body-' + i;
    while (h2.nextSibling) body.appendChild(h2.nextSibling);
    card.appendChild(body);
    h2.innerHTML = '<button type="button" class="card-toggle" aria-controls="' + body.id + '">' + h2.innerHTML + '</button>';
    h2.querySelector('button').addEventListener('click', () => setOpen(card, card.classList.contains('collapsed')));
    setOpen(card, i < 2);
  });
  $('#scr-dash .grid').insertAdjacentHTML('beforebegin',
    '<div class="fold-all"><button type="button" class="btn-act sec" data-fold="1">Tout déplier</button><button type="button" class="btn-act sec" data-fold="0">Tout replier</button></div>');
  $('#scr-dash .fold-all').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fold]');
    if (b) cards.forEach((c) => setOpen(c, b.dataset.fold === '1'));
  });

  window.PJR.dash = { render, notes: renderNotes, add, update };
})();
