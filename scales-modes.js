// ── Scales & Modes page (fretted instruments) ──────────────────────
// SCALES, SCALE_GROUPS, NOTES, noteIndex, noteName come from theory.js.
// Tuning, string count, and fret range come from instruments.js via
// getInstrument() — the same renderer serves guitar, bass, uke, banjo,
// and mandolin.

const SCALES_ROOTS = ROOT_LABELS;

const scaleState = {
  root: "C",
  scale: "ionian",
  labelMode: "degree",     // "degree" | "note"
  system: "caged",         // "caged" (5 positions) | "3nps" (7 positions, heptatonic only)
  position: -1,            // -1 = full neck; 0..N-1 = specific position card
};

// Standard 6-string guitar MIDI, used only for 3NPS (which is a guitar-only
// concept). Kept private to this module; the renderer relies on
// getInstrument().tuning for pitch-class lookups instead.
const GUITAR_OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40];

// ── 3-notes-per-string positions (standard 6-string guitar + heptatonic only) ─
function compute3NPSPositions(rootPc, steps) {
  if (steps.length !== 7) return null;
  if (currentInstrumentKey !== "guitar") return null;
  const lowE = GUITAR_OPEN_STRING_MIDI[5]; // 40

  // Build an ascending list of absolute scale pitches covering the fretboard
  const abs = [];
  for (let oct = 1; oct < 7; oct++) {
    for (const s of steps) abs.push(rootPc + s + oct * 12);
  }

  const positions = [];
  for (let p = 0; p < 7; p++) {
    // Find smallest abs[i] with i%7===p and abs[i] in [lowE, lowE+15]
    let startIdx = -1;
    for (let i = 0; i < abs.length; i++) {
      if (abs[i] < lowE) continue;
      if (abs[i] > lowE + 15) break;
      if (i % 7 === p) { startIdx = i; break; }
    }
    if (startIdx < 0) continue;

    const notes = [];
    let valid = true;
    let idx = startIdx;
    for (let s = 5; s >= 0; s--) {
      const openMidi = GUITAR_OPEN_STRING_MIDI[s];
      for (let k = 0; k < 3; k++) {
        if (idx >= abs.length) { valid = false; break; }
        const fret = abs[idx] - openMidi;
        if (fret < 0 || fret > 15) { valid = false; break; }
        notes.push({ string: s, fret });
        idx++;
      }
      if (!valid) break;
    }
    if (!valid || notes.length !== 18) continue;
    const frets = notes.map(n => n.fret);
    positions.push({
      label: `Pos ${p + 1}`,
      notes,
      start: Math.min(...frets),
      end: Math.max(...frets),
    });
  }
  return positions;
}

// ── Position windows (CAGED-style 5-fret slices across the neck) ───
function computeScalePositions(rootPc) {
  const inst = getInstrument();
  const maxFret = inst.numFrets;
  // Fret on the lowest string where the root first appears (0..11).
  const lowStringPc = inst.tuning[inst.tuning.length - 1];
  const fL = ((rootPc - lowStringPc) % 12 + 12) % 12;
  // CAGED-style offsets: E, D, C, A, G shape starts relative to root-on-lowest
  const offsets = [-1, 2, 4, 7, 9];
  const positions = offsets.map((off, i) => {
    let start = fL + off;
    // Normalize into the playable range [0..11]
    while (start < 0) start += 12;
    while (start > 11) start -= 12;
    let end = start + 4;
    // If window exceeds neck, shift down an octave
    if (end > maxFret) { start -= 12; end -= 12; }
    if (start < 0) { start = 0; end = 4; }
    return { label: `Position ${i + 1}`, start, end };
  });
  positions.sort((a, b) => a.start - b.start);
  return positions;
}

// ── Fretboard renderer (scale-specific) ────────────────────────────
function renderScaleFretboard(scalePcs, rootPc, fretRange, opts) {
  opts = opts || {};
  const inst = getInstrument();
  const numStrings = inst.tuning.length;
  const compact = !!opts.compact;
  const labelMode = opts.labelMode || "degree";
  const scaleKey = opts.scaleKey || scaleState.scale;
  const highlightWindow = opts.highlightWindow || null;
  const noteNameMap = opts.noteNameMap || null;

  const [startFret, endFret] = fretRange;
  const numFrets = endFret - startFret;
  const ss = compact ? 18 : 22;
  const fs = compact ? 28 : 38;
  const tp = compact ? 20 : 24;
  const lp = 14;
  const w = lp + numFrets * fs + 20;
  const h = tp + (numStrings - 1) * ss + 20;
  const r = compact ? 8 : 10;
  const fretDots = [3, 5, 7, 9, 12, 15];
  const degreeList = SCALES[scaleKey].degrees;
  const stepList = SCALES[scaleKey].steps;
  const midString = (numStrings - 1) / 2;

  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

  // Highlight window (soft accent band over a position's fret range, inclusive)
  if (highlightWindow && !compact) {
    const [ws, we] = highlightWindow;
    const leftLine = Math.max(0, ws - 1 - startFret);
    const rightLine = Math.min(numFrets, we - startFret);
    if (rightLine > leftLine) {
      const x1 = lp + leftLine * fs;
      const x2 = lp + rightLine * fs;
      svg += `<rect x="${x1}" y="${tp - 2}" width="${x2 - x1}" height="${(numStrings - 1) * ss + 4}" fill="var(--accent)" opacity="0.10"/>`;
    }
  }

  // Position dots
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

  // Strings — truncate any with a per-string minimum fret (banjo drone).
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
    svg += `<text x="${lp + i * fs + fs / 2}" y="${h - 2}" text-anchor="middle" font-size="${compact ? 8 : 9}" fill="var(--text-muted)" font-family="monospace">${fretNum}</text>`;
  }

  // Scale notes
  const scaleSet = new Set(scalePcs);
  const specificSet = opts.specificNotes
    ? new Set(opts.specificNotes.map(n => `${n.string}-${n.fret}`))
    : null;
  for (let si = 0; si < numStrings; si++) {
    for (let fi = 0; fi < numFrets; fi++) {
      const fret = startFret + fi + 1;
      if (fret < 0 || fret > inst.numFrets) continue;
      if (!fretPositionPlayable(si, fret)) continue;
      const pc = (inst.tuning[si] + fret) % 12;
      if (!scaleSet.has(pc)) continue;
      if (specificSet && !specificSet.has(`${si}-${fret}`)) continue;
      const isRoot = pc === rootPc;
      const cx = lp + fi * fs + fs / 2;
      const cy = tp + si * ss;
      const idx = stepList.indexOf((pc - rootPc + 12) % 12);
      const label = labelMode === "note" ? spellNote(pc, noteNameMap) : (degreeList[idx] || "");

      if (isRoot) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--triad-fill)" stroke="var(--triad-stroke)" stroke-width="2"/>`;
        svg += `<text x="${cx}" y="${cy + (compact ? 3 : 3.5)}" text-anchor="middle" font-size="${compact ? 9 : 10}" fill="var(--triad-text)" font-weight="700" font-family="monospace">${label}</text>`;
      } else {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="var(--pattern-note)" opacity="0.78"/>`;
        svg += `<text x="${cx}" y="${cy + (compact ? 3 : 3)}" text-anchor="middle" font-size="${compact ? 8 : 9}" fill="var(--pattern-text)" font-family="monospace" font-weight="600">${label}</text>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

// ── Page render ────────────────────────────────────────────────────
function renderScalesPage() {
  const rootPc = noteIndex(scaleState.root);
  const def = SCALES[scaleState.scale];
  const scalePcs = def.steps.map(s => (rootPc + s) % 12);
  const noteNameMap = spellScale(scaleState.root, def.steps);
  const rootDisplay = noteNameMap ? noteNameMap[rootPc] : scaleState.root;

  // Resolve position system. 3NPS only works for 7-note scales; fall back to CAGED.
  const threeNPS = compute3NPSPositions(rootPc, def.steps);
  const threeNPSAvailable = threeNPS !== null;
  if (scaleState.system === "3nps" && !threeNPSAvailable) scaleState.system = "caged";
  const positions = scaleState.system === "3nps" ? threeNPS : computeScalePositions(rootPc);
  const use3NPS = scaleState.system === "3nps";

  // Controls
  let controls = "";
  controls += `<div class="control-group">
    <span class="control-label">Root</span>
    <div class="control-options">
      ${SCALES_ROOTS.map(r => `<button class="control-btn ${scaleState.root === r.key ? "active" : ""}" data-sc="root" data-val="${r.key}">${r.label}</button>`).join("")}
    </div>
  </div>`;

  for (const grp of SCALE_GROUPS) {
    controls += `<div class="control-group">
      <span class="control-label">${grp.label}</span>
      <div class="control-options">
        ${grp.keys.map(k => `<button class="control-btn ${scaleState.scale === k ? "active" : ""}" data-sc="scale" data-val="${k}">${SCALES[k].name}</button>`).join("")}
      </div>
    </div>`;
  }

  controls += `<div class="control-group">
    <span class="control-label">Labels</span>
    <div class="control-options">
      <button class="control-btn ${scaleState.labelMode === "degree" ? "active" : ""}" data-sc="labelMode" data-val="degree">Degrees</button>
      <button class="control-btn ${scaleState.labelMode === "note" ? "active" : ""}" data-sc="labelMode" data-val="note">Notes</button>
    </div>
  </div>`;

  controls += `<div class="control-group">
    <span class="control-label">Position system</span>
    <div class="control-options">
      <button class="control-btn ${scaleState.system === "caged" ? "active" : ""}" data-sc="system" data-val="caged">CAGED (5)</button>
      <button class="control-btn ${scaleState.system === "3nps" ? "active" : ""} ${threeNPSAvailable ? "" : "disabled"}" data-sc="system" data-val="3nps" ${threeNPSAvailable ? "" : "disabled"} title="${threeNPSAvailable ? "3 notes per string" : "Guitar-only; needs 6 strings and a 7-note scale"}">3NPS (7)</button>
    </div>
  </div>`;

  document.getElementById("scales-controls").innerHTML = controls;

  // Main full-neck fretboard (startFret is exclusive — [0, 15] shows frets 1–15)
  const fullRange = [0, getInstrument().numFrets];
  const highlight = scaleState.position >= 0 && scaleState.position < positions.length
    ? [positions[scaleState.position].start, positions[scaleState.position].end]
    : null;

  const scaleNotesList = scalePcs.map((pc, i) => {
    const deg = def.degrees[i];
    return `<span class="scale-tone"><span class="scale-tone-deg">${deg}</span><span class="scale-tone-note">${spellNote(pc, noteNameMap)}</span></span>`;
  }).join("");

  let mainTitle = `<span class="chord-name">${rootDisplay} ${def.name}</span>`;
  mainTitle += `<span class="inv-tag">${def.formula}</span>`;
  mainTitle += `<span class="inv-tag">${def.steps.length} notes</span>`;

  document.getElementById("scales-main").innerHTML = `
    <div class="main-fretboard">
      <div class="main-title">${mainTitle}</div>
      <div class="scale-tones">${scaleNotesList}</div>
      ${renderScaleFretboard(scalePcs, rootPc, fullRange, { labelMode: scaleState.labelMode, highlightWindow: highlight, noteNameMap })}
    </div>
  `;

  // Position header
  document.getElementById("scales-info").innerHTML = `
    <span class="patterns-label">Positions across the neck</span>
    <div class="pattern-tabs">
      <button class="pattern-tab ${scaleState.position === -1 ? "active" : ""}" data-sc-pos="-1">Full neck</button>
      ${positions.map((p, i) => `<button class="pattern-tab ${scaleState.position === i ? "active" : ""}" data-sc-pos="${i}">${p.label}</button>`).join("")}
    </div>
  `;

  // Position cards (p.start / p.end are inclusive fret numbers; renderer's startFret is exclusive)
  let cards = "";
  positions.forEach((p, i) => {
    const sel = scaleState.position === i ? "selected" : "";
    const cardOpts = { compact: true, labelMode: scaleState.labelMode, noteNameMap };
    if (use3NPS) cardOpts.specificNotes = p.notes;
    cards += `<div class="pattern-card ${sel}" data-sc-card="${i}">
      <div class="pattern-name">${p.label}</div>
      <div class="pattern-desc">Frets ${p.start}–${p.end}</div>
      ${renderScaleFretboard(scalePcs, rootPc, [p.start - 1, p.end], cardOpts)}
    </div>`;
  });
  document.getElementById("scales-positions").innerHTML = cards;

  attachScalesEvents();
}

function attachScalesEvents() {
  document.querySelectorAll("[data-sc]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.sc;
      const val = btn.dataset.val;
      scaleState[key] = val;
      renderScalesPage();
    };
  });
  document.querySelectorAll("[data-sc-pos]").forEach(btn => {
    btn.onclick = () => {
      scaleState.position = parseInt(btn.dataset.scPos);
      renderScalesPage();
    };
  });
  document.querySelectorAll("[data-sc-card]").forEach(card => {
    card.onclick = () => {
      const i = parseInt(card.dataset.scCard);
      scaleState.position = scaleState.position === i ? -1 : i;
      renderScalesPage();
    };
  });
}

renderScalesPage();
