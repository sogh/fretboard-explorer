// ── Practice Sequencer (Phase 2 — Timeline UI, chord step only) ────
// Depends on: theory.js, instruments.js, triad-explorer.js (findVoicingOnStrings,
// computeFretRange, renderFretboardSVG, getTriadDegreeLabels), sequence-model.js.

const SEQ_STORAGE_KEY = "fretboard-explorer-sequence";

// ── Sequencer state (global) ───────────────────────────────────────
const seqState = {
  sequence: createSequence({ name: "My practice sequence" }),
  playback: { isPlaying: false, currentStepIndex: -1, tempo: 80, loop: false },
  editingStepIndex: -1,   // -1 = none; >= 0 = open chord editor for that step
};

// ── Persistence ────────────────────────────────────────────────────
function saveSequence() {
  try {
    localStorage.setItem(SEQ_STORAGE_KEY, sequenceToJSON(seqState.sequence));
  } catch (_) { /* quota exceeded — silent */ }
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
  } catch (_) { /* corrupted — start fresh */ }
}

// ── Chord voicing helper ───────────────────────────────────────────
// Compute a voicing for a chord step using the existing triad finder.
// Returns positions array or empty array if nothing fits.
function voicingForChordStep(step) {
  const quality = step.quality;
  const is7th = (CHORD_INTERVALS[quality] || []).length === 4;
  const inst = getInstrument();
  const groups = is7th ? inst.seventhGroups : inst.triadGroups;
  // Try the step's stored stringGroup first, then fall back to each group.
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

// ── Add chord step ─────────────────────────────────────────────────
function addChordStepToSequence(root, quality) {
  const step = chordStep({ root, quality });
  const voicing = voicingForChordStep(step);
  step.voicing = voicing;
  seqState.sequence.steps.push(step);
  saveSequence();
  renderSequencerPage();
}

// ── Drag-and-drop state ────────────────────────────────────────────
let dragSrcIndex = null;

// ── Render ─────────────────────────────────────────────────────────
function renderSequencerPage() {
  const seq = seqState.sequence;
  const steps = seq.steps;

  // Controls: sequence name + tempo
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
    <div class="control-group" style="justify-content:flex-end">
      <button class="print-btn" id="seq-clear-btn">Clear all</button>
    </div>
  `;
  document.getElementById("seq-controls").innerHTML = controls;

  // Timeline
  let timeline = "";
  steps.forEach((step, i) => {
    const isEditing = seqState.editingStepIndex === i;
    timeline += renderStepCard(step, i, isEditing);
  });

  // Add button
  timeline += `<div class="seq-add-card" id="seq-add-btn" title="Add a step">
    <div class="seq-add-icon">+</div>
    <div class="seq-add-label">Add step</div>
  </div>`;

  document.getElementById("seq-timeline").innerHTML = timeline;

  // Step editor (if editing)
  const editorEl = document.getElementById("seq-editor");
  if (seqState.editingStepIndex >= 0 && seqState.editingStepIndex < steps.length) {
    editorEl.innerHTML = renderStepEditor(steps[seqState.editingStepIndex], seqState.editingStepIndex);
    editorEl.hidden = false;
  } else {
    editorEl.innerHTML = "";
    editorEl.hidden = true;
  }

  // Step-kind picker modal
  // (rendered once, toggled via class)

  attachSequencerEvents();
}

function escAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderStepCard(step, index, isEditing) {
  let inner = "";
  const kindLabel = step.kind === "chord" ? `${step.root} ${step.quality}` :
                    step.kind === "lead_line" ? "Lead Line" :
                    step.kind === "pattern" ? "Pattern" : "Rest";
  const kindClass = `seq-step-${step.kind}`;

  if (step.kind === "chord") {
    // Render compact fretboard if voicing exists
    const positions = step.voicing && step.voicing.positions && step.voicing.positions.length
      ? step.voicing.positions : null;
    if (positions) {
      const range = computeFretRange(positions, 7);
      inner = renderFretboardSVG(positions, null, range, true, null, null);
    } else {
      inner = `<div class="seq-step-empty">No voicing</div>`;
    }
  } else if (step.kind === "rest") {
    inner = `<div class="seq-step-rest-icon">𝄾</div>`;
  }

  return `<div class="seq-step-card ${kindClass} ${isEditing ? "seq-step-editing" : ""}"
               data-seq-idx="${index}" draggable="true">
    <div class="seq-step-head">
      <span class="seq-step-kind">${kindLabel}</span>
      <span class="seq-step-beats">${step.durationBeats}b</span>
      <button class="seq-step-delete" data-seq-del="${index}" title="Remove step">×</button>
    </div>
    <div class="seq-step-body">${inner}</div>
  </div>`;
}

function renderStepEditor(step, index) {
  if (step.kind !== "chord") return "";

  const inst = getInstrument();
  const is7th = (CHORD_INTERVALS[step.quality] || []).length === 4;
  const qualities = is7th
    ? ["maj7", "dom7", "min7", "mM7", "dim7", "m7b5"]
    : ["major", "minor", "dim", "aug", "sus2", "sus4"];
  const allQualities = [...new Set([...["major", "minor", "dim", "aug", "sus2", "sus4"], ...["maj7", "dom7", "min7", "mM7", "dim7", "m7b5"]])];

  const articulations = [
    { key: "strum_down", label: "Strum ↓" },
    { key: "strum_up", label: "Strum ↑" },
    { key: "block", label: "Block" },
    { key: "arpeggiate_up", label: "Arp ↑" },
    { key: "arpeggiate_down", label: "Arp ↓" },
  ];

  let html = `<div class="seq-editor-panel">
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
  return html;
}

// ── Step-kind picker modal ─────────────────────────────────────────
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
  if (addBtn) {
    addBtn.onclick = () => showStepPicker();
  }

  // Step-kind picker buttons
  document.querySelectorAll("[data-seq-pick]").forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.seqPick;
      if (kind === "chord") {
        addChordStepToSequence("G", "major");
        seqState.editingStepIndex = seqState.sequence.steps.length - 1;
      } else if (kind === "rest") {
        seqState.sequence.steps.push(restStep({ durationBeats: 2 }));
        saveSequence();
      }
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

  // Editor controls
  document.querySelectorAll("[data-seq-edit]").forEach(btn => {
    btn.onclick = () => {
      const idx = seqState.editingStepIndex;
      if (idx < 0) return;
      const step = seqState.sequence.steps[idx];
      const key = btn.dataset.seqEdit;
      const val = btn.dataset.val;
      if (key === "durationBeats") {
        step.durationBeats = parseInt(val);
      } else {
        step[key] = val;
      }
      // Recompute voicing when root/quality changes
      if (key === "root" || key === "quality") {
        step.voicing = voicingForChordStep(step);
      }
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
    card.ondragleave = () => {
      card.classList.remove("seq-drag-over");
    };
    card.ondrop = (ev) => {
      ev.preventDefault();
      card.classList.remove("seq-drag-over");
      const from = parseInt(ev.dataTransfer.getData("text/plain"));
      const to = parseInt(card.dataset.seqIdx);
      if (from === to || isNaN(from) || isNaN(to)) return;
      const steps = seqState.sequence.steps;
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      // Update editing index to follow the moved step
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
