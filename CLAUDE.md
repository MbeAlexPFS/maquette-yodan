# CLAUDE.md — Annuaire des maquettes (`design`)

> Complète la section 9 du CLAUDE.md parent (`..\CLAUDE.md`). En cas de conflit, la règle la plus protectrice l'emporte.

## Ce qu'est ce dossier
- Un **annuaire de maquettes** HTML/CSS/JS statiques, ouvrable par double-clic sur `index.html`.
- C'est aussi le **dépôt Git** (`.git` à la racine), publié sur **GitHub Pages** pour les tests en ligne (remote `origin` : `maquette-yodan`). La page d'accueil du site est `index.html`.
- **Tout ce qui est versionné ici est public** : données 100 % fictives, aucun secret, aucune capture d'écran de vraies données.

## Structure
```
design/
├─ index.html          ← annuaire (page d'accueil GitHub Pages)
├─ annuaire/           ← assets de l'annuaire uniquement
│  ├─ maquettes.js     ← REGISTRE des maquettes (à tenir à jour)
│  ├─ app.js, styles.css, logo-yodan.png
├─ .nojekyll           ← GitHub Pages sert les fichiers tels quels
├─ <projet>-<nom-maquette>/   ← une maquette = un dossier à la racine
│  └─ index.html, styles.css, app.js, images…
```
- Pas de sous-dossier par projet : toutes les maquettes sont **à la racine**, nommées `<projet>-<nom-maquette>` (minuscules, tirets, pas d'espace ni d'accent ni de `_`).
- Une maquette est autonome : elle ne référence pas les fichiers d'une autre maquette ni ceux de `annuaire/` (on copie l'asset si besoin).

## Ajouter ou modifier une maquette
1. Créer `<projet>-<nom-maquette>/` à la racine (conventions de la section 9 du CLAUDE.md parent).
2. L'inscrire dans `annuaire/maquettes.js` : `dossier`, `projet`, `titre`, `description`, `ecrans`, `roles` (facultatif), `tests: true` si la maquette a des tests de cohérence, `maj` (date `AAAA-MM-JJ`). La `description` tient en **une phrase courte** (≈ 15 mots) : le détail va dans le panneau Notes UX de la maquette. Ajouter le projet dans `PROJETS` s'il est nouveau (nom + couleur de charte).
3. Nouvelle version (`-v2`) : nouveau dossier + nouvelle entrée, et `remplacePar: "<dossier-v2>"` sur l'ancienne (elle est alors masquée par défaut dans l'annuaire).
4. À chaque modification de l'annuaire, incrémenter le `?v=` des assets concernés dans `index.html` (section 10 du parent) ; idem pour les assets d'une maquette.
5. Mettre à jour `maj` quand une maquette évolue de façon visible.

## Publication
- Commit et push uniquement sur demande ; message de commit explicite (ex. « Ajoute la maquette lonaci-parcours-resultat »).
- Avant de pousser : vérifier qu'aucun fichier ne contient de donnée réelle, de secret ou de capture (`browser-test` reste hors de ce dépôt).
