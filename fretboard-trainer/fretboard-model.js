/**
 * Pure scale/position math — no DOM. Given a tuning, a scale, a root, and
 * a bounded region of the neck, derives which (string, fret) cells are
 * scale tones directly from semitone arithmetic against each string's own
 * open pitch. No shape is ever authored or stored, so this works for any
 * tuning or string count (including tunings that aren't uniform fourths,
 * e.g. the G→B major third on standard/extended guitar tuning) with zero
 * special-casing.
 */

import { NOTE_NAMES, POSITION_WINDOW_WIDTH, POSITION_STEP, MAX_FRET } from './scales-data.js';

/**
 * Generate a sliding sequence of fret windows covering the neck.
 * Purely geometric — not authored per scale, so "position 1" of every
 * scale/root/tuning combination is the same window object.
 * @returns {{index:number, startFret:number, endFret:number}[]}
 */
export function getPositionWindows(width = POSITION_WINDOW_WIDTH, step = POSITION_STEP, maxFret = MAX_FRET) {
  const windows = [];
  for (let start = 0; start + width <= maxFret; start += step) {
    windows.push({ index: windows.length, startFret: start, endFret: start + width });
  }
  return windows;
}

/**
 * @param {{strings: string[]}} tuning
 * @param {number} stringIndex index into tuning.strings (0 = lowest string)
 * @param {number} fret
 * @returns {number} pitch class 0-11
 */
export function pitchClassAt(tuning, stringIndex, fret) {
  const openIdx = NOTE_NAMES.indexOf(tuning.strings[stringIndex]);
  return (openIdx + fret) % 12;
}

/**
 * Derive every scale-tone cell within a fret window across a set of strings.
 * @param {object} params
 * @param {{strings: string[]}} params.tuning
 * @param {{intervals: number[], degrees: string[]}} params.scale
 * @param {number} params.rootPc pitch class of the root, 0-11
 * @param {{startFret:number, endFret:number}} params.window
 * @param {number[]} params.stringIndices which strings to include
 * @returns {{stringIndex:number, fret:number, pc:number, degree:string, isRoot:boolean}[]}
 */
export function buildCellMatrix({ tuning, scale, rootPc, window, stringIndices }) {
  const intervalSet = new Set(scale.intervals);
  const cells = [];
  for (const s of stringIndices) {
    for (let f = window.startFret; f <= window.endFret; f++) {
      const pc = pitchClassAt(tuning, s, f);
      const rel = (pc - rootPc + 12) % 12;
      if (!intervalSet.has(rel)) continue;
      cells.push({
        stringIndex: s,
        fret: f,
        pc,
        degree: scale.degrees[scale.intervals.indexOf(rel)],
        isRoot: rel === 0,
      });
    }
  }
  return cells;
}
