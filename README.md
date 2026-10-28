# Carnet de grilles

PWA qui transforme une capture d'écran de mots croisés en grille jouable : repérage de la grille et des cases bleues, lecture des définitions en local (Tesseract.js), écran de vérification, puis jeu avec définitions horizontale et verticale au toucher.

Tout tourne sur le téléphone, hors ligne une fois l'appli installée. Aucune donnée n'est envoyée.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | L'appli : accueil, import, vérification, jeu |
| `recognize.js` | Analyse d'image : grille, cases bleues, colonnes de texte, découpage des définitions, contrôle de cohérence |
| `sw.js` | Service worker : cache hors ligne et réception des captures partagées |
| `manifest.webmanifest` | Installation et cible « Partager vers… » |
| `vendor/`, `core/`, `lang/` | Moteur OCR Tesseract.js 5.1.1 et modèle français (LSTM, `best_int`) |
| `tools/test-recognize.js` | Test de la reconnaissance sous Node, sur une capture |

## Déployer sur Firebase Hosting

Même principe que voisinage-v2, sans étape de build : Firebase publie le dossier tel quel.

Une seule fois :

1. Crée un projet sur la console Firebase (Hosting suffit, ni Firestore ni Functions).
2. Mets son identifiant dans `.firebaserc` à la place de `carnet-de-grilles` si tu en as choisi un autre.
3. Installe et connecte la CLI si ce n'est pas déjà fait :
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

Ensuite, à chaque mise en ligne :

```bash
npm run deploy        # = firebase deploy --only hosting
```

L'appli est servie à `https://<id-du-projet>.web.app`. `firebase.json` exclut `tools/`, le README et les fichiers npm, empêche la mise en cache navigateur de `sw.js` et `index.html`, et met en cache longue durée le moteur OCR.

Pour garder le code sur GitHub : crée le dépôt `mots-croises-pwa`, puis `git remote add origin …` et `git push -u origin main`.

## Installer sur Android

1. Ouvre l'URL dans **Chrome**.
2. Menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
3. Une fois installée, « Carnet de grilles » apparaît dans le menu **Partager** d'Android : depuis la capture, Partager → Carnet de grilles, et l'analyse démarre directement.

Le partage direct ne fonctionne qu'avec l'appli installée depuis Chrome. Sur iPhone, l'appli fonctionne mais on importe par le bouton.

## Développer

```bash
npm start                                   # http://localhost:8080 (le service worker marche sur localhost)
firebase serve --only hosting               # même chose, servi comme en production
npm install
npm run test:capture -- chemin/capture.jpg  # reconnaissance seule, affiche le JSON et les incohérences
```

**Après chaque modification**, incrémente `VERSION` dans `sw.js` (`mc-v1` → `mc-v2`…). Sinon les téléphones gardent l'ancienne version en cache.

## Format d'une grille

```json
{
  "id": "croises-9709",
  "title": "Croisés n° 9709",
  "rows": 10, "cols": 10,
  "rowLabels": ["1", "…", "10"], "colLabels": ["A", "…", "J"],
  "layout": ["..........", "...##....#", "…"],
  "across": [["Déf. 1er mot ligne 1"], ["…"]],
  "down":   [["Déf. 1er mot colonne A"], ["…"]]
}
```

`#` = case noire (bleue dans la source). Les mots sont les suites de 2 cases ou plus ; la n-ième définition d'une ligne va au n-ième mot de cette ligne. Le contrôle de cohérence compare ces deux nombres.

## Export et import

- **Exporter toutes les grilles** (accueil) : un fichier `carnet-de-grilles-AAAA-MM-JJ.json` avec toutes les grilles et ta progression. Sert de sauvegarde ou pour changer de téléphone.
- **Envoyer** (sur une grille) : un fichier avec cette grille seule, vierge, pour la faire jouer à quelqu'un.
- **Importer des grilles** : un fichier ou le texte collé. Une grille déjà présente garde la version la plus avancée ; une grille de même identifiant mais différente est ajoutée à part.
- Sur Android, un fichier reçu (WhatsApp, mail…) s'ouvre aussi par Partager → Carnet de grilles.

Format :

```json
{ "format": "carnet-de-grilles", "version": 1, "exportedAt": "…",
  "grids": [ { "puzzle": { … }, "letters": ["A", "", …] } ] }
```

`letters` est absent d'une grille envoyée. L'import accepte aussi une grille seule (l'objet `puzzle`).

## Limites connues

- Réglé pour la mise en page de la source actuelle : quadrillage noir, cases bleues, définitions en deux colonnes sous la grille, numéro sur le bandeau vertical à droite.
- Captures en mode clair uniquement.
- Les mots fléchés ne sont pas encore gérés.
