# Guitar Theory Toolbox — Design Document

## Overview

A standalone, single-page web application for guitarists learning theory. The app is a collection of interactive visual tools, each focused on a specific concept, but cross-linked so that selecting something in one tool can jump you into another with context preserved. The core principle is **triads as the navigational anchor** — every tool relates back to how shapes, patterns, and relationships appear on the fretboard relative to chord voicings the player already knows.

The app runs entirely client-side (HTML/CSS/JS, no backend) and is designed to be printable — every view has a print-friendly layout.

---

## Architecture

### Navigation

A persistent top bar with tool icons/names. Selecting a tool swaps the main content area. The top bar also shows a **global key selector** (root + quality) that feeds into whichever tool is active, so switching from the Circle of Fifths to the Triad Explorer keeps your key context.

### Global State

A shared state object holds:

- `root` — selected root note (C through B)
- `quality` — major or minor (expandable to dominant, diminished, augmented later)
- `selectedNotes` — a set of active pitch classes, updated by whichever tool is driving
- `fretboardHighlight` — positions to highlight on any fretboard view
- `stringGroup` — preferred string group for triad voicings (E-B-G, B-G-D, G-D-A, D-A-E)

Tools read from and write to this state. When a tool updates `root`, other tools react. This is what enables cross-linking — clicking "show on fretboard" in the Circle of Fifths pushes notes into the shared state and switches to the Scales tool.

### Fretboard Renderer

A single shared fretboard SVG component used across all tools. It accepts:

- `positions` — array of `{string, fret, label, color, group}` for dots
- `overlaps` — how to handle two dots on the same spot (side-by-side, as built in the triad explorer)
- `fretRange` — auto-calculated or manually set
- `compact` — boolean for thumbnail vs full-size rendering
- `tuning` — defaults to standard, but configurable (supports drop D, open G, etc.)
- `orientation` — horizontal (default) or vertical
- `stringLabels` — show/hide string names

This component is the visual backbone of the whole app. Every tool composes it differently but the rendering logic is shared.

### Print System

Every tool view has a print button. On click, the app applies a print stylesheet that:

- Swaps to light theme via CSS variables
- Hides navigation and controls
- Shows a header with the current tool name, key, and legend
- Lays out pattern cards in a 2-column grid
- Sets `break-inside: avoid` on cards

Since this is a standalone HTML file, `window.print()` works natively.

### Data Layer

All music theory data is computed, not stored. Functions for:

- Interval arithmetic (semitone math, mod 12)
- Scale/mode generation from step patterns
- Chord construction from intervals
- Triad voicing finder (tightest-cluster algorithm from the existing triad explorer)
- CAGED shape definitions (fret offset patterns per shape)
- Fretboard note mapping (tuning + fret → pitch class)

No external data files. Everything derives from the 12 notes and interval math.

---

## Tools

### 1. Triad Explorer

*Already built. This section documents its final feature set for consistency.*

**Purpose:** Show how a specific triad voicing (root, quality, inversion, string group) relates to other chords, scales, and modes on the fretboard.

**Controls:**
- Root note selector
- Quality (major / minor)
- Inversion (root position / 1st / 2nd)
- String group (E-B-G / B-G-D / G-D-A / D-A-E)

**Main View:**
- Large fretboard showing the selected triad voicing with degree labels (1, 3, 5)
- Fret range auto-calculated to center on the voicing with padding

**Pattern Cards (below main view):**
Each card shows a compact fretboard with the triad notes highlighted in blue and the pattern notes in orange. Where triad and pattern notes overlap, both dots appear side by side.

Card order:
1. Diatonic chords by number (ii, iii, IV, V, vi)
2. Pentatonic scales (major, relative minor)
3. All 7 modes (Ionian through Locrian), rooted on the chord root

**Cross-links:**
- Clicking a chord card could jump to the Triad Explorer with that chord selected
- Clicking a scale/mode card could jump to the Scales & Modes tool with that scale active
- A "show in CAGED" link on the main voicing opens the CAGED tool centered on the nearest CAGED shape

---

### 2. Circle of Fifths

**Purpose:** Interactive visualization of key relationships, showing how keys relate to each other and which chords belong to each key.

**Main View:**
- Circular SVG diagram with 12 key segments arranged in fifths
- Outer ring: major keys
- Inner ring: relative minor keys
- Currently selected key is highlighted
- Clicking any segment selects that key and updates global state

**Overlay Modes (toggle buttons):**
- **Diatonic chords:** Highlight the 7 segments that belong to the current key's diatonic set, labeled with Roman numerals (I, ii, iii, IV, V, vi, vii°)
- **Common progressions:** Select a progression template (I-IV-V-I, I-V-vi-IV, ii-V-I, I-vi-ii-V, 12-bar blues) and see the involved chords highlighted with arrows showing the progression order
- **Key signatures:** Show sharps/flats count for each key
- **Borrowed chords:** Toggle to show common borrowed chords from parallel minor/major, highlighted in a different color

**Information Panel (beside the circle):**
- Lists the 7 diatonic chords for the selected key with quality labels
- Shows the key signature (sharps/flats and which notes)
- Lists common modulation targets (relative minor/major, dominant key, subdominant key)

**Cross-links:**
- Clicking a chord in the info panel jumps to the Triad Explorer with that chord selected
- "Show scale on fretboard" jumps to Scales & Modes
- Selecting a progression jumps to the Tab Builder with that progression loaded

---

### 3. CAGED System

**Purpose:** Show how the 5 CAGED shapes (C, A, G, E, D open chord shapes) tile across the fretboard for any given root, and how they connect to scales and arpeggios.

**Controls:**
- Root note selector
- Quality (major / minor — minor uses Am, Em, Dm shapes)
- Shape selector: highlight one shape or show all 5 simultaneously
- Layer toggles: chord tones only / add scale tones / add arpeggio extensions

**Main View:**
- Full fretboard (frets 0–15) showing all 5 CAGED shapes in different colors
- Each shape region is subtly shaded to show its zone
- Chord tones within each shape are labeled with degrees (1, 3, 5)
- The root notes across all shapes are connected with a visual line or highlighted consistently to show the root note roadmap

**Shape Detail Panel:**
When a single shape is selected:
- Enlarged view of just that shape's zone
- Shows the open chord form it derives from (e.g., "this is the E-shape barre chord")
- Overlay toggles for:
  - Pentatonic pattern that lives in this shape
  - Full major/minor scale pattern in this position
  - Arpeggio pattern (triad or 7th)
- Fingering suggestion (which fingers on which frets)

**Connection View:**
- Shows two adjacent CAGED shapes and how they overlap
- Highlights the shared notes between shapes as transition points
- Useful for practicing moving between positions

**Cross-links:**
- Clicking a chord tone cluster within a shape jumps to Triad Explorer with the nearest inversion on the appropriate string group
- "Show scale pattern" jumps to Scales & Modes filtered to that position
- Root notes link to Circle of Fifths

---

### 4. Scales & Modes

**Purpose:** Visualize any scale or mode on the fretboard, with multiple position/pattern views and interval analysis.

**Controls:**
- Root note selector
- Scale type selector, organized in groups:
  - **Diatonic modes:** Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian
  - **Pentatonic:** Major pentatonic, Minor pentatonic, Blues scale (minor pent + b5)
  - **Harmonic/Melodic:** Harmonic minor, Melodic minor (ascending), and their modes
  - **Symmetric:** Whole tone, Diminished (whole-half), Diminished (half-whole), Chromatic
- Position selector: full neck / per-position (based on CAGED zones or 3-note-per-string patterns)
- Pattern type: CAGED-based positions / 3-note-per-string / horizontal (single string)

**Main View:**
- Full fretboard with all scale notes shown
- Root notes are visually distinct (larger dot, different color, or ring)
- Each note labeled with either note name or scale degree (toggle between them)
- Interval formula displayed above the fretboard (e.g., W-W-H-W-W-W-H for Ionian)

**Position Cards (below main view):**
- One card per playable position across the neck
- Each shows a compact fretboard with that position's fingering pattern
- Cards are ordered by fret position, low to high
- The currently selected position is highlighted on the main fretboard

**Interval Comparison Panel:**
- When two scales are compared: show notes unique to each and notes shared
- Useful for understanding the "one note difference" between modes (e.g., Dorian vs Aeolian differs only in the 6th)

**Practice Feature:**
- "Random note quiz" — highlights a position on the fretboard and asks the user to identify the scale degree
- Sequence generator — shows suggested practice sequences (ascending 3rds, 4ths, etc.) as tab snippets

**Cross-links:**
- Clicking a triad within the scale notes jumps to Triad Explorer
- "Show in Circle of Fifths" highlights the parent key
- Each position links to the CAGED shape it corresponds to

---

### 5. Intervals

**Purpose:** Dedicated interval reference and ear training visualization. Shows what every interval looks like on the fretboard and how intervals combine to form chords and scales.

**Controls:**
- Reference note selector (the "from" note)
- Interval selector: m2, M2, m3, M3, P4, tritone, P5, m6, M6, m7, M7, octave
- Direction: ascending / descending
- String pair filter: show interval shapes on specific string pairs or all pairs

**Main View:**
- Fretboard showing the reference note and all instances of the selected interval from that note
- Lines or arrows connecting the reference note to each interval instance
- Each interval instance labeled with the target note name
- Shapes are grouped by string pair since the same interval has different fret geometries depending on which two strings it spans (and whether the G-B string pair is involved)

**Interval Shape Reference:**
- Grid showing all 12 intervals, each as a mini fretboard showing the geometric shape on each string pair
- Highlights the G-B irregularity — same interval, different shape
- Shows both the "same string" version (fret distance) and "cross-string" versions

**Compound Intervals Panel:**
- Shows how intervals stack to form chords:
  - Major triad = M3 + m3
  - Minor triad = m3 + M3
  - Dominant 7th = M3 + m3 + m3
  - Major 7th = M3 + m3 + M3
  - etc.
- Each formula is clickable to show the chord on the fretboard

**Inversions Reference:**
- For the selected interval, show its inversion (complement to octave)
- e.g., selecting M3 also shows m6, with both shapes visible

**Cross-links:**
- Clicking a chord formula jumps to Triad Explorer (for triads) or a future chord voicing tool (for 7ths)
- "Hear this interval" — future feature, could use Web Audio API to play the two notes
- Each interval links to the scales that contain it prominently

---

### 6. Tab Builder

**Purpose:** Build guitar tablature from chord progressions. Select chords, choose voicings, set a strumming/picking pattern, and generate printable tab.

**Controls:**
- Key selector (pre-populates diatonic chord palette)
- Chord palette: buttons for each diatonic chord in the selected key, plus a custom chord input
- Time signature selector (4/4, 3/4, 6/8)
- Tempo (BPM) — for playback if audio is added later

**Progression Builder:**
- Horizontal timeline showing measures
- Drag chords from the palette into measure slots
- Each measure can hold 1, 2, or 4 chords (whole, half, quarter note durations)
- Click a chord in the timeline to select its voicing

**Voicing Selector:**
When a chord in the timeline is selected:
- Shows available voicings (open chord, barre shapes, triad voicings from the Triad Explorer)
- Each voicing shown as a mini chord diagram
- Select a voicing to lock it in for that chord in the progression
- Option to auto-select voicings that minimize hand movement between chords (voice leading optimization)

**Pattern Layer:**
- Strum pattern selector: common patterns visualized as arrows (down/up/rest)
- Fingerpicking pattern selector: common patterns (Travis picking, arpeggiated, etc.)
- The pattern applies to all chords unless overridden per-chord

**Tab Output:**
- Standard 6-line tab notation generated from the chord voicings + pattern
- Shows chord names above the tab
- Barlines, time signature, and repeat signs
- Rendered as a monospaced text block or SVG for clean printing

**Export Options:**
- Print (via the standard print system)
- Copy as text (plain ASCII tab, paste into any text editor)
- Download as PDF

**Cross-links:**
- Each chord in the progression links to its Triad Explorer view
- "Show progression on Circle of Fifths" highlights the chords and shows the movement
- Voicing options pull from CAGED and Triad Explorer data

---

## Cross-linking System

The power of the app is that tools aren't isolated. Cross-links work by updating global state and switching the active tool. Implementation pattern:

```
function jumpTo(tool, params) {
  Object.assign(state, params);  // e.g., { root: "G", quality: "major" }
  setActiveTool(tool);           // switches visible panel
  render();                      // re-renders with new state
}
```

Every "show in X" link calls this function. The target tool reads from global state on render, so it always reflects the current context.

**Key cross-link paths:**

| From | To | Trigger |
|---|---|---|
| Circle of Fifths | Triad Explorer | Click a diatonic chord |
| Circle of Fifths | Scales & Modes | "Show scale on fretboard" |
| Circle of Fifths | Tab Builder | Select a progression template |
| Triad Explorer | Scales & Modes | Click a scale/mode pattern card |
| Triad Explorer | CAGED | "Show in CAGED" on main voicing |
| CAGED | Triad Explorer | Click a chord tone cluster |
| CAGED | Scales & Modes | "Show scale in this position" |
| Scales & Modes | Triad Explorer | Click a triad within the scale |
| Scales & Modes | Intervals | Click an interval within the scale |
| Intervals | Triad Explorer | Click a chord formula |
| Tab Builder | Triad Explorer | Click a chord in the progression |
| Tab Builder | Circle of Fifths | "Show progression" |

---

## Tuning Support

All tools respect a global tuning setting. Default is standard (EADGBE) but the settings panel allows:

- Standard (EADGBE)
- Drop D (DADGBE)
- Open G (DGDGBD)
- Open D (DADF#AD)
- DADGAD
- Custom (user enters 6 notes)

Changing the tuning recalculates all fretboard positions across all tools. The CAGED tool should show a warning when using non-standard tunings since the shapes don't directly apply.

---

## Visual Design

### Theme
- Dark theme by default (dark navy/charcoal background, blue accents for chord tones, orange for scale/pattern tones)
- Light theme for print
- Colors are defined as CSS variables so theming is a single swap

### Color Language (consistent across all tools)
- **Blue** (`--triad-fill`): Chord tones / primary highlighted notes
- **Orange** (`--pattern-note`): Scale tones / secondary pattern notes
- **Green** (future): Root notes when distinct from chord tones
- **Red** (future): Tension notes, avoid notes, or chromatic passing tones
- **Gray**: Inactive fretboard elements, muted UI

### Typography
- Monospace font (JetBrains Mono) for all note names, fret numbers, and tab output
- Same font for UI controls to maintain the "instrument tool" feel

### Responsive Behavior
- Controls wrap on narrow screens
- Fretboard SVGs scale proportionally (viewBox-based)
- Pattern card grids collapse to single column on mobile
- Print layout always uses 2-column grid regardless of screen size

---

## Implementation Notes

### Technology
- Vanilla HTML/CSS/JS or a single-file framework (Preact, lightweight React build)
- No build step required — runs from a single HTML file or a minimal set of files
- All music theory logic in a shared module (`theory.js`)
- All fretboard rendering in a shared module (`fretboard.js`)
- Each tool in its own module (`triad-explorer.js`, `circle-of-fifths.js`, etc.)

### File Structure
```
index.html
css/
  theme.css          — CSS variables, print styles
  controls.css       — shared control styling
  fretboard.css      — fretboard-specific styles
js/
  theory.js          — notes, intervals, scales, chords, voicing algorithms
  fretboard.js       — shared SVG fretboard renderer
  state.js           — global state management, cross-linking
  tools/
    triad-explorer.js
    circle-of-fifths.js
    caged.js
    scales-modes.js
    intervals.js
    tab-builder.js
```

### Performance
- SVG rendering is fast for this scale (hundreds of elements, not thousands)
- Pattern cards use compact mode to reduce SVG complexity
- No framework virtual DOM overhead if using vanilla JS
- Fretboard positions are memoized per (tuning, root, scale) combination

### Future Expansion
- **Audio playback:** Web Audio API to play notes, chords, scales, and progressions
- **Ear training quizzes:** Interval and chord identification games
- **Chord voicing library:** Searchable database of voicings beyond triads (7ths, 9ths, sus, add chords)
- **Fretboard note trainer:** Timed quiz for identifying notes at random positions
- **Progression analysis:** Paste in chord symbols and get Roman numeral analysis, key detection, and borrowed chord identification
- **User presets:** Save favorite keys, progressions, and voicings to localStorage
