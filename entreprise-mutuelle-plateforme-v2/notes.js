/* Notes UX de la maquette : choix par écran et questions à valider. */
"use strict";

window.EM_NOTES = {
  login: {
    titre: "Connexion (tous les comptes)",
    choix: [
      "Une seule page pour tous les rôles, toujours aux couleurs Yodan (§ 7). Étapes : e-mail + mot de passe → code OTP par e-mail → changement du mot de passe temporaire si première connexion → espace du rôle.",
      "Mot de passe oublié : code OTP, nouveau mot de passe, puis retour à la connexion (qui redemande un OTP).",
      "Le code OTP s'affiche dans la « boîte mail simulée » en bas à droite. Dans la maquette, n'importe quel mot de passe est accepté.",
      "Message d'erreur identique pour « e-mail inconnu » et « mot de passe faux » : on ne révèle pas quels e-mails ont un compte.",
      "Client désactivé ou compte désactivé : accès refusé avec un message neutre (essayez le compte Delta Transport).",
      "Mot de passe : 12 caractères minimum, avec au moins une lettre et un chiffre.",
    ],
    questions: [
      "« Se souvenir de moi » pendant 1 semaine va contre notre règle « sessions courtes » pour les comptes qui voient des données individuelles (Admin Yodan, validateurs, superviseurs secondaires). Options : (A) option réservée au superviseur principal, qui ne voit que des statistiques ; (B) l'option garde la session mais redemande l'OTP avant d'ouvrir un dossier individuel ; (C) l'option ne mémorise que l'e-mail. À trancher.",
      "Mode démonstration sans OTP : réglage technique (variable d'environnement), jamais visible dans l'interface. OK ?",
    ],
  },
  participant: {
    titre: "Parcours participant (lien ou QR code)",
    choix: [
      "Aux couleurs du client (thème + logo), sans compte. Étapes : e-mail → code OTP → consentement → questionnaire général → test BSPA (5 pages) → résultat.",
      "Contrôle du nom de domaine si le client a un e-mail professionnel (Alpha : @alpha.exemple.test). Mutuelle Beta n'en a pas : ouvert à tous. Une seule réponse par adresse et par campagne.",
      "Consentement en premier : cases distinctes (traitement des données ; entretien avec un psychologue). Mutuelle : 3e case obligatoire, transmission de l'avis (pas des notes) aux professionnels de santé de la mutuelle. Le texte explique la finalité, les destinataires et qu'un refus arrête le parcours de prise en charge. Date et version (consentement-v2) enregistrées.",
      "Si l'e-mail figure dans la liste de la campagne, nom, prénom, téléphone et direction/région sont préremplis (modifiables).",
      "IMC calculé en direct à partir du poids et de la taille, avec la catégorie et le message neutre du référentiel.",
      "Le test vérifie que chaque question a une réponse avant de passer à la page suivante.",
      "Résultat : libellé client (Satisfaisant / Vigilance / À prendre en charge), texte de l'annexe B, rappel de l'entretien pour tous, mention de confidentialité.",
      "Aucun nom de personne ni résultat dans l'URL ou le titre de la page.",
    ],
    questions: [
      "Montre-t-on au participant le détail par dimension (bien-être, stress…) ou seulement le niveau global, comme ici ?",
      "Poids, taille et antécédents médicaux sont obligatoires dans le cahier des charges. Ce sont des données de santé : quelle finalité exacte ? Peut-on ajouter « Je préfère ne pas répondre » (minimisation) ?",
      "Mutuelle : les adhérents ont rarement une adresse @mutuelle. Confirme-t-on « pas d'e-mail pro = ouvert à tous » pour les mutuelles ?",
      "Libellé « Ancienneté dans l'entreprise » pour les adhérents d'une mutuelle : à adapter ?",
      "Numéro d'urgence (SAMU 185) à confirmer par Yodan.",
      "3e consentement pour les Entreprises : la maquette ne l'affiche que pour les Mutuelles (pour une Entreprise, l'avis reste chez Yodan, qui décide). À confirmer.",
      "La matrice de visibilité de la spec v1.5 indique « le participant voit son avis ». Le lui montre-t-on (et comment : lien sécurisé + code), ou seulement le résultat du test, comme ici ?",
    ],
  },
  clients: {
    titre: "Clients (Admin Yodan)",
    choix: [
      "Bouton « Créer un client » en haut. Filtres : nom, secteur, type (et statut actif / désactivé).",
      "Par ligne : Voir les campagnes, Configurer, Comptes, Activer / Désactiver. Un client désactivé n'a plus accès (connexion et liens de campagne) ; ses données restent conservées.",
      "Effectif affiché = dernière valeur enregistrée ; l'historique daté est dans « Configurer ».",
    ],
    questions: ["La désactivation d'un client arrête-t-elle aussi les campagnes en cours (liens fermés), comme dans la maquette ?"],
  },
  clientForm: {
    titre: "Fiche client (création / configuration)",
    choix: [
      "Tous les champs du § 4.1. Le type (Entreprise / Mutuelle) n'est plus modifiable après la création : il détermine les rôles et les règles de délai.",
      "Effectif daté : chaque modification ajoute une ligne (valeur + date). Une campagne utilise l'effectif enregistré à sa date de lancement (décision 11).",
      "Directions / régions : une par ligne, ou import d'un fichier .csv/.txt (une valeur par ligne). En configuration, on peut en ajouter ; une direction/région déjà utilisée ne se supprime pas.",
      "Thème : sélecteur de couleur avec aperçu. La couleur du texte (blanc ou bleu nuit) est choisie automatiquement pour un contraste suffisant ; les liens utilisent une version assombrie si besoin.",
      "Logo : PNG, JPG ou SVG, 2 Mo maximum, aperçu sur damier pour voir la transparence. « Rétablir » revient au logo Yodan.",
      "Compte principal (création seulement) : Superviseur principal pour une Entreprise, Administrateur pour une Mutuelle. Un e-mail avec mot de passe temporaire part à l'enregistrement.",
    ],
    questions: [
      "Liste des 21 secteurs CIAP 2014 : libellés à vérifier sur le document ANSTAT.",
      "Logo SVG : on le nettoie côté serveur (un SVG peut contenir du script). Alternative : n'accepter que PNG/JPG.",
    ],
  },
  accounts: {
    titre: "Comptes d'un client",
    choix: [
      "Admin Yodan : bandeau rappelant qu'il agit pour le compte du client ; chaque action est tracée « par Yodan pour le compte du client ».",
      "Couverture des régions (Mutuelle) : chaque région a exactement un médecin-conseil (niveau 1, ex-« validateur ») et un superviseur secondaire (niveau 2). Les deux sont décideurs. Une région non couverte est signalée en orange.",
      "Nouveau rôle Mutuelle « Assistante sociale » : crée les campagnes (initie les évaluations), sans accès aux résultats individuels ni à la décision. Pas de région à attribuer. Le médecin-conseil (niveau 1) peut aussi créer des campagnes.",
      "Le formulaire empêche les doublons : une région déjà couverte est grisée avec le nom de la personne qui la couvre. Un seul superviseur principal par client.",
      "Désactiver plutôt que supprimer : l'historique garde l'auteur des actions passées.",
      "Renvoyer un mot de passe temporaire oblige à le changer à la prochaine connexion.",
    ],
    questions: [
      "Changer la région d'un médecin-conseil : les cas déjà en attente suivent la région (donc le nouveau médecin-conseil). OK ?",
      "Médecin-conseil et superviseur secondaire voient des données de santé (rapport du test + avis) : leur statut de professionnel de santé doit être enregistré dans la gestion des comptes et des habilitations. Champ à ajouter ?",
      "Assistante sociale : une seule par mutuelle ou plusieurs ? Voit-elle le taux de participation de ses campagnes (agrégé) ?",
      "Un seul Administrateur actif par mutuelle : OK, ou faut-il un suppléant ?",
    ],
  },
  delais: {
    titre: "Délais de prise en charge (Mutuelle)",
    choix: [
      "Réglage par région, 7 jours par défaut, entre 1 et 60 jours.",
      "v1.5 : le délai démarre à la validation de l'avis du psychologue, pas à la fin du test. Tant que l'entretien n'est pas fait, le compteur ne court pas.",
      "La durée du délai est figée pour chaque participant à la fin de son test : un changement ne s'applique qu'aux tests terminés ensuite.",
    ],
    questions: ["Durée figée à la fin du test (mais départ à la validation de l'avis) : OK ?"],
  },
  campaigns: {
    titre: "Campagnes (Admin Yodan, assistante sociale, médecin-conseil)",
    choix: [
      "Statut calculé à partir des dates : à venir, en cours, terminée.",
      "Colonne « Psychologues » : noms pour l'Admin Yodan ; « attribué(s) » ou « à attribuer par Yodan » pour l'assistante sociale.",
      "Admin Yodan : Entrer, Psychologues (modifier l'attribution), QR code. Assistante sociale et médecin-conseil (niveau 1) : création de campagne pour leur mutuelle et QR code ; pas de liste nominative des participants. Le médecin-conseil décide depuis « Décisions ».",
      "Le lien contient un jeton aléatoire, jamais le nom du client.",
    ],
    questions: ["Une campagne créée par l'assistante sociale sans psychologue : faut-il prévenir Yodan (notification, e-mail neutre) ? Empêche-t-on son ouverture tant qu'aucun psychologue n'est attribué ?"],
  },
  campaignForm: {
    titre: "Création d'une campagne",
    choix: [
      "Admin Yodan : sélection multiple des psychologues actifs (au moins un). Assistante sociale et médecin-conseil : pas de choix, l'attribution reste à Yodan.",
      "Liste : saisie (une personne par ligne : nom ; prénom ; e-mail ; téléphone ; direction/région) ou import d'un fichier tableur exporté en CSV.",
      "Contrôles ligne par ligne avant l'enregistrement : e-mail valide et du bon domaine, téléphone obligatoire, direction/région connue, pas de doublon. Les erreurs sont listées avec leur numéro de ligne.",
      "À l'enregistrement : lien unique + QR code affichés tout de suite.",
    ],
    questions: ["Import Excel (.xlsx) natif nécessaire, ou un export CSV suffit-il pour le pilote ?"],
  },
  campaign: {
    titre: "Campagne : tableau de bord et participants",
    choix: [
      "Onglet Tableau de bord : même contenu que celui des superviseurs, sans seuil d'anonymat pour l'Admin Yodan (§ 7).",
      "Onglet Participants (Admin Yodan uniquement) : liste des invités + personnes hors liste ayant répondu (mention « hors liste »).",
      "Statut : Sans réponse ou niveau de risque avec score global (sur 10). Colonne « Entretien » (à faire / rapport en cours / avis validé) pour tous ceux qui ont répondu, verts compris : elle remplace l'ancien statut de suivi « À appeler / Clos ».",
      "« Relancer par e-mail » seulement pour les personnes sans réponse, sans limite ; la date de dernière relance s'affiche.",
      "Export tableur de la liste filtrée (CSV).",
    ],
    questions: ["Relance réservée aux « Sans réponse » : OK ?"],
  },
  dashboard: {
    titre: "Tableau de bord (superviseurs)",
    choix: [
      "Conforme à la maquette de référence : chiffres clés, participation, profils (anneau), dimensions sur 100 avec le sens de lecture, répartition par groupe, comparaison des campagnes.",
      "Groupes supplémentaires (« éléments ajoutés ») : ancienneté au poste, corpulence (IMC en 4 classes), antécédents médicaux, à afficher via les pastilles. Filtre « Population » pour restreindre tout le tableau de bord à un groupe.",
      "Seuil d'anonymat : groupe de 1 à 4 réponses masqué (hachures) ; si une seule ligne est masquée, la plus petite suivante l'est aussi (sinon on la retrouve par soustraction). Sélection totale de moins de 5 réponses : tout est masqué.",
      "Superviseur secondaire : uniquement ses régions ; l'effectif du client n'est pas affiché (il couvre toutes les régions).",
      "Effectif « à la date de la campagne » : affiché quand une campagne est choisie et sans filtre de région.",
      "Aucune donnée individuelle n'est envoyée au navigateur d'un superviseur : seulement des totaux.",
    ],
    questions: [
      "Antécédents médicaux et IMC dans le tableau de bord de l'employeur : ce sont des données de santé, même agrégées. Options : (A) visibles seulement par Yodan ; (B) visibles côté client avec un seuil plus élevé (≥ 10) ; (C) comme la maquette (seuil 5). Une AIPD est nécessaire.",
      "Les petits chiffres dans un total ≥ 5 (ex. 2 « À prendre en charge » dans une direction de 7) restent affichés. Faut-il aussi les masquer ?",
      "Antécédents : une personne peut en cocher plusieurs, donc la somme des lignes dépasse le total. Libellé à valider.",
    ],
  },
  detail: {
    titre: "Détail d'un participant",
    choix: [
      "Score de chaque partie (brut + sur 100 + couleur) et score global, statut, interprétation.",
      "Admin Yodan : identité, coordonnées, questionnaire général, export PDF (impression), envoi du résultat ; section Entretien avec le rapport (PDF, ouverture tracée) et l'avis validé.",
      "Médecin-conseil / superviseur secondaire : identifiant à la place du nom, rapport du test et avis du psychologue ; ni coordonnées, ni questionnaire général, ni rapport d'entretien.",
      "Boutons Oui / Non grisés tant que l'avis n'est pas validé ; décision prise par Yodan marquée « validée par YODAN ».",
      "Chaque ouverture d'un dossier individuel est inscrite dans l'historique (qui, quand, quel identifiant), sans contenu de santé.",
    ],
    questions: [
      "« Envoyer le résultat au participant par e-mail » : nos règles interdisent une donnée de santé dans un e-mail. Maquette : e-mail neutre + lien sécurisé avec code OTP vers le PDF. Alternatives : (B) PDF protégé par un mot de passe envoyé par SMS ; (C) pas d'envoi, le participant revoit son résultat via le lien de campagne + OTP. À valider.",
    ],
  },
  validation: {
    titre: "Validation / décisions (cas orange)",
    choix: [
      "Statuts amont : « entretien en attente » (boutons grisés, délai non démarré) → avis validé = « décision ouverte » → décision. Les statuts « avis disponible » et « décision ouverte » de la spec sont fusionnés : la validation de l'avis ouvre la décision.",
      "Le verrou est aussi contrôlé côté « serveur » (fonction decide) : une décision sans avis validé est refusée, même si le bouton était forcé.",
      "Colonne « Avis du psychologue » : recommandation, urgence et risque confirmé / nuancé / infirmé. Jamais le rapport côté mutuelle.",
      "Admin Yodan : accès par défaut aux cas de tous les clients (Entreprises et Mutuelles), rapport + avis. Décision immédiate et définitive, marquée « validée par YODAN ». Une seule décision par dossier.",
      "Mutuelle : médecin-conseil (niveau 1) puis superviseur secondaire (niveau 2), comme en v1.4 : décision du niveau 1 appliquée à l'échéance, le niveau 2 peut l'annuler ou décider à sa place tant que le délai court.",
      "Médecin-conseil et superviseur secondaire voient aussi, 30 jours, les dossiers de leurs régions décidés par Yodan (sans bouton).",
      "Utilisez « +1 jour » dans la barre de maquette pour voir les délais s'écouler.",
    ],
    questions: [
      "Décision de l'Admin Yodan sur une Mutuelle : immédiate et définitive, même pendant le délai (le niveau 2 ne peut plus l'annuler). OK ?",
      "Le médecin-conseil peut-il modifier sa propre décision pendant le délai ? Maquette : non, seul le superviseur secondaire peut revenir dessus.",
      "La recommandation du psychologue est un intrant : le décideur peut décider l'inverse. Doit-il alors justifier (motif obligatoire) ?",
      "Le journal indique « décision enregistrée » sans la valeur Oui/Non (elle reste dans le dossier). OK ?",
    ],
  },
  psychologues: {
    titre: "Psychologues (Admin Yodan)",
    choix: [
      "Création simple : nom + e-mail ; une invitation part par e-mail pour définir le mot de passe (aucune donnée de participant dans l'e-mail).",
      "Désactiver / réactiver : un compte désactivé ne peut plus se connecter (sessions fermées) ; ses rapports et avis restent dans les dossiers. Il n'est plus proposé dans l'attribution des campagnes.",
      "Indicateurs par psychologue : campagnes attribuées, rapports en cours, avis validés.",
      "Un psychologue peut suivre plusieurs campagnes, une campagne peut avoir plusieurs psychologues (attribution à la création ou via le bouton « Psychologues » d'une campagne).",
    ],
    questions: [
      "Double authentification : la maquette garde le code OTP par e-mail. Faut-il une application d'authentification pour les psychologues ?",
      "Répartition des dossiers entre plusieurs psychologues d'une même campagne : libre (le premier qui ouvre), ou attribution dossier par dossier ?",
    ],
  },
  interviews: {
    titre: "Mes entretiens (psychologue)",
    choix: [
      "Uniquement les participants des campagnes attribuées, sous pseudonyme (P-XXXXX), sans nom ni coordonnées.",
      "Décidé le 24/11/2026 : les psychologues travaillent en coordination interne avec Yodan, qui leur indique comment joindre chaque participant. Aucune coordonnée dans leur espace.",
      "Filtres : campagne et statut du rapport (à faire, rapport en cours, avis validé). Les dossiers à traiter sont en haut.",
    ],
    questions: [
    ],
  },
  interview: {
    titre: "Fiche d'entretien (psychologue)",
    choix: [
      "Résultat du test en lecture seule (score global, profil, scores par partie).",
      "Deux couches séparées : 1. Rapport d'entretien : PDF rédigé hors de la plateforme puis déposé (PDF uniquement, 10 Mo max., un nouveau dépôt remplace le précédent), jamais transmis ; 2. Avis orienté décision en champs fermés, seule couche qui sort de Yodan.",
      "Avis : date de l'entretien, risque confirmé / nuancé / infirmé, recommandation Oui / Non ; si Oui : type et urgence (grisés sinon) ; commentaire court (300 caractères) avec la consigne « aucun détail de vie privée ».",
      "« Enregistrer le brouillon » : invisible pour les autres rôles. « Valider l'avis » : contrôles (rapport PDF déposé, champs requis, date entre la fin du test et aujourd'hui), confirmation, puis avis verrouillé.",
      "La validation ouvre la décision et, pour une Mutuelle, démarre le délai de la région.",
      "Décidé le 24/11/2026 : un avis validé ne se corrige jamais (il peut avoir lancé une décision en cours). La confirmation le rappelle ; le brouillon sert à relire avant de valider.",
    ],
    questions: [
      "Le PDF du rapport peut être remplacé après validation de l'avis (nouvelle version, tracée). OK, ou verrou aussi ?",
      "Modèle de rapport : faut-il imposer un modèle PDF Yodan (en-tête, pseudonyme, sans nom du participant) ?",
      "Entretien et avis pour les participants verts : obligatoires (protocole « entretien systématique »), sans décision derrière. OK ?",
      "Cas rouge avec recommandation « Non » : la prise en charge reste automatique (règle v1.4). Faut-il plutôt ouvrir une décision ?",
    ],
  },
  care: {
    titre: "À prendre en charge (Admin Yodan)",
    choix: [
      "Personnes dont la prise en charge est confirmée, toujours après l'avis validé : rouges (Entreprise : dès l'avis ; Mutuelle : à l'échéance du délai) et oranges décidés « Oui ».",
      "« Passer à clos » ne concerne que la prise en charge. Rien n'est automatique.",
      "Export tableur des prises en charge « en cours » uniquement.",
    ],
    questions: [
      "Mutuelle, cas rouge : le tableau du § 5.3 indique « prise en charge automatique à la fin du délai ». La maquette applique cette lecture (statut « automatique dans X jours »). Ou faut-il une prise en charge immédiate comme pour les Entreprises ?",
    ],
  },
  history: {
    titre: "Historique",
    choix: [
      "Journal en écriture seule : date, auteur, action, information associée. Filtres : compte, période.",
      "Aucune donnée de santé : ni score, ni couleur, ni réponse, ni valeur de décision. Les participants apparaissent par leur identifiant.",
      "Actions de Yodan sur les comptes d'un client marquées « par Yodan pour le compte du client ».",
      "L'Administrateur d'une mutuelle ne voit que les actions qui concernent sa mutuelle (y compris celles de Yodan pour son compte).",
    ],
    questions: ["L'historique interne de la mutuelle montre-t-il aussi les actions faites par Yodan pour son compte ? Maquette : oui."],
  },
  transverse: [
    "Une AIPD est nécessaire avant le développement : questionnaire de santé mentale, IMC, antécédents médicaux, décisions de prise en charge, et (v1.5) partage « avis psychologue → mutuelle ».",
    "v1.5 : aucune prise en charge sans avis validé du psychologue (comme le bon de prise en charge CNPS), y compris pour les cas rouges.",
    "Rapport et avis chiffrés en base, rattachés au seul pseudonyme ; chaque lecture ou écriture est journalisée (sans contenu). Nouvelles tables (psychologues, campagne ↔ psychologue, rapports, avis) à signaler au service central de purge.",
    "Séparation identité / clinique : dans l'application, les réponses et scores ne porteront qu'un pseudonyme (P-XXXXX) ; nom, e-mail et téléphone sont rangés à part.",
    "Durée de conservation : gérée par le service central de purge (nouvelles tables à lui signaler).",
  ],
};
