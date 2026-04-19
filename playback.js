// ── Playback engine (Tone.js wrapper) ──────────────────────────────
// Shared audio module. Lazy-loads Tone.js from CDN on first use.

let Tone = null;
let toneLoaded = false;
let toneLoading = false;
let synth = null;
let clickSynth = null;
let scheduledEvents = [];
let onStepChange = null;
let currentSequence = null;

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
    synth = new Tone.PolySynth(Tone.PluckSynth, { volume: -6 }).toDestination();
  }
  if (!clickSynth) {
    clickSynth = new Tone.MembraneSynth({
      volume: -12, pitchDecay: 0.01, octaves: 4,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
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

// ── Transport time helpers ─────────────────────────────────────────
// Tone.Transport uses "bars:quarters:sixteenths" in 4/4 time.
// 1 beat = 1 quarter note.
function beatsToTransportTime(beats) {
  const bars = Math.floor(beats / 4);
  const quarters = Math.floor(beats % 4);
  const sixteenths = (beats % 1) * 4;
  return `${bars}:${quarters}:${sixteenths}`;
}

// Convert beats to seconds at a given BPM for note durations.
function beatsToSeconds(beats, bpm) {
  return (beats / bpm) * 60;
}

// ── Schedule a sequence onto Transport ─────────────────────────────
function pbLoadSequence(sequence, stepCallback) {
  if (!Tone) return;
  currentSequence = sequence;
  onStepChange = stepCallback || null;

  clearSchedule();

  const bpm = sequence.tempo || 80;
  Tone.Transport.bpm.value = bpm;

  let beatOffset = 0;
  const steps = sequence.steps;

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];
    const startBeat = beatOffset;
    const stepIndex = si;

    // Schedule step-change callback
    const evId = Tone.Transport.schedule(() => {
      if (onStepChange) onStepChange(stepIndex);
    }, beatsToTransportTime(startBeat));
    scheduledEvents.push(evId);

    if (step.kind === "chord") {
      scheduleChordStep(step, startBeat, bpm);
    } else if (step.kind === "pattern") {
      schedulePatternStep(step, startBeat, bpm);
    } else if (step.kind === "lead_line") {
      scheduleLeadLineStep(step, startBeat);
    }

    beatOffset += step.durationBeats;
  }

  // End callback
  const totalBeats = beatOffset;
  const endId = Tone.Transport.schedule(() => {
    if (onStepChange) onStepChange(-1);
    if (!Tone.Transport.loop) {
      Tone.Transport.stop();
    }
  }, beatsToTransportTime(totalBeats));
  scheduledEvents.push(endId);

  Tone.Transport.loopEnd = beatsToTransportTime(totalBeats);
}

function scheduleChordStep(step, startBeat, bpm) {
  const positions = step.voicing && step.voicing.positions;
  if (!positions || !positions.length) return;

  const freqs = positions.map(p => midiToFreq(fretToMidi(p.string, p.fret)));
  const art = step.articulation || "strum_down";
  const durSec = beatsToSeconds(step.durationBeats * 0.8, bpm);

  if (art === "block") {
    const evId = Tone.Transport.schedule((time) => {
      synth.triggerAttackRelease(freqs, durSec, time);
    }, beatsToTransportTime(startBeat));
    scheduledEvents.push(evId);
  } else if (art === "arpeggiate_up" || art === "arpeggiate_down") {
    const sorted = [...freqs].sort((a, b) => a - b);
    if (art === "arpeggiate_down") sorted.reverse();
    const interval = step.durationBeats / sorted.length;
    sorted.forEach((freq, i) => {
      const evId = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(freq, beatsToSeconds(interval * 0.8, bpm), time);
      }, beatsToTransportTime(startBeat + i * interval));
      scheduledEvents.push(evId);
    });
  } else {
    // Strum: stagger attacks ~20ms apart
    const sorted = [...freqs].sort((a, b) => a - b);
    if (art === "strum_up") sorted.reverse();
    sorted.forEach((freq, i) => {
      const evId = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(freq, durSec, time + i * 0.02);
      }, beatsToTransportTime(startBeat));
      scheduledEvents.push(evId);
    });
  }
}

function schedulePatternStep(step, startBeat, bpm) {
  if (!step.notes || !step.notes.length) return;
  let offset = 0;
  for (const note of step.notes) {
    const freq = midiToFreq(fretToMidi(note.string, note.fret));
    const dur = note.durationBeats || 1;
    const evId = Tone.Transport.schedule((time) => {
      synth.triggerAttackRelease(freq, beatsToSeconds(dur * 0.8, bpm), time);
    }, beatsToTransportTime(startBeat + offset));
    scheduledEvents.push(evId);
    offset += dur;
  }
}

function scheduleLeadLineStep(step, startBeat) {
  const beats = step.durationBeats || 8;
  for (let b = 0; b < beats; b++) {
    const evId = Tone.Transport.schedule((time) => {
      clickSynth.triggerAttackRelease("C2", 0.03, time);
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
// playbackPlay does: init Tone → create synths → resume AudioContext →
// schedule the sequence → start transport.  The caller passes the
// sequence and step-change callback; everything is wired up in one go
// after Tone is guaranteed to be loaded.
async function playbackPlay(sequence, stepCallback) {
  await playbackInit();
  ensureSynths();
  await Tone.start();
  if (sequence) {
    pbLoadSequence(sequence, stepCallback);
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
