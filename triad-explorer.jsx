import { useState, useMemo } from "react";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const STANDARD_TUNING = [4,11,7,2,9,4];
const STRING_NAMES = ["E","B","G","D","A","E"];
const NUM_FRETS = 15;

const noteIndex = n => NOTES.indexOf(n);
const noteName = i => NOTES[((i % 12) + 12) % 12];

const TRIAD_INTERVALS = { major: [0, 4, 7], minor: [0, 3, 7] };

function getTriadNotes(root, quality, inversion) {
  const rootIdx = noteIndex(root);
  let degrees = TRIAD_INTERVALS[quality].map(i => (rootIdx + i) % 12);
  for (let i = 0; i < inversion; i++) degrees.push(degrees.shift());
  return degrees;
}

function getTriadDegreeLabels(inversion) {
  const r = ["1", "3", "5"];
  for (let i = 0; i < inversion; i++) r.push(r.shift());
  return r;
}

function findTriadOnStrings(root, quality, inversion, startStringIdx) {
  const triadNotes = getTriadNotes(root, quality, inversion);
  const labels = getTriadDegreeLabels(inversion);
  const candidates = [];
  for (let i = 0; i < 3; i++) {
    const strIdx = startStringIdx + i;
    if (strIdx >= 6) return null;
    const openNote = STANDARD_TUNING[strIdx];
    const target = triadNotes[2 - i];
    const baseFret = ((target - openNote) % 12 + 12) % 12;
    const frets = [];
    for (let f = baseFret; f <= NUM_FRETS; f += 12) frets.push(f);
    candidates.push({ strIdx, frets, target, degree: labels[2 - i] });
  }
  let best = null, bestSpan = 999;
  for (const f0 of candidates[0].frets)
    for (const f1 of candidates[1].frets)
      for (const f2 of candidates[2].frets) {
        const span = Math.max(f0,f1,f2) - Math.min(f0,f1,f2);
        if (span < bestSpan) { bestSpan = span; best = [f0,f1,f2]; }
      }
  if (!best || bestSpan > 5) return null;
  return candidates.map((c, i) => ({
    string: c.strIdx, fret: best[i], note: noteName(c.target), degree: c.degree
  }));
}

function majorScale(r) { return [0,2,4,5,7,9,11].map(s => (r+s)%12); }
function minorScale(r) { return [0,2,3,5,7,8,10].map(s => (r+s)%12); }
function majorPent(r) { return [0,2,4,7,9].map(s => (r+s)%12); }
function minorPent(r) { return [0,3,5,7,10].map(s => (r+s)%12); }
function chordNotes(r, q) { return TRIAD_INTERVALS[q].map(i => (r+i)%12); }

function modeScale(r, steps) { return steps.map(s => (r+s)%12); }
const MODES = [
  { name: "Ionian", steps: [0,2,4,5,7,9,11], desc: "Mode 1 — major scale" },
  { name: "Dorian", steps: [0,2,3,5,7,9,10], desc: "Mode 2 — minor with bright 6th" },
  { name: "Phrygian", steps: [0,1,3,5,7,8,10], desc: "Mode 3 — minor with flat 2nd" },
  { name: "Lydian", steps: [0,2,4,6,7,9,11], desc: "Mode 4 — major with sharp 4th" },
  { name: "Mixolydian", steps: [0,2,4,5,7,9,10], desc: "Mode 5 — major with flat 7th" },
  { name: "Aeolian", steps: [0,2,3,5,7,8,10], desc: "Mode 6 — natural minor" },
  { name: "Locrian", steps: [0,1,3,5,6,8,10], desc: "Mode 7 — diminished" },
];

function generatePatterns(root, quality) {
  const ri = noteIndex(root);
  const iv=(ri+5)%12, v=(ri+7)%12, ii=(ri+2)%12, vi=(ri+9)%12, iii=(ri+4)%12;
  const p = [];

  // 1. Chords (by number)
  p.push({ name: `ii — ${noteName(ii)} minor`, notes: chordNotes(ii,"minor"), description: "The two chord" });
  p.push({ name: `iii — ${noteName(iii)} minor`, notes: chordNotes(iii,"minor"), description: "The three chord" });
  p.push({ name: `IV — ${noteName(iv)} major`, notes: chordNotes(iv,"major"), description: "The four chord" });
  p.push({ name: `V — ${noteName(v)} major`, notes: chordNotes(v,"major"), description: "The five chord" });
  p.push({ name: `vi — ${noteName(vi)} minor`, notes: chordNotes(vi,"minor"), description: "Relative minor" });

  if (quality === "minor") {
    const rel = (ri+3)%12;
    p.push({ name: `III — ${noteName(rel)} major`, notes: chordNotes(rel,"major"), description: "Relative major" });
  }

  // 2. Pentatonic scales
  p.push({ name: `${root} major pentatonic`, notes: majorPent(ri), description: "5-note major scale" });
  p.push({ name: `${noteName(vi)} minor pentatonic`, notes: minorPent(vi), description: "Relative minor pentatonic" });
  if (quality === "minor") {
    p.push({ name: `${root} minor pentatonic`, notes: minorPent(ri), description: "5-note minor scale" });
  }

  // 3. All 7 modes rooted on the chord root
  for (const mode of MODES) {
    p.push({ name: `${root} ${mode.name}`, notes: modeScale(ri, mode.steps), description: mode.desc });
  }

  return p;
}

function Fretboard({ triadPositions, patternNotes, fretRange, compact }) {
  const triadNoteSet = new Set(triadPositions.map(p => `${p.string}-${p.fret}`));
  const [startFret, endFret] = fretRange;
  const numFrets = endFret - startFret;
  const stringSpacing = compact ? 18 : 24;
  const fretSpacing = compact ? 40 : 48;
  const topPad = compact ? 20 : 28;
  const leftPad = compact ? 12 : 16;
  const w = leftPad + numFrets * fretSpacing + 20;
  const h = topPad + 5 * stringSpacing + 20;
  const dotRadius = compact ? 8 : 10;
  const fretDots = [3,5,7,9,12,15];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {fretDots.filter(f => f >= startFret+1 && f <= endFret).map(f => {
        const x = leftPad + (f - startFret - 1) * fretSpacing + fretSpacing / 2;
        if (f === 12) return <g key={f}>
          <circle cx={x} cy={topPad + 1.5*stringSpacing} r={3} fill="var(--dot-muted)" opacity={0.4}/>
          <circle cx={x} cy={topPad + 3.5*stringSpacing} r={3} fill="var(--dot-muted)" opacity={0.4}/>
        </g>;
        return <circle key={f} cx={x} cy={topPad + 2.5*stringSpacing} r={3} fill="var(--dot-muted)" opacity={0.3}/>;
      })}
      {Array.from({length: numFrets+1}, (_,i) => {
        const x = leftPad + i * fretSpacing;
        const fnum = startFret + i;
        const isNut = fnum === 0;
        return <line key={i} x1={x} y1={topPad} x2={x} y2={topPad + 5*stringSpacing}
          stroke="var(--fret-color)" strokeWidth={isNut ? 3 : 1} opacity={isNut ? 0.8 : 0.3}/>;
      })}
      {Array.from({length:6}, (_,i) => (
        <line key={i} x1={leftPad} y1={topPad + i*stringSpacing}
          x2={leftPad + numFrets*fretSpacing} y2={topPad + i*stringSpacing}
          stroke="var(--string-color)" strokeWidth={1 + i*0.3} opacity={0.5}/>
      ))}
      {Array.from({length: numFrets}, (_,i) => {
        const fnum = startFret + i + 1;
        if (fnum < 0) return null;
        return <text key={i} x={leftPad + i*fretSpacing + fretSpacing/2} y={h - 2}
          textAnchor="middle" fontSize={compact ? 8 : 9} fill="var(--text-muted)" fontFamily="monospace"
        >{fnum}</text>;
      })}
      {/* Build overlap map for triad+pattern coincidence */}
      {(() => {
        const triadMap = {};
        triadPositions.filter(p => p.fret >= startFret && p.fret <= endFret).forEach(p => {
          triadMap[`${p.string}-${p.fret}`] = p;
        });
        const elements = [];
        const offset = compact ? 6 : 8;
        const smallR = compact ? 6 : 7.5;

        // Pattern-only notes
        if (patternNotes) {
          for (let strIdx = 0; strIdx < 6; strIdx++) {
            for (let fIdx = 0; fIdx < numFrets; fIdx++) {
              const fret = startFret + fIdx + 1;
              if (fret < 0 || fret > NUM_FRETS) continue;
              const noteAtFret = (STANDARD_TUNING[strIdx] + fret) % 12;
              if (!patternNotes.has(noteAtFret)) continue;
              const key = `${strIdx}-${fret}`;
              const cx = leftPad + fIdx*fretSpacing + fretSpacing/2;
              const cy = topPad + strIdx*stringSpacing;
              if (triadMap[key]) {
                // Overlapping: draw both side by side
                const tp = triadMap[key];
                elements.push(
                  <g key={`pair-${key}`}>
                    <circle cx={cx - offset} cy={cy} r={smallR} fill="var(--triad-fill)" stroke="var(--triad-stroke)" strokeWidth={1.5}/>
                    <text x={cx - offset} y={cy+(compact?3:3.5)} textAnchor="middle"
                      fontSize={compact?7:8} fill="var(--triad-text)" fontWeight="700" fontFamily="monospace">{tp.degree}</text>
                    <circle cx={cx + offset} cy={cy} r={smallR - 1} fill="var(--pattern-note)" opacity={0.7}/>
                    <text x={cx + offset} y={cy+3} textAnchor="middle" fontSize={compact?6:7}
                      fill="var(--pattern-text)" fontFamily="monospace" fontWeight="500">{noteName(noteAtFret)}</text>
                  </g>
                );
              } else {
                // Pattern only
                elements.push(
                  <g key={`pat-${key}`}>
                    <circle cx={cx} cy={cy} r={dotRadius-2} fill="var(--pattern-note)" opacity={0.6}/>
                    <text x={cx} y={cy+3} textAnchor="middle" fontSize={compact?7:8}
                      fill="var(--pattern-text)" fontFamily="monospace" fontWeight="500">{noteName(noteAtFret)}</text>
                  </g>
                );
              }
            }
          }
        }

        // Triad-only notes (not overlapping with pattern)
        triadPositions.filter(p => p.fret >= startFret && p.fret <= endFret).forEach(p => {
          const key = `${p.string}-${p.fret}`;
          const fIdx = p.fret - startFret - 1;
          const cx = leftPad + fIdx*fretSpacing + fretSpacing/2;
          const cy = topPad + p.string*stringSpacing;
          const noteAtFret = (STANDARD_TUNING[p.string] + p.fret) % 12;
          if (patternNotes && patternNotes.has(noteAtFret)) return; // already drawn as pair
          elements.push(
            <g key={`tri-${key}`}>
              <circle cx={cx} cy={cy} r={dotRadius} fill="var(--triad-fill)" stroke="var(--triad-stroke)" strokeWidth={2}/>
              <text x={cx} y={cy+(compact?3:3.5)} textAnchor="middle"
                fontSize={compact?8:10} fill="var(--triad-text)" fontWeight="700" fontFamily="monospace">{p.degree}</text>
            </g>
          );
        });

        return elements;
      })()}
    </svg>
  );
}

function computeFretRange(triadPositions, padding = 4) {
  const frets = triadPositions.map(p => p.fret);
  return [Math.max(-1, Math.min(...frets) - padding), Math.min(NUM_FRETS, Math.max(...frets) + padding)];
}

const ROOTS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const QUALITIES = ["major", "minor"];
const INVERSIONS = ["Root position", "1st inversion", "2nd inversion"];
const STRING_GROUPS = [
  { label: "E-B-G", idx: 0 },
  { label: "B-G-D", idx: 1 },
  { label: "G-D-A", idx: 2 },
  { label: "D-A-E", idx: 3 },
];

export default function TriadExplorer() {
  const [root, setRoot] = useState("G");
  const [quality, setQuality] = useState("major");
  const [inversion, setInversion] = useState(1);
  const [stringGroup, setStringGroup] = useState(2);
  const [selectedPattern, setSelectedPattern] = useState(null);

  const triadPositions = useMemo(() =>
    findTriadOnStrings(root, quality, inversion, STRING_GROUPS[stringGroup].idx),
    [root, quality, inversion, stringGroup]);

  const patterns = useMemo(() => generatePatterns(root, quality), [root, quality]);

  const fretRange = useMemo(() => {
    if (!triadPositions) return [0, 12];
    return computeFretRange(triadPositions, 4);
  }, [triadPositions]);

  const activePatternNotes = useMemo(() => {
    if (selectedPattern === null) return null;
    return patterns[selectedPattern] ? new Set(patterns[selectedPattern].notes) : null;
  }, [selectedPattern, patterns]);

  const handlePrint = () => window.print();

  if (!triadPositions) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      That voicing doesn't fit on the fretboard. Try a different combination.
    </div>;
  }

  const title = `${root} ${quality} — ${INVERSIONS[inversion]} — ${STRING_GROUPS[stringGroup].label} strings`;

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", color: "var(--text)",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "20px 16px", boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        :root {
          --bg: #0a0a0f; --surface: #13131a; --surface-hover: #1a1a24;
          --border: #2a2a3a; --text: #e0e0e8; --text-muted: #6a6a7a; --text-dim: #4a4a5a;
          --accent: #5a7aff; --accent-glow: rgba(90,122,255,0.15);
          --triad-fill: #5a7aff; --triad-stroke: #8aa0ff; --triad-text: #fff;
          --pattern-note: rgba(255,180,60,0.7); --pattern-text: #1a1a24;
          --fret-color: #3a3a4a; --string-color: #5a5a6a; --dot-muted: #4a4a5a;
          --tag-bg: #1a1a28; --tag-border: #2a2a3a;
          --selected-bg: rgba(90,122,255,0.12); --selected-border: #5a7aff;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .controls { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
        .control-group { display: flex; flex-direction: column; gap: 4px; }
        .control-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); font-weight: 500; }
        .control-options { display: flex; gap: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 2px; }
        .control-btn {
          padding: 6px 10px; border: none; background: transparent; color: var(--text-muted);
          font-family: inherit; font-size: 11px; font-weight: 500; cursor: pointer;
          border-radius: 4px; transition: all 0.15s; white-space: nowrap;
        }
        .control-btn:hover { color: var(--text); background: var(--surface-hover); }
        .control-btn.active { color: var(--accent); background: var(--accent-glow); }
        .main-fretboard { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px 12px 8px; margin-bottom: 24px; }
        .main-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .main-title .chord-name { color: var(--accent); }
        .main-title .inv-tag { font-size: 9px; padding: 2px 6px; background: var(--tag-bg); border: 1px solid var(--tag-border); border-radius: 3px; color: var(--text-muted); font-weight: 400; }
        .patterns-header { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 12px; font-weight: 500; }
        .patterns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
        .pattern-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px; cursor: pointer; transition: all 0.15s; }
        .pattern-card:hover { border-color: var(--text-dim); background: var(--surface-hover); }
        .pattern-card.selected { border-color: var(--selected-border); background: var(--selected-bg); }
        .pattern-name { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .pattern-desc { font-size: 9px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .pattern-notes-list { font-size: 9px; color: var(--text-dim); margin-top: 4px; }
        .print-btn {
          padding: 6px 14px; border: 1px solid var(--border); background: var(--surface);
          color: var(--text-muted); font-family: inherit; font-size: 11px; font-weight: 500;
          cursor: pointer; border-radius: 4px; transition: all 0.15s;
        }
        .print-btn:hover { color: var(--text); background: var(--surface-hover); border-color: var(--accent); }

        @media print {
          :root {
            --bg: #fff; --surface: #fff; --surface-hover: #fff; --border: #ccc;
            --text: #111; --text-muted: #555; --text-dim: #888;
            --accent: #2255cc; --accent-glow: transparent;
            --triad-fill: #2255cc; --triad-stroke: #4477ee; --triad-text: #fff;
            --pattern-note: #dd8800; --pattern-text: #fff;
            --fret-color: #bbb; --string-color: #999; --dot-muted: #ccc;
            --tag-bg: #f0f0f0; --tag-border: #ccc;
            --selected-bg: #eef2ff; --selected-border: #2255cc;
          }
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .main-fretboard { border: 1px solid #ccc; break-inside: avoid; margin-bottom: 12px; }
          .patterns-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .pattern-card { border: 1px solid #ccc; break-inside: avoid; padding: 6px; }
          .pattern-card.selected { border: 2px solid #2255cc; }
        }
        @media not print {
          .print-only { display: none; }
        }
      `}</style>

      {/* Print-only header */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          Triad notes: {getTriadNotes(root, quality, inversion).map(n => noteName(n)).join(" – ")}
          {" · "}<span style={{color:"var(--triad-fill)"}}>●</span> triad
          {" · "}<span style={{color:"var(--pattern-note)"}}>●</span> pattern
        </div>
      </div>

      {/* Controls */}
      <div className="controls no-print">
        <div className="control-group">
          <div className="control-label">Root</div>
          <div className="control-options">
            {ROOTS.map(r => <button key={r} className={`control-btn ${root===r?"active":""}`}
              onClick={() => { setRoot(r); setSelectedPattern(null); }}>{r}</button>)}
          </div>
        </div>
        <div className="control-group">
          <div className="control-label">Quality</div>
          <div className="control-options">
            {QUALITIES.map(q => <button key={q} className={`control-btn ${quality===q?"active":""}`}
              onClick={() => { setQuality(q); setSelectedPattern(null); }}>{q}</button>)}
          </div>
        </div>
        <div className="control-group">
          <div className="control-label">Inversion</div>
          <div className="control-options">
            {INVERSIONS.map((inv,i) => <button key={i} className={`control-btn ${inversion===i?"active":""}`}
              onClick={() => { setInversion(i); setSelectedPattern(null); }}>{inv}</button>)}
          </div>
        </div>
        <div className="control-group">
          <div className="control-label">Strings</div>
          <div className="control-options">
            {STRING_GROUPS.map((sg,i) => <button key={i} className={`control-btn ${stringGroup===i?"active":""}`}
              onClick={() => { setStringGroup(i); setSelectedPattern(null); }}>{sg.label}</button>)}
          </div>
        </div>
        <div className="control-group" style={{ justifyContent: "flex-end" }}>
          <button className="print-btn" onClick={handlePrint}>🖨 Print this view</button>
        </div>
      </div>

      {/* Main fretboard */}
      <div className="main-fretboard">
        <div className="main-title">
          <span className="chord-name">{root} {quality}</span>
          <span className="inv-tag">{INVERSIONS[inversion]}</span>
          <span className="inv-tag">{STRING_GROUPS[stringGroup].label} strings</span>
          {selectedPattern !== null && (
            <span className="inv-tag" style={{ borderColor: "var(--pattern-note)", color: "rgb(255,180,60)" }}>
              + {patterns[selectedPattern].name}
            </span>
          )}
        </div>
        <Fretboard triadPositions={triadPositions} patternNotes={activePatternNotes}
          fretRange={fretRange} compact={false} />
      </div>

      {/* Pattern cards */}
      <div className="patterns-header">Jump to pattern — triad notes highlighted in blue</div>
      <div className="patterns-grid">
        {patterns.map((p, i) => (
          <div key={i} className={`pattern-card ${selectedPattern===i?"selected":""}`}
            onClick={() => setSelectedPattern(selectedPattern===i ? null : i)}>
            <div className="pattern-name">{p.name}</div>
            <div className="pattern-desc">{p.description}</div>
            <Fretboard triadPositions={triadPositions} patternNotes={new Set(p.notes)}
              fretRange={fretRange} compact={true} />
            <div className="pattern-notes-list">{p.notes.map(n => noteName(n)).join(" · ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
