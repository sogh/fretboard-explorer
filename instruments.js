// ── Fretted instrument catalogue ────────────────────────────────────
// Each entry describes a fretted instrument well enough to drive the existing
// guitar renderers (triad-explorer.js, scales-modes.js).
//
// Fields:
//   name           — UI label.
//   tuning         — Pitch classes per string, top-to-bottom in the SVG (index
//                    0 = visually topmost string). Most instruments follow
//                    pitch-ordering (high on top); the 5-string banjo keeps
//                    the conventional tab layout with the drone at the bottom.
//   numFrets       — Highest fret number the renderer should show.
//   triadGroups    — Three consecutive strings on which triad voicings can be
//                    built; labels are displayed on the "Strings" button row.
//   seventhGroups  — Same for four-string 7th-chord voicings.
//   stringMinFret  — Optional {stringIdx: minFret}. Used by the 5-string banjo
//                    whose drone string physically starts at fret 5. Strings
//                    not listed span the full neck.
const INSTRUMENTS = {
  guitar: {
    name: "Guitar",
    tuning: [4, 11, 7, 2, 9, 4], // E B G D A E
    numFrets: 15,
    triadGroups: [
      { label: "E-B-G", idx: 0 },
      { label: "B-G-D", idx: 1 },
      { label: "G-D-A", idx: 2 },
      { label: "D-A-E", idx: 3 },
    ],
    seventhGroups: [
      { label: "E-B-G-D", idx: 0 },
      { label: "B-G-D-A", idx: 1 },
      { label: "G-D-A-E", idx: 2 },
    ],
    stringMinFret: null,
  },
  bass: {
    name: "Bass",
    tuning: [7, 2, 9, 4], // G D A E
    numFrets: 15,
    triadGroups: [
      { label: "G-D-A", idx: 0 },
      { label: "D-A-E", idx: 1 },
    ],
    seventhGroups: [
      { label: "G-D-A-E", idx: 0 },
    ],
    stringMinFret: null,
  },
  ukulele: {
    name: "Ukulele",
    tuning: [9, 4, 0, 7], // A E C g (reentrant, but treat as pitch classes only)
    numFrets: 12,
    triadGroups: [
      { label: "A-E-C", idx: 0 },
      { label: "E-C-g", idx: 1 },
    ],
    seventhGroups: [
      { label: "A-E-C-g", idx: 0 },
    ],
    stringMinFret: null,
  },
  banjo5: {
    name: "Banjo (5-string)",
    // Conventional tab layout: strings 1-5 top-to-bottom. Drone g is string 5,
    // physically short and only playable from fret 5 onward. Open-G tuning.
    tuning: [2, 11, 7, 2, 7], // D B G D g(drone)
    numFrets: 22,
    triadGroups: [
      { label: "D-B-G", idx: 0 },
      { label: "B-G-D", idx: 1 },
      { label: "G-D-g", idx: 2 },
    ],
    seventhGroups: [
      { label: "D-B-G-D", idx: 0 },
      { label: "B-G-D-g", idx: 1 },
    ],
    stringMinFret: { 4: 5 }, // drone string starts at the 5th fret
  },
  banjoTenor: {
    name: "Banjo (tenor)",
    tuning: [9, 2, 7, 0], // A D G C — fifths, high to low
    numFrets: 17,
    triadGroups: [
      { label: "A-D-G", idx: 0 },
      { label: "D-G-C", idx: 1 },
    ],
    seventhGroups: [
      { label: "A-D-G-C", idx: 0 },
    ],
    stringMinFret: null,
  },
  mandolin: {
    name: "Mandolin",
    tuning: [4, 9, 2, 7], // E A D G — fifths, high to low
    numFrets: 15,
    triadGroups: [
      { label: "E-A-D", idx: 0 },
      { label: "A-D-G", idx: 1 },
    ],
    seventhGroups: [
      { label: "E-A-D-G", idx: 0 },
    ],
    stringMinFret: null,
  },
};

// Selected instrument. Mutated by the instrument-picker nav row in index.html.
// All three pages (Triads, Circle of Fifths, Scales & Modes) read via getInstrument().
let currentInstrumentKey = "guitar";
function getInstrument() {
  return INSTRUMENTS[currentInstrumentKey] || INSTRUMENTS.guitar;
}

// True iff the given {string, fret} pair is physically playable on the
// currently selected instrument. Used by the fretboard renderers to skip
// positions below a drone string's nut.
function fretPositionPlayable(stringIdx, fret) {
  const inst = getInstrument();
  if (!inst.stringMinFret) return true;
  const min = inst.stringMinFret[stringIdx];
  return min == null || fret >= min;
}
