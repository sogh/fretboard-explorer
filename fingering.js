// ── Trumpet fingerings ──────────────────────────────────────────────
// Standard B♭ trumpet fingerings keyed by written pitch class (0–11).
// Each entry is an array of pressed valves (subset of [1, 2, 3]).
// These are the most commonly taught "default" fingerings for the middle
// register; alternate fingerings exist for extreme registers but are not
// shown here to keep the chart readable.
const TRUMPET_FINGERINGS = {
  0:  [],         // C — open
  1:  [1, 2, 3],  // C♯
  2:  [1, 3],     // D
  3:  [2, 3],     // D♯
  4:  [1, 2],     // E
  5:  [1],        // F
  6:  [2],        // F♯
  7:  [],         // G — open
  8:  [2, 3],     // G♯
  9:  [1, 2],     // A
  10: [1],        // A♯
  11: [2],        // B
};

// Pretty-print a fingering as "1·2·3" / "open" for compact card labels.
function fingeringText(valves) {
  if (!valves || valves.length === 0) return "open";
  return valves.join("·");
}

// Render a three-circle valve diagram. Pressed valves are filled; unpressed
// are outlined rings. Valve 1 left, 2 middle, 3 right — the order the player
// sees when looking down at the trumpet's top three valve caps.
function renderFingeringSVG(valves, opts) {
  opts = opts || {};
  const size = opts.size || 14;      // circle radius
  const gap  = opts.gap  || 6;
  const w    = 3 * (size * 2) + 2 * gap + 4;
  const h    = size * 2 + 4;
  const pressed = new Set(valves || []);
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block">`;
  for (let v = 1; v <= 3; v++) {
    const cx = 2 + size + (v - 1) * (size * 2 + gap);
    const cy = 2 + size;
    const isPressed = pressed.has(v);
    const fill = isPressed ? "var(--pattern-note)" : "none";
    const stroke = isPressed ? "var(--pattern-note)" : "var(--text-muted)";
    svg += `<circle cx="${cx}" cy="${cy}" r="${size}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${isPressed ? "#fff" : "var(--text-muted)"}" font-family="'JetBrains Mono', monospace">${v}</text>`;
  }
  svg += `</svg>`;
  return svg;
}

// Node-only export hook. Browsers ignore this.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { TRUMPET_FINGERINGS, fingeringText, renderFingeringSVG };
}
