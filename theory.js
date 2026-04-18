// ── Shared music theory ─────────────────────────────────────────────
// Instrument-agnostic constants and helpers. Loaded before any instrument
// renderer or page module; its names live on the global scope.

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const noteIndex = n => NOTES.indexOf(n);
const noteName  = i => NOTES[((i % 12) + 12) % 12];

const CHORD_INTERVALS = {
  major: [0, 4, 7],  minor: [0, 3, 7],
  dim:   [0, 3, 6],  aug:   [0, 4, 8],
  sus2:  [0, 2, 7],  sus4:  [0, 5, 7],
  maj7:  [0, 4, 7, 11], dom7: [0, 4, 7, 10],
  min7:  [0, 3, 7, 10], mM7:  [0, 3, 7, 11],
  dim7:  [0, 3, 6, 9],  m7b5: [0, 3, 6, 10],
};

// Scale catalogue. Each entry: { name, steps (semitones from root), degrees, formula }.
const SCALES = {
  ionian:     { name: "Ionian (major)",   steps: [0,2,4,5,7,9,11],           degrees: ["1","2","3","4","5","6","7"],             formula: "W W H W W W H" },
  dorian:     { name: "Dorian",           steps: [0,2,3,5,7,9,10],           degrees: ["1","2","♭3","4","5","6","♭7"],           formula: "W H W W W H W" },
  phrygian:   { name: "Phrygian",         steps: [0,1,3,5,7,8,10],           degrees: ["1","♭2","♭3","4","5","♭6","♭7"],         formula: "H W W W H W W" },
  lydian:     { name: "Lydian",           steps: [0,2,4,6,7,9,11],           degrees: ["1","2","3","♯4","5","6","7"],            formula: "W W W H W W H" },
  mixolydian: { name: "Mixolydian",       steps: [0,2,4,5,7,9,10],           degrees: ["1","2","3","4","5","6","♭7"],            formula: "W W H W W H W" },
  aeolian:    { name: "Aeolian (minor)",  steps: [0,2,3,5,7,8,10],           degrees: ["1","2","♭3","4","5","♭6","♭7"],          formula: "W H W W H W W" },
  locrian:    { name: "Locrian",          steps: [0,1,3,5,6,8,10],           degrees: ["1","♭2","♭3","4","♭5","♭6","♭7"],        formula: "H W W H W W W" },
  majorPent:  { name: "Major Pentatonic", steps: [0,2,4,7,9],                degrees: ["1","2","3","5","6"],                     formula: "W W m3 W m3" },
  minorPent:  { name: "Minor Pentatonic", steps: [0,3,5,7,10],               degrees: ["1","♭3","4","5","♭7"],                   formula: "m3 W W m3 W" },
  blues:      { name: "Blues",            steps: [0,3,5,6,7,10],             degrees: ["1","♭3","4","♭5","5","♭7"],              formula: "minor pent + ♭5" },
  harmMin:    { name: "Harmonic Minor",   steps: [0,2,3,5,7,8,11],           degrees: ["1","2","♭3","4","5","♭6","7"],           formula: "W H W W H m3 H" },
  melMin:     { name: "Melodic Minor",    steps: [0,2,3,5,7,9,11],           degrees: ["1","2","♭3","4","5","6","7"],            formula: "W H W W W W H" },
  wholeTone:  { name: "Whole Tone",       steps: [0,2,4,6,8,10],             degrees: ["1","2","3","♯4","♯5","♭7"],              formula: "W W W W W W" },
  dimWH:      { name: "Diminished (W-H)", steps: [0,2,3,5,6,8,9,11],         degrees: ["1","2","♭3","4","♭5","♭6","𝄫7","7"],     formula: "W H W H W H W H" },
  dimHW:      { name: "Diminished (H-W)", steps: [0,1,3,4,6,7,9,10],         degrees: ["1","♭2","♭3","3","♭5","5","6","♭7"],     formula: "H W H W H W H W" },
  chromatic:  { name: "Chromatic",        steps: [0,1,2,3,4,5,6,7,8,9,10,11], degrees: ["1","♭2","2","♭3","3","4","♭5","5","♭6","6","♭7","7"], formula: "all semitones" },
};

const SCALE_GROUPS = [
  { label: "Modes",         keys: ["ionian","dorian","phrygian","lydian","mixolydian","aeolian","locrian"] },
  { label: "Pentatonic",    keys: ["majorPent","minorPent","blues"] },
  { label: "Harm./Melodic", keys: ["harmMin","melMin"] },
  { label: "Symmetric",     keys: ["wholeTone","dimWH","dimHW","chromatic"] },
];

// Roots with sharp/flat display labels, for UI buttons.
const ROOT_LABELS = NOTES.map(n => ({
  key: n,
  label: ({"C#":"C♯/D♭","D#":"D♯/E♭","F#":"F♯/G♭","G#":"G♯/A♭","A#":"A♯/B♭"})[n] || n,
}));

// ── Enharmonic scale spelling ─────────────────────────────────────
// For diatonic-style 7-note scales we want each natural letter (A–G) to
// appear exactly once. NOTES[] is sharp-only, so e.g. G Dorian renders
// A and A♯ instead of A and B♭. spellScale walks the letter cycle from
// the chosen root and assigns each scale tone the accidental needed to
// hit its pitch class. For enharmonic roots (C♯/D♭ etc.) it tries the
// flat-letter alternative too and picks whichever spelling avoids
// double accidentals.
const LETTER_PC    = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_ORDER = ["C", "D", "E", "F", "G", "A", "B"];
const FLAT_ALT_ROOT = { "C#": "D", "D#": "E", "F#": "G", "G#": "A", "A#": "B" };

function spellScale(rootName, steps) {
  if (!steps || steps.length !== 7) return null;
  const rootPc = noteIndex(rootName);
  if (rootPc < 0) return null;

  const candidates = [rootName[0]];
  if (FLAT_ALT_ROOT[rootName]) candidates.push(FLAT_ALT_ROOT[rootName]);

  let best = null, bestScore = Infinity;
  for (const rootLetter of candidates) {
    const rIdx = LETTER_ORDER.indexOf(rootLetter);
    if (rIdx < 0) continue;
    const map = {};
    let score = 0, ok = true;
    for (let i = 0; i < 7; i++) {
      const pc = (rootPc + steps[i]) % 12;
      const letter = LETTER_ORDER[(rIdx + i) % 7];
      let diff = ((pc - LETTER_PC[letter]) + 12) % 12;
      if (diff > 6) diff -= 12;
      let acc;
      if (diff === 0) acc = "";
      else if (diff === 1)  { acc = "♯"; score += 1; }
      else if (diff === -1) { acc = "♭"; score += 1; }
      else if (diff === 2)  { acc = "𝄪"; score += 100; }
      else if (diff === -2) { acc = "𝄫"; score += 100; }
      else { ok = false; break; }
      map[pc] = letter + acc;
    }
    if (ok && score < bestScore) { best = map; bestScore = score; }
  }
  return best;
}

// Spell a single pitch class using a scale map when available, otherwise
// fall back to the default sharp-named NOTES[].
function spellNote(pc, map) {
  if (map && map[pc] != null) return map[pc];
  return noteName(pc);
}

// ── Bracket-chord scale suggestions ───────────────────────────────
// Given two chords bracketing a lead-line gap, suggest scales that
// work over the transition. Returns an array of suggestion objects
// sorted by fit, each with { scaleKey, root, rootPc, name, reasoning }.
//
// Algorithm:
//   1. Collect all pitch classes from both chords.
//   2. For every 7-note scale in SCALES, for every root, test whether
//      the scale contains all chord tones.
//   3. Rank: scales that contain ALL tones from BOTH chords first,
//      then scales matching only one chord. Within a tier, prefer
//      the scale rooted on prevChord's root (most idiomatic), then
//      on nextChord's root.
//   4. Return top suggestions with a human-readable reasoning string.

function chordPcs(root, quality) {
  const rootPc = typeof root === "number" ? root : noteIndex(root);
  const intervals = CHORD_INTERVALS[quality];
  if (!intervals) return [];
  return intervals.map(i => (rootPc + i) % 12);
}

function suggestScalesForBracket(prevChord, nextChord) {
  // prevChord / nextChord: { root (name or pc), quality }. Either may be null.
  const prev = prevChord ? { rootPc: typeof prevChord.root === "number" ? prevChord.root : noteIndex(prevChord.root), quality: prevChord.quality } : null;
  const next = nextChord ? { rootPc: typeof nextChord.root === "number" ? nextChord.root : noteIndex(nextChord.root), quality: nextChord.quality } : null;

  const prevPcs = prev ? chordPcs(prev.rootPc, prev.quality) : [];
  const nextPcs = next ? chordPcs(next.rootPc, next.quality) : [];
  const allPcs = new Set([...prevPcs, ...nextPcs]);

  // Only check heptatonic scales (7-note) for bracket suggestions.
  const heptatonic = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];

  const results = [];

  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const key of heptatonic) {
      const def = SCALES[key];
      const scalePcSet = new Set(def.steps.map(s => (rootPc + s) % 12));

      const fitsPrev = prevPcs.every(pc => scalePcSet.has(pc));
      const fitsNext = nextPcs.every(pc => scalePcSet.has(pc));
      if (!fitsPrev && !fitsNext) continue;

      const fitsBoth = fitsPrev && fitsNext;

      // Priority score: lower = better.
      let priority = fitsBoth ? 0 : 100;
      // Prefer scales rooted on the prevChord's root.
      if (prev && rootPc === prev.rootPc) priority -= 10;
      else if (next && rootPc === next.rootPc) priority -= 5;
      // Prefer simpler modes (ionian/aeolian over locrian/phrygian).
      const modeRank = heptatonic.indexOf(key);
      priority += modeRank;

      results.push({ scaleKey: key, rootPc, priority, fitsBoth, fitsPrev, fitsNext });
    }
  }

  results.sort((a, b) => a.priority - b.priority);

  // Build suggestions with reasoning.
  const suggestions = [];
  const seen = new Set();
  for (const r of results) {
    if (suggestions.length >= 6) break;
    const tag = `${r.rootPc}-${r.scaleKey}`;
    if (seen.has(tag)) continue;
    seen.add(tag);

    const rootName = noteName(r.rootPc);
    const def = SCALES[r.scaleKey];
    const name = `${rootName} ${def.name}`;

    let reasoning;
    if (r.fitsBoth) {
      if (prev && next && prev.rootPc === next.rootPc) {
        reasoning = `Both chords are diatonic to ${name}`;
      } else {
        const prevName = prev ? `${noteName(prev.rootPc)} ${prev.quality}` : "?";
        const nextName = next ? `${noteName(next.rootPc)} ${next.quality}` : "?";
        reasoning = `${prevName} and ${nextName} are both diatonic to ${name}`;
      }
    } else if (r.fitsPrev) {
      reasoning = `Fits the previous chord (${prev ? noteName(prev.rootPc) + " " + prev.quality : "?"}); bridge to the next`;
    } else {
      reasoning = `Fits the next chord (${next ? noteName(next.rootPc) + " " + next.quality : "?"}); approach from the previous`;
    }

    suggestions.push({
      scaleKey: r.scaleKey,
      root: rootName,
      rootPc: r.rootPc,
      name,
      reasoning,
      fitsBoth: r.fitsBoth,
    });
  }

  return suggestions;
}

// Node-only export hook so the test suite can pull in these helpers.
// Browsers ignore this because `module` is undefined at global scope.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { NOTES, SCALES, CHORD_INTERVALS, noteIndex, noteName, spellScale, spellNote, chordPcs, suggestScalesForBracket };
}
