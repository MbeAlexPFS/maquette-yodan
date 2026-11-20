/* Annuaire des maquettes : rendu, recherche et filtres. Lit window.PROJETS et window.MAQUETTES (maquettes.js). */
(function () {
  "use strict";
  const PROJETS = window.PROJETS || {};
  const MAQUETTES = (window.MAQUETTES || []).slice().sort((a, b) => (b.maj || "").localeCompare(a.maj || ""));
  const $ = (s) => document.querySelector(s);
  const state = { q: "", projet: "", old: false };

  const el = (tag, attrs, children) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else n.setAttribute(k, v);
    });
    (children || []).forEach((c) => c && n.append(c));
    return n;
  };
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtDate = (ymd) => (ymd ? new Date(ymd + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "");
  const projet = (id) => PROJETS[id] || { nom: id, couleur: "#3C8FCB" };
  const byDossier = Object.fromEntries(MAQUETTES.map((m) => [m.dossier, m]));

  function haystack(m) {
    return norm([m.titre, m.description, m.dossier, projet(m.projet).nom, ...(m.ecrans || []), ...(m.roles || [])].join(" "));
  }

  function card(m) {
    const p = projet(m.projet);
    const href = m.dossier + "/index.html";
    const h3 = el("h3", {}, [
      el("a", { href, text: m.titre }),
      m.reference ? el("span", { class: "flag ref", text: "Référence" }) : null,
      m.remplacePar ? el("span", { class: "flag old", text: "Remplacée" }) : null,
      m.tests ? el("span", { class: "flag tst", text: "Tests", title: "Tests de cohérence : ouvrir avec ?tests=1" }) : null,
    ]);
    const ne = (m.ecrans || []).length, nr = (m.roles || []).length;
    const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");
    const details = ne || nr ? el("details", { class: "more" }, [
      el("summary", { text: [ne && plural(ne, "écran"), nr && plural(nr, "rôle")].filter(Boolean).join(" · ") }),
      el("ul", { class: "tags", "aria-label": "Écrans et rôles" }, [
        ...(m.ecrans || []).map((e) => el("li", { text: e })),
        ...(m.roles || []).map((r) => el("li", { class: "role", text: r })),
      ]),
    ]) : null;
    const next = m.remplacePar && byDossier[m.remplacePar];
    return el("article", { class: "card" + (m.remplacePar ? " old" : ""), style: "--c:" + p.couleur }, [
      el("p", { class: "proj" }, [
        el("span", { class: "dot", "aria-hidden": "true" }),
        document.createTextNode(p.nom),
        el("span", { class: "date", text: fmtDate(m.maj), title: m.dossier + "/" }),
      ]),
      h3,
      el("p", { class: "desc", text: m.description || "" }),
      next ? el("p", {}, [el("a", { class: "see-v", href: next.dossier + "/index.html", text: "→ Version actuelle" })]) : null,
      el("div", { class: "meta" }, [
        details || el("span"),
        el("a", { class: "btn ghost", href, target: "_blank", rel: "noopener", text: "↗", title: "Nouvel onglet", "aria-label": "Ouvrir " + m.titre + " dans un nouvel onglet" }),
      ]),
    ]);
  }

  function renderChips() {
    const counts = {};
    MAQUETTES.forEach((m) => { counts[m.projet] = (counts[m.projet] || 0) + 1; });
    const ids = Object.keys(counts).sort((a, b) => projet(a).nom.localeCompare(projet(b).nom, "fr"));
    const chips = $("#chips");
    chips.replaceChildren(
      ...[["", "Tous"], ...ids.map((id) => [id, projet(id).nom])].map(([id, label]) => {
        const b = el("button", { type: "button", class: "chip", "aria-pressed": String(state.projet === id), text: label });
        b.addEventListener("click", () => { state.projet = id; renderChips(); render(); });
        return b;
      })
    );
  }

  function render() {
    const q = norm(state.q.trim());
    const list = MAQUETTES.filter((m) =>
      (state.old || !m.remplacePar || q || state.projet) && // les versions remplacées restent trouvables par recherche / filtre
      (!state.projet || m.projet === state.projet) &&
      (!q || q.split(/\s+/).every((w) => haystack(m).includes(w)))
    );
    const hidden = MAQUETTES.filter((m) => m.remplacePar).length;
    $("#count").textContent = list.length + " maquette" + (list.length > 1 ? "s" : "") +
      (!state.old && !q && !state.projet && hidden ? " (+ " + hidden + " ancienne" + (hidden > 1 ? "s" : "") + ")" : "");

    const root = $("#list");
    if (!list.length) { root.replaceChildren(el("p", { class: "empty", text: "Aucune maquette ne correspond à la recherche." })); return; }

    root.replaceChildren(el("div", { class: "grid" }, list.map(card)));
  }

  $("#q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("#show-old").addEventListener("change", (e) => { state.old = e.target.checked; render(); });
  renderChips();
  render();
})();
