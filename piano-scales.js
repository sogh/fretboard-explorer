// ── Piano Scales & Modes ────────────────────────────────────────────
// Requires theory.js + keyboard.js.

const pianoScaleState = {
  root: "C",
  scale: "ionian",
  labelMode: "degree",  // "degree" | "note"
  octaves: 3,            // 2 | 3 | 4
};

function renderPianoScales() {
  if (!document.getElementById("scales-controls")) return;

  const rootPc = noteIndex(pianoScaleState.root);
  const def = SCALES[pianoScaleState.scale];
  const scalePcs = def.steps.map(s => (rootPc + s) % 12);
  const noteNameMap = spellScale(pianoScaleState.root, def.steps);
  const rootDisplay = noteNameMap ? noteNameMap[rootPc] : pianoScaleState.root;

  // ── Controls ──
  let controls = "";
  controls += `<div class="control-group">
    <span class="control-label">Root</span>
    <div class="control-options">
      ${ROOT_LABELS.map(r => `<button class="control-btn ${pianoScaleState.root === r.key ? "active" : ""}" data-ps="root" data-val="${r.key}">${r.label}</button>`).join("")}
    </div>
  </div>`;

  for (const grp of SCALE_GROUPS) {
    controls += `<div class="control-group">
      <span class="control-label">${grp.label}</span>
      <div class="control-options">
        ${grp.keys.map(k => `<button class="control-btn ${pianoScaleState.scale === k ? "active" : ""}" data-ps="scale" data-val="${k}">${SCALES[k].name}</button>`).join("")}
      </div>
    </div>`;
  }

  controls += `<div class="control-group">
    <span class="control-label">Labels</span>
    <div class="control-options">
      <button class="control-btn ${pianoScaleState.labelMode === "degree" ? "active" : ""}" data-ps="labelMode" data-val="degree">Degrees</button>
      <button class="control-btn ${pianoScaleState.labelMode === "note" ? "active" : ""}" data-ps="labelMode" data-val="note">Notes</button>
    </div>
  </div>`;

  controls += `<div class="control-group">
    <span class="control-label">Octaves</span>
    <div class="control-options">
      ${[2, 3, 4].map(n => `<button class="control-btn ${pianoScaleState.octaves === n ? "active" : ""}" data-ps="octaves" data-val="${n}">${n}</button>`).join("")}
    </div>
  </div>`;

  document.getElementById("scales-controls").innerHTML = controls;

  // ── W-H bracket ──
  const stepLabels = [];
  for (let i = 0; i < def.steps.length; i++) {
    const cur = def.steps[i];
    const next = i + 1 < def.steps.length ? def.steps[i + 1] : 12;
    const d = next - cur;
    stepLabels.push(d === 1 ? "H" : d === 2 ? "W" : d === 3 ? "m3" : `+${d}`);
  }

  // ── Main keyboard ──
  const startMidi = 48; // C3
  const endMidi = 48 + pianoScaleState.octaves * 12; // C3 + N octaves
  const degreeMap = {};
  def.steps.forEach((s, i) => { degreeMap[(rootPc + s) % 12] = def.degrees[i]; });

  let mainTitle = `<span class="chord-name">${rootDisplay} ${def.name}</span>`;
  mainTitle += `<span class="formula-tag">${def.formula}</span>`;
  mainTitle += `<span class="inv-tag">${def.steps.length} notes</span>`;

  const scaleTones = scalePcs.map((pc, i) => `
    <span class="scale-tone">
      <span class="scale-tone-deg">${def.degrees[i]}</span>
      <span class="scale-tone-note">${spellNote(pc, noteNameMap)}</span>
    </span>`).join("");

  const stepBracket = `<div class="step-bracket">${stepLabels.map(s => `<span>${s}</span>`).join("")}</div>`;

  document.getElementById("scales-main").innerHTML = `
    <div class="main-panel">
      <div class="main-title">${mainTitle}</div>
      <div class="scale-tones">${scaleTones}</div>
      ${stepBracket}
      <div class="keyboard-scroll">
        ${renderKeyboardSVG({
          startMidi, endMidi,
          scalePcs, rootPc,
          labelMode: pianoScaleState.labelMode,
          degreeMap, noteNameMap,
        })}
      </div>
    </div>
  `;

  // ── One-octave cards per octave in range, plus a "neighbors" comparison ──
  document.getElementById("scales-info").innerHTML =
    `<span class="patterns-label">Per-octave views &amp; neighbor modes</span>`;

  let cards = "";
  for (let o = 0; o < pianoScaleState.octaves; o++) {
    const s = 48 + o * 12;
    const e = s + 12;
    cards += `<div class="pattern-card">
      <div class="pattern-name">Octave ${3 + o}</div>
      <div class="pattern-desc">C${3 + o} – C${4 + o}</div>
      ${renderKeyboardSVG({
        startMidi: s, endMidi: e,
        scalePcs, rootPc,
        labelMode: pianoScaleState.labelMode,
        degreeMap, noteNameMap, compact: true,
      })}
    </div>`;
  }

  // Neighbor comparison cards (show how related modes differ by one or two notes)
  const neighbors = getNeighborScales(pianoScaleState.scale);
  for (const nb of neighbors) {
    const nbDef = SCALES[nb.key];
    const nbPcs = nbDef.steps.map(s => (rootPc + s) % 12);
    const nbDegreeMap = {};
    nbDef.steps.forEach((s, i) => { nbDegreeMap[(rootPc + s) % 12] = nbDef.degrees[i]; });
    const nbNoteMap = spellScale(pianoScaleState.root, nbDef.steps);
    const nbRootDisplay = nbNoteMap ? nbNoteMap[rootPc] : pianoScaleState.root;
    cards += `<div class="pattern-card">
      <div class="pattern-name">${nbRootDisplay} ${nbDef.name}</div>
      <div class="pattern-desc">${nb.desc}</div>
      ${renderKeyboardSVG({
        startMidi: 48, endMidi: 60,
        scalePcs: nbPcs, rootPc,
        labelMode: pianoScaleState.labelMode,
        degreeMap: nbDegreeMap, noteNameMap: nbNoteMap, compact: true,
      })}
    </div>`;
  }

  document.getElementById("scales-positions").innerHTML = cards;

  // ── Events ──
  document.querySelectorAll("[data-ps]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.ps;
      const raw = btn.dataset.val;
      pianoScaleState[key] = key === "octaves" ? parseInt(raw) : raw;
      renderPianoScales();
    };
  });
}

// Suggest related scales for comparison: "only one note differs"
function getNeighborScales(scaleKey) {
  const modeOrder = ["ionian","dorian","phrygian","lydian","mixolydian","aeolian","locrian"];
  const idx = modeOrder.indexOf(scaleKey);
  const out = [];
  if (idx >= 0) {
    out.push({ key: modeOrder[(idx + 6) % 7], desc: "Adjacent mode (brighter)" });
    out.push({ key: modeOrder[(idx + 1) % 7], desc: "Adjacent mode (darker)" });
  } else if (scaleKey === "majorPent") {
    out.push({ key: "minorPent", desc: "Relative minor pentatonic" });
    out.push({ key: "blues",     desc: "Add ♭5 for blues" });
  } else if (scaleKey === "minorPent") {
    out.push({ key: "majorPent", desc: "Relative major pentatonic" });
    out.push({ key: "blues",     desc: "Add ♭5 for blues" });
  } else if (scaleKey === "blues") {
    out.push({ key: "minorPent", desc: "Without the ♭5" });
  } else if (scaleKey === "harmMin") {
    out.push({ key: "aeolian", desc: "Natural minor (♭7 instead of 7)" });
    out.push({ key: "melMin",  desc: "Melodic minor (add ♮6)" });
  } else if (scaleKey === "melMin") {
    out.push({ key: "harmMin", desc: "Harmonic minor (♭6)" });
    out.push({ key: "ionian",  desc: "Major scale (♮3)" });
  }
  return out;
}

renderPianoScales();
