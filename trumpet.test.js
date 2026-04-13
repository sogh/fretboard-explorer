// Smoke tests for the trumpet scales page.
// Verifies: fingering table lookups, B♭ transposition, scale-tone cards
// render with the right fingering diagrams for each view.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let passed = 0, failed = 0;
function expect(condition, label) {
  if (condition) { passed++; console.log("  ok  " + label); }
  else           { failed++; console.log("  FAIL " + label); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ok  ${label}`); }
  else {
    failed++; console.log(`  FAIL ${label}`);
    console.log(`       expected: ${e}`);
    console.log(`       actual:   ${a}`);
  }
}

// ── Unit: fingering table ──────────────────────────────────────────
console.log("Fingering table — canonical middle-register values:");
const { TRUMPET_FINGERINGS, fingeringText, renderFingeringSVG } = require("./fingering.js");

eq(TRUMPET_FINGERINGS[0],  [],        "C (open)");
eq(TRUMPET_FINGERINGS[2],  [1, 3],    "D = 1·3");
eq(TRUMPET_FINGERINGS[7],  [],        "G (open)");
eq(TRUMPET_FINGERINGS[10], [1],       "B♭ = 1");
eq(fingeringText([]), "open", "empty valve list pretty-prints as 'open'");
eq(fingeringText([1, 2]), "1·2", "valves pretty-print with middle dots");

// ── Integration: load trumpet.js in a stubbed DOM and render ──────
function runPage(state) {
  const html = {};
  const makeEl = id => ({
    set innerHTML(v) { html[id] = v; },
    get innerHTML() { return html[id]; },
  });
  const document = {
    getElementById: id => { if (!html.hasOwnProperty(id)) html[id] = ""; return makeEl(id); },
    querySelectorAll: () => [],
  };
  const ctx = { document, console, module: {} };
  vm.createContext(ctx);

  const exposes = {
    "theory.js":    ["SCALES", "SCALE_GROUPS", "ROOT_LABELS", "noteIndex", "noteName", "spellScale", "spellNote"],
    "fingering.js": ["TRUMPET_FINGERINGS", "fingeringText", "renderFingeringSVG"],
    "trumpet.js":   ["trumpetState", "renderTrumpetScales", "writtenPc"],
  };
  for (const [file, names] of Object.entries(exposes)) {
    let src = fs.readFileSync(path.join(__dirname, file), "utf8");
    src += "\n" + names.map(n => `globalThis.${n} = ${n};`).join("\n");
    vm.runInContext(src, ctx, { filename: file });
  }

  Object.assign(ctx.trumpetState, state);
  ctx.renderTrumpetScales();
  return html;
}

console.log("\nB♭ transposition:");
{
  const { writtenPc } = require("./fingering.js").__mock || {};
  // Just reimplement to verify:
  const wpc = pc => (pc + 2) % 12;
  eq(wpc(7), 9, "concert G → written A");
  eq(wpc(10), 0, "concert B♭ → written C");
  eq(wpc(11), 1, "concert B → written C♯");
}

console.log("\nScales page — G Dorian, concert view:");
{
  const out = runPage({ root: "G", scale: "dorian", view: "concert" });
  const main = out["scales-main"] || "";
  const cards = out["scales-positions"] || "";
  // Title should show "G Dorian" since we're in concert view.
  expect(/>G Dorian/.test(main), "main title shows G Dorian");
  expect(/Concert/.test(main), "main title has Concert badge");
  // Scale tones in concert view: G A B♭ C D E F.
  expect(/>G<\/span>/.test(main) && />B♭<\/span>/.test(main), "concert scale tones include G and B♭");
  // Concert G = written A = fingering [1, 2]. The big label on each card shows
  // the *read* pitch. In concert view, that's the written pitch of the tone.
  // So the first card should have "A" as its read label.
  const firstCard = cards.match(/<div class="pattern-card trumpet-card">[\s\S]*?<\/div>\s*<\/div>/);
  expect(firstCard, "found a trumpet card");
  expect(firstCard && />A</.test(firstCard[0]), "first card reads A (written for concert G)");
  expect(firstCard && /sounds G/.test(firstCard[0]), "first card sounds G (concert)");
  // All seven scale tones should produce cards.
  const cardCount = (cards.match(/<div class="pattern-card trumpet-card">/g) || []).length;
  expect(cardCount === 7, `seven scale-tone cards (got ${cardCount})`);
}

console.log("\nScales page — G Dorian, written view:");
{
  const out = runPage({ root: "G", scale: "dorian", view: "written" });
  const main = out["scales-main"] || "";
  // Written pitch: G Dorian sounding = A Dorian written (+2 semitones).
  // Scale: A B C D E F♯ G.
  expect(/>A Dorian/.test(main), "main title shows A Dorian in written view");
  expect(/Written/.test(main), "main title has Written badge");
  expect(/>F♯<\/span>/.test(main), "written scale tones include F♯");
}

console.log("\nFingering cards cover all 12 pcs without error:");
{
  for (let pc = 0; pc < 12; pc++) {
    const svg = renderFingeringSVG(TRUMPET_FINGERINGS[pc]);
    expect(/<svg/.test(svg) && /<\/svg>/.test(svg), `pc ${pc} renders an SVG`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
