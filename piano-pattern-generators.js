// ── Piano Pattern Generators ──────────────────────────────────────
// Piano-specific pattern generators that work with MIDI note numbers
// instead of string/fret positions.
//
// Depends on: theory.js (NOTES, SCALES, noteIndex, noteName)

// Build an ordered list of scale notes as MIDI numbers within a range.
function buildPianoScaleMap(scale, startMidi, endMidi) {
  startMidi = startMidi != null ? startMidi : 48;  // C3
  endMidi   = endMidi   != null ? endMidi   : 84;  // C6
  const rootPc = noteIndex(scale.root);
  const def = SCALES[scale.type] || SCALES.ionian;
  const positions = [];

  for (let midi = startMidi; midi <= endMidi; midi++) {
    const pc = ((midi % 12) + 12) % 12;
    const interval = (pc - rootPc + 12) % 12;
    const idx = def.steps.indexOf(interval);
    if (idx < 0) continue;
    positions.push({
      midi, pc,
      degree: def.degrees[idx] || "",
      scaleIndex: idx,
    });
  }
  return positions;
}

function findPianoStartIndex(scaleMap, startMidi) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < scaleMap.length; i++) {
    const d = Math.abs(scaleMap[i].midi - startMidi);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// ascending_by_step
function gen_piano_ascending({ scale, startMidi, noteCount, params }) {
  const map = buildPianoScaleMap(scale);
  if (!map.length) return [];
  const stepSize = (params && params.stepSize) || 1;
  const down = params && params.direction === "down";
  let idx = findPianoStartIndex(map, startMidi || 60);
  const notes = [];
  for (let i = 0; i < noteCount; i++) {
    if (idx < 0 || idx >= map.length) break;
    const p = map[idx];
    notes.push({ midi: p.midi, degree: p.degree, durationBeats: 1 });
    idx += down ? -stepSize : stepSize;
  }
  return notes;
}

// interval_pairs
function gen_piano_interval_pairs({ scale, startMidi, noteCount, params }) {
  const map = buildPianoScaleMap(scale);
  if (!map.length) return [];
  const interval = (params && params.interval) || 3;
  const down = params && params.direction === "down";
  const pairCount = (params && params.pairCount) || Math.ceil(noteCount / 2);
  let baseIdx = findPianoStartIndex(map, startMidi || 60);
  const notes = [];
  for (let p = 0; p < pairCount; p++) {
    const lo = baseIdx;
    const hi = baseIdx + interval;
    if (lo < 0 || lo >= map.length || hi < 0 || hi >= map.length) break;
    const first = down ? hi : lo;
    const second = down ? lo : hi;
    notes.push({ midi: map[first].midi, degree: map[first].degree, durationBeats: 1 });
    notes.push({ midi: map[second].midi, degree: map[second].degree, durationBeats: 1 });
    baseIdx += down ? -1 : 1;
  }
  return notes.slice(0, noteCount || notes.length);
}

// repeating_cell
function gen_piano_repeating_cell({ scale, startMidi, noteCount, params }) {
  const map = buildPianoScaleMap(scale);
  if (!map.length) return [];
  const cell = (params && params.cell) || [0, 2, 4];
  const reps = (params && params.repetitions) || 4;
  const transpose = (params && params.transposition) || 1;
  let baseIdx = findPianoStartIndex(map, startMidi || 60);
  const notes = [];
  for (let r = 0; r < reps; r++) {
    for (const offset of cell) {
      const idx = baseIdx + offset;
      if (idx < 0 || idx >= map.length) continue;
      const p = map[idx];
      notes.push({ midi: p.midi, degree: p.degree, durationBeats: 1 });
    }
    baseIdx += transpose;
  }
  return notes.slice(0, noteCount || notes.length);
}

const PIANO_PATTERN_GENERATORS = {
  ascending_by_step: {
    name: "Ascending",
    desc: "Walk up/down the scale by step",
    fn: gen_piano_ascending,
    defaultParams: { stepSize: 1, direction: "up" },
  },
  interval_pairs: {
    name: "Interval pairs",
    desc: "Pairs of notes a fixed interval apart",
    fn: gen_piano_interval_pairs,
    defaultParams: { interval: 3, direction: "up", pairCount: 4 },
  },
  repeating_cell: {
    name: "Repeating cell",
    desc: "A scale-degree pattern repeated with transposition",
    fn: gen_piano_repeating_cell,
    defaultParams: { cell: [0, 2, 4], repetitions: 4, transposition: 1 },
  },
};

function runPianoGenerator(name, opts) {
  const gen = PIANO_PATTERN_GENERATORS[name];
  if (!gen) return [];
  return gen.fn(opts);
}
