import { saveSettings, loadSettings } from '../shared/storage.js';
import { TUNINGS } from './scales-data.js';
import { initReference } from './reference.js';
import { initDrill } from './drill.js';

const STORAGE_KEY = 'fretboard';
const DEFAULTS = {
  view: 'drill',
  tuningKey: '8-string-standard',
  includeAccidentals: false,
  ramp: { totalCorrectReps: 0 },
  srs: { globalRepCounter: 0, items: {} },
  reference: { scaleKey: 'major', rootPc: 0, windowIndex: 0, stringSetKey: 'all', fullNeck: false },
};

// ─── DOM refs ──────────────────────────────────────────────
const $tabDrill = document.getElementById('tab-drill');
const $tabReference = document.getElementById('tab-reference');
const $drillView = document.getElementById('drill-view');
const $referenceView = document.getElementById('reference-view');
const $settingsExpanderBtn = document.getElementById('settings-expander-btn');
const $settingsExpanderBody = document.getElementById('settings-expander-body');
const $tuningSelect = document.getElementById('tuning-select');
const $accidentalsToggle = document.getElementById('accidentals-toggle');
const $resetProgressBtn = document.getElementById('reset-progress-btn');

// ─── Settings ──────────────────────────────────────────────
// loadSettings merges top-level keys, but nested objects are replaced
// wholesale rather than deep-merged — re-merge known nested defaults so a
// later addition to `reference` (or other nested settings) doesn't go
// silently missing on existing saved data.
const settings = loadSettings(STORAGE_KEY, DEFAULTS);
settings.reference = { ...DEFAULTS.reference, ...settings.reference };
settings.ramp = { ...DEFAULTS.ramp, ...settings.ramp };
settings.srs = { ...DEFAULTS.srs, ...settings.srs, items: settings.srs?.items ?? {} };

function persist() {
  saveSettings(STORAGE_KEY, settings);
}

const referenceApi = initReference($referenceView, settings, persist);
const drillApi = initDrill($drillView, settings, persist);

// ─── Tab switching ─────────────────────────────────────────
function setView(view) {
  settings.view = view;
  persist();

  const isDrill = view === 'drill';
  $tabDrill.classList.toggle('active', isDrill);
  $tabDrill.setAttribute('aria-selected', String(isDrill));
  $tabReference.classList.toggle('active', !isDrill);
  $tabReference.setAttribute('aria-selected', String(!isDrill));
  $drillView.hidden = !isDrill;
  $referenceView.hidden = isDrill;
}

$tabDrill.addEventListener('click', () => setView('drill'));
$tabReference.addEventListener('click', () => setView('reference'));

setView(settings.view);

// ─── Settings panel ────────────────────────────────────────
for (const [key, t] of Object.entries(TUNINGS)) {
  $tuningSelect.appendChild(new Option(t.label, key));
}
$tuningSelect.value = settings.tuningKey;
$accidentalsToggle.checked = settings.includeAccidentals;

$tuningSelect.addEventListener('change', () => {
  settings.tuningKey = $tuningSelect.value;
  persist();
  referenceApi.refresh();
  drillApi.refresh();
});

$accidentalsToggle.addEventListener('change', () => {
  settings.includeAccidentals = $accidentalsToggle.checked;
  persist();
});

$resetProgressBtn.addEventListener('click', () => {
  const confirmed = window.confirm('Reset all drill progress? This clears spaced-repetition history and the difficulty ramp.');
  if (!confirmed) return;
  settings.ramp = { ...DEFAULTS.ramp };
  settings.srs = { ...DEFAULTS.srs, items: {} };
  persist();
  drillApi.refresh();
});

$settingsExpanderBtn.addEventListener('click', () => {
  const isOpen = $settingsExpanderBtn.getAttribute('aria-expanded') === 'true';
  if (isOpen) {
    $settingsExpanderBody.style.maxHeight = $settingsExpanderBody.scrollHeight + 'px';
    requestAnimationFrame(() => {
      $settingsExpanderBody.style.maxHeight = '0';
      $settingsExpanderBody.addEventListener('transitionend', () => {
        $settingsExpanderBody.hidden = true;
      }, { once: true });
    });
    $settingsExpanderBtn.setAttribute('aria-expanded', 'false');
  } else {
    $settingsExpanderBody.hidden = false;
    requestAnimationFrame(() => {
      $settingsExpanderBody.style.maxHeight = $settingsExpanderBody.scrollHeight + 'px';
    });
    $settingsExpanderBtn.setAttribute('aria-expanded', 'true');
  }
});
