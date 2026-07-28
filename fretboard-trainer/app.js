import { saveSettings, loadSettings } from '../shared/storage.js';
import { initReference } from './reference.js';

const STORAGE_KEY = 'fretboard';
const DEFAULTS = {
  view: 'drill',
  tuningKey: '8-string-standard',
  reference: { scaleKey: 'major', rootPc: 0, windowIndex: 0, stringSetKey: 'all', fullNeck: false },
};

// ─── DOM refs ──────────────────────────────────────────────
const $tabDrill = document.getElementById('tab-drill');
const $tabReference = document.getElementById('tab-reference');
const $drillView = document.getElementById('drill-view');
const $referenceView = document.getElementById('reference-view');

// ─── Settings ──────────────────────────────────────────────
// loadSettings merges top-level keys, but nested objects are replaced
// wholesale rather than deep-merged — re-merge known nested defaults so a
// later addition to `reference` (or other nested settings) doesn't go
// silently missing on existing saved data.
const settings = loadSettings(STORAGE_KEY, DEFAULTS);
settings.reference = { ...DEFAULTS.reference, ...settings.reference };

function persist() {
  saveSettings(STORAGE_KEY, settings);
}

initReference($referenceView, settings, persist);

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
