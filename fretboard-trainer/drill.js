/**
 * Drill mode controller: pick an item → render a blank fretboard region →
 * capture taps → grade → record the result → advance. Wires together the
 * pure scale math (fretboard-model.js), the DOM grid (fretboard-render.js),
 * and the scheduler (srs.js) — no scale or scheduling logic lives here.
 */

import { NOTE_NAMES, TUNINGS, SCALES, STRING_SETS, STRING_SET_LABELS } from './scales-data.js';
import { getPositionWindows, buildCellMatrix } from './fretboard-model.js';
import { renderFretboard, markResult } from './fretboard-render.js';
import { currentStage, buildPool, pickNext, recordResult } from './srs.js';

const POSITION_WINDOWS = getPositionWindows();
const HISTORY_LENGTH = 4;

/**
 * @param {HTMLElement} root the #drill-view element
 * @param {object} settings shared settings object (mutated in place)
 * @param {() => void} persist call to save settings after a change
 */
export function initDrill(root, settings, persist) {
  root.innerHTML = `
    <div class="drill-stage-label" id="drill-stage-label"></div>
    <div class="drill-prompt" id="drill-prompt"></div>
    <div class="fretboard-scroll"><div class="fretboard" id="drill-fretboard"></div></div>
    <div class="drill-timer" id="drill-timer" hidden></div>
    <button type="button" class="tap-btn drill-action-btn" id="drill-action-btn">Check</button>
    <div class="drill-stats" id="drill-stats"></div>
  `;

  const $stageLabel = root.querySelector('#drill-stage-label');
  const $prompt = root.querySelector('#drill-prompt');
  const $fretboard = root.querySelector('#drill-fretboard');
  const $timer = root.querySelector('#drill-timer');
  const $actionBtn = root.querySelector('#drill-action-btn');
  const $stats = root.querySelector('#drill-stats');

  const recentHistory = [];
  /** @type {Map<string, {stringIndex:number, fret:number}>} */
  let selected = new Map();
  let current = null; // { candidate, stage, requiredCells }
  let repStartTime = 0;
  let timerId = null;
  let graded = false;

  function tuning() {
    return TUNINGS[settings.tuningKey];
  }

  function renderStats() {
    let reps = 0;
    let correct = 0;
    for (const item of Object.values(settings.srs.items)) {
      reps += item.reps;
      correct += item.correct;
    }
    const pct = reps ? Math.round((correct / reps) * 100) : 0;
    $stats.textContent = reps
      ? `${settings.ramp.totalCorrectReps} correct reps · ${pct}% overall accuracy`
      : 'No reps yet';
  }

  function stageLabelText(stage) {
    const strings = STRING_SET_LABELS[stage.stringSet] ?? stage.stringSet;
    const hint = stage.showRoot ? 'root shown' : 'no root hint';
    const timing = stage.timeLimitMs ? `${Math.round(stage.timeLimitMs / 1000)}s limit` : 'no time limit';
    return `${strings} · ${hint} · ${timing}`;
  }

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function startTimer(limitMs) {
    $timer.hidden = false;
    const endAt = repStartTime + limitMs;
    const tick = () => {
      const remaining = Math.max(0, endAt - Date.now());
      $timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
      if (remaining <= 0) {
        grade();
      } else {
        timerId = setTimeout(tick, 100);
      }
    };
    tick();
  }

  function onTap(stringIndex, fret, isSelected) {
    if (graded) return;
    const key = `${stringIndex}:${fret}`;
    if (isSelected) selected.set(key, { stringIndex, fret });
    else selected.delete(key);
  }

  function markGiven(cellEl, cell) {
    cellEl.disabled = true;
    cellEl.classList.add('given');
    cellEl.innerHTML = `<span class="note-name">${cell.note}</span><span class="degree-name">R</span>`;
  }

  function nextRep() {
    clearTimer();
    graded = false;
    selected = new Map();
    $actionBtn.textContent = 'Check';
    $timer.hidden = true;

    const stage = currentStage(settings.ramp.totalCorrectReps);
    const pool = buildPool({ stringSetKey: stage.stringSet, includeAccidentals: settings.includeAccidentals, scaleKeys: stage.scaleKeys });
    const candidate = pickNext(pool, settings.srs.items, recentHistory, settings.srs.globalRepCounter);
    recentHistory.push(candidate);
    if (recentHistory.length > HISTORY_LENGTH) recentHistory.shift();

    const t = tuning();
    const scale = SCALES[candidate.scaleKey];
    const window = POSITION_WINDOWS[candidate.windowIndex];
    const stringIndices = STRING_SETS[candidate.stringSetKey](t.strings.length);
    const cellMatrix = buildCellMatrix({ tuning: t, scale, rootPc: candidate.rootPc, window, stringIndices });
    const requiredCells = stage.showRoot ? cellMatrix.filter((c) => !c.isRoot) : cellMatrix;

    current = { candidate, stage, requiredCells };
    repStartTime = Date.now();

    $stageLabel.textContent = stageLabelText(stage);
    $prompt.textContent = `Find: ${NOTE_NAMES[candidate.rootPc]} ${scale.label}`;

    renderFretboard($fretboard, { tuning: t, window, stringIndices, cellMatrix, interactive: true, showDegrees: false, onTap });

    if (stage.showRoot) {
      const rootCell = cellMatrix.find((c) => c.isRoot);
      const rootEl = rootCell && $fretboard.querySelector(`[data-string="${rootCell.stringIndex}"][data-fret="${rootCell.fret}"]`);
      if (rootEl) markGiven(rootEl, rootCell);
    }

    if (stage.timeLimitMs) startTimer(stage.timeLimitMs);

    renderStats();
  }

  function grade() {
    if (graded) return;
    graded = true;
    clearTimer();

    const { candidate, requiredCells, stage } = current;
    const selectedCells = [...selected.values()];
    const requiredKeys = new Set(requiredCells.map((c) => `${c.stringIndex}:${c.fret}`));
    const isCorrect =
      selectedCells.length === requiredCells.length &&
      selectedCells.every((c) => requiredKeys.has(`${c.stringIndex}:${c.fret}`));
    const elapsed = Date.now() - repStartTime;
    const tooSlow = stage.timeLimitMs != null && elapsed > stage.timeLimitMs;

    markResult($fretboard, { correctCells: requiredCells, selectedCells });

    recordResult(settings.srs.items, candidate.key, { correct: isCorrect, tooSlow }, settings.srs.globalRepCounter);
    settings.srs.globalRepCounter++;
    if (isCorrect) settings.ramp.totalCorrectReps++;
    persist();

    $timer.hidden = true;
    $actionBtn.textContent = 'Next';
    renderStats();
  }

  $actionBtn.addEventListener('click', () => {
    if (graded) nextRep();
    else grade();
  });

  nextRep();
}
