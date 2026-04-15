// ── Chord Voicing Explorer ──────────────────────────────────────────
// A shared modal that opens when the user clicks any chord spelling
// (.chord-link) on any fretboard page. Shows every voicing of that
// chord on the currently selected fretted instrument — every string
// group × every inversion — so the user can dive into fingerings and
// then pop back to where they were without losing any page state.
//
// A clickable chord tag must carry three data attributes:
//   data-chord-root    — root pitch class (0..11)
//   data-chord-quality — CHORD_INTERVALS key ("major", "min7", …)
//   data-chord-name    — display spelling shown in the modal title
//
// Depends on: theory.js (CHORD_INTERVALS, NOTES, noteName, spellNote),
// instruments.js (getInstrument), triad-explorer.js (findVoicingOnStrings,
// computeFretRange, renderFretboardSVG, getTriadDegreeLabels).

// Sharp- and flat-preferring pitch-class names. We pick between them per
// chord based on the accidental in the display name — "E♭m7" stays flat,
// "F♯m7" stays sharp — so the notes list in the modal matches the chord
// letter the user clicked.
const CHORD_PC_SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const CHORD_PC_FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

// ── Movable shapes (6-string guitar only) ───────────────────────────
// Classic CAGED-derived shapes with root on low-E (E shape), A string
// (A shape), or D string (D shape). Each shape applied to a chord root
// gives one distinct voicing; when the root lands on an open string it
// appears as a cowboy/open chord, otherwise it's a barre chord.
//
// Fields (offsets/degrees are indexed string 0..5 = high E..low E):
//   rootStr — string carrying the root note
//   offsets — fret offset from the root fret; -1 means muted
//   degrees — chord-degree label per string (empty for muted)
//   barreStrings — [topStringIdx, bottomStringIdx] inclusive range for
//                  the first-finger barre (used to draw the bar).
const GUITAR_MOVABLE_SHAPES = {
  major: [
    { name: "E shape", rootStr: 5, offsets: [0, 0, 1, 2, 2, 0], degrees: ["1","5","3","1","5","1"], barreStrings: [0, 5] },
    { name: "A shape", rootStr: 4, offsets: [0, 2, 2, 2, 0, -1], degrees: ["5","3","1","5","1",""],  barreStrings: [0, 4] },
    { name: "D shape", rootStr: 3, offsets: [2, 3, 2, 0, -1, -1], degrees: ["3","1","5","1","",""],  barreStrings: null },
  ],
  minor: [
    { name: "Em shape", rootStr: 5, offsets: [0, 0, 0, 2, 2, 0], degrees: ["1","5","♭3","1","5","1"], barreStrings: [0, 5] },
    { name: "Am shape", rootStr: 4, offsets: [0, 1, 2, 2, 0, -1], degrees: ["5","♭3","1","5","1",""], barreStrings: [0, 4] },
    { name: "Dm shape", rootStr: 3, offsets: [1, 3, 2, 0, -1, -1], degrees: ["♭3","1","5","1","",""], barreStrings: null },
  ],
  dom7: [
    { name: "E7 shape", rootStr: 5, offsets: [0, 0, 1, 0, 2, 0], degrees: ["1","5","3","♭7","5","1"], barreStrings: [0, 5] },
    { name: "A7 shape", rootStr: 4, offsets: [0, 2, 0, 2, 0, -1], degrees: ["5","3","♭7","5","1",""], barreStrings: [0, 4] },
    { name: "D7 shape", rootStr: 3, offsets: [2, 1, 2, 0, -1, -1], degrees: ["3","♭7","5","1","",""], barreStrings: null },
  ],
  maj7: [
    { name: "Emaj7 shape", rootStr: 5, offsets: [0, 0, 1, 1, 2, 0], degrees: ["1","5","3","7","5","1"], barreStrings: [0, 5] },
    { name: "Amaj7 shape", rootStr: 4, offsets: [0, 2, 1, 2, 0, -1], degrees: ["5","3","7","5","1",""], barreStrings: [0, 4] },
    { name: "Dmaj7 shape", rootStr: 3, offsets: [2, 2, 2, 0, -1, -1], degrees: ["3","7","5","1","",""], barreStrings: null },
  ],
  min7: [
    { name: "Em7 shape", rootStr: 5, offsets: [0, 0, 0, 0, 2, 0], degrees: ["1","5","♭3","♭7","5","1"], barreStrings: [0, 5] },
    { name: "Am7 shape", rootStr: 4, offsets: [0, 1, 0, 2, 0, -1], degrees: ["5","♭3","♭7","5","1",""], barreStrings: [0, 4] },
    { name: "Dm7 shape", rootStr: 3, offsets: [1, 1, 2, 0, -1, -1], degrees: ["♭3","♭7","5","1","",""], barreStrings: null },
  ],
};

// Open-position chords that don't belong to the E/A/D movable family —
// specifically the CAGED C shape and G shape, which only really work
// played at the nut. Indexed by `${rootPc}_${quality}` and only shown
// when the user explores those exact chords.
const GUITAR_OPEN_CHORDS = {
  // C family (rootPc = 0)
  "0_major": { name: "Open C",     frets: [0, 1, 0, 2, 3, -1], degrees: ["3","1","5","3","1",""] },
  "0_dom7":  { name: "Open C7",    frets: [0, 1, 3, 2, 3, -1], degrees: ["3","1","♭7","3","1",""] },
  "0_maj7":  { name: "Open Cmaj7", frets: [0, 0, 0, 2, 3, -1], degrees: ["3","7","5","3","1",""] },
  // G family (rootPc = 7)
  "7_major": { name: "Open G",     frets: [3, 0, 0, 0, 2, 3], degrees: ["1","3","1","5","3","1"] },
  "7_dom7":  { name: "Open G7",    frets: [1, 0, 0, 0, 2, 3], degrees: ["♭7","3","1","5","3","1"] },
  "7_maj7":  { name: "Open Gmaj7", frets: [2, 0, 0, 0, 2, 3], degrees: ["7","3","1","5","3","1"] },
};

// Instrument must be standard 6-string guitar for the shape library to
// make sense. Other fretted instruments have their own shape vocabulary;
// we leave them for a future pass rather than guessing.
function usingStandardGuitar() {
  return currentInstrumentKey === "guitar" && getInstrument().tuning.length === 6;
}

// Apply a movable shape to a chord root. Returns null when the shape
// runs off the end of the neck or the root string doesn't exist on the
// active instrument.
function applyMovableShape(shape, rootPc) {
  const inst = getInstrument();
  const openPc = inst.tuning[shape.rootStr];
  if (openPc == null) return null;
  const rootFret = ((rootPc - openPc) % 12 + 12) % 12;
  const maxOff = Math.max(...shape.offsets.filter(o => o >= 0));
  if (rootFret + maxOff > inst.numFrets) return null;
  const positions = [];
  const muted = [];
  for (let s = 0; s < shape.offsets.length; s++) {
    const off = shape.offsets[s];
    if (off < 0) { muted.push(s); continue; }
    const fret = rootFret + off;
    const notePc = (inst.tuning[s] + fret) % 12;
    positions.push({ string: s, fret, note: noteName(notePc), degree: shape.degrees[s] });
  }
  return { positions, muted, rootFret, shape };
}

// A fixed open-chord voicing (C/G family) as concrete positions.
function buildOpenChord(def) {
  const inst = getInstrument();
  const positions = [];
  const muted = [];
  for (let s = 0; s < def.frets.length; s++) {
    const fret = def.frets[s];
    if (fret < 0) { muted.push(s); continue; }
    const notePc = (inst.tuning[s] + fret) % 12;
    positions.push({ string: s, fret, note: noteName(notePc), degree: def.degrees[s] });
  }
  return { positions, muted };
}

// Does the quality key belong to the triad family (3 notes) or the 7th
// family (4 notes)? Drives how many inversions and which string groups
// the modal iterates over.
function chordQualityIs7th(quality) {
  return (CHORD_INTERVALS[quality] || []).length === 4;
}

function spellChordPc(pc, useFlats) {
  const arr = useFlats ? CHORD_PC_FLAT : CHORD_PC_SHARP;
  return arr[((pc % 12) + 12) % 12];
}

// ── DOM: open / close ──────────────────────────────────────────────
// We cache nothing — the modal element is fetched fresh each call so the
// module is resilient if the host page rebuilds its DOM.
function chordExplorerEl() {
  return document.getElementById("chord-explorer");
}

function closeChordExplorer() {
  const el = chordExplorerEl();
  if (!el) return;
  el.classList.remove("open");
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "";
}

function openChordExplorer(opts) {
  const el = chordExplorerEl();
  if (!el || !opts) return;

  const rootPc = ((+opts.rootPc % 12) + 12) % 12;
  const quality = opts.quality;
  if (!CHORD_INTERVALS[quality]) return;

  const displayName = opts.displayName || (spellChordPc(rootPc, false) + (quality === "major" ? "" : quality));
  // Respect the accidental in the display name. A "♭" anywhere in the chord
  // letter means the caller already chose a flat-key spelling; we keep it.
  // Everything else (naturals, sharps, enharmonics) defaults to sharp.
  const useFlats = displayName.indexOf("♭") !== -1;

  el.innerHTML = renderChordExplorer(rootPc, quality, displayName, useFlats);
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");

  // Wire close affordances for this open instance.
  const closeBtn = el.querySelector(".chord-explorer-close");
  if (closeBtn) closeBtn.onclick = closeChordExplorer;
  el.onclick = (ev) => { if (ev.target === el) closeChordExplorer(); };
}

// ── Render ─────────────────────────────────────────────────────────
function renderChordExplorer(rootPc, quality, displayName, useFlats) {
  const inst = getInstrument();
  const is7th = chordQualityIs7th(quality);
  const stringGroups = is7th ? inst.seventhGroups : inst.triadGroups;
  const inversions = is7th
    ? ["Root position", "1st inversion", "2nd inversion", "3rd inversion"]
    : ["Root position", "1st inversion", "2nd inversion"];

  // Chord tones at root position — used for the notes strip in the header.
  // findVoicingOnStrings() consumes the NOTES[] sharp name for the root, so
  // we translate from pc once here.
  const rootSharpName = NOTES[rootPc];
  const intervals = CHORD_INTERVALS[quality] || [];
  const rootPosPcs = intervals.map(i => (rootPc + i) % 12);
  const rootPosLabels = getTriadDegreeLabels(quality, 0);
  const notesStrip = rootPosPcs.map((pc, i) =>
    `<span><strong style="color:var(--pattern-note)">${rootPosLabels[i]}</strong>&nbsp;${spellChordPc(pc, useFlats)}</span>`
  ).join('<span class="n-sep">·</span>');

  // Iterate every (string group × inversion) pair. Skip combos that don't
  // fit on the neck — findVoicingOnStrings returns null when the span is
  // too wide or the voicing runs off the top of the fretboard.
  let cards = "";
  for (const sg of stringGroups) {
    for (let inv = 0; inv < inversions.length; inv++) {
      const voicing = findVoicingOnStrings(rootSharpName, quality, inv, sg.idx);
      if (!voicing) continue;

      const range = computeFretRange(voicing, 7);
      const degrees = [...voicing].reverse().map(v => v.degree).join(" ");
      const notes   = [...voicing].reverse().map(v => spellChordPc(noteIndex(v.note), useFlats)).join(" ");
      cards += `<div class="voicing-card">
        <div class="voicing-head">
          <span class="voicing-inv">${inversions[inv]}</span>
          <span class="voicing-strings">${sg.label}</span>
        </div>
        ${renderFretboardSVG(voicing, null, range, true, null, null)}
        <div class="voicing-degrees"><strong>${degrees}</strong> &nbsp;·&nbsp; ${notes}</div>
      </div>`;
    }
  }

  const closedSection = cards
    ? `<div class="chord-explorer-section-title">Closed voicings <span class="section-sub">by string group × inversion</span></div>
       <div class="chord-explorer-grid">${cards}</div>`
    : `<div class="chord-explorer-empty">No closed voicings of <strong>${displayName}</strong> fit on the ${inst.name.toLowerCase()} neck.</div>`;

  // Shape cards: barre + open chord shapes (standard 6-string guitar only).
  const shapesSection = renderShapeSection(rootPc, quality, useFlats);

  return `<div class="chord-explorer-panel" role="document">
    <div class="chord-explorer-head">
      <div class="chord-explorer-title">${displayName}</div>
      <div class="chord-explorer-notes">${notesStrip}</div>
      <button class="chord-explorer-close" type="button" title="Close (Esc)">Close<span class="k">Esc</span></button>
    </div>
    <div class="chord-explorer-instrument">Voicings on <strong>${inst.name}</strong> · ${stringGroups.length} string group${stringGroups.length === 1 ? "" : "s"} × ${inversions.length} inversion${inversions.length === 1 ? "" : "s"}</div>
    ${closedSection}
    ${shapesSection}
  </div>`;
}

// Build the "Barre & open chord shapes" section. Returns an empty string
// when the current instrument isn't a standard 6-string guitar or when
// no shape is defined for this chord quality — those cases just hide
// the section rather than showing an awkward placeholder.
function renderShapeSection(rootPc, quality, useFlats) {
  if (!usingStandardGuitar()) return "";

  const cards = [];

  // Movable shapes (E, A, D family) — always produce a card when the shape
  // is defined for this quality and fits on the neck.
  const movable = GUITAR_MOVABLE_SHAPES[quality] || [];
  for (const shape of movable) {
    const applied = applyMovableShape(shape, rootPc);
    if (!applied) continue;
    const { positions, muted, rootFret } = applied;
    const range = computeFretRange(positions, 7);
    const posKind = rootFret === 0 ? "Open" : `Barre at ${rootFret}`;
    const barre = (rootFret > 0 && shape.barreStrings)
      ? { fret: rootFret, fromString: shape.barreStrings[0], toString: shape.barreStrings[1] }
      : null;
    cards.push(renderShapeCard(shape.name, posKind, positions, muted, range, barre, useFlats));
  }

  // Extra open chords (C, G shapes) when the chord's root matches.
  const openKey = `${rootPc}_${quality}`;
  if (GUITAR_OPEN_CHORDS[openKey]) {
    const def = GUITAR_OPEN_CHORDS[openKey];
    const { positions, muted } = buildOpenChord(def);
    const range = computeFretRange(positions, 7);
    cards.push(renderShapeCard(def.name, "Open", positions, muted, range, null, useFlats));
  }

  if (!cards.length) return "";
  return `<div class="chord-explorer-section-title">Barre & open shapes <span class="section-sub">guitar CAGED family</span></div>
    <div class="chord-explorer-grid">${cards.join("")}</div>`;
}

function renderShapeCard(name, posKind, positions, muted, range, barre, useFlats) {
  // Show degrees from low string to high, with muted strings marked "×".
  const perString = [];
  for (let s = getInstrument().tuning.length - 1; s >= 0; s--) {
    if (muted.includes(s)) { perString.push("×"); continue; }
    const p = positions.find(pp => pp.string === s);
    perString.push(p ? p.degree : "·");
  }
  const degrees = perString.join(" ");
  const notes = [...positions]
    .sort((a, b) => b.string - a.string)
    .map(p => spellChordPc(noteIndex(p.note), useFlats))
    .join(" ");
  return `<div class="voicing-card">
    <div class="voicing-head">
      <span class="voicing-inv">${name}</span>
      <span class="voicing-strings">${posKind}</span>
    </div>
    ${renderFretboardSVG(positions, null, range, true, null, null, { barre, muted })}
    <div class="voicing-degrees"><strong>${degrees}</strong> &nbsp;·&nbsp; ${notes}</div>
  </div>`;
}

// ── Global wiring ──────────────────────────────────────────────────
// One delegated click handler on document handles every .chord-link no
// matter which page rebuilt its DOM last. Esc closes the modal.
//
// Listen during the CAPTURE phase so we short-circuit any bubble-phase
// handlers on ancestor elements (e.g. the pattern-card's own onclick
// that toggles its selection). Without capture the ancestor handler
// fires first and we end up both opening the modal AND mutating the
// underlying page state — which is exactly what the user said they
// don't want.
document.addEventListener("click", (ev) => {
  const link = ev.target.closest && ev.target.closest(".chord-link");
  if (!link) return;
  ev.stopPropagation();
  ev.preventDefault();
  openChordExplorer({
    rootPc: link.dataset.chordRoot,
    quality: link.dataset.chordQuality,
    displayName: link.dataset.chordName || link.textContent.trim(),
  });
}, true);

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    const el = chordExplorerEl();
    if (el && el.classList.contains("open")) closeChordExplorer();
  }
});

// If the instrument picker is used while the modal is open, close it.
// The modal is baked against a specific instrument; reopening reflects
// the new choice cleanly without half-stale voicings.
document.addEventListener("click", (ev) => {
  const btn = ev.target.closest && ev.target.closest("#instrument-nav .nav-btn");
  if (btn) closeChordExplorer();
}, true);
