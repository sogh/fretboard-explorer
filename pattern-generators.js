// ── Pattern generators ─────────────────────────────────────────────
// Each generator takes { scale, startingNote, noteCount, params } and
// returns a note list that can drop into a Pattern step.
//
// scale:        { root (name), type (SCALES key) }
// startingNote: { string, fret } — the first note on the fretboard
// noteCount:    how many notes to produce
// params:       generator-specific options
//
// Returns: [{ string, fret, degree, durationBeats }, ...]
//
// Depends on: theory.js (NOTES, SCALES, noteIndex, noteName),
//             instruments.js (getInstrument, fretPositionPlayable)

// ── Helpers ────────────────────────────────────────────────────────

// Build an ordered list of all playable scale-note positions on the
// fretboard, sorted ascending by pitch (low fret on low string first).
function buildScaleMap(scale) {
  const inst = getInstrument();
  const rootPc = noteIndex(scale.root);
  const def = SCALES[scale.type] || SCALES.ionian;
  const stepList = def.steps;
  const degreeList = def.degrees;
  const positions = [];

  for (let si = inst.tuning.length - 1; si >= 0; si--) {
    for (let fret = 0; fret <= inst.numFrets; fret++) {
      if (!fretPositionPlayable(si, fret)) continue;
      const pc = (inst.tuning[si] + fret) % 12;
      const interval = (pc - rootPc + 12) % 12;
      const idx = stepList.indexOf(interval);
      if (idx < 0) continue;
      const midi = openMidiForString(si) + fret;
      positions.push({
        string: si, fret, pc, midi,
        degree: degreeList[idx] || "",
        scaleIndex: idx,
      });
    }
  }

  // Sort by pitch ascending
  positions.sort((a, b) => a.midi - b.midi);
  return positions;
}

// Approximate open-string MIDI for pitch sorting. Matches playback.js.
function openMidiForString(si) {
  const table = [64, 59, 55, 50, 45, 40]; // standard guitar
  return table[si] != null ? table[si] : (64 - si * 5);
}

// Find the index of a position in the scale map closest to a starting note.
function findStartIndex(scaleMap, startingNote) {
  const targetMidi = openMidiForString(startingNote.string) + startingNote.fret;
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < scaleMap.length; i++) {
    const d = Math.abs(scaleMap[i].midi - targetMidi);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// ── Generators ─────────────────────────────────────────────────────

// ascending_by_step: walk up (or down) the scale by a given step size
// in scale degrees.
// params: { stepSize: 1, direction: 'up'|'down' }
function gen_ascending_by_step({ scale, startingNote, noteCount, params }) {
  const map = buildScaleMap(scale);
  if (!map.length) return [];
  const stepSize = (params && params.stepSize) || 1;
  const down = params && params.direction === "down";
  let idx = findStartIndex(map, startingNote);
  const notes = [];
  for (let i = 0; i < noteCount; i++) {
    if (idx < 0 || idx >= map.length) break;
    const p = map[idx];
    notes.push({ string: p.string, fret: p.fret, degree: p.degree, durationBeats: 1 });
    idx += down ? -stepSize : stepSize;
  }
  return notes;
}

// interval_pairs: play pairs of notes separated by a fixed interval
// in scale degrees, advancing one step between each pair.
// params: { interval: 3, direction: 'up'|'down', pairCount: 4 }
function gen_interval_pairs({ scale, startingNote, noteCount, params }) {
  const map = buildScaleMap(scale);
  if (!map.length) return [];
  const interval = (params && params.interval) || 3;
  const down = params && params.direction === "down";
  const pairCount = (params && params.pairCount) || Math.ceil(noteCount / 2);
  let baseIdx = findStartIndex(map, startingNote);
  const notes = [];
  for (let p = 0; p < pairCount; p++) {
    const lo = baseIdx;
    const hi = baseIdx + interval;
    if (lo < 0 || lo >= map.length) break;
    if (hi < 0 || hi >= map.length) break;
    const first = down ? hi : lo;
    const second = down ? lo : hi;
    notes.push({ string: map[first].string, fret: map[first].fret, degree: map[first].degree, durationBeats: 1 });
    notes.push({ string: map[second].string, fret: map[second].fret, degree: map[second].degree, durationBeats: 1 });
    baseIdx += down ? -1 : 1;
  }
  return notes.slice(0, noteCount || notes.length);
}

// repeating_cell: define a cell as scale-degree offsets from a base,
// repeat it N times, transposing by a step each repetition.
// params: { cell: [0,2,4], repetitions: 4, transposition: 1 }
function gen_repeating_cell({ scale, startingNote, noteCount, params }) {
  const map = buildScaleMap(scale);
  if (!map.length) return [];
  const cell = (params && params.cell) || [0, 2, 4];
  const reps = (params && params.repetitions) || 4;
  const transpose = (params && params.transposition) || 1;
  let baseIdx = findStartIndex(map, startingNote);
  const notes = [];
  for (let r = 0; r < reps; r++) {
    for (const offset of cell) {
      const idx = baseIdx + offset;
      if (idx < 0 || idx >= map.length) continue;
      const p = map[idx];
      notes.push({ string: p.string, fret: p.fret, degree: p.degree, durationBeats: 1 });
    }
    baseIdx += transpose;
  }
  return notes.slice(0, noteCount || notes.length);
}

// ── Registry ───────────────────────────────────────────────────────
const PATTERN_GENERATORS = {
  ascending_by_step: {
    name: "Ascending by step",
    desc: "Walk up/down the scale by a step size",
    fn: gen_ascending_by_step,
    defaultParams: { stepSize: 1, direction: "up" },
  },
  interval_pairs: {
    name: "Interval pairs",
    desc: "Pairs of notes a fixed interval apart, advancing stepwise",
    fn: gen_interval_pairs,
    defaultParams: { interval: 3, direction: "up", pairCount: 4 },
  },
  repeating_cell: {
    name: "Repeating cell",
    desc: "A scale-degree pattern repeated with transposition",
    fn: gen_repeating_cell,
    defaultParams: { cell: [0, 2, 4], repetitions: 4, transposition: 1 },
  },
};

// Run a generator by name.
function runGenerator(name, opts) {
  const gen = PATTERN_GENERATORS[name];
  if (!gen) return [];
  return gen.fn(opts);
}

// Node export for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PATTERN_GENERATORS, runGenerator, buildScaleMap, findStartIndex,
    gen_ascending_by_step, gen_interval_pairs, gen_repeating_cell };
}
