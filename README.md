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

## Déployer sur GitHub Pages

```bash
cd mots-croises-pwa
git remote add origin git@github.com:<ton-compte>/mots-croises-pwa.git
git push -u origin main
```

Puis dans le dépôt GitHub : **Settings → Pages → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
L'appli est servie à `https://<ton-compte>.github.io/mots-croises-pwa/`. Tous les chemins sont relatifs, le sous-dossier ne pose pas de problème.

Netlify ou Cloudflare Pages marchent aussi : on publie le dossier tel quel, sans étape de build.

## Installer sur Android

1. Ouvre l'URL dans **Chrome**.
2. Menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
3. Une fois installée, « Carnet de grilles » apparaît dans le menu **Partager** d'Android : depuis la capture, Partager → Carnet de grilles, et l'analyse démarre directement.

Le partage direct ne fonctionne qu'avec l'appli installée depuis Chrome. Sur iPhone, l'appli fonctionne mais on importe par le bouton.

## Développer

```bash
npm start                                   # http://localhost:8080 (le service worker marche sur localhost)
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

## Limites connues

- Réglé pour la mise en page de la source actuelle : quadrillage noir, cases bleues, définitions en deux colonnes sous la grille, numéro sur le bandeau vertical à droite.
- Captures en mode clair uniquement.
- Les mots fléchés ne sont pas encore gérés.
