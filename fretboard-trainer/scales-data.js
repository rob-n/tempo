/**
 * Declarative scale/tuning/geometry data. No shapes are stored anywhere —
 * fretboard-model.js derives scale-tone positions from this data via
 * semitone math, so it works for any tuning/string count without
 * per-tuning special-casing.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Pitch classes of the natural (no sharp/flat) note names, for the
// "exclude accidentals" root-pool filter.
export const NATURAL_ROOTS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

export const TUNINGS = {
  '8-string-standard': {
    label: '8-String (F#–B–E–A–D–G–B–E)',
    strings: ['F#', 'B', 'E', 'A', 'D', 'G', 'B', 'E'], // low → high
  },
  '6-string-standard': {
    label: '6-String (E–A–D–G–B–E)',
    strings: ['E', 'A', 'D', 'G', 'B', 'E'],
  },
};

// Phase A. Phase B (modes as distinct shapes, harmonic/melodic minor) adds
// entries here only — no other file needs to change.
export const SCALES = {
  major: { label: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  naturalMinor: { label: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  majorPentatonic: { label: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
  minorPentatonic: { label: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'] },
  blues: { label: 'Blues', intervals: [0, 3, 5, 6, 7, 10], degrees: ['1', 'b3', '4', 'b5', '5', 'b7'] },
};

// Bounded string subsets used to keep the drill visually light early on.
// Generic over string count so they work for 6-string or 8-string alike.
export const STRING_SETS = {
  all: (n) => Array.from({ length: n }, (_, i) => i),
  low: (n) => Array.from({ length: Math.min(4, n) }, (_, i) => i),
  high: (n) => Array.from({ length: Math.min(4, n) }, (_, i) => n - 1 - i).reverse(),
  mid: (n) => Array.from({ length: Math.min(4, n) }, (_, i) => Math.floor((n - 4) / 2) + i),
};

export const POSITION_WINDOW_WIDTH = 5; // frets
export const POSITION_STEP = 3; // overlap between adjacent windows
export const MAX_FRET = 15;
