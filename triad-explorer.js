// ── Music theory constants ──────────────────────────────────────────
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const STANDARD_TUNING = [4, 11, 7, 2, 9, 4]; // E B G D A E
const STRING_NAMES = ["E","B","G","D","A","E"];
const NUM_FRETS = 15;

const noteIndex = n => NOTES.indexOf(n);
const noteName = i => NOTES[((i % 12) + 12) % 12];

const CHORD_INTERVALS = {
  major: [0, 4, 7], minor: [0, 3, 7],
  dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11], dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10], mM7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
};

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
  const chordTones = getTriadNotes(root, quality, inversion);
  const labels = getTriadDegreeLabels(quality, inversion);
  const n = chordTones.length;
  const candidates = [];

  for (let i = 0; i < n; i++) {
    const strIdx = startStringIdx + i;
    if (strIdx >= 6) return null;
    const openNote = STANDARD_TUNING[strIdx];
    const target = chordTones[n - 1 - i];
    const baseFret = ((target - openNote) % 12 + 12) % 12;
    const frets = [];
    for (let f = baseFret; f <= NUM_FRETS; f += 12) frets.push(f);
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

function generatePatterns(root, quality, family) {
  const ri = noteIndex(root);
  const ii = (ri + 2) % 12, iii = (ri + 4) % 12;
  const iv = (ri + 5) % 12, v = (ri + 7) % 12;
  const vi = (ri + 9) % 12, vii = (ri + 11) % 12;
  const patterns = [];

  if (family === "7th") {
    // Diatonic 7th chords
    patterns.push({ name: `ii7 — ${noteName(ii)}m7`,          notes: chordNotes(ii, "min7"),   desc: "The two chord",   category: "diatonic" });
    patterns.push({ name: `iii7 — ${noteName(iii)}m7`,         notes: chordNotes(iii, "min7"),  desc: "The three chord", category: "diatonic" });
    patterns.push({ name: `IVmaj7 — ${noteName(iv)}maj7`,      notes: chordNotes(iv, "maj7"),   desc: "The four chord",  category: "diatonic" });
    patterns.push({ name: `V7 — ${noteName(v)}7`,              notes: chordNotes(v, "dom7"),    desc: "The five chord",  category: "diatonic" });
    patterns.push({ name: `vi7 — ${noteName(vi)}m7`,           notes: chordNotes(vi, "min7"),   desc: "Relative minor",  category: "diatonic" });
    patterns.push({ name: `viiø7 — ${noteName(vii)}m7♭5`,      notes: chordNotes(vii, "m7b5"),  desc: "The seven chord", category: "diatonic" });
    if (quality === "min7" || quality === "mM7") {
      const rel = (ri + 3) % 12;
      patterns.push({ name: `IIImaj7 — ${noteName(rel)}maj7`, notes: chordNotes(rel, "maj7"), desc: "Relative major", category: "diatonic" });
    }
  } else {
    // Diatonic triads
    patterns.push({ name: `ii — ${noteName(ii)} minor`,    notes: chordNotes(ii, "minor"),   desc: "The two chord",   category: "diatonic" });
    patterns.push({ name: `iii — ${noteName(iii)} minor`,   notes: chordNotes(iii, "minor"),  desc: "The three chord", category: "diatonic" });
    patterns.push({ name: `IV — ${noteName(iv)} major`,     notes: chordNotes(iv, "major"),   desc: "The four chord",  category: "diatonic" });
    patterns.push({ name: `V — ${noteName(v)} major`,       notes: chordNotes(v, "major"),    desc: "The five chord",  category: "diatonic" });
    patterns.push({ name: `vi — ${noteName(vi)} minor`,     notes: chordNotes(vi, "minor"),   desc: "Relative minor",  category: "diatonic" });
    patterns.push({ name: `vii° — ${noteName(vii)} dim`,    notes: chordNotes(vii, "dim"),    desc: "The seven chord", category: "diatonic" });
    if (quality === "minor") {
      const rel = (ri + 3) % 12;
      patterns.push({ name: `III — ${noteName(rel)} major`, notes: chordNotes(rel, "major"), desc: "Relative major", category: "diatonic" });
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
    patterns.push({ name: `${sd.label} — ${noteName(sd.sr)}7`, notes: chordNotes(sd.sr, "dom7"), desc: `Resolves to ${sd.resolves}`, category: "functional" });
  }

  // Borrowed chords (from parallel minor when major-type, from parallel major when minor-type)
  const majorQualities = ["major", "aug", "sus2", "sus4", "maj7", "dom7"];
  if (majorQualities.includes(quality)) {
    const biii = (ri + 3) % 12, bvi = (ri + 8) % 12, bvii = (ri + 10) % 12;
    patterns.push({ name: `♭III — ${noteName(biii)}`,  notes: chordNotes(biii, "major"), desc: "Borrowed from parallel minor", category: "functional" });
    patterns.push({ name: `♭VI — ${noteName(bvi)}`,    notes: chordNotes(bvi, "major"),  desc: "Borrowed from parallel minor", category: "functional" });
    patterns.push({ name: `♭VII — ${noteName(bvii)}`,   notes: chordNotes(bvii, "major"), desc: "Borrowed from parallel minor", category: "functional" });
  }

  // Tritone substitution (♭II7 — tritone sub for V7)
  const tritone = (ri + 1) % 12;
  patterns.push({ name: `♭II7 — ${noteName(tritone)}7`, notes: chordNotes(tritone, "dom7"), desc: "Tritone sub for V7", category: "functional" });

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
  if (end > NUM_FRETS) { end = NUM_FRETS; start = end - totalFrets; }
  return [start, end];
}

function renderFretboardSVG(triadPositions, patternNotes, fretRange, compact) {
  const [startFret, endFret] = fretRange;
  const numFrets = endFret - startFret;
  const ss = compact ? 20 : 20;   // string spacing
  const fs = compact ? 42 : 40;   // fret spacing
  const tp = compact ? 22 : 24;   // top padding
  const lp = compact ? 14 : 14;   // left padding
  const w = lp + numFrets * fs + 20;
  const h = tp + 5 * ss + 20;
  const dotRadius = compact ? 9 : 9;
  const fretDots = [3, 5, 7, 9, 12, 15];

  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

  // Fret position dots
  for (const d of fretDots) {
    if (d < startFret + 1 || d > endFret) continue;
    const x = lp + (d - startFret - 1) * fs + fs / 2;
    if (d === 12) {
      svg += `<circle cx="${x}" cy="${tp + 1.5 * ss}" r="3" fill="var(--dot-muted)" opacity="0.4"/>`;
      svg += `<circle cx="${x}" cy="${tp + 3.5 * ss}" r="3" fill="var(--dot-muted)" opacity="0.4"/>`;
    } else {
      svg += `<circle cx="${x}" cy="${tp + 2.5 * ss}" r="3" fill="var(--dot-muted)" opacity="0.3"/>`;
    }
  }

  // Fret lines
  for (let i = 0; i <= numFrets; i++) {
    const x = lp + i * fs;
    const fretNum = startFret + i;
    const isNut = fretNum === 0;
    svg += `<line x1="${x}" y1="${tp}" x2="${x}" y2="${tp + 5 * ss}" stroke="var(--fret-color)" stroke-width="${isNut ? 3 : 1}" opacity="${isNut ? 0.8 : 0.3}"/>`;
  }

  // Strings
  for (let i = 0; i < 6; i++) {
    const y = tp + i * ss;
    svg += `<line x1="${lp}" y1="${y}" x2="${lp + numFrets * fs}" y2="${y}" stroke="var(--string-color)" stroke-width="${(1 + i * 0.3).toFixed(1)}" opacity="0.5"/>`;
  }

  // Fret numbers
  for (let i = 0; i < numFrets; i++) {
    const fretNum = startFret + i + 1;
    if (fretNum < 0) continue;
    svg += `<text x="${lp + i * fs + fs / 2}" y="${h - 2}" text-anchor="middle" font-size="${compact ? 8 : 9}" fill="var(--text-muted)" font-family="monospace">${fretNum}</text>`;
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
    for (let si = 0; si < 6; si++) {
      for (let fi = 0; fi < numFrets; fi++) {
        const fret = startFret + fi + 1;
        if (fret < 0 || fret > NUM_FRETS) continue;
        const noteAtFret = (STANDARD_TUNING[si] + fret) % 12;
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
          svg += `<text x="${cx + offset}" y="${cy + 3}" text-anchor="middle" font-size="${compact ? 6 : 7}" fill="var(--pattern-text)" font-family="monospace" font-weight="500">${noteName(noteAtFret)}</text>`;
        } else {
          // Pattern only
          svg += `<circle cx="${cx}" cy="${cy}" r="${dotRadius - 2}" fill="var(--pattern-note)" opacity="0.6"/>`;
          svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="${compact ? 7 : 8}" fill="var(--pattern-text)" font-family="monospace" font-weight="500">${noteName(noteAtFret)}</text>`;
        }
      }
    }
  }

  // Triad-only notes (not overlapping with pattern)
  triadPositions.filter(p => p.fret >= startFret && p.fret <= endFret).forEach(p => {
    const noteAtFret = (STANDARD_TUNING[p.string] + p.fret) % 12;
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
const ROOTS = NOTES;
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
const TRIAD_STRING_GROUPS = [
  { label: "E-B-G", idx: 0 },
  { label: "B-G-D", idx: 1 },
  { label: "G-D-A", idx: 2 },
  { label: "D-A-E", idx: 3 },
];
const SEVENTH_STRING_GROUPS = [
  { label: "E-B-G-D", idx: 0 },
  { label: "B-G-D-A", idx: 1 },
  { label: "G-D-A-E", idx: 2 },
];

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
  const { root, family, quality, inversion, stringGroup, selectedPattern } = state;
  const is7th = family === "7th";
  const inversions = is7th ? SEVENTH_INVERSIONS : TRIAD_INVERSIONS;
  const stringGroups = is7th ? SEVENTH_STRING_GROUPS : TRIAD_STRING_GROUPS;
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

  // Main fretboard
  let mainTitle = `<span class="chord-name">${chordName}</span>`;
  mainTitle += `<span class="inv-tag">${inversions[inversion]}</span>`;
  mainTitle += `<span class="inv-tag">${sg.label} strings</span>`;
  if (activePattern) {
    mainTitle += `<span class="inv-tag" style="border-color:var(--pattern-note);color:var(--pattern-note)">+ ${activePattern.name}</span>`;
  }
  document.getElementById("main-board").innerHTML =
    `<div class="main-fretboard"><div class="main-title">${mainTitle}</div>${renderFretboardSVG(voicing, activeNotes, fretRange, false)}</div>`;

  // Pattern header with category tabs
  let tabsHtml = `<span class="patterns-label">Related patterns</span><div class="pattern-tabs">`;
  for (const tab of PATTERN_TABS) {
    tabsHtml += `<button class="pattern-tab ${state.patternCategory === tab.key ? "active" : ""}" data-category="${tab.key}">${tab.label}</button>`;
  }
  tabsHtml += `</div>`;
  document.getElementById("pattern-header").innerHTML = tabsHtml;

  // Pattern cards (filtered by category)
  let cards = "";
  patterns.forEach((p, i) => {
    if (state.patternCategory !== "all" && p.category !== state.patternCategory) return;
    const sel = selectedPattern === i ? "selected" : "";
    cards += `<div class="pattern-card ${sel}" data-pattern="${i}">
      <div class="pattern-name">${p.name}</div>
      <div class="pattern-desc">${p.desc}</div>
      ${renderFretboardSVG(voicing, p.notes, fretRange, true)}
      <div class="pattern-notes-list">${p.notes.map(n => noteName(n)).join(" · ")}</div>
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
