/*
 * Plateforme Entreprise & Mutuelle — modèle, règles métier et données fictives.
 * Toutes les données sont générées à partir des faits (réponses, dates, décisions) ;
 * les statuts (couleur, prise en charge, délai, suivi) sont CALCULÉS par les mêmes fonctions que les écrans.
 * Score BSPA : seuils recopiés de bspa_particuliers/app/bspa_core.py (source auditée : Yodan-Analytics.hybride).
 * Maquette : données 100 % fictives (e-mails @*.exemple.test), aucun secret.
 */
"use strict";

(function () {
  const T = window.EM_TEXTES;
  const D = 86400000;
  const H = 3600000;

  /* ================= Référentiels ================= */
  const SECTEURS = [
    ["A", "Agriculture, sylviculture et pêche"],
    ["B", "Activités extractives"],
    ["C", "Activités de fabrication"],
    ["D", "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné"],
    ["E", "Production et distribution d'eau, assainissement, traitement des déchets et dépollution"],
    ["F", "Construction"],
    ["G", "Commerce ; réparation d'automobiles et de motocycles"],
    ["H", "Transports et entreposage"],
    ["I", "Activités d'hébergement et de restauration"],
    ["J", "Information et communication"],
    ["K", "Activités financières et d'assurance"],
    ["L", "Activités immobilières"],
    ["M", "Activités spécialisées, scientifiques et techniques"],
    ["N", "Activités de services de soutien et de bureau"],
    ["O", "Activités d'administration publique"],
    ["P", "Enseignement"],
    ["Q", "Activités pour la santé humaine et l'action sociale"],
    ["R", "Activités artistiques, sportives et récréatives"],
    ["S", "Autres activités de services"],
    ["T", "Activités des ménages en tant qu'employeurs ; activités indifférenciées de production des ménages"],
    ["U", "Activités des organisations extraterritoriales"],
  ];

  const ROLES = {
    ADMIN_YODAN: "Admin Yodan",
    SUP_PRINCIPAL: "Superviseur principal",
    ADMIN_MUTUELLE: "Administrateur",
    SUP_SECONDAIRE: "Superviseur secondaire",
    VALIDATEUR: "Validateur",
  };
  /* Rôles disponibles par type de client (CdC § 3.1). */
  const ROLES_BY_TYPE = {
    E: ["SUP_PRINCIPAL"],
    M: ["ADMIN_MUTUELLE", "SUP_PRINCIPAL", "SUP_SECONDAIRE", "VALIDATEUR"],
  };
  const UNIT_WORD = { E: { one: "direction", many: "directions", One: "Direction", Many: "Directions" }, M: { one: "région", many: "régions", One: "Région", Many: "Régions" } };

  const ZONES = ["VERT", "ORANGE", "ROUGE"];
  const ZONE = {
    VERT: { couleur: "Vert", risque: "Risque faible", libelle: "Satisfaisant", statut: "Risque faible" },
    ORANGE: { couleur: "Orange", risque: "Risque modéré", libelle: "Vigilance", statut: "Risque modéré" },
    ROUGE: { couleur: "Rouge", risque: "Risque critique", libelle: "À prendre en charge", statut: "Risque critique" },
  };

  /* ================= BSPA ================= */
  const SCALES = {
    A: ["Jamais", "De temps en temps", "Moins de la moitié du temps", "Plus de la moitié du temps", "La plupart du temps", "Tout le temps"],
    B: ["Jamais", "Presque jamais", "Parfois", "Assez souvent", "Très souvent"],
    C: ["Jamais", "Quelques fois par an", "Une fois par mois", "Quelques fois par mois", "Une fois par semaine", "Quelques fois par semaine", "Chaque jour"],
    D: ["Pas du tout d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "Tout à fait d'accord"],
    E1: ["Oui, presque toujours", "Parfois", "Rarement ou jamais"],
    E2: ["Non, pas de changement", "Légèrement", "Oui, nettement"],
    E3: ["Non", "Oui, mais je le gère bien", "Oui, cela m'affecte fortement"],
  };
  /* value offset : l'échelle D va de 1 à 5, les autres commencent à 0. */
  const SECTIONS = [
    { key: "A", titre: "Bien-être général", consigne: "Au cours des deux dernières semaines…", scale: "A", offset: 0, items: [
      "Je me suis senti(e) de bonne humeur et joyeux(se)",
      "Je me suis senti(e) calme et détendu(e)",
      "Je me suis senti(e) actif(ve) et plein(e) d'énergie",
      "Je me suis réveillé(e) reposé(e) et prêt(e) pour la journée",
      "Ma vie quotidienne a été remplie de choses qui m'intéressent",
    ] },
    { key: "B", titre: "Stress perçu", consigne: "Au cours du dernier mois, à quelle fréquence…", scale: "B", offset: 0, items: [
      "Vous avez été incapable de contrôler les choses importantes dans votre vie",
      "Vous vous êtes senti(e) confiant(e) dans votre capacité à gérer vos problèmes",
      "Vous avez eu l'impression que les choses allaient dans le bon sens pour vous",
      "Les difficultés ont tellement pesé que vous ne pouviez plus y faire face",
    ] },
    { key: "C", titre: "Épuisement", consigne: "À quelle fréquence ressentez-vous ceci ?", scale: "C", offset: 0, items: [
      "Je me sens vidé(e) émotionnellement par mon travail",
      "Je me sens épuisé(e) en fin de journée de travail",
      "Le matin, je me sens fatigué(e) à l'idée d'aller travailler",
      "Mon travail me demande un effort qui me pèse de plus en plus",
      "J'ai l'impression d'être à bout",
    ] },
    { key: "D", titre: "Vécu au travail", consigne: "Êtes-vous d'accord avec ces affirmations ?", scale: "D", offset: 1, items: [
      "Ma charge de travail quotidienne est raisonnable et gérable",
      "Je me sens soutenu(e) par mon responsable quand j'en ai besoin",
      "Mon travail est reconnu à sa juste valeur",
      "Je trouve du sens dans ce que je fais au quotidien",
      "Les relations avec mes collègues sont globalement satisfaisantes",
    ] },
    { key: "E", titre: "Signaux d'alerte", consigne: "Pour finir, trois questions sur votre situation actuelle.", scale: null, offset: 0, items: [
      { text: "Dormez-vous suffisamment et vous sentez-vous reposé(e) au réveil la plupart du temps ?", scale: "E1" },
      { text: "Avez-vous augmenté votre consommation de substances pour tenir (café, alcool, tabac, médicaments) ?", scale: "E2" },
      { text: "Traversez-vous actuellement un évènement de vie difficile (deuil, séparation, maladie, difficultés financières) ?", scale: "E3" },
    ] },
  ];
  const N_ITEMS = 22;
  const DIMS = [
    { key: "A", label: "Bien-être", source: "WHO-5", positive: true },
    { key: "B", label: "Stress perçu", source: "PSS-4", positive: false },
    { key: "C", label: "Épuisement", source: "MBI-EE", positive: false },
    { key: "D", label: "Vécu au travail", source: "QVT-5", positive: true },
    { key: "E", label: "Signaux d'alerte", source: "", positive: false },
  ];

  const norm = (raw, min, max) => Math.max(0, Math.min(100, ((raw - min) / (max - min)) * 100));
  const zA = (s) => (s >= 68 ? "VERT" : s >= 51 ? "ORANGE" : "ROUGE");
  const zB = (t) => (t <= 7 ? "VERT" : t <= 11 ? "ORANGE" : "ROUGE");
  const zC = (t) => (t <= 8 ? "VERT" : t <= 14 ? "ORANGE" : "ROUGE");
  const zD = (t) => (t >= 20 ? "VERT" : t >= 13 ? "ORANGE" : "ROUGE");
  const PTS = { VERT: 0, ORANGE: 1, ROUGE: 2 };

  /** Score BSPA complet à partir des 22 réponses (bornes : A 0-5, B 0-4, C 0-6, D 1-5, E 0-2). */
  function scoreBspa(r) {
    if (!Array.isArray(r) || r.length !== N_ITEMS) { throw new Error("22 réponses attendues"); }
    const a = r.slice(0, 5), b = r.slice(5, 9), c = r.slice(9, 14), d = r.slice(14, 19), e = r.slice(19, 22);
    const sum = (x) => x.reduce((s, v) => s + v, 0);
    const aBrut = sum(a), a100 = norm(aBrut, 0, 25);
    const bTot = b[0] + (4 - b[1]) + (4 - b[2]) + b[3];
    const cTot = sum(c), dTot = sum(d), eTot = sum(e);
    const signalFort = e.some((v) => v === 2) || eTot >= 4;
    const dims = {
      A: { brut: aBrut, s100: a100, zone: zA(a100), echelle: "0-25" },
      B: { brut: bTot, s100: norm(bTot, 0, 16), zone: zB(bTot), echelle: "0-16" },
      C: { brut: cTot, s100: norm(cTot, 0, 30), zone: zC(cTot), echelle: "0-30" },
      D: { brut: dTot, s100: norm(dTot, 5, 25), zone: zD(dTot), echelle: "5-25" },
      E: { brut: eTot, s100: norm(eTot, 0, 6), zone: signalFort ? "ROUGE" : eTot <= 1 ? "VERT" : "ORANGE", echelle: "0-6" },
    };
    const ptsE = signalFort ? 2 : dims.E.zone === "ORANGE" ? 1 : 0;
    const scoreGlobal = PTS[dims.A.zone] + PTS[dims.B.zone] + PTS[dims.C.zone] + PTS[dims.D.zone] + ptsE;
    const nRouges = ["A", "B", "C", "D"].filter((k) => dims[k].zone === "ROUGE").length;
    let profil;
    if (scoreGlobal >= 6 || nRouges >= 2 || (signalFort && nRouges >= 1)) { profil = "ROUGE"; }
    else if (signalFort || scoreGlobal >= 3 || nRouges === 1) { profil = "ORANGE"; }
    else { profil = "VERT"; }
    return { profil, scoreGlobal, nRouges, signalFort, dims };
  }

  /* ================= IMC ================= */
  function imc(poidsKg, tailleCm) {
    if (!(poidsKg > 0) || !(tailleCm > 0)) { return null; }
    const m = tailleCm / 100;
    return Math.round((poidsKg / (m * m)) * 10) / 10;
  }
  function imcCategorie(v) { return v == null ? null : T.imc.find((c) => v >= c.min && v < c.max); }
  function imcMessage(v) { return v == null ? "" : T.imcMessages.find((m) => v < m.max).message; }
  function imcGroupe(v) {
    if (v == null) { return null; }
    if (v < 18.5) { return "Insuffisance pondérale"; }
    if (v < 25) { return "Corpulence normale"; }
    if (v < 30) { return "Surpoids"; }
    return "Obésité";
  }

  /* ================= Questionnaire général ================= */
  const OPTIONS = {
    genre: ["Femme", "Homme", "Non précisé"],
    age: ["18-25 ans", "26-35 ans", "36-45 ans", "46-55 ans", "56 ans et plus"],
    anciennete: ["Moins d'1 an", "1 à 5 ans", "6 à 10 ans", "Plus de 10 ans"],
    antecedents: ["Maladie chronique", "Trouble psychique", "Handicap physique", "Handicap psychique"],
  };
  /* Groupes du tableau de bord (§ 6.3 « Répartition par groupe » + éléments ajoutés). */
  const GROUPS = [
    { key: "genre", label: "Genre", values: OPTIONS.genre, get: (r) => [r.genre], defaut: true },
    { key: "age", label: "Tranche d'âge", values: OPTIONS.age, get: (r) => [r.age], defaut: true },
    { key: "ancEnt", label: "Ancienneté dans l'entreprise", values: OPTIONS.anciennete, get: (r) => [r.ancEnt], defaut: true },
    { key: "ancPoste", label: "Ancienneté au poste", values: OPTIONS.anciennete, get: (r) => [r.ancPoste] },
    { key: "imc", label: "Corpulence (IMC)", values: ["Insuffisance pondérale", "Corpulence normale", "Surpoids", "Obésité"], get: (r) => [imcGroupe(imc(r.poids, r.taille))] },
    { key: "antecedents", label: "Antécédents médicaux", values: ["Aucun", ...OPTIONS.antecedents], get: (r) => (r.antecedents.length ? r.antecedents : ["Aucun"]), multi: true },
  ];
  const SEUIL_ANONYMAT = 5;

  /* ================= Utilitaires ================= */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const day = (iso) => Date.parse(iso + "T00:00:00Z");
  const days = (ms) => Math.floor(ms / D);
  const pad = (n) => String(n).padStart(2, "0");
  function fmtDate(ts) { if (ts == null) { return "—"; } const d = new Date(ts); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; }
  function fmtDateTime(ts) { if (ts == null) { return "—"; } const d = new Date(ts); return `${fmtDate(ts)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
  function isoDate(ts) { const d = new Date(ts); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  const domainOf = (email) => String(email || "").trim().toLowerCase().split("@")[1] || "";
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  const isPhone = (s) => String(s || "").replace(/[\s.+-]/g, "").replace(/^225/, "").length === 10 && /^[\d\s.+-]+$/.test(String(s));

  /* ================= Couleurs du thème client ================= */
  function hexToRgb(hex) { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); }
  function rgbToHex(rgb) { return "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
  function luminance(hex) { return hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
  function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
  function darken(hex, f) { return rgbToHex(hexToRgb(hex).map((v) => v * (1 - f))); }
  /** Thème client : texte sur fond couleur (blanc ou bleu nuit) et variante assez foncée pour du texte sur blanc. */
  function theme(hex) {
    const primary = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#296DA8";
    const onPrimary = contrast(primary, "#ffffff") >= 4.5 ? "#ffffff" : "#002C4C";
    let ink = primary, f = 0;
    while (contrast(ink, "#ffffff") < 4.5 && f < 1) { f += 0.05; ink = darken(primary, f); }
    return { primary, onPrimary, ink, soft: rgbToHex(hexToRgb(primary).map((v) => v + (255 - v) * 0.88)) };
  }

  /* ================= Accès aux données ================= */
  const byId = (list, id) => list.find((x) => x.id === id);
  const clientOf = (db, x) => byId(db.clients, x.clientId);
  const campaignOf = (db, x) => byId(db.campaigns, x.campaignId);
  const unitOf = (db, clientId, unitId) => (byId(db.clients, clientId)?.units || []).find((u) => u.id === unitId);

  function campaignStatus(c, now) {
    if (now < day(c.start)) { return "A_VENIR"; }
    if (now >= day(c.end) + D) { return "TERMINEE"; }
    return "EN_COURS";
  }
  const CAMPAIGN_STATUS = { A_VENIR: "À venir", EN_COURS: "En cours", TERMINEE: "Terminée" };

  /** Effectif enregistré à la date de lancement de la campagne (décision 11). */
  function effectifAt(client, ts) {
    const list = client.effectifs.filter((e) => day(e.date) <= ts).sort((a, b) => day(a.date) - day(b.date));
    return list.length ? list[list.length - 1].valeur : null;
  }

  /* ================= Prise en charge, délai, suivi ================= */
  function deadlineOf(db, r) { return clientOf(db, r).type === "M" ? r.completedAt + r.delayDays * D : null; }
  function effectiveDecision(r, now) {
    const list = r.decisions.filter((d) => d.at <= now && !(d.revokedAt != null && d.revokedAt <= now));
    return list.length ? list[list.length - 1] : null;
  }
  /**
   * État de prise en charge d'un bilan (CdC § 5.3).
   * NONE | PENDING (orange sans décision) | PROVISIONAL (Mutuelle, décision pendant le délai)
   * | SCHEDULED (Mutuelle, rouge pendant le délai) | ACTIVE (en cours) | CLOSED (close).
   */
  function careState(db, r, now) {
    const type = clientOf(db, r).type;
    const p = r.result.profil;
    if (p === "VERT") { return { state: "NONE", reason: "VERT" }; }
    let start;
    if (type === "E") {
      if (p === "ROUGE") { start = r.completedAt; }
      else {
        const d = effectiveDecision(r, now);
        if (!d) { return { state: "PENDING", waitingDays: days(now - r.completedAt) }; }
        if (!d.value) { return { state: "NONE", reason: "REFUS", decidedAt: d.at, decision: d }; }
        start = d.at;
      }
    } else {
      const dl = deadlineOf(db, r);
      const remainingDays = Math.ceil((dl - now) / D);
      if (p === "ROUGE") {
        if (now < dl) { return { state: "SCHEDULED", deadline: dl, remainingDays }; }
        start = dl;
      } else {
        const d = effectiveDecision(r, now);
        if (now < dl) { return d ? { state: "PROVISIONAL", decision: d, deadline: dl, remainingDays } : { state: "PENDING", deadline: dl, remainingDays }; }
        if (!d) { return { state: "PENDING", deadline: dl, overdueDays: days(now - dl) }; }
        const applied = Math.max(d.at, dl);
        if (!d.value) { return { state: "NONE", reason: "REFUS", decidedAt: applied, decision: d }; }
        start = applied;
      }
    }
    if (r.care.closedAt != null && r.care.closedAt <= now) { return { state: "CLOSED", since: start, closedAt: r.care.closedAt }; }
    return { state: "ACTIVE", since: start };
  }
  function careLabel(db, r, now) {
    const s = careState(db, r, now);
    switch (s.state) {
      case "NONE": return s.reason === "REFUS" ? "Non retenue" : "Sans objet";
      case "PENDING": return s.overdueDays != null ? `En attente · délai dépassé de ${s.overdueDays} j` : s.deadline ? `En attente · délai : reste ${s.remainingDays} j` : `En attente depuis ${s.waitingDays} j`;
      case "PROVISIONAL": return `Décision ${s.decision.value ? "« Oui »" : "« Non »"} · applicable dans ${s.remainingDays} j`;
      case "SCHEDULED": return `Automatique dans ${s.remainingDays} j`;
      case "ACTIVE": return "En cours";
      case "CLOSED": return "Close";
      default: return "";
    }
  }
  function waitLabel(db, r, now) {
    const s = careState(db, r, now);
    if (s.overdueDays != null) { return `délai dépassé de ${s.overdueDays} jour${s.overdueDays > 1 ? "s" : ""}`; }
    if (s.deadline) { return `délai : reste ${s.remainingDays} jour${s.remainingDays > 1 ? "s" : ""}`; }
    return `en attente depuis ${s.waitingDays} jour${s.waitingDays > 1 ? "s" : ""}`;
  }
  /** Statut de suivi (entretien) : indépendant de la prise en charge (décision 20). */
  function followUpState(r, now) { return r.followUp.closedAt != null && r.followUp.closedAt <= now ? "CLOS" : "A_APPELER"; }
  const FOLLOW = { A_APPELER: "À appeler", CLOS: "Clos" };

  /* ================= Droits par rôle ================= */
  const SCREENS = {
    ADMIN_YODAN: ["clients", "clientForm", "accounts", "campaigns", "campaignForm", "campaign", "participants", "detail", "validation", "care", "history"],
    SUP_PRINCIPAL: ["dashboard"],
    ADMIN_MUTUELLE: ["accounts", "delais", "history"],
    SUP_SECONDAIRE: ["dashboard", "validation", "detail"],
    VALIDATEUR: ["validation", "detail"],
  };
  const canAccess = (account, screen) => !!account && (SCREENS[account.role] || []).includes(screen);

  /** Accès à un résultat individuel (CdC § 7) : Admin Yodan ; cas orange de ses régions pour validateur / superviseur secondaire. */
  function canSeeResponse(db, account, r, now) {
    if (!account || !account.active) { return false; }
    if (account.role === "ADMIN_YODAN") { return true; }
    if (!["VALIDATEUR", "SUP_SECONDAIRE"].includes(account.role)) { return false; }
    if (account.clientId !== r.clientId || !account.units.includes(r.unitId) || r.result.profil !== "ORANGE") { return false; }
    const s = careState(db, r, now).state;
    return account.role === "VALIDATEUR" ? s === "PENDING" : s === "PENDING" || s === "PROVISIONAL";
  }

  /** File de validation (§ 6.4). */
  function validationQueue(db, account, now, f = {}) {
    if (!canAccess(account, "validation")) { return []; }
    return db.responses.filter((r) => {
      if (r.result.profil !== "ORANGE") { return false; }
      const c = clientOf(db, r);
      if (!c.active) { return false; }
      if (f.clientId && r.clientId !== f.clientId) { return false; }
      if (f.campaignId && r.campaignId !== f.campaignId) { return false; }
      const s = careState(db, r, now).state;
      if (account.role === "ADMIN_YODAN") { return c.type === "E" && s === "PENDING"; }
      return canSeeResponse(db, account, r, now);
    }).sort((a, b) => a.completedAt - b.completedAt);
  }

  /* ================= Journal ================= */
  function addLog(db, entry) {
    db.seq.log += 1;
    const e = { id: "L" + db.seq.log, at: entry.at, actorId: entry.actorId, clientId: entry.clientId || null, onBehalf: !!entry.onBehalf, action: entry.action, target: entry.target || "" };
    db.log.push(e);
    return e;
  }
  /** Historique visible : tout pour l'Admin Yodan ; actions concernant sa mutuelle pour l'Administrateur. */
  function historyFor(db, account, f = {}) {
    let list = db.log.slice();
    if (account.role === "ADMIN_MUTUELLE") { list = list.filter((e) => e.clientId === account.clientId); }
    else if (account.role !== "ADMIN_YODAN") { return []; }
    if (f.actorId) { list = list.filter((e) => e.actorId === f.actorId); }
    if (f.from) { list = list.filter((e) => e.at >= day(f.from)); }
    if (f.to) { list = list.filter((e) => e.at < day(f.to) + D); }
    return list.sort((a, b) => b.at - a.at);
  }

  /* ================= Actions (avec contrôles) ================= */
  function fail(msg) { const e = new Error(msg); e.business = true; throw e; }

  function decide(db, account, responseId, value, now) {
    const r = byId(db.responses, responseId);
    if (!r || r.result.profil !== "ORANGE") { fail("Seuls les cas orange se décident."); }
    const c = clientOf(db, r);
    const s = careState(db, r, now);
    if (account.role === "ADMIN_YODAN") {
      if (c.type !== "E") { fail("Pour une Mutuelle, la décision revient au validateur de la région."); }
      if (s.state !== "PENDING") { fail("Ce cas est déjà décidé."); }
    } else if (account.role === "VALIDATEUR") {
      if (!canSeeResponse(db, account, r, now)) { fail("Ce cas n'est pas dans vos régions ou n'est plus en attente."); }
    } else if (account.role === "SUP_SECONDAIRE") {
      if (!canSeeResponse(db, account, r, now)) { fail("Ce cas n'est pas dans vos régions ou n'est plus modifiable."); }
      if (s.state === "PROVISIONAL") { s.decision.revokedAt = now; s.decision.revokedBy = account.id; }
    } else { fail("Action non autorisée pour ce rôle."); }
    db.seq.dec += 1;
    r.decisions.push({ id: "DEC" + db.seq.dec, by: account.id, role: account.role, value: !!value, at: now, revokedAt: null, revokedBy: null });
    addLog(db, { at: now, actorId: account.id, clientId: r.clientId, action: s.state === "PROVISIONAL" ? "Décision prise à la place du validateur" : "Décision de prise en charge enregistrée", target: r.pseudo });
    return careState(db, r, now);
  }

  function revoke(db, account, responseId, now) {
    const r = byId(db.responses, responseId);
    if (!r) { fail("Cas introuvable."); }
    if (account.role !== "SUP_SECONDAIRE" || !canSeeResponse(db, account, r, now)) { fail("Seul le superviseur secondaire de la région peut annuler une décision."); }
    const s = careState(db, r, now);
    if (s.state !== "PROVISIONAL") { fail("Aucune décision annulable : le délai est écoulé ou le cas est en attente."); }
    s.decision.revokedAt = now; s.decision.revokedBy = account.id;
    addLog(db, { at: now, actorId: account.id, clientId: r.clientId, action: "Décision annulée (révocation)", target: r.pseudo });
    return careState(db, r, now);
  }

  function closeCare(db, account, responseId, now) {
    const r = byId(db.responses, responseId);
    if (account.role !== "ADMIN_YODAN") { fail("Réservé à l'Admin Yodan."); }
    if (careState(db, r, now).state !== "ACTIVE") { fail("Seule une prise en charge en cours peut être close."); }
    r.care.closedAt = now; r.care.closedBy = account.id;
    addLog(db, { at: now, actorId: account.id, clientId: r.clientId, action: "Prise en charge passée à clos", target: r.pseudo });
  }

  function closeFollowUp(db, account, responseId, now) {
    const r = byId(db.responses, responseId);
    if (account.role !== "ADMIN_YODAN") { fail("Réservé à l'Admin Yodan."); }
    if (followUpState(r, now) === "CLOS") { fail("Entretien déjà clos."); }
    r.followUp.closedAt = now; r.followUp.closedBy = account.id;
    addLog(db, { at: now, actorId: account.id, clientId: r.clientId, action: "Entretien passé à clos", target: r.pseudo });
  }

  function remind(db, account, inviteeId, now) {
    const i = byId(db.invitees, inviteeId);
    if (account.role !== "ADMIN_YODAN") { fail("Réservé à l'Admin Yodan."); }
    if (db.responses.some((r) => r.inviteeId === i.id && r.completedAt <= now)) { fail("Cette personne a déjà répondu."); }
    i.reminders.push(now);
    const k = campaignOf(db, i);
    addLog(db, { at: now, actorId: account.id, clientId: k.clientId, action: "Relance par e-mail", target: i.pseudo });
    return T.emails.relance(k.nom);
  }

  /* ---------- Comptes et règles d'affectation (§ 3.2) ---------- */
  function coverage(db, clientId) {
    const c = byId(db.clients, clientId);
    const act = db.accounts.filter((a) => a.clientId === clientId && a.active);
    return c.units.map((u) => ({
      unit: u,
      validateurs: act.filter((a) => a.role === "VALIDATEUR" && a.units.includes(u.id)),
      secondaires: act.filter((a) => a.role === "SUP_SECONDAIRE" && a.units.includes(u.id)),
    }));
  }

  /** Erreurs bloquantes pour créer/modifier un compte (draft.id absent = création). */
  function accountErrors(db, actor, draft) {
    const errors = [];
    const c = byId(db.clients, draft.clientId);
    if (!c) { return ["Client introuvable."]; }
    if (actor.role === "ADMIN_MUTUELLE" && (actor.clientId !== c.id || draft.role === "ADMIN_MUTUELLE")) { errors.push("L'Administrateur crée les superviseurs et validateurs de sa mutuelle uniquement."); }
    if (!["ADMIN_YODAN", "ADMIN_MUTUELLE"].includes(actor.role)) { errors.push("Action non autorisée pour ce rôle."); }
    if (!String(draft.nom || "").trim()) { errors.push("Le nom est obligatoire."); }
    if (!isEmail(draft.email)) { errors.push("E-mail invalide."); }
    if (db.accounts.some((a) => a.id !== draft.id && a.email.toLowerCase() === String(draft.email).trim().toLowerCase())) { errors.push("Cet e-mail est déjà utilisé par un autre compte."); }
    if (!ROLES_BY_TYPE[c.type].includes(draft.role)) { errors.push(`Rôle « ${ROLES[draft.role] || draft.role} » indisponible pour ce type de client.`); }
    const others = db.accounts.filter((a) => a.clientId === c.id && a.active && a.id !== draft.id);
    if (draft.active !== false) {
      if (draft.role === "SUP_PRINCIPAL" && others.some((a) => a.role === "SUP_PRINCIPAL")) { errors.push("Un seul superviseur principal par client : désactivez d'abord l'actuel."); }
      if (draft.role === "ADMIN_MUTUELLE" && others.some((a) => a.role === "ADMIN_MUTUELLE")) { errors.push("Un seul Administrateur actif par mutuelle."); }
      if (["VALIDATEUR", "SUP_SECONDAIRE"].includes(draft.role)) {
        if (!draft.units || !draft.units.length) { errors.push("Attribuez au moins une région."); }
        (draft.units || []).forEach((uid) => {
          const taken = others.find((a) => a.role === draft.role && a.units.includes(uid));
          if (taken) { errors.push(`${unitOf(db, c.id, uid).nom} a déjà un ${ROLES[draft.role].toLowerCase()} (${taken.nom}).`); }
        });
      }
    }
    return errors;
  }

  function saveAccount(db, actor, draft, now) {
    const errors = accountErrors(db, actor, draft);
    if (errors.length) { const e = new Error(errors.join(" ")); e.business = true; e.list = errors; throw e; }
    const onBehalf = actor.role === "ADMIN_YODAN";
    const units = ["VALIDATEUR", "SUP_SECONDAIRE"].includes(draft.role) ? draft.units.slice() : [];
    let a;
    if (draft.id) {
      a = byId(db.accounts, draft.id);
      Object.assign(a, { nom: draft.nom.trim(), email: draft.email.trim().toLowerCase(), role: draft.role, units });
      addLog(db, { at: now, actorId: actor.id, clientId: a.clientId, onBehalf, action: "Modification de compte (rôle / régions)", target: a.email });
    } else {
      db.seq.acc += 1;
      a = { id: "U" + db.seq.acc, clientId: draft.clientId, nom: draft.nom.trim(), email: draft.email.trim().toLowerCase(), role: draft.role, units, active: true, mustChange: true, lastLogin: null, createdAt: now };
      db.accounts.push(a);
      addLog(db, { at: now, actorId: actor.id, clientId: a.clientId, onBehalf, action: `Création de compte (${ROLES[a.role]})`, target: a.email });
    }
    return a;
  }

  function setAccountActive(db, actor, accountId, active, now) {
    const a = byId(db.accounts, accountId);
    if (active) {
      const errors = accountErrors(db, actor, { ...a, active: true });
      if (errors.length) { fail(errors.join(" ")); }
    } else if (actor.role === "ADMIN_MUTUELLE" && (a.clientId !== actor.clientId || a.role === "ADMIN_MUTUELLE")) { fail("Action non autorisée."); }
    a.active = active;
    addLog(db, { at: now, actorId: actor.id, clientId: a.clientId, onBehalf: actor.role === "ADMIN_YODAN", action: active ? "Réactivation de compte" : "Désactivation de compte", target: a.email });
  }

  function resendPassword(db, actor, accountId, now) {
    const a = byId(db.accounts, accountId);
    a.mustChange = true;
    addLog(db, { at: now, actorId: actor.id, clientId: a.clientId, onBehalf: actor.role === "ADMIN_YODAN", action: "Renvoi du mot de passe temporaire", target: a.email });
    return T.emails.motDePasseTemporaire();
  }

  function setDelay(db, actor, clientId, unitId, value, now) {
    const c = byId(db.clients, clientId);
    if (c.type !== "M") { fail("Le délai ne concerne que les Mutuelles."); }
    if (!(actor.role === "ADMIN_YODAN" || (actor.role === "ADMIN_MUTUELLE" && actor.clientId === clientId))) { fail("Action non autorisée."); }
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1 || v > 60) { fail("Le délai doit être un nombre entier de jours entre 1 et 60."); }
    const u = unitOf(db, clientId, unitId);
    u.delayDays = v;
    addLog(db, { at: now, actorId: actor.id, clientId, onBehalf: actor.role === "ADMIN_YODAN", action: `Réglage du délai de prise en charge (${v} j)`, target: u.nom });
  }

  /* ---------- Clients ---------- */
  function clientErrors(db, draft) {
    const e = [];
    if (!String(draft.nom || "").trim()) { e.push("Le nom est obligatoire."); }
    if (draft.emailPro && !isEmail(draft.emailPro)) { e.push("E-mail professionnel invalide."); }
    if (!(Number(draft.effectif) > 0)) { e.push("L'effectif doit être un nombre positif."); }
    if (!SECTEURS.some(([k]) => k === draft.secteur)) { e.push("Choisissez un secteur d'activité."); }
    if (!["E", "M"].includes(draft.type)) { e.push("Choisissez le type de client."); }
    if (!draft.tests || !draft.tests.length) { e.push("Cochez au moins un test."); }
    const units = (draft.units || []).map((u) => u.trim()).filter(Boolean);
    if (!units.length) { e.push(`Saisissez au moins une ${draft.type === "M" ? "région" : "direction"}.`); }
    if (new Set(units.map((u) => u.toLowerCase())).size !== units.length) { e.push("Une direction/région est en double."); }
    if (!draft.id) {
      if (!String(draft.compteNom || "").trim()) { e.push("Le nom du compte principal est obligatoire."); }
      if (!isEmail(draft.compteEmail)) { e.push("E-mail du compte principal invalide."); }
      else if (db.accounts.some((a) => a.email === draft.compteEmail.trim().toLowerCase())) { e.push("L'e-mail du compte principal est déjà utilisé."); }
    }
    if (draft.logo && draft.logoSize > 2 * 1024 * 1024) { e.push("Le logo dépasse 2 Mo."); }
    return e;
  }

  /* ---------- Parcours participant ---------- */
  function checkParticipantAccess(db, campaign, email, now) {
    const c = byId(db.clients, campaign.clientId);
    if (!c.active) { return { ok: false, reason: "Cette campagne n'est plus disponible." }; }
    const st = campaignStatus(campaign, now);
    if (st === "A_VENIR") { return { ok: false, reason: `Cette campagne ouvrira le ${fmtDate(day(campaign.start))}.` }; }
    if (st === "TERMINEE") { return { ok: false, reason: "Cette campagne est terminée." }; }
    if (!isEmail(email)) { return { ok: false, reason: "Saisissez une adresse e-mail valide." }; }
    if (c.emailPro && domainOf(email) !== domainOf(c.emailPro)) { return { ok: false, reason: `Utilisez votre adresse professionnelle (@${domainOf(c.emailPro)}).` }; }
    const e = email.trim().toLowerCase();
    if (db.responses.some((r) => r.campaignId === campaign.id && r.email === e)) { return { ok: false, reason: "Cette adresse a déjà répondu à cette campagne. Une seule réponse est possible." }; }
    return { ok: true };
  }

  function profileErrors(db, campaign, p) {
    const e = [];
    const c = byId(db.clients, campaign.clientId);
    if (!p.consentDonnees || !p.consentContact) { e.push("Les deux consentements sont nécessaires pour commencer."); }
    if (!String(p.nom || "").trim() || !String(p.prenom || "").trim()) { e.push("Nom et prénom obligatoires."); }
    if (!isPhone(p.tel)) { e.push("Téléphone obligatoire (10 chiffres)."); }
    if (!c.units.some((u) => u.id === p.unitId)) { e.push(`Choisissez votre ${UNIT_WORD[c.type].one}.`); }
    if (!OPTIONS.genre.includes(p.genre)) { e.push("Genre obligatoire."); }
    if (!OPTIONS.age.includes(p.age)) { e.push("Tranche d'âge obligatoire."); }
    if (!OPTIONS.anciennete.includes(p.ancEnt)) { e.push("Ancienneté dans l'entreprise obligatoire."); }
    if (!OPTIONS.anciennete.includes(p.ancPoste)) { e.push("Ancienneté au poste obligatoire."); }
    if (!(p.poids >= 30 && p.poids <= 250)) { e.push("Poids entre 30 et 250 kg."); }
    if (!(p.taille >= 120 && p.taille <= 230)) { e.push("Taille entre 120 et 230 cm."); }
    if (!Array.isArray(p.antecedents) || (p.aucunAntecedent && p.antecedents.length) || (!p.aucunAntecedent && !p.antecedents.length)) { e.push("Antécédents médicaux : cochez « Aucun » ou au moins un élément."); }
    return e;
  }

  function submitResponse(db, campaignId, data, now) {
    const k = byId(db.campaigns, campaignId);
    const access = checkParticipantAccess(db, k, data.email, now);
    if (!access.ok) { fail(access.reason); }
    const errs = profileErrors(db, k, data);
    if (errs.length) { fail(errs.join(" ")); }
    const answers = data.answers;
    if (!Array.isArray(answers) || answers.length !== N_ITEMS || answers.some((v) => !Number.isInteger(v))) { fail("Le test est incomplet."); }
    const email = data.email.trim().toLowerCase();
    const inv = db.invitees.find((i) => i.campaignId === k.id && i.email === email);
    db.seq.resp += 1;
    const c = byId(db.clients, k.clientId);
    const r = {
      id: "R" + db.seq.resp, pseudo: inv ? inv.pseudo : newPseudo(db, Math.random), campaignId: k.id, clientId: k.clientId, inviteeId: inv ? inv.id : null,
      email, nom: data.nom.trim(), prenom: data.prenom.trim(), tel: data.tel.trim(), unitId: data.unitId,
      genre: data.genre, age: data.age, ancEnt: data.ancEnt, ancPoste: data.ancPoste, poids: Number(data.poids), taille: Number(data.taille), antecedents: data.antecedents.slice(),
      consentAt: data.consentAt || now, consentVersion: T.consentement.version, completedAt: now, answers: answers.slice(), result: scoreBspa(answers),
      delayDays: c.type === "M" ? unitOf(db, c.id, data.unitId).delayDays : null,
      decisions: [], followUp: { closedAt: null, closedBy: null }, care: { closedAt: null, closedBy: null }, resultSentAt: null,
    };
    db.responses.push(r);
    addLog(db, { at: now, actorId: null, clientId: k.clientId, action: "Bilan terminé (participant)", target: r.pseudo });
    return r;
  }

  const PSEUDO_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function newPseudo(db, rnd) {
    for (;;) {
      let s = "P-";
      for (let i = 0; i < 5; i++) { s += PSEUDO_CHARS[Math.floor(rnd() * PSEUDO_CHARS.length)]; }
      if (!db.invitees.some((x) => x.pseudo === s) && !db.responses.some((x) => x.pseudo === s)) { return s; }
    }
  }

  /* ---------- Import de la liste d'une campagne ---------- */
  /** Lignes « nom;prénom;e-mail;téléphone;direction/région » (séparateur ; ou , ou tabulation). */
  function parseInviteeList(db, clientId, text) {
    const c = byId(db.clients, clientId);
    const rows = [], errors = [];
    const seen = new Set();
    String(text || "").split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) { return; }
      const cols = line.split(/[;\t,]/).map((s) => s.trim());
      if (i === 0 && /nom/i.test(cols[0]) && /mail/i.test(line)) { return; }
      const [nom, prenom, email, tel, unite] = cols;
      const n = i + 1;
      if (!nom || !prenom) { errors.push(`Ligne ${n} : nom et prénom obligatoires.`); return; }
      if (!isEmail(email)) { errors.push(`Ligne ${n} : e-mail invalide.`); return; }
      if (c.emailPro && domainOf(email) !== domainOf(c.emailPro)) { errors.push(`Ligne ${n} : l'e-mail n'est pas en @${domainOf(c.emailPro)}.`); return; }
      if (!isPhone(tel)) { errors.push(`Ligne ${n} : téléphone obligatoire (10 chiffres).`); return; }
      const u = c.units.find((x) => x.nom.toLowerCase() === String(unite || "").toLowerCase());
      if (!u) { errors.push(`Ligne ${n} : ${UNIT_WORD[c.type].one} « ${unite || ""} » inconnue.`); return; }
      const e = email.toLowerCase();
      if (seen.has(e)) { errors.push(`Ligne ${n} : e-mail en double.`); return; }
      seen.add(e);
      rows.push({ nom, prenom, email: e, tel, unitId: u.id });
    });
    return { rows, errors };
  }

  function createCampaign(db, actor, draft, now) {
    const errs = [];
    const c = byId(db.clients, draft.clientId);
    if (!String(draft.nom || "").trim()) { errs.push("Le nom est obligatoire."); }
    if (!c.tests.includes(draft.test)) { errs.push("Choisissez un test activé pour ce client."); }
    if (!draft.start || !draft.end || day(draft.end) < day(draft.start)) { errs.push("La date de fin doit suivre la date de début."); }
    const parsed = parseInviteeList(db, c.id, draft.liste);
    if (!parsed.rows.length) { errs.push("La liste des personnes à évaluer est vide."); }
    if (parsed.errors.length) { errs.push(...parsed.errors); }
    if (errs.length) { const e = new Error(errs.join(" ")); e.business = true; e.list = errs; throw e; }
    db.seq.camp += 1;
    const k = { id: "K" + db.seq.camp, clientId: c.id, nom: draft.nom.trim(), test: draft.test, start: draft.start, end: draft.end, token: token(Math.random), createdAt: now };
    db.campaigns.push(k);
    parsed.rows.forEach((row) => {
      db.seq.inv += 1;
      db.invitees.push({ id: "I" + db.seq.inv, pseudo: newPseudo(db, Math.random), campaignId: k.id, ...row, reminders: [] });
    });
    addLog(db, { at: now, actorId: actor.id, clientId: c.id, action: `Création de campagne (${parsed.rows.length} personnes importées)`, target: k.nom });
    return k;
  }
  function token(rnd) { const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 12; i++) { s += a[Math.floor(rnd() * a.length)]; } return s; }
  const campaignLink = (k) => `https://evaluation.exemple.test/c/${k.token}`;

  /* ================= Tableau de bord (agrégats) ================= */
  /** Périmètre de régions d'un compte pour un client. */
  function allowedUnits(db, account, clientId) {
    const c = byId(db.clients, clientId);
    if (account.role === "SUP_SECONDAIRE") { return c.units.filter((u) => account.units.includes(u.id)).map((u) => u.id); }
    return c.units.map((u) => u.id);
  }
  function dashboardClientId(account, f) { return account.role === "ADMIN_YODAN" ? f.clientId : account.clientId; }
  function canSeeDashboard(account) { return ["ADMIN_YODAN", "SUP_PRINCIPAL", "SUP_SECONDAIRE"].includes(account?.role); }

  function scopedResponses(db, account, f, now) {
    const clientId = dashboardClientId(account, f);
    const units = allowedUnits(db, account, clientId);
    return db.responses.filter((r) => r.clientId === clientId && r.completedAt <= now && units.includes(r.unitId)
      && (!f.unitId || r.unitId === f.unitId) && (!f.campaignId || r.campaignId === f.campaignId)
      && (!f.popKey || GROUPS.find((g) => g.key === f.popKey).get(r).includes(f.popValue)));
  }

  function countZones(list) {
    const o = { total: list.length, VERT: 0, ORANGE: 0, ROUGE: 0 };
    list.forEach((r) => { o[r.result.profil] += 1; });
    return o;
  }

  /**
   * Agrégats du tableau de bord pour un compte. Ne renvoie AUCUNE donnée individuelle.
   * Seuil d'anonymat (< 5) appliqué à tous les rôles client, pas à l'Admin Yodan (CdC § 7).
   */
  function dashboard(db, account, f, now) {
    if (!canSeeDashboard(account)) { return null; }
    const clientId = dashboardClientId(account, f);
    const client = byId(db.clients, clientId);
    const threshold = account.role !== "ADMIN_YODAN";
    if (f.unitId && !allowedUnits(db, account, clientId).includes(f.unitId)) { return null; }
    const list = scopedResponses(db, account, f, now);
    const z = countZones(list);
    const masked = threshold && z.total < SEUIL_ANONYMAT;
    const units = allowedUnits(db, account, clientId);
    const camp = f.campaignId ? byId(db.campaigns, f.campaignId) : null;
    const invited = db.invitees.filter((i) => campaignOf(db, i).clientId === clientId && units.includes(i.unitId) && (!f.unitId || i.unitId === f.unitId) && (!f.campaignId || i.campaignId === f.campaignId));
    const participation = {
      effectif: camp && !f.unitId && account.role !== "SUP_SECONDAIRE" ? effectifAt(client, day(camp.start)) : null,
      selectionnes: invited.length,
      repondu: z.total,
      horsListe: list.filter((r) => !r.inviteeId).length,
    };
    participation.taux = participation.effectif ? Math.round((participation.repondu / participation.effectif) * 1000) / 10 : null;
    const out = { clientId, masked, threshold, participation, generatedAt: now };
    if (masked) { return out; }
    out.kpis = { bilans: z.total, VERT: z.VERT, ORANGE: z.ORANGE, ROUGE: z.ROUGE, signauxForts: list.filter((r) => r.result.signalFort).length };
    out.dims = DIMS.map((d) => ({ key: d.key, label: d.label, source: d.source, positive: d.positive, moyenne: list.length ? Math.round(list.reduce((s, r) => s + r.result.dims[d.key].s100, 0) / list.length) : 0 }));
    out.groups = GROUPS.map((g) => {
      const rows = g.values.map((v) => ({ label: v, ...countZones(list.filter((r) => g.get(r).includes(v))), masked: false }));
      if (threshold) {
        rows.forEach((row) => { row.masked = row.total > 0 && row.total < SEUIL_ANONYMAT; });
        /* Masquage complémentaire : une seule case masquée se retrouverait par soustraction du total. */
        if (!g.multi && rows.filter((x) => x.masked).length === 1) {
          const next = rows.filter((x) => !x.masked && x.total > 0).sort((a, b) => a.total - b.total)[0];
          if (next) { next.masked = true; }
        }
        rows.forEach((row) => { if (row.masked) { Object.assign(row, { total: null, VERT: null, ORANGE: null, ROUGE: null }); } });
      }
      return { key: g.key, label: g.label, multi: !!g.multi, rows };
    });
    out.comparison = db.campaigns.filter((k) => k.clientId === clientId).sort((a, b) => day(b.start) - day(a.start)).map((k) => {
      const l = scopedResponses(db, account, { ...f, campaignId: k.id }, now);
      const zz = countZones(l);
      const m = threshold && zz.total < SEUIL_ANONYMAT;
      return { campaignId: k.id, nom: k.nom, masked: m, bilans: m ? null : zz.total, VERT: m ? null : zz.VERT, ORANGE: m ? null : zz.ORANGE, ROUGE: m ? null : zz.ROUGE,
        bienEtre: m || !l.length ? null : Math.round(l.reduce((s, r) => s + r.result.dims.A.s100, 0) / l.length) };
    });
    return out;
  }

  function dashboardCsv(dash) {
    const L = [["Indicateur", "Valeur"]];
    const p = dash.participation;
    L.push(["Effectif à la date de la campagne", p.effectif ?? ""], ["Personnes sélectionnées", p.selectionnes], ["Personnes ayant répondu", p.repondu]);
    if (dash.masked) { L.push(["Statistiques", "Masquées (moins de 5 réponses)"]); return toCsv(L); }
    L.push(["Bilans terminés", dash.kpis.bilans], ["Satisfaisant", dash.kpis.VERT], ["Vigilance", dash.kpis.ORANGE], ["À prendre en charge", dash.kpis.ROUGE], ["Signaux d'alerte forts", dash.kpis.signauxForts]);
    dash.dims.forEach((d) => L.push([`${d.label} (moyenne sur 100)`, d.moyenne]));
    L.push([]); L.push(["Groupe", "Valeur", "Réponses", "Satisfaisant", "Vigilance", "À prendre en charge"]);
    dash.groups.forEach((g) => g.rows.forEach((r) => L.push(r.masked ? [g.label, r.label, "moins de 5", "", "", ""] : [g.label, r.label, r.total, r.VERT, r.ORANGE, r.ROUGE])));
    L.push([]); L.push(["Campagne", "Bilans", "Satisfaisant", "Vigilance", "À prendre en charge", "Bien-être moyen"]);
    dash.comparison.forEach((c) => L.push(c.masked ? [c.nom, "moins de 5", "", "", "", ""] : [c.nom, c.bilans, c.VERT, c.ORANGE, c.ROUGE, c.bienEtre ?? ""]));
    return toCsv(L);
  }
  function toCsv(rows) { return rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n"); }

  /* ================= Participants (Admin Yodan) ================= */
  function participantRows(db, account, campaignId, now) {
    if (account.role !== "ADMIN_YODAN") { return []; }
    const k = byId(db.campaigns, campaignId);
    const resp = db.responses.filter((r) => r.campaignId === campaignId && r.completedAt <= now);
    const rows = db.invitees.filter((i) => i.campaignId === campaignId).map((i) => {
      const r = resp.find((x) => x.inviteeId === i.id);
      return rowOf(db, k, i, r, now);
    });
    resp.filter((r) => !r.inviteeId).forEach((r) => rows.push(rowOf(db, k, null, r, now)));
    return rows;
  }
  function rowOf(db, k, i, r, now) {
    const src = r || i;
    const last = i && i.reminders.length ? Math.max(...i.reminders.filter((t) => t <= now), -Infinity) : null;
    return {
      key: (r ? r.id : i.id), inviteeId: i ? i.id : null, responseId: r ? r.id : null, pseudo: src.pseudo,
      nom: `${src.prenom} ${src.nom}`, email: src.email, tel: src.tel, unitId: src.unitId, horsListe: !i,
      statut: r ? ZONE[r.result.profil].statut : "Sans réponse", zone: r ? r.result.profil : null, scoreGlobal: r ? r.result.scoreGlobal : null,
      suivi: r ? followUpState(r, now) : null, lastReminder: Number.isFinite(last) ? last : null,
      care: r ? careState(db, r, now).state : null,
    };
  }
  /** Liste « À prendre en charge » : prise en charge confirmée (ACTIVE ou CLOSED). */
  function careRows(db, account, now, f = {}) {
    if (account.role !== "ADMIN_YODAN") { return []; }
    return db.responses.filter((r) => r.completedAt <= now && (!f.clientId || r.clientId === f.clientId) && (!f.campaignId || r.campaignId === f.campaignId))
      .map((r) => ({ r, s: careState(db, r, now) }))
      .filter(({ s }) => s.state === "ACTIVE" || s.state === "CLOSED")
      .map(({ r, s }) => ({ responseId: r.id, pseudo: r.pseudo, nom: `${r.prenom} ${r.nom}`, email: r.email, tel: r.tel, zone: r.result.profil, state: s.state, since: s.since, closedAt: s.closedAt || null, campaignId: r.campaignId, clientId: r.clientId }))
      .sort((a, b) => b.since - a.since);
  }

  /* ================= Données fictives ================= */
  const PRENOMS_F = ["Awa", "Aya", "Mariam", "Fatou", "Adjoua", "Akissi", "Bintou", "Nadia", "Esther", "Grâce", "Affoué", "Salimata", "Christelle", "Aminata", "Ruth"];
  const PRENOMS_H = ["Koffi", "Yao", "Kouamé", "Ibrahim", "Moussa", "Serge", "Didier", "Hervé", "Jean", "Paul", "Salif", "Amadou", "Fabrice", "Arsène", "Joël"];
  const NOMS = ["Kouassi", "Konan", "Traoré", "Koné", "Bamba", "Diallo", "N'Guessan", "Ouattara", "Coulibaly", "Touré", "Doumbia", "Aka", "Kra", "Yapi", "Brou", "Tano", "Assi", "Dosso", "Gnaoré", "Loukou"];
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();

  const LOGO_ALPHA = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 48"><rect width="48" height="48" rx="10" fill="#0F766E"/><path d="M12 36 24 10l12 26h-7l-5-12-5 12z" fill="#fff"/><text x="58" y="32" font-family="Arial" font-weight="700" font-size="20" fill="#0F766E">ALPHA</text></svg>');
  const LOGO_BETA = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 48"><circle cx="24" cy="24" r="22" fill="#6D28D9"/><path d="M15 25c5 7 13 7 18 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="18" cy="17" r="3" fill="#fff"/><circle cx="30" cy="17" r="3" fill="#fff"/><text x="56" y="31" font-family="Arial" font-weight="700" font-size="18" fill="#6D28D9">Mutuelle Beta</text></svg>');

  function generate(seed = 2026, now = Date.UTC(2026, 10, 21, 9, 0)) {
    const rnd = mulberry32(seed);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const between = (a, b) => a + rnd() * (b - a);
    const db = { clients: [], accounts: [], campaigns: [], invitees: [], responses: [], log: [], seq: { log: 0, dec: 0, acc: 0, camp: 0, inv: 0, resp: 0, client: 0 } };

    db.clients = [
      { id: "C1", nom: "Alpha Industries (fictif)", type: "E", emailPro: "rh@alpha.exemple.test", secteur: "C", tests: ["BSPA"], effectifs: [{ date: "2025-01-01", valeur: 420 }, { date: "2026-06-01", valeur: 450 }],
        units: [["D1", "Direction générale"], ["D2", "Production"], ["D3", "Logistique"], ["D4", "Commerciale"], ["D5", "Finances"]].map(([id, nom]) => ({ id, nom, delayDays: null })), theme: "#0F766E", logo: LOGO_ALPHA, active: true, createdAt: day("2025-09-01") },
      { id: "C2", nom: "Mutuelle Beta (fictive)", type: "M", emailPro: "", secteur: "K", tests: ["BSPA"], effectifs: [{ date: "2025-01-01", valeur: 1150 }, { date: "2026-09-01", valeur: 1240 }],
        units: [["R1", "Abidjan Nord", 7], ["R2", "Abidjan Sud", 5], ["R3", "Centre", 7], ["R4", "Nord", 7], ["R5", "Ouest", 10], ["R6", "Est", 7]].map(([id, nom, d]) => ({ id, nom, delayDays: d })), theme: "#6D28D9", logo: LOGO_BETA, active: true, createdAt: day("2025-08-15") },
      { id: "C3", nom: "Gamma Services (fictif)", type: "E", emailPro: "contact@gamma.exemple.test", secteur: "N", tests: ["BSPA"], effectifs: [{ date: "2026-10-01", valeur: 60 }],
        units: [["G1", "Siège"], ["G2", "Agences"]].map(([id, nom]) => ({ id, nom, delayDays: null })), theme: "", logo: "", active: true, createdAt: day("2026-11-10") },
      { id: "C4", nom: "Delta Transport (fictif)", type: "E", emailPro: "info@delta.exemple.test", secteur: "H", tests: ["BSPA"], effectifs: [{ date: "2026-01-01", valeur: 35 }],
        units: [["T1", "Exploitation"], ["T2", "Administration"]].map(([id, nom]) => ({ id, nom, delayDays: null })), theme: "#B45309", logo: "", active: false, createdAt: day("2026-01-15") },
    ];
    db.seq.client = 4;

    const acc = (clientId, nom, email, role, units = [], extra = {}) => {
      db.seq.acc += 1;
      const a = { id: "U" + db.seq.acc, clientId, nom, email, role, units, active: true, mustChange: false, lastLogin: now - between(1, 20) * D, createdAt: day("2025-09-01"), ...extra };
      db.accounts.push(a);
      return a;
    };
    const admin = acc(null, "Équipe Yodan", "admin@yodan.exemple.test", "ADMIN_YODAN", [], { lastLogin: now - 2 * H });
    acc("C1", "Mariam Koné", "mariam.kone@alpha.exemple.test", "SUP_PRINCIPAL");
    acc("C2", "Serge Aka", "admin.mutuelle@beta.exemple.test", "ADMIN_MUTUELLE");
    acc("C2", "Esther Brou", "direction@beta.exemple.test", "SUP_PRINCIPAL");
    acc("C2", "Didier Yapi", "superviseur.abidjan@beta.exemple.test", "SUP_SECONDAIRE", ["R1", "R2", "R3"]);
    acc("C2", "Nadia Tano", "superviseur.interieur@beta.exemple.test", "SUP_SECONDAIRE", ["R4", "R5", "R6"]);
    acc("C2", "Koffi Assi", "validateur.abidjan@beta.exemple.test", "VALIDATEUR", ["R1", "R2"]);
    acc("C2", "Aminata Dosso", "validateur.centre-nord@beta.exemple.test", "VALIDATEUR", ["R3", "R4"]);
    acc("C2", "Fabrice Loukou", "validateur.ouest-est@beta.exemple.test", "VALIDATEUR", ["R5", "R6"]);
    acc("C3", "Ruth Gnaoré", "ruth.gnaore@gamma.exemple.test", "SUP_PRINCIPAL", [], { mustChange: true, lastLogin: null, createdAt: day("2026-11-10") });
    acc("C4", "Joël Kra", "joel.kra@delta.exemple.test", "SUP_PRINCIPAL", [], { lastLogin: day("2026-04-02") });

    const plans = [
      { clientId: "C1", nom: "Bilan annuel 2025", start: "2025-10-06", end: "2025-11-14", invited: 70, rate: 0.82, spont: 4, w: [0.08, 0.4, 0.27, 0.2, 0.05] },
      { clientId: "C1", nom: "Bilan semestriel 2026", start: "2026-04-06", end: "2026-05-15", invited: 62, rate: 0.76, spont: 3, w: [0.08, 0.4, 0.27, 0.2, 0.05] },
      { clientId: "C1", nom: "Bilan annuel 2026", start: "2026-11-02", end: "2026-12-11", invited: 84, rate: 0.55, spont: 3, w: [0.08, 0.4, 0.27, 0.2, 0.05] },
      { clientId: "C2", nom: "Bilan 2025", start: "2025-09-15", end: "2025-10-31", invited: 96, rate: 0.7, spont: 5, w: [0.24, 0.2, 0.16, 0.14, 0.14, 0.12] },
      { clientId: "C2", nom: "Bien-être des adhérents 2026", start: "2026-10-26", end: "2026-12-18", invited: 150, rate: 0.62, spont: 6, w: [0.24, 0.2, 0.16, 0.14, 0.14, 0.12] },
      { clientId: "C3", nom: "Premier bilan", start: "2026-12-01", end: "2026-12-19", invited: 26, rate: 0, spont: 0, w: [0.4, 0.6] },
      { clientId: "C4", nom: "Bilan pilote 2026", start: "2026-03-02", end: "2026-03-27", invited: 14, rate: 0.64, spont: 0, w: [0.7, 0.3] },
    ];
    const wpick = (w) => { let x = rnd(), i = 0; for (; i < w.length - 1; i++) { if ((x -= w[i]) < 0) { break; } } return i; };
    const phone = () => `07 00 ${pad(Math.floor(rnd() * 100))} ${pad(Math.floor(rnd() * 100))} ${pad(Math.floor(rnd() * 100))}`;
    const person = (client) => {
      const f = rnd() < 0.47;
      const prenom = pick(f ? PRENOMS_F : PRENOMS_H), nom = pick(NOMS);
      const dom = client.emailPro ? domainOf(client.emailPro) : "mail.exemple.test";
      return { prenom, nom, genreHint: f ? "Femme" : "Homme", email: `${slug(prenom)}.${slug(nom)}${Math.floor(rnd() * 900 + 100)}@${dom}` };
    };
    const answersFor = (L) => {
      const n = () => (rnd() - 0.5) * 2.2;
      const cl = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
      const a = [0, 1, 2, 3, 4].map(() => cl(5 * (1 - L) + n(), 0, 5));
      const b = [cl(4 * L + n(), 0, 4), cl(4 * (1 - L) + n(), 0, 4), cl(4 * (1 - L) + n(), 0, 4), cl(4 * L + n(), 0, 4)];
      const c = [0, 1, 2, 3, 4].map(() => cl(6 * L + n(), 0, 6));
      const d = [0, 1, 2, 3, 4].map(() => cl(1 + 4 * (1 - L) + n(), 1, 5));
      const e = [0, 1, 2].map(() => cl(2.4 * L - 0.75 + (rnd() - 0.5) * 1.0, 0, 2));
      return [...a, ...b, ...c, ...d, ...e];
    };
    const latent = () => { const x = rnd(); return x < 0.66 ? between(0, 0.3) : x < 0.88 ? between(0.32, 0.5) : between(0.55, 0.9); };

    plans.forEach((p) => {
      db.seq.camp += 1;
      const client = byId(db.clients, p.clientId);
      const k = { id: "K" + db.seq.camp, clientId: p.clientId, nom: p.nom, test: "BSPA", start: p.start, end: p.end, token: token(rnd), createdAt: day(p.start) - 5 * D };
      db.campaigns.push(k);
      addLog(db, { at: k.createdAt, actorId: admin.id, clientId: k.clientId, action: `Création de campagne (${p.invited} personnes importées)`, target: k.nom });
      const from = day(p.start), to = Math.min(day(p.end) + D - H, now - H);
      const people = [];
      for (let i = 0; i < p.invited; i++) {
        const pr = person(client);
        db.seq.inv += 1;
        const inv = { id: "I" + db.seq.inv, pseudo: newPseudo(db, rnd), campaignId: k.id, nom: pr.nom, prenom: pr.prenom, email: pr.email, tel: phone(), unitId: client.units[wpick(p.w)].id, reminders: [] };
        db.invitees.push(inv);
        people.push({ inv, pr, responds: to > from && rnd() < p.rate });
      }
      for (let i = 0; i < p.spont; i++) { people.push({ inv: null, pr: person(client), responds: to > from }); }
      people.forEach(({ inv, pr, responds }) => {
        if (!responds) {
          if (inv && to > from && rnd() < 0.5) { const t = between(from + 3 * D, Math.max(from + 3 * D, to)); if (t <= now) { inv.reminders.push(t); if (rnd() < 0.4 && t + 4 * D <= now) { inv.reminders.push(t + 4 * D); } } }
          return;
        }
        const completedAt = Math.round(between(from + 8 * H, to));
        const answers = answersFor(latent());
        const poidsTaille = (() => { const t = Math.round(between(152, 190)); const bmi = between(18, 35) + (rnd() < 0.05 ? 6 : 0); return { taille: t, poids: Math.round(bmi * (t / 100) ** 2) }; })();
        const ante = []; if (rnd() < 0.12) { ante.push("Maladie chronique"); } if (rnd() < 0.05) { ante.push("Trouble psychique"); } if (rnd() < 0.03) { ante.push(pick(["Handicap physique", "Handicap psychique"])); }
        const unitId = inv ? inv.unitId : client.units[wpick(p.w)].id;
        db.seq.resp += 1;
        const r = {
          id: "R" + db.seq.resp, pseudo: inv ? inv.pseudo : newPseudo(db, rnd), campaignId: k.id, clientId: client.id, inviteeId: inv ? inv.id : null,
          email: inv ? inv.email : pr.email, nom: inv ? inv.nom : pr.nom, prenom: inv ? inv.prenom : pr.prenom, tel: inv ? inv.tel : phone(), unitId,
          genre: rnd() < 0.06 ? "Non précisé" : pr.genreHint, age: pick(OPTIONS.age), ancEnt: pick(OPTIONS.anciennete), ancPoste: pick(OPTIONS.anciennete),
          poids: poidsTaille.poids, taille: poidsTaille.taille, antecedents: ante,
          consentAt: completedAt - Math.round(between(6, 18) * 60000), consentVersion: T.consentement.version, completedAt, answers, result: scoreBspa(answers),
          delayDays: client.type === "M" ? unitOf(db, client.id, unitId).delayDays : null,
          decisions: [], followUp: { closedAt: null, closedBy: null }, care: { closedAt: null, closedBy: null }, resultSentAt: null,
        };
        db.responses.push(r);
      });
    });

    /* Décisions, suivis et clôtures : simulés dans le temps, toujours ≤ maintenant. */
    const dec = (r, by, value, at) => { db.seq.dec += 1; const d = { id: "DEC" + db.seq.dec, by: by.id, role: by.role, value, at: Math.round(at), revokedAt: null, revokedBy: null }; r.decisions.push(d); addLog(db, { at: d.at, actorId: by.id, clientId: r.clientId, action: "Décision de prise en charge enregistrée", target: r.pseudo }); return d; };
    db.responses.forEach((r) => {
      const age = now - r.completedAt;
      const client = clientOf(db, r);
      if (r.result.profil === "ORANGE" && client.active) {
        if (client.type === "E") {
          if (age > 2 * D && (age > 30 * D || rnd() < 0.85)) { dec(r, admin, rnd() < 0.6, r.completedAt + between(0.2 * D, Math.min(age, 6 * D))); }
        } else {
          const val = db.accounts.find((a) => a.role === "VALIDATEUR" && a.units.includes(r.unitId));
          const sec = db.accounts.find((a) => a.role === "SUP_SECONDAIRE" && a.units.includes(r.unitId));
          const dl = r.completedAt + r.delayDays * D;
          const x = age > 30 * D ? rnd() * 0.68 : rnd();
          if (x < 0.55 && age > 0.5 * D) {
            const d = dec(r, val, rnd() < 0.6, r.completedAt + between(0.2 * D, Math.min(age, r.delayDays * D) * 0.7));
            const lim = Math.min(dl, now);
            if (rnd() < 0.2 && lim - d.at > 2 * H) {
              d.revokedAt = Math.round(between(d.at + H, lim - H)); d.revokedBy = sec.id;
              addLog(db, { at: d.revokedAt, actorId: sec.id, clientId: r.clientId, action: "Décision annulée (révocation)", target: r.pseudo });
              if (rnd() < 0.6 && lim - d.revokedAt > 2 * H) { dec(r, sec, !d.value, between(d.revokedAt + H, lim - H)); }
            }
          } else if (x < 0.68 && age > D) {
            dec(r, sec, rnd() < 0.6, r.completedAt + between(0.3 * D, Math.min(age, r.delayDays * D) * 0.8));
          } else if (x < 0.8 && now > dl + D) {
            dec(r, val, rnd() < 0.6, between(dl + 0.5 * D, now - 0.2 * D));
          }
        }
      }
      if (age > D && rnd() < Math.min(0.9, age / (12 * D))) {
        r.followUp.closedAt = Math.round(r.completedAt + between(0.3 * D, Math.min(age, 8 * D))); r.followUp.closedBy = admin.id;
        addLog(db, { at: r.followUp.closedAt, actorId: admin.id, clientId: r.clientId, action: "Entretien passé à clos", target: r.pseudo });
      }
      const s = careState(db, r, now);
      if (s.state === "ACTIVE" && now - s.since > 10 * D && rnd() < 0.45) {
        r.care.closedAt = Math.round(between(s.since + 5 * D, now - D)); r.care.closedBy = admin.id;
        addLog(db, { at: r.care.closedAt, actorId: admin.id, clientId: r.clientId, action: "Prise en charge passée à clos", target: r.pseudo });
      }
    });
    db.invitees.forEach((i) => i.reminders.forEach((t) => addLog(db, { at: t, actorId: admin.id, clientId: campaignOf(db, i).clientId, action: "Relance par e-mail", target: i.pseudo })));
    db.accounts.filter((a) => a.lastLogin).forEach((a) => addLog(db, { at: a.lastLogin, actorId: a.id, clientId: a.clientId, action: "Connexion", target: "" }));
    addLog(db, { at: now - 3 * D, actorId: admin.id, clientId: "C2", onBehalf: true, action: "Renvoi du mot de passe temporaire", target: "validateur.ouest-est@beta.exemple.test" });
    addLog(db, { at: now - 11 * D, actorId: admin.id, clientId: "C3", action: "Création de client", target: "Gamma Services (fictif)" });
    addLog(db, { at: now - 11 * D, actorId: admin.id, clientId: "C3", onBehalf: true, action: "Création de compte (Superviseur principal)", target: "ruth.gnaore@gamma.exemple.test" });
    return db;
  }

  window.EM = {
    D, H, SECTEURS, ROLES, ROLES_BY_TYPE, UNIT_WORD, ZONES, ZONE, SCALES, SECTIONS, N_ITEMS, DIMS, OPTIONS, GROUPS, SEUIL_ANONYMAT, CAMPAIGN_STATUS, FOLLOW, SCREENS,
    scoreBspa, imc, imcCategorie, imcMessage, imcGroupe, theme, contrast,
    day, days, fmtDate, fmtDateTime, isoDate, domainOf, isEmail, isPhone, byId, clientOf, campaignOf, unitOf,
    campaignStatus, effectifAt, deadlineOf, effectiveDecision, careState, careLabel, waitLabel, followUpState,
    canAccess, canSeeResponse, validationQueue, addLog, historyFor,
    decide, revoke, closeCare, closeFollowUp, remind, coverage, accountErrors, saveAccount, setAccountActive, resendPassword, setDelay,
    clientErrors, checkParticipantAccess, profileErrors, submitResponse, parseInviteeList, createCampaign, campaignLink, newPseudo,
    allowedUnits, dashboard, dashboardCsv, toCsv, participantRows, careRows, generate,
    NOW0: Date.UTC(2026, 10, 21, 9, 0),
  };
})();
