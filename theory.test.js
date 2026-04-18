// Minimal test runner for theory.js helpers. Run with `node theory.test.js`.
const { SCALES, CHORD_INTERVALS, spellScale, spellNote, noteIndex, noteName, chordPcs, suggestScalesForBracket } = require("./theory.js");

let passed = 0, failed = 0;
function ok(condition, label) {
  if (condition) { passed++; console.log(`  ok  ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}`);
    console.log(`       expected: ${e}`);
    console.log(`       actual:   ${a}`);
  }
}

function scaleLetters(root, scaleKey) {
  const def = SCALES[scaleKey];
  const map = spellScale(root, def.steps);
  const rootPc = noteIndex(root);
  return def.steps.map(s => spellNote((rootPc + s) % 12, map));
}

console.log("7-note scales should have seven distinct natural letters:");
eq(scaleLetters("G", "dorian"),     ["G","A","B♭","C","D","E","F"],         "G Dorian");
eq(scaleLetters("G", "ionian"),     ["G","A","B","C","D","E","F♯"],         "G Ionian");
eq(scaleLetters("D", "phrygian"),   ["D","E♭","F","G","A","B♭","C"],        "D Phrygian");
eq(scaleLetters("F", "lydian"),     ["F","G","A","B","C","D","E"],          "F Lydian");
eq(scaleLetters("F", "ionian"),     ["F","G","A","B♭","C","D","E"],         "F Ionian");
eq(scaleLetters("G", "aeolian"),    ["G","A","B♭","C","D","E♭","F"],        "G Aeolian");
eq(scaleLetters("G", "harmMin"),    ["G","A","B♭","C","D","E♭","F♯"],       "G Harmonic Minor");

console.log("\nEnharmonic root should pick the cleaner flat-letter spelling:");
eq(scaleLetters("A#", "dorian"),    ["B♭","C","D♭","E♭","F","G","A♭"],      "A# Dorian → B♭ Dorian");
eq(scaleLetters("F#", "lydian"),    ["G♭","A♭","B♭","C","D♭","E♭","F"],     "F# Lydian → G♭ Lydian");

console.log("\nSharp-leaning enharmonic roots should stay sharp:");
eq(scaleLetters("C#", "dorian"),    ["C♯","D♯","E","F♯","G♯","A♯","B"],     "C# Dorian stays sharp");

console.log("\nNon-7-note scales return null (fall back to sharp names):");
eq(spellScale("G", SCALES.blues.steps),       null, "Blues (6 notes) → null");
eq(spellScale("G", SCALES.majorPent.steps),   null, "Major pentatonic (5 notes) → null");
eq(spellScale("G", SCALES.dimWH.steps),       null, "Diminished (8 notes) → null");

// Simulate the renderer path: for every scale pc, look up its label via
// spellNote(pc, map). This catches any issue where the map isn't keyed or
// consulted correctly at render time.
console.log("\nRenderer simulation — scale pc lookups should never produce A♯ in G Dorian:");
(() => {
  const def = SCALES.dorian;
  const rootPc = noteIndex("G");
  const map = spellScale("G", def.steps);
  const labels = def.steps.map(s => spellNote((rootPc + s) % 12, map));
  eq(labels.includes("A♯"), false, "no A♯ appears anywhere in G Dorian labels");
  eq(labels.includes("A#"), false, "no ASCII A# appears either");
  eq(labels.includes("A") && labels.includes("B♭"), true, "both A and B♭ present");
})();

// Simulate the fretboard path: lookup across every pc 0..11 using the map.
// Anything in the scale must spell to the map's value; anything out of scale
// falls back to the sharp NOTES[] (but those pcs aren't labelled in the UI).
console.log("\nRenderer simulation — every scale pc returns its map spelling:");
(() => {
  const def = SCALES.dorian;
  const rootPc = noteIndex("G");
  const map = spellScale("G", def.steps);
  const scalePcs = def.steps.map(s => (rootPc + s) % 12);
  for (const pc of scalePcs) {
    eq(spellNote(pc, map), map[pc], `pc ${pc} → ${map[pc]}`);
  }
})();

// ── chordPcs ───────────────────────────────────────────────────────
console.log("\nchordPcs:");
eq(chordPcs("C", "major"), [0, 4, 7], "C major = C E G");
eq(chordPcs("G", "major"), [7, 11, 2], "G major = G B D");
eq(chordPcs("A", "minor"), [9, 0, 4], "A minor = A C E");
eq(chordPcs(7, "major"), [7, 11, 2], "G major by pc");

// ── suggestScalesForBracket ────────────────────────────────────────
console.log("\nsuggestScalesForBracket:");

// G major → Am: both diatonic to G major / C major
const gToAm = suggestScalesForBracket(
  { root: "G", quality: "major" },
  { root: "A", quality: "minor" }
);
ok(gToAm.length > 0, "G→Am returns suggestions");
ok(gToAm[0].fitsBoth, "G→Am top suggestion fits both chords");
// Top suggestion should be G-rooted (Ionian or Mixolydian) or C-rooted
const topRoot = gToAm[0].rootPc;
const topKey = gToAm[0].scaleKey;
ok(
  (topRoot === 7 && topKey === "ionian") ||
  (topRoot === 7 && topKey === "mixolydian") ||
  (topRoot === 0 && topKey === "ionian"),
  `G→Am top suggestion is sensible: ${gToAm[0].name}`
);
ok(gToAm[0].reasoning.length > 0, "G→Am has reasoning string");

// Same chord on both sides
const gToG = suggestScalesForBracket(
  { root: "G", quality: "major" },
  { root: "G", quality: "major" }
);
ok(gToG.length > 0, "G→G returns suggestions");
ok(gToG[0].fitsBoth, "G→G top fits both");

// One side null (first or last step in the sequence)
const gOnly = suggestScalesForBracket(
  { root: "G", quality: "major" },
  null
);
ok(gOnly.length > 0, "G→null returns suggestions");

const nullToAm = suggestScalesForBracket(
  null,
  { root: "A", quality: "minor" }
);
ok(nullToAm.length > 0, "null→Am returns suggestions");

// Non-diatonic pair: C major → F# major
const cToFsharp = suggestScalesForBracket(
  { root: "C", quality: "major" },
  { root: "F#", quality: "major" }
);
ok(cToFsharp.length > 0, "C→F# returns suggestions (even if none fit both)");
// Some may fit only one chord
const anyFitsBoth = cToFsharp.some(s => s.fitsBoth);
// C and F# major share no diatonic key, so fitsBoth should be false for most
// (though Lydian might work in some cases)

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
