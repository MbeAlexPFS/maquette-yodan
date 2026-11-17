/* Écran ① — formulaire du test (étape 1 : informations, étape 2 : 9 questions ICJE). Données fictives. */
(function () {
  'use strict';

  const COMMUNES = ['Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon'];
  const VILLES = ['Abengourou', 'Aboisso', 'Agboville', 'Bondoukou', 'Bouaflé', 'Bouaké', 'Dabou', 'Daloa', 'Divo', 'Duékoué', 'Ferkessédougou', 'Gagnoa',
    'Grand-Bassam', 'Guiglo', 'Issia', 'Katiola', 'Korhogo', 'Man', 'Odienné', 'San-Pédro', 'Séguéla', 'Sinfra', 'Soubré', 'Yamoussoukro'];
  const PLATS = ['1XBET', 'AFRO PARI', 'AKWABET', 'BETCHOC', 'BETCLIC.COM', 'BETMOMO', 'BETPAWA', 'BETWINNER', 'CASINOCASH', 'CHOPLIFE', 'JEUX VIRTUELS',
    'Loto Bonheur', 'MELBET', 'PARIPESA', 'PMU', 'PREMIER BET', 'SCRATCH', 'SportCash', 'VIP SLOT', 'WINNABET', 'YBET'];
  const CANAUX = ['Campagne nationale 2026', 'Au point de vente', 'Autres'];
  const QUESTIONS = [
    'Avez-vous misé plus d\'argent que vous pouviez vous permettre de perdre ?',
    'Avez-vous besoin de miser de plus en plus d\'argent pour avoir la même excitation ?',
    'Avez-vous rejoué une autre journée pour récupérer l\'argent que vous aviez perdu en jouant ?',
    'Avez-vous vendu ou emprunté quelque chose pour obtenir de l\'argent pour jouer ?',
    'Avez-vous déjà senti que vous aviez peut-être un problème avec le jeu ?',
    'Le jeu a-t-il causé chez vous des problèmes de santé, y compris du stress ou de l\'angoisse ?',
    'Des personnes ont-elles critiqué vos habitudes de jeu ou dit que vous aviez un problème avec le jeu ?',
    'Vos habitudes de jeu ont-elles causé des difficultés financières à vous ou à votre entourage ?',
    'Vous êtes-vous déjà senti coupable de vos habitudes de jeu ou de ce qui arrive quand vous jouez ?',
  ];
  const OPTIONS = [['😌', 'Jamais', 0], ['🙂', 'Parfois', 1], ['😬', 'La plupart du temps', 2], ['😟', 'Presque toujours', 3]];
  const OTHER = '__autre';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const emptyForm = () => ({ phone: '', email: '', ville: '', autreVille: '', commune: '', age: '', sexe: '', plat: '', canal: '', consent: false });
  const S = { step: 'info', form: emptyForm(), errors: {}, q: 0, answers: [] };

  function render() {
    $('#f-page').innerHTML = header(S.step === 'info' ? 1 : 2) + (S.step === 'info' ? infoForm() : questionScreen());
  }

  function header(step) {
    const st = (n, l) => '<div class="step ' + (step === n ? 'on' : step > n ? 'done' : '') + '"' + (step === n ? ' aria-current="step"' : '') + '><span>' + n + '</span>' + l + '</div>';
    return '<div class="test-head"><p class="pill">Indice canadien du jeu excessif (ICJE)</p><h1>Le test Jouons responsable</h1>' +
      '<p class="intro">Au cours des douze derniers mois...</p><div class="steps">' + st(1, 'Vos informations') + '<div class="line"></div>' + st(2, 'Questions') + '</div></div>';
  }

  function infoForm() {
    const f = S.form, e = S.errors;
    const err = (k) => (e[k] ? '<p class="err" id="err-' + k + '">' + e[k] + '</p>' : '');
    const inv = (k) => (e[k] ? ' bad" aria-invalid="true" aria-describedby="err-' + k : '');
    const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l || v) + '</option>';
    const isAbj = f.ville === 'Abidjan', isOther = f.ville === OTHER;
    return '<form class="card" id="info" novalidate><p class="eyebrow">Étape 1</p><h3>Quelques informations avant de commencer</h3><div class="fields">' +
      '<div class="field"><label for="phone">Téléphone <span class="req">*</span></label><input class="input' + inv('phone') + '" id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Ex : 07 00 00 00 00" value="' + esc(f.phone) + '">' + err('phone') + '</div>' +
      '<div class="field"><label for="email">E-mail <span class="opt">(facultatif)</span></label><input class="input" id="email" type="email" autocomplete="email" placeholder="Votre e-mail" value="' + esc(f.email) + '"></div>' +
      '<div class="field"><label for="ville">Ville <span class="req">*</span><span class="new">liste</span></label><select class="input' + inv('ville') + '" id="ville">' +
        opt('', 'Choisir une ville', f.ville) + opt('Abidjan', 'Abidjan', f.ville) + '<optgroup label="Intérieur du pays">' + VILLES.map((v) => opt(v, v, f.ville)).join('') + '</optgroup>' + opt(OTHER, 'Autre ville…', f.ville) + '</select>' + err('ville') + '</div>' +
      (isAbj
        ? '<div class="field"><label for="commune">Commune <span class="req">*</span><span class="new">nouveau</span></label><select class="input' + inv('commune') + '" id="commune">' + opt('', 'Choisir une commune', f.commune) + COMMUNES.map((c) => opt(c, c, f.commune)).join('') + '</select>' + err('commune') + '</div>'
        : isOther
          ? '<div class="field"><label for="autreVille">Nom de la ville <span class="req">*</span></label><input class="input' + inv('autreVille') + '" id="autreVille" maxlength="120" value="' + esc(f.autreVille) + '">' + err('autreVille') + '</div>'
          : '<div class="field" aria-hidden="true"></div>') +
      '<div class="field"><label for="age">Âge <span class="req">*</span></label><input class="input' + inv('age') + '" id="age" type="number" inputmode="numeric" min="12" max="120" placeholder="Ex : 25" value="' + esc(f.age) + '">' + err('age') + '</div>' +
      '<div class="field"><span class="lbl" id="sexe-lbl">Sexe <span class="req">*</span><span class="new">nouveau</span></span><div class="radios" role="radiogroup" aria-labelledby="sexe-lbl">' +
        ['Homme', 'Femme'].map((s) => '<label class="radio"><input type="radio" name="sexe" value="' + s + '"' + (f.sexe === s ? ' checked' : '') + '> ' + s + '</label>').join('') + '</div>' + err('sexe') + '</div>' +
      '<div class="field full"><label for="plat">Plateforme de jeux préférée <span class="req">*</span></label><select class="input' + inv('plat') + '" id="plat">' + opt('', 'Choisir une plateforme', f.plat) + PLATS.map((p) => opt(p, p, f.plat)).join('') + '</select>' + err('plat') + '</div>' +
      '<div class="field full"><label for="canal">Où avez-vous entendu parler du jeu responsable ? <span class="req">*</span></label><select class="input' + inv('canal') + '" id="canal">' + opt('', 'Choisir une réponse', f.canal) + CANAUX.map((c) => opt(c, c, f.canal)).join('') + '</select>' + err('canal') + '</div>' +
      '<div class="field full"><label class="consent"><input type="checkbox" id="consent"' + (f.consent ? ' checked' : '') + '><span>J\'accepte que mes données soient traitées dans le cadre de ce questionnaire, conformément à la <a href="#">politique de confidentialité</a>. <span class="req">*</span></span></label></div>' +
      '</div></form><div class="actions"><button type="button" class="btn" id="next"' + (f.consent ? '' : ' disabled') + '>Suivant</button><a href="#" class="link">Retour à l\'accueil</a></div>';
  }

  function questionScreen() {
    const answered = S.answers.filter((a) => a != null).length;
    const pct = Math.round((answered / QUESTIONS.length) * 100);
    const q = S.q;
    const last = q === QUESTIONS.length - 1;
    return '<div class="progress"><div class="progress-top"><span>Question ' + (q + 1) + ' / ' + QUESTIONS.length + '</span><b>' + pct + ' %</b></div><div class="bar"><div style="width:' + pct + '%"></div></div></div>' +
      '<div class="card q" role="group" aria-labelledby="q-title"><p class="pill">Question ' + (q + 1) + ' sur ' + QUESTIONS.length + '</p><h3 id="q-title">' + esc(QUESTIONS[q]) + '</h3><div class="answers">' +
      OPTIONS.map((o) => '<button type="button" class="answer' + (S.answers[q] === o[2] ? ' sel' : '') + '" data-v="' + o[2] + '" aria-pressed="' + (S.answers[q] === o[2]) + '"><span class="emo" aria-hidden="true">' + o[0] + '</span>' + o[1] + '</button>').join('') +
      '</div></div><div class="actions">' +
      (last && S.answers[q] != null ? '<button type="button" class="btn" id="submit">✓ Valider</button>' : '') +
      (q > 0 ? '<button type="button" class="btn-sec" id="prev">Précédent</button>' : '') +
      '<button type="button" class="link" id="edit">Modifier mes informations</button></div>';
  }

  function readForm() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const f = S.form;
    f.phone = v('phone'); f.email = v('email'); f.ville = v('ville'); f.age = v('age'); f.plat = v('plat'); f.canal = v('canal');
    f.commune = f.ville === 'Abidjan' ? v('commune') : '';
    f.autreVille = f.ville === OTHER ? v('autreVille') : '';
    const s = document.querySelector('input[name="sexe"]:checked'); f.sexe = s ? s.value : '';
    const c = document.getElementById('consent'); f.consent = !!(c && c.checked);
  }

  function validate() {
    const f = S.form, e = {};
    if (!f.phone) e.phone = 'Veuillez renseigner votre numéro de téléphone.';
    else if (!/^\+?[0-9\s]{8,20}$/.test(f.phone)) e.phone = 'Veuillez saisir un numéro de téléphone valide (8 à 20 chiffres).';
    if (!f.ville) e.ville = 'Veuillez choisir votre ville.';
    if (f.ville === 'Abidjan' && !f.commune) e.commune = 'Veuillez choisir votre commune.';
    if (f.ville === OTHER && !f.autreVille) e.autreVille = 'Veuillez indiquer le nom de votre ville.';
    const a = +f.age;
    if (!f.age || !(a >= 12 && a <= 120)) e.age = 'Veuillez indiquer un âge entre 12 et 120 ans.';
    if (!f.sexe) e.sexe = 'Veuillez indiquer votre sexe.';
    if (!f.plat) e.plat = 'Veuillez choisir une plateforme.';
    if (!f.canal) e.canal = 'Veuillez choisir une réponse.';
    return e;
  }

  function next() {
    readForm();
    S.errors = validate();
    if (Object.keys(S.errors).length) { render(); const first = document.querySelector('.scr-form .bad'); if (first) first.focus(); return; }
    S.step = 'questions'; S.q = 0; S.answers = [];
    render(); $('#frame').scrollTop = 0;
  }

  function submit() {
    const f = S.form;
    const score = S.answers.reduce((s, x) => s + x, 0);
    const profile = { ville: f.ville === OTHER ? f.autreVille : f.ville, commune: f.commune || null, age: +f.age, sexe: f.sexe === 'Homme' ? 'H' : 'F', plat: f.plat, canal: f.canal };
    const done = { profile, phone: f.phone, email: f.email || null, answers: S.answers.slice(), score };
    // Le joueur qui refait le test repart d'un formulaire vide (pas de pré-remplissage : téléphones souvent partagés)
    S.step = 'info'; S.form = emptyForm(); S.errors = {}; S.q = 0; S.answers = [];
    window.PJR.onTestDone(done);
  }

  $('#f-page').addEventListener('change', (e) => {
    if (e.target.id === 'ville') {
      readForm(); delete S.errors.ville; render();
      const el = document.getElementById(S.form.ville === 'Abidjan' ? 'commune' : S.form.ville === OTHER ? 'autreVille' : 'ville');
      if (el) el.focus();
    }
    if (e.target.id === 'consent') document.getElementById('next').disabled = !e.target.checked;
  });
  $('#f-page').addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.tagName === 'A' && t.getAttribute('href') === '#') e.preventDefault();
    if (t.id === 'next') next();
    else if (t.classList.contains('answer')) {
      S.answers[S.q] = +t.dataset.v;
      if (S.q < QUESTIONS.length - 1) { render(); setTimeout(() => { S.q++; render(); }, 220); } else render();
    } else if (t.id === 'prev') { S.q--; render(); }
    else if (t.id === 'submit') submit();
    else if (t.id === 'edit') { S.step = 'info'; render(); }
  });

  function fill() {
    if (S.step !== 'info') { S.step = 'info'; }
    S.form = { phone: '00 00 12 34 56', email: 'joueur.demo@exemple.test', ville: 'Abidjan', commune: 'Yopougon', autreVille: '', age: '27', sexe: 'Homme', plat: '1XBET', canal: 'Au point de vente', consent: true };
    S.errors = {}; render();
  }

  function notes() {
    return '<h2>① Formulaire du test</h2>' +
      '<p class="muted small">Basé sur <code>test.blade.php</code> et <code>test-questions.blade.php</code>. Remplissez puis répondez aux 9 questions : le résultat (②) et le tableau de bord (③) utilisent votre test.</p>' +
      '<span class="tag">Nouveaux champs (étape 1)</span>' +
      '<ul><li><b>Ville</b> devient une liste : Abidjan, villes de l\'intérieur, « Autre ville… ». Fin des variantes du type « Abidjan Lagune ».</li>' +
      '<li>Si <b>Abidjan</b> : la <b>commune</b> est demandée (13 communes du district, dont Anyama, Bingerville, Songon).</li>' +
      '<li><b>Sexe</b> : nouveau champ obligatoire (finalité : équité d\'accès).</li>' +
      '<li>Le reste est inchangé : téléphone, e-mail facultatif, âge, plateforme, canal, consentement.</li></ul>' +
      '<span class="tag">Étape 2</span><ul><li>Les 9 questions ICJE, une par écran, comme aujourd\'hui.</li></ul>' +
      '<div class="tech"><span class="tag">Note technique — taux de complétion</span><ul>' +
      '<li>Au clic sur <b>Suivant</b> (étape 1), le test est enregistré avec le statut <b>« commencé »</b> : date + profil, <b>sans le téléphone</b>. Le numéro reste dans la session serveur, le temps de vérifier le délai de 30 jours.</li>' +
      '<li>Au clic sur <b>Valider</b> (étape 2) : statut <b>« terminé »</b>, score et téléphone enregistrés (pour le rappel).</li>' +
      '<li>Taux de complétion = tests terminés ÷ tests commencés.</li>' +
      '<li><b>Reprise</b> : un <b>cookie de reprise</b> (jeton aléatoire, sans donnée personnelle) relie le navigateur au test commencé. Si le joueur revient, il refait le test depuis un formulaire vide ; côté serveur, <b>le même dossier</b> passe à « terminé » (pas de doublon).</li>' +
      '<li>Un test abandonné ne déclenche pas le délai de 30 jours.</li>' +
      '<li>Limites : sur un autre téléphone, un nouveau dossier est créé et l\'ancien reste « commencé ». Sur un appareil partagé, le profil est remplacé par celui du dernier joueur.</li>' +
      '<li>Le cookie est strictement technique : à mentionner dans la politique de confidentialité.</li></ul></div>' +
      '<span class="tag">Questions à valider</span>' +
      '<ol class="questions"><li><b>Durée du cookie de reprise</b> : 30 jours ?</li>' +
      '<li><b>Autre téléphone</b> : accepte-t-on la limite ci-dessus, ou faut-il rapprocher par une empreinte chiffrée du numéro ?</li>' +
      '<li><b>Sexe</b> : Homme / Femme seulement, ou « Ne souhaite pas répondre » ?</li>' +
      '<li><b>Liste des villes</b> (24 + « Autre ville ») à compléter ?</li>' +
      '<li><b>Âge minimum</b> : 12 ans aujourd\'hui (prévention) ou 18 ans ?</li></ol>';
  }

  window.PJR.form = { render, notes, fill };
})();
