// ── Playback engine (Tone.js wrapper) ──────────────────────────────
// Shared audio module. Lazy-loads Tone.js from CDN on first use.

let Tone = null;
let toneLoaded = false;
let toneLoading = false;
let synth = null;
let clickSynth = null;
let scheduledEvents = [];
let onStepChange = null;
let playbackTimer = null;
let pbLoop = false;

const TONE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js";

// ── Lazy init ──────────────────────────────────────────────────────
async function playbackInit() {
  if (toneLoaded) return;
  if (toneLoading) {
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
    // PolySynth wrapping Tone.Synth for reliable polyphony.
    // PluckSynth does not support PolySynth wrapping.
    synth = new Tone.PolySynth(Tone.Synth, {
      volume: -8,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.8 },
    }).toDestination();
  }
  if (!clickSynth) {
    clickSynth = new Tone.NoiseSynth({
      volume: -16,
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).toDestination();
  }
}

// ── Note frequency helpers ─────────────────────────────────────────
const GUITAR_OPEN_MIDI = [64, 59, 55, 50, 45, 40];

function fretToMidi(stringIdx, fret) {
  const openMidi = GUITAR_OPEN_MIDI[stringIdx];
  if (openMidi == null) return 60;
  return openMidi + fret;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Simple scheduler ───────────────────────────────────────────────
// Instead of fighting Tone.Transport time format, we use Tone.now()
// offsets from a known start time. This is more reliable and simpler.

function beatsToSeconds(beats, bpm) {
  return (beats / bpm) * 60;
}

function pbLoadAndPlay(sequence, stepCallback, loop) {
  if (!Tone) return;
  onStepChange = stepCallback || null;
  clearSchedule();

  const bpm = sequence.tempo || 80;
  const now = Tone.now() + 0.05; // tiny buffer for scheduling
  let beatOffset = 0;
  const steps = sequence.steps;

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];
    const startTime = now + beatsToSeconds(beatOffset, bpm);
    const stepIndex = si;

    // Step-change callback
    const timerId = setTimeout(() => {
      if (onStepChange) onStepChange(stepIndex);
    }, (startTime - Tone.now()) * 1000);
    scheduledEvents.push({ type: "timeout", id: timerId });

    if (step.kind === "chord") {
      scheduleChordStep(step, startTime, bpm);
    } else if (step.kind === "pattern") {
      schedulePatternStep(step, startTime, bpm);
    } else if (step.kind === "lead_line") {
      scheduleLeadLineStep(step, startTime, bpm);
    }

    beatOffset += step.durationBeats;
  }

  // End callback
  const endTime = now + beatsToSeconds(beatOffset, bpm);
  const endTimer = setTimeout(() => {
    if (onStepChange) onStepChange(-1);
    if (loop) {
      // Re-schedule from the top
      pbLoadAndPlay(sequence, stepCallback, loop);
    }
  }, (endTime - Tone.now()) * 1000);
  scheduledEvents.push({ type: "timeout", id: endTimer });
}

function scheduleChordStep(step, startTime, bpm) {
  // Piano voicings use {notes: [{midi, degree}]}, guitar uses {positions: [{string, fret}]}
  const pianoNotes = step.voicing && step.voicing.notes;
  const positions = step.voicing && step.voicing.positions;
  if ((!pianoNotes || !pianoNotes.length) && (!positions || !positions.length)) return;

  const freqs = pianoNotes
    ? pianoNotes.map(n => midiToFreq(n.midi))
    : positions.map(p => midiToFreq(fretToMidi(p.string, p.fret)));
  const art = step.articulation || "strum_down";
  const durSec = beatsToSeconds(step.durationBeats * 0.7, bpm);

  if (art === "block") {
    freqs.forEach(freq => {
      synth.triggerAttackRelease(freq, durSec, startTime);
    });
  } else if (art === "arpeggiate_up" || art === "arpeggiate_down") {
    const sorted = [...freqs].sort((a, b) => a - b);
    if (art === "arpeggiate_down") sorted.reverse();
    const interval = beatsToSeconds(step.durationBeats / sorted.length, bpm);
    sorted.forEach((freq, i) => {
      synth.triggerAttackRelease(freq, interval * 0.8, startTime + i * interval);
    });
  } else {
    // Strum down/up: stagger ~25ms
    const sorted = [...freqs].sort((a, b) => a - b);
    if (art === "strum_up") sorted.reverse();
    sorted.forEach((freq, i) => {
      synth.triggerAttackRelease(freq, durSec, startTime + i * 0.025);
    });
  }
}

function schedulePatternStep(step, startTime, bpm) {
  if (!step.notes || !step.notes.length) return;
  let offset = 0;
  for (const note of step.notes) {
    const freq = note.midi != null
      ? midiToFreq(note.midi)
      : midiToFreq(fretToMidi(note.string, note.fret));
    const dur = note.durationBeats || 1;
    const durSec = beatsToSeconds(dur * 0.8, bpm);
    synth.triggerAttackRelease(freq, durSec, startTime + beatsToSeconds(offset, bpm));
    offset += dur;
  }
}

function scheduleLeadLineStep(step, startTime, bpm) {
  const beats = step.durationBeats || 8;
  for (let b = 0; b < beats; b++) {
    const t = startTime + beatsToSeconds(b, bpm);
    // NoiseSynth.triggerAttackRelease(duration, time)
    clickSynth.triggerAttackRelease(0.03, t);
  }
}

function clearSchedule() {
  for (const ev of scheduledEvents) {
    if (ev.type === "timeout") clearTimeout(ev.id);
  }
  scheduledEvents = [];
}

// ── Transport controls ─────────────────────────────────────────────
async function playbackPlay(sequence, stepCallback) {
  await playbackInit();
  ensureSynths();
  await Tone.start(); // resume AudioContext on user gesture
  if (sequence) {
    pbLoadAndPlay(sequence, stepCallback, pbLoop);
  }
}

function playbackPause() {
  // Simple scheduler doesn't support true pause — just stop.
  playbackStop();
}

function playbackStop() {
  clearSchedule();
  // Dispose synths to cancel all future-scheduled notes on the
  // AudioContext timeline. triggerAttackRelease with a future time
  // can't be cancelled any other way. New synths are created on
  // next play via ensureSynths().
  if (synth) { synth.dispose(); synth = null; }
  if (clickSynth) { clickSynth.dispose(); clickSynth = null; }
  if (onStepChange) onStepChange(-1);
}

function playbackSetTempo(bpm) {
  // Tempo changes take effect on next play.
}

function playbackSetLoop(enabled) {
  pbLoop = !!enabled;
}

function playbackIsPlaying() {
  return scheduledEvents.length > 0;
}
