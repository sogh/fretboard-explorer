// ── Practice Sequencer ──────────────────────────────────────────────
// Depends on: theory.js (NOTES, SCALES, CHORD_INTERVALS, noteIndex, noteName,
//   spellScale, spellNote, chordPcs, suggestScalesForBracket),
// instruments.js, triad-explorer.js (findVoicingOnStrings, computeFretRange,
//   renderFretboardSVG, getTriadDegreeLabels), sequence-model.js.

const SEQ_STORAGE_KEY = "fretboard-explorer-sequence";

// ── Sequencer state (global) ───────────────────────────────────────
const CARD_FRET_SIZES = [
  { key: "S",  frets: 5,  width: 140, label: "S" },
  { key: "M",  frets: 9,  width: 220, label: "M" },
  { key: "L",  frets: 15, width: 340, label: "L" },
];

const seqState = {
  sequence: createSequence({ name: "My practice sequence" }),
  playback: { isPlaying: false, currentStepIndex: -1, tempo: 80, loop: false },
  editingStepIndex: -1,
  leadLineLabelMode: "degree",  // "degree" | "note"
  cardSize: "M",                // "S" | "M" | "L"
};

// ── Persistence ────────────────────────────────────────────────────
function saveSequence() {
  try {
    localStorage.setItem(SEQ_STORAGE_KEY, sequenceToJSON(seqState.sequence));
  } catch (_) { /* quota exceeded */ }
}

function loadSequence() {
  try {
    const raw = localStorage.getItem(SEQ_STORAGE_KEY);
    if (raw) {
      const restored = sequenceFromJSON(raw);
      if (validateSequence(restored).length === 0) {
        seqState.sequence = restored;
        seqState.playback.tempo = restored.tempo;
      }
    }
  } catch (_) { /* corrupted */ }
}

// ── Chord voicing helper ───────────────────────────────────────────
function voicingForChordStep(step) {
  const quality = step.quality;
  const is7th = (CHORD_INTERVALS[quality] || []).length === 4;
  const inst = getInstrument();
  const groups = is7th ? inst.seventhGroups : inst.triadGroups;
  const tryOrder = [];
  if (step.voicing && step.voicing.stringGroup) {
    const match = groups.find(g => g.label === step.voicing.stringGroup);
    if (match) tryOrder.push(match);
  }
  for (const g of groups) {
    if (!tryOrder.includes(g)) tryOrder.push(g);
  }
  for (const g of tryOrder) {
    const v = findVoicingOnStrings(step.root, quality, 0, g.idx);
    if (v) return { positions: v, stringGroup: g.label };
  }
  return { positions: [], stringGroup: null };
}

// ── Bracket chord helpers ──────────────────────────────────────────
// Find the nearest chord step before/after a given index.
function findBracketChords(steps, idx) {
  let prev = null, next = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (steps[i].kind === "chord") { prev = steps[i]; break; }
  }
  for (let i = idx + 1; i < steps.length; i++) {
    if (steps[i].kind === "chord") { next = steps[i]; break; }
  }
  return { prev, next };
}

// ── Lead Line fretboard renderer ───────────────────────────────────
// Renders scale notes only, with ghost overlays of bracket chords and
// landing zones (chord tones within the scale).
function renderLeadLineFretboard(step, index, labelMode) {
  const inst = getInstrument();
  const numStrings = inst.tuning.length;
  const steps = seqState.sequence.steps;
  const { prev, next } = findBracketChords(steps, index);

  // Resolve scale
  let scaleKey, scaleRootPc;
  if (step.scale) {
    scaleKey = step.scale.type;
    scaleRootPc = noteIndex(step.scale.root);
  } else {
    // Use first suggestion
    const suggestions = suggestScalesForBracket(
      prev ? { root: prev.root, quality: prev.quality } : null,
      next ? { root: next.root, quality: next.quality } : null
    );
    if (suggestions.length > 0) {
      scaleKey = suggestions[0].scaleKey;
      scaleRootPc = suggestions[0].rootPc;
    } else {
      scaleKey = "ionian";
      scaleRootPc = 0;
    }
  }

  const scaleDef = SCALES[scaleKey];
  if (!scaleDef) return `<div class="seq-step-empty">Unknown scale</div>`;

  const scalePcs = scaleDef.steps.map(s => (scaleRootPc + s) % 12);
  const scaleSet = new Set(scalePcs);
  const noteNameMap = spellScale(noteName(scaleRootPc), scaleDef.steps);

  // Chord tones from bracket chords (for landing zones)
  const prevChordPcs = prev ? new Set(chordPcs(prev.root, prev.quality)) : new Set();
  const nextChordPcs = next ? new Set(chordPcs(next.root, next.quality)) : new Set();

  // Ghost positions from bracket chords
  const prevGhost = (prev && step.bracketPrevious !== false) ? (prev.voicing && prev.voicing.positions || []) : [];
  const nextGhost = (next && step.bracketNext !== false) ? (next.voicing && next.voicing.positions || []) : [];

  // Fret range: full neck or step's fretRange
  const maxFret = inst.numFrets;
  const fretRange = step.fretRange ? [step.fretRange[0] - 1, step.fretRange[1]] : [0, maxFret];

  const [startFret, endFret] = fretRange;
  const numFrets = endFret - startFret;
  const ss = 22;   // string spacing
  const fs = 38;   // fret spacing
  const tp = 24;   // top padding
  const lp = 14;
  const w = lp + numFrets * fs + 20;
  const h = tp + (numStrings - 1) * ss + 20;
  const r = 10;
  const fretDots = [3, 5, 7, 9, 12, 15];
  const midString = (numStrings - 1) / 2;

  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

  // Fret position dots
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

  // Fret lines
  for (let i = 0; i <= numFrets; i++) {
    const x = lp + i * fs;
    const fretNum = startFret + i;
    const isNut = fretNum === 0;
    svg += `<line x1="${x}" y1="${tp}" x2="${x}" y2="${tp + (numStrings - 1) * ss}" stroke="var(--fret-color)" stroke-width="${isNut ? 3 : 1}" opacity="${isNut ? 0.8 : 0.3}"/>`;
  }

  // Strings
  for (let i = 0; i < numStrings; i++) {
    const y = tp + i * ss;
    const minFret = inst.stringMinFret && inst.stringMinFret[i] != null ? inst.stringMinFret[i] : 0;
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
    svg += `<text x="${lp + i * fs + fs / 2}" y="${h - 2}" text-anchor="middle" font-size="9" fill="var(--text-muted)" font-family="monospace">${fretNum}</text>`;
  }

  // Ghost overlays: previous chord voicing (subtle blue)
  for (const gp of prevGhost) {
    if (gp.fret < startFret + 1 || gp.fret > endFret) continue;
    const fi = gp.fret - startFret - 1;
    const cx = lp + fi * fs + fs / 2;
    const cy = tp + gp.string * ss;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--triad-fill)" stroke="var(--triad-stroke)" stroke-width="1.5" opacity="0.18"/>`;
    svg += `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="9" fill="var(--triad-text)" font-weight="700" font-family="monospace" opacity="0.25">${gp.degree || ""}</text>`;
  }

  // Ghost overlays: next chord voicing (subtle orange/amber)
  for (const gp of nextGhost) {
    if (gp.fret < startFret + 1 || gp.fret > endFret) continue;
    const fi = gp.fret - startFret - 1;
    const cx = lp + fi * fs + fs / 2;
    const cy = tp + gp.string * ss;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--pattern-note)" stroke="var(--pattern-note)" stroke-width="1.5" opacity="0.18"/>`;
    svg += `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="9" fill="var(--pattern-text)" font-weight="700" font-family="monospace" opacity="0.25">${gp.degree || ""}</text>`;
  }

  // Scale notes (only notes in the scale are shown)
  const stepList = scaleDef.steps;
  const degreeList = scaleDef.degrees;

  for (let si = 0; si < numStrings; si++) {
    for (let fi = 0; fi < numFrets; fi++) {
      const fret = startFret + fi + 1;
      if (fret < 0 || fret > maxFret) continue;
      if (!fretPositionPlayable(si, fret)) continue;
      const pc = (inst.tuning[si] + fret) % 12;
      if (!scaleSet.has(pc)) continue;

      const cx = lp + fi * fs + fs / 2;
      const cy = tp + si * ss;
      const isRoot = pc === scaleRootPc;
      const idx = stepList.indexOf((pc - scaleRootPc + 12) % 12);
      const label = labelMode === "note" ? spellNote(pc, noteNameMap) : (degreeList[idx] || "");

      // Landing zone: chord tone of a bracket chord that's also in the scale
      const isLandingPrev = prevChordPcs.has(pc);
      const isLandingNext = nextChordPcs.has(pc);
      const isLanding = isLandingPrev || isLandingNext;

      if (isRoot) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--triad-fill)" stroke="var(--triad-stroke)" stroke-width="2.5"/>`;
        svg += `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" fill="var(--triad-text)" font-weight="700" font-family="monospace">${label}</text>`;
      } else if (isLanding) {
        // Landing zones: distinct colors — green for prev chord tones, orange-red for next
        const landingColor = isLandingPrev ? "var(--landing-prev)" : "var(--landing-next)";
        const landingStroke = isLandingPrev ? "var(--landing-prev-stroke)" : "var(--landing-next-stroke)";
        // Diamond shape to stand out from regular scale notes
        svg += `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="3" fill="${landingColor}" stroke="${landingStroke}" stroke-width="2" transform="rotate(45 ${cx} ${cy})"/>`;
        svg += `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700" font-family="monospace">${label}</text>`;
      } else {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="var(--pattern-note)" opacity="0.5"/>`;
        svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="9" fill="var(--pattern-text)" font-family="monospace" font-weight="600">${label}</text>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

// ── Pattern fretboard renderer (clickable for note entry) ──────────
function renderPatternFretboard(step) {
  const inst = getInstrument();
  const numStrings = inst.tuning.length;
  const maxFret = inst.numFrets;
  const startFret = 0;
  const endFret = maxFret;
  const numFrets = endFret - startFret;
  const ss = 22, fs = 38, tp = 24, lp = 14;
  const w = lp + numFrets * fs + 20;
  const h = tp + (numStrings - 1) * ss + 20;
  const r = 10;
  const fretDots = [3, 5, 7, 9, 12, 15];
  const midString = (numStrings - 1) / 2;

  // Scale context for degree labels
  const scaleKey = step.scale ? step.scale.type : "ionian";
  const scaleRootPc = step.scale ? noteIndex(step.scale.root) : 0;
  const scaleDef = SCALES[scaleKey] || SCALES.ionian;
  const scalePcs = scaleDef.steps.map(s => (scaleRootPc + s) % 12);
  const scaleSet = new Set(scalePcs);
  const noteNameMap = spellScale(noteName(scaleRootPc), scaleDef.steps);

  // Build set of already-entered notes for highlighting
  const enteredSet = new Set((step.notes || []).map(n => `${n.string}-${n.fret}`));

  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" id="seq-pat-svg">`;

  // Fret dots
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

  // Fret lines
  for (let i = 0; i <= numFrets; i++) {
    const x = lp + i * fs;
    const fretNum = startFret + i;
    const isNut = fretNum === 0;
    svg += `<line x1="${x}" y1="${tp}" x2="${x}" y2="${tp + (numStrings - 1) * ss}" stroke="var(--fret-color)" stroke-width="${isNut ? 3 : 1}" opacity="${isNut ? 0.8 : 0.3}"/>`;
  }

  // Strings
  for (let i = 0; i < numStrings; i++) {
    const y = tp + i * ss;
    const minFret = inst.stringMinFret && inst.stringMinFret[i] != null ? inst.stringMinFret[i] : 0;
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
    svg += `<text x="${lp + i * fs + fs / 2}" y="${h - 2}" text-anchor="middle" font-size="9" fill="var(--text-muted)" font-family="monospace">${fretNum}</text>`;
  }

  // Scale notes (dimmed background context) + clickable hit areas
  for (let si = 0; si < numStrings; si++) {
    for (let fi = 0; fi < numFrets; fi++) {
      const fret = startFret + fi + 1;
      if (fret < 0 || fret > maxFret) continue;
      if (!fretPositionPlayable(si, fret)) continue;
      const pc = (inst.tuning[si] + fret) % 12;
      if (!scaleSet.has(pc)) continue;

      const cx = lp + fi * fs + fs / 2;
      const cy = tp + si * ss;
      const key = `${si}-${fret}`;
      const isEntered = enteredSet.has(key);
      const isRoot = pc === scaleRootPc;
      const idx = scaleDef.steps.indexOf((pc - scaleRootPc + 12) % 12);
      const degree = scaleDef.degrees[idx] || "";

      if (isEntered) {
        // Entered note: bright
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--accent)" stroke="var(--triad-stroke)" stroke-width="2"/>`;
        svg += `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700" font-family="monospace">${degree}</text>`;
      } else {
        // Available note: dim
        svg += `<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="${isRoot ? "var(--triad-fill)" : "var(--pattern-note)"}" opacity="0.25"/>`;
        svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="8" fill="var(--text-dim)" font-family="monospace">${degree}</text>`;
      }
      // Invisible click target
      svg += `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="transparent" class="seq-pat-click" data-pat-string="${si}" data-pat-fret="${fret}" data-pat-degree="${degree}" style="cursor:pointer"/>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

// ── Render ─────────────────────────────────────────────────────────
function renderSequencerPage() {
  const seq = seqState.sequence;
  const steps = seq.steps;

  // Controls
  let controls = `
    <div class="control-group">
      <span class="control-label">Sequence</span>
      <div class="control-options">
        <input type="text" id="seq-name" class="seq-name-input" value="${escAttr(seq.name)}" />
      </div>
    </div>
    <div class="control-group">
      <span class="control-label">Tempo</span>
      <div class="control-options">
        <input type="number" id="seq-tempo" class="seq-tempo-input" value="${seq.tempo}" min="40" max="300" step="1" />
        <span class="control-label" style="margin-left:4px">BPM</span>
      </div>
    </div>
    <div class="control-group">
      <span class="control-label">Card size</span>
      <div class="control-options">
        ${CARD_FRET_SIZES.map(s => `<button class="control-btn ${seqState.cardSize === s.key ? "active" : ""}" data-seq-card-size="${s.key}">${s.label}</button>`).join("")}
      </div>
    </div>
    <div class="control-group" style="justify-content:flex-end">
      <button class="print-btn" id="seq-clear-btn">Clear all</button>
    </div>
  `;
  document.getElementById("seq-controls").innerHTML = controls;

  // Playback controls
  const isPlaying = playbackIsPlaying();
  document.getElementById("seq-playback").innerHTML = `<div class="seq-playback">
    <button class="seq-play-btn ${isPlaying ? "seq-playing" : ""}" id="seq-play-btn">${isPlaying ? "&#9646;&#9646; Pause" : "&#9654; Play"}</button>
    <button class="seq-play-btn" id="seq-stop-btn">&#9632; Stop</button>
    <input type="range" class="seq-tempo-slider" id="seq-tempo-slider" min="40" max="200" value="${seq.tempo}" />
    <span class="seq-tempo-display" id="seq-tempo-display">${seq.tempo} BPM</span>
    <button class="seq-loop-btn ${seqState.playback.loop ? "active" : ""}" id="seq-loop-btn">Loop</button>
  </div>`;

  // Timeline
  let timeline = "";
  steps.forEach((step, i) => {
    const isEditing = seqState.editingStepIndex === i;
    timeline += renderStepCard(step, i, isEditing);
  });

  timeline += `<div class="seq-add-card" id="seq-add-btn" title="Add a step">
    <div class="seq-add-icon">+</div>
    <div class="seq-add-label">Add step</div>
  </div>`;

  const timelineEl = document.getElementById("seq-timeline");
  timelineEl.innerHTML = timeline;
  timelineEl.style.setProperty("--seq-card-width", getCardSize().width + "px");

  // Editor
  const editorEl = document.getElementById("seq-editor");
  if (seqState.editingStepIndex >= 0 && seqState.editingStepIndex < steps.length) {
    editorEl.innerHTML = renderStepEditor(steps[seqState.editingStepIndex], seqState.editingStepIndex);
    editorEl.hidden = false;
  } else {
    editorEl.innerHTML = "";
    editorEl.hidden = true;
  }

  attachSequencerEvents();
}

function escAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ── Compact fretboard for step cards ───────────────────────────────
// Renders a small fretboard suitable for a timeline card. Supports:
//   - scale mode: shows all scale-degree notes in a fret window
//   - note mode: shows specific entered notes
// opts: { scalePcs, scaleRootPc, scaleDef, notes (array of {string,fret}),
//          fretRange, ghostPrev, ghostNext }
function renderCardFretboard(opts) {
  const inst = getInstrument();
  const numStrings = inst.tuning.length;
  const [startFret, endFret] = opts.fretRange;
  const numFrets = endFret - startFret;
  if (numFrets <= 0) return "";

  const ss = 16, fs = 22, tp = 14, lp = 8;
  const w = lp + numFrets * fs + 12;
  const h = tp + (numStrings - 1) * ss + 14;
  const r = 7;
  const midString = (numStrings - 1) / 2;
  const fretDots = [3, 5, 7, 9, 12, 15];

  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

  // Fret dots
  for (const d of fretDots) {
    if (d < startFret + 1 || d > endFret) continue;
    const x = lp + (d - startFret - 1) * fs + fs / 2;
    if (d === 12) {
      svg += `<circle cx="${x}" cy="${tp + (midString - 1) * ss}" r="2" fill="var(--dot-muted)" opacity="0.35"/>`;
      svg += `<circle cx="${x}" cy="${tp + (midString + 1) * ss}" r="2" fill="var(--dot-muted)" opacity="0.35"/>`;
    } else {
      svg += `<circle cx="${x}" cy="${tp + midString * ss}" r="2" fill="var(--dot-muted)" opacity="0.25"/>`;
    }
  }

  // Fret lines
  for (let i = 0; i <= numFrets; i++) {
    const x = lp + i * fs;
    const fretNum = startFret + i;
    svg += `<line x1="${x}" y1="${tp}" x2="${x}" y2="${tp + (numStrings - 1) * ss}" stroke="var(--fret-color)" stroke-width="${fretNum === 0 ? 2.5 : 0.8}" opacity="${fretNum === 0 ? 0.7 : 0.25}"/>`;
  }

  // Strings
  for (let i = 0; i < numStrings; i++) {
    const y = tp + i * ss;
    svg += `<line x1="${lp}" y1="${y}" x2="${lp + numFrets * fs}" y2="${y}" stroke="var(--string-color)" stroke-width="${(0.8 + i * 0.2).toFixed(1)}" opacity="0.4"/>`;
  }

  // Fret numbers (sparse — only first and last visible)
  const firstFret = startFret + 1;
  const lastFret = endFret;
  if (firstFret > 0) svg += `<text x="${lp + fs / 2}" y="${h - 1}" text-anchor="middle" font-size="7" fill="var(--text-muted)" font-family="monospace">${firstFret}</text>`;
  if (lastFret > firstFret) svg += `<text x="${lp + (numFrets - 1) * fs + fs / 2}" y="${h - 1}" text-anchor="middle" font-size="7" fill="var(--text-muted)" font-family="monospace">${lastFret}</text>`;

  // Ghost overlays (bracket chord voicings)
  if (opts.ghostPrev) {
    for (const gp of opts.ghostPrev) {
      if (gp.fret < startFret + 1 || gp.fret > endFret) continue;
      const cx = lp + (gp.fret - startFret - 1) * fs + fs / 2;
      const cy = tp + gp.string * ss;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--triad-fill)" opacity="0.15"/>`;
    }
  }
  if (opts.ghostNext) {
    for (const gp of opts.ghostNext) {
      if (gp.fret < startFret + 1 || gp.fret > endFret) continue;
      const cx = lp + (gp.fret - startFret - 1) * fs + fs / 2;
      const cy = tp + gp.string * ss;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--pattern-note)" opacity="0.15"/>`;
    }
  }

  // Scale-mode notes (lead line)
  if (opts.scalePcs && opts.scaleDef) {
    const scaleSet = new Set(opts.scalePcs);
    const prevChordPcs = opts.landingPrev || new Set();
    const nextChordPcs = opts.landingNext || new Set();
    const noteNameMap = opts.scaleRootPc != null ? spellScale(noteName(opts.scaleRootPc), opts.scaleDef.steps) : null;
    const labelMode = opts.labelMode || "degree";
    for (let si = 0; si < numStrings; si++) {
      for (let fi = 0; fi < numFrets; fi++) {
        const fret = startFret + fi + 1;
        if (fret < 0 || fret > inst.numFrets) continue;
        if (!fretPositionPlayable(si, fret)) continue;
        const pc = (inst.tuning[si] + fret) % 12;
        if (!scaleSet.has(pc)) continue;
        const cx = lp + fi * fs + fs / 2;
        const cy = tp + si * ss;
        const isRoot = pc === opts.scaleRootPc;
        // Landing = this pc is one of the bracket chord's tones (3-4 notes), not the whole scale
        const isLandingPrev = prevChordPcs.has(pc);
        const isLandingNext = nextChordPcs.has(pc);
        const isLanding = isLandingPrev || isLandingNext;
        const degIdx = opts.scaleDef.steps.indexOf((pc - opts.scaleRootPc + 12) % 12);
        const label = labelMode === "note" ? spellNote(pc, noteNameMap) : (opts.scaleDef.degrees[degIdx] || "");
        if (isRoot) {
          svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--triad-fill)" stroke="var(--triad-stroke)" stroke-width="1.5"/>`;
          svg += `<text x="${cx}" y="${cy + 2.5}" text-anchor="middle" font-size="6" fill="var(--triad-text)" font-weight="700" font-family="monospace">${label}</text>`;
        } else if (isLanding) {
          const lc = isLandingPrev ? "var(--landing-prev)" : "var(--landing-next)";
          const ls = isLandingPrev ? "var(--landing-prev-stroke)" : "var(--landing-next-stroke)";
          svg += `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="2" fill="${lc}" stroke="${ls}" stroke-width="1" transform="rotate(45 ${cx} ${cy})"/>`;
          svg += `<text x="${cx}" y="${cy + 2.5}" text-anchor="middle" font-size="6" fill="#fff" font-weight="600" font-family="monospace">${label}</text>`;
        } else {
          svg += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="var(--pattern-note)" opacity="0.45"/>`;
          svg += `<text x="${cx}" y="${cy + 2.5}" text-anchor="middle" font-size="6" fill="var(--pattern-text)" font-family="monospace" opacity="0.8">${label}</text>`;
        }
      }
    }
  }

  // Specific-note mode (pattern)
  if (opts.notes && opts.notes.length) {
    const patScaleDef = opts.scaleDef || (opts.patScale ? SCALES[opts.patScale.type] : null);
    const patRootPc = opts.patScale ? noteIndex(opts.patScale.root) : null;
    const patNoteMap = (patRootPc != null && patScaleDef) ? spellScale(noteName(patRootPc), patScaleDef.steps) : null;
    opts.notes.forEach((n, ni) => {
      if (n.fret < startFret + 1 || n.fret > endFret) return;
      const cx = lp + (n.fret - startFret - 1) * fs + fs / 2;
      const cy = tp + n.string * ss;
      const pc = (inst.tuning[n.string] + n.fret) % 12;
      let label = "" + (ni + 1);
      if (patScaleDef && patRootPc != null) {
        const degIdx = patScaleDef.steps.indexOf((pc - patRootPc + 12) % 12);
        if (degIdx >= 0) label = patScaleDef.degrees[degIdx];
      }
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--accent)" stroke="var(--triad-stroke)" stroke-width="1"/>`;
      svg += `<text x="${cx}" y="${cy + 2.5}" text-anchor="middle" font-size="6" fill="#fff" font-weight="700" font-family="monospace">${label}</text>`;
    });
  }

  svg += `</svg>`;
  return svg;
}

// Compute a fret range that fits the given positions, centered, with totalFrets width.
function cardFretRange(positions, totalFrets) {
  if (!positions || !positions.length) return [0, totalFrets];
  const frets = positions.map(p => p.fret);
  const center = (Math.min(...frets) + Math.max(...frets)) / 2;
  const half = totalFrets / 2;
  let start = Math.round(center - half);
  let end = start + totalFrets;
  if (start < -1) { start = -1; end = start + totalFrets; }
  const maxFret = getInstrument().numFrets;
  if (end > maxFret) { end = maxFret; start = Math.max(-1, end - totalFrets); }
  return [start, end];
}

function getCardSize() {
  return CARD_FRET_SIZES.find(s => s.key === seqState.cardSize) || CARD_FRET_SIZES[1];
}

function renderStepCard(step, index, isEditing) {
  let inner = "";
  let kindLabel;
  const kindClass = `seq-step-${step.kind}`;

  if (step.kind === "chord") {
    kindLabel = `${step.root} ${step.quality}`;
    const positions = step.voicing && step.voicing.positions && step.voicing.positions.length ? step.voicing.positions : null;
    if (positions) {
      const range = computeFretRange(positions, 7);
      inner = renderFretboardSVG(positions, null, range, true, null, null);
    } else {
      inner = `<div class="seq-step-empty">No voicing</div>`;
    }
  } else if (step.kind === "lead_line") {
    kindLabel = `Lead Line`;
    // Resolve scale
    const steps = seqState.sequence.steps;
    const { prev, next } = findBracketChords(steps, index);
    let scaleKey, scaleRootPc;
    if (step.scale) {
      scaleKey = step.scale.type;
      scaleRootPc = noteIndex(step.scale.root);
    } else {
      const sug = suggestScalesForBracket(
        prev ? { root: prev.root, quality: prev.quality } : null,
        next ? { root: next.root, quality: next.quality } : null
      );
      if (sug.length) { scaleKey = sug[0].scaleKey; scaleRootPc = sug[0].rootPc; }
      else { scaleKey = "ionian"; scaleRootPc = 0; }
    }
    const scaleDef = SCALES[scaleKey] || SCALES.ionian;
    const scalePcs = scaleDef.steps.map(s => (scaleRootPc + s) % 12);
    // Fret range: center on bracket chord positions if available, else mid-neck
    const bracketPositions = [
      ...((prev && prev.voicing && prev.voicing.positions) || []),
      ...((next && next.voicing && next.voicing.positions) || []),
    ];
    const sz = getCardSize();
    const range = bracketPositions.length ? cardFretRange(bracketPositions, sz.frets) : [0, sz.frets];
    const prevPcs = prev ? new Set(chordPcs(prev.root, prev.quality)) : new Set();
    const nextPcs = next ? new Set(chordPcs(next.root, next.quality)) : new Set();
    inner = renderCardFretboard({
      scalePcs, scaleRootPc, scaleDef,
      labelMode: seqState.leadLineLabelMode,
      fretRange: range,
      ghostPrev: (prev && prev.voicing) ? prev.voicing.positions : null,
      ghostNext: (next && next.voicing) ? next.voicing.positions : null,
      landingPrev: prevPcs, landingNext: nextPcs,
    });
  } else if (step.kind === "pattern") {
    kindLabel = `Pattern`;
    const notes = step.notes || [];
    if (notes.length) {
      const sz = getCardSize();
      const range = cardFretRange(notes, sz.frets);
      const patScale = step.scale || null;
      const patScaleDef = patScale ? (SCALES[patScale.type] || null) : null;
      inner = renderCardFretboard({ notes, fretRange: range, patScale, scaleDef: patScaleDef });
    } else {
      inner = `<div class="seq-step-empty">No notes</div>`;
    }
  } else if (step.kind === "rest") {
    kindLabel = "Rest";
    inner = `<div class="seq-step-rest-icon">&#119102;</div>`;
  } else {
    kindLabel = step.kind;
  }

  const isPlayingStep = seqState.playback.currentStepIndex === index;
  return `<div class="seq-step-card ${kindClass} ${isEditing ? "seq-step-editing" : ""} ${isPlayingStep ? "seq-step-playing" : ""}"
               data-seq-idx="${index}" draggable="true">
    <div class="seq-step-head">
      <span class="seq-step-kind">${kindLabel}</span>
      <span class="seq-step-beats">${step.durationBeats}b</span>
      <button class="seq-step-delete" data-seq-del="${index}" title="Remove step">&#215;</button>
    </div>
    <div class="seq-step-body">${inner}</div>
  </div>`;
}

function renderStepEditor(step, index) {
  if (step.kind === "chord") return renderChordEditor(step, index);
  if (step.kind === "lead_line") return renderLeadLineEditor(step, index);
  if (step.kind === "pattern") return renderPatternEditor(step, index);
  if (step.kind === "rest") return renderRestEditor(step, index);
  return "";
}

// ── Chord editor ───────────────────────────────────────────────────
function renderChordEditor(step, index) {
  const allQualities = ["major", "minor", "dim", "aug", "sus2", "sus4", "maj7", "dom7", "min7", "mM7", "dim7", "m7b5"];
  const articulations = [
    { key: "strum_down", label: "Strum &#8595;" },
    { key: "strum_up", label: "Strum &#8593;" },
    { key: "block", label: "Block" },
    { key: "arpeggiate_up", label: "Arp &#8593;" },
    { key: "arpeggiate_down", label: "Arp &#8595;" },
  ];

  return `<div class="seq-editor-panel">
    <div class="seq-editor-title">Edit chord step</div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Root</span>
        <div class="control-options">
          ${NOTES.map(n => `<button class="control-btn ${step.root === n ? "active" : ""}" data-seq-edit="root" data-val="${n}">${n}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Quality</span>
        <div class="control-options">
          ${allQualities.map(q => `<button class="control-btn ${step.quality === q ? "active" : ""}" data-seq-edit="quality" data-val="${q}">${q}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Articulation</span>
        <div class="control-options">
          ${articulations.map(a => `<button class="control-btn ${step.articulation === a.key ? "active" : ""}" data-seq-edit="articulation" data-val="${a.key}">${a.label}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Duration (beats)</span>
        <div class="control-options">
          ${[1,2,3,4,6,8].map(d => `<button class="control-btn ${step.durationBeats === d ? "active" : ""}" data-seq-edit="durationBeats" data-val="${d}">${d}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row" style="justify-content:flex-end">
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

// ── Pattern editor ─────────────────────────────────────────────────
function renderPatternEditor(step, index) {
  const inst = getInstrument();
  const heptatonic = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];
  const pentatonic = ["majorPent", "minorPent", "blues"];
  const allScaleKeys = [...heptatonic, ...pentatonic];

  const scaleKey = step.scale ? step.scale.type : "ionian";
  const scaleRootPc = step.scale ? noteIndex(step.scale.root) : 0;
  const scaleDef = SCALES[scaleKey] || SCALES.ionian;

  const articulations = [
    { key: "", label: "Normal" },
    { key: "bend", label: "Bend" },
    { key: "slide", label: "Slide" },
    { key: "hammer", label: "Hammer" },
    { key: "pull", label: "Pull" },
  ];

  // Note list
  let noteListHtml = "";
  if (step.notes && step.notes.length > 0) {
    noteListHtml = `<div class="seq-pat-note-list">`;
    step.notes.forEach((n, ni) => {
      const pc = (inst.tuning[n.string] + n.fret) % 12;
      const name = noteName(pc);
      const degreeIdx = scaleDef.steps.indexOf((pc - scaleRootPc + 12) % 12);
      const degree = scaleDef.degrees[degreeIdx] || "";
      const artSymbol = n.articulation ? ` (${n.articulation})` : "";

      noteListHtml += `<div class="seq-pat-note">
        <span class="seq-pat-note-num">${ni + 1}</span>
        <span class="seq-pat-note-info">S${n.string + 1} F${n.fret} — ${name}<span class="seq-pat-note-degree">${degree}</span>${artSymbol}</span>
        <select data-pat-note-dur="${ni}">
          ${[0.25, 0.5, 1, 2, 4].map(d => `<option value="${d}" ${n.durationBeats === d ? "selected" : ""}>${d}b</option>`).join("")}
        </select>
        <select data-pat-note-art="${ni}">
          ${articulations.map(a => `<option value="${a.key}" ${(n.articulation || "") === a.key ? "selected" : ""}>${a.label}</option>`).join("")}
        </select>
        <button class="seq-pat-note-move" data-pat-note-up="${ni}" title="Move up" ${ni === 0 ? "disabled" : ""}>&#9650;</button>
        <button class="seq-pat-note-move" data-pat-note-down="${ni}" title="Move down" ${ni === step.notes.length - 1 ? "disabled" : ""}>&#9660;</button>
        <button class="seq-pat-note-del" data-pat-note-del="${ni}" title="Remove">&#215;</button>
      </div>`;
    });
    noteListHtml += `</div>`;
  } else {
    noteListHtml = `<div class="seq-step-empty">Click scale notes on the fretboard to add them</div>`;
  }

  const fretboard = renderPatternFretboard(step);

  return `<div class="seq-editor-panel seq-pat-editor">
    <div class="seq-editor-title">Edit pattern step</div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Scale context (for degree labels)</span>
        <div class="control-options">
          ${NOTES.map(n => `<button class="control-btn ${step.scale && step.scale.root === n ? "active" : ""}" data-seq-pat-root="${n}">${n}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Scale type</span>
        <div class="control-options">
          ${allScaleKeys.map(k => `<button class="control-btn ${scaleKey === k ? "active" : ""}" data-seq-pat-type="${k}">${SCALES[k].name}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Duration (beats)</span>
        <div class="control-options">
          ${[1,2,4,6,8,12].map(d => `<button class="control-btn ${step.durationBeats === d ? "active" : ""}" data-seq-edit="durationBeats" data-val="${d}">${d}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-pat-fretboard">${fretboard}</div>
    <span class="control-label">Notes (${(step.notes || []).length}) — click fretboard to add</span>
    ${noteListHtml}
    <div class="seq-editor-row" style="justify-content:flex-end;margin-top:8px">
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

// ── Rest editor ────────────────────────────────────────────────────
function renderRestEditor(step, index) {
  return `<div class="seq-editor-panel">
    <div class="seq-editor-title">Edit rest step</div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Duration (beats)</span>
        <div class="control-options">
          ${[1,2,3,4,6,8].map(d => `<button class="control-btn ${step.durationBeats === d ? "active" : ""}" data-seq-edit="durationBeats" data-val="${d}">${d}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row" style="justify-content:flex-end">
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

// ── Lead Line editor ───────────────────────────────────────────────
function renderLeadLineEditor(step, index) {
  const steps = seqState.sequence.steps;
  const { prev, next } = findBracketChords(steps, index);

  // Scale suggestions
  const suggestions = suggestScalesForBracket(
    prev ? { root: prev.root, quality: prev.quality } : null,
    next ? { root: next.root, quality: next.quality } : null
  );

  // Current scale
  const currentScale = step.scale;
  const isAuto = !currentScale;

  // Build suggestion buttons
  let suggestionsHtml = "";
  if (suggestions.length > 0) {
    suggestionsHtml = `<div class="seq-ll-suggestions">
      <span class="control-label">Suggested scales</span>
      <div class="seq-ll-suggest-list">
        ${suggestions.map((s, si) => {
          const isActive = currentScale && currentScale.root === s.root && currentScale.type === s.scaleKey;
          return `<button class="seq-ll-suggest-btn ${isActive ? "active" : ""}" data-seq-ll-scale-root="${s.root}" data-seq-ll-scale-type="${s.scaleKey}" title="${escAttr(s.reasoning)}">
            <span class="seq-ll-suggest-name">${s.name}</span>
            <span class="seq-ll-suggest-reason">${s.reasoning}</span>
            ${s.fitsBoth ? '<span class="seq-ll-suggest-badge">fits both</span>' : ''}
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }

  // Manual override: root + scale type
  const heptatonic = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];

  // Bracket info
  const prevLabel = prev ? `${prev.root} ${prev.quality}` : "none";
  const nextLabel = next ? `${next.root} ${next.quality}` : "none";

  // Lead line fretboard
  const fretboard = renderLeadLineFretboard(step, index, seqState.leadLineLabelMode);

  // Legend
  const legend = `<div class="seq-ll-legend">
    <span class="seq-ll-legend-item"><span class="seq-ll-dot" style="background:var(--landing-prev);transform:rotate(45deg);border-radius:2px"></span> Prev landing</span>
    <span class="seq-ll-legend-item"><span class="seq-ll-dot" style="background:var(--landing-next);transform:rotate(45deg);border-radius:2px"></span> Next landing</span>
    <span class="seq-ll-legend-item"><span class="seq-ll-dot" style="background:var(--triad-fill);opacity:0.18;border:1.5px solid var(--triad-stroke)"></span> Prev ghost</span>
    <span class="seq-ll-legend-item"><span class="seq-ll-dot" style="background:var(--pattern-note);opacity:0.18;border:1.5px solid var(--pattern-note)"></span> Next ghost</span>
  </div>`;

  return `<div class="seq-editor-panel seq-ll-editor">
    <div class="seq-editor-title">Lead Line — improvise between chords</div>
    <div class="seq-ll-bracket-info">
      <span class="inv-tag">&#8592; ${prevLabel}</span>
      <span class="inv-tag" style="color:var(--accent)">Lead Line</span>
      <span class="inv-tag">${nextLabel} &#8594;</span>
    </div>
    ${suggestionsHtml}
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Manual scale override</span>
        <div class="control-options">
          <button class="control-btn ${isAuto ? "active" : ""}" data-seq-ll-auto>Auto</button>
          ${NOTES.map(n => `<button class="control-btn ${currentScale && currentScale.root === n ? "active" : ""}" data-seq-ll-root="${n}">${n}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Scale type</span>
        <div class="control-options">
          ${heptatonic.map(k => `<button class="control-btn ${currentScale && currentScale.type === k ? "active" : ""}" data-seq-ll-type="${k}">${SCALES[k].name}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Labels</span>
        <div class="control-options">
          <button class="control-btn ${seqState.leadLineLabelMode === "degree" ? "active" : ""}" data-seq-ll-label="degree">Degrees</button>
          <button class="control-btn ${seqState.leadLineLabelMode === "note" ? "active" : ""}" data-seq-ll-label="note">Notes</button>
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Duration (beats)</span>
        <div class="control-options">
          ${[2,4,6,8,12,16].map(d => `<button class="control-btn ${step.durationBeats === d ? "active" : ""}" data-seq-edit="durationBeats" data-val="${d}">${d}</button>`).join("")}
        </div>
      </div>
    </div>
    ${legend}
    <div class="seq-ll-fretboard">${fretboard}</div>
    <div class="seq-editor-row" style="justify-content:flex-end">
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

// ── Step-kind picker ───────────────────────────────────────────────
function showStepPicker() {
  const modal = document.getElementById("seq-picker-modal");
  if (modal) modal.classList.add("open");
}
function hideStepPicker() {
  const modal = document.getElementById("seq-picker-modal");
  if (modal) modal.classList.remove("open");
}

// ── Events ─────────────────────────────────────────────────────────
function attachSequencerEvents() {
  // Sequence name
  const nameInput = document.getElementById("seq-name");
  if (nameInput) {
    nameInput.onchange = () => {
      seqState.sequence.name = nameInput.value || "Untitled";
      saveSequence();
    };
  }

  // Tempo
  const tempoInput = document.getElementById("seq-tempo");
  if (tempoInput) {
    tempoInput.onchange = () => {
      const val = parseInt(tempoInput.value);
      if (val > 0) {
        seqState.sequence.tempo = val;
        seqState.playback.tempo = val;
        saveSequence();
      }
    };
  }

  // Playback controls
  const playBtn = document.getElementById("seq-play-btn");
  if (playBtn) {
    playBtn.onclick = async () => {
      if (playbackIsPlaying()) {
        playbackPause();
        seqState.playback.isPlaying = false;
      } else {
        seqState.playback.isPlaying = true;
        loadSequence(seqState.sequence, (stepIdx) => {
          seqState.playback.currentStepIndex = stepIdx;
          // Update only the step highlighting without full re-render (avoids glitch)
          document.querySelectorAll(".seq-step-card").forEach(card => {
            const ci = parseInt(card.dataset.seqIdx);
            card.classList.toggle("seq-step-playing", ci === stepIdx);
          });
          if (stepIdx === -1) {
            seqState.playback.isPlaying = false;
            const btn = document.getElementById("seq-play-btn");
            if (btn) { btn.innerHTML = "&#9654; Play"; btn.classList.remove("seq-playing"); }
          }
        });
        playbackSetLoop(seqState.playback.loop);
        await playbackPlay();
      }
      renderSequencerPage();
    };
  }

  const stopBtn = document.getElementById("seq-stop-btn");
  if (stopBtn) {
    stopBtn.onclick = () => {
      playbackStop();
      seqState.playback.isPlaying = false;
      seqState.playback.currentStepIndex = -1;
      renderSequencerPage();
    };
  }

  const tempoSlider = document.getElementById("seq-tempo-slider");
  if (tempoSlider) {
    tempoSlider.oninput = () => {
      const val = parseInt(tempoSlider.value);
      seqState.sequence.tempo = val;
      seqState.playback.tempo = val;
      playbackSetTempo(val);
      const display = document.getElementById("seq-tempo-display");
      if (display) display.textContent = val + " BPM";
      // Update the tempo input too
      const ti = document.getElementById("seq-tempo");
      if (ti) ti.value = val;
    };
    tempoSlider.onchange = () => saveSequence();
  }

  const loopBtn = document.getElementById("seq-loop-btn");
  if (loopBtn) {
    loopBtn.onclick = () => {
      seqState.playback.loop = !seqState.playback.loop;
      playbackSetLoop(seqState.playback.loop);
      loopBtn.classList.toggle("active", seqState.playback.loop);
    };
  }

  // Card size
  document.querySelectorAll("[data-seq-card-size]").forEach(btn => {
    btn.onclick = () => {
      seqState.cardSize = btn.dataset.seqCardSize;
      renderSequencerPage();
    };
  });

  // Clear all
  const clearBtn = document.getElementById("seq-clear-btn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      seqState.sequence.steps = [];
      seqState.editingStepIndex = -1;
      saveSequence();
      renderSequencerPage();
    };
  }

  // Add step
  const addBtn = document.getElementById("seq-add-btn");
  if (addBtn) addBtn.onclick = () => showStepPicker();

  // Step-kind picker
  document.querySelectorAll("[data-seq-pick]").forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.seqPick;
      if (kind === "chord") {
        const step = chordStep({ root: "G", quality: "major" });
        step.voicing = voicingForChordStep(step);
        seqState.sequence.steps.push(step);
        seqState.editingStepIndex = seqState.sequence.steps.length - 1;
      } else if (kind === "lead_line") {
        seqState.sequence.steps.push(leadLineStep({ durationBeats: 8 }));
        seqState.editingStepIndex = seqState.sequence.steps.length - 1;
      } else if (kind === "pattern") {
        seqState.sequence.steps.push(patternStep({ scale: { root: "A", type: "minorPent" }, durationBeats: 4, notes: [] }));
        seqState.editingStepIndex = seqState.sequence.steps.length - 1;
      } else if (kind === "rest") {
        seqState.sequence.steps.push(restStep({ durationBeats: 2 }));
      }
      saveSequence();
      hideStepPicker();
      renderSequencerPage();
    };
  });

  // Picker close
  const pickerClose = document.getElementById("seq-picker-close");
  if (pickerClose) pickerClose.onclick = () => hideStepPicker();
  const pickerModal = document.getElementById("seq-picker-modal");
  if (pickerModal) {
    pickerModal.onclick = (ev) => { if (ev.target === pickerModal) hideStepPicker(); };
  }

  // Step card click → edit
  document.querySelectorAll(".seq-step-card").forEach(card => {
    card.onclick = (ev) => {
      if (ev.target.closest(".seq-step-delete")) return;
      const idx = parseInt(card.dataset.seqIdx);
      seqState.editingStepIndex = seqState.editingStepIndex === idx ? -1 : idx;
      renderSequencerPage();
    };
  });

  // Delete step
  document.querySelectorAll("[data-seq-del]").forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const idx = parseInt(btn.dataset.seqDel);
      seqState.sequence.steps.splice(idx, 1);
      if (seqState.editingStepIndex === idx) seqState.editingStepIndex = -1;
      else if (seqState.editingStepIndex > idx) seqState.editingStepIndex--;
      saveSequence();
      renderSequencerPage();
    };
  });

  // Editor: chord/rest property buttons
  document.querySelectorAll("[data-seq-edit]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const key = btn.dataset.seqEdit;
      const val = btn.dataset.val;
      if (key === "durationBeats") step.durationBeats = parseInt(val);
      else step[key] = val;
      if (key === "root" || key === "quality") step.voicing = voicingForChordStep(step);
      saveSequence();
      renderSequencerPage();
    };
  });

  // Editor close
  const editorClose = document.getElementById("seq-editor-close");
  if (editorClose) {
    editorClose.onclick = () => {
      seqState.editingStepIndex = -1;
      renderSequencerPage();
    };
  }

  // ── Lead Line editor events ──────────────────────────────────────
  // Scale suggestion buttons
  document.querySelectorAll("[data-seq-ll-scale-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      step.scale = { root: btn.dataset.seqLlScaleRoot, type: btn.dataset.seqLlScaleType };
      saveSequence();
      renderSequencerPage();
    };
  });

  // Auto button
  document.querySelectorAll("[data-seq-ll-auto]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      seqState.sequence.steps[idx].scale = null;
      saveSequence();
      renderSequencerPage();
    };
  });

  // Manual root override
  document.querySelectorAll("[data-seq-ll-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const root = btn.dataset.seqLlRoot;
      const type = (step.scale && step.scale.type) || "ionian";
      step.scale = { root, type };
      saveSequence();
      renderSequencerPage();
    };
  });

  // Manual scale type
  document.querySelectorAll("[data-seq-ll-type]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const root = (step.scale && step.scale.root) || "C";
      step.scale = { root, type: btn.dataset.seqLlType };
      saveSequence();
      renderSequencerPage();
    };
  });

  // Label mode toggle
  document.querySelectorAll("[data-seq-ll-label]").forEach(btn => {
    btn.onclick = () => {
      seqState.leadLineLabelMode = btn.dataset.seqLlLabel;
      renderSequencerPage();
    };
  });

  // ── Pattern editor events ─────────────────────────────────────────
  // Scale root for pattern
  document.querySelectorAll("[data-seq-pat-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const type = (step.scale && step.scale.type) || "ionian";
      step.scale = { root: btn.dataset.seqPatRoot, type };
      saveSequence();
      renderSequencerPage();
    };
  });

  // Scale type for pattern
  document.querySelectorAll("[data-seq-pat-type]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const root = (step.scale && step.scale.root) || "C";
      step.scale = { root, type: btn.dataset.seqPatType };
      saveSequence();
      renderSequencerPage();
    };
  });

  // Click on fretboard to add note
  document.querySelectorAll(".seq-pat-click").forEach(el => {
    el.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      if (step.kind !== "pattern") return;
      const string = parseInt(el.dataset.patString);
      const fret = parseInt(el.dataset.patFret);
      const degree = el.dataset.patDegree || "";
      step.notes.push({ string, fret, degree, durationBeats: 1, articulation: null });
      saveSequence();
      renderSequencerPage();
    };
  });

  // Note duration change
  document.querySelectorAll("[data-pat-note-dur]").forEach(sel => {
    sel.onchange = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const ni = parseInt(sel.dataset.patNoteDur);
      step.notes[ni].durationBeats = parseFloat(sel.value);
      saveSequence();
    };
  });

  // Note articulation change
  document.querySelectorAll("[data-pat-note-art]").forEach(sel => {
    sel.onchange = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const ni = parseInt(sel.dataset.patNoteArt);
      step.notes[ni].articulation = sel.value || null;
      saveSequence();
    };
  });

  // Note delete
  document.querySelectorAll("[data-pat-note-del]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const ni = parseInt(btn.dataset.patNoteDel);
      step.notes.splice(ni, 1);
      saveSequence();
      renderSequencerPage();
    };
  });

  // Note move up
  document.querySelectorAll("[data-pat-note-up]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const ni = parseInt(btn.dataset.patNoteUp);
      if (ni <= 0) return;
      [step.notes[ni - 1], step.notes[ni]] = [step.notes[ni], step.notes[ni - 1]];
      saveSequence();
      renderSequencerPage();
    };
  });

  // Note move down
  document.querySelectorAll("[data-pat-note-down]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const ni = parseInt(btn.dataset.patNoteDown);
      if (ni >= step.notes.length - 1) return;
      [step.notes[ni], step.notes[ni + 1]] = [step.notes[ni + 1], step.notes[ni]];
      saveSequence();
      renderSequencerPage();
    };
  });

  // Drag-and-drop reorder
  document.querySelectorAll(".seq-step-card[draggable]").forEach(card => {
    card.ondragstart = (ev) => {
      dragSrcIndex = parseInt(card.dataset.seqIdx);
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", dragSrcIndex);
      card.classList.add("seq-dragging");
    };
    card.ondragend = () => {
      card.classList.remove("seq-dragging");
      dragSrcIndex = null;
    };
    card.ondragover = (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      card.classList.add("seq-drag-over");
    };
    card.ondragleave = () => card.classList.remove("seq-drag-over");
    card.ondrop = (ev) => {
      ev.preventDefault();
      card.classList.remove("seq-drag-over");
      const from = parseInt(ev.dataTransfer.getData("text/plain"));
      const to = parseInt(card.dataset.seqIdx);
      if (from === to || isNaN(from) || isNaN(to)) return;
      const steps = seqState.sequence.steps;
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      if (seqState.editingStepIndex === from) seqState.editingStepIndex = to;
      else if (from < seqState.editingStepIndex && to >= seqState.editingStepIndex) seqState.editingStepIndex--;
      else if (from > seqState.editingStepIndex && to <= seqState.editingStepIndex) seqState.editingStepIndex++;
      saveSequence();
      renderSequencerPage();
    };
  });
}

// ── Boot ───────────────────────────────────────────────────────────
loadSequence();
renderSequencerPage();
