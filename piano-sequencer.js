// ── Piano Practice Sequencer ──────────────────────────────────────
// Depends on: theory.js, keyboard.js, piano-voicings.js,
//   sequence-model.js, playback.js, piano-pattern-generators.js

const PIANO_SEQ_STORAGE_KEY = "piano-sequencer-sequence";

// ── Sequencer state ───────────────────────────────────────────────
const pianoSeqState = {
  sequence: createSequence({ name: "My piano sequence" }),
  playback: { isPlaying: false, currentStepIndex: -1, tempo: 80, loop: false },
  editingStepIndex: -1,
  labelMode: "degree",  // "degree" | "note"
};

// ── Persistence ───────────────────────────────────────────────────
function savePianoSequence() {
  try {
    localStorage.setItem(PIANO_SEQ_STORAGE_KEY, sequenceToJSON(pianoSeqState.sequence));
  } catch (_) {}
}

function loadPianoSequence() {
  try {
    const raw = localStorage.getItem(PIANO_SEQ_STORAGE_KEY);
    if (raw) {
      const restored = sequenceFromJSON(raw);
      if (validateSequence(restored).length === 0) {
        pianoSeqState.sequence = restored;
        pianoSeqState.playback.tempo = restored.tempo;
      }
    }
  } catch (_) {}
}

// ── URL hash persistence ──────────────────────────────────────────
function savePianoSeqToHash() {
  try {
    const json = sequenceToJSON(pianoSeqState.sequence);
    const compressed = btoa(encodeURIComponent(json));
    history.replaceState(null, "", "#seq=" + compressed);
  } catch (_) {}
}

function loadPianoSeqFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#seq=")) return false;
  try {
    const compressed = hash.slice(5);
    const json = decodeURIComponent(atob(compressed));
    const restored = sequenceFromJSON(json);
    if (validateSequence(restored).length === 0) {
      pianoSeqState.sequence = restored;
      pianoSeqState.playback.tempo = restored.tempo;
      savePianoSequence();
      return true;
    }
  } catch (_) {}
  return false;
}

// ── Chord voicing helper ──────────────────────────────────────────
function pianoVoicingForStep(step) {
  const rootPc = noteIndex(step.root);
  const style = (step.voicing && step.voicing.style) || "close";
  const inversion = (step.voicing && step.voicing.inversion) || 0;
  const notes = buildVoicing(rootPc, step.quality, inversion, style);
  return { notes, style, inversion };
}

// ── Bracket chord helpers ─────────────────────────────────────────
function findPianoBracketChords(steps, idx) {
  let prev = null, next = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (steps[i].kind === "chord") { prev = steps[i]; break; }
  }
  for (let i = idx + 1; i < steps.length; i++) {
    if (steps[i].kind === "chord") { next = steps[i]; break; }
  }
  return { prev, next };
}

// ── Lead Line keyboard renderer ───────────────────────────────────
function renderPianoLeadLineKB(step, index, labelMode) {
  const steps = pianoSeqState.sequence.steps;
  const { prev, next } = findPianoBracketChords(steps, index);

  let scaleKey, scaleRootPc;
  if (step.scale) {
    scaleKey = step.scale.type;
    scaleRootPc = noteIndex(step.scale.root);
  } else {
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
  const prevChordPcSet = prev ? new Set(chordPcs(prev.root, prev.quality)) : null;
  const nextChordPcSet = next ? new Set(chordPcs(next.root, next.quality)) : null;

  // Combine bracket chord PCs for the chord highlight
  const allChordPcs = new Set();
  if (prevChordPcSet) prevChordPcSet.forEach(pc => allChordPcs.add(pc));
  if (nextChordPcSet) nextChordPcSet.forEach(pc => allChordPcs.add(pc));

  const noteNameMap = spellScale(noteName(scaleRootPc), scaleDef.steps);
  const degreeMap = {};
  scaleDef.steps.forEach((s, i) => {
    degreeMap[(scaleRootPc + s) % 12] = scaleDef.degrees[i] || "";
  });

  return renderKeyboardSVG({
    startMidi: 48, endMidi: 84,
    scalePcs,
    rootPc: scaleRootPc,
    chordPcs: allChordPcs.size > 0 ? [...allChordPcs] : null,
    labelMode: labelMode || "degree",
    degreeMap,
    noteNameMap,
  });
}

// ── Clickable pattern keyboard ────────────────────────────────────
function renderPianoPatternKB(step) {
  const scaleKey = step.scale ? step.scale.type : "ionian";
  const scaleRootPc = step.scale ? noteIndex(step.scale.root) : 0;
  const scaleDef = SCALES[scaleKey] || SCALES.ionian;
  const scalePcs = scaleDef.steps.map(s => (scaleRootPc + s) % 12);
  const scaleSet = new Set(scalePcs);

  const enteredSet = new Set((step.notes || []).map(n => n.midi));

  const startMidi = 48, endMidi = 84;
  const whiteW = 22, whiteH = 92, blackW = whiteW * 0.62, blackH = whiteH * 0.62;

  // Position white keys
  const whiteKeys = [];
  const blackKeys = [];
  let wIdx = 0;
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (KB_IS_WHITE(pc)) {
      whiteKeys.push({ midi: m, pc, x: wIdx * whiteW });
      wIdx++;
    }
  }
  const whiteByMidi = new Map(whiteKeys.map(w => [w.midi, w]));
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (KB_IS_WHITE(pc)) continue;
    const prev = whiteByMidi.get(m - 1);
    if (!prev) continue;
    blackKeys.push({ midi: m, pc, x: prev.x + whiteW - blackW / 2 });
  }

  const width = whiteKeys.length * whiteW;
  const height = whiteH + 14;
  const whiteDotR = 9, blackDotR = 5.5;
  const whiteDotCy = whiteH - whiteDotR - 5;
  const blackDotCy = blackH - blackDotR - 3;

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" id="seq-pat-svg" style="max-width:100%;height:auto;display:block">`;

  // White keys
  for (const w of whiteKeys) {
    const inScale = scaleSet.has(w.pc);
    const isEntered = enteredSet.has(w.midi);
    const isRoot = w.pc === scaleRootPc;
    svg += `<rect x="${w.x + 0.5}" y="0" width="${whiteW - 1}" height="${whiteH}" fill="#e8e8ec" stroke="#1a1a24" stroke-width="0.6" rx="2" ry="2"/>`;
    if (inScale) {
      const cx = w.x + whiteW / 2;
      if (isEntered) {
        svg += `<circle cx="${cx}" cy="${whiteDotCy}" r="${whiteDotR}" fill="var(--accent)" stroke="var(--triad-stroke)" stroke-width="2"/>`;
        const degIdx = scaleDef.steps.indexOf((w.pc - scaleRootPc + 12) % 12);
        const label = scaleDef.degrees[degIdx] || "";
        svg += `<text x="${cx}" y="${whiteDotCy + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700" font-family="'JetBrains Mono', monospace">${label}</text>`;
      } else {
        const dotFill = isRoot ? "var(--triad-fill)" : "var(--pattern-note)";
        const opacity = isRoot ? "0.6" : "0.25";
        svg += `<circle cx="${cx}" cy="${whiteDotCy}" r="${whiteDotR - 2}" fill="${dotFill}" opacity="${opacity}"/>`;
        const degIdx = scaleDef.steps.indexOf((w.pc - scaleRootPc + 12) % 12);
        const label = scaleDef.degrees[degIdx] || "";
        svg += `<text x="${cx}" y="${whiteDotCy + 3}" text-anchor="middle" font-size="8" fill="var(--text-dim)" font-family="'JetBrains Mono', monospace">${label}</text>`;
      }
      // Click target
      svg += `<rect x="${w.x}" y="0" width="${whiteW}" height="${whiteH}" fill="transparent" class="seq-pat-click" data-pat-midi="${w.midi}" style="cursor:pointer"/>`;
    }
    if (w.pc === 0) {
      const oct = Math.floor(w.midi / 12) - 1;
      svg += `<text x="${w.x + whiteW / 2}" y="${height - 2}" text-anchor="middle" font-size="9" fill="var(--text-muted)" font-family="'JetBrains Mono', monospace">C${oct}</text>`;
    }
  }

  // Black keys
  for (const b of blackKeys) {
    const inScale = scaleSet.has(b.pc);
    const isEntered = enteredSet.has(b.midi);
    svg += `<rect x="${b.x}" y="0" width="${blackW}" height="${blackH}" fill="#1c1c24" stroke="#000" stroke-width="0.6" rx="1.5" ry="1.5"/>`;
    if (inScale) {
      const cx = b.x + blackW / 2;
      if (isEntered) {
        svg += `<circle cx="${cx}" cy="${blackDotCy}" r="${blackDotR}" fill="var(--accent)" stroke="var(--triad-stroke)" stroke-width="1.5"/>`;
        const degIdx = scaleDef.steps.indexOf((b.pc - scaleRootPc + 12) % 12);
        const label = scaleDef.degrees[degIdx] || "";
        svg += `<text x="${cx}" y="${blackDotCy + 3.5}" text-anchor="middle" font-size="9" fill="#fff" font-weight="700" font-family="'JetBrains Mono', monospace">${label}</text>`;
      } else {
        const opacity = "0.25";
        svg += `<circle cx="${cx}" cy="${blackDotCy}" r="${blackDotR - 1}" fill="var(--pattern-note)" opacity="${opacity}"/>`;
      }
      // Click target
      svg += `<rect x="${b.x}" y="0" width="${blackW}" height="${blackH}" fill="transparent" class="seq-pat-click" data-pat-midi="${b.midi}" style="cursor:pointer"/>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

// ── Card keyboard for step cards ──────────────────────────────────
function renderPianoCardKB(opts) {
  opts = opts || {};
  const startMidi = opts.startMidi || 48;
  const endMidi = opts.endMidi || 72;

  if (opts.chordNotes) {
    return renderKeyboardSVG({
      startMidi, endMidi,
      chordNotes: opts.chordNotes,
      rootPc: opts.rootPc,
      labelMode: "degree",
      compact: true,
    });
  }

  if (opts.scalePcs) {
    return renderKeyboardSVG({
      startMidi, endMidi,
      scalePcs: opts.scalePcs,
      rootPc: opts.rootPc,
      chordPcs: opts.chordPcs || null,
      labelMode: opts.labelMode || "degree",
      degreeMap: opts.degreeMap || null,
      compact: true,
    });
  }

  if (opts.notes && opts.notes.length) {
    // Show pattern notes as chord notes for highlighting
    const chordNotes = opts.notes.map((n, i) => ({
      midi: n.midi,
      degree: n.degree || "" + (i + 1),
    }));
    return renderKeyboardSVG({
      startMidi, endMidi,
      chordNotes,
      labelMode: "degree",
      compact: true,
    });
  }

  return "";
}

// Compute MIDI range for display
function pianoCardRange(notes, margin) {
  margin = margin || 4;
  if (!notes || !notes.length) return [48, 72];
  const midis = notes.map(n => n.midi);
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  // Snap to white-key boundaries and add margin
  let start = lo - margin;
  let end = hi + margin;
  // Round down to nearest C for clean display
  start = Math.max(36, Math.floor(start / 12) * 12);
  end = Math.min(96, Math.ceil(end / 12) * 12);
  if (end - start < 12) end = start + 12;
  return [start, end];
}

// ── Render ────────────────────────────────────────────────────────
function renderPianoSequencerPage() {
  const seq = pianoSeqState.sequence;
  const steps = seq.steps;

  // Controls
  let controls = `
    <div class="control-group">
      <span class="control-label">Sequence</span>
      <div class="control-options">
        <input type="text" id="seq-name" class="seq-name-input" value="${escPAttr(seq.name)}" />
      </div>
    </div>
    <div class="control-group">
      <span class="control-label">Tempo</span>
      <div class="control-options">
        <input type="number" id="seq-tempo" class="seq-tempo-input" value="${seq.tempo}" min="40" max="300" step="1" />
        <span class="control-label" style="margin-left:4px">BPM</span>
      </div>
    </div>
    <div class="control-group" style="justify-content:flex-end;gap:6px">
      <button class="print-btn" id="seq-share-btn">Copy link</button>
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
    <button class="seq-loop-btn ${pianoSeqState.playback.loop ? "active" : ""}" id="seq-loop-btn">Loop</button>
  </div>`;

  // Timeline
  let timeline = "";
  steps.forEach((step, i) => {
    const isEditing = pianoSeqState.editingStepIndex === i;
    timeline += renderPianoStepCard(step, i, isEditing);
  });

  timeline += `<div class="seq-add-card" id="seq-add-btn" title="Add a step">
    <div class="seq-add-icon">+</div>
    <div class="seq-add-label">Add step</div>
  </div>`;

  document.getElementById("seq-timeline").innerHTML = timeline;

  // Editor
  const editorEl = document.getElementById("seq-editor");
  if (pianoSeqState.editingStepIndex >= 0 && pianoSeqState.editingStepIndex < steps.length) {
    editorEl.innerHTML = renderPianoStepEditor(steps[pianoSeqState.editingStepIndex], pianoSeqState.editingStepIndex);
    editorEl.hidden = false;
  } else {
    editorEl.innerHTML = "";
    editorEl.hidden = true;
  }

  attachPianoSequencerEvents();
}

function escPAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ── Step card ─────────────────────────────────────────────────────
function renderPianoStepCard(step, index, isEditing) {
  let inner = "";
  let kindLabel;
  const kindClass = `seq-step-${step.kind}`;

  if (step.kind === "chord") {
    kindLabel = `${step.root} ${step.quality}`;
    const voicingNotes = step.voicing && step.voicing.notes;
    if (voicingNotes && voicingNotes.length) {
      const range = pianoCardRange(voicingNotes);
      inner = renderPianoCardKB({
        chordNotes: voicingNotes,
        rootPc: noteIndex(step.root),
        startMidi: range[0], endMidi: range[1],
      });
    } else {
      inner = `<div class="seq-step-empty">No voicing</div>`;
    }
  } else if (step.kind === "lead_line") {
    kindLabel = "Lead Line";
    const allSteps = pianoSeqState.sequence.steps;
    const { prev, next } = findPianoBracketChords(allSteps, index);
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
    const prevPcs = prev ? chordPcs(prev.root, prev.quality) : null;
    const nextPcs = next ? chordPcs(next.root, next.quality) : null;
    const allLandingPcs = [...(prevPcs || []), ...(nextPcs || [])];
    const degreeMap = {};
    scaleDef.steps.forEach((s, i) => { degreeMap[(scaleRootPc + s) % 12] = scaleDef.degrees[i]; });
    inner = renderPianoCardKB({
      scalePcs, rootPc: scaleRootPc,
      chordPcs: allLandingPcs.length ? allLandingPcs : null,
      labelMode: pianoSeqState.labelMode,
      degreeMap,
      startMidi: 48, endMidi: 72,
    });
  } else if (step.kind === "pattern") {
    kindLabel = "Pattern";
    const notes = step.notes || [];
    if (notes.length) {
      const range = pianoCardRange(notes);
      inner = renderPianoCardKB({
        notes,
        startMidi: range[0], endMidi: range[1],
      });
    } else {
      inner = `<div class="seq-step-empty">No notes</div>`;
    }
  } else if (step.kind === "rest") {
    kindLabel = "Rest";
    inner = `<div class="seq-step-rest-icon">&#119102;</div>`;
  } else {
    kindLabel = step.kind;
  }

  const isPlayingStep = pianoSeqState.playback.currentStepIndex === index;
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

// ── Step editors ──────────────────────────────────────────────────
function renderPianoStepEditor(step, index) {
  if (step.kind === "chord") return renderPianoChordEditor(step, index);
  if (step.kind === "lead_line") return renderPianoLeadLineEditor(step, index);
  if (step.kind === "pattern") return renderPianoPatternEditor(step, index);
  if (step.kind === "rest") return renderPianoRestEditor(step, index);
  return "";
}

function renderPianoChordEditor(step, index) {
  const allQualities = ["major", "minor", "dim", "aug", "sus2", "sus4", "maj7", "dom7", "min7", "mM7", "dim7", "m7b5"];
  const voicingStyles = [
    { key: "close", label: "Close" },
    { key: "open", label: "Open" },
    { key: "split", label: "Two-hand" },
  ];
  const articulations = [
    { key: "block", label: "Block" },
    { key: "arpeggiate_up", label: "Arp &#8593;" },
    { key: "arpeggiate_down", label: "Arp &#8595;" },
  ];
  const currentStyle = (step.voicing && step.voicing.style) || "close";
  const currentInversion = (step.voicing && step.voicing.inversion) || 0;
  const numTones = (CHORD_INTERVALS[step.quality] || []).length;
  const maxInversion = numTones - 1;

  // Chord suggestions
  const { key: detectedKey, secondKey, suggestions } = suggestNextChords(pianoSeqState.sequence.steps, index);
  const chordSymbol = (CHORD_SYMBOL || {})[step.quality] || "";

  // Key info panel
  let keyInfoHtml = "";
  if (detectedKey && detectedKey.pct > 0) {
    const pctLabel = Math.round(detectedKey.pct * 100);
    const romanLabel = romanInKey(noteIndex(step.root), step.quality, detectedKey.rootPc);
    keyInfoHtml = `<div class="seq-key-info">
      <div class="seq-key-label">Detected tonality</div>
      <div><span class="seq-key-name">${detectedKey.rootName} major</span><span class="seq-key-confidence">${pctLabel}% of chords fit</span></div>
      ${romanLabel ? `<div class="seq-key-secondary">Current chord: <strong>${step.root}${chordSymbol}</strong> = <strong>${romanLabel}</strong> in ${detectedKey.rootName}</div>` : `<div class="seq-key-secondary">Current chord <strong>${step.root}${chordSymbol}</strong> is outside ${detectedKey.rootName} major (chromatic / borrowed)</div>`}
      ${secondKey && secondKey.score === detectedKey.score ? `<div class="seq-key-secondary">Also possible: <strong>${secondKey.rootName} major</strong></div>` : ""}
    </div>`;
  }

  // Group suggestions by category
  const catOrder = ["diatonic", "resolution", "relative", "secondary", "borrowed", "chromatic"];
  const catLabels = {
    diatonic: "Diatonic", resolution: "Common resolutions", relative: "Relative key",
    secondary: "Secondary dominants", borrowed: "Borrowed chords", chromatic: "Chromatic motion",
  };
  const catColors = {
    diatonic: "var(--accent)", resolution: "#50c88c", relative: "#5ac8c8",
    secondary: "var(--pattern-note)", borrowed: "#c57aff", chromatic: "var(--text-dim)",
  };
  const grouped = {};
  for (const s of suggestions) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  let suggestHtml = "";
  if (suggestions.length > 0) {
    // Legend
    suggestHtml += `<div class="seq-suggest-legend">`;
    for (const cat of catOrder) {
      if (!grouped[cat]) continue;
      suggestHtml += `<span class="seq-suggest-legend-item"><span class="seq-suggest-legend-dot" style="background:${catColors[cat]}"></span> ${catLabels[cat]}</span>`;
    }
    suggestHtml += `</div>`;

    for (const cat of catOrder) {
      if (!grouped[cat]) continue;
      const sym = (q) => (CHORD_SYMBOL || {})[q] || "";
      suggestHtml += `<div class="seq-suggest-section">
        <div class="seq-suggest-label">${catLabels[cat]}</div>
        <div class="seq-suggest-grid">
          ${grouped[cat].map(s => {
            const isActive = s.root === step.root && s.quality === step.quality;
            return `<button class="seq-suggest-btn ${isActive ? "active" : ""}" data-sug-cat="${s.category}" data-sug-root="${s.root}" data-sug-quality="${s.quality}" title="${escPAttr(s.reason + (s.tonalityEffect ? ' — ' + s.tonalityEffect : ''))}">
              <span class="seq-suggest-chord">${s.root}${sym(s.quality)}</span>
              ${s.roman ? `<span class="seq-suggest-roman">${s.roman}</span>` : ""}
              ${s.tonalityEffect ? `<span class="seq-suggest-effect">${s.tonalityEffect}</span>` : ""}
            </button>`;
          }).join("")}
        </div>
      </div>`;
    }
  }

  return `<div class="seq-editor-panel">
    <div class="seq-editor-title">Edit chord step</div>
    ${keyInfoHtml}
    ${suggestHtml}
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
        <span class="control-label">Voicing style</span>
        <div class="control-options">
          ${voicingStyles.map(v => `<button class="control-btn ${currentStyle === v.key ? "active" : ""}" data-seq-voicing-style="${v.key}">${v.label}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Inversion</span>
        <div class="control-options">
          ${Array.from({ length: maxInversion + 1 }, (_, i) => `<button class="control-btn ${currentInversion === i ? "active" : ""}" data-seq-voicing-inv="${i}">${i === 0 ? "Root" : i + (i === 1 ? "st" : i === 2 ? "nd" : "rd")}</button>`).join("")}
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
    <div class="seq-editor-row" style="justify-content:flex-end;gap:6px">
      <button class="print-btn" data-seq-jump="voicings" data-jump-root="${step.root}" data-jump-quality="${step.quality}" title="Open in Voicings">Open in Voicings</button>
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

function renderPianoLeadLineEditor(step, index) {
  const steps = pianoSeqState.sequence.steps;
  const { prev, next } = findPianoBracketChords(steps, index);

  const suggestions = suggestScalesForBracket(
    prev ? { root: prev.root, quality: prev.quality } : null,
    next ? { root: next.root, quality: next.quality } : null
  );

  const currentScale = step.scale;
  const isAuto = !currentScale;

  let suggestionsHtml = "";
  if (suggestions.length > 0) {
    suggestionsHtml = `<div class="seq-ll-suggestions">
      <span class="control-label">Suggested scales</span>
      <div class="seq-ll-suggest-list">
        ${suggestions.map(s => {
          const isActive = currentScale && currentScale.root === s.root && currentScale.type === s.scaleKey;
          return `<button class="seq-ll-suggest-btn ${isActive ? "active" : ""}" data-seq-ll-scale-root="${s.root}" data-seq-ll-scale-type="${s.scaleKey}" title="${escPAttr(s.reasoning)}">
            <span class="seq-ll-suggest-name">${s.name}</span>
            <span class="seq-ll-suggest-reason">${s.reasoning}</span>
            ${s.fitsBoth ? '<span class="seq-ll-suggest-badge">fits both</span>' : ''}
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }

  const heptatonic = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];
  const pentatonic = ["majorPent", "minorPent", "blues"];
  const allScaleKeys = [...heptatonic, ...pentatonic];
  const prevLabel = prev ? `${prev.root} ${prev.quality}` : "none";
  const nextLabel = next ? `${next.root} ${next.quality}` : "none";
  const keyboard = renderPianoLeadLineKB(step, index, pianoSeqState.labelMode);

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
          ${allScaleKeys.map(k => `<button class="control-btn ${currentScale && currentScale.type === k ? "active" : ""}" data-seq-ll-type="${k}">${SCALES[k].name}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Labels</span>
        <div class="control-options">
          <button class="control-btn ${pianoSeqState.labelMode === "degree" ? "active" : ""}" data-seq-ll-label="degree">Degrees</button>
          <button class="control-btn ${pianoSeqState.labelMode === "note" ? "active" : ""}" data-seq-ll-label="note">Notes</button>
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
    <div class="keyboard-scroll" style="margin:12px 0">${keyboard}</div>
    <div class="seq-editor-row" style="justify-content:flex-end;gap:6px">
      <button class="print-btn" data-seq-jump="scales" data-jump-root="${currentScale ? currentScale.root : (suggestions.length ? suggestions[0].root : "C")}" data-jump-scale="${currentScale ? currentScale.type : (suggestions.length ? suggestions[0].scaleKey : "ionian")}" title="Open in Scales">Open in Scales</button>
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

function renderPianoPatternEditor(step, index) {
  const heptatonic = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];
  const pentatonic = ["majorPent", "minorPent", "blues"];
  const allScaleKeys = [...heptatonic, ...pentatonic];

  const scaleKey = step.scale ? step.scale.type : "ionian";
  const scaleRootPc = step.scale ? noteIndex(step.scale.root) : 0;
  const scaleDef = SCALES[scaleKey] || SCALES.ionian;

  // Note list
  let noteListHtml = "";
  if (step.notes && step.notes.length > 0) {
    noteListHtml = `<div class="seq-pat-note-list">`;
    step.notes.forEach((n, ni) => {
      const pc = ((n.midi % 12) + 12) % 12;
      const name = noteName(pc);
      const oct = Math.floor(n.midi / 12) - 1;
      const degreeIdx = scaleDef.steps.indexOf((pc - scaleRootPc + 12) % 12);
      const degree = scaleDef.degrees[degreeIdx] || "";

      noteListHtml += `<div class="seq-pat-note">
        <span class="seq-pat-note-num">${ni + 1}</span>
        <span class="seq-pat-note-info">${name}${oct}<span class="seq-pat-note-degree">${degree}</span></span>
        <select data-pat-note-dur="${ni}">
          ${[0.25, 0.5, 1, 2, 4].map(d => `<option value="${d}" ${n.durationBeats === d ? "selected" : ""}>${d}b</option>`).join("")}
        </select>
        <button class="seq-pat-note-move" data-pat-note-up="${ni}" title="Move up" ${ni === 0 ? "disabled" : ""}>&#9650;</button>
        <button class="seq-pat-note-move" data-pat-note-down="${ni}" title="Move down" ${ni === step.notes.length - 1 ? "disabled" : ""}>&#9660;</button>
        <button class="seq-pat-note-del" data-pat-note-del="${ni}" title="Remove">&#215;</button>
      </div>`;
    });
    noteListHtml += `</div>`;
  } else {
    noteListHtml = `<div class="seq-step-empty">Click scale notes on the keyboard to add them</div>`;
  }

  const keyboard = renderPianoPatternKB(step);

  return `<div class="seq-editor-panel seq-pat-editor">
    <div class="seq-editor-title">Edit pattern step</div>
    <div class="seq-editor-row">
      <div class="control-group">
        <span class="control-label">Scale context</span>
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
        <span class="control-label">Generate pattern</span>
        <div class="control-options">
          ${Object.entries(PIANO_PATTERN_GENERATORS).map(([k, g]) => `<button class="control-btn" data-seq-gen="${k}" title="${g.desc}">${g.name}</button>`).join("")}
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
    <div class="keyboard-scroll seq-pat-fretboard" style="margin:12px 0">${keyboard}</div>
    <span class="control-label">Notes (${(step.notes || []).length}) — click keyboard to add, or use a generator</span>
    ${noteListHtml}
    <div class="seq-editor-row" style="justify-content:flex-end;margin-top:8px">
      <button class="print-btn" id="seq-editor-close">Done</button>
    </div>
  </div>`;
}

function renderPianoRestEditor(step, index) {
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

// ── Step picker ───────────────────────────────────────────────────
function showPianoStepPicker() {
  const modal = document.getElementById("seq-picker-modal");
  if (modal) modal.classList.add("open");
}
function hidePianoStepPicker() {
  const modal = document.getElementById("seq-picker-modal");
  if (modal) modal.classList.remove("open");
}

// ── Events ────────────────────────────────────────────────────────
function attachPianoSequencerEvents() {
  // Sequence name
  const nameInput = document.getElementById("seq-name");
  if (nameInput) {
    nameInput.onchange = () => {
      pianoSeqState.sequence.name = nameInput.value || "Untitled";
      savePianoSequence();
    };
  }

  // Tempo
  const tempoInput = document.getElementById("seq-tempo");
  if (tempoInput) {
    tempoInput.onchange = () => {
      const val = parseInt(tempoInput.value);
      if (val > 0) {
        pianoSeqState.sequence.tempo = val;
        pianoSeqState.playback.tempo = val;
        savePianoSequence();
      }
    };
  }

  // Playback controls
  const playBtn = document.getElementById("seq-play-btn");
  if (playBtn) {
    playBtn.onclick = async () => {
      if (playbackIsPlaying()) {
        playbackPause();
        pianoSeqState.playback.isPlaying = false;
      } else {
        pianoSeqState.playback.isPlaying = true;
        const stepCallback = (stepIdx) => {
          pianoSeqState.playback.currentStepIndex = stepIdx;
          document.querySelectorAll(".seq-step-card").forEach(card => {
            const ci = parseInt(card.dataset.seqIdx);
            card.classList.toggle("seq-step-playing", ci === stepIdx);
          });
          if (stepIdx === -1) {
            pianoSeqState.playback.isPlaying = false;
            const btn = document.getElementById("seq-play-btn");
            if (btn) { btn.innerHTML = "&#9654; Play"; btn.classList.remove("seq-playing"); }
          }
        };
        playbackSetLoop(pianoSeqState.playback.loop);
        await playbackPlay(pianoSeqState.sequence, stepCallback);
      }
      renderPianoSequencerPage();
    };
  }

  const stopBtn = document.getElementById("seq-stop-btn");
  if (stopBtn) {
    stopBtn.onclick = () => {
      playbackStop();
      pianoSeqState.playback.isPlaying = false;
      pianoSeqState.playback.currentStepIndex = -1;
      renderPianoSequencerPage();
    };
  }

  const tempoSlider = document.getElementById("seq-tempo-slider");
  if (tempoSlider) {
    tempoSlider.oninput = () => {
      const val = parseInt(tempoSlider.value);
      pianoSeqState.sequence.tempo = val;
      pianoSeqState.playback.tempo = val;
      playbackSetTempo(val);
      const display = document.getElementById("seq-tempo-display");
      if (display) display.textContent = val + " BPM";
      const ti = document.getElementById("seq-tempo");
      if (ti) ti.value = val;
    };
    tempoSlider.onchange = () => savePianoSequence();
  }

  const loopBtn = document.getElementById("seq-loop-btn");
  if (loopBtn) {
    loopBtn.onclick = () => {
      pianoSeqState.playback.loop = !pianoSeqState.playback.loop;
      playbackSetLoop(pianoSeqState.playback.loop);
      loopBtn.classList.toggle("active", pianoSeqState.playback.loop);
    };
  }

  // Clear all
  const clearBtn = document.getElementById("seq-clear-btn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      pianoSeqState.sequence.steps = [];
      pianoSeqState.editingStepIndex = -1;
      savePianoSequence();
      renderPianoSequencerPage();
    };
  }

  // Add step
  const addBtn = document.getElementById("seq-add-btn");
  if (addBtn) addBtn.onclick = () => showPianoStepPicker();

  // Step-kind picker
  document.querySelectorAll("[data-seq-pick]").forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.seqPick;
      if (kind === "chord") {
        const step = chordStep({ root: "C", quality: "major", articulation: "block" });
        step.voicing = pianoVoicingForStep(step);
        pianoSeqState.sequence.steps.push(step);
        pianoSeqState.editingStepIndex = pianoSeqState.sequence.steps.length - 1;
      } else if (kind === "lead_line") {
        pianoSeqState.sequence.steps.push(leadLineStep({ durationBeats: 8 }));
        pianoSeqState.editingStepIndex = pianoSeqState.sequence.steps.length - 1;
      } else if (kind === "pattern") {
        pianoSeqState.sequence.steps.push(patternStep({ scale: { root: "A", type: "minorPent" }, durationBeats: 4, notes: [] }));
        pianoSeqState.editingStepIndex = pianoSeqState.sequence.steps.length - 1;
      } else if (kind === "rest") {
        pianoSeqState.sequence.steps.push(restStep({ durationBeats: 2 }));
      }
      savePianoSequence();
      hidePianoStepPicker();
      renderPianoSequencerPage();
    };
  });

  // Picker close
  const pickerClose = document.getElementById("seq-picker-close");
  if (pickerClose) pickerClose.onclick = () => hidePianoStepPicker();
  const pickerModal = document.getElementById("seq-picker-modal");
  if (pickerModal) {
    pickerModal.onclick = (ev) => { if (ev.target === pickerModal) hidePianoStepPicker(); };
  }

  // Step card click -> edit
  document.querySelectorAll(".seq-step-card").forEach(card => {
    card.onclick = (ev) => {
      if (ev.target.closest(".seq-step-delete")) return;
      const idx = parseInt(card.dataset.seqIdx);
      pianoSeqState.editingStepIndex = pianoSeqState.editingStepIndex === idx ? -1 : idx;
      renderPianoSequencerPage();
    };
  });

  // Delete step
  document.querySelectorAll("[data-seq-del]").forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const idx = parseInt(btn.dataset.seqDel);
      pianoSeqState.sequence.steps.splice(idx, 1);
      if (pianoSeqState.editingStepIndex === idx) pianoSeqState.editingStepIndex = -1;
      else if (pianoSeqState.editingStepIndex > idx) pianoSeqState.editingStepIndex--;
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Editor: property buttons
  document.querySelectorAll("[data-seq-edit]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const key = btn.dataset.seqEdit;
      const val = btn.dataset.val;
      if (key === "durationBeats") step.durationBeats = parseInt(val);
      else step[key] = val;
      if (key === "root" || key === "quality") step.voicing = pianoVoicingForStep(step);
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Chord suggestion buttons
  document.querySelectorAll("[data-sug-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      if (step.kind !== "chord") return;
      step.root = btn.dataset.sugRoot;
      step.quality = btn.dataset.sugQuality;
      step.voicing = pianoVoicingForStep(step);
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Voicing style
  document.querySelectorAll("[data-seq-voicing-style]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const style = btn.dataset.seqVoicingStyle;
      const inv = (step.voicing && step.voicing.inversion) || 0;
      step.voicing = { ...step.voicing, style, inversion: inv };
      step.voicing = pianoVoicingForStep(step);
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Voicing inversion
  document.querySelectorAll("[data-seq-voicing-inv]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const inv = parseInt(btn.dataset.seqVoicingInv);
      const style = (step.voicing && step.voicing.style) || "close";
      step.voicing = { ...step.voicing, style, inversion: inv };
      step.voicing = pianoVoicingForStep(step);
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Editor close
  const editorClose = document.getElementById("seq-editor-close");
  if (editorClose) {
    editorClose.onclick = () => {
      pianoSeqState.editingStepIndex = -1;
      renderPianoSequencerPage();
    };
  }

  // ── Lead Line editor events ──────────────────────────────────────
  document.querySelectorAll("[data-seq-ll-scale-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      pianoSeqState.sequence.steps[idx].scale = { root: btn.dataset.seqLlScaleRoot, type: btn.dataset.seqLlScaleType };
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  document.querySelectorAll("[data-seq-ll-auto]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      pianoSeqState.sequence.steps[idx].scale = null;
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  document.querySelectorAll("[data-seq-ll-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const root = btn.dataset.seqLlRoot;
      const type = (step.scale && step.scale.type) || "ionian";
      step.scale = { root, type };
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  document.querySelectorAll("[data-seq-ll-type]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const root = (step.scale && step.scale.root) || "C";
      step.scale = { root, type: btn.dataset.seqLlType };
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  document.querySelectorAll("[data-seq-ll-label]").forEach(btn => {
    btn.onclick = () => {
      pianoSeqState.labelMode = btn.dataset.seqLlLabel;
      renderPianoSequencerPage();
    };
  });

  // ── Pattern editor events ───────────────────────────────────────
  document.querySelectorAll("[data-seq-pat-root]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const type = (step.scale && step.scale.type) || "ionian";
      step.scale = { root: btn.dataset.seqPatRoot, type };
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  document.querySelectorAll("[data-seq-pat-type]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const root = (step.scale && step.scale.root) || "C";
      step.scale = { root, type: btn.dataset.seqPatType };
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Pattern generators
  document.querySelectorAll("[data-seq-gen]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      if (step.kind !== "pattern") return;
      const genName = btn.dataset.seqGen;
      const gen = PIANO_PATTERN_GENERATORS[genName];
      if (!gen) return;
      const startMidi = (step.notes && step.notes.length) ? step.notes[0].midi : 60;
      const generated = runPianoGenerator(genName, {
        scale: step.scale || { root: "C", type: "ionian" },
        startMidi,
        noteCount: 12,
        params: gen.defaultParams,
      });
      step.notes = generated;
      step.generator = { name: genName, params: gen.defaultParams };
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Click on keyboard to add note
  document.querySelectorAll(".seq-pat-click").forEach(el => {
    el.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      if (step.kind !== "pattern") return;
      const midi = parseInt(el.dataset.patMidi);
      const pc = ((midi % 12) + 12) % 12;
      const scaleRootPc = step.scale ? noteIndex(step.scale.root) : 0;
      const scaleDef = SCALES[step.scale ? step.scale.type : "ionian"] || SCALES.ionian;
      const degreeIdx = scaleDef.steps.indexOf((pc - scaleRootPc + 12) % 12);
      const degree = degreeIdx >= 0 ? scaleDef.degrees[degreeIdx] : "";
      step.notes.push({ midi, degree, durationBeats: 1 });
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Note duration change
  document.querySelectorAll("[data-pat-note-dur]").forEach(sel => {
    sel.onchange = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const step = pianoSeqState.sequence.steps[idx];
      const ni = parseInt(sel.dataset.patNoteDur);
      step.notes[ni].durationBeats = parseFloat(sel.value);
      savePianoSequence();
    };
  });

  // Note delete
  document.querySelectorAll("[data-pat-note-del]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      pianoSeqState.sequence.steps[idx].notes.splice(parseInt(btn.dataset.patNoteDel), 1);
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Note move up
  document.querySelectorAll("[data-pat-note-up]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const notes = pianoSeqState.sequence.steps[idx].notes;
      const ni = parseInt(btn.dataset.patNoteUp);
      if (ni <= 0) return;
      [notes[ni - 1], notes[ni]] = [notes[ni], notes[ni - 1]];
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Note move down
  document.querySelectorAll("[data-pat-note-down]").forEach(btn => {
    btn.onclick = () => {
      const idx = pianoSeqState.editingStepIndex;
      if (idx < 0) return;
      const notes = pianoSeqState.sequence.steps[idx].notes;
      const ni = parseInt(btn.dataset.patNoteDown);
      if (ni >= notes.length - 1) return;
      [notes[ni], notes[ni + 1]] = [notes[ni + 1], notes[ni]];
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });

  // Cross-links
  document.querySelectorAll("[data-seq-jump]").forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.seqJump;
      if (target === "voicings") {
        pianoVoicingState.root = btn.dataset.jumpRoot;
        pianoVoicingState.quality = btn.dataset.jumpQuality;
        renderPianoVoicings();
        jumpToPianoPage("voicings");
      } else if (target === "scales") {
        if (typeof pianoScaleState !== "undefined") {
          pianoScaleState.root = btn.dataset.jumpRoot;
          pianoScaleState.scale = btn.dataset.jumpScale;
          renderPianoScales();
        }
        jumpToPianoPage("scales");
      }
    };
  });

  // Share button
  const shareBtn = document.getElementById("seq-share-btn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      savePianoSeqToHash();
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        shareBtn.textContent = "Copied!";
        setTimeout(() => { shareBtn.textContent = "Copy link"; }, 1500);
      }).catch(() => {
        prompt("Copy this URL:", url);
      });
    };
  }

  // Drag-and-drop reorder
  document.querySelectorAll(".seq-step-card[draggable]").forEach(card => {
    card.ondragstart = (ev) => {
      pianoDragSrcIndex = parseInt(card.dataset.seqIdx);
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", pianoDragSrcIndex);
      card.classList.add("seq-dragging");
    };
    card.ondragend = () => {
      card.classList.remove("seq-dragging");
      pianoDragSrcIndex = null;
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
      const steps = pianoSeqState.sequence.steps;
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      if (pianoSeqState.editingStepIndex === from) pianoSeqState.editingStepIndex = to;
      else if (from < pianoSeqState.editingStepIndex && to >= pianoSeqState.editingStepIndex) pianoSeqState.editingStepIndex--;
      else if (from > pianoSeqState.editingStepIndex && to <= pianoSeqState.editingStepIndex) pianoSeqState.editingStepIndex++;
      savePianoSequence();
      renderPianoSequencerPage();
    };
  });
}

let pianoDragSrcIndex = null;

// ── Boot ──────────────────────────────────────────────────────────
if (loadPianoSeqFromHash()) {
  setTimeout(() => { if (window.jumpToPianoPage) jumpToPianoPage("sequencer"); }, 0);
} else {
  loadPianoSequence();
}
renderPianoSequencerPage();
