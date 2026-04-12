// ── Piano Chord Voicings ────────────────────────────────────────────
// Requires theory.js + keyboard.js.

const pianoVoicingState = {
  root: "C",
  family: "triad",   // "triad" | "7th"
  quality: "major",
  inversion: 0,
  voicing: "close",  // "close" | "open" | "split"
};

const QUALITY_DISPLAY_P = {
  major: "major", minor: "minor", dim: "dim", aug: "aug", sus2: "sus2", sus4: "sus4",
  maj7: "maj7", dom7: "7", min7: "min7", mM7: "m(M7)", dim7: "dim7", m7b5: "m7♭5",
};
const CHORD_SYMBOL = {
  major: "", minor: "m", dim: "°", aug: "+", sus2: "sus2", sus4: "sus4",
  maj7: "maj7", dom7: "7", min7: "m7", mM7: "m(M7)", dim7: "°7", m7b5: "ø7",
};
const FAMILY_QUALITIES_P = {
  triad: ["major","minor","dim","aug","sus2","sus4"],
  "7th": ["maj7","dom7","min7","mM7","dim7","m7b5"],
};
const INVERSIONS_P = {
  triad: ["Root position","1st inversion","2nd inversion"],
  "7th": ["Root position","1st inversion","2nd inversion","3rd inversion"],
};

function getChordDegreeLabelsP(quality) {
  const base = {
    major: ["1","3","5"],       minor: ["1","♭3","5"],
    dim:   ["1","♭3","♭5"],     aug:   ["1","3","♯5"],
    sus2:  ["1","2","5"],       sus4:  ["1","4","5"],
    maj7:  ["1","3","5","7"],   dom7:  ["1","3","5","♭7"],
    min7:  ["1","♭3","5","♭7"], mM7:   ["1","♭3","5","7"],
    dim7:  ["1","♭3","♭5","°7"],m7b5:  ["1","♭3","♭5","♭7"],
  };
  return [...(base[quality] || base.major)];
}

function buildCloseVoicing(rootPc, quality, inversion, baseMidi) {
  baseMidi = baseMidi != null ? baseMidi : 60;
  const pcs  = CHORD_INTERVALS[quality].map(iv => (rootPc + iv) % 12);
  const degs = getChordDegreeLabelsP(quality);
  for (let i = 0; i < inversion; i++) { pcs.push(pcs.shift()); degs.push(degs.shift()); }

  const notes = [];
  let cursor = baseMidi - 1;
  for (let i = 0; i < pcs.length; i++) {
    const midi = pcToMidiAtOrAfter(pcs[i], cursor + 1);
    notes.push({ midi, degree: degs[i] });
    cursor = midi;
  }
  return notes;
}

function buildOpenVoicing(rootPc, quality, inversion, baseMidi) {
  const close = buildCloseVoicing(rootPc, quality, inversion, baseMidi);
  if (close.length === 3) {
    // Spread triad: bottom stays, middle and top move up an octave
    const out = [
      close[0],
      { midi: close[1].midi + 12, degree: close[1].degree },
      { midi: close[2].midi + 12, degree: close[2].degree },
    ];
    return out.sort((a, b) => a.midi - b.midi);
  }
  if (close.length === 4) {
    // Drop-2: move the 2nd-from-top note down an octave
    const out = [
      { midi: close[2].midi - 12, degree: close[2].degree },
      close[0], close[1], close[3],
    ];
    return out.sort((a, b) => a.midi - b.midi);
  }
  return close;
}

function buildSplitVoicing(rootPc, quality, inversion, baseMidi) {
  // Left hand: root + 5th (or tritone sub for dim/m7b5) one octave below
  // Right hand: upper-structure close voicing
  baseMidi = baseMidi != null ? baseMidi : 60;
  const rhBase = baseMidi + 4;
  const lhRootMidi = pcToMidiAtOrAfter(rootPc, baseMidi - 24);
  const fifthIv = (quality === "dim" || quality === "dim7" || quality === "m7b5") ? 6 : 7;
  const fifthMidi = pcToMidiAtOrAfter((rootPc + fifthIv) % 12, lhRootMidi + 1);
  const lh = [
    { midi: lhRootMidi, degree: "1" },
    { midi: fifthMidi,  degree: fifthIv === 6 ? "♭5" : "5" },
  ];
  // Right hand: chord above middle C, use inversion as-is
  const rh = buildCloseVoicing(rootPc, quality, inversion, rhBase);
  return [...lh, ...rh].sort((a, b) => a.midi - b.midi);
}

function buildVoicing(rootPc, quality, inversion, style, baseMidi) {
  if (style === "open")  return buildOpenVoicing(rootPc, quality, inversion, baseMidi);
  if (style === "split") return buildSplitVoicing(rootPc, quality, inversion, baseMidi);
  return buildCloseVoicing(rootPc, quality, inversion, baseMidi);
}

function rangeForVoicing(style) {
  if (style === "split") return [36, 84];  // C2–C6
  if (style === "open")  return [48, 84];  // C3–C6
  return [48, 72];                          // C3–C5
}

// ── Diatonic chord patterns for a given tonic ──────────────────────
function getDiatonicChordsP(rootPc, family) {
  const majTriads = [
    { roman: "I",    q: "major", i: 0 },
    { roman: "ii",   q: "minor", i: 2 },
    { roman: "iii",  q: "minor", i: 4 },
    { roman: "IV",   q: "major", i: 5 },
    { roman: "V",    q: "major", i: 7 },
    { roman: "vi",   q: "minor", i: 9 },
    { roman: "vii°", q: "dim",   i: 11 },
  ];
  const majSevenths = [
    { roman: "Imaj7",  q: "maj7", i: 0 },
    { roman: "ii7",    q: "min7", i: 2 },
    { roman: "iii7",   q: "min7", i: 4 },
    { roman: "IVmaj7", q: "maj7", i: 5 },
    { roman: "V7",     q: "dom7", i: 7 },
    { roman: "vi7",    q: "min7", i: 9 },
    { roman: "viiø7",  q: "m7b5", i: 11 },
  ];
  const src = family === "7th" ? majSevenths : majTriads;
  return src.map(c => ({
    roman: c.roman,
    rootPc: (rootPc + c.i) % 12,
    quality: c.q,
    name: noteName((rootPc + c.i) % 12) + CHORD_SYMBOL[c.q],
  }));
}

// ── Render ──────────────────────────────────────────────────────────
function renderPianoVoicings() {
  if (!document.getElementById("voicings-controls")) return;

  const st = pianoVoicingState;
  // Normalize quality against active family
  if (!FAMILY_QUALITIES_P[st.family].includes(st.quality)) {
    st.quality = FAMILY_QUALITIES_P[st.family][0];
    st.inversion = 0;
  }
  const rootPc = noteIndex(st.root);
  const numTones = CHORD_INTERVALS[st.quality].length;
  if (st.inversion >= numTones) st.inversion = 0;

  // ── Controls ──
  let controls = "";
  controls += `<div class="control-group">
    <span class="control-label">Root</span>
    <div class="control-options">
      ${ROOT_LABELS.map(r => `<button class="control-btn ${st.root === r.key ? "active" : ""}" data-pv="root" data-val="${r.key}">${r.label}</button>`).join("")}
    </div>
  </div>`;

  controls += `<div class="control-group">
    <span class="control-label">Family</span>
    <div class="control-options">
      <button class="control-btn ${st.family === "triad" ? "active" : ""}" data-pv="family" data-val="triad">Triad</button>
      <button class="control-btn ${st.family === "7th" ? "active" : ""}" data-pv="family" data-val="7th">7th</button>
    </div>
  </div>`;

  controls += `<div class="control-group">
    <span class="control-label">Quality</span>
    <div class="control-options">
      ${FAMILY_QUALITIES_P[st.family].map(q => `<button class="control-btn ${st.quality === q ? "active" : ""}" data-pv="quality" data-val="${q}">${QUALITY_DISPLAY_P[q]}</button>`).join("")}
    </div>
  </div>`;

  controls += `<div class="control-group">
    <span class="control-label">Inversion</span>
    <div class="control-options">
      ${INVERSIONS_P[st.family].map((lbl, i) => `<button class="control-btn ${st.inversion === i ? "active" : ""}" data-pv="inversion" data-val="${i}">${lbl.split(" ")[0]}</button>`).join("")}
    </div>
  </div>`;

  controls += `<div class="control-group">
    <span class="control-label">Voicing</span>
    <div class="control-options">
      <button class="control-btn ${st.voicing === "close" ? "active" : ""}" data-pv="voicing" data-val="close">Close</button>
      <button class="control-btn ${st.voicing === "open"  ? "active" : ""}" data-pv="voicing" data-val="open">Open</button>
      <button class="control-btn ${st.voicing === "split" ? "active" : ""}" data-pv="voicing" data-val="split">Two-hand</button>
    </div>
  </div>`;

  document.getElementById("voicings-controls").innerHTML = controls;

  // ── Main voicing ──
  // For close voicings, start the chord at the lowest visible key so high
  // roots (e.g. B major close = B4/D♯5/F♯5) don't run off the right edge.
  // Open and split voicings drop/split notes downward and need headroom, so
  // leave them at the middle-C default baked into buildVoicing.
  const [rs, re] = rangeForVoicing(st.voicing);
  const voicingBase = st.voicing === "close" ? rs : undefined;
  const notes = buildVoicing(rootPc, st.quality, st.inversion, st.voicing, voicingBase);
  const chordName = `${st.root}${CHORD_SYMBOL[st.quality]}`;
  const inversionLbl = INVERSIONS_P[st.family][st.inversion];
  const noteSequence = notes.map(n => noteName(n.midi % 12)).join(" ");
  const degreeSequence = notes.map(n => n.degree).join(" ");

  document.getElementById("voicings-main").innerHTML = `
    <div class="main-panel">
      <div class="main-title">
        <span class="chord-name">${chordName}</span>
        <span class="inv-tag">${inversionLbl}</span>
        <span class="inv-tag">${st.voicing === "close" ? "Close" : st.voicing === "open" ? "Open" : "Two-hand split"}</span>
        <span class="inv-tag">${degreeSequence} / <strong>${noteSequence}</strong></span>
      </div>
      <div class="keyboard-scroll">
        ${renderKeyboardSVG({
          startMidi: rs, endMidi: re,
          chordNotes: notes,
          rootPc,
          labelMode: "degree",
        })}
      </div>
    </div>
  `;

  // ── Pattern cards: diatonic chords in the current key ──
  document.getElementById("voicings-info").innerHTML = `
    <span class="patterns-label">Diatonic chords (${st.family === "7th" ? "7ths" : "triads"}) in ${st.root} major</span>
  `;

  const diatonic = getDiatonicChordsP(rootPc, st.family);
  let cards = "";
  for (const d of diatonic) {
    const dNotes = buildCloseVoicing(d.rootPc, d.quality, 0, 48);
    cards += `<div class="pattern-card">
      <div class="pattern-name">${d.roman} — ${d.name}</div>
      <div class="pattern-desc">${CHORD_SYMBOL[d.quality] || "major triad"}</div>
      ${renderKeyboardSVG({
        startMidi: 48, endMidi: 72,
        chordNotes: dNotes,
        rootPc: d.rootPc,
        labelMode: "degree",
        compact: true,
      })}
    </div>`;
  }
  document.getElementById("voicings-patterns").innerHTML = cards;

  // ── Events ──
  document.querySelectorAll("[data-pv]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.pv;
      const raw = btn.dataset.val;
      if (key === "inversion") pianoVoicingState.inversion = parseInt(raw);
      else pianoVoicingState[key] = raw;
      if (key === "family") {
        pianoVoicingState.quality = FAMILY_QUALITIES_P[raw][0];
        pianoVoicingState.inversion = 0;
      }
      renderPianoVoicings();
    };
  });
}

renderPianoVoicings();
