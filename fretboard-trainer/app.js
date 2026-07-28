import { saveSettings, loadSettings } from '../shared/storage.js';

const STORAGE_KEY = 'fretboard';
const DEFAULTS = { view: 'drill' };

// ─── DOM refs ──────────────────────────────────────────────
const $tabDrill = document.getElementById('tab-drill');
const $tabReference = document.getElementById('tab-reference');
const $drillView = document.getElementById('drill-view');
const $referenceView = document.getElementById('reference-view');

// ─── Settings ──────────────────────────────────────────────
const settings = loadSettings(STORAGE_KEY, DEFAULTS);

// ─── Tab switching ─────────────────────────────────────────
function setView(view) {
  settings.view = view;
  saveSettings(STORAGE_KEY, settings);

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
