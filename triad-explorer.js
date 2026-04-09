// ── Music theory constants ──────────────────────────────────────────
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const STANDARD_TUNING = [4, 11, 7, 2, 9, 4]; // E B G D A E
const STRING_NAMES = ["E","B","G","D","A","E"];
const NUM_FRETS = 15;

const noteIndex = n => NOTES.indexOf(n);
const noteName = i => NOTES[((i % 12) + 12) % 12];

const TRIAD_INTERVALS = { major: [0, 4, 7], minor: [0, 3, 7] };

// ── Triad logic ─────────────────────────────────────────────────────
function getTriadNotes(root, quality, inversion) {
  const rootIdx = noteIndex(root);
  const degrees = TRIAD_INTERVALS[quality].map(i => (rootIdx + i) % 12);
  for (let i = 0; i < inversion; i++) degrees.push(degrees.shift());
  return degrees;
}

function getTriadDegreeLabels(inversion) {
  const labels = ["1", "3", "5"];
  for (let i = 0; i < inversion; i++) labels.push(labels.shift());
  return labels;
}

function findTriadOnStrings(root, quality, inversion, startStringIdx) {
  const triadNotes = getTriadNotes(root, quality, inversion);
  const labels = getTriadDegreeLabels(inversion);
  const candidates = [];

  for (let i = 0; i < 3; i++) {
    const strIdx = startStringIdx + i;
    if (strIdx >= 6) return null;
    const openNote = STANDARD_TUNING[strIdx];
    const target = triadNotes[2 - i];
    const baseFret = ((target - openNote) % 12 + 12) % 12;
    const frets = [];
    for (let f = baseFret; f <= NUM_FRETS; f += 12) frets.push(f);
    candidates.push({ strIdx, frets, target, degree: labels[2 - i] });
  }

  let best = null, bestSpan = 999;
  for (const f0 of candidates[0].frets)
    for (const f1 of candidates[1].frets)
      for (const f2 of candidates[2].frets) {
        const span = Math.max(f0, f1, f2) - Math.min(f0, f1, f2);
        if (span < bestSpan) { bestSpan = span; best = [f0, f1, f2]; }
      }

  if (!best || bestSpan > 5) return null;
  return candidates.map((c, i) => ({
    string: c.strIdx, fret: best[i], note: noteName(c.target), degree: c.degree
  }));
}

// ── Scale & pattern generation ──────────────────────────────────────
function chordNotes(root, quality) {
  return TRIAD_INTERVALS[quality].map(i => (root + i) % 12);
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

function generatePatterns(root, quality) {
  const ri = noteIndex(root);
  const ii = (ri + 2) % 12, iii = (ri + 4) % 12;
  const iv = (ri + 5) % 12, v = (ri + 7) % 12, vi = (ri + 9) % 12;
  const patterns = [];

  // Diatonic chords
  patterns.push({ name: `ii — ${noteName(ii)} minor`,   notes: chordNotes(ii, "minor"),  desc: "The two chord" });
  patterns.push({ name: `iii — ${noteName(iii)} minor`,  notes: chordNotes(iii, "minor"), desc: "The three chord" });
  patterns.push({ name: `IV — ${noteName(iv)} major`,    notes: chordNotes(iv, "major"),  desc: "The four chord" });
  patterns.push({ name: `V — ${noteName(v)} major`,      notes: chordNotes(v, "major"),   desc: "The five chord" });
  patterns.push({ name: `vi — ${noteName(vi)} minor`,    notes: chordNotes(vi, "minor"),  desc: "Relative minor" });

  if (quality === "minor") {
    const rel = (ri + 3) % 12;
    patterns.push({ name: `III — ${noteName(rel)} major`, notes: chordNotes(rel, "major"), desc: "Relative major" });
  }

  // Pentatonic scales
  patterns.push({ name: `${root} major pentatonic`,          notes: majorPentatonic(ri), desc: "5-note major scale" });
  patterns.push({ name: `${noteName(vi)} minor pentatonic`,  notes: minorPentatonic(vi), desc: "Relative minor pentatonic" });
  if (quality === "minor") {
    patterns.push({ name: `${root} minor pentatonic`, notes: minorPentatonic(ri), desc: "5-note minor scale" });
  }

  // All 7 modes
  for (const mode of MODES) {
    patterns.push({ name: `${root} ${mode.name}`, notes: mode.steps.map(s => (ri + s) % 12), desc: mode.desc });
  }

  return patterns;
}

// ── Fretboard rendering ─────────────────────────────────────────────
function computeFretRange(triadPositions, padding) {
  padding = padding || 4;
  const frets = triadPositions.map(p => p.fret);
  return [
    Math.max(-1, Math.min(...frets) - padding),
    Math.min(NUM_FRETS, Math.max(...frets) + padding)
  ];
}

function renderFretboardSVG(triadPositions, patternNotes, fretRange, compact) {
  const [startFret, endFret] = fretRange;
  const numFrets = endFret - startFret;
  const ss = compact ? 18 : 24;   // string spacing
  const fs = compact ? 40 : 48;   // fret spacing
  const tp = compact ? 20 : 28;   // top padding
  const lp = compact ? 12 : 16;   // left padding
  const w = lp + numFrets * fs + 20;
  const h = tp + 5 * ss + 20;
  const dotRadius = compact ? 8 : 10;
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
  const offset = compact ? 6 : 8;
  const smallR = compact ? 6 : 7.5;

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
const QUALITIES = ["major", "minor"];
const INVERSIONS = ["Root position", "1st inversion", "2nd inversion"];
const STRING_GROUPS = [
  { label: "E-B-G", idx: 0 },
  { label: "B-G-D", idx: 1 },
  { label: "G-D-A", idx: 2 },
  { label: "D-A-E", idx: 3 },
];

const state = {
  root: "G",
  quality: "major",
  inversion: 1,
  stringGroup: 2,
  selectedPattern: null
};

function render() {
  const { root, quality, inversion, stringGroup, selectedPattern } = state;
  const sg = STRING_GROUPS[stringGroup];
  const triadPositions = findTriadOnStrings(root, quality, inversion, sg.idx);
  const patterns = generatePatterns(root, quality);
  const title = `${root} ${quality} — ${INVERSIONS[inversion]} — ${sg.label} strings`;

  // Print header
  const triadNoteNames = getTriadNotes(root, quality, inversion).map(n => noteName(n)).join(" – ");
  document.getElementById("print-header").innerHTML =
    `<div style="font-size:18px;font-weight:700;color:var(--text)">${title}</div>` +
    `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Triad notes: ${triadNoteNames} · <span style="color:var(--triad-fill)">●</span> triad · <span style="color:var(--pattern-note)">●</span> pattern</div>`;

  // Controls
  function btnRow(items, current, key, useIndex) {
    return items.map((item, i) => {
      const label = typeof item === "string" ? item : (item.label || item);
      const val = useIndex ? i : (typeof item === "string" ? item : i);
      const active = useIndex ? current === i : (current === val || current === i);
      const dataVal = useIndex ? i : (typeof item === "string" ? item : i);
      return `<button class="control-btn ${active ? "active" : ""}" data-key="${key}" data-val="${dataVal}">${label}</button>`;
    }).join("");
  }

  let controls = "";
  controls += `<div class="control-group"><div class="control-label">Root</div><div class="control-options">${btnRow(ROOTS, root, "root", false)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Quality</div><div class="control-options">${btnRow(QUALITIES, quality, "quality", false)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Inversion</div><div class="control-options">${btnRow(INVERSIONS, inversion, "inversion", true)}</div></div>`;
  controls += `<div class="control-group"><div class="control-label">Strings</div><div class="control-options">${btnRow(STRING_GROUPS.map(s => s.label), stringGroup, "stringGroup", true)}</div></div>`;
  controls += `<div class="control-group" style="justify-content:flex-end"><button class="print-btn" id="printBtn">Print this view</button></div>`;
  document.getElementById("controls").innerHTML = controls;

  // No valid voicing
  if (!triadPositions) {
    document.getElementById("main-board").innerHTML =
      `<div style="padding:40px;text-align:center;color:var(--text-muted)">That voicing doesn't fit on the fretboard. Try a different combination.</div>`;
    document.getElementById("patterns").innerHTML = "";
    attachEvents();
    return;
  }

  const fretRange = computeFretRange(triadPositions, 4);
  const activePattern = selectedPattern !== null ? patterns[selectedPattern] : null;
  const activeNotes = activePattern ? activePattern.notes : null;

  // Main fretboard
  let mainTitle = `<span class="chord-name">${root} ${quality}</span>`;
  mainTitle += `<span class="inv-tag">${INVERSIONS[inversion]}</span>`;
  mainTitle += `<span class="inv-tag">${sg.label} strings</span>`;
  if (activePattern) {
    mainTitle += `<span class="inv-tag" style="border-color:var(--pattern-note);color:var(--pattern-note)">+ ${activePattern.name}</span>`;
  }
  document.getElementById("main-board").innerHTML =
    `<div class="main-fretboard"><div class="main-title">${mainTitle}</div>${renderFretboardSVG(triadPositions, activeNotes, fretRange, false)}</div>`;

  // Pattern cards
  let cards = "";
  patterns.forEach((p, i) => {
    const sel = selectedPattern === i ? "selected" : "";
    cards += `<div class="pattern-card ${sel}" data-pattern="${i}">
      <div class="pattern-name">${p.name}</div>
      <div class="pattern-desc">${p.desc}</div>
      ${renderFretboardSVG(triadPositions, p.notes, fretRange, true)}
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
      if (key === "root") state.root = val;
      else if (key === "quality") state.quality = val;
      else if (key === "inversion") state.inversion = parseInt(val);
      else if (key === "stringGroup") state.stringGroup = parseInt(val);
      state.selectedPattern = null;
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
