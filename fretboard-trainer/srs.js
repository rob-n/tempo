/**
 * Spaced-repetition scheduling and interleaving — no DOM. Leitner-style
 * buckets with a hybrid rep-count/wall-clock cooldown so items resurface
 * sensibly both within one long session and across days.
 */

import { SCALES, NATURAL_ROOTS } from './scales-data.js';
import { getPositionWindows } from './fretboard-model.js';

export const BUCKETS = [
  { id: 0, cooldownReps: 1, cooldownMs: 0 },
  { id: 1, cooldownReps: 4, cooldownMs: 0 },
  { id: 2, cooldownReps: 10, cooldownMs: 0 },
  { id: 3, cooldownReps: 25, cooldownMs: 12 * 60 * 60 * 1000 },
  { id: 4, cooldownReps: 60, cooldownMs: 2 * 24 * 60 * 60 * 1000 },
  { id: 5, cooldownReps: 999, cooldownMs: 5 * 24 * 60 * 60 * 1000 },
];

// Difficulty ramp, gated on a single global correct-rep counter. Adding or
// tuning a stage is a one-line edit here — nothing else needs to change.
// `scaleKeys: null` means "all scales in scales-data.js". Early stages are
// deliberately narrowed to pentatonic (the most universally familiar scale
// shapes) so there's something to succeed at before the pool widens —
// otherwise interleaving all 5 scale types from rep one just produces
// misses with nothing reinforced. String range starts on the standard
// low-E-and-up range (`core4`/`core6`), not the literal lowest strings —
// on an extended-range instrument those are the extra low strings, the
// least familiar ones, so they're introduced last (`all`, stage 4+).
// `windowIndices: null` means "every position on the neck"; the earliest
// stages restrict to position 1 (frets 0-5), then 1-2, before opening up —
// same reasoning as learning one CAGED box before moving up the neck,
// and it shrinks the early pool enough that items actually resurface
// within a single sitting instead of every rep being brand new.
export const RAMP_STAGES = [
  { minReps: 0, showRoot: true, stringSet: 'core4', timeLimitMs: null, scaleKeys: ['minorPentatonic', 'majorPentatonic'], windowIndices: [0] },
  { minReps: 20, showRoot: true, stringSet: 'core6', timeLimitMs: null, scaleKeys: ['minorPentatonic', 'majorPentatonic', 'blues'], windowIndices: [0, 1] },
  { minReps: 50, showRoot: false, stringSet: 'core6', timeLimitMs: null, scaleKeys: null, windowIndices: null },
  { minReps: 100, showRoot: false, stringSet: 'all', timeLimitMs: 12000, scaleKeys: null, windowIndices: null },
  { minReps: 200, showRoot: false, stringSet: 'all', timeLimitMs: 8000, scaleKeys: null, windowIndices: null },
];

export function currentStage(totalCorrectReps) {
  return RAMP_STAGES.slice().reverse().find((s) => totalCorrectReps >= s.minReps) ?? RAMP_STAGES[0];
}

export function itemKey({ scaleKey, rootPc, stringSetKey, windowIndex }) {
  return `${scaleKey}:${rootPc}:${stringSetKey}:${windowIndex}`;
}

/**
 * The full drillable pool for the current ramp stage/settings, generated
 * on the fly — never pre-populated into storage. `items` records are only
 * created lazily, for keys actually drilled.
 */
export function buildPool({ stringSetKey, includeAccidentals, scaleKeys, windowIndices }) {
  const roots = includeAccidentals ? [...Array(12).keys()] : NATURAL_ROOTS;
  const windows = getPositionWindows().filter((w) => !windowIndices || windowIndices.includes(w.index));
  const pool = [];
  for (const scaleKey of scaleKeys ?? Object.keys(SCALES)) {
    for (const rootPc of roots) {
      for (const w of windows) {
        pool.push({ scaleKey, rootPc, stringSetKey, windowIndex: w.index, key: itemKey({ scaleKey, rootPc, stringSetKey, windowIndex: w.index }) });
      }
    }
  }
  return pool;
}

function isEligible(candidate, items, globalRepCounter) {
  const item = items[candidate.key];
  if (!item) return true;
  return globalRepCounter >= item.dueAfterRepCount && Date.now() >= item.dueAfterTime;
}

function makeNoRepeatConstraint(field, lookback) {
  return (candidate, recentHistory) => !recentHistory.slice(-lookback).some((h) => h[field] === candidate[field]);
}
const noSameWindow = makeNoRepeatConstraint('windowIndex', 1);
const noSameRoot = makeNoRepeatConstraint('rootPc', 1);
const noSameScale = makeNoRepeatConstraint('scaleKey', 1);

// Weight favors lower (more due) buckets. Items never attempted get a mid
// weight rather than the max — otherwise brand-new items would dominate
// every early rep instead of interleaving with the rest of the pool.
function weightFor(candidate, items) {
  const bucket = items[candidate.key]?.bucket ?? 2;
  return 2 ** (BUCKETS.length - 1 - bucket);
}

function weightedRandomPick(candidates, items) {
  const weights = candidates.map((c) => weightFor(c, items));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Pick the next drill item, enforcing interleaving structurally: never the
 * same scale/root/window as recent reps unless the pool is too small to
 * avoid it (constraints relax rather than deadlock).
 */
export function pickNext(pool, items, recentHistory, globalRepCounter) {
  let candidates = pool.filter((c) => isEligible(c, items, globalRepCounter));
  if (candidates.length === 0) candidates = pool; // everything on cooldown — don't stall, just recycle

  for (const constraint of [noSameWindow, noSameRoot, noSameScale]) {
    const filtered = candidates.filter((c) => constraint(c, recentHistory));
    if (filtered.length) candidates = filtered;
    else break;
  }

  return weightedRandomPick(candidates, items);
}

/**
 * Update an item's bucket/due state after a graded rep. Mutates `items` in
 * place (persisted by the caller via shared/storage.js).
 */
export function recordResult(items, key, { correct, tooSlow }, globalRepCounter) {
  const item = items[key] ?? { bucket: 0, reps: 0, correct: 0, dueAfterRepCount: 0, dueAfterTime: 0 };
  if (!correct) item.bucket = Math.max(0, item.bucket - 2);
  else if (!tooSlow) item.bucket = Math.min(BUCKETS.length - 1, item.bucket + 1);
  item.reps++;
  if (correct) item.correct++;
  const b = BUCKETS[item.bucket];
  item.dueAfterRepCount = globalRepCounter + b.cooldownReps;
  item.dueAfterTime = Date.now() + b.cooldownMs;
  items[key] = item;
  return item;
}
