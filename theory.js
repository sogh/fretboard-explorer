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
  ionian:     { name: "Ionian (Major)",   steps: [0,2,4,5,7,9,11],           degrees: ["1","2","3","4","5","6","7"],             formula: "W W H W W W H" },
  dorian:     { name: "Dorian",           steps: [0,2,3,5,7,9,10],           degrees: ["1","2","♭3","4","5","6","♭7"],           formula: "W H W W W H W" },
  phrygian:   { name: "Phrygian",         steps: [0,1,3,5,7,8,10],           degrees: ["1","♭2","♭3","4","5","♭6","♭7"],         formula: "H W W W H W W" },
  lydian:     { name: "Lydian",           steps: [0,2,4,6,7,9,11],           degrees: ["1","2","3","♯4","5","6","7"],            formula: "W W W H W W H" },
  mixolydian: { name: "Mixolydian",       steps: [0,2,4,5,7,9,10],           degrees: ["1","2","3","4","5","6","♭7"],            formula: "W W H W W H W" },
  aeolian:    { name: "Aeolian (Minor)",  steps: [0,2,3,5,7,8,10],           degrees: ["1","2","♭3","4","5","♭6","♭7"],          formula: "W H W W H W W" },
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
