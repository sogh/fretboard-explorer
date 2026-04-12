// ── Circle of Fifths page ───────────────────────────────────────────
// Reuses NOTES / noteIndex / noteName from triad-explorer.js.

// Position 0 = C at the top. Clockwise adds 7 semitones.
const CIRCLE_MAJ = ["C","G","D","A","E","B","F♯","D♭","A♭","E♭","B♭","F"];
const CIRCLE_MIN = ["Am","Em","Bm","F♯m","C♯m","G♯m","E♭m","B♭m","Fm","Cm","Gm","Dm"];

const COF_SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const COF_FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

const posPitch = p => ((p * 7) % 12 + 12) % 12;

const circleState = {
  mode: "major",          // "major" | "minor"
  minorType: "relative",  // "relative" | "parallel" (only when mode === "minor")
  pos: 0,                 // circle position 0..11
};

// The circle position whose key signature applies:
//   major: pos itself
//   relative minor: pos (relative minor shares the major's key signature)
//   parallel minor: pos - 3 (parallel minor has the key sig of the major 3 steps flatward)
function keySigPos() {
  if (circleState.mode === "minor" && circleState.minorType === "parallel") {
    return ((circleState.pos - 3) % 12 + 12) % 12;
  }
  return circleState.pos;
}

function usesFlats() {
  return keySigPos() >= 7;
}

function spell(pc) {
  const arr = usesFlats() ? COF_FLAT : COF_SHARP;
  return arr[((pc % 12) + 12) % 12];
}

// Tonic pitch class for the currently selected key.
function tonicPitch() {
  if (circleState.mode === "major") return posPitch(circleState.pos);
  if (circleState.minorType === "parallel") return posPitch(circleState.pos);
  // relative minor: a minor sixth up from the major tonic
  return (posPitch(circleState.pos) + 9) % 12;
}

// Label for the current key (e.g. "A minor", "C minor", "G major").
function keyTitle() {
  if (circleState.mode === "major") return `${CIRCLE_MAJ[circleState.pos]} major`;
  if (circleState.minorType === "parallel") return `${CIRCLE_MAJ[circleState.pos]} minor`;
  return `${CIRCLE_MIN[circleState.pos].replace("m","")} minor`;
}

// Jump-to-key button label for circle position `i`.
function jumpLabel(i) {
  if (circleState.mode === "major") return CIRCLE_MAJ[i];
  if (circleState.minorType === "parallel") return CIRCLE_MAJ[i] + "m";
  return CIRCLE_MIN[i];
}

// The centered key name in the middle of the wheel.
function centerLabel() {
  if (circleState.mode === "major") return CIRCLE_MAJ[circleState.pos];
  if (circleState.minorType === "parallel") return CIRCLE_MAJ[circleState.pos] + "m";
  return CIRCLE_MIN[circleState.pos];
}

// ── Diatonic chords for the current key ────────────────────────────
function diatonicChords() {
  const t = tonicPitch();
  if (circleState.mode === "major") {
    return [
      { roman: "I",    name: spell(t),                 pc: t },
      { roman: "ii",   name: spell((t+2)%12) + "m",    pc: (t+2)%12 },
      { roman: "iii",  name: spell((t+4)%12) + "m",    pc: (t+4)%12 },
      { roman: "IV",   name: spell((t+5)%12),          pc: (t+5)%12 },
      { roman: "V",    name: spell((t+7)%12),          pc: (t+7)%12 },
      { roman: "vi",   name: spell((t+9)%12) + "m",    pc: (t+9)%12 },
      { roman: "vii°", name: spell((t+11)%12) + "°",   pc: (t+11)%12 },
    ];
  }
  return [
    { roman: "i",    name: spell(t) + "m",            pc: t },
    { roman: "ii°",  name: spell((t+2)%12) + "°",     pc: (t+2)%12 },
    { roman: "III",  name: spell((t+3)%12),           pc: (t+3)%12 },
    { roman: "iv",   name: spell((t+5)%12) + "m",     pc: (t+5)%12 },
    { roman: "v",    name: spell((t+7)%12) + "m",     pc: (t+7)%12 },
    { roman: "VI",   name: spell((t+8)%12),           pc: (t+8)%12 },
    { roman: "VII",  name: spell((t+10)%12),          pc: (t+10)%12 },
  ];
}

// ── Borrowed chord categories ──────────────────────────────────────
function borrowedCategories() {
  const t = tonicPitch();
  const sd = [], par = [], med = [];

  if (circleState.mode === "major") {
    sd.push({ roman: "V7/ii",  name: spell((t+9)%12)  + "7", desc: `→ ${spell((t+2)%12)}m` });
    sd.push({ roman: "V7/iii", name: spell((t+11)%12) + "7", desc: `→ ${spell((t+4)%12)}m` });
    sd.push({ roman: "V7/IV",  name: spell(t)          + "7", desc: `→ ${spell((t+5)%12)}` });
    sd.push({ roman: "V7/V",   name: spell((t+2)%12)  + "7", desc: `→ ${spell((t+7)%12)}` });
    sd.push({ roman: "V7/vi",  name: spell((t+4)%12)  + "7", desc: `→ ${spell((t+9)%12)}m` });

    par.push({ roman: "iv",    name: spell((t+5)%12)  + "m",  desc: "minor four" });
    par.push({ roman: "v",     name: spell((t+7)%12)  + "m",  desc: "minor five" });
    par.push({ roman: "♭III",  name: spell((t+3)%12),          desc: "flat three" });
    par.push({ roman: "♭VI",   name: spell((t+8)%12),          desc: "flat six" });
    par.push({ roman: "♭VII",  name: spell((t+10)%12),         desc: "flat seven" });
    par.push({ roman: "ii°",   name: spell((t+2)%12)  + "°",   desc: "diminished two" });

    med.push({ roman: "III",   name: spell((t+4)%12),          desc: "major III (altered iii)" });
    med.push({ roman: "♭III",  name: spell((t+3)%12),          desc: "minor third up" });
    med.push({ roman: "VI",    name: spell((t+9)%12),          desc: "major VI (altered vi)" });
    med.push({ roman: "♭VI",   name: spell((t+8)%12),          desc: "minor sixth up" });
  } else {
    sd.push({ roman: "V7/III", name: spell((t+10)%12) + "7", desc: `→ ${spell((t+3)%12)}` });
    sd.push({ roman: "V7/iv",  name: spell(t)          + "7", desc: `→ ${spell((t+5)%12)}m` });
    sd.push({ roman: "V7/V",   name: spell((t+2)%12)  + "7", desc: `→ ${spell((t+7)%12)}` });
    sd.push({ roman: "V7/VI",  name: spell((t+3)%12)  + "7", desc: `→ ${spell((t+8)%12)}` });
    sd.push({ roman: "V7/VII", name: spell((t+5)%12)  + "7", desc: `→ ${spell((t+10)%12)}` });

    par.push({ roman: "I",     name: spell(t),                 desc: "Picardy third" });
    par.push({ roman: "IV",    name: spell((t+5)%12),          desc: "major four" });
    par.push({ roman: "V",     name: spell((t+7)%12),          desc: "major five" });
    par.push({ roman: "ii",    name: spell((t+2)%12)  + "m",   desc: "minor two" });
    par.push({ roman: "vi",    name: spell((t+9)%12)  + "m",   desc: "raised six" });
    par.push({ roman: "vii°",  name: spell((t+11)%12) + "°",   desc: "leading-tone dim" });

    med.push({ roman: "♭II",   name: spell((t+1)%12),          desc: "Neapolitan" });
    med.push({ roman: "♭v",    name: spell((t+6)%12) + "m",    desc: "tritone minor" });
    med.push({ roman: "III+",  name: spell((t+3)%12) + "+",    desc: "augmented III" });
    med.push({ roman: "♭vi",   name: spell((t+8)%12) + "m",    desc: "minor sixth up" });
  }
  return { sd, par, med };
}

// ── SVG helpers ────────────────────────────────────────────────────
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function wedgePath(cx, cy, rOuter, rInner, a1, a2) {
  const [x1o, y1o] = polar(cx, cy, rOuter, a1);
  const [x2o, y2o] = polar(cx, cy, rOuter, a2);
  const [x1i, y1i] = polar(cx, cy, rInner, a1);
  const [x2i, y2i] = polar(cx, cy, rInner, a2);
  const large = (a2 - a1) > 180 ? 1 : 0;
  return `M ${x1o.toFixed(2)} ${y1o.toFixed(2)} `
       + `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} `
       + `L ${x2i.toFixed(2)} ${y2i.toFixed(2)} `
       + `A ${rInner} ${rInner} 0 ${large} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z`;
}

// ── Circle SVG ─────────────────────────────────────────────────────
function renderCircleSVG() {
  const cx = 220, cy = 220;
  const rOut = 210, rMid = 145, rIn = 80;
  const mode = circleState.mode;
  const ksp = keySigPos();

  // The tonic letter's position on the outer ring (only used when the tonic
  // letter corresponds to a major key's position: major mode, or parallel minor).
  const letterPos = circleState.pos;

  // Diatonic slice on the circle — always centered around the key signature
  // position, since that's where the diatonic chords actually sit.
  const hiSet = new Set([(ksp + 11) % 12, ksp, (ksp + 1) % 12]);

  // Roman numerals on the wheel anchored to the key-signature triad.
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

  // Where to paint the "tonic" emphasis:
  //  - major: outer ring at the pos letter
  //  - relative minor: inner ring at pos (Am lives at pos 0 inner)
  //  - parallel minor: inner ring at ksp (Cm lives on inner ring at pos 9,
  //    which is E♭ major's relative minor — i.e. C minor)
  const outerTonicAt = mode === "major" ? letterPos : -1;
  const innerTonicAt = mode === "minor" ? ksp : -1;

  let svg = `<svg width="440" height="440" viewBox="0 0 440 440" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block">`;

  // Wedges (outer ring: majors)
  for (let i = 0; i < 12; i++) {
    const a1 = i * 30 - 15, a2 = i * 30 + 15;
    const isTonic = i === outerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-wedge tonic" : (inKey ? "circle-wedge in-key" : "circle-wedge");
    svg += `<path class="${cls}" d="${wedgePath(cx, cy, rOut, rMid, a1, a2)}"/>`;
  }
  // Wedges (inner ring: minors)
  for (let i = 0; i < 12; i++) {
    const a1 = i * 30 - 15, a2 = i * 30 + 15;
    const isTonic = i === innerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-wedge tonic" : (inKey ? "circle-wedge in-key" : "circle-wedge");
    svg += `<path class="${cls}" d="${wedgePath(cx, cy, rMid, rIn, a1, a2)}"/>`;
  }

  // Labels (outer majors)
  for (let i = 0; i < 12; i++) {
    const [x, y] = polar(cx, cy, (rOut + rMid) / 2, i * 30);
    const isTonic = i === outerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-label tonic" : (inKey ? "circle-label" : "circle-label muted");
    svg += `<text class="${cls}" x="${x.toFixed(2)}" y="${(y + 5).toFixed(2)}" font-size="17">${CIRCLE_MAJ[i]}</text>`;
    if (outerRoman[i]) {
      const [rx, ry] = polar(cx, cy, rOut - 12, i * 30);
      const rcls = isTonic ? "circle-roman tonic" : "circle-roman in-key";
      svg += `<text class="${rcls}" x="${rx.toFixed(2)}" y="${(ry + 3).toFixed(2)}">${outerRoman[i]}</text>`;
    }
  }
  // Labels (inner minors)
  for (let i = 0; i < 12; i++) {
    const [x, y] = polar(cx, cy, (rMid + rIn) / 2, i * 30);
    const isTonic = i === innerTonicAt;
    const inKey = hiSet.has(i);
    const cls = isTonic ? "circle-label tonic" : (inKey ? "circle-label" : "circle-label muted");
    svg += `<text class="${cls}" x="${x.toFixed(2)}" y="${(y + 4).toFixed(2)}" font-size="13">${CIRCLE_MIN[i]}</text>`;
    if (innerRoman[i]) {
      const [rx, ry] = polar(cx, cy, rIn + 11, i * 30);
      const rcls = isTonic ? "circle-roman tonic" : "circle-roman in-key";
      svg += `<text class="${rcls}" x="${rx.toFixed(2)}" y="${(ry + 3).toFixed(2)}">${innerRoman[i]}</text>`;
    }
  }

  // Radial dividers between wedges
  for (let i = 0; i < 12; i++) {
    const a = i * 30 - 15;
    const [x1, y1] = polar(cx, cy, rIn, a);
    const [x2, y2] = polar(cx, cy, rOut, a);
    svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="var(--border)" stroke-width="1"/>`;
  }
  // Ring circles
  svg += `<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rMid}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rIn}"  fill="none" stroke="var(--border)" stroke-width="1"/>`;

  // Center label
  svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="28" font-weight="700" fill="var(--accent)" font-family="'JetBrains Mono', monospace">${centerLabel()}</text>`;
  svg += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="'JetBrains Mono', monospace" letter-spacing="2">${mode.toUpperCase()}</text>`;

  svg += `</svg>`;
  return svg;
}

// ── Page render ────────────────────────────────────────────────────
function renderCirclePage() {
  // Controls
  const controls = document.getElementById("circle-controls");
  const minorTypeRow = circleState.mode === "minor" ? `
    <div class="control-group">
      <span class="control-label">Minor type</span>
      <div class="control-options">
        <button class="control-btn ${circleState.minorType === "relative" ? "active" : ""}" data-cof="minorType" data-val="relative" title="Shares key signature with the major (e.g. C major ↔ A minor)">Relative</button>
        <button class="control-btn ${circleState.minorType === "parallel" ? "active" : ""}" data-cof="minorType" data-val="parallel" title="Shares tonic letter with the major (e.g. C major ↔ C minor)">Parallel</button>
      </div>
    </div>
  ` : "";
  controls.innerHTML = `
    <div class="control-group">
      <span class="control-label">Mode</span>
      <div class="control-options">
        <button class="control-btn ${circleState.mode === "major" ? "active" : ""}" data-cof="mode" data-val="major">Major</button>
        <button class="control-btn ${circleState.mode === "minor" ? "active" : ""}" data-cof="mode" data-val="minor">Minor</button>
      </div>
    </div>
    ${minorTypeRow}
    <div class="control-group">
      <span class="control-label">Rotate</span>
      <div class="control-options">
        <button class="control-btn" data-cof="rotate" data-val="-1" title="Counter-clockwise (flat side)">◀ ♭</button>
        <button class="control-btn" data-cof="rotate" data-val="1" title="Clockwise (sharp side)">♯ ▶</button>
      </div>
    </div>
    <div class="control-group">
      <span class="control-label">Jump to key</span>
      <div class="control-options">
        ${Array.from({length: 12}, (_, i) =>
          `<button class="control-btn ${i === circleState.pos ? "active" : ""}" data-cof="pos" data-val="${i}">${jumpLabel(i)}</button>`
        ).join("")}
      </div>
    </div>
  `;

  // Circle SVG
  document.getElementById("circle-svg").innerHTML = renderCircleSVG();

  // Diatonic chord list panel
  const diatonic = diatonicChords();
  const info = document.getElementById("circle-info");
  info.innerHTML = `
    <div>
      <div class="circle-key-title">${keyTitle()}</div>
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

  // Borrowed chord sections
  const { sd, par, med } = borrowedCategories();
  const parallelLabel = circleState.mode === "major" ? "Parallel Minor Borrowings" : "Parallel Major Borrowings";
  const sectionHTML = (title, items) => `
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
    sectionHTML("Secondary Dominants", sd) +
    sectionHTML(parallelLabel, par) +
    sectionHTML("Chromatic Mediants", med);

  attachCircleEvents();
}

function attachCircleEvents() {
  document.querySelectorAll("[data-cof]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.cof;
      const val = btn.dataset.val;
      if (key === "mode") circleState.mode = val;
      else if (key === "minorType") circleState.minorType = val;
      else if (key === "rotate") circleState.pos = ((circleState.pos + parseInt(val)) % 12 + 12) % 12;
      else if (key === "pos") circleState.pos = parseInt(val);
      renderCirclePage();
    };
  });
}

// Boot (page starts hidden; render now so it's ready when switched to)
renderCirclePage();
