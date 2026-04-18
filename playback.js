// ── Playback engine (Tone.js wrapper) ──────────────────────────────
// Shared audio module. Lazy-loads Tone.js from CDN on first use.
// Provides: init, loadSequence, play, pause, stop, setTempo,
// setLoopRegion, and a step-change callback for UI highlighting.

let Tone = null;
let toneLoaded = false;
let toneLoading = false;
let synth = null;
let clickSynth = null;
let transport = null;
let scheduledEvents = [];
let onStepChange = null;
let currentSequence = null;

const TONE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js";

// ── Lazy init ──────────────────────────────────────────────────────
async function playbackInit() {
  if (toneLoaded) return;
  if (toneLoading) {
    // Wait for in-progress load
    while (toneLoading) await new Promise(r => setTimeout(r, 50));
    return;
  }
  toneLoading = true;
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TONE_CDN;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    Tone = window.Tone;
    toneLoaded = true;
  } finally {
    toneLoading = false;
  }
}

function ensureSynths() {
  if (!Tone) return;
  if (!synth) {
    synth = new Tone.PolySynth(Tone.PluckSynth, { volume: -6 }).toDestination();
  }
  if (!clickSynth) {
    clickSynth = new Tone.MembraneSynth({ volume: -12, pitchDecay: 0.01, octaves: 4, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } }).toDestination();
  }
}

// ── Note frequency helpers ─────────────────────────────────────────
// Convert a guitar string + fret to a MIDI note number.
// String 0 = high E (MIDI 64), string 5 = low E (MIDI 40) in standard tuning.
const GUITAR_OPEN_MIDI = [64, 59, 55, 50, 45, 40];

function fretToMidi(stringIdx, fret) {
  // Use instrument tuning pitch classes + octave calculation.
  // Open strings in standard guitar tuning:
  const openMidi = GUITAR_OPEN_MIDI[stringIdx];
  if (openMidi == null) return 60; // fallback
  return openMidi + fret;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Schedule a sequence onto Transport ─────────────────────────────
function loadSequence(sequence, stepCallback) {
  if (!Tone) return;
  currentSequence = sequence;
  onStepChange = stepCallback || null;

  // Clear previous schedule
  clearSchedule();

  Tone.Transport.bpm.value = sequence.tempo || 80;

  let beatOffset = 0;
  const steps = sequence.steps;

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];
    const startBeat = beatOffset;
    const stepIndex = si;

    // Schedule step-change callback at the start of each step
    const evId = Tone.Transport.schedule((time) => {
      if (onStepChange) onStepChange(stepIndex);
    }, `0:0:${startBeat * (Tone.Transport.PPQ)}`);
    scheduledEvents.push(evId);

    if (step.kind === "chord") {
      scheduleChordStep(step, startBeat);
    } else if (step.kind === "pattern") {
      schedulePatternStep(step, startBeat);
    } else if (step.kind === "lead_line") {
      scheduleLeadLineStep(step, startBeat);
    }
    // Rest: nothing to play

    beatOffset += step.durationBeats;
  }

  // Schedule a final callback to stop at the end (or loop)
  const totalBeats = beatOffset;
  const endId = Tone.Transport.schedule((time) => {
    if (onStepChange) onStepChange(-1);
    if (!Tone.Transport.loop) {
      Tone.Transport.stop();
    }
  }, beatsToTransportTime(totalBeats));
  scheduledEvents.push(endId);

  // Set loop length
  Tone.Transport.loopEnd = beatsToTransportTime(totalBeats);
}

function beatsToTransportTime(beats) {
  // Convert beats to "bars:quarters:sixteenths" format
  // At any time signature (default 4/4), 1 bar = 4 beats
  const bars = Math.floor(beats / 4);
  const remainBeats = beats % 4;
  return `${bars}:${remainBeats}:0`;
}

function scheduleChordStep(step, startBeat) {
  const positions = step.voicing && step.voicing.positions;
  if (!positions || !positions.length) return;

  const freqs = positions.map(p => midiToFreq(fretToMidi(p.string, p.fret)));
  const art = step.articulation || "strum_down";
  const duration = Math.max(0.5, step.durationBeats * 0.8); // slightly shorter than full duration

  if (art === "block") {
    // All notes simultaneously
    const evId = Tone.Transport.schedule((time) => {
      synth.triggerAttackRelease(freqs, duration + "n", time);
    }, beatsToTransportTime(startBeat));
    scheduledEvents.push(evId);
  } else if (art === "arpeggiate_up" || art === "arpeggiate_down") {
    // Spread notes across the duration
    const sorted = [...freqs].sort((a, b) => a - b);
    if (art === "arpeggiate_down") sorted.reverse();
    const interval = step.durationBeats / sorted.length;
    sorted.forEach((freq, i) => {
      const evId = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(freq, "8n", time);
      }, beatsToTransportTime(startBeat + i * interval));
      scheduledEvents.push(evId);
    });
  } else {
    // Strum: stagger attacks ~20ms apart
    const sorted = [...freqs].sort((a, b) => a - b);
    if (art === "strum_up") sorted.reverse();
    sorted.forEach((freq, i) => {
      const evId = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(freq, duration + "n", time + i * 0.02);
      }, beatsToTransportTime(startBeat));
      scheduledEvents.push(evId);
    });
  }
}

function schedulePatternStep(step, startBeat) {
  if (!step.notes || !step.notes.length) return;
  let offset = 0;
  for (const note of step.notes) {
    const freq = midiToFreq(fretToMidi(note.string, note.fret));
    const dur = note.durationBeats || 1;
    const evId = Tone.Transport.schedule((time) => {
      synth.triggerAttackRelease(freq, Math.max(0.1, dur * 0.8) + "n", time);
    }, beatsToTransportTime(startBeat + offset));
    scheduledEvents.push(evId);
    offset += dur;
  }
}

function scheduleLeadLineStep(step, startBeat) {
  // Lead line = click track (metronome) during the improvisation window
  const beats = step.durationBeats || 8;
  for (let b = 0; b < beats; b++) {
    const evId = Tone.Transport.schedule((time) => {
      clickSynth.triggerAttackRelease("C2", "32n", time);
    }, beatsToTransportTime(startBeat + b));
    scheduledEvents.push(evId);
  }
}

function clearSchedule() {
  if (!Tone) return;
  for (const id of scheduledEvents) {
    Tone.Transport.clear(id);
  }
  scheduledEvents = [];
}

// ── Transport controls ─────────────────────────────────────────────
async function playbackPlay() {
  await playbackInit();
  ensureSynths();
  await Tone.start(); // resume AudioContext on user gesture
  if (currentSequence) {
    loadSequence(currentSequence, onStepChange);
  }
  Tone.Transport.start();
}

function playbackPause() {
  if (Tone) Tone.Transport.pause();
}

function playbackStop() {
  if (!Tone) return;
  Tone.Transport.stop();
  Tone.Transport.position = 0;
  clearSchedule();
  if (onStepChange) onStepChange(-1);
}

function playbackSetTempo(bpm) {
  if (Tone) Tone.Transport.bpm.value = bpm;
}

function playbackSetLoop(enabled) {
  if (Tone) {
    Tone.Transport.loop = enabled;
    Tone.Transport.loopStart = 0;
  }
}

function playbackIsPlaying() {
  return Tone && Tone.Transport.state === "started";
}
