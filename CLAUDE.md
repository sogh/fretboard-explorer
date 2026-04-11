# CLAUDE.md

## Project Overview

Fretboard Explorer is an interactive guitar fretboard visualization tool for exploring triads, diatonic chords, pentatonic scales, and modal scales. It is a zero-dependency, vanilla HTML/JavaScript single-page application with no build system.

## File Structure

```
/
├── index.html           # Entry point — HTML structure + embedded CSS (dark/light/print themes)
├── triad-explorer.js    # All application logic — music theory, SVG rendering, UI state (~340 lines)
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

The file is organized into four clearly-commented sections:

1. **Music theory constants** (lines 1-10) — `NOTES`, `STANDARD_TUNING`, `TRIAD_INTERVALS`, helper functions `noteIndex()` / `noteName()`
2. **Triad logic** (lines 12-54) — `getTriadNotes()`, `getTriadDegreeLabels()`, `findTriadOnStrings()` — compute triad voicings on the fretboard
3. **Scale & pattern generation** (lines 56-105) — `chordNotes()`, pentatonic generators, `MODES` array, `generatePatterns()` — diatonic chords, pentatonic scales, and all 7 modes
4. **Fretboard rendering** (lines 107-220) — `computeFretRange()`, `renderFretboardSVG()` — SVG generation for fretboard diagrams
5. **UI state & rendering** (lines 222-340) — `state` object, `render()`, `attachEvents()`, bootstrap call

### State Management

A single global mutable `state` object drives the UI:

```js
const state = {
  root: "G",              // Current root note
  quality: "major",       // "major" or "minor"
  inversion: 1,           // 0, 1, or 2
  stringGroup: 2,         // 0-3 (which 3 consecutive strings)
  selectedPattern: null   // Index into patterns array, or null
};
```

State is mutated directly (e.g., `state.root = val`) followed by calling `render()` to re-render the entire UI. There is no virtual DOM or diffing — the full DOM is rebuilt on each render.

### Rendering Pipeline

`render()` is the single entry point that rebuilds the entire page:
1. Computes triad positions via `findTriadOnStrings()`
2. Generates related patterns via `generatePatterns()`
3. Builds control button rows as HTML strings
4. Renders the main fretboard SVG with optional pattern overlay
5. Renders pattern cards (each with its own compact fretboard SVG)
6. Re-attaches all event listeners via `attachEvents()`

### SVG Fretboard Rendering

`renderFretboardSVG()` builds SVG markup as a string. It renders:
- Fret position dots (3, 5, 7, 9, 12, 15)
- Fret lines and string lines with variable thickness
- Fret numbers along the bottom
- Triad notes (blue circles with degree labels: 1, 3, 5)
- Pattern notes (orange circles with note names)
- Overlapping notes get side-by-side display (triad left, pattern right)

The function accepts a `compact` flag for smaller pattern-card renderings.

### DOM Structure (index.html)

```
#print-header  — visible only in print mode
#controls      — button rows for root/quality/inversion/strings + print button
#main-board    — main fretboard visualization
#patterns      — grid of pattern cards (diatonic chords, scales, modes)
```

### Theming

CSS custom properties in `:root` control the dark theme. A `@media print` block overrides them for light/paper output. Key variable groups:
- `--bg`, `--surface`, `--border` — layout colors
- `--triad-fill`, `--triad-stroke`, `--triad-text` — triad note styling
- `--pattern-note`, `--pattern-text` — pattern note styling
- `--fret-color`, `--string-color`, `--dot-muted` — fretboard element colors

## Naming Conventions

- **Functions**: camelCase — `getTriadNotes()`, `renderFretboardSVG()`, `computeFretRange()`
- **Constants**: SCREAMING_SNAKE_CASE — `NOTES`, `STANDARD_TUNING`, `TRIAD_INTERVALS`, `MODES`
- **UI constants**: SCREAMING_SNAKE_CASE — `ROOTS`, `QUALITIES`, `INVERSIONS`, `STRING_GROUPS`
- **Loop variables**: Short abbreviations — `si` (string index), `fi` (fret index), `ri` (root index)
- **Function prefixes**: `get*` (compute/return data), `find*` (search with possible null), `compute*` (calculate derived values), `render*` (produce HTML/SVG), `attach*` (wire up events)

## Music Theory Domain Model

- **Notes**: Chromatic scale as array index 0-11: `["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]`
- **Tuning**: Standard guitar tuning stored as note indices: `[4, 11, 7, 2, 9, 4]` (high E to low E)
- **Triads**: Root + 3rd + 5th, with major `[0,4,7]` and minor `[0,3,7]` intervals
- **Inversions**: Implemented as array rotation of the triad degree order
- **String groups**: 4 groups of 3 consecutive strings: E-B-G, B-G-D, G-D-A, D-A-E
- **Voicing selection**: Finds all fret combinations for a triad on 3 strings, picks smallest span (max 5 frets)
- **Patterns**: Diatonic chords (ii, iii, IV, V, vi), pentatonic scales, and all 7 modes generated relative to the selected root

## Development Guidelines

- Keep the project as vanilla JS with no build tools or dependencies — this is intentional simplicity
- All logic stays in `triad-explorer.js`; all markup and styles stay in `index.html`
- Maintain the section comment style: `// ── Section Name ──────...`
- When adding features, follow the existing pattern of string-based HTML/SVG generation
- CSS changes go in the `<style>` block in `index.html` using CSS custom properties for theme consistency
- Test changes by opening `index.html` in a browser — there is no automated test suite
- The print stylesheet (`@media print`) must be kept in sync with any visual changes
