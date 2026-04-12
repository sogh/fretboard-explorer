// ── Piano Circle of Fifths ──────────────────────────────────────────
// Requires theory.js + keyboard.js. Same core logic as the guitar circle
// plus piano-specific key-signature and diatonic-chord keyboard strips.

const PCIRC_MAJ = ["C","G","D","A","E","B","F♯","D♭","A♭","E♭","B♭","F"];
const PCIRC_MIN = ["Am","Em","Bm","F♯m","C♯m","G♯m","E♭m","B♭m","Fm","Cm","Gm","Dm"];
const PCIRC_SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const PCIRC_FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

const pianoCircleState = {
  mode: "major",
  minorType: "relative",  // "relative" | "parallel" when mode === "minor"
  pos: 0,
};

const pcPosPitch = p => ((p * 7) % 12 + 12) % 12;

function pcKeySigPos() {
  if (pianoCircleState.mode === "minor" && pianoCircleState.minorType === "parallel") {
    return ((pianoCircleState.pos - 3) % 12 + 12) % 12;
  }
  return pianoCircleState.pos;
}
const pcUsesFlats = () => pcKeySigPos() >= 7;
function pcSpell(pc) {
  return (pcUsesFlats() ? PCIRC_FLAT : PCIRC_SHARP)[((pc % 12) + 12) % 12];
}

function pcTonicPitch() {
  if (pianoCircleState.mode === "major") return pcPosPitch(pianoCircleState.pos);
  if (pianoCircleState.minorType === "parallel") return pcPosPitch(pianoCircleState.pos);
  return (pcPosPitch(pianoCircleState.pos) + 9) % 12;
}

function pcKeyTitle() {
  if (pianoCircleState.mode === "major") return `${PCIRC_MAJ[pianoCircleState.pos]} major`;
  if (pianoCircleState.minorType === "parallel") return `${PCIRC_MAJ[pianoCircleState.pos]} minor`;
  return `${PCIRC_MIN[pianoCircleState.pos].replace("m","")} minor`;
}

function pcJumpLabel(i) {
  if (pianoCircleState.mode === "major") return PCIRC_MAJ[i];
  if (pianoCircleState.minorType === "parallel") return PCIRC_MAJ[i] + "m";
  return PCIRC_MIN[i];
}

function pcCenterLabel() {
  if (pianoCircleState.mode === "major") return PCIRC_MAJ[pianoCircleState.pos];
  if (pianoCircleState.minorType === "parallel") return PCIRC_MAJ[pianoCircleState.pos] + "m";
  return PCIRC_MIN[pianoCircleState.pos];
}

function pcDiatonicChords() {
  const t = pcTonicPitch();
  if (pianoCircleState.mode === "major") {
    return [
      { roman: "I",    name: pcSpell(t),                 quality: "major", pc: t },
      { roman: "ii",   name: pcSpell((t+2)%12) + "m",    quality: "minor", pc: (t+2)%12 },
      { roman: "iii",  name: pcSpell((t+4)%12) + "m",    quality: "minor", pc: (t+4)%12 },
      { roman: "IV",   name: pcSpell((t+5)%12),          quality: "major", pc: (t+5)%12 },
      { roman: "V",    name: pcSpell((t+7)%12),          quality: "major", pc: (t+7)%12 },
      { roman: "vi",   name: pcSpell((t+9)%12) + "m",    quality: "minor", pc: (t+9)%12 },
      { roman: "vii°", name: pcSpell((t+11)%12) + "°",   quality: "dim",   pc: (t+11)%12 },
    ];
  }
  return [
    { roman: "i",    name: pcSpell(t) + "m",            quality: "minor", pc: t },
    { roman: "ii°",  name: pcSpell((t+2)%12) + "°",     quality: "dim",   pc: (t+2)%12 },
    { roman: "III",  name: pcSpell((t+3)%12),           quality: "major", pc: (t+3)%12 },
    { roman: "iv",   name: pcSpell((t+5)%12) + "m",     quality: "minor", pc: (t+5)%12 },
    { roman: "v",    name: pcSpell((t+7)%12) + "m",     quality: "minor", pc: (t+7)%12 },
    { roman: "VI",   name: pcSpell((t+8)%12),           quality: "major", pc: (t+8)%12 },
    { roman: "VII",  name: pcSpell((t+10)%12),          quality: "major", pc: (t+10)%12 },
  ];
}

function pcBorrowed() {
  const t = pcTonicPitch();
  const sd = [], par = [], med = [];

  if (pianoCircleState.mode === "major") {
    sd.push({ roman: "V7/ii",  name: pcSpell((t+9)%12)  + "7", desc: `→ ${pcSpell((t+2)%12)}m` });
    sd.push({ roman: "V7/iii", name: pcSpell((t+11)%12) + "7", desc: `→ ${pcSpell((t+4)%12)}m` });
    sd.push({ roman: "V7/IV",  name: pcSpell(t)          + "7", desc: `→ ${pcSpell((t+5)%12)}` });
    sd.push({ roman: "V7/V",   name: pcSpell((t+2)%12)  + "7", desc: `→ ${pcSpell((t+7)%12)}` });
    sd.push({ roman: "V7/vi",  name: pcSpell((t+4)%12)  + "7", desc: `→ ${pcSpell((t+9)%12)}m` });

    par.push({ roman: "iv",    name: pcSpell((t+5)%12)  + "m",  desc: "minor four" });
    par.push({ roman: "v",     name: pcSpell((t+7)%12)  + "m",  desc: "minor five" });
    par.push({ roman: "♭III",  name: pcSpell((t+3)%12),          desc: "flat three" });
    par.push({ roman: "♭VI",   name: pcSpell((t+8)%12),          desc: "flat six" });
    par.push({ roman: "♭VII",  name: pcSpell((t+10)%12),         desc: "flat seven" });
    par.push({ roman: "ii°",   name: pcSpell((t+2)%12)  + "°",   desc: "diminished two" });

    med.push({ roman: "III",   name: pcSpell((t+4)%12),          desc: "major III (altered iii)" });
    med.push({ roman: "♭III",  name: pcSpell((t+3)%12),          desc: "minor third up" });
    med.push({ roman: "VI",    name: pcSpell((t+9)%12),          desc: "major VI (altered vi)" });
    med.push({ roman: "♭VI",   name: pcSpell((t+8)%12),          desc: "minor sixth up" });
  } else {
    sd.push({ roman: "V7/III", name: pcSpell((t+10)%12) + "7", desc: `→ ${pcSpell((t+3)%12)}` });
    sd.push({ roman: "V7/iv",  name: pcSpell(t)          + "7", desc: `→ ${pcSpell((t+5)%12)}m` });
    sd.push({ roman: "V7/V",   name: pcSpell((t+2)%12)  + "7", desc: `→ ${pcSpell((t+7)%12)}` });
    sd.push({ roman: "V7/VI",  name: pcSpell((t+3)%12)  + "7", desc: `→ ${pcSpell((t+8)%12)}` });
    sd.push({ roman: "V7/VII", name: pcSpell((t+5)%12)  + "7", desc: `→ ${pcSpell((t+10)%12)}` });

    par.push({ roman: "I",     name: pcSpell(t),                 desc: "Picardy third" });
    par.push({ roman: "IV",    name: pcSpell((t+5)%12),          desc: "major four" });
    par.push({ roman: "V",     name: pcSpell((t+7)%12),          desc: "major five" });
    par.push({ roman: "ii",    name: pcSpell((t+2)%12)  + "m",   desc: "minor two" });
    par.push({ roman: "vi",    name: pcSpell((t+9)%12)  + "m",   desc: "raised six" });
    par.push({ roman: "vii°",  name: pcSpell((t+11)%12) + "°",   desc: "leading-tone dim" });

    med.push({ roman: "♭II",   name: pcSpell((t+1)%12),          desc: "Neapolitan" });
    med.push({ roman: "♭v",    name: pcSpell((t+6)%12) + "m",    desc: "tritone minor" });
    med.push({ roman: "III+",  name: pcSpell((t+3)%12) + "+",    desc: "augmented III" });
    med.push({ roman: "♭vi",   name: pcSpell((t+8)%12) + "m",    desc: "minor sixth up" });
  }
  return { sd, par, med };
}

// ── Circle SVG (same geometry as guitar circle) ───────────────────
function pcPolar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function pcWedge(cx, cy, rOuter, rInner, a1, a2) {
  const [x1o, y1o] = pcPolar(cx, cy, rOuter, a1);
  const [x2o, y2o] = pcPolar(cx, cy, rOuter, a2);
  const [x1i, y1i] = pcPolar(cx, cy, rInner, a1);
  const [x2i, y2i] = pcPolar(cx, cy, rInner, a2);
  const large = (a2 - a1) > 180 ? 1 : 0;
  return `M ${x1o.toFixed(2)} ${y1o.toFixed(2)} `
       + `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} `
       + `L ${x2i.toFixed(2)} ${y2i.toFixed(2)} `
       + `A ${rInner} ${rInner} 0 ${large} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z`;
}

function renderPianoCircleSVG() {
  const cx = 220, cy = 220;
  const rOut = 210, rMid = 145, rIn = 80;
  const mode = pianoCircleState.mode;
  const ksp = pcKeySigPos();
  const letterPos = pianoCircleState.pos;
  const hiSet = new Set([(ksp + 11) % 12, ksp, (ksp + 1) % 12]);

  const outerRoman = {}, innerRoman = {};
  if (mode === "major") {
    outerRoman[(ksp + 11) % 12] = "IV";
    outerRoman[ksp]              = "I";
    outerRoman[(ksp + 1) % 12]   = "V";
    innerRoman[(ksp + 11) % 12]  = "ii";
    innerRoman[ksp]              = "vi";
    innerRoman[(ksp + 1) % 12]   = "iii";
  } else {
    outerRoman[(ksp + 11) % 12]  = "VI";
    outerRoman[ksp]              = "III";
    outerRoman[(ksp + 1) % 12]   = "VII";
    innerRoman[(ksp + 11) % 12]  = "iv";
    innerRoman[ksp]              = "i";
    innerRoman[(ksp + 1) % 12]   = "v";
  }

  const outerTonicAt = mode === "major" ? letterPos : -1;
  const innerTonicAt = mode === "minor" ? ksp : -1;

  let svg = `<svg width="440" height="440" viewBox="0 0 440 440" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block">`;

  for (let i = 0; i < 12; i++) {
    const a1 = i * 30 - 15, a2 = i * 30 + 15;
    const isTonic = i === outerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-wedge tonic" : (inKey ? "circle-wedge in-key" : "circle-wedge");
    svg += `<path class="${cls}" d="${pcWedge(cx, cy, rOut, rMid, a1, a2)}"/>`;
  }
  for (let i = 0; i < 12; i++) {
    const a1 = i * 30 - 15, a2 = i * 30 + 15;
    const isTonic = i === innerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-wedge tonic" : (inKey ? "circle-wedge in-key" : "circle-wedge");
    svg += `<path class="${cls}" d="${pcWedge(cx, cy, rMid, rIn, a1, a2)}"/>`;
  }

  for (let i = 0; i < 12; i++) {
    const [x, y] = pcPolar(cx, cy, (rOut + rMid) / 2, i * 30);
    const isTonic = i === outerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-label tonic" : (inKey ? "circle-label" : "circle-label muted");
    svg += `<text class="${cls}" x="${x.toFixed(2)}" y="${(y + 5).toFixed(2)}" font-size="17">${PCIRC_MAJ[i]}</text>`;
    if (outerRoman[i]) {
      const [rx, ry] = pcPolar(cx, cy, rOut - 12, i * 30);
      const rcls = isTonic ? "circle-roman tonic" : "circle-roman in-key";
      svg += `<text class="${rcls}" x="${rx.toFixed(2)}" y="${(ry + 3).toFixed(2)}">${outerRoman[i]}</text>`;
    }
  }
  for (let i = 0; i < 12; i++) {
    const [x, y] = pcPolar(cx, cy, (rMid + rIn) / 2, i * 30);
    const isTonic = i === innerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-label tonic" : (inKey ? "circle-label" : "circle-label muted");
    svg += `<text class="${cls}" x="${x.toFixed(2)}" y="${(y + 4).toFixed(2)}" font-size="13">${PCIRC_MIN[i]}</text>`;
    if (innerRoman[i]) {
      const [rx, ry] = pcPolar(cx, cy, rIn + 11, i * 30);
      const rcls = isTonic ? "circle-roman tonic" : "circle-roman in-key";
      svg += `<text class="${rcls}" x="${rx.toFixed(2)}" y="${(ry + 3).toFixed(2)}">${innerRoman[i]}</text>`;
    }
  }

  for (let i = 0; i < 12; i++) {
    const a = i * 30 - 15;
    const [x1, y1] = pcPolar(cx, cy, rIn, a);
    const [x2, y2] = pcPolar(cx, cy, rOut, a);
    svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="var(--border)" stroke-width="1"/>`;
  }
  svg += `<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rMid}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rIn}"  fill="none" stroke="var(--border)" stroke-width="1"/>`;

  svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="28" font-weight="700" fill="var(--accent)" font-family="'JetBrains Mono', monospace">${pcCenterLabel()}</text>`;
  svg += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="'JetBrains Mono', monospace" letter-spacing="2">${mode.toUpperCase()}</text>`;

  svg += `</svg>`;
  return svg;
}

// ── Page render ───────────────────────────────────────────────────
function renderPianoCircle() {
  if (!document.getElementById("circle-controls")) return;

  // Controls
  const controls = document.getElementById("circle-controls");
  const minorTypeRow = pianoCircleState.mode === "minor" ? `
    <div class="control-group">
      <span class="control-label">Minor type</span>
      <div class="control-options">
        <button class="control-btn ${pianoCircleState.minorType === "relative" ? "active" : ""}" data-pc="minorType" data-val="relative" title="Shares key signature with the major (e.g. C major ↔ A minor)">Relative</button>
        <button class="control-btn ${pianoCircleState.minorType === "parallel" ? "active" : ""}" data-pc="minorType" data-val="parallel" title="Shares tonic letter with the major (e.g. C major ↔ C minor)">Parallel</button>
      </div>
    </div>
  ` : "";
  controls.innerHTML = `
    <div class="control-group">
      <span class="control-label">Mode</span>
      <div class="control-options">
        <button class="control-btn ${pianoCircleState.mode === "major" ? "active" : ""}" data-pc="mode" data-val="major">Major</button>
        <button class="control-btn ${pianoCircleState.mode === "minor" ? "active" : ""}" data-pc="mode" data-val="minor">Minor</button>
      </div>
    </div>
    ${minorTypeRow}
    <div class="control-group">
      <span class="control-label">Rotate</span>
      <div class="control-options">
        <button class="control-btn" data-pc="rotate" data-val="-1" title="Counter-clockwise (flat side)">◀ ♭</button>
        <button class="control-btn" data-pc="rotate" data-val="1" title="Clockwise (sharp side)">♯ ▶</button>
      </div>
    </div>
    <div class="control-group">
      <span class="control-label">Jump to key</span>
      <div class="control-options">
        ${Array.from({length: 12}, (_, i) =>
          `<button class="control-btn ${i === pianoCircleState.pos ? "active" : ""}" data-pc="pos" data-val="${i}">${pcJumpLabel(i)}</button>`
        ).join("")}
      </div>
    </div>
  `;

  // Circle SVG
  document.getElementById("circle-svg").innerHTML = renderPianoCircleSVG();

  // Diatonic list
  const diatonic = pcDiatonicChords();
  const info = document.getElementById("circle-info");
  info.innerHTML = `
    <div>
      <div class="circle-key-title">${pcKeyTitle()}</div>
      <div class="circle-key-sub">Diatonic chords</div>
    </div>
    <div class="diatonic-list">
      ${diatonic.map((d, i) => `
        <div class="diatonic-chord ${i === 0 ? "tonic" : ""}">
          <div class="diatonic-roman">${d.roman}</div>
          <div class="diatonic-name">${d.name}</div>
        </div>
      `).join("")}
    </div>
  `;

  // ── Piano-specific: key signature keyboard ──
  const tonicPc = pcTonicPitch();
  const scaleKey = pianoCircleState.mode === "major" ? "ionian" : "aeolian";
  const scalePcs = SCALES[scaleKey].steps.map(s => (tonicPc + s) % 12);
  const degreeMap = {};
  SCALES[scaleKey].steps.forEach((s, i) => {
    degreeMap[(tonicPc + s) % 12] = SCALES[scaleKey].degrees[i];
  });

  document.getElementById("keysig-panel").innerHTML = `
    <div class="keysig-panel">
      <div class="keysig-title">Key signature on the keyboard — ${pcKeyTitle()}</div>
      <div class="keyboard-scroll">
        ${renderKeyboardSVG({
          startMidi: 48, endMidi: 72,
          scalePcs, rootPc: tonicPc,
          labelMode: "note",
          degreeMap,
        })}
      </div>
    </div>
  `;

  // ── Piano-specific: diatonic chord strip ──
  let strip = `<div class="keysig-title" style="margin-bottom:10px">Diatonic chords as keyboard voicings</div><div class="chord-strip">`;
  for (let i = 0; i < diatonic.length; i++) {
    const d = diatonic[i];
    const notes = buildCloseVoicing(d.pc, d.quality, 0, 48);
    strip += `<div class="chord-strip-card ${i === 0 ? "tonic" : ""}">
      <div class="chord-strip-roman">${d.roman}</div>
      <div class="chord-strip-name">${d.name}</div>
      ${renderKeyboardSVG({
        startMidi: 48, endMidi: 72,
        chordNotes: notes,
        rootPc: d.pc,
        labelMode: "degree",
        compact: true,
        showOctaveLabels: false,
      })}
    </div>`;
  }
  strip += `</div>`;
  document.getElementById("chord-strip").innerHTML = strip;

  // ── Borrowed chord sections (same layout as guitar) ──
  const { sd, par, med } = pcBorrowed();
  const parallelLabel = pianoCircleState.mode === "major" ? "Parallel Minor Borrowings" : "Parallel Major Borrowings";
  const section = (title, items) => `
    <div class="borrow-section">
      <div class="borrow-title">${title}</div>
      <div class="borrow-grid">
        ${items.map(c => `
          <div class="borrow-card">
            <div class="borrow-roman">${c.roman}</div>
            <div class="borrow-name">${c.name}</div>
            <div class="borrow-desc">${c.desc}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  document.getElementById("borrowed-sections").innerHTML =
    section("Secondary Dominants", sd) +
    section(parallelLabel, par) +
    section("Chromatic Mediants", med);

  // ── Events ──
  document.querySelectorAll("[data-pc]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.pc;
      const val = btn.dataset.val;
      if (key === "mode") pianoCircleState.mode = val;
      else if (key === "minorType") pianoCircleState.minorType = val;
      else if (key === "rotate") pianoCircleState.pos = ((pianoCircleState.pos + parseInt(val)) % 12 + 12) % 12;
      else if (key === "pos") pianoCircleState.pos = parseInt(val);
      renderPianoCircle();
    };
  });
}

renderPianoCircle();
