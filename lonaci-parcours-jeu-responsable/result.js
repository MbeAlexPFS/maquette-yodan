/* Écran ② — page résultat (reprise de la maquette page-resultat). Données fictives, aucun envoi réseau. */
(function () {
  'use strict';
  const MAX = 27; // 9 questions × 3 points (ICJE)
  const $ = (id) => document.getElementById(id);

  // Textes repris de config/healingy_test.php ; score par défaut quand on choisit la zone dans la barre
  const ZONES = {
    green: { score: 2, color: '#16a34a', soft: '#ecfdf3', emoji: '🙂', title: 'À faible risque',
      msg: 'Votre score indique un faible risque. Restez attentif à vos habitudes de jeu et fixez-vous des limites claires.' },
    orange: { score: 5, color: '#ea580c', soft: '#fff7ed', emoji: '⚠️', title: 'À risque modéré',
      msg: 'Votre score indique un risque modéré. Il peut être utile d’en parler et de mettre en place des stratégies pour reprendre le contrôle.' },
    red: { score: 14, color: '#dc2626', soft: '#fef2f2', emoji: '🛑', title: 'Jeu excessif',
      msg: 'Votre score suggère un risque élevé de jeu problématique. Nous vous recommandons fortement de demander de l’aide et de ne pas rester seul(e) avec cette situation.' },
  };
  const NO_RISK = { title: 'Sans risque', msg: 'Votre score n\'indique pas de risque particulier. Continuez à jouer de façon responsable.' };

  function render() {
    const st = window.PJR.state;
    const z = ZONES[st.zone];
    const cur = st.current;
    const score = cur ? cur.score : z.score;
    const pct = Math.round((score / MAX) * 100);
    const zeroRisk = cur && cur.cat === 0;
    const site = $('r-site');
    site.style.setProperty('--z', z.color);
    site.style.setProperty('--z-soft', z.soft);
    site.className = 'site zone-' + st.zone;
    $('gauge').style.setProperty('--p', pct);
    $('gauge').setAttribute('aria-label', 'Score : ' + pct + ' %');
    $('gauge-emoji').textContent = z.emoji;
    $('gauge-pct').textContent = pct + '%';
    $('result-title').textContent = zeroRisk ? NO_RISK.title : z.title;
    $('score').textContent = score;
    $('result-msg').textContent = zeroRisk ? NO_RISK.msg : z.msg;
    $('r-phone').textContent = cur && cur.phone ? cur.phone : '07 00 00 00 00';
    // Cases à cocher : zones orange et rouge ; accompagnement : rouge uniquement
    $('follow').hidden = st.zone === 'green';
    $('support-row').hidden = st.zone !== 'red';
  }

  $('follow-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const call = $('cb-call').checked;
    const support = $('cb-support').checked && window.PJR.state.zone === 'red';
    $('saved').textContent = 'Merci, votre choix a bien été enregistré.' + (call || support ? ' Nous vous contacterons dans les meilleurs délais.' : '');
    $('saved').hidden = false;
    window.PJR.onFollowup({ callback: call, support });
  });
  $('r-retake').addEventListener('click', (e) => { e.preventDefault(); window.PJR.go('form'); });

  // Nouvel affichage : on réinitialise les cases et le message
  const baseRender = render;
  function renderFresh() {
    if (renderFresh.lastId !== (window.PJR.state.current && window.PJR.state.current.id) || !window.PJR.state.current) {
      $('cb-call').checked = false; $('cb-support').checked = false; $('saved').hidden = true;
    }
    renderFresh.lastId = window.PJR.state.current && window.PJR.state.current.id;
    baseRender();
  }

  function notes() {
    const cur = window.PJR.state.current;
    return '<h2>② Page résultat</h2>' +
      '<p class="muted small">Basée sur <code>test-result.blade.php</code>. ' + (cur ? 'Affiche <b>votre test</b> (dossier ' + cur.id + ').' : 'Aperçu d\'une zone choisie dans la barre (sans test lié).') + '</p>' +
      '<span class="tag">Lien avec le tableau de bord</span>' +
      '<ul><li>Tant que le joueur n\'a pas cliqué sur « Enregistrer mon choix », ses choix valent <b>« Sans réponse »</b>.</li>' +
      '<li>Case cochée → <b>Oui</b> ; envoyé sans cocher → <b>Non</b>. Seuls les « Oui » arrivent dans la liste <b>À appeler</b> de YODAN.</li>' +
      '<li>Zone verte : rien n\'est proposé, le test est <b>clos</b>.</li></ul>' +
      '<span class="tag">Changements déjà validés</span>' +
      '<ul><li>Bouton « Ressources d\'accompagnement » retiré → lien « Plus d\'informations sur le jeu responsable » dans le pied de page.</li>' +
      '<li>Cases à cocher d\'abord, liens ensuite (WhatsApp, 9999).</li>' +
      '<li>« J\'accepte d\'être rappelé(e) » + numéro saisi en début de test : rien n\'est saisi sur cette page.</li>' +
      '<li>Tout tient sur un écran PC (1366 × 768) ; une colonne sur mobile.</li>' +
      '<li>Zone verte en vert ; phrase « Merci d\'avoir passé le test (…) » retirée.</li></ul>' +
      '<span class="tag">Questions à valider</span>' +
      '<ol class="questions"><li>Lien du pied de page : sur <b>toutes les pages</b> ou seulement ici ?</li>' +
      '<li>Libellé « Plus d\'informations sur le jeu responsable » : OK ?</li></ol>';
  }

  window.PJR.result = { render: renderFresh, notes };
})();
