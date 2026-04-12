// Minimal test runner for theory.js helpers. Run with `node theory.test.js`.
const { SCALES, spellScale, spellNote, noteIndex } = require("./theory.js");

let passed = 0, failed = 0;
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
