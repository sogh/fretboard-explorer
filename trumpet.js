// ── Trumpet Scales & Modes page ─────────────────────────────────────
// Requires theory.js + fingering.js.
//
// The B♭ trumpet is a transposing instrument: what the player reads on the
// staff sounds a whole step lower as concert pitch. A player reading "written
// C" hears "concert B♭". This page lets the user pick a concert key (matching
// the Guitar/Piano pages) and then optionally flip the label view to what the
// trumpet player would actually read.

const TRUMPET_TRANSPOSE_SEMITONES = 2; // written = concert + 2

const trumpetState = {
  root: "C",
  scale: "ionian",
  view: "concert",  // "concert" | "written"
};

// Written pitch class for a given concert pitch class (B♭ trumpet).
function writtenPc(concertPc) {
  return (concertPc + TRUMPET_TRANSPOSE_SEMITONES) % 12;
}

function renderTrumpetScales() {
  if (!document.getElementById("scales-controls")) return;

  const concertRootPc = noteIndex(trumpetState.root);
  const def = SCALES[trumpetState.scale];
  const concertScalePcs = def.steps.map(s => (concertRootPc + s) % 12);
  const writtenRootPc = writtenPc(concertRootPc);

  // Pick the spelling map based on whether we're labelling notes in concert
  // or written pitch — each view deserves its own enharmonic choice (e.g. G
  // Dorian concert = A Dorian written, and those may resolve differently).
  const isWritten = trumpetState.view === "written";
  const spellingRootName = isWritten ? noteName(writtenRootPc) : trumpetState.root;
  const spellingRootPc = isWritten ? writtenRootPc : concertRootPc;
  const noteNameMap = spellScale(spellingRootName, def.steps);
  const rootDisplay = noteNameMap ? noteNameMap[spellingRootPc] : spellingRootName;

  // Note-name getter used by all labels on the page. Takes a CONCERT pc and
  // returns the label for the current view.
  function labelFor(concertPc) {
    const pc = isWritten ? writtenPc(concertPc) : concertPc;
    return spellNote(pc, noteNameMap);
  }

  // ── Controls ──
  let controls = "";
  controls += `<div class="control-group">
    <span class="control-label">Root (concert)</span>
    <div class="control-options">
      ${ROOT_LABELS.map(r => `<button class="control-btn ${trumpetState.root === r.key ? "active" : ""}" data-tp="root" data-val="${r.key}">${r.label}</button>`).join("")}
    </div>
  </div>`;

  for (const grp of SCALE_GROUPS) {
    controls += `<div class="control-group">
      <span class="control-label">${grp.label}</span>
      <div class="control-options">
        ${grp.keys.map(k => `<button class="control-btn ${trumpetState.scale === k ? "active" : ""}" data-tp="scale" data-val="${k}">${SCALES[k].name}</button>`).join("")}
      </div>
    </div>`;
  }

  controls += `<div class="control-group">
    <span class="control-label">Pitch view</span>
    <div class="control-options">
      <button class="control-btn ${trumpetState.view === "concert" ? "active" : ""}" data-tp="view" data-val="concert" title="Sounding pitch — matches Guitar and Piano pages">Concert</button>
      <button class="control-btn ${trumpetState.view === "written" ? "active" : ""}" data-tp="view" data-val="written" title="Trumpet-read pitch — one whole step above concert">Written (B♭)</button>
    </div>
  </div>`;

  document.getElementById("scales-controls").innerHTML = controls;

  // ── Main title + scale tone strip ──
  const viewTag = isWritten
    ? `<span class="inv-tag" title="Written pitch — the trumpet sounds a whole step lower">Written</span>`
    : `<span class="inv-tag" title="Concert (sounding) pitch">Concert</span>`;
  const mainTitle =
    `<span class="chord-name">${rootDisplay} ${def.name}</span>` +
    `<span class="formula-tag">${def.formula}</span>` +
    `<span class="inv-tag">${def.steps.length} notes</span>` +
    viewTag;

  const scaleTones = concertScalePcs.map((pc, i) => `
    <span class="scale-tone">
      <span class="scale-tone-deg">${def.degrees[i]}</span>
      <span class="scale-tone-note">${labelFor(pc)}</span>
    </span>`).join("");

  // Helper text explaining the transposition when in concert view — useful
  // for beginners who don't know why the fingerings don't match the letter.
  const transposeNote = isWritten
    ? `Trumpet reads these notes directly. Fingerings shown are for what you read.`
    : `A B♭ trumpet sounds one whole step lower than written. Fingerings below correspond to the <strong>written</strong> pitch (concert + 2 semitones).`;

  document.getElementById("scales-main").innerHTML = `
    <div class="main-panel">
      <div class="main-title">${mainTitle}</div>
      <div class="scale-tones">${scaleTones}</div>
      <div class="transpose-hint">${transposeNote}</div>
    </div>
  `;

  // ── Fingering cards — one per scale tone ──
  document.getElementById("scales-info").innerHTML =
    `<span class="patterns-label">Fingerings for each scale tone</span>`;

  let cards = "";
  for (let i = 0; i < concertScalePcs.length; i++) {
    const concertPc = concertScalePcs[i];
    const readPc = writtenPc(concertPc);
    const fingering = TRUMPET_FINGERINGS[readPc];
    // Show both the read label (what the player sees) and the concert label
    // (what the audience hears) on each card so the translation is explicit.
    const readLabel    = isWritten ? labelFor(concertPc) : spellNote(readPc, null);
    const concertLabel = isWritten ? spellNote(concertPc, null) : labelFor(concertPc);
    cards += `<div class="pattern-card trumpet-card">
      <div class="trumpet-card-head">
        <span class="scale-tone-deg">${def.degrees[i]}</span>
        <span class="trumpet-read">${readLabel}</span>
      </div>
      ${renderFingeringSVG(fingering)}
      <div class="trumpet-card-foot">
        <span class="trumpet-read-desc">reads ${readLabel}</span>
        <span class="trumpet-sounds">sounds ${concertLabel}</span>
      </div>
    </div>`;
  }
  document.getElementById("scales-positions").innerHTML = cards;

  // ── Events ──
  document.querySelectorAll("[data-tp]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.tp;
      const val = btn.dataset.val;
      trumpetState[key] = val;
      renderTrumpetScales();
    };
  });
}

renderTrumpetScales();
