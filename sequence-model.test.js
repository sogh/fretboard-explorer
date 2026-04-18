// Minimal test suite for sequence-model.js. Run with `node sequence-model.test.js`.
const {
  SEQUENCE_VERSION,
  chordStep, leadLineStep, patternStep, restStep, createStep,
  createSequence,
  validateStep, validateSequence,
  sequenceToJSON, sequenceFromJSON,
} = require("./sequence-model.js");

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

function ok(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}

// ── Step constructors ──────────────────────────────────────────────
console.log("Step constructors:");

const c = chordStep({ root: "G", quality: "major", durationBeats: 4 });
eq(c.kind, "chord", "chordStep has kind 'chord'");
eq(c.root, "G", "chordStep root");
eq(c.quality, "major", "chordStep quality");
eq(c.durationBeats, 4, "chordStep durationBeats");
eq(c.articulation, "strum_down", "chordStep default articulation");
ok(c.id, "chordStep has an id");

const ll = leadLineStep({ durationBeats: 8, scale: { root: "G", type: "ionian" } });
eq(ll.kind, "lead_line", "leadLineStep kind");
eq(ll.durationBeats, 8, "leadLineStep durationBeats");
eq(ll.bracketPrevious, true, "leadLineStep default bracketPrevious");
eq(ll.bracketNext, true, "leadLineStep default bracketNext");
eq(ll.fretRange, null, "leadLineStep default fretRange null");

const pat = patternStep({
  scale: { root: "A", type: "minorPent" },
  notes: [
    { string: 0, fret: 5, degree: "1", durationBeats: 1 },
    { string: 0, fret: 8, degree: "♭3", durationBeats: 1 },
  ],
});
eq(pat.kind, "pattern", "patternStep kind");
eq(pat.notes.length, 2, "patternStep has 2 notes");
eq(pat.scale.root, "A", "patternStep scale root");

const r = restStep({ durationBeats: 2 });
eq(r.kind, "rest", "restStep kind");
eq(r.durationBeats, 2, "restStep durationBeats");

// createStep convenience
const via = createStep("chord", { root: "D", quality: "minor" });
eq(via.kind, "chord", "createStep('chord') works");
eq(via.root, "D", "createStep passes opts through");

// ── Sequence constructor ───────────────────────────────────────────
console.log("\nSequence constructor:");

const seq = createSequence({
  name: "Test sequence",
  tempo: 100,
  steps: [c, ll, pat, r],
});
eq(seq.version, SEQUENCE_VERSION, "sequence version");
eq(seq.name, "Test sequence", "sequence name");
eq(seq.tempo, 100, "sequence tempo");
eq(seq.steps.length, 4, "sequence has 4 steps");
ok(seq.id, "sequence has an id");

// ── Validation ─────────────────────────────────────────────────────
console.log("\nValidation:");

eq(validateStep(c).length, 0, "valid chord step passes");
eq(validateStep(ll).length, 0, "valid lead_line step passes");
eq(validateStep(pat).length, 0, "valid pattern step passes");
eq(validateStep(r).length, 0, "valid rest step passes");
eq(validateSequence(seq).length, 0, "valid sequence passes");

// Invalid cases
ok(validateStep(null).length > 0, "null step fails validation");
ok(validateStep({}).length > 0, "empty object fails validation");
ok(validateStep({ id: "x", kind: "chord", durationBeats: 4, root: "C", quality: "major", articulation: "invalid", voicing: { positions: [] } }).length > 0, "invalid articulation caught");
ok(validateStep({ id: "x", kind: "lead_line", durationBeats: 4, scale: "bad", bracketPrevious: true, bracketNext: true, fretRange: null }).length > 0, "bad scale caught");
ok(validateStep({ id: "x", kind: "pattern", durationBeats: 4, scale: { root: "C", type: "ionian" }, notes: [{ string: 0, fret: 5 }] }).length > 0, "pattern note missing durationBeats caught");

const badSeq = createSequence({ tempo: -10 });
ok(validateSequence(badSeq).length > 0, "negative tempo caught");

// ── JSON round-trip ────────────────────────────────────────────────
console.log("\nJSON round-trip:");

const json = sequenceToJSON(seq);
ok(typeof json === "string", "sequenceToJSON returns a string");

const restored = sequenceFromJSON(json);
eq(restored.id, seq.id, "round-trip preserves id");
eq(restored.name, seq.name, "round-trip preserves name");
eq(restored.tempo, seq.tempo, "round-trip preserves tempo");
eq(restored.version, seq.version, "round-trip preserves version");
eq(restored.steps.length, seq.steps.length, "round-trip preserves step count");

// Deep check: each step round-trips
for (let i = 0; i < seq.steps.length; i++) {
  eq(restored.steps[i].kind, seq.steps[i].kind, `round-trip step[${i}] kind`);
  eq(restored.steps[i].id, seq.steps[i].id, `round-trip step[${i}] id`);
  eq(restored.steps[i].durationBeats, seq.steps[i].durationBeats, `round-trip step[${i}] durationBeats`);
}

// Chord-specific fields
const rc = restored.steps[0];
eq(rc.root, "G", "round-trip chord root");
eq(rc.quality, "major", "round-trip chord quality");
eq(rc.articulation, "strum_down", "round-trip chord articulation");

// Lead line fields
const rll = restored.steps[1];
eq(rll.scale.root, "G", "round-trip lead_line scale root");
eq(rll.bracketPrevious, true, "round-trip lead_line bracketPrevious");

// Pattern fields
const rp = restored.steps[2];
eq(rp.notes.length, 2, "round-trip pattern notes count");
eq(rp.scale.root, "A", "round-trip pattern scale root");

// Validate the restored sequence
eq(validateSequence(restored).length, 0, "restored sequence passes validation");

// ── Programmatic 4-step sequence (Phase 1 acceptance criterion) ───
console.log("\nProgrammatic 4-step sequence:");

const demo = createSequence({
  name: "G major practice",
  tempo: 80,
  steps: [
    chordStep({ root: "G", quality: "major", voicing: {
      positions: [
        { string: 0, fret: 3, degree: "1" },
        { string: 1, fret: 3, degree: "5" },
        { string: 2, fret: 0, degree: "3" },
      ],
      stringGroup: "E-B-G"
    }}),
    leadLineStep({ scale: { root: "G", type: "ionian" }, durationBeats: 8 }),
    chordStep({ root: "A", quality: "minor", articulation: "arpeggiate_up", voicing: {
      positions: [
        { string: 0, fret: 5, degree: "1" },
        { string: 1, fret: 5, degree: "5" },
        { string: 2, fret: 2, degree: "♭3" },
      ],
      stringGroup: "E-B-G"
    }}),
    restStep({ durationBeats: 4 }),
  ],
});

eq(demo.steps.length, 4, "demo has 4 steps");
eq(validateSequence(demo).length, 0, "demo passes validation");
const demoJson = sequenceToJSON(demo);
const demoRestored = sequenceFromJSON(demoJson);
eq(validateSequence(demoRestored).length, 0, "demo round-trips cleanly");
eq(demoRestored.steps.map(s => s.kind).join(","), "chord,lead_line,chord,rest", "demo step kinds correct");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
