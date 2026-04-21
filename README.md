# Music Theory Toolbox

An interactive suite of music theory visualization tools for guitar, piano, and trumpet. Explore chords, scales, voicings, progressions, and practice sequences — all in the browser with zero dependencies.

## Quick Start

Open any HTML file in a browser. No install, no build step, no server required.

| Page | Instruments | Features |
|------|------------|----------|
| `index.html` | Guitar, Bass, Ukulele, Banjo, Mandolin | Fretboard explorer, Circle of Fifths, Progressions, Scales & Modes, Practice Sequencer |
| `piano.html` | Piano | Scales & Modes, Voicings, Circle of Fifths, Practice Sequencer |
| `trumpet.html` | B-flat Trumpet | Scales with transposition and valve fingerings |

## Features

### Fretboard Explorer (Guitar page)

Visualize triads and 7th chords across the fretboard:
- 12 chord qualities (major, minor, dim, aug, sus2, sus4, maj7, dom7, min7, mM7, dim7, m7b5)
- All inversions and string groups
- Diatonic chords, pentatonic scales, modes, secondary dominants, borrowed chords
- Multiple fretted instruments with accurate tunings

### Piano Voicings

Explore chord voicings on a piano keyboard:
- Close, open, and two-hand (split) voicing styles
- All inversions with degree labels
- Diatonic chord patterns in any key

### Scales & Modes

Full scale visualization on fretboard or keyboard:
- 7 modes (Ionian through Locrian)
- Pentatonic (major, minor, blues)
- Harmonic minor, melodic minor
- Symmetric scales (whole tone, diminished, chromatic)
- Guitar: CAGED and 3-note-per-string position patterns

### Circle of Fifths

Interactive circle of fifths with:
- Key signature display
- Diatonic chord strips with voicings
- Borrowed chords from parallel minor
- Available on both guitar and piano pages

### Chord Progressions (Guitar page)

Browse common progressions by genre:
- Pop, Rock, Jazz, Blues, Folk, Classical, R&B/Soul, Country
- Roman numeral analysis with chord names in any key
- Click any chord to see its voicing

### Practice Sequencer

Build and play back practice sequences:
- **Chord steps** — pick root, quality, voicing; intelligent chord suggestions with key detection
- **Lead line steps** — scale suggestions based on surrounding chords, with landing zone indicators
- **Pattern steps** — click notes on the fretboard/keyboard, or auto-generate with pattern algorithms
- **Rest steps** — configurable duration
- Audio playback with tempo control and looping
- Drag-and-drop step reordering
- Shareable sequences via URL

#### Chord Suggestions

The sequencer analyzes your chord sequence to detect the overall tonality and suggests:
- **Diatonic chords** in the detected key
- **Common resolutions** based on voice leading from the previous chord (V-I, ii-V, IV-V)
- **Relative major/minor** chords
- **Borrowed chords** from the parallel minor (bIII, bVI, bVII, iv)
- **Secondary dominants** (V7/ii, V7/iii, etc.)
- **Chromatic motion** (half/whole step movement)

Each suggestion shows its roman numeral in the detected key and indicates whether it confirms or shifts the tonality.

### Trumpet Scales

B-flat trumpet scale reference with:
- Automatic concert-to-written pitch transposition
- Valve combination fingering diagrams
- All scale types from the shared theory engine

## Technical Details

- **Vanilla JavaScript** (ES6+) — no frameworks, no build tools, no npm
- **Inline CSS** with custom properties for dark theme and print support
- **SVG rendering** — all diagrams generated as inline SVG strings
- **Tone.js** — loaded from CDN on demand for audio playback
- **LocalStorage** — sequencer state persists across sessions
- **URL hash** — sequences can be shared via encoded URLs

### Running Tests

```bash
node theory.test.js
node sequence-model.test.js
node trumpet.test.js
node integration.test.js
```

## License

MIT
