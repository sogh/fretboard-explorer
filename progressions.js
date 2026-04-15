// ── Chord Progressions by Genre ────────────────────────────────────
// Pick a root, a mode (major/minor), and a genre. The page renders a
// handful of classic progressions for that genre, showing Roman
// numerals alongside the actual chord names in the chosen key.
//
// NOTES / noteIndex / noteName come from theory.js.

// Sharp and flat spellings for pitch classes — picked per key so the
// displayed chord letters match the key's conventional signature.
const PROG_SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const PROG_FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

// Standard spelling preference for each of the 12 roots in each mode.
// Matches what musicians expect to see on lead sheets.
const FLAT_ROOTS_MAJOR = new Set(["F", "A#", "D#", "G#", "C#"]);   // F, B♭, E♭, A♭, D♭
const FLAT_ROOTS_MINOR = new Set(["D", "G", "C", "F", "A#", "D#"]); // Dm, Gm, Cm, Fm, B♭m, E♭m

// Spelling choice for the selected key.
function usesFlatsFor(rootPc, mode) {
  const rootName = NOTES[rootPc];
  return (mode === "major" ? FLAT_ROOTS_MAJOR : FLAT_ROOTS_MINOR).has(rootName);
}

// Spell a pitch class using the key's preferred accidental, unless the
// caller overrides (e.g. a Roman numeral with an explicit ♭ or ♯ forces
// that accidental regardless of key signature — ♭III in C should show
// "E♭", not "D♯").
function spellPc(pc, rootPc, mode, forceAcc = 0) {
  let arr;
  if (forceAcc < 0) arr = PROG_FLAT;
  else if (forceAcc > 0) arr = PROG_SHARP;
  else arr = usesFlatsFor(rootPc, mode) ? PROG_FLAT : PROG_SHARP;
  return arr[((pc % 12) + 12) % 12];
}

// Roman numerals are always interpreted against the MAJOR scale reference.
// Minor progressions use lowercase "i", and explicit ♭III / ♭VI / ♭VII for
// the flatted-third/sixth/seventh chords. This keeps parsing unambiguous.
const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // I, II, III, IV, V, VI, VII

// Parse a Roman numeral chord symbol into its parts.
//   "♭VII"  -> { acc: -1, deg: 7, isMajor: true,  suffix: "" }
//   "ii°"   -> { acc:  0, deg: 2, isMajor: false, suffix: "°" }
//   "V7"    -> { acc:  0, deg: 5, isMajor: true,  suffix: "7" }
//   "IVmaj7"-> { acc:  0, deg: 4, isMajor: true,  suffix: "maj7" }
function parseRoman(sym) {
  let s = sym;
  let acc = 0;
  if (s.startsWith("♭") || s.startsWith("b")) { acc = -1; s = s.slice(1); }
  else if (s.startsWith("♯") || s.startsWith("#")) { acc = 1; s = s.slice(1); }

  // Try longest numerals first so "vii" isn't consumed as "vi".
  const numerals = [
    ["VII", 7], ["vii", 7], ["III", 3], ["iii", 3],
    ["VI", 6],  ["vi", 6],  ["IV", 4],  ["iv", 4],
    ["II", 2],  ["ii", 2],  ["V", 5],   ["v", 5],   ["I", 1], ["i", 1],
  ];
  let deg = 0, isMajor = true;
  for (const [r, d] of numerals) {
    if (s.startsWith(r)) {
      deg = d;
      isMajor = (r === r.toUpperCase());
      s = s.slice(r.length);
      break;
    }
  }
  if (!deg) return null;
  return { acc, deg, isMajor, suffix: s };
}

// Resolve a Roman numeral to a chord { pc, name } in the chosen key.
//
// Rendering rules:
//   - Default quality comes from the numeral's case (UPPER = major, lower = minor).
//   - An explicit marker overrides the default: "°" (dim), "+" (aug), "ø" (half-dim).
//   - Remaining suffix passes through as the extension (e.g. "7", "maj7", "sus4").
// Examples:
//   V    in C major  → "G"
//   V7   in C major  → "G7"         (dominant 7)
//   ii7  in C major  → "Dm7"        (lowercase ii provides the "m")
//   Imaj7 in C major → "Cmaj7"
//   ii°  in C major  → "D°"
//   iiø  in C major  → "Dm7♭5"      (half-diminished)
//   ♭III in C major  → "E♭"         (flat accidental forces flat spelling)
function resolveChord(sym, tonicPc, mode) {
  const p = parseRoman(sym);
  if (!p) return { roman: sym, name: "?" };

  const baseOffset = MAJOR_SCALE_OFFSETS[p.deg - 1] ?? 0;
  const pc = ((tonicPc + baseOffset + p.acc) % 12 + 12) % 12;
  const letter = spellPc(pc, tonicPc, mode, p.acc);

  // Triad quality: start from case, override with explicit marker if present.
  let quality = p.isMajor ? "maj" : "min";
  let rest = p.suffix;
  if (rest.startsWith("ø"))      { quality = "hdim"; rest = rest.slice(1); }
  else if (rest.startsWith("°")) { quality = "dim";  rest = rest.slice(1); }
  else if (rest.startsWith("+")) { quality = "aug";  rest = rest.slice(1); }

  // Half-diminished already implies m7♭5, so an extra "7" is redundant.
  if (quality === "hdim" && rest === "7") rest = "";

  let name;
  if (quality === "hdim") {
    name = letter + "m7♭5";
  } else {
    const glyph = { maj: "", min: "m", dim: "°", aug: "+" }[quality];
    name = letter + glyph + rest;
  }

  return { roman: sym, name, pc };
}

// ── Progression catalogue ──────────────────────────────────────────
// Each genre holds a list of progressions. Each progression specifies
// the mode it belongs to ("major" or "minor") and the Roman numerals
// as written. Progressions are only shown when their mode matches the
// currently selected mode on the page.
const PROGRESSIONS = {
  pop: {
    name: "Pop",
    progressions: [
      { mode: "major", name: "The Axis",           desc: "I–V–vi–IV — countless pop hits",        nums: ["I","V","vi","IV"] },
      { mode: "major", name: "Axis Rotation",      desc: "vi–IV–I–V — Axis starting on vi",       nums: ["vi","IV","I","V"] },
      { mode: "major", name: "50s Doo-Wop",        desc: "I–vi–IV–V — Stand By Me vibe",          nums: ["I","vi","IV","V"] },
      { mode: "major", name: "Pachelbel Loop",     desc: "I–V–vi–iii–IV–I–IV–V",                  nums: ["I","V","vi","iii","IV","I","IV","V"] },
      { mode: "major", name: "Three-Chord Pop",    desc: "I–IV–V — the original hook",            nums: ["I","IV","V"] },
      { mode: "minor", name: "Aeolian Loop",       desc: "i–♭VII–♭VI–♭VII — dark pop groove",     nums: ["i","♭VII","♭VI","♭VII"] },
      { mode: "minor", name: "Minor Axis",         desc: "i–♭VI–♭III–♭VII",                       nums: ["i","♭VI","♭III","♭VII"] },
      { mode: "minor", name: "Minor Cadence",      desc: "i–iv–V–i — harmonic minor",             nums: ["i","iv","V","i"] },
    ],
  },

  rock: {
    name: "Rock",
    progressions: [
      { mode: "major", name: "Classic Rock",       desc: "I–IV–V — Chuck Berry blueprint",        nums: ["I","IV","V"] },
      { mode: "major", name: "Mixolydian Rock",    desc: "I–♭VII–IV — Sweet Home Alabama",        nums: ["I","♭VII","IV"] },
      { mode: "major", name: "Stadium Anthem",     desc: "I–V–vi–IV",                             nums: ["I","V","vi","IV"] },
      { mode: "major", name: "Open-Air Progression", desc: "I–V–IV — Wild Thing",                 nums: ["I","V","IV"] },
      { mode: "minor", name: "Andalusian Cadence", desc: "i–♭VII–♭VI–V — darkest classic rock",   nums: ["i","♭VII","♭VI","V"] },
      { mode: "minor", name: "Minor Rock Loop",    desc: "i–♭VI–♭VII–i",                          nums: ["i","♭VI","♭VII","i"] },
      { mode: "minor", name: "Power-Chord Line",   desc: "i–♭III–♭VII–IV",                        nums: ["i","♭III","♭VII","IV"] },
    ],
  },

  blues: {
    name: "Blues",
    progressions: [
      { mode: "major", name: "12-Bar Blues",       desc: "4× I7 · 2× IV7 · 2× I7 · V7 · IV7 · I7 · V7", nums: ["I7","I7","I7","I7","IV7","IV7","I7","I7","V7","IV7","I7","V7"] },
      { mode: "major", name: "Quick-Change Blues", desc: "I7–IV7–I7–I7 — quick change in bar 2",  nums: ["I7","IV7","I7","I7"] },
      { mode: "major", name: "Turnaround",         desc: "I7–V7 turnaround tag",                  nums: ["I7","IV7","I7","V7"] },
      { mode: "major", name: "8-Bar Blues",        desc: "I7–V7–IV7–IV7–I7–V7–I7–V7",             nums: ["I7","V7","IV7","IV7","I7","V7","I7","V7"] },
      { mode: "minor", name: "Minor 12-Bar",       desc: "Minor blues: i7 · iv7 · V7 cycle",      nums: ["i7","i7","i7","i7","iv7","iv7","i7","i7","V7","iv7","i7","V7"] },
      { mode: "minor", name: "Minor Turnaround",   desc: "i7–iv7–V7 — tight minor loop",          nums: ["i7","iv7","V7"] },
    ],
  },

  jazz: {
    name: "Jazz",
    progressions: [
      { mode: "major", name: "ii–V–I",             desc: "The jazz cadence",                      nums: ["ii7","V7","Imaj7"] },
      { mode: "major", name: "Rhythm Changes A",   desc: "I–vi–ii–V (8× = 32-bar AABA head)",     nums: ["Imaj7","vi7","ii7","V7"] },
      { mode: "major", name: "Long ii–V–I",        desc: "iii–vi–ii–V–I",                         nums: ["iii7","vi7","ii7","V7","Imaj7"] },
      { mode: "major", name: "Bird Blues Opener",  desc: "Imaj7–vi7–ii7–V7",                      nums: ["Imaj7","vi7","ii7","V7"] },
      { mode: "minor", name: "Minor ii–V–i",       desc: "iiø–V7–i — dark jazz cadence",          nums: ["iiø","V7","i7"] },
      { mode: "minor", name: "Autumn Leaves",      desc: "iiø–V7–i–iv7–♭VII7–♭IIImaj7",           nums: ["iiø","V7","i7","iv7","♭VII7","♭IIImaj7"] },
    ],
  },

  country: {
    name: "Country",
    progressions: [
      { mode: "major", name: "Three-Chord Country",desc: "I–IV–V — honky tonk staple",            nums: ["I","IV","V"] },
      { mode: "major", name: "Travelling",         desc: "I–V–IV–V",                              nums: ["I","V","IV","V"] },
      { mode: "major", name: "Country Axis",       desc: "I–V–vi–IV",                             nums: ["I","V","vi","IV"] },
      { mode: "major", name: "Long Cadence",       desc: "I–IV–I–V–I",                            nums: ["I","IV","I","V","I"] },
      { mode: "minor", name: "Outlaw Minor",       desc: "i–♭VII–♭VI–V",                          nums: ["i","♭VII","♭VI","V"] },
    ],
  },

  folk: {
    name: "Folk",
    progressions: [
      { mode: "major", name: "Campfire",           desc: "I–IV–V — every folk song ever",         nums: ["I","IV","V"] },
      { mode: "major", name: "Ballad",             desc: "I–V–vi–IV",                             nums: ["I","V","vi","IV"] },
      { mode: "major", name: "Authentic Cadence",  desc: "I–IV–V–I",                              nums: ["I","IV","V","I"] },
      { mode: "minor", name: "Modal Folk",         desc: "i–♭VII–♭VI–♭VII — Dorian-ish feel",     nums: ["i","♭VII","♭VI","♭VII"] },
      { mode: "minor", name: "Drone Folk",         desc: "i–♭VII–i",                              nums: ["i","♭VII","i"] },
    ],
  },

  rnb: {
    name: "R&B / Soul",
    progressions: [
      { mode: "major", name: "Soul Cadence",       desc: "ii–V–I with 7ths",                      nums: ["ii7","V7","Imaj7"] },
      { mode: "major", name: "Motown",             desc: "I–vi–IV–V",                             nums: ["I","vi","IV","V"] },
      { mode: "major", name: "Neo-Soul Loop",      desc: "Imaj7–ii7 back and forth",              nums: ["Imaj7","ii7"] },
      { mode: "minor", name: "Minor Soul",         desc: "i–iv–V",                                nums: ["i","iv","V"] },
      { mode: "minor", name: "Slow Jam",           desc: "i7–♭VImaj7–V7",                         nums: ["i7","♭VImaj7","V7"] },
    ],
  },

  funk: {
    name: "Funk",
    progressions: [
      { mode: "minor", name: "One-Chord Funk",     desc: "Vamp on i7 (Dorian groove)",            nums: ["i7"] },
      { mode: "minor", name: "Dorian Two",         desc: "i7–IV7 — Dorian vamp",                  nums: ["i7","IV7"] },
      { mode: "minor", name: "JB Funk",            desc: "i7–♭VII7",                              nums: ["i7","♭VII7"] },
      { mode: "major", name: "Major Funk",         desc: "I7–IV7 — dominant vamp",                nums: ["I7","IV7"] },
    ],
  },

  edm: {
    name: "EDM / House",
    progressions: [
      { mode: "minor", name: "Aeolian Loop",       desc: "i–♭VI–♭III–♭VII — EDM Axis",            nums: ["i","♭VI","♭III","♭VII"] },
      { mode: "minor", name: "Andalusian Drop",    desc: "i–♭VII–♭VI–V",                          nums: ["i","♭VII","♭VI","V"] },
      { mode: "minor", name: "House Loop",         desc: "i–iv–♭VII–♭III",                        nums: ["i","iv","♭VII","♭III"] },
      { mode: "major", name: "Festival Anthem",    desc: "I–V–vi–IV",                             nums: ["I","V","vi","IV"] },
      { mode: "major", name: "Trance Rotation",    desc: "vi–IV–I–V",                             nums: ["vi","IV","I","V"] },
    ],
  },

  reggae: {
    name: "Reggae",
    progressions: [
      { mode: "major", name: "One Drop",           desc: "I–IV — classic skank",                  nums: ["I","IV"] },
      { mode: "major", name: "Rocksteady",         desc: "I–vi–IV–V",                             nums: ["I","vi","IV","V"] },
      { mode: "major", name: "Roots",              desc: "I–IV–V",                                nums: ["I","IV","V"] },
      { mode: "minor", name: "Dub Minor",          desc: "i–♭VII",                                nums: ["i","♭VII"] },
    ],
  },

  punk: {
    name: "Punk",
    progressions: [
      { mode: "major", name: "Three-Chord Punk",   desc: "I–IV–V at speed",                       nums: ["I","IV","V"] },
      { mode: "major", name: "Pop Punk",           desc: "I–V–vi–IV",                             nums: ["I","V","vi","IV"] },
      { mode: "major", name: "Ramones",            desc: "I–♭VI–♭VII",                            nums: ["I","♭VI","♭VII"] },
      { mode: "minor", name: "Hardcore",           desc: "i–♭VI–♭III–♭VII",                       nums: ["i","♭VI","♭III","♭VII"] },
    ],
  },

  metal: {
    name: "Metal",
    progressions: [
      { mode: "minor", name: "Aeolian Gallop",     desc: "i–♭VI–♭VII–i",                          nums: ["i","♭VI","♭VII","i"] },
      { mode: "minor", name: "Andalusian Metal",   desc: "i–♭VII–♭VI–V",                          nums: ["i","♭VII","♭VI","V"] },
      { mode: "minor", name: "Phrygian Metal",     desc: "i–♭II–i — evil half-step",              nums: ["i","♭II","i"] },
      { mode: "minor", name: "Power-Chord Riff",   desc: "i–iv–v",                                nums: ["i","iv","v"] },
      { mode: "minor", name: "Iron Gallop",        desc: "i–♭III–♭VII–iv",                        nums: ["i","♭III","♭VII","iv"] },
      { mode: "major", name: "Mixolydian Metal",   desc: "I–♭VII–IV",                             nums: ["I","♭VII","IV"] },
    ],
  },

  flamenco: {
    name: "Flamenco / Spanish",
    progressions: [
      { mode: "minor", name: "Andalusian Cadence", desc: "i–♭VII–♭VI–V — the classic descent",    nums: ["i","♭VII","♭VI","V"] },
      { mode: "minor", name: "Phrygian Dominant",  desc: "i–♭II–i",                               nums: ["i","♭II","i"] },
      { mode: "minor", name: "Malagueña",          desc: "i–♭VII–♭VI–V–i",                        nums: ["i","♭VII","♭VI","V","i"] },
    ],
  },

  classical: {
    name: "Classical",
    progressions: [
      { mode: "major", name: "Authentic Cadence",  desc: "I–IV–V–I",                              nums: ["I","IV","V","I"] },
      { mode: "major", name: "Circle Progression", desc: "I–vi–ii–V–I",                           nums: ["I","vi","ii","V","I"] },
      { mode: "major", name: "Pachelbel",          desc: "I–V–vi–iii–IV–I–IV–V",                  nums: ["I","V","vi","iii","IV","I","IV","V"] },
      { mode: "major", name: "Plagal Cadence",     desc: "I–IV–I — the \"Amen\"",                 nums: ["I","IV","I"] },
      { mode: "minor", name: "Minor Cadence",      desc: "i–iv–V–i — harmonic minor",             nums: ["i","iv","V","i"] },
      { mode: "minor", name: "Neapolitan",         desc: "i–♭II–V–i",                             nums: ["i","♭II","V","i"] },
    ],
  },

  hiphop: {
    name: "Hip Hop",
    progressions: [
      { mode: "minor", name: "Boom-Bap Loop",      desc: "i–♭VII–♭VI–V",                          nums: ["i","♭VII","♭VI","V"] },
      { mode: "minor", name: "Two-Chord Loop",     desc: "i–iv",                                  nums: ["i","iv"] },
      { mode: "minor", name: "Trap Minor",         desc: "i–♭VI–♭VII",                            nums: ["i","♭VI","♭VII"] },
      { mode: "minor", name: "Soul Sample",        desc: "i7–iv7–♭VII7–♭IIImaj7",                 nums: ["i7","iv7","♭VII7","♭IIImaj7"] },
    ],
  },

  gospel: {
    name: "Gospel",
    progressions: [
      { mode: "major", name: "Gospel Turnaround",  desc: "I–iii–IV–V",                            nums: ["I","iii","IV","V"] },
      { mode: "major", name: "2–5–1",              desc: "ii7–V7–Imaj7",                          nums: ["ii7","V7","Imaj7"] },
      { mode: "major", name: "Amen",               desc: "I–IV–I",                                nums: ["I","IV","I"] },
      { mode: "major", name: "Shout",              desc: "I–vi–ii–V",                             nums: ["I","vi","ii7","V7"] },
    ],
  },
};

const GENRE_ORDER = ["pop","rock","blues","jazz","country","folk","rnb","funk","edm","reggae","punk","metal","flamenco","classical","hiphop","gospel"];

// Display labels for the 12 roots (match circle page).
const PROG_ROOT_LABELS = [
  { key: "C",  label: "C"     },
  { key: "C#", label: "C♯/D♭" },
  { key: "D",  label: "D"     },
  { key: "D#", label: "D♯/E♭" },
  { key: "E",  label: "E"     },
  { key: "F",  label: "F"     },
  { key: "F#", label: "F♯/G♭" },
  { key: "G",  label: "G"     },
  { key: "G#", label: "G♯/A♭" },
  { key: "A",  label: "A"     },
  { key: "A#", label: "A♯/B♭" },
  { key: "B",  label: "B"     },
];

// ── State ──────────────────────────────────────────────────────────
const progState = {
  root: "C",
  mode: "major",    // "major" | "minor"
  genre: "pop",
};

// ── Render ─────────────────────────────────────────────────────────
function renderProgressionsPage() {
  const tonicPc = noteIndex(progState.root);
  const keyLabel = `${spellPc(tonicPc, tonicPc, progState.mode)} ${progState.mode}`;

  // Controls
  const rootBtns = PROG_ROOT_LABELS.map(r =>
    `<button class="control-btn ${progState.root === r.key ? "active" : ""}" data-prog="root" data-val="${r.key}">${r.label}</button>`
  ).join("");

  const modeBtns = ["major","minor"].map(m =>
    `<button class="control-btn ${progState.mode === m ? "active" : ""}" data-prog="mode" data-val="${m}">${m[0].toUpperCase()+m.slice(1)}</button>`
  ).join("");

  const genreBtns = GENRE_ORDER.map(g =>
    `<button class="control-btn ${progState.genre === g ? "active" : ""}" data-prog="genre" data-val="${g}">${PROGRESSIONS[g].name}</button>`
  ).join("");

  document.getElementById("prog-controls").innerHTML = `
    <div class="control-group">
      <span class="control-label">Root</span>
      <div class="control-options">${rootBtns}</div>
    </div>
    <div class="control-group">
      <span class="control-label">Mode</span>
      <div class="control-options">${modeBtns}</div>
    </div>
    <div class="control-group">
      <span class="control-label">Genre</span>
      <div class="control-options prog-genre-row">${genreBtns}</div>
    </div>
  `;

  // Header: currently selected key + genre
  const genre = PROGRESSIONS[progState.genre];
  const matching = genre.progressions.filter(p => p.mode === progState.mode);

  const header = document.getElementById("prog-header");
  header.innerHTML = `
    <div class="prog-key-title">${keyLabel}</div>
    <div class="prog-key-sub">${genre.name} — ${matching.length} progression${matching.length === 1 ? "" : "s"}</div>
  `;

  // Progression cards
  const grid = document.getElementById("prog-grid");
  if (matching.length === 0) {
    grid.innerHTML = `<div class="prog-empty">No ${progState.mode} progressions listed for ${genre.name}. Try switching mode.</div>`;
  } else {
    grid.innerHTML = matching.map(p => {
      const chords = p.nums.map(sym => resolveChord(sym, tonicPc, p.mode));
      const steps = chords.map(c => `
        <div class="prog-step">
          <div class="prog-roman">${c.roman}</div>
          <div class="prog-chord">${c.name}</div>
        </div>
      `).join('<div class="prog-sep">→</div>');
      return `
        <div class="prog-card">
          <div class="prog-name">${p.name}</div>
          <div class="prog-desc">${p.desc}</div>
          <div class="prog-steps">${steps}</div>
        </div>
      `;
    }).join("");
  }

  attachProgressionsEvents();
}

function attachProgressionsEvents() {
  document.querySelectorAll("[data-prog]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.prog;
      const val = btn.dataset.val;
      if (key === "root")  progState.root  = val;
      else if (key === "mode")  progState.mode  = val;
      else if (key === "genre") progState.genre = val;
      renderProgressionsPage();
    };
  });
}

// Boot (page starts hidden; render now so it's ready when switched to).
renderProgressionsPage();
