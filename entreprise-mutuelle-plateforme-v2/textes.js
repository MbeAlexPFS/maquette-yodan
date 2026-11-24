/*
 * Textes modifiables de la plateforme, regroupés en un seul endroit (CdC § 7, décision 14).
 * Textes par défaut de l'annexe B et du référentiel IMC : à relire par l'équipe clinique Yodan avant le pilote.
 * Maquette : données 100 % fictives.
 */
"use strict";

window.EM_TEXTES = {
  interpretation: {
    VERT: {
      titre: "Satisfaisant",
      paragraphes: [
        "Vos réponses indiquent un bon niveau de bien-être au travail. Vous semblez disposer des ressources nécessaires pour faire face aux exigences de votre activité.",
        "Continuez à prendre soin de cet équilibre : temps de repos, activités qui vous ressourcent, échanges avec vos proches et vos collègues. Si votre situation évolue, n'hésitez pas à en parler à un professionnel de santé. Comme pour tous les participants, un professionnel prendra contact avec vous pour un court entretien téléphonique.",
      ],
    },
    ORANGE: {
      titre: "Vigilance",
      paragraphes: [
        "Vos réponses montrent quelques signes de tension ou de fatigue qui méritent votre attention. Ce résultat n'est pas un diagnostic : c'est un signal pour faire le point.",
        "Un professionnel pourra prendre contact avec vous pour vous proposer un échange confidentiel. En attendant, essayez d'identifier ce qui pèse le plus en ce moment et d'en parler à une personne de confiance.",
      ],
    },
    ROUGE: {
      titre: "À prendre en charge",
      paragraphes: [
        "Vos réponses indiquent que vous traversez une période difficile. Vous n'êtes pas seul(e) : un professionnel va prendre contact avec vous pour vous proposer un accompagnement confidentiel.",
        "Si vous vous sentez en danger ou si vous avez des pensées de vous faire du mal, contactez immédiatement les secours (SAMU : 185 — numéro à confirmer par Yodan) ou rendez-vous aux urgences les plus proches.",
      ],
    },
  },

  mentionCommune:
    "Votre résultat est confidentiel. Il n'est jamais transmis à vos responsables hiérarchiques : seules des statistiques globales et anonymes sont partagées avec votre organisation. Seules les personnes chargées de votre éventuelle prise en charge peuvent consulter votre résultat individuel.",

  entretien:
    "Un psychologue de Yodan vous appellera au numéro indiqué pour un entretien téléphonique, quel que soit votre résultat. Aucune prise en charge n'est décidée avant cet entretien.",

  consentement: {
    donnees:
      "J'accepte que mes réponses soient traitées par Yodan pour évaluer ma santé psychologique au travail. Mon organisation ne reçoit que des statistiques globales et anonymes.",
    contact:
      "J'accepte d'être contacté(e) par téléphone par un psychologue de Yodan pour un entretien, proposé à tous les participants.",
    /* 3e consentement (v1.5) : Mutuelles uniquement, obligatoire. */
    avis:
      "J'accepte que l'avis issu de mon entretien avec le psychologue (et non ses notes détaillées) soit transmis aux professionnels de santé de ma mutuelle (médecin-conseil et superviseur médical), pour décider de ma prise en charge. Cette transmission est nécessaire pour me proposer une prise en charge adaptée : si je refuse, le parcours de prise en charge ne peut pas continuer.",
    version: "consentement-v2 (24/11/2026)",
  },

  /* Avis orienté décision (champs fermés) saisi par le psychologue. */
  avis: {
    risque: { CONFIRME: "Confirmé par l'entretien", NUANCE: "Nuancé par l'entretien", INFIRME: "Infirmé par l'entretien" },
    type: { SOUTIEN_COURT: "Soutien court", ORIENTATION: "Orientation spécialisée", SUIVI: "Suivi" },
    urgence: { STANDARD: "Standard", PRIORITAIRE: "Prioritaire" },
    consigneCommentaire: "Destiné au décideur. Aucun détail de vie privée : ni histoire personnelle, ni diagnostic, ni nom de tiers.",
    commentaireMax: 300,
  },

  /* Référentiel IMC adultes (annexe IMC). Bornes : min inclus, max exclu. */
  imc: [
    { code: "IMC-01", categorie: "Insuffisance pondérale sévère", min: 0, max: 16, indicatif: "Risque nutritionnel élevé" },
    { code: "IMC-02", categorie: "Insuffisance pondérale modérée", min: 16, max: 17, indicatif: "Vigilance clinique" },
    { code: "IMC-03", categorie: "Insuffisance pondérale légère", min: 17, max: 18.5, indicatif: "Vigilance" },
    { code: "IMC-04", categorie: "Corpulence normale", min: 18.5, max: 25, indicatif: "Zone de référence" },
    { code: "IMC-05", categorie: "Surpoids", min: 25, max: 30, indicatif: "Vigilance" },
    { code: "IMC-06", categorie: "Obésité classe I", min: 30, max: 35, indicatif: "Risque accru" },
    { code: "IMC-07", categorie: "Obésité classe II", min: 35, max: 40, indicatif: "Risque élevé" },
    { code: "IMC-08", categorie: "Obésité classe III", min: 40, max: Infinity, indicatif: "Risque très élevé" },
  ],
  imcMessages: [
    { max: 18.5, message: "Votre IMC est inférieur à la zone de référence. Envisagez d'en discuter avec un professionnel de santé, selon votre situation." },
    { max: 25, message: "Votre IMC se situe dans la zone de référence pour les adultes." },
    { max: 30, message: "Votre IMC est au-dessus de la zone de référence. Il peut être utile d'évaluer vos habitudes de vie et autres facteurs de santé." },
    { max: 35, message: "Votre IMC est élevé. Un échange avec un professionnel de santé peut aider à faire le point sur votre santé globale." },
    { max: 40, message: "Votre IMC est élevé et mérite une attention particulière. Une évaluation par un professionnel de santé est recommandée." },
    { max: Infinity, message: "Une évaluation de votre état de santé par un professionnel de santé est recommandée." },
  ],
  imcPrecaution:
    "L'IMC est un indicateur de dépistage et ne constitue pas, à lui seul, un diagnostic.",

  /* E-mails : jamais de donnée de santé dans le corps du message (ISO 27799). */
  emails: {
    otp: (code) => ({ objet: "Votre code de connexion", corps: `Votre code à usage unique : ${code}. Il expire dans 10 minutes.` }),
    motDePasseTemporaire: () => ({ objet: "Votre accès à la plateforme Yodan", corps: "Un compte a été créé pour vous. Connectez-vous avec le mot de passe temporaire joint ; il devra être changé à la première connexion." }),
    invitationPsychologue: () => ({ objet: "Invitation : votre espace psychologue Yodan", corps: "Un espace psychologue a été ouvert pour vous. Suivez le lien sécurisé pour définir votre mot de passe (valable 48 h). Aucune donnée de participant ne figure dans cet e-mail." }),
    relance: (campagne) => ({ objet: `Rappel : ${campagne}`, corps: "Vous êtes invité(e) à participer à une évaluation confidentielle. Le lien reste ouvert jusqu'à la fin de la campagne." }),
    resultat: () => ({ objet: "Un document vous attend", corps: "Un document confidentiel est disponible. Ouvrez le lien sécurisé et confirmez votre identité avec le code reçu pour le consulter." }),
  },
};
