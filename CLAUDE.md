# CLAUDE.md

## Project Overview

Music Theory Toolbox — a suite of interactive visualization tools for exploring chords, scales, voicings, progressions, and practice sequences across multiple instruments. Zero-dependency vanilla HTML/JavaScript with no build system.

Three standalone HTML pages, each with tabbed sub-pages:

- **index.html** (Guitar/Fretted instruments) — Fretboard Explorer, Circle of Fifths, Progressions, Scales & Modes, Sequencer
- **piano.html** (Piano) — Scales & Modes, Voicings, Circle of Fifths, Sequencer
- **trumpet.html** (Trumpet) — Scales with B♭ transposition and valve fingerings

## File Structure

```
/
├── index.html                # Guitar page — HTML + embedded CSS (dark/print themes)
├── piano.html                # Piano page — HTML + embedded CSS
├── trumpet.html              # Trumpet page — HTML + embedded CSS
│
├── theory.js                 # Shared music theory: notes, scales, chord intervals,
│                             #   enharmonic spelling, key detection, chord suggestions
├── instruments.js            # Fretted instrument catalogue (guitar, bass, uke, banjo, mandolin)
├── keyboard.js               # Piano keyboard SVG renderer (used by all piano pages)
├── fingering.js              # Trumpet valve fingering chart + SVG renderer
│
├── triad-explorer.js         # Guitar: fretboard voicing explorer (triads/7ths)
├── chord-explorer.js         # Guitar: modal showing all voicings for a clicked chord
├── circle-of-fifths.js       # Guitar: circle of fifths visualization
├── progressions.js           # Guitar: chord progression explorer by genre
├── scales-modes.js           # Guitar: scale/mode positions (CAGED/3NPS)
├── practice-sequencer.js     # Guitar: practice sequencer UI
├── pattern-generators.js     # Guitar: fretboard-based pattern generators
│
├── piano-scales.js           # Piano: scales & modes page
├── piano-voicings.js         # Piano: chord voicing builder (close/open/two-hand)
├── piano-circle.js           # Piano: circle of fifths with keyboard strips
├── piano-sequencer.js        # Piano: practice sequencer UI
├── piano-pattern-generators.js # Piano: MIDI-based pattern generators
│
├── trumpet.js                # Trumpet: scales with transposition + fingerings
│
├── sequence-model.js         # Sequencer data model (shared, instrument-agnostic)
├── playback.js               # Audio engine — Tone.js wrapper (shared, instrument-agnostic)
│
├── theory.test.js            # Tests for theory.js
├── sequence-model.test.js    # Tests for sequence-model.js
├── trumpet.test.js           # Tests for trumpet.js
├── integration.test.js       # Integration tests (DOM simulation + SVG validation)
│
└── LICENSE                   # MIT License
```

## Technology Stack

- **Vanilla JavaScript** (ES6+) — no framework, no TypeScript, no transpilation
- **Inline CSS** in each HTML file — CSS custom properties for theming
- **SVG** — fretboard/keyboard diagrams generated as inline SVG strings
- **Tone.js** — loaded from CDN at runtime for audio playback (lazy-loaded on first use)
- **No build system** — no bundler, no package.json, no npm dependencies
- **Tests** — lightweight Node.js test runner (`node <test>.js`), no test framework

## How to Run

Open any HTML file directly in a browser. No server or build step required. For local development, any static file server works (e.g., `python3 -m http.server`).

Run tests: `node theory.test.js`, `node sequence-model.test.js`, `node trumpet.test.js`, `node integration.test.js`

## Architecture

### Shared Modules

**theory.js** — The foundation. Contains:
- `NOTES`, `CHORD_INTERVALS`, `SCALES` (16 scale types), `SCALE_GROUPS`
- `noteIndex()`, `noteName()`, `spellScale()`, `spellNote()` — note/scale helpers
- `chordPcs()`, `suggestScalesForBracket()` — chord/scale analysis
- `detectKey()`, `romanInKey()`, `suggestNextChords()` — key detection and chord suggestion engine

**instruments.js** — Fretted instrument definitions (tuning, fret count, string groups for triad/7th voicings). Selected instrument stored in `currentInstrumentKey` global.

**keyboard.js** — `renderKeyboardSVG(opts)` — flexible piano keyboard renderer supporting scale highlights, chord notes, degree/note labels, active regions, compact mode.

**playback.js** — Lazy-loads Tone.js from CDN. Supports both fretboard (`{string, fret}`) and piano (`{midi}`) note formats. Simple setTimeout-based scheduler with loop support.

**sequence-model.js** — Step types: `chordStep`, `leadLineStep`, `patternStep`, `restStep`. Validation, serialization, versioning. Instrument-agnostic.

### Page Architecture

Each HTML page loads shared modules via `<script>` tags, then page-specific modules. Each page has its own nav bar switching between tabbed sub-pages. Pages link to each other via `<a>` tags in the nav.

### State Management

Each page/module uses a global mutable state object (e.g., `state`, `pianoScaleState`, `pianoSeqState`). State changes are followed by calling the module's `render*()` function which rebuilds the full DOM for that section. No virtual DOM or diffing.

### Rendering Pattern

All renderers build HTML/SVG as string concatenation, set via `innerHTML`, then re-attach event listeners. Fretboard and keyboard SVGs are pure functions: `(options) → SVG string`.

### Sequencer Architecture

The practice sequencer (guitar and piano versions) shares:
- **Data model** (`sequence-model.js`) — step types, validation, JSON serialization
- **Playback engine** (`playback.js`) — Tone.js wrapper, instrument-agnostic
- **Persistence** — localStorage + URL hash for shareable links

Each instrument has its own sequencer UI:
- `practice-sequencer.js` — fretboard-based rendering, guitar voicings, string/fret patterns
- `piano-sequencer.js` — keyboard-based rendering, piano voicings (close/open/split), MIDI patterns

Chord editor features: key detection across the sequence, chord suggestions grouped by category (diatonic, resolution, borrowed, secondary dominant, relative, chromatic), tonality effect indicators.

## Naming Conventions

- **Functions**: camelCase — `renderFretboardSVG()`, `buildCloseVoicing()`, `detectKey()`
- **Constants**: SCREAMING_SNAKE_CASE — `NOTES`, `CHORD_INTERVALS`, `SCALES`, `DIATONIC_TRIADS`
- **State objects**: camelCase — `state`, `pianoSeqState`, `pianoVoicingState`
- **Loop variables**: Short abbreviations — `si` (string index), `fi` (fret index), `pc` (pitch class)
- **Function prefixes**: `get*` (compute data), `find*` (search, may return null), `compute*` (derived values), `render*` (produce HTML/SVG), `attach*` (wire up events), `build*` (construct complex objects), `detect*` (analysis)

## Music Theory Domain Model

- **Notes**: Chromatic scale as array index 0-11: `["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]`
- **Pitch classes (pc)**: Integer 0-11 representing a note regardless of octave
- **MIDI numbers**: Integer pitch identifiers (60 = middle C). Used by piano voicings and playback
- **Scales**: 16 types from pentatonic to chromatic, each with steps (semitone offsets), degrees, formula
- **Chord intervals**: 12 qualities (6 triads + 6 seventh chords) as semitone arrays
- **Voicings**: Guitar uses `{positions: [{string, fret, degree}]}`, piano uses `{notes: [{midi, degree}]}`
- **Key detection**: Scores chord sequences against all 12 major keys by counting diatonic matches
- **Enharmonic spelling**: `spellScale()` assigns proper accidentals so each letter name appears once

## Development Guidelines

- Keep the project as vanilla JS with no build tools or dependencies — this is intentional simplicity
- Each HTML page is self-contained with its own `<style>` block and `<script>` tags
- Shared logic goes in theory.js; instrument-specific rendering stays in its own module
- Maintain the section comment style: `// ── Section Name ──────...`
- Follow the existing pattern of string-based HTML/SVG generation
- CSS changes use CSS custom properties for theme consistency across dark/print modes
- Test changes by opening the relevant HTML file in a browser
- Run `node <test>.js` files to verify shared module changes
- The print stylesheet (`@media print`) must be kept in sync with visual changes
