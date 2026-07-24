import { BeatScheduler } from '../shared/audio-scheduler.js';
import { loadSettings, saveSettings } from '../shared/storage.js';

// ─── Constants ───────────────────────────────────────────────
const BEATS_PER_BAR = { '4/4': 4, '3/4': 3, '6/8': 6 };
const STORAGE_KEY   = 'metronome';
const DEFAULTS      = {
  bpm:          120,
  timeSig:      '4/4',
  sound:        'wood',
  volume:       0.8,
  barsPerPhase: 2,
  ratio:        2,    // not exposed in UI yet; change here to try 1.5x, 3x, etc.
};

// ─── State ───────────────────────────────────────────────────
const settings       = loadSettings(STORAGE_KEY, DEFAULTS);
let audioCtx         = null;
let masterGain       = null;
let scheduler        = null;
let isRunning        = false;
let currentPhaseIsBase = true;  // tracks which phase the scheduler last visited
let tapTimes         = [];
let tapResetId       = null;
let beatDotEls       = [];

// ─── DOM ─────────────────────────────────────────────────────
const $bpmInput    = document.getElementById('bpm-input');
const $bpmDec      = document.getElementById('bpm-dec');
const $bpmInc      = document.getElementById('bpm-inc');
const $timeSig     = document.getElementById('time-sig');
const $sound       = document.getElementById('sound-select');
const $volume      = document.getElementById('volume');
const $barsSelect  = document.getElementById('bars-select');
const $tapBtn      = document.getElementById('tap-btn');
const $startStop   = document.getElementById('start-stop-btn');
const $flash       = document.getElementById('beat-flash');
const $dotsEl      = document.getElementById('beat-dots');
const $phaseBase   = document.getElementById('phase-base');
const $phaseFast   = document.getElementById('phase-fast');
const $barCounter  = document.getElementById('bar-counter');

// ─── Boot ────────────────────────────────────────────────────
function init() {
  $bpmInput.value    = settings.bpm;
  $timeSig.value     = settings.timeSig;
  $sound.value       = settings.sound;
  $volume.value      = settings.volume;
  $barsSelect.value  = settings.barsPerPhase;
  renderBeatDots();
}

// ─── Beat dots ───────────────────────────────────────────────
function renderBeatDots() {
  $dotsEl.innerHTML = '';
  beatDotEls = [];
  const n = BEATS_PER_BAR[settings.timeSig];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'beat-dot';
    $dotsEl.appendChild(d);
    beatDotEls.push(d);
  }
}

function activateDot(index) {
  beatDotEls.forEach((d, i) => {
    d.classList.remove('active', 'active-accent');
    if (i === index) d.classList.add(index === 0 ? 'active-accent' : 'active');
  });
}

function resetDots() {
  beatDotEls.forEach(d => d.classList.remove('active', 'active-accent'));
}

// ─── Audio context ───────────────────────────────────────────
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = settings.volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ─── Click synthesis ─────────────────────────────────────────
function scheduleClick(time, isAccent) {
  (settings.sound === 'beep' ? scheduleBeep : scheduleWood)(time, isAccent);
}

function scheduleWood(time, isAccent) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);

  const f = isAccent ? 1400 : 900;
  osc.frequency.setValueAtTime(f, time);
  osc.frequency.exponentialRampToValueAtTime(f * 0.35, time + 0.04);
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.65, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

  osc.start(time);
  osc.stop(time + 0.08);
}

function scheduleBeep(time, isAccent) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);

  osc.type = 'sine';
  osc.frequency.value = isAccent ? 1000 : 750;
  gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

  osc.start(time);
  osc.stop(time + 0.12);
}

// ─── Beat callback ───────────────────────────────────────────
//
// Phase cycle structure (beatIndex counts from 0):
//
//   beatsPerPhase = barsPerPhase × beatsPerBar
//   cycleLen      = 2 × beatsPerPhase  (base phase + fast phase)
//   beatInCycle   = beatIndex % cycleLen
//
//   [0 … beatsPerPhase-1]   → base phase (at settings.bpm)
//   [beatsPerPhase … cycleLen-1] → fast phase (at settings.bpm × ratio)
//
// BPM switch: called on the LAST beat of each phase so that
// `_nextBeatTime += secondsPerBeat()` inside the scheduler uses the
// new BPM for the very first beat of the incoming phase.
//
function onBeat(beatTime, beatIndex) {
  const beatsPerBar   = BEATS_PER_BAR[settings.timeSig];
  const beatsPerPhase = settings.barsPerPhase * beatsPerBar;
  const cycleLen      = 2 * beatsPerPhase;
  const beatInCycle   = beatIndex % cycleLen;
  const isBase        = beatInCycle < beatsPerPhase;
  const beatInPhase   = isBase ? beatInCycle : beatInCycle - beatsPerPhase;
  const barInPhase    = Math.floor(beatInPhase / beatsPerBar);
  const thisBeatInBar = beatInPhase % beatsPerBar;
  const isAccent      = thisBeatInBar === 0;

  currentPhaseIsBase = isBase;

  // Switch tempo on the last beat of each phase.
  if (beatInPhase === beatsPerPhase - 1) {
    scheduler.setBPM(isBase ? settings.bpm * settings.ratio : settings.bpm);
  }

  scheduleClick(beatTime, isAccent);

  // Visual update fires when the beat actually sounds, not during lookahead.
  const msAhead = Math.max(0, (beatTime - audioCtx.currentTime) * 1000);
  setTimeout(() => {
    $flash.classList.remove('flash-accent', 'flash-beat');
    void $flash.offsetWidth;
    $flash.classList.add(isAccent ? 'flash-accent' : 'flash-beat');
    activateDot(thisBeatInBar);
    updatePhaseUI(isBase, barInPhase + 1, settings.barsPerPhase);
  }, msAhead);
}

// ─── Phase UI ────────────────────────────────────────────────
function updatePhaseUI(isBase, barNum, totalBars) {
  $phaseBase.classList.toggle('active-chip', isBase);
  $phaseFast.classList.toggle('active-chip', !isBase);
  $barCounter.textContent = `Bar ${barNum} of ${totalBars}`;
}

function resetPhaseUI() {
  $phaseBase.classList.remove('active-chip');
  $phaseFast.classList.remove('active-chip');
  $barCounter.textContent = '';
}

// ─── Transport ───────────────────────────────────────────────
function start() {
  ensureAudio();
  currentPhaseIsBase = true;
  scheduler = new BeatScheduler(audioCtx, onBeat);
  scheduler.start(settings.bpm);
  isRunning = true;
  syncTransportUI();
}

function stop() {
  scheduler?.stop();
  scheduler = null;
  isRunning = false;
  currentPhaseIsBase = true;
  syncTransportUI();
  resetDots();
  resetPhaseUI();
  $flash.classList.remove('flash-accent', 'flash-beat');
}

function syncTransportUI() {
  $startStop.classList.toggle('running', isRunning);
  $startStop.querySelector('.btn-icon').textContent  = isRunning ? '■' : '▶';
  $startStop.querySelector('.btn-label').textContent = isRunning ? 'Stop' : 'Start';
}

// ─── BPM ─────────────────────────────────────────────────────
// When changing BPM mid-playback, apply the correct tempo for whichever
// phase is currently active so the scheduler doesn't jump to the wrong speed.
function setBPM(bpm) {
  const v        = Math.max(20, Math.min(300, Math.round(bpm)));
  settings.bpm   = v;
  $bpmInput.value = v;
  if (scheduler) {
    scheduler.setBPM(currentPhaseIsBase ? v : v * settings.ratio);
  }
  saveSettings(STORAGE_KEY, settings);
}

// ─── Tap tempo ───────────────────────────────────────────────
function handleTap() {
  ensureAudio();
  clearTimeout(tapResetId);

  tapTimes.push(performance.now());
  if (tapTimes.length > 6) tapTimes.shift();

  if (tapTimes.length >= 2) {
    let total = 0;
    for (let i = 1; i < tapTimes.length; i++) total += tapTimes[i] - tapTimes[i - 1];
    setBPM(Math.round(60000 / (total / (tapTimes.length - 1))));
  }

  tapResetId = setTimeout(() => { tapTimes = []; }, 3000);
}

// ─── Hold-to-repeat ──────────────────────────────────────────
function holdRepeat(el, fn) {
  let hold = null, repeat = null;
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    fn();
    hold = setTimeout(() => { repeat = setInterval(fn, 80); }, 400);
  });
  const clear = () => { clearTimeout(hold); clearInterval(repeat); };
  el.addEventListener('pointerup', clear);
  el.addEventListener('pointerleave', clear);
  el.addEventListener('pointercancel', clear);
}

// ─── Events ──────────────────────────────────────────────────
holdRepeat($bpmDec, () => setBPM(settings.bpm - 1));
holdRepeat($bpmInc, () => setBPM(settings.bpm + 1));

$bpmInput.addEventListener('input', () => {
  const v = parseInt($bpmInput.value, 10);
  if (!isNaN(v) && v >= 20 && v <= 300) {
    settings.bpm = v;
    if (scheduler) scheduler.setBPM(currentPhaseIsBase ? v : v * settings.ratio);
    saveSettings(STORAGE_KEY, settings);
  }
});
$bpmInput.addEventListener('blur', () => {
  setBPM(parseInt($bpmInput.value, 10) || settings.bpm);
});

$barsSelect.addEventListener('change', () => {
  settings.barsPerPhase = parseInt($barsSelect.value, 10);
  saveSettings(STORAGE_KEY, settings);
});

$timeSig.addEventListener('change', () => {
  settings.timeSig = $timeSig.value;
  renderBeatDots();
  saveSettings(STORAGE_KEY, settings);
});

$sound.addEventListener('change', () => {
  settings.sound = $sound.value;
  saveSettings(STORAGE_KEY, settings);
});

$volume.addEventListener('input', () => {
  settings.volume = parseFloat($volume.value);
  if (masterGain) masterGain.gain.value = settings.volume;
  saveSettings(STORAGE_KEY, settings);
});

$tapBtn.addEventListener('click', handleTap);

$startStop.addEventListener('click', () => {
  isRunning ? stop() : start();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    isRunning ? stop() : start();
  }
});

// ─── Go ──────────────────────────────────────────────────────
init();
