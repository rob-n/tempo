/**
 * Reference mode: static, non-quiz fretboard diagrams for quick lookup.
 * Shares fretboard-model.js/fretboard-render.js with drill mode — this
 * file only owns the reference-specific controls and their DOM wiring.
 */

import { NOTE_NAMES, TUNINGS, SCALES, STRING_SETS, MAX_FRET } from './scales-data.js';
import { getPositionWindows, buildCellMatrix } from './fretboard-model.js';
import { renderFretboard } from './fretboard-render.js';

const POSITION_WINDOWS = getPositionWindows();

/**
 * @param {HTMLElement} root the #reference-view element
 * @param {object} settings shared settings object (mutated in place)
 * @param {() => void} persist call to save settings after a change
 */
export function initReference(root, settings, persist) {
  root.innerHTML = `
    <div class="ref-controls">
      <label class="control-row">
        <span class="control-label">Scale</span>
        <select class="control-select" id="ref-scale"></select>
      </label>
      <label class="control-row">
        <span class="control-label">Root</span>
        <select class="control-select" id="ref-root"></select>
      </label>
      <label class="control-row">
        <span class="control-label">Strings</span>
        <select class="control-select" id="ref-stringset"></select>
      </label>
      <label class="control-row" id="ref-window-row">
        <span class="control-label">Position</span>
        <select class="control-select" id="ref-window"></select>
      </label>
      <label class="control-row">
        <span class="control-label">Full neck</span>
        <input type="checkbox" id="ref-fullneck">
      </label>
    </div>
    <div class="fretboard-scroll"><div class="fretboard" id="ref-fretboard"></div></div>
  `;

  const $scale = root.querySelector('#ref-scale');
  const $root = root.querySelector('#ref-root');
  const $stringSet = root.querySelector('#ref-stringset');
  const $window = root.querySelector('#ref-window');
  const $windowRow = root.querySelector('#ref-window-row');
  const $fullNeck = root.querySelector('#ref-fullneck');
  const $scroll = root.querySelector('.fretboard-scroll');
  const $fretboard = root.querySelector('#ref-fretboard');

  for (const [key, scale] of Object.entries(SCALES)) {
    $scale.appendChild(new Option(scale.label, key));
  }
  NOTE_NAMES.forEach((name, pc) => $root.appendChild(new Option(name, String(pc))));
  for (const key of Object.keys(STRING_SETS)) {
    $stringSet.appendChild(new Option(key[0].toUpperCase() + key.slice(1), key));
  }
  POSITION_WINDOWS.forEach((w) => $window.appendChild(new Option(`Frets ${w.startFret}–${w.endFret}`, String(w.index))));

  const r = settings.reference;
  $scale.value = r.scaleKey;
  $root.value = String(r.rootPc);
  $stringSet.value = r.stringSetKey;
  $window.value = String(r.windowIndex);
  $fullNeck.checked = r.fullNeck;

  function render() {
    const tuning = TUNINGS[settings.tuningKey];
    const fullNeck = $fullNeck.checked;
    $windowRow.hidden = fullNeck;
    $scroll.classList.toggle('full-neck', fullNeck);

    const window = fullNeck
      ? { startFret: 0, endFret: MAX_FRET }
      : POSITION_WINDOWS[Number($window.value)];
    const stringIndices = fullNeck
      ? STRING_SETS.all(tuning.strings.length)
      : STRING_SETS[$stringSet.value](tuning.strings.length);

    const cellMatrix = buildCellMatrix({
      tuning,
      scale: SCALES[$scale.value],
      rootPc: Number($root.value),
      window,
      stringIndices,
    });

    renderFretboard($fretboard, { tuning, window, stringIndices, cellMatrix, interactive: false, showDegrees: true });
  }

  function onChange() {
    Object.assign(settings.reference, {
      scaleKey: $scale.value,
      rootPc: Number($root.value),
      stringSetKey: $stringSet.value,
      windowIndex: Number($window.value),
      fullNeck: $fullNeck.checked,
    });
    persist();
    render();
  }

  for (const el of [$scale, $root, $stringSet, $window, $fullNeck]) {
    el.addEventListener('change', onChange);
  }

  render();
}
