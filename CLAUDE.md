# CLAUDE.md

## Project Overview

Fretboard Explorer is an interactive guitar fretboard visualization tool for exploring triads, 7th chords, diatonic chords, pentatonic scales, and modal scales. It is a zero-dependency, vanilla HTML/JavaScript single-page application with no build system.

## File Structure

```
/
├── index.html           # Entry point — HTML structure + embedded CSS (dark/light/print themes)
├── triad-explorer.js    # All application logic — music theory, SVG rendering, UI state (~444 lines)
└── LICENSE              # MIT License
```

There are only two source files. All code lives at the repository root.

## Technology Stack

- **Vanilla JavaScript** (ES6+) — no framework, no TypeScript, no transpilation
- **Inline CSS** in `index.html` — CSS custom properties for theming, CSS Grid/Flexbox for layout
- **SVG** — fretboard diagrams are generated as inline SVG strings
- **No build system** — no bundler, no package.json, no npm dependencies
- **No tests** — no test framework or test files
- **No CI/CD** — no GitHub Actions or other pipelines

## How to Run

Open `index.html` directly in a browser. No server or build step required. For local development, any static file server works (e.g., `python3 -m http.server`).

## Architecture

### Code Organization (triad-explorer.js)

The file is organized into five clearly-commented sections:

1. **Music theory constants** (lines 1-17) — `NOTES`, `STANDARD_TUNING`, `CHORD_INTERVALS` (triads + 7th chords), helper functions `noteIndex()` / `noteName()`
2. **Chord logic** (lines 19-78) — `getTriadNotes()`, `getTriadDegreeLabels()`, `findVoicingOnStrings()` — compute chord voicings on N consecutive strings using cartesian product span minimization
3. **Scale & pattern generation** (lines 80-181) — `chordNotes()`, pentatonic generators, `MODES` array, `generatePatterns()` — diatonic chords (triads or 7ths based on family), pentatonic scales, blues scale, harmonic/melodic minor, all 7 modes, secondary dominants, borrowed chords, tritone sub; each pattern has a `category` field ("diatonic", "scales", or "functional")
4. **Fretboard rendering** (lines 183-296) — `computeFretRange()`, `renderFretboardSVG()` — SVG generation for fretboard diagrams
5. **UI state & rendering** (lines 298-480) — `state` object, `FAMILY_OPTIONS`, `FAMILY_QUALITIES`, `PATTERN_TABS`, `render()`, `attachEvents()`, bootstrap call

### State Management

A single global mutable `state` object drives the UI:

```js
const state = {
  root: "G",              // Current root note
  family: "triad",        // "triad" or "7th"
  quality: "major",       // Quality within the active family
  inversion: 1,           // 0-2 for triads, 0-3 for 7th chords
  stringGroup: 2,         // 0-3 for triads (3 strings), 0-2 for 7ths (4 strings)
  patternCategory: "all", // "all", "diatonic", "scales", or "functional"
  selectedPattern: null   // Index into patterns array, or null
};
```

State is mutated directly (e.g., `state.root = val`) followed by calling `render()` to re-render the entire UI. There is no virtual DOM or diffing — the full DOM is rebuilt on each render. When switching families, quality/inversion/stringGroup reset to valid defaults.

### Rendering Pipeline

`render()` is the single entry point that rebuilds the entire page:
1. Derives dynamic config from family (inversions, string groups, qualities)
2. Computes voicing via `findVoicingOnStrings()`
3. Generates related patterns via `generatePatterns()`
4. Builds control button rows as HTML strings (Root, Type, Quality, Inversion, Strings)
5. Renders the main fretboard SVG with optional pattern overlay
6. Renders pattern category tabs (All / Diatonic / Scales)
7. Renders pattern cards filtered by active category (each with its own compact fretboard SVG)
8. Re-attaches all event listeners via `attachEvents()`

### SVG Fretboard Rendering

`renderFretboardSVG()` builds SVG markup as a string. It renders:
- Fret position dots (3, 5, 7, 9, 12, 15)
- Fret lines and string lines with variable thickness
- Fret numbers along the bottom
- Chord notes (blue circles with degree labels: 1, 3, 5, 7, etc.)
- Pattern notes (orange circles with note names)
- Overlapping notes get side-by-side display (chord left, pattern right)

The function accepts a `compact` flag for smaller pattern-card renderings.

### DOM Structure (index.html)

```
#print-header    — visible only in print mode
#controls        — button rows for root/type/quality/inversion/strings + print button
#main-board      — main fretboard visualization
#pattern-header  — category filter tabs (All / Diatonic / Scales)
#patterns        — grid of pattern cards (diatonic chords, scales, modes)
```

### Theming

CSS custom properties in `:root` control the dark theme. A `@media print` block overrides them for light/paper output. Key variable groups:
- `--bg`, `--surface`, `--border` — layout colors
- `--triad-fill`, `--triad-stroke`, `--triad-text` — chord note styling
- `--pattern-note`, `--pattern-text` — pattern note styling
- `--fret-color`, `--string-color`, `--dot-muted` — fretboard element colors

## Naming Conventions

- **Functions**: camelCase — `getTriadNotes()`, `renderFretboardSVG()`, `findVoicingOnStrings()`
- **Constants**: SCREAMING_SNAKE_CASE — `NOTES`, `STANDARD_TUNING`, `CHORD_INTERVALS`, `MODES`
- **UI constants**: SCREAMING_SNAKE_CASE — `ROOTS`, `FAMILY_OPTIONS`, `FAMILY_QUALITIES`, `PATTERN_TABS`, `TRIAD_INVERSIONS`, `SEVENTH_INVERSIONS`, `TRIAD_STRING_GROUPS`, `SEVENTH_STRING_GROUPS`
- **Loop variables**: Short abbreviations — `si` (string index), `fi` (fret index), `ri` (root index)
- **Function prefixes**: `get*` (compute/return data), `find*` (search with possible null), `compute*` (calculate derived values), `render*` (produce HTML/SVG), `attach*` (wire up events)

## Music Theory Domain Model

- **Notes**: Chromatic scale as array index 0-11: `["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]`
- **Tuning**: Standard guitar tuning stored as note indices: `[4, 11, 7, 2, 9, 4]` (high E to low E)
- **Triads**: 3-note chords — six qualities: major `[0,4,7]`, minor `[0,3,7]`, dim `[0,3,6]`, aug `[0,4,8]`, sus2 `[0,2,7]`, sus4 `[0,5,7]`
- **7th chords**: 4-note chords — six qualities: maj7 `[0,4,7,11]`, dom7 `[0,4,7,10]`, min7 `[0,3,7,10]`, mM7 `[0,3,7,11]`, dim7 `[0,3,6,9]`, m7b5 `[0,3,6,10]`
- **Degree labels**: Quality-specific — e.g. minor shows ♭3, dim shows ♭3/♭5, dom7 shows ♭7, dim7 shows °7
- **Inversions**: Implemented as array rotation of the chord degree order (3 for triads, 4 for 7ths)
- **String groups**: Triads use 4 groups of 3 consecutive strings; 7ths use 3 groups of 4 consecutive strings
- **Voicing selection**: Cartesian product of all fret options across N strings, picks smallest span (max 5 frets)
- **Patterns**: Diatonic chords (triads or 7th chords matching the active family), pentatonic scales, blues scale, harmonic/melodic minor (for minor qualities), all 7 modes, secondary dominants (V7/ii–V7/vi), borrowed chords (♭III, ♭VI, ♭VII for major qualities), and tritone sub (♭II7); each pattern tagged with a `category` ("diatonic", "scales", or "functional") for tab filtering

## Development Guidelines

- Keep the project as vanilla JS with no build tools or dependencies — this is intentional simplicity
- All logic stays in `triad-explorer.js`; all markup and styles stay in `index.html`
- Maintain the section comment style: `// ── Section Name ──────...`
- When adding features, follow the existing pattern of string-based HTML/SVG generation
- CSS changes go in the `<style>` block in `index.html` using CSS custom properties for theme consistency
- Test changes by opening `index.html` in a browser — there is no automated test suite
- The print stylesheet (`@media print`) must be kept in sync with any visual changes
