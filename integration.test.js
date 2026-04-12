// End-to-end check: load theory.js + scales-modes.js + triad-explorer.js in a
// shared V8 context, simulate a DOM just enough for renderScalesPage() to run,
// and grep the rendered SVG for stray sharp names that should have been
// resolved to flats.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

function run(test) {
  // Stub DOM. Each getElementById returns an object whose innerHTML is
  // captured in `html`. Query selectors do nothing — we only care about output.
  const html = {};
  const makeEl = id => ({ set innerHTML(v) { html[id] = v; }, get innerHTML() { return html[id]; } });
  // Return a fresh capture-stub for any id queried — triad-explorer.js calls
  // render() at load time and touches IDs that aren't on the scales page.
  const document = {
    getElementById: id => { if (!html.hasOwnProperty(id)) html[id] = ""; return makeEl(id); },
    querySelectorAll: () => [],
  };

  const ctx = { document, console, module: {} };
  vm.createContext(ctx);

  // Order matters — match index.html. Append an explicit globalThis export
  // because `const`/`let` declarations in vm-run scripts don't leak to the
  // context object (only `var` does).
  const exposes = {
    "theory.js":        ["spellScale", "spellNote", "SCALES", "noteIndex"],
    "triad-explorer.js": ["STANDARD_TUNING", "NUM_FRETS"],
    "scales-modes.js":   ["scaleState", "renderScalesPage"],
  };
  for (const [file, names] of Object.entries(exposes)) {
    let src = fs.readFileSync(path.join(__dirname, file), "utf8");
    src += "\n" + names.map(n => `globalThis.${n} = ${n};`).join("\n");
    vm.runInContext(src, ctx, { filename: file });
  }

  // Drive the state and re-render.
  ctx.scaleState.root = test.root;
  ctx.scaleState.scale = test.scale;
  ctx.scaleState.labelMode = "note";
  ctx.renderScalesPage();

  return html;
}

let passed = 0, failed = 0;
function expect(condition, label) {
  if (condition) { passed++; console.log("  ok  " + label); }
  else           { failed++; console.log("  FAIL " + label); }
}

console.log("Integration — rendered SVG for G Dorian in note mode:");
const out = run({ root: "G", scale: "dorian" });
const allHtml = Object.values(out).join("\n");

// The specific user bug: G Dorian's pattern-notes-list shouldn't contain A#.
// Find the G Dorian card by its heading and grab the notes-list inside it.
const dorianCard = allHtml.match(/<div class="pattern-card[^>]*>\s*<div class="pattern-name">[^<]*Dorian[^<]*<\/div>[\s\S]*?<\/div>\s*<\/div>/);
expect(dorianCard, "found a G Dorian pattern card");
const dorianList = dorianCard && dorianCard[0].match(/<div class="pattern-notes-list">([^<]*)<\/div>/);
expect(dorianList && !/A#/.test(dorianList[1]), `G Dorian notes list has no A# — got: "${dorianList && dorianList[1]}"`);
expect(dorianList && /B♭/.test(dorianList[1]), `G Dorian notes list contains B♭`);

const dorianNoteLists = allHtml.match(/<div class="pattern-notes-list">[^<]*<\/div>/g) || [];

// Any 7-note scale pattern listed on the page should have no letter repeats.
for (const m of dorianNoteLists) {
  const inner = m.replace(/<[^>]+>/g, "").trim();
  const notes = inner.split(" · ");
  if (notes.length !== 7) continue; // only checking 7-note scales
  const letters = notes.map(n => n[0]);
  const unique = new Set(letters);
  expect(unique.size === 7, `7-note scale has distinct letters: ${inner}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
