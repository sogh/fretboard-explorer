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

// ── Key detection & chord suggestions ──────────────────���─────────
// Diatonic chord templates for major keys (intervals from tonic, quality, roman numeral).
const DIATONIC_TRIADS = [
  { interval: 0,  quality: "major", roman: "I" },
  { interval: 2,  quality: "minor", roman: "ii" },
  { interval: 4,  quality: "minor", roman: "iii" },
  { interval: 5,  quality: "major", roman: "IV" },
  { interval: 7,  quality: "major", roman: "V" },
  { interval: 9,  quality: "minor", roman: "vi" },
  { interval: 11, quality: "dim",   roman: "vii\u00B0" },
];
const DIATONIC_SEVENTHS = [
  { interval: 0,  quality: "maj7",  roman: "Imaj7" },
  { interval: 2,  quality: "min7",  roman: "ii7" },
  { interval: 4,  quality: "min7",  roman: "iii7" },
  { interval: 5,  quality: "maj7",  roman: "IVmaj7" },
  { interval: 7,  quality: "dom7",  roman: "V7" },
  { interval: 9,  quality: "min7",  roman: "vi7" },
  { interval: 11, quality: "m7b5",  roman: "vii\u00F87" },
];

// Score how well a set of chords fits each possible major key.
// Returns sorted array of { rootPc, score, matched, total } (best first).
function detectKey(chordSteps) {
  if (!chordSteps || !chordSteps.length) return [];

  const results = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    const majorPcs = SCALES.ionian.steps.map(s => (rootPc + s) % 12);
    const majorSet = new Set(majorPcs);
    // Build set of diatonic chord root+quality pairs for this key
    const diatonicSet = new Set();
    for (const d of DIATONIC_TRIADS) {
      diatonicSet.add(`${(rootPc + d.interval) % 12}-${d.quality}`);
    }
    for (const d of DIATONIC_SEVENTHS) {
      diatonicSet.add(`${(rootPc + d.interval) % 12}-${d.quality}`);
    }
    // Also match dom7 as "major" functional equivalent, min7 as "minor"
    for (const d of DIATONIC_TRIADS) {
      if (d.quality === "major") diatonicSet.add(`${(rootPc + d.interval) % 12}-dom7`);
      if (d.quality === "minor") diatonicSet.add(`${(rootPc + d.interval) % 12}-min7`);
    }

    let matched = 0;
    for (const step of chordSteps) {
      const stepRootPc = noteIndex(step.root);
      const tag = `${stepRootPc}-${step.quality}`;
      if (diatonicSet.has(tag)) matched++;
    }

    results.push({
      rootPc,
      rootName: noteName(rootPc),
      score: matched,
      total: chordSteps.length,
      pct: chordSteps.length > 0 ? matched / chordSteps.length : 0,
    });
  }

  results.sort((a, b) => b.score - a.score || a.rootPc - b.rootPc);
  return results;
}

// Get the roman numeral label for a chord in a given key.
function romanInKey(chordRootPc, quality, keyRootPc) {
  const interval = ((chordRootPc - keyRootPc) + 12) % 12;
  // Try exact match first
  const allTemplates = [...DIATONIC_TRIADS, ...DIATONIC_SEVENTHS];
  for (const t of allTemplates) {
    if (t.interval === interval && t.quality === quality) return t.roman;
  }
  // Fuzzy: dom7 on a major degree, min7 on a minor degree
  for (const t of DIATONIC_TRIADS) {
    if (t.interval === interval) {
      if (t.quality === "major" && quality === "dom7") return t.roman.replace(/I+|V+/g, m => m) + "7";
      if (t.quality === "minor" && quality === "min7") return t.roman + "7";
    }
  }
  return null;
}

// Suggest next chords given the sequence context.
// Returns { key, suggestions[] } where each suggestion has
// { root, quality, roman, reason, category, tonalityEffect }.
function suggestNextChords(steps, currentIndex) {
  const chordSteps = steps.filter(s => s.kind === "chord");
  const prevChords = steps.slice(0, currentIndex).filter(s => s.kind === "chord");
  const currentStep = steps[currentIndex];
  const prevChord = prevChords.length > 0 ? prevChords[prevChords.length - 1] : null;

  // Detect key from all chord steps (excluding rest/lead_line/pattern)
  const keyResults = detectKey(chordSteps);
  const bestKey = keyResults.length > 0 && keyResults[0].score > 0 ? keyResults[0] : null;
  const secondKey = keyResults.length > 1 && keyResults[1].score > 0 && keyResults[1].score === keyResults[0].score ? keyResults[1] : null;

  const suggestions = [];
  const seen = new Set();

  function addSuggestion(root, quality, romanOverride, reason, category) {
    const tag = `${root}-${quality}`;
    if (seen.has(tag)) return;
    seen.add(tag);

    // Compute roman numeral from detected key (authoritative).
    // Only fall back to the caller's override for non-diatonic labels
    // like "V7/ii" or "♭III" that romanInKey can't produce.
    let roman = "";
    let tonalityEffect = "";
    if (bestKey) {
      const cPc = noteIndex(root);
      const keyRoman = romanInKey(cPc, quality, bestKey.rootPc);
      if (keyRoman) {
        roman = keyRoman;
        tonalityEffect = `diatonic in ${bestKey.rootName} major`;
      } else {
        // Not diatonic — only keep caller labels for categories that define
        // their own naming (secondary dominants "V7/X", borrowed "♭III" etc).
        // For resolution/chromatic/relative, blank is clearer than a
        // misleading numeral from a different tonal context.
        roman = (category === "secondary" || category === "borrowed") ? (romanOverride || "") : "";
        const altKeys = detectKey([...chordSteps, { root, quality }]);
        if (altKeys[0] && altKeys[0].rootPc !== bestKey.rootPc && altKeys[0].score > bestKey.score) {
          tonalityEffect = `shifts key toward ${altKeys[0].rootName} major`;
        } else {
          tonalityEffect = `chromatic / borrowed`;
        }
      }
    } else {
      roman = romanOverride || "";
    }

    suggestions.push({ root, quality, roman, reason, category, tonalityEffect });
  }

  // 1. Diatonic chords in detected key
  if (bestKey && bestKey.pct >= 0.5) {
    const keyRoot = bestKey.rootPc;
    for (const d of DIATONIC_TRIADS) {
      const r = noteName((keyRoot + d.interval) % 12);
      const isCurrent = currentStep && currentStep.root === r && currentStep.quality === d.quality;
      if (!isCurrent) {
        addSuggestion(r, d.quality, d.roman, `diatonic in ${bestKey.rootName} major`, "diatonic");
      }
    }
    // Also 7th chord versions
    for (const d of DIATONIC_SEVENTHS) {
      const r = noteName((keyRoot + d.interval) % 12);
      addSuggestion(r, d.quality, d.roman, `diatonic in ${bestKey.rootName} major`, "diatonic");
    }
  }

  // 2. Common moves from previous chord
  if (prevChord) {
    const pRootPc = noteIndex(prevChord.root);
    const pQual = prevChord.quality;

    // V -> I resolution
    if (pQual === "major" || pQual === "dom7") {
      const tonicPc = (pRootPc + 5) % 12; // up a P4 = down a P5
      addSuggestion(noteName(tonicPc), "major", "I", `resolves V\u2192I from ${prevChord.root}`, "resolution");
      addSuggestion(noteName(tonicPc), "minor", "i", `resolves V\u2192i from ${prevChord.root}`, "resolution");
    }

    // ii -> V
    if (pQual === "minor" || pQual === "min7") {
      const vPc = (pRootPc + 7) % 12;
      addSuggestion(noteName(vPc), "dom7", "V7", `ii\u2192V7 from ${prevChord.root}m`, "resolution");
      addSuggestion(noteName(vPc), "major", "V", `ii\u2192V from ${prevChord.root}m`, "resolution");
    }

    // IV -> V or IV -> I
    if (pQual === "major" || pQual === "maj7") {
      const vPc = (pRootPc + 2) % 12; // up a whole step
      addSuggestion(noteName(vPc), "major", "V", `IV\u2192V motion from ${prevChord.root}`, "resolution");
      addSuggestion(noteName(vPc), "dom7", "V7", `IV\u2192V7 motion from ${prevChord.root}`, "resolution");
    }

    // Relative major/minor
    if (pQual === "major" || pQual === "maj7" || pQual === "dom7") {
      const relMinPc = (pRootPc + 9) % 12;
      addSuggestion(noteName(relMinPc), "minor", "vi", `relative minor of ${prevChord.root}`, "relative");
    }
    if (pQual === "minor" || pQual === "min7") {
      const relMajPc = (pRootPc + 3) % 12;
      addSuggestion(noteName(relMajPc), "major", "III", `relative major of ${prevChord.root}m`, "relative");
    }
  }

  // 3. Borrowed chords from parallel minor (key-dependent, before chromatic so they win dedup)
  if (bestKey && bestKey.pct >= 0.5) {
    const keyRoot = bestKey.rootPc;
    const borrowed = [
      { interval: 3,  quality: "major", roman: "\u266DIII", desc: "borrowed from parallel minor" },
      { interval: 8,  quality: "major", roman: "\u266DVI",  desc: "borrowed from parallel minor" },
      { interval: 10, quality: "major", roman: "\u266DVII", desc: "borrowed from parallel minor" },
      { interval: 5,  quality: "minor", roman: "iv",        desc: "borrowed minor iv" },
    ];
    for (const b of borrowed) {
      const r = noteName((keyRoot + b.interval) % 12);
      addSuggestion(r, b.quality, b.roman, b.desc, "borrowed");
    }
  }

  // 4. Secondary dominants: V7/X for each diatonic chord (key-dependent)
  if (bestKey && bestKey.pct >= 0.5) {
    for (const d of DIATONIC_TRIADS) {
      if (d.quality === "dim") continue;
      const targetPc = (bestKey.rootPc + d.interval) % 12;
      const secDomPc = (targetPc + 7) % 12;
      const targetName = noteName(targetPc);
      addSuggestion(noteName(secDomPc), "dom7", `V7/${d.roman}`,
        `secondary dominant resolving to ${targetName}`, "secondary");
    }
  }

  // 5. Chromatic motion from previous chord (last priority — borrowed/secondary win dedup)
  if (prevChord) {
    const pRootPc = noteIndex(prevChord.root);
    for (const delta of [1, 2, -1, -2]) {
      const target = noteName((pRootPc + delta + 12) % 12);
      const dir = delta > 0 ? "up" : "down";
      const dist = Math.abs(delta) === 1 ? "half step" : "whole step";
      addSuggestion(target, "major", "", `${dir} ${dist} from ${prevChord.root}`, "chromatic");
      addSuggestion(target, "minor", "", `${dir} ${dist} from ${prevChord.root}`, "chromatic");
    }
  }

  // If no previous chord and no key detected, suggest common starting chords
  if (!prevChord && suggestions.length === 0) {
    for (const root of ["C", "G", "D", "A", "F"]) {
      addSuggestion(root, "major", "", "common starting key", "diatonic");
      addSuggestion(root, "minor", "", "common starting key", "diatonic");
    }
  }

  return {
    key: bestKey,
    secondKey,
    suggestions: suggestions.slice(0, 30),
  };
}

// Node-only export hook so the test suite can pull in these helpers.
// Browsers ignore this because `module` is undefined at global scope.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { NOTES, SCALES, CHORD_INTERVALS, noteIndex, noteName, spellScale, spellNote, chordPcs, suggestScalesForBracket, detectKey, romanInKey, suggestNextChords, DIATONIC_TRIADS, DIATONIC_SEVENTHS };
}
