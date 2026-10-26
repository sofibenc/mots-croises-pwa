/* Reconnaissance d'une grille de mots croisés à partir d'une capture.
 * Fonctions pures sur une image {width, height, data(RGBA)} : marche dans le navigateur et sous Node.
 * L'OCR lui-même est fait par l'appelant (Tesseract.js) sur les zones renvoyées ici. */
(function (root) {
  "use strict";

  const px = (img, x, y) => (y * img.width + x) * 4;
  const isInk = (img, x, y) => { const i = px(img, x, y), d = img.data; return Math.max(d[i], d[i + 1], d[i + 2]) < 90; };
  const isBlue = (img, x, y) => { const i = px(img, x, y), d = img.data; return d[i + 2] > 150 && d[i + 2] - d[i] > 70 && d[i + 1] > 80; };

  // Plus longue suite de pixels d'encre sur chaque colonne (axis "x") ou ligne (axis "y")
  function longestRuns(img, axis) {
    const W = img.width, H = img.height, n = axis === "x" ? W : H, m = axis === "x" ? H : W;
    const out = new Int32Array(n);
    for (let a = 0; a < n; a++) {
      let best = 0, cur = 0;
      for (let b = 0; b < m; b++) {
        if (axis === "x" ? isInk(img, a, b) : isInk(img, b, a)) { if (++cur > best) best = cur; } else cur = 0;
      }
      out[a] = best;
    }
    return out;
  }

  // Regroupe les positions voisines en traits ; chaque trait garde sa longueur
  function findLines(runs, minRun) {
    const lines = []; let start = -1, best = 0;
    for (let a = 0; a <= runs.length; a++) {
      const on = a < runs.length && runs[a] >= minRun;
      if (on) { if (start < 0) { start = a; best = 0; } if (runs[a] > best) best = runs[a]; }
      if (!on && start >= 0) { lines.push({ pos: (start + a - 1) / 2, run: best }); start = -1; }
    }
    return lines;
  }

  // Plus longue suite de traits régulièrement espacés et de même longueur (le quadrillage).
  // Un trait parasite (bord d'une autre grille, filet de mise en page) n'a ni l'écart ni la longueur.
  function regular(lines) {
    let best = [];
    for (let s = 0; s < lines.length - 1; s++) {
      for (let t = s + 1; t < lines.length; t++) {
        const step = lines[t].pos - lines[s].pos, ref = lines[s].run;
        if (step < 8) continue;
        const same = l => Math.abs(l.run - ref) <= ref * 0.2;
        if (!same(lines[t])) continue;
        const seq = [lines[s], lines[t]];
        for (let k = t + 1; k < lines.length; k++) {
          const d = lines[k].pos - seq[seq.length - 1].pos;
          if (Math.abs(d - step) <= Math.max(3, step * 0.12) && same(lines[k])) seq.push(lines[k]);
          else if (d > step * 1.2) break;
        }
        const better = seq.length > best.length ||
          (seq.length === best.length && seq.length && seq[0].run > best[0].run);
        if (better) best = seq;
      }
    }
    return best.map(l => l.pos);
  }

  function detectGrid(img) {
    const minRun = Math.max(40, Math.round(Math.min(img.width, img.height) * 0.15));
    const xs = regular(findLines(longestRuns(img, "x"), minRun));
    const ys = regular(findLines(longestRuns(img, "y"), minRun));
    if (xs.length < 4 || ys.length < 4) throw new Error("Grille introuvable : aucun quadrillage régulier détecté.");
    const rows = ys.length - 1, cols = xs.length - 1;
    const layout = [];
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        const x0 = xs[c], x1 = xs[c + 1], y0 = ys[r], y1 = ys[r + 1];
        const mx = (x1 - x0) * 0.25, my = (y1 - y0) * 0.25;
        let blue = 0, tot = 0;
        for (let y = Math.round(y0 + my); y < y1 - my; y += 2)
          for (let x = Math.round(x0 + mx); x < x1 - mx; x += 2) { tot++; if (isBlue(img, x, y)) blue++; }
        line += blue / tot > 0.5 ? "#" : ".";
      }
      layout.push(line);
    }
    return { xs, ys, rows, cols, layout,
      box: { x0: xs[0], y0: ys[0], x1: xs[xs.length - 1], y1: ys[ys.length - 1] } };
  }

  // Zone des définitions sous la grille, coupée en deux colonnes sur le plus large couloir vide
  function textColumns(img, grid) {
    const W = img.width, H = img.height;
    const top = Math.min(H - 1, Math.round(grid.box.y1 + 4));
    const prof = new Int32Array(W);
    for (let x = 0; x < W; x++) { let n = 0; for (let y = top; y < H; y++) if (isInk(img, x, y)) n++; prof[x] = n; }
    let bestS = -1, bestL = 0, s = -1;
    for (let x = Math.round(W * 0.3); x <= Math.round(W * 0.7); x++) {
      const empty = prof[x] <= 1 && x < Math.round(W * 0.7);
      if (empty && s < 0) s = x;
      if (!empty && s >= 0) { if (x - s > bestL) { bestL = x - s; bestS = s; } s = -1; }
    }
    const split = bestS >= 0 ? Math.round(bestS + bestL / 2) : Math.round(W / 2);
    const end = barrier(img, split + 1, top, H, 0.4);
    return { top, left: { x: 0, y: top, w: split, h: H - top }, right: { x: split, y: top, w: end - split, h: H - top } };
  }

  // Bandeau vertical à droite de la grille (numéro de la grille)
  function sideStrip(img, grid) {
    const x = Math.round(grid.box.x1 + 3), y = Math.round(grid.box.y0), y1 = Math.round(grid.box.y1);
    const end = barrier(img, x + 2, y, y1, 0.6);
    return { x, y, w: end - x, h: y1 - y };
  }

  // Premier trait vertical d'encre à partir de x0 couvrant au moins `share` de la hauteur [y0, y1)
  function barrier(img, x0, y0, y1, share) {
    const need = (y1 - y0) * share;
    for (let x = x0; x < img.width; x++) {
      let best = 0, cur = 0;
      for (let y = y0; y < y1; y++) { if (isInk(img, x, y)) { if (++cur > best) best = cur; } else cur = 0; }
      if (best >= need) return Math.max(x0 + 1, x - 2);
    }
    return img.width;
  }

  // ---- Lecture du texte OCR ----
  const FIX_NUM = { l: "1", I: "1", i: "1", "|": "1", "!": "1", O: "0", o: "0", S: "5", B: "8", Z: "2" };
  const FIX_ALPHA = { "6": "G", "1": "I", l: "I", "|": "I", "0": "O", "8": "B", "5": "S", "2": "Z" };

  function labelOf(line, kind) {
    const m = line.match(/^\s*([0-9A-Za-z|!]{1,2})\s?[.,:;]\s*(.*)$/);
    if (!m) return null;
    const fix = kind === "num" ? FIX_NUM : FIX_ALPHA;
    let tok = m[1].split("").map(ch => fix[ch] || ch).join("");
    if (kind === "alpha") tok = tok.toUpperCase();
    return { label: tok, rest: m[2] };
  }

  function cleanText(t) {
    return t.replace(/[‘’`´]/g, "'").replace(/\s+/g, " ").replace(/\s+([.,])/g, "$1")
      .replace(/(^|[.!?]\s+)l(?=[bcdfghjkmnpqrstvwxz])/g, "$1I").trim();
  }

  // lines : textes OCR ligne par ligne ; labels : étiquettes attendues dans l'ordre
  function parseColumn(lines, labels, kind) {
    const entries = labels.map(() => "");
    let k = -1;
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) continue;
      const lab = labelOf(line, kind);
      if (lab && k + 1 < labels.length && lab.label === labels[k + 1]) { k++; entries[k] = lab.rest; continue; }
      if (k < 0) continue;                                     // titre « Horizontalement: » etc.
      const prev = entries[k];
      if (/[a-zàâçéèêëîïôûùüÿœ]-$/.test(prev) && /^[a-zàâçéèêëîïôûùüÿœ]/.test(line.trim())) entries[k] = prev.slice(0, -1) + line.trim();
      else entries[k] = prev + " " + line.trim();
    }
    return entries.map(e => splitDefs(cleanText(e)));
  }

  function splitDefs(text) {
    if (!text) return [];
    return text.split(/(?<=[.!?…])\s+(?=\S)/).map(s => s.trim()).filter(Boolean);
  }

  // Nombre de mots (2 cases et plus) par ligne et par colonne
  function segmentCounts(layout) {
    const R = layout.length, C = layout[0].length;
    const count = seq => seq.split("#").filter(s => s.length >= 2).length;
    const across = layout.map(count);
    const down = [];
    for (let c = 0; c < C; c++) down.push(count(layout.map(r => r[c]).join("")));
    return { across, down };
  }

  function rowLabels(n) { return Array.from({ length: n }, (_, i) => String(i + 1)); }
  function colLabels(n) { return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)); }

  function assemble(grid, leftLines, rightLines, stripText) {
    const rl = rowLabels(grid.rows), cl = colLabels(grid.cols);
    const across = parseColumn(leftLines, rl, "num");
    const down = parseColumn(rightLines, cl, "alpha");
    const num = (stripText || "").replace(/\s+/g, " ").match(/N\s*[°º"o0]?\s*(\d{3,6})/i);
    const counts = segmentCounts(grid.layout);
    const issues = [];
    across.forEach((d, i) => { if (d.length !== counts.across[i]) issues.push({ dir: "H", line: i, words: counts.across[i], defs: d.length }); });
    down.forEach((d, i) => { if (d.length !== counts.down[i]) issues.push({ dir: "V", line: i, words: counts.down[i], defs: d.length }); });
    return {
      puzzle: {
        id: "croises-" + (num ? num[1] : Date.now().toString(36)),
        title: num ? "Croisés n° " + num[1] : "Grille importée",
        rows: grid.rows, cols: grid.cols, rowLabels: rl, colLabels: cl,
        layout: grid.layout, across, down
      },
      issues
    };
  }

  // Rotation de 90° (sens horaire) d'une zone, pour lire un texte écrit de bas en haut
  function cropRotateCW(img, r) {
    const out = { width: r.h, height: r.w, data: new Uint8ClampedArray(r.w * r.h * 4) };
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const s = px(img, r.x + x, r.y + y), nx = r.h - 1 - y, ny = x, t = (ny * out.width + nx) * 4;
      for (let k = 0; k < 4; k++) out.data[t + k] = img.data[s + k];
    }
    return out;
  }

  const api = { detectGrid, textColumns, sideStrip, parseColumn, splitDefs, segmentCounts, assemble, cropRotateCW };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Recognize = api;
})(typeof self !== "undefined" ? self : this);
