/* Maquette Lonaci — parcours Jeu responsable : navigation entre les 3 écrans et liens entre eux.
   Données 100 % FICTIVES, tout reste dans le navigateur (aucun envoi réseau).
   Chaque écran s'enregistre dans window.PJR : PJR.form, PJR.result, PJR.dash (render + notes). */
window.PJR = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { screen: 'form', role: 'lonaci', zone: 'red', current: null };
  const ZONE_OF_CAT = ['green', 'green', 'orange', 'red'];

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  function go(screen) {
    state.screen = screen;
    ['form', 'result', 'dash'].forEach((s) => { $('#scr-' + s).hidden = s !== screen; });
    document.querySelectorAll('[data-screen]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.screen === screen)));
    document.querySelectorAll('[data-only]').forEach((el) => { el.hidden = el.dataset.only !== screen; });
    PJR[screen].render();
    $('#notes').innerHTML = PJR[screen].notes();
    $('#frame').scrollTop = 0;
  }
  function refreshNotes() { $('#notes').innerHTML = PJR[state.screen].notes(); }

  const profileOf = (p) => ({ city: p.commune || p.ville, zone: p.commune ? 'Abidjan' : 'Intérieur', age: p.age, sexe: p.sexe, plat: p.plat, canal: p.canal });

  /** Étape 1 validée → test « commencé » (profil seul, sans téléphone). Renvoie l'identifiant du test. */
  function onTestStarted(profile) {
    return PJR.dash.start(profileOf(profile)).id;
  }

  /** Questions envoyées → le même test passe à « terminé », puis on affiche le résultat. */
  function onTestDone(t) {
    const cat = t.score === 0 ? 0 : t.score <= 2 ? 1 : t.score <= 7 ? 2 : 3;
    // Tant que le joueur n'a rien envoyé sur la page résultat, ses choix valent « Sans réponse » (ou « - » si non proposés).
    const rec = PJR.dash.complete(t.id, Object.assign(profileOf(t.profile), {
      score: t.score, cat, answers: t.answers, phone: t.phone, email: t.email,
      callback: cat >= 2 ? 'Sans réponse' : '-', support: cat === 3 ? 'Sans réponse' : '-',
    }));
    state.current = { id: rec.id, cat, score: t.score, phone: t.phone };
    setZone(ZONE_OF_CAT[cat]);
    go('result');
  }

  /** Choix enregistrés sur la page résultat → mise à jour du même dossier. */
  function onFollowup(f) {
    if (!state.current) return; // zone choisie à la main dans la barre : pas de dossier lié
    const c = state.current;
    const patch = {};
    if (c.cat >= 2) patch.callback = f.callback ? 'Oui' : 'Non';
    if (c.cat === 3) patch.support = f.support ? 'Oui' : 'Non';
    PJR.dash.update(c.id, patch);
    toast('Maquette : dossier ' + c.id + ' mis à jour (appel : ' + (patch.callback || '-') + ', accompagnement : ' + (patch.support || '-') + '). Il est visible dans le tableau de bord, onglet ③.');
  }

  function setZone(z) {
    state.zone = z;
    document.querySelectorAll('[data-zone]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.zone === z)));
  }

  function boot() {
    document.querySelectorAll('[data-screen]').forEach((b) => b.addEventListener('click', () => go(b.dataset.screen)));
    document.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
      state.current = null; // aperçu d'une zone sans test : pas de lien avec un dossier
      setZone(b.dataset.zone); PJR.result.render(); refreshNotes();
    }));
    document.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
      state.role = b.dataset.role;
      document.querySelectorAll('[data-role]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      PJR.dash.render(); refreshNotes();
    }));
    document.querySelectorAll('[data-device]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('[data-device]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#frame').className = 'frame ' + b.dataset.device;
    }));
    $('#notes-toggle').addEventListener('click', (e) => {
      const on = $('#layout').classList.toggle('with-notes');
      e.currentTarget.setAttribute('aria-pressed', String(on));
    });
    $('#mock-fill').addEventListener('click', () => PJR.form.fill());

    // Infobulle unique pour tous les éléments [data-tip]
    const tip = $('#tip');
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { tip.hidden = true; return; }
      tip.textContent = el.getAttribute('data-tip');
      tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = (e.clientY + 16) + 'px';
    });

    go('form');
  }

  return { state, go, toast, onTestStarted, onTestDone, onFollowup, boot, refreshNotes };
})();
