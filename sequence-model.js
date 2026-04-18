// ── Practice Sequencer — Data model & serialization ────────────────
// Pure data module: no DOM, no audio, no imports beyond theory.js
// helpers available on the global scope (or required via Node).
//
// Sequence schema version. Bump when the shape changes and add a
// migration in fromJSON().
const SEQUENCE_VERSION = 1;

// ── ID generation ──────────────────────────────────────────────────
function seqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Step constructors ──────────────────────────────────────────────
// Each returns a plain object matching the schema in the design doc.

function chordStep(opts) {
  opts = opts || {};
  return {
    id: opts.id || seqId(),
    kind: "chord",
    durationBeats: opts.durationBeats != null ? opts.durationBeats : 4,
    root: opts.root || "C",
    quality: opts.quality || "major",
    extension: opts.extension || null,
    voicing: opts.voicing || { positions: [], stringGroup: null },
    articulation: opts.articulation || "strum_down",
  };
}

function leadLineStep(opts) {
  opts = opts || {};
  return {
    id: opts.id || seqId(),
    kind: "lead_line",
    durationBeats: opts.durationBeats != null ? opts.durationBeats : 8,
    scale: opts.scale || null,
    bracketPrevious: opts.bracketPrevious != null ? opts.bracketPrevious : true,
    bracketNext: opts.bracketNext != null ? opts.bracketNext : true,
    fretRange: opts.fretRange || null,
  };
}

function patternStep(opts) {
  opts = opts || {};
  return {
    id: opts.id || seqId(),
    kind: "pattern",
    durationBeats: opts.durationBeats != null ? opts.durationBeats : 4,
    scale: opts.scale || { root: "C", type: "ionian" },
    notes: opts.notes || [],
    generator: opts.generator || null,
  };
}

function restStep(opts) {
  opts = opts || {};
  return {
    id: opts.id || seqId(),
    kind: "rest",
    durationBeats: opts.durationBeats != null ? opts.durationBeats : 2,
  };
}

// Convenience: create a step of any kind.
function createStep(kind, opts) {
  switch (kind) {
    case "chord":     return chordStep(opts);
    case "lead_line": return leadLineStep(opts);
    case "pattern":   return patternStep(opts);
    case "rest":      return restStep(opts);
    default: throw new Error(`Unknown step kind: ${kind}`);
  }
}

// ── Sequence constructor ───────────────────────────────────────────
function createSequence(opts) {
  opts = opts || {};
  return {
    id: opts.id || seqId(),
    version: SEQUENCE_VERSION,
    name: opts.name || "Untitled sequence",
    tempo: opts.tempo != null ? opts.tempo : 80,
    steps: opts.steps || [],
  };
}

// ── Validation ─────────────────────────────────────────────────────
const VALID_KINDS = new Set(["chord", "lead_line", "pattern", "rest"]);
const VALID_ARTICULATIONS = new Set(["strum_down", "strum_up", "block", "arpeggiate_up", "arpeggiate_down"]);
const VALID_NOTE_ARTICULATIONS = new Set(["bend", "slide", "hammer", "pull"]);

function validateStep(step) {
  const errors = [];
  if (!step || typeof step !== "object") return ["step is not an object"];
  if (!step.id) errors.push("missing id");
  if (!VALID_KINDS.has(step.kind)) errors.push(`invalid kind: ${step.kind}`);
  if (typeof step.durationBeats !== "number" || step.durationBeats <= 0) {
    errors.push("durationBeats must be a positive number");
  }

  if (step.kind === "chord") {
    if (!step.root) errors.push("chord: missing root");
    if (!step.quality) errors.push("chord: missing quality");
    if (!VALID_ARTICULATIONS.has(step.articulation)) {
      errors.push(`chord: invalid articulation: ${step.articulation}`);
    }
    if (!step.voicing || !Array.isArray(step.voicing.positions)) {
      errors.push("chord: voicing.positions must be an array");
    }
  }

  if (step.kind === "lead_line") {
    if (step.scale !== null && (typeof step.scale !== "object" || !step.scale.root || !step.scale.type)) {
      errors.push("lead_line: scale must be null or {root, type}");
    }
    if (step.fretRange !== null && (!Array.isArray(step.fretRange) || step.fretRange.length !== 2)) {
      errors.push("lead_line: fretRange must be null or [low, high]");
    }
  }

  if (step.kind === "pattern") {
    if (!step.scale || !step.scale.root || !step.scale.type) {
      errors.push("pattern: scale must be {root, type}");
    }
    if (!Array.isArray(step.notes)) errors.push("pattern: notes must be an array");
    for (let i = 0; i < (step.notes || []).length; i++) {
      const n = step.notes[i];
      if (typeof n.string !== "number") errors.push(`pattern: notes[${i}] missing string`);
      if (typeof n.fret !== "number") errors.push(`pattern: notes[${i}] missing fret`);
      if (typeof n.durationBeats !== "number") errors.push(`pattern: notes[${i}] missing durationBeats`);
      if (n.articulation != null && !VALID_NOTE_ARTICULATIONS.has(n.articulation)) {
        errors.push(`pattern: notes[${i}] invalid articulation: ${n.articulation}`);
      }
    }
  }

  return errors;
}

function validateSequence(seq) {
  const errors = [];
  if (!seq || typeof seq !== "object") return ["sequence is not an object"];
  if (!seq.id) errors.push("missing id");
  if (seq.version !== SEQUENCE_VERSION) errors.push(`unsupported version: ${seq.version}`);
  if (typeof seq.tempo !== "number" || seq.tempo <= 0) errors.push("tempo must be positive");
  if (!Array.isArray(seq.steps)) errors.push("steps must be an array");
  for (let i = 0; i < (seq.steps || []).length; i++) {
    const stepErrors = validateStep(seq.steps[i]);
    for (const e of stepErrors) errors.push(`steps[${i}]: ${e}`);
  }
  return errors;
}

// ── Serialization ──────────────────────────────────────────────────
function sequenceToJSON(seq) {
  return JSON.stringify(seq);
}

function sequenceFromJSON(json) {
  const obj = typeof json === "string" ? JSON.parse(json) : json;
  // Future: migrate older versions here.
  return obj;
}

// ── Node export ────────────────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SEQUENCE_VERSION,
    seqId,
    chordStep, leadLineStep, patternStep, restStep, createStep,
    createSequence,
    validateStep, validateSequence,
    sequenceToJSON, sequenceFromJSON,
    VALID_KINDS, VALID_ARTICULATIONS, VALID_NOTE_ARTICULATIONS,
  };
}
