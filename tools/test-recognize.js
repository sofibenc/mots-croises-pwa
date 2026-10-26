// Teste la reconnaissance sur une capture, sans navigateur.
// Usage : npm install  puis  node tools/test-recognize.js chemin/vers/capture.jpg
const fs = require("fs");
const path = require("path");
const jpeg = require("jpeg-js");
const { PNG } = require("pngjs");
const Tesseract = require("tesseract.js");
const R = require("../recognize.js");

function decode(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0x89) { const p = PNG.sync.read(buf); return { width: p.width, height: p.height, data: p.data }; }
  return jpeg.decode(buf, { useTArray: true });
}
function toPng(img, r) {
  const out = new PNG({ width: r.w, height: r.h });
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const s = ((r.y + y) * img.width + r.x + x) * 4, t = (y * r.w + x) * 4;
    for (let k = 0; k < 4; k++) out.data[t + k] = img.data[s + k];
  }
  return PNG.sync.write(out);
}

(async () => {
  const file = process.argv[2];
  if (!file) { console.error("Usage : node tools/test-recognize.js capture.jpg"); process.exit(1); }
  const img = decode(file);
  const grid = R.detectGrid(img);
  console.log(`Grille ${grid.rows}×${grid.cols}\n` + grid.layout.join("\n"));

  const worker = await Tesseract.createWorker("fra", 1, { langPath: path.join(__dirname, "..", "lang"), cacheMethod: "none" });
  await worker.setParameters({ preserve_interword_spaces: "1" });
  const cols = R.textColumns(img, grid);
  const left = (await worker.recognize(toPng(img, cols.left))).data.lines.map(l => l.text);
  const right = (await worker.recognize(toPng(img, cols.right))).data.lines.map(l => l.text);
  const rot = R.cropRotateCW(img, R.sideStrip(img, grid));
  const strip = (await worker.recognize(toPng(rot, { x: 0, y: 0, w: rot.width, h: rot.height }))).data.text;
  await worker.terminate();

  const { puzzle, issues } = R.assemble(grid, left, right, strip);
  console.log(JSON.stringify(puzzle, null, 2));
  console.log(issues.length ? `\n${issues.length} incohérence(s) :` : "\nTout est cohérent.");
  issues.forEach(i => console.log(`  ${i.dir === "H" ? "Ligne" : "Colonne"} ${i.line + 1} : ${i.words} mots, ${i.defs} définitions`));
})();
