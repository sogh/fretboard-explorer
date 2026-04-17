// ── Fretboard constants ─────────────────────────────────────────────
// Music theory (NOTES, noteIndex, noteName, CHORD_INTERVALS) comes from theory.js.
// Tuning and fret count come from instruments.js via getInstrument() so the
// same renderers serve guitar, bass, ukulele, banjo, and mandolin.

// ── Triad logic ─────────────────────────────────────────────────────
function getTriadNotes(root, quality, inversion) {
  const rootIdx = noteIndex(root);
  const degrees = CHORD_INTERVALS[quality].map(i => (rootIdx + i) % 12);
  for (let i = 0; i < inversion; i++) degrees.push(degrees.shift());
  return degrees;
}

function getTriadDegreeLabels(quality, inversion) {
  const base = {
    major: ["1","3","5"], minor: ["1","♭3","5"],
    dim: ["1","♭3","♭5"], aug: ["1","3","♯5"],
    sus2: ["1","2","5"], sus4: ["1","4","5"],
    maj7: ["1","3","5","7"], dom7: ["1","3","5","♭7"],
    min7: ["1","♭3","5","♭7"], mM7: ["1","♭3","5","7"],
    dim7: ["1","♭3","♭5","°7"], m7b5: ["1","♭3","♭5","♭7"],
  };
  const labels = [...(base[quality] || base.major)];
  for (let i = 0; i < inversion; i++) labels.push(labels.shift());
  return labels;
}

function findVoicingOnStrings(root, quality, inversion, startStringIdx) {
  const inst = getInstrument();
  const chordTones = getTriadNotes(root, quality, inversion);
  const labels = getTriadDegreeLabels(quality, inversion);
  const n = chordTones.length;
  const candidates = [];

  for (let i = 0; i < n; i++) {
    const strIdx = startStringIdx + i;
    if (strIdx >= inst.tuning.length) return null;
    const openNote = inst.tuning[strIdx];
    const target = chordTones[n - 1 - i];
    let baseFret = ((target - openNote) % 12 + 12) % 12;
    // Respect per-string minimum fret (e.g. banjo's drone string starts at 5).
    const minFret = inst.stringMinFret && inst.stringMinFret[strIdx] != null ? inst.stringMinFret[strIdx] : 0;
    while (baseFret < minFret) baseFret += 12;
    const frets = [];
    for (let f = baseFret; f <= inst.numFrets; f += 12) frets.push(f);
    if (!frets.length) return null;
    candidates.push({ strIdx, frets, target, degree: labels[n - 1 - i] });
  }

  // Cartesian product of all fret options, then pick smallest span
  let combos = [[]];
  for (const c of candidates) {
    const next = [];
    for (const combo of combos)
      for (const f of c.frets)
        next.push([...combo, f]);
    combos = next;
  }

  let best = null, bestSpan = 999;
  for (const combo of combos) {
    const span = Math.max(...combo) - Math.min(...combo);
    if (span < bestSpan) { bestSpan = span; best = combo; }
  }

  if (!best || bestSpan > 5) return null;
  return candidates.map((c, i) => ({
    string: c.strIdx, fret: best[i], note: noteName(c.target), degree: c.degree
  }));
}

// ── Scale & pattern generation ──────────────────────────────────────
function chordNotes(root, quality) {
  return CHORD_INTERVALS[quality].map(i => (root + i) % 12);
}

function majorPentatonic(root) { return [0, 2, 4, 7, 9].map(s => (root + s) % 12); }
function minorPentatonic(root) { return [0, 3, 5, 7, 10].map(s => (root + s) % 12); }

const MODES = [
  { name: "Ionian",     steps: [0,2,4,5,7,9,11], desc: "Mode 1 — major scale" },
  { name: "Dorian",     steps: [0,2,3,5,7,9,10], desc: "Mode 2 — minor with bright 6th" },
  { name: "Phrygian",   steps: [0,1,3,5,7,8,10], desc: "Mode 3 — minor with flat 2nd" },
  { name: "Lydian",     steps: [0,2,4,6,7,9,11], desc: "Mode 4 — major with sharp 4th" },
  { name: "Mixolydian", steps: [0,2,4,5,7,9,10], desc: "Mode 5 — major with flat 7th" },
  { name: "Aeolian",    steps: [0,2,3,5,7,8,10], desc: "Mode 6 — natural minor" },
  { name: "Locrian",    steps: [0,1,3,5,6,8,10], desc: "Mode 7 — diminished" },
];

// Build an enharmonic spelling map for a pattern when it's a 7-note scale.
// Returns null for chords (3-4 notes) and non-heptatonic scales (pentatonic,
// blues, etc.) — those fall back to NOTES[] sharp spellings.
function patternSpelling(pattern) {
  if (!pattern || !pattern.notes || pattern.notes.length !== 7) return null;
  const rootPc = pattern.notes[0];
  const steps = pattern.notes.map(n => (n - rootPc + 12) % 12);
  return spellScale(noteName(rootPc), steps);
}

function generatePatterns(root, quality, family) {
  const ri = noteIndex(root);
  const ii = (ri + 2) % 12, iii = (ri + 4) % 12;
  const iv = (ri + 5) % 12, v = (ri + 7) % 12;
  const vi = (ri + 9) % 12, vii = (ri + 11) % 12;
  const patterns = [];

  // Compose a chord-type pattern with the metadata the chord voicing
  // explorer needs (rootPc + quality + short spelling for the modal
  // title) while still carrying the verbose `chordText` the pattern
  // card shows inline.
  const chordPat = (roman, rootPc, q, chordText, shortSpelling, desc, category) => ({
    name: `${roman} — ${chordText}`,
    roman, chordText,
    chord: { rootPc, quality: q, spelling: shortSpelling },
    notes: chordNotes(rootPc, q),
    desc, category,
  });

  if (family === "7th") {
    // Diatonic 7th chords
    patterns.push(chordPat("ii7",    ii,  "min7", `${noteName(ii)}m7`,   `${noteName(ii)}m7`,   "The two chord",   "diatonic"));
    patterns.push(chordPat("iii7",   iii, "min7", `${noteName(iii)}m7`,  `${noteName(iii)}m7`,  "The three chord", "diatonic"));
    patterns.push(chordPat("IVmaj7", iv,  "maj7", `${noteName(iv)}maj7`, `${noteName(iv)}maj7`, "The four chord",  "diatonic"));
    patterns.push(chordPat("V7",     v,   "dom7", `${noteName(v)}7`,     `${noteName(v)}7`,     "The five chord",  "diatonic"));
    patterns.push(chordPat("vi7",    vi,  "min7", `${noteName(vi)}m7`,   `${noteName(vi)}m7`,   "Relative minor",  "diatonic"));
    patterns.push(chordPat("viiø7",  vii, "m7b5", `${noteName(vii)}m7♭5`,`${noteName(vii)}m7♭5`,"The seven chord", "diatonic"));
    if (quality === "min7" || quality === "mM7") {
      const rel = (ri + 3) % 12;
      patterns.push(chordPat("IIImaj7", rel, "maj7", `${noteName(rel)}maj7`, `${noteName(rel)}maj7`, "Relative major", "diatonic"));
    }
  } else {
    // Diatonic triads
    patterns.push(chordPat("ii",   ii,  "minor", `${noteName(ii)} minor`,   `${noteName(ii)}m`,  "The two chord",   "diatonic"));
    patterns.push(chordPat("iii",  iii, "minor", `${noteName(iii)} minor`,  `${noteName(iii)}m`, "The three chord", "diatonic"));
    patterns.push(chordPat("IV",   iv,  "major", `${noteName(iv)} major`,   noteName(iv),        "The four chord",  "diatonic"));
    patterns.push(chordPat("V",    v,   "major", `${noteName(v)} major`,    noteName(v),         "The five chord",  "diatonic"));
    patterns.push(chordPat("vi",   vi,  "minor", `${noteName(vi)} minor`,   `${noteName(vi)}m`,  "Relative minor",  "diatonic"));
    patterns.push(chordPat("vii°", vii, "dim",   `${noteName(vii)} dim`,    `${noteName(vii)}°`, "The seven chord", "diatonic"));
    if (quality === "minor") {
      const rel = (ri + 3) % 12;
      patterns.push(chordPat("III", rel, "major", `${noteName(rel)} major`, noteName(rel), "Relative major", "diatonic"));
    }
  }

  // Pentatonic scales
  patterns.push({ name: `${root} major pentatonic`,          notes: majorPentatonic(ri), desc: "5-note major scale",        category: "scales" });
  patterns.push({ name: `${noteName(vi)} minor pentatonic`,  notes: minorPentatonic(vi), desc: "Relative minor pentatonic", category: "scales" });
  const minorQualities = ["minor", "dim", "min7", "mM7", "dim7", "m7b5"];
  if (minorQualities.includes(quality)) {
    patterns.push({ name: `${root} minor pentatonic`, notes: minorPentatonic(ri), desc: "5-note minor scale", category: "scales" });
  }

  // Blues scale
  patterns.push({ name: `${root} blues scale`, notes: [0,3,5,6,7,10].map(s => (ri + s) % 12), desc: "Minor pentatonic + ♭5", category: "scales" });

  // Harmonic & melodic minor
  if (minorQualities.includes(quality)) {
    patterns.push({ name: `${root} harmonic minor`, notes: [0,2,3,5,7,8,11].map(s => (ri + s) % 12), desc: "Natural minor with raised 7th", category: "scales" });
    patterns.push({ name: `${root} melodic minor`,  notes: [0,2,3,5,7,9,11].map(s => (ri + s) % 12), desc: "Natural minor with raised 6th & 7th", category: "scales" });
  }

  // All 7 modes
  for (const mode of MODES) {
    patterns.push({ name: `${root} ${mode.name}`, notes: mode.steps.map(s => (ri + s) % 12), desc: mode.desc, category: "scales" });
  }

  // ── Functional patterns ──

  // Secondary dominants (V7 of each diatonic chord)
  const secDom = [
    { label: "V7/ii",  sr: (ri + 9) % 12,  resolves: `${noteName(ii)}m` },
    { label: "V7/iii", sr: (ri + 11) % 12, resolves: `${noteName(iii)}m` },
    { label: "V7/IV",  sr: ri,              resolves: noteName(iv) },
    { label: "V7/V",   sr: (ri + 2) % 12,  resolves: noteName(v) },
    { label: "V7/vi",  sr: (ri + 4) % 12,  resolves: `${noteName(vi)}m` },
  ];
  for (const sd of secDom) {
    patterns.push(chordPat(sd.label, sd.sr, "dom7", `${noteName(sd.sr)}7`, `${noteName(sd.sr)}7`, `Resolves to ${sd.resolves}`, "functional"));
  }

  // Borrowed chords (from parallel minor when major-type, from parallel major when minor-type)
  const majorQualities = ["major", "aug", "sus2", "sus4", "maj7", "dom7"];
  if (majorQualities.includes(quality)) {
    const biii = (ri + 3) % 12, bvi = (ri + 8) % 12, bvii = (ri + 10) % 12;
    patterns.push(chordPat("♭III", biii, "major", noteName(biii), noteName(biii), "Borrowed from parallel minor", "functional"));
    patterns.push(chordPat("♭VI",  bvi,  "major", noteName(bvi),  noteName(bvi),  "Borrowed from parallel minor", "functional"));
    patterns.push(chordPat("♭VII", bvii, "major", noteName(bvii), noteName(bvii), "Borrowed from parallel minor", "functional"));
  }

  // Tritone substitution (♭II7 — tritone sub for V7)
  const tritone = (ri + 1) % 12;
  patterns.push(chordPat("♭II7", tritone, "dom7", `${noteName(tritone)}7`, `${noteName(tritone)}7`, "Tritone sub for V7", "functional"));

  return patterns;
}

// ── Fretboard rendering ─────────────────────────────────────────────
function computeFretRange(triadPositions, totalFrets) {
  totalFrets = totalFrets || 11;
  const frets = triadPositions.map(p => p.fret);
  const center = (Math.min(...frets) + Math.max(...frets)) / 2;
  const half = totalFrets / 2;
  let start = Math.round(center - half);
  let end = start + totalFrets;
  // Clamp to valid range
  if (start < -1) { start = -1; end = start + totalFrets; }
  const maxFret = getInstrument().numFrets;
  if (end > maxFret) { end = maxFret; start = end - totalFrets; }
  return [start, end];
}

function renderFretboardSVG(triadPositions, patternNotes, fretRange, compact, ghostPositions, patternSpellingMap, shapeOpts) {
  const inst = getInstrument();
  const numStrings = inst.tuning.length;
  const [startFret, endFret] = fretRange;
  const numFrets = endFret - startFret;
  const ss = compact ? 20 : 20;   // string spacing
  const fs = compact ? 42 : 40;   // fret spacing
  const tp = compact ? 22 : 24;   // top padding
  const lp = compact ? 14 : 14;   // left padding
  const w = lp + numFrets * fs + 20;
  const h = tp + (numStrings - 1) * ss + 20;
  const dotRadius = compact ? 9 : 9;
  const fretDots = [3, 5, 7, 9, 12, 15];
  const midString = (numStrings - 1) / 2;

  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

  // Barre indicator (a soft bar across the barred strings at the barre fret).
  // Drawn early so note dots render on top of it.
  if (shapeOpts && shapeOpts.barre) {
    const { fret, fromString, toString } = shapeOpts.barre;
    if (fret >= startFret + 1 && fret <= endFret) {
      const fi = fret - startFret - 1;
      const cx = lp + fi * fs + fs / 2;
      const y1 = tp + Math.min(fromString, toString) * ss;
      const y2 = tp + Math.max(fromString, toString) * ss;
      svg += `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" stroke="var(--triad-stroke)" stroke-width="${compact ? 18 : 20}" stroke-linecap="round" opacity="0.22"/>`;
    }
  }

  // Fret position dots — double at the octave, single elsewhere.
  for (const d of fretDots) {
    if (d < startFret + 1 || d > endFret) continue;
    const x = lp + (d - startFret - 1) * fs + fs / 2;
    if (d === 12) {
      svg += `<circle cx="${x}" cy="${tp + (midString - 1) * ss}" r="3" fill="var(--dot-muted)" opacity="0.4"/>`;
      svg += `<circle cx="${x}" cy="${tp + (midString + 1) * ss}" r="3" fill="var(--dot-muted)" opacity="0.4"/>`;
    } else {
      svg += `<circle cx="${x}" cy="${tp + midString * ss}" r="3" fill="var(--dot-muted)" opacity="0.3"/>`;
    }
  }

  // Fret lines span the full string stack.
  for (let i = 0; i <= numFrets; i++) {
    const x = lp + i * fs;
    const fretNum = startFret + i;
    const isNut = fretNum === 0;
    svg += `<line x1="${x}" y1="${tp}" x2="${x}" y2="${tp + (numStrings - 1) * ss}" stroke="var(--fret-color)" stroke-width="${isNut ? 3 : 1}" opacity="${isNut ? 0.8 : 0.3}"/>`;
  }

  // Strings — truncate any with a per-string minimum fret (banjo drone).
  for (let i = 0; i < numStrings; i++) {
    const y = tp + i * ss;
    const minFret = inst.stringMinFret && inst.stringMinFret[i] != null ? inst.stringMinFret[i] : 0;
    // Start X at whichever is larger: the visible fretboard left edge, or the string's actual nut.
    const stringStartFret = Math.max(startFret, minFret);
    if (stringStartFret > endFret) continue;
    const x1 = lp + (stringStartFret - startFret) * fs;
    const x2 = lp + numFrets * fs;
    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--string-color)" stroke-width="${(1 + i * 0.3).toFixed(1)}" opacity="0.5"/>`;
  }

  // Fret numbers
  for (let i = 0; i < numFrets; i++) {
    const fretNum = startFret + i + 1;
    if (fretNum < 0) continue;
    svg += `<text x="${lp + i * fs + fs / 2}" y="${h - 2}" text-anchor="middle" font-size="${compact ? 8 : 9}" fill="var(--text-muted)" font-family="monospace">${fretNum}</text>`;
  }

  // Muted-string markers ("×" just left of the nut) — used by barre/open
  // shape cards so the viewer can see which strings to dampen.
  if (shapeOpts && shapeOpts.muted && shapeOpts.muted.length) {
    const xPos = lp - 6;
    for (const si of shapeOpts.muted) {
      svg += `<text x="${xPos}" y="${tp + si * ss + 4}" text-anchor="middle" font-size="${compact ? 10 : 11}" fill="var(--text-muted)" font-family="monospace" font-weight="700">×</text>`;
    }
  }

  // Ghost inversion notes (other nearby inversions, rendered muted)
  if (ghostPositions && ghostPositions.length && !compact) {
    const triadKeys = new Set(triadPositions.map(p => `${p.string}-${p.fret}`));
    for (const gp of ghostPositions) {
      if (gp.fret < startFret || gp.fret > endFret) continue;
      if (triadKeys.has(`${gp.string}-${gp.fret}`)) continue;
      const fi = gp.fret - startFret - 1;
      const cx = lp + fi * fs + fs / 2;
      const cy = tp + gp.string * ss;
      svg += `<circle cx="${cx}" cy="${cy}" r="${dotRadius}" fill="var(--ghost-fill)" stroke="var(--ghost-stroke)" stroke-width="1.5" opacity="0.2"/>`;
      svg += `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" fill="var(--ghost-text)" font-weight="700" font-family="monospace" opacity="0.25">${gp.degree}</text>`;
    }
  }

  // Build triad position map
  const triadMap = {};
  triadPositions.filter(p => p.fret >= startFret && p.fret <= endFret).forEach(p => {
    triadMap[`${p.string}-${p.fret}`] = p;
  });

  const patternSet = patternNotes ? new Set(patternNotes) : null;
  const offset = compact ? 7 : 7;
  const smallR = compact ? 7 : 7;

  // Pattern + overlap notes
  if (patternSet) {
    for (let si = 0; si < numStrings; si++) {
      for (let fi = 0; fi < numFrets; fi++) {
        const fret = startFret + fi + 1;
        if (fret < 0 || fret > inst.numFrets) continue;
        if (!fretPositionPlayable(si, fret)) continue;
        const noteAtFret = (inst.tuning[si] + fret) % 12;
        if (!patternSet.has(noteAtFret)) continue;

        const key = `${si}-${fret}`;
        const cx = lp + fi * fs + fs / 2;
        const cy = tp + si * ss;

        if (triadMap[key]) {
          // Overlapping: triad + pattern side by side
          const t = triadMap[key];
          svg += `<circle cx="${cx - offset}" cy="${cy}" r="${smallR}" fill="var(--triad-fill)" stroke="var(--triad-stroke)" stroke-width="1.5"/>`;
          svg += `<text x="${cx - offset}" y="${cy + (compact ? 3 : 3.5)}" text-anchor="middle" font-size="${compact ? 7 : 8}" fill="var(--triad-text)" font-weight="700" font-family="monospace">${t.degree}</text>`;
          svg += `<circle cx="${cx + offset}" cy="${cy}" r="${smallR - 1}" fill="var(--pattern-note)" opacity="0.7"/>`;
          svg += `<text x="${cx + offset}" y="${cy + 3}" text-anchor="middle" font-size="${compact ? 6 : 7}" fill="var(--pattern-text)" font-family="monospace" font-weight="500">${spellNote(noteAtFret, patternSpellingMap)}</text>`;
        } else {
          // Pattern only
          svg += `<circle cx="${cx}" cy="${cy}" r="${dotRadius - 2}" fill="var(--pattern-note)" opacity="0.6"/>`;
          svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="${compact ? 7 : 8}" fill="var(--pattern-text)" font-family="monospace" font-weight="500">${spellNote(noteAtFret, patternSpellingMap)}</text>`;
        }
      }
    }
  }

  // Triad-only notes (not overlapping with pattern)
  triadPositions.filter(p => p.fret >= startFret && p.fret <= endFret).forEach(p => {
    const noteAtFret = (inst.tuning[p.string] + p.fret) % 12;
    if (patternSet && patternSet.has(noteAtFret)) return;
    const fi = p.fret - startFret - 1;
    const cx = lp + fi * fs + fs / 2;
    const cy = tp + p.string * ss;
    svg += `<circle cx="${cx}" cy="${cy}" r="${dotRadius}" fill="var(--triad-fill)" stroke="var(--triad-stroke)" stroke-width="2"/>`;
    svg += `<text x="${cx}" y="${cy + (compact ? 3 : 3.5)}" text-anchor="middle" font-size="${compact ? 8 : 10}" fill="var(--triad-text)" font-weight="700" font-family="monospace">${p.degree}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

// ── UI state & rendering ────────────────────────────────────────────
const FLAT_NAMES = { "C#":"Db", "D#":"Eb", "F#":"Gb", "G#":"Ab", "A#":"Bb" };
const ROOTS = NOTES.map(n => FLAT_NAMES[n] ? { key: n, label: n + "/" + FLAT_NAMES[n] } : n);
const FAMILY_OPTIONS = [
  { key: "triad", label: "Triad" },
  { key: "7th", label: "7th" },
];
const FAMILY_QUALITIES = {
  triad: ["major", "minor", "dim", "aug", "sus2", "sus4"],
  "7th": [
    { key: "maj7", label: "maj7" },
    { key: "dom7", label: "7" },
    { key: "min7", label: "min7" },
    { key: "mM7", label: "m(M7)" },
    { key: "dim7", label: "dim7" },
    { key: "m7b5", label: "m7♭5" },
  ],
};
const QUALITY_DISPLAY = {};
for (const fam of Object.values(FAMILY_QUALITIES))
  for (const item of fam)
    if (typeof item === "object") QUALITY_DISPLAY[item.key] = item.label;

const TRIAD_INVERSIONS = ["Root position", "1st inversion", "2nd inversion"];
const SEVENTH_INVERSIONS = ["Root position", "1st inversion", "2nd inversion", "3rd inversion"];

const PATTERN_TABS = [
  { key: "all", label: "All" },
  { key: "diatonic", label: "Diatonic" },
  { key: "scales", label: "Scales" },
  { key: "functional", label: "Functional" },
];

const state = {
  root: "G",
  family: "triad",
  quality: "major",
  inversion: 1,
  stringGroup: 2,
  patternCategory: "all",
  selectedPattern: null
};

function render() {
  const inst = getInstrument();
  const { root, family, quality, inversion, selectedPattern } = state;
  const is7th = family === "7th";
  const inversions = is7th ? SEVENTH_INVERSIONS : TRIAD_INVERSIONS;
  const stringGroups = is7th ? inst.seventhGroups : inst.triadGroups;
  // Clamp string-group index in case we just switched to an instrument with fewer groups.
  if (state.stringGroup >= stringGroups.length) state.stringGroup = 0;
  const stringGroup = state.stringGroup;
  const qualities = FAMILY_QUALITIES[family];
  const sg = stringGroups[stringGroup];
  const voicing = findVoicingOnStrings(root, quality, inversion, sg.idx);
  const patterns = generatePatterns(root, quality, family);
  const displayQ = QUALITY_DISPLAY[quality] || quality;
  const chordName = /^\d/.test(displayQ) ? `${root}${displayQ}` : `${root} ${displayQ}`;
  const title = `${chordName} — ${inversions[inversion]} — ${sg.label} strings`;

  // Print header
  const noteNames = getTriadNotes(root, quality, inversion).map(n => noteName(n)).join(" – ");
  document.getElementById("print-header").innerHTML =
    `<div style="font-size:18px;font-weight:700;color:var(--text)">${title}</div>` +
    `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Notes: ${noteNames} · <span style="color:var(--triad-fill)">●</span> chord · <span style="color:var(--pattern-note)">●</span> pattern</div>`;

  // Controls
  function btnRow(items, current, dataKey, useIndex) {
    return items.map((item, i) => {
      const isObj = typeof item === "object" && item !== null;
      const label = isObj ? item.label : item;
      const val = useIndex ? i : (isObj ? item.key : item);
      const active = current === val;
      return `<button class="control-btn ${active ? "active" : ""}" data-key="${dataKey}" data-val="${val}">${label}</button>`;
    }).join("");
  }

  let controls = "";
  controls += `<div class="control-group"><div class="control-label">Root</div><div class="control-options">${btnRow(ROOTS, root, "root", false)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Type</div><div class="control-options">${btnRow(FAMILY_OPTIONS, family, "family", false)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Quality</div><div class="control-options">${btnRow(qualities, quality, "quality", false)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Inversion</div><div class="control-options">${btnRow(inversions, inversion, "inversion", true)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Strings</div><div class="control-options">${btnRow(stringGroups.map(s => s.label), stringGroup, "stringGroup", true)}</div></div>`;
  controls += `<div class="control-group" style="justify-content:flex-end"><button class="print-btn" id="printBtn">Print this view</button></div>`;
  document.getElementById("controls").innerHTML = controls;

  // No valid voicing
  if (!voicing) {
    document.getElementById("main-board").innerHTML =
      `<div style="padding:40px;text-align:center;color:var(--text-muted)">That voicing doesn't fit on the fretboard. Try a different combination.</div>`;
    document.getElementById("pattern-header").innerHTML = "";
    document.getElementById("patterns").innerHTML = "";
    attachEvents();
    return;
  }

  const fretRange = computeFretRange(voicing, 11);
  const activePattern = selectedPattern !== null ? patterns[selectedPattern] : null;
  const activeNotes = activePattern ? activePattern.notes : null;
  const activeSpellingMap = activePattern ? patternSpelling(activePattern) : null;

  // Compute ghost voicings from other inversions on the same string group
  const ghostPositions = [];
  const numInversions = inversions.length;
  for (let inv = 0; inv < numInversions; inv++) {
    if (inv === inversion) continue;
    const gv = findVoicingOnStrings(root, quality, inv, sg.idx);
    if (gv) ghostPositions.push(...gv);
  }

  // Main fretboard
  let mainTitle = `<span class="chord-name">${chordName}</span>`;
  mainTitle += `<span class="inv-tag">${inversions[inversion]}</span>`;
  mainTitle += `<span class="inv-tag">${sg.label} strings</span>`;
  const voicingDegrees = [...voicing].reverse().map(v => v.degree).join(" ");
  const voicingNotes = [...voicing].reverse().map(v => v.note).join(" ");
  mainTitle += `<span class="inv-tag">${voicingDegrees} / <strong>${voicingNotes}</strong></span>`;
  if (activePattern) {
    mainTitle += `<span class="inv-tag" style="border-color:var(--pattern-note);color:var(--pattern-note)">+ ${activePattern.name}</span>`;
  }
  document.getElementById("main-board").innerHTML =
    `<div class="main-fretboard"><div class="main-title">${mainTitle}</div>${renderFretboardSVG(voicing, activeNotes, fretRange, false, ghostPositions, activeSpellingMap)}</div>`;

  // Pattern header with category tabs
  let tabsHtml = `<span class="patterns-label">Related patterns</span><div class="pattern-tabs">`;
  for (const tab of PATTERN_TABS) {
    tabsHtml += `<button class="pattern-tab ${state.patternCategory === tab.key ? "active" : ""}" data-category="${tab.key}">${tab.label}</button>`;
  }
  tabsHtml += `</div>`;
  document.getElementById("pattern-header").innerHTML = tabsHtml;

  // Pattern cards (filtered by category)
  // Chord-type patterns render the chord-spelling half of the name as a
  // .chord-link so clicking it opens the voicing explorer. Scale/mode
  // patterns keep their plain name.
  const renderPatternName = (p) => {
    if (!p.chord) return p.name;
    const { rootPc, quality, spelling } = p.chord;
    const linked = `<span class="chord-link" data-chord-root="${rootPc}" data-chord-quality="${quality}" data-chord-name="${spelling}" title="Explore voicings of ${spelling}">${p.chordText}</span>`;
    return p.roman ? `${p.roman} — ${linked}` : linked;
  };
  let cards = "";
  patterns.forEach((p, i) => {
    if (state.patternCategory !== "all" && p.category !== state.patternCategory) return;
    const sel = selectedPattern === i ? "selected" : "";
    const pMap = patternSpelling(p);
    cards += `<div class="pattern-card ${sel}" data-pattern="${i}">
      <div class="pattern-name">${renderPatternName(p)}</div>
      <div class="pattern-desc">${p.desc}</div>
      ${renderFretboardSVG(voicing, p.notes, fretRange, true, null, pMap)}
      <div class="pattern-notes-list">${p.notes.map(n => spellNote(n, pMap)).join(" · ")}</div>
    </div>`;
  });
  document.getElementById("patterns").innerHTML = cards;

  attachEvents();
}

function attachEvents() {
  document.querySelectorAll(".control-btn").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      if (key === "family") {
        state.family = val;
        const firstQ = FAMILY_QUALITIES[val][0];
        state.quality = typeof firstQ === "string" ? firstQ : firstQ.key;
        state.inversion = 0;
        state.stringGroup = 0;
      }
      else if (key === "root") state.root = val;
      else if (key === "quality") state.quality = val;
      else if (key === "inversion") state.inversion = parseInt(val);
      else if (key === "stringGroup") state.stringGroup = parseInt(val);
      state.selectedPattern = null;
      render();
    };
  });

  document.querySelectorAll(".pattern-tab").forEach(tab => {
    tab.onclick = () => {
      state.patternCategory = tab.dataset.category;
      render();
    };
  });

  document.querySelectorAll(".pattern-card").forEach(card => {
    card.onclick = () => {
      const i = parseInt(card.dataset.pattern);
      state.selectedPattern = state.selectedPattern === i ? null : i;
      render();
    };
  });

  const printBtn = document.getElementById("printBtn");
  if (printBtn) printBtn.onclick = () => window.print();
}

// Boot
render();
