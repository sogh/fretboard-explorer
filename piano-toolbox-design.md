# Piano Theory Toolbox — Design Document

## Overview

A standalone, single-page web application for pianists learning theory. The companion to the Guitar Theory Toolbox, sharing the same music theory engine but with a keyboard-native visualization layer. Where the guitar version treats triads-on-strings as the navigational anchor, the piano version uses **voicings across the keyboard** — how chords are spaced between two hands, how inversions move across octaves, and how scales and patterns lay under the fingers.

The piano's layout is more visually direct than the guitar's — every note has exactly one location per octave, there's no tuning irregularity, and intervals have a single consistent geometry. This means some tools simplify (intervals become trivial to show) while others deepen (voicing and hand position become the central challenge).

Runs entirely client-side. Every view is printable.

---

## Architecture

### Shared With Guitar Version

The following are identical and should be a shared codebase if both apps are maintained together:

- **Music theory engine** — note math, interval arithmetic, scale/mode generation, chord construction, circle of fifths logic, progression templates
- **Global state model** — root, quality, selected notes, active tool
- **Cross-linking system** — `jumpTo(tool, params)` pattern
- **Print system** — CSS variable swap, `window.print()`
- **Color language** — blue for chord tones, orange for scale tones, same semantic meaning

### Piano-Specific

- **Keyboard renderer** replaces the fretboard renderer as the core visual component
- **Hand position system** replaces string groups and CAGED shapes
- **Fingering engine** replaces fret-finding algorithms
- No tuning configuration (piano is always equal temperament, fixed layout)

---

## Keyboard Renderer

The equivalent of the guitar's fretboard SVG. A single shared component used across all tools.

### Visual Design

An SVG piano keyboard showing 1–4 octaves (configurable). White keys are tall rectangles, black keys are shorter and narrower, overlapping from above — standard piano diagram conventions.

### Input Parameters

- `range` — start and end note (e.g., C3 to C6), determines how many octaves to show
- `highlightedNotes` — array of `{pitch, color, label, group}` objects
  - `pitch` — MIDI note number or note name + octave (e.g., "C4")
  - `color` — which semantic color (chord tone, scale tone, root, etc.)
  - `label` — text to show on the key (note name, scale degree, finger number, interval name)
  - `group` — for distinguishing left hand vs right hand, or chord vs scale
- `overlaps` — how to handle multiple labels on one key (stack vertically, show both)
- `compact` — boolean for thumbnail vs full-size
- `showNoteNames` — toggle note names on all keys (not just highlighted ones)
- `activeRegion` — highlight a span of keys to indicate a hand position zone

### Interaction

- Clicking a key selects it (updates global state)
- Hovering a key shows its note name and any active labels in a tooltip
- Optional: Web Audio API plays the note on click (future feature, same as guitar version)

### Rendering Modes

- **Flat view** — standard top-down keyboard diagram, keys as rectangles
- **Perspective view** — slight 3D angle for visual interest (optional, CSS transform)
- **Minimal view** — just the key outlines with colored dots, for compact pattern cards

---

## Tools

### 1. Chord Voicing Explorer

*Replaces the guitar's Triad Explorer. The core concept shifts from "which strings" to "which hand positions and spacings."*

**Purpose:** Show how a chord can be voiced across the keyboard — close position, open position, spread voicings, shell voicings — and how each voicing relates to scales and other chords.

**Controls:**
- Root note selector
- Chord type: triad (major, minor, diminished, augmented), 7th (maj7, dom7, min7, min7b5, dim7), extended (9, 11, 13) — piano can handle larger chords than guitar since you have 10 fingers
- Inversion selector (root, 1st, 2nd, 3rd for 7ths)
- Voicing style:
  - **Close position** — all notes within one octave, right hand
  - **Open position** — notes spread across more than an octave
  - **Two-hand split** — bass note(s) in left hand, upper structure in right hand (the most common real-world piano voicing)
  - **Shell voicing** — root + 3rd + 7th only (jazz essential)
  - **Rootless voicing** — 3rd + 7th + extensions, left hand (assumes bass player has the root)

**Main View:**
- 2-octave keyboard showing the selected voicing
- Left hand notes and right hand notes distinguished by color intensity or separate labels (L/R or finger numbers)
- Degree labels on each key (1, 3, 5, 7, etc.)
- Interval labels between adjacent chord tones shown as arcs or brackets above the keyboard

**Pattern Cards (below main view):**
Same concept as guitar version. Each card shows a compact keyboard with the chord tones highlighted and a pattern overlaid:

Card order:
1. Diatonic chords by number (ii, iii, IV, V, vi, vii°)
2. Pentatonic scales
3. All 7 modes
4. Common two-hand voicing alternatives for the same chord

Each card highlights where chord tones and pattern tones overlap (side by side or stacked label, same logic as guitar version but adapted to key shapes).

**Piano-Specific Features:**
- **Voice leading view:** Select two chords and see the optimal voice leading — which notes sustain, which move by half step, which move by whole step. Lines connect the notes of chord 1 to chord 2 showing the movement. This is much more visually clear on piano than guitar because each note has one position.
- **Hand span indicator:** Shows the physical reach required for each voicing (e.g., "span: minor 9th — large hands only")

**Cross-links:**
- Clicking a chord card jumps to that chord's voicing explorer view
- Clicking a scale card jumps to Scales & Modes
- Voice leading pairs link to the Tab Builder (lead sheet mode)

---

### 2. Circle of Fifths

**Purpose:** Identical in concept to the guitar version. The circle itself is instrument-agnostic — it's pure theory.

**Main View:** Same circular SVG diagram with key segments, diatonic chord highlighting, progression templates, key signature display.

**Piano-Specific Addition:**
- **Key signature keyboard:** Below the circle, a small keyboard shows which keys are sharped/flatted in the selected key signature. Useful for pianists who think in terms of "which black keys am I on."
- **Diatonic chord keyboard strip:** A row of small keyboards, one per diatonic chord, showing the voicing on keys. Gives an immediate visual of "here are all the chords in this key, here's where your hands go."

**Cross-links:** Same as guitar version but pointing to piano-specific tools.

---

### 3. Hand Position System

*Replaces the guitar's CAGED system. Piano doesn't have a direct equivalent to CAGED, but the concept of "positions" — where your hand sits on the keyboard — is equally important.*

**Purpose:** Show how scales and chords are organized into hand positions, with fingering patterns that cover different zones of the keyboard.

**Controls:**
- Root note selector
- Scale type selector
- Hand selector: right hand / left hand / both
- Position: show all positions or isolate one

**Main View:**
- Full keyboard (3–4 octaves) with the scale notes highlighted
- Hand position zones indicated by shaded regions spanning roughly a 5th (thumb to pinky natural reach)
- Finger numbers (1–5) on each note within each position
- Thumb-under and finger-over crossing points clearly marked (these are the hard part of piano scales)

**Position Detail Panel:**
When a single position is selected:
- Enlarged keyboard showing just that zone
- Finger numbers for ascending and descending (they differ on piano)
- Common technical patterns in this position:
  - Alberti bass pattern
  - Broken chord / arpeggio pattern
  - Scale run with correct fingering
- Notation view showing the passage in standard notation alongside the keyboard

**Fingering Reference:**
- Side-by-side comparison of RH and LH fingering for any scale
- Highlights the asymmetry — piano fingering is different in each hand for most scales
- Shows which scales share fingering patterns (all major scales starting on white keys use the same RH fingering except F major and B major)

**Cross-links:**
- Each position links to the chords playable within that hand span
- Scale positions link to the Scales & Modes tool
- Fingering patterns link to the practice builder in Tab Builder (lead sheet mode)

---

### 4. Scales & Modes

**Purpose:** Same concept as guitar version — visualize scales on the instrument with interval analysis and position breakdowns.

**Controls:**
- Root note selector
- Scale type selector (same categories as guitar: diatonic modes, pentatonic, harmonic/melodic minor, symmetric)
- Octave range (1–4 octaves)
- Display mode: note names / scale degrees / finger numbers / intervals

**Main View:**
- Keyboard with all scale notes highlighted across the selected range
- Root notes visually distinct
- Interval formula displayed above the keyboard as a bracket diagram:
  ```
  W   W   H   W   W   W   H
  C — D — E-F — G — A — B-C
  ```
- The whole-step / half-step pattern is immediately visible on the keyboard since half steps are adjacent keys (no black key between) — this is one place piano is more intuitive than guitar

**Pattern Cards:**
- One card per octave showing fingering for that register (fingering can change in extreme registers)
- Cards comparing the current scale to related scales (e.g., "Dorian vs Aeolian: only the 6th differs")
- Cards showing the triads and 7th chords built on each scale degree

**Piano-Specific Features:**
- **Black key map:** A visual showing which black keys are used in this scale, and the resulting hand topography. Pianists think about scales partly in terms of the physical landscape — Db major feels completely different from C major even though the theory is identical, because the hand sits on black keys differently.
- **Contrary motion view:** Shows the scale ascending in RH and descending in LH simultaneously, with fingering. This is a standard piano exercise and the fingering interaction between hands is important to visualize.

**Cross-links:**
- Same as guitar version (triads link to Chord Voicing Explorer, parent key links to Circle of Fifths)

---

### 5. Intervals

**Purpose:** Same concept as guitar, but the visualization is simpler on piano since each interval has exactly one visual distance.

**Controls:**
- Reference note selector
- Interval selector (m2 through octave, plus compound intervals: 9th, 10th, 11th, 13th)
- Direction: ascending / descending

**Main View:**
- Keyboard showing the reference note and all instances of the selected interval across the displayed range
- Arc or bracket connecting each pair
- Distance labeled in half steps and the interval name

**Piano-Specific Simplification:**
On guitar, the same interval has different shapes on different string pairs. On piano, every M3 looks the same — 4 keys apart, same pattern of white and black keys (modulo enharmonics). This means the interval reference grid from the guitar version collapses into a much simpler display. The focus shifts to:

- **Sound and feel** rather than geometric memorization
- **Compound intervals** — piano can easily show 9ths, 10ths, 11ths which are physically awkward on guitar but natural on piano
- **Interval in context** — show the interval within scales that contain it, with the surrounding notes visible

**Interval Stacking Panel:**
Same as guitar version — show how intervals combine to form chords. But extend to:
- 7th chords (M3 + m3 + m3 = dom7)
- Extended chords (9th, 11th, 13th — more practical on piano)
- Cluster chords and quartal voicings (stacked 4ths — a piano specialty)

**Cross-links:** Same as guitar version.

---

### 6. Lead Sheet Builder

*Replaces the guitar's Tab Builder. Piano doesn't use tablature — the equivalent is a lead sheet (chord symbols + melody) or a simple grand staff notation.*

**Purpose:** Build chord progressions with voicings and generate a printable lead sheet or simple notation.

**Controls:**
- Key selector
- Chord palette (diatonic + common extensions + custom)
- Time signature
- Tempo

**Progression Builder:**
- Horizontal timeline with measure slots (same interaction as guitar Tab Builder)
- Drag chords from palette into measures
- Click a chord to select its voicing

**Voicing Selector:**
When a chord is selected:
- Shows available voicings, each as a mini keyboard diagram
- Voicing categories: close position, open position, shell, rootless, two-hand split
- Option to auto-select voicings that minimize hand movement (voice leading optimization — more important and more feasible on piano than guitar)

**Output Formats:**

1. **Lead sheet:** Chord symbols above a staff with slash notation (rhythm only, no specific pitches). Standard jazz/pop format.

2. **Chord chart:** Just the chord symbols with barlines, like a Nashville number chart but with letter names.

3. **Simple notation:** Grand staff (treble + bass) with the actual voicings written out. This is a significantly harder rendering problem — requires a music notation engine. Could start with a simplified version that just shows block chords on the staff.

4. **Keyboard diagram strip:** A row of mini keyboards, one per chord, showing where the hands go. This is the most immediately useful for a learner and the easiest to implement.

**Export Options:**
- Print
- Copy chord chart as text
- Download as PDF
- Future: MusicXML export for import into notation software

**Cross-links:**
- Same connections as guitar version (chords ↔ voicing explorer, progression ↔ circle of fifths)

---

## What Changes From Guitar to Piano

| Concept | Guitar | Piano |
|---|---|---|
| Core visual | 6-string fretboard SVG | Keyboard SVG (white + black keys) |
| Note location | Multiple positions per note (same note on different strings/frets) | One position per note per octave |
| Position system | CAGED shapes | Hand position zones (thumb-to-pinky span) |
| Fingering | Fretting hand finger assignments | Both hands, numbered 1–5, with crossing rules |
| Voicing challenge | String group selection, physical reach across frets | Hand span, two-hand distribution, voice spacing |
| Intervals | Different shapes on different string pairs, G-B irregularity | One consistent visual distance per interval |
| Tab output | 6-line ASCII tab | Lead sheet / chord chart / grand staff notation |
| Tuning | Variable (standard, drop D, open, etc.) | Fixed (equal temperament, one layout) |
| Chord size | Practical max 6 notes (one per string) | Practical max 10 notes (one per finger), commonly 3–5 per hand |
| Unique strength | Showing how shapes tile and repeat across the neck | Showing voice leading, hand independence, and the visual pattern of whole/half steps |

## What Stays The Same

- All music theory logic (scales, modes, intervals, chord construction, circle of fifths)
- Global state model and cross-linking system
- Color language and semantic meaning of highlights
- Print system
- Pattern card layout with compact instrument diagrams
- Tool organization and navigation
- The "anchor" philosophy — start from something concrete (a voicing, a shape) and radiate outward to related theory

---

## Visual Design

### Keyboard Rendering Details

- White keys: solid fill, subtle border, tall rectangles
- Black keys: dark fill, shorter, narrower, positioned between white keys with standard spacing
- Highlighted keys: fill color changes, label appears inside the key
- Black key highlights need high contrast labels (white text on blue/orange fill)
- White key highlights use a colored fill that keeps the key readable
- Hand position zones: subtle background shading behind a group of keys
- Left hand vs right hand: different opacity or a subtle L/R indicator

### Responsive Behavior

- Keyboard SVG scales proportionally via viewBox
- On narrow screens, reduce to 1–2 octave view with octave navigation arrows
- Pattern cards collapse to single column on mobile
- Print always shows the full selected range

### Theme

Same dark/light system as guitar version. The keyboard itself is always white-and-black keys (it would be confusing to invert this in dark mode), but the surrounding UI follows the theme. Highlighted keys use the theme's accent colors.

---

## Implementation Notes

### Shared Codebase

If both guitar and piano versions exist:

```
shared/
  theory.js           — all music theory (notes, intervals, scales, chords)
  state.js            — global state management
  cross-links.js      — tool navigation
  print.js            — print stylesheet logic

guitar/
  fretboard.js        — guitar fretboard renderer
  voicing-guitar.js   — string-based voicing algorithms
  caged.js            — CAGED shape data
  tools/              — guitar-specific tool modules

piano/
  keyboard.js         — piano keyboard renderer
  voicing-piano.js    — hand-position-based voicing algorithms
  fingering.js        — scale and chord fingering engine
  tools/              — piano-specific tool modules
```

The `theory.js` module should be completely instrument-agnostic. Both apps import from it. The split happens only at the visualization and voicing layers.

### Fingering Engine Complexity

Piano fingering is a harder computational problem than guitar fretting. Standard piano fingering rules include:

- Thumb (1) goes on white keys when possible
- Thumb crosses under fingers 3 or 4 during scale passages
- Finger 3 or 4 crosses over the thumb
- Black key clusters affect which fingers are "natural"
- Left hand and right hand fingerings are usually mirror images but not always
- Fingering changes in extreme registers
- Arpeggios have different fingering rules than scales

A pragmatic starting approach: hard-code standard fingerings for all major and minor scales (there are only 24) and common arpeggios, then use a rule-based system for other patterns. Full algorithmic fingering generation is a research-level problem and not needed for a learning tool.

### Notation Rendering

The Lead Sheet Builder's notation output is the hardest rendering challenge. Options in order of complexity:

1. **Keyboard diagram strips only** — no notation, just a row of mini keyboards. Simplest, still very useful.
2. **Chord chart text** — just chord symbols with barlines. Trivial to render.
3. **Slash notation** — single staff with rhythm slashes and chord symbols. Moderate SVG work.
4. **Full grand staff** — use an existing library (VexFlow, ABCjs, OpenSheetMusicDisplay) rather than building notation rendering from scratch.

Recommend starting with options 1 and 2, adding 3 and 4 as later phases.

### Future: Combined View

Eventually, a "Both Instruments" mode could show guitar fretboard and piano keyboard side by side for the same chord/scale, useful for musicians who play both or for teachers explaining theory to mixed groups. The shared theory engine makes this straightforward — same note set, two renderers.
