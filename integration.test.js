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
  const instrumentKey = test.instrument || "guitar";

  // Order matters — match index.html. Append an explicit globalThis export
  // because `const`/`let` declarations in vm-run scripts don't leak to the
  // context object (only `var` does).
  const exposes = {
    "theory.js":         ["spellScale", "spellNote", "SCALES", "noteIndex"],
    "instruments.js":    ["INSTRUMENTS", "getInstrument", "fretPositionPlayable"],
    "triad-explorer.js": ["state", "render"],
    "scales-modes.js":   ["scaleState", "renderScalesPage"],
  };
  for (const [file, names] of Object.entries(exposes)) {
    let src = fs.readFileSync(path.join(__dirname, file), "utf8");
    // Re-assign currentInstrumentKey each run so tests can swap instruments.
    if (file === "instruments.js") names.push(..."currentInstrumentKey".split(" "));
    src += "\n" + names.map(n => `globalThis.${n} = ${n};`).join("\n");
    // Let tests mutate currentInstrumentKey via a setter.
    if (file === "instruments.js") {
      src += `\nglobalThis.setInstrument = k => { currentInstrumentKey = k; };`;
    }
    vm.runInContext(src, ctx, { filename: file });
  }

  // Drive state and re-render for the requested instrument.
  ctx.setInstrument(instrumentKey);
  ctx.state.selectedPattern = null;
  ctx.state.stringGroup = 0;
  ctx.scaleState.root = test.root;
  ctx.scaleState.scale = test.scale;
  ctx.scaleState.labelMode = "note";
  ctx.scaleState.position = -1;
  ctx.render();
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

// ── Instrument-swap smoke tests ────────────────────────────────────
// Each fretted instrument should render G Dorian on the Scales page without
// crashing, should produce the expected number of string lines in the SVG,
// and should still honour the enharmonic fix (no A# next to A).
const stringCounts = {
  guitar: 6, bass: 4, ukulele: 4, banjo5: 5, banjoTenor: 4, mandolin: 4,
};
for (const [key, expectedStrings] of Object.entries(stringCounts)) {
  console.log(`\nInstrument smoke — ${key} @ G Dorian:`);
  const outI = run({ root: "G", scale: "dorian", instrument: key });
  const mainSvg = outI["scales-main"] || "";
  const stringLines = (mainSvg.match(/stroke="var\(--string-color\)"/g) || []).length;
  expect(stringLines === expectedStrings,
    `main fretboard has ${expectedStrings} string lines (got ${stringLines})`);
  // Only check the Scales page output — the Triads page may legitimately show
  // A♯ in a ♭III chord pattern label (3-note chord, not a 7-note scale, so
  // spellScale doesn't apply). The scale renderer itself should be clean.
  expect(!/>A#</.test(mainSvg) && !/>A♯</.test(mainSvg),
    `no A♯ in scale fretboard for ${key}`);
}

// ── Banjo drone-string: no scale notes on frets 0–4 of string index 4 ──
console.log("\nBanjo 5-string drone — G major:");
{
  const outB = run({ root: "G", scale: "ionian", instrument: "banjo5" });
  const mainSvg = outB["scales-main"] || "";
  // On 5 strings with spacing 22 and tp 24, string index 4 is at y = 24 + 4*22 = 112.
  // Find scale-note circles at that y and confirm none are on frets 1–4
  // (i.e. x positions corresponding to the first 4 frets).
  const droneDots = mainSvg.match(/<circle cx="[^"]+" cy="112" r="[89]"[^/]+fill="var\(--[^"]+"/g) || [];
  // We just need to know none of them are in the first ~100px (which covers frets 0–4 at fs=38).
  // lp=14, fs=38 → fret 5 center ≈ lp + 4*fs + fs/2 = 14 + 152 + 19 = 185.
  const earlyDots = droneDots.filter(d => {
    const cx = parseFloat(d.match(/cx="([\d.]+)"/)[1]);
    return cx < 185;
  });
  expect(earlyDots.length === 0,
    `drone string (string 4) has no scale-note circles below fret 5 (got ${earlyDots.length})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
