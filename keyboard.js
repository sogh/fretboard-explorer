// ── Piano keyboard renderer ─────────────────────────────────────────
// Shared SVG keyboard builder. Used by every piano page in piano.html.
// Requires theory.js (NOTES, noteName) to be loaded first.

const KB_WHITE_PCS  = new Set([0, 2, 4, 5, 7, 9, 11]);
const KB_IS_WHITE   = pc => KB_WHITE_PCS.has(pc);

// Default pitch-class → scale-degree fallback when no degreeMap is supplied.
const KB_DEFAULT_DEGREE_BY_INTERVAL = {
  0:"1", 1:"♭2", 2:"2", 3:"♭3", 4:"3", 5:"4",
  6:"♭5", 7:"5", 8:"♭6", 9:"6", 10:"♭7", 11:"7",
};

/**
 * Render an SVG piano keyboard.
 *
 * opts:
 *   startMidi / endMidi  — MIDI range (default C3–C6 = 48–84)
 *   scalePcs             — array of pitch classes to highlight as scale tones (orange)
 *   rootPc               — root pitch class (blue when highlighted)
 *   chordPcs             — array of pitch classes to highlight as chord tones (blue)
 *   chordNotes           — array of {midi, degree} for an explicit voicing (wins over pcs)
 *   labelMode            — "degree" | "note" | "none"
 *   degreeMap            — optional {pc: label} override for degree labels
 *   noteNameMap          — optional {pc: spelled-name} for enharmonic-aware note labels
 *   compact              — smaller dimensions (for pattern cards)
 *   showOctaveLabels     — C labels under each octave (default true)
 *   activeRegion         — [startMidi, endMidi] for a soft highlight band
 */
function renderKeyboardSVG(opts) {
  opts = opts || {};
  const startMidi = opts.startMidi != null ? opts.startMidi : 48;
  const endMidi   = opts.endMidi   != null ? opts.endMidi   : 84;
  const compact   = !!opts.compact;
  const labelMode = opts.labelMode || "degree";
  const scaleSet  = opts.scalePcs ? new Set(opts.scalePcs) : null;
  const chordSet  = opts.chordPcs ? new Set(opts.chordPcs) : null;
  const rootPc    = opts.rootPc != null ? opts.rootPc : null;
  const degreeMap = opts.degreeMap || null;
  const noteNameMap = opts.noteNameMap || null;
  const showOct   = opts.showOctaveLabels !== false;
  const activeRegion = opts.activeRegion || null;

  const voicing = new Map();
  if (opts.chordNotes) for (const n of opts.chordNotes) voicing.set(n.midi, n);

  const whiteW = compact ? 14 : 22;
  const whiteH = compact ? 60 : 92;
  const blackW = whiteW * 0.62;
  const blackH = whiteH * 0.62;

  // Walk the range and position white keys linearly; black keys sit between.
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

  const width  = whiteKeys.length * whiteW;
  const footer = showOct ? (compact ? 11 : 14) : 2;
  const height = whiteH + footer;

  function labelFor(pc) {
    if (labelMode === "none") return "";
    if (labelMode === "note") return spellNote(pc, noteNameMap);
    if (degreeMap && degreeMap[pc] != null) return degreeMap[pc];
    if (rootPc != null) {
      return KB_DEFAULT_DEGREE_BY_INTERVAL[((pc - rootPc + 12) % 12)] || "";
    }
    return spellNote(pc, noteNameMap);
  }

  function classify(midi, pc) {
    if (voicing.has(midi)) return { mode: "chord", label: voicing.get(midi).degree || labelFor(pc) };
    if (chordSet && chordSet.has(pc)) return { mode: "chord", label: labelFor(pc) };
    if (pc === rootPc && (scaleSet || chordSet)) return { mode: "root", label: labelFor(pc) };
    if (scaleSet && scaleSet.has(pc)) return { mode: "scale", label: labelFor(pc) };
    return { mode: "none", label: "" };
  }

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block">`;

  // Active region band
  if (activeRegion) {
    const [as, ae] = activeRegion;
    const leftW = whiteKeys.find(w => w.midi >= as);
    const rights = whiteKeys.filter(w => w.midi <= ae);
    const rightW = rights[rights.length - 1];
    if (leftW && rightW) {
      svg += `<rect x="${leftW.x}" y="0" width="${rightW.x + whiteW - leftW.x}" height="${whiteH}" fill="var(--accent)" opacity="0.10"/>`;
    }
  }

  // Circle dot sizes — small enough to preserve the key shape, big enough to hold a label.
  const whiteDotR  = compact ? 5.5 : 9;
  const blackDotR  = compact ? 3.75 : 5.5;
  const whiteDotCy = whiteH - whiteDotR - (compact ? 3 : 5);
  const blackDotCy = blackH - blackDotR - (compact ? 2 : 3);

  // White keys — always neutral background so the keyboard pattern stays readable.
  for (const w of whiteKeys) {
    const c = classify(w.midi, w.pc);
    svg += `<rect x="${w.x + 0.5}" y="0" width="${whiteW - 1}" height="${whiteH}" fill="#e8e8ec" stroke="#1a1a24" stroke-width="0.6" rx="2" ry="2"/>`;
    if (c.mode !== "none") {
      const cx = w.x + whiteW / 2;
      let dotFill = "var(--pattern-note)";
      if (c.mode === "root" || c.mode === "chord") dotFill = "var(--triad-fill)";
      const dotStroke = c.mode === "root" ? "var(--triad-stroke)" : "none";
      const dotStrokeW = c.mode === "root" ? 2 : 0;
      svg += `<circle cx="${cx}" cy="${whiteDotCy}" r="${whiteDotR}" fill="${dotFill}" stroke="${dotStroke}" stroke-width="${dotStrokeW}"/>`;
      if (c.label) {
        const textFill = c.mode === "scale" ? "var(--pattern-text)" : "var(--triad-text)";
        svg += `<text x="${cx}" y="${whiteDotCy + (compact ? 3 : 4)}" text-anchor="middle" font-size="${compact ? 8 : 11}" fill="${textFill}" font-weight="700" font-family="'JetBrains Mono', monospace">${c.label}</text>`;
      }
    }
    if (showOct && w.pc === 0) {
      const oct = Math.floor(w.midi / 12) - 1;
      svg += `<text x="${w.x + whiteW/2}" y="${height - 2}" text-anchor="middle" font-size="${compact ? 8 : 9}" fill="var(--text-muted)" font-family="'JetBrains Mono', monospace">C${oct}</text>`;
    }
  }

  // Black keys (drawn on top of whites) — always dark background.
  for (const b of blackKeys) {
    const c = classify(b.midi, b.pc);
    svg += `<rect x="${b.x}" y="0" width="${blackW}" height="${blackH}" fill="#1c1c24" stroke="#000" stroke-width="0.6" rx="1.5" ry="1.5"/>`;
    if (c.mode !== "none") {
      const cx = b.x + blackW / 2;
      let dotFill = "var(--pattern-note)";
      if (c.mode === "root" || c.mode === "chord") dotFill = "var(--triad-fill)";
      const dotStroke = c.mode === "root" ? "var(--triad-stroke)" : "none";
      const dotStrokeW = c.mode === "root" ? 1.5 : 0;
      svg += `<circle cx="${cx}" cy="${blackDotCy}" r="${blackDotR}" fill="${dotFill}" stroke="${dotStroke}" stroke-width="${dotStrokeW}"/>`;
      if (c.label) {
        const textFill = c.mode === "scale" ? "var(--pattern-text)" : "#fff";
        svg += `<text x="${cx}" y="${blackDotCy + (compact ? 2.5 : 3.5)}" text-anchor="middle" font-size="${compact ? 7 : 9}" fill="${textFill}" font-weight="700" font-family="'JetBrains Mono', monospace">${c.label}</text>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

// Convenience: find the first MIDI pitch of a given pc at or after a base
function pcToMidiAtOrAfter(pc, baseMidi) {
  const basePc = ((baseMidi % 12) + 12) % 12;
  const delta = ((pc - basePc) + 12) % 12;
  return baseMidi + delta;
}
