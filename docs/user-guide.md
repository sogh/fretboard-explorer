# User Guide

## Getting Started

Open any of the three pages in your browser:

- **index.html** — Guitar and other fretted instruments (bass, ukulele, banjo, mandolin)
- **piano.html** — Piano
- **trumpet.html** — B-flat trumpet

Each page has a navigation bar at the top to switch between tools. You can also switch between instruments using the links on the right side of the nav bar.

## Guitar Page

### Fretboard Explorer

The main fretboard view shows chord voicings on the neck.

**Controls:**
- **Root** — select the root note (C through B)
- **Instrument** — switch between guitar, bass, ukulele, 5-string banjo, tenor banjo, and mandolin
- **Type** — toggle between triads (3-note) and 7th chords (4-note)
- **Quality** — choose the chord quality (major, minor, dim, aug, sus2, sus4 for triads; maj7, dom7, min7, mM7, dim7, m7b5 for 7ths)
- **Inversion** — cycle through root position and inversions
- **Strings** — pick which group of adjacent strings to voice the chord on

**Pattern cards** appear below the main fretboard showing related chords and scales:
- **All** — shows everything
- **Diatonic** — chords built on each degree of the major scale
- **Scales** — pentatonic, blues, harmonic/melodic minor, and all seven modes
- **Functional** — secondary dominants, borrowed chords, tritone substitution

Click any pattern card to overlay those notes on the main fretboard.

### Circle of Fifths

An interactive circle showing all 12 keys with:
- Major keys around the outside, relative minors inside
- Click any key to select it
- Toggle between major and minor circle views
- Key signature panel showing sharps/flats
- Diatonic chord strip with voicings for the selected key
- Borrowed chords from the parallel minor

### Progressions

Browse chord progressions organized by genre:
- Select a root note and mode (major/minor)
- Pick a genre (Pop, Rock, Jazz, Blues, Folk, Classical, R&B/Soul, Country)
- Each progression shows roman numerals and chord names
- Click any chord to see its voicing on the fretboard

### Scales & Modes

Explore scales across the entire fretboard:
- Choose root, scale type, and label mode (degrees or note names)
- View position patterns (CAGED for pentatonic scales, 3-note-per-string for modes)
- Click a position card to highlight that region on the full fretboard

### Practice Sequencer

Build step-by-step practice sequences. See the [Sequencer section](#practice-sequencer-1) below.

## Piano Page

### Scales & Modes

Piano keyboard visualization of any scale:
- Select root and scale type
- Toggle between degree labels and note names
- Keyboard highlights scale tones (orange) with root emphasized (blue)

### Voicings

Explore how chords are voiced on piano:
- **Close voicing** — notes stacked as tightly as possible
- **Open voicing** — spread voicing (triads: middle+top up an octave; 7ths: drop-2)
- **Two-hand (split)** — left hand plays root+5th, right hand plays the upper structure
- Cycle through inversions for each voicing style
- Pattern cards show all diatonic chords in the selected key

### Circle of Fifths

Same as the guitar version but with piano keyboard chord strips instead of fretboard diagrams.

### Practice Sequencer

Piano version of the sequencer with keyboard-based rendering. See below.

## Trumpet Page

### Scales

Trumpet-specific scale reference:
- Select a concert key and scale type
- Toggle "Written pitch" to see the B-flat transposition
- Each note shows the valve fingering diagram (which valves to press)
- Supports all scale types from the shared theory engine

## Practice Sequencer

The sequencer is available on both the guitar and piano pages. It lets you build a sequence of steps and play them back.

### Adding Steps

Click the **+ Add step** card to open the step picker:

- **Chord** — a chord voicing held for a duration
- **Lead Line** — a scale context for improvisation between chords
- **Pattern** — a specific sequence of notes to play
- **Rest** — silence for a duration

### Editing Steps

Click any step card to open its editor below the timeline.

#### Chord Steps

- Choose root note and quality
- **Chord suggestions** appear based on your sequence:
  - A **Detected tonality** panel shows the likely key and how the current chord fits
  - **Diatonic** suggestions show all chords in the detected key with roman numerals
  - **Common resolutions** suggest typical voice-leading moves from the previous chord
  - **Borrowed chords** from the parallel minor (bIII, bVI, bVII, iv)
  - **Secondary dominants** (V7/ii, V7/iii, etc.)
  - **Chromatic motion** for half/whole step root movement
  - Each suggestion shows its **tonality effect** — whether it confirms the key, is borrowed, or would shift the tonality
  - Click any suggestion to instantly apply it
- Guitar: choose articulation (strum down/up, block, arpeggiate)
- Piano: choose voicing style (close/open/two-hand) and inversion
- Set duration in beats

#### Lead Line Steps

- Shows **bracket chords** — the chord before and after this step
- **Suggested scales** based on the surrounding chords, ranked by fit
- Manual scale override with root and type selection
- Includes pentatonic and blues scales alongside the seven modes
- Toggle between degree labels and note names
- Guitar: full fretboard view with ghost overlays of bracket chord voicings and landing zone indicators (diamond shapes for chord tones)
- Piano: keyboard view with scale and chord tone highlights

#### Pattern Steps

- Set a scale context for degree labels
- **Click notes** directly on the fretboard/keyboard to build a sequence
- **Generate patterns** automatically:
  - **Ascending** — walk up/down the scale by step
  - **Interval pairs** — pairs of notes a fixed interval apart
  - **Repeating cell** — a melodic pattern repeated with transposition
- Reorder notes with up/down buttons
- Set individual note durations
- Guitar: set articulations per note (bend, slide, hammer-on, pull-off)

#### Rest Steps

- Set duration in beats

### Playback

- **Play/Pause** — start or pause playback; the active step highlights in the timeline
- **Stop** — stop and reset to the beginning
- **Tempo slider** — adjust BPM (40-200)
- **Loop** — toggle continuous looping

### Managing Sequences

- **Name** — click to edit the sequence name
- **Tempo** — set the master tempo (also adjustable via the slider)
- **Drag and drop** — reorder steps by dragging cards in the timeline
- **Delete** — hover over a card and click the X button
- **Clear all** — remove all steps
- **Copy link** — save the sequence to the URL for sharing

Sequences are automatically saved to your browser's local storage and restored when you return.

## Tips

- **Print support** — the guitar page has a print stylesheet; use your browser's print function to get a clean printout
- **Keyboard navigation** — all controls are standard buttons, so Tab/Enter navigation works
- **Shareable URLs** — the sequencer's "Copy link" button encodes the full sequence in the URL hash, so you can share it with anyone
- **Multiple instruments** — on the guitar page, switch instruments in the nav bar; voicings and scale patterns adapt to each instrument's tuning and string count
