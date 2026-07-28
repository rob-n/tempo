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
// "core" sets anchor to the standard 6-string range (low E up), not the
// lowest string indices — on an extended-range instrument, index 0 is the
// least-familiar string, not the most fundamental one. `high` is the
// genuinely highest strings (also familiar), used as its own optional set.
function coreRange(n, count) {
  const start = Math.max(0, n - 6); // start of the standard E-A-D-G-B-e range
  const len = Math.min(count, n - start);
  return Array.from({ length: len }, (_, i) => start + i);
}

export const STRING_SETS = {
  all: (n) => Array.from({ length: n }, (_, i) => i),
  core4: (n) => coreRange(n, 4), // low E, A, D, G
  core6: (n) => coreRange(n, 6), // full standard range: E A D G B e
  high: (n) => Array.from({ length: Math.min(4, n) }, (_, i) => n - 1 - i).reverse(),
};

export const STRING_SET_LABELS = {
  all: 'All strings',
  core4: 'Core 4 (low E–G)',
  core6: 'Core 6 (standard range)',
  high: 'Highest 4',
};

export const POSITION_WINDOW_WIDTH = 5; // frets
export const POSITION_STEP = 3; // overlap between adjacent windows
export const MAX_FRET = 15;
