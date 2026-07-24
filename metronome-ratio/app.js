import { BeatScheduler } from '../shared/audio-scheduler.js';
import { loadSettings, saveSettings } from '../shared/storage.js';

// ─── Constants ───────────────────────────────────────────────
const BEATS_PER_BAR = { '4/4': 4, '3/4': 3, '6/8': 6 };

// How many scheduler ticks per notated beat for each subdivision.
// Changing the ratio here is all it takes to add a new subdivision.
const SUBDIV_MULT = { quarter: 1, eighth: 2, triplet: 3, sixteenth: 4 };

const STORAGE_KEY = 'metronome';
const DEFAULTS = {
  bpm:           120,
  timeSig:       '4/4',
  subdivision:   'quarter',
  subVolume:     'full',   // 'full' = match beat level | 'soft' = quieter
  sound:         'wood',
  volume:        0.8,
  barsPerPhase:  2,
  stopAfterMins: 0,        // 0 = play indefinitely
  ratio:         2,        // not in UI yet; edit here to try 1.5×, 3×, etc.
};

// ─── State ───────────────────────────────────────────────────
const settings         = loadSettings(STORAGE_KEY, DEFAULTS);
let audioCtx           = null;
let masterGain         = null;
let scheduler          = null;
let isRunning          = false;
let currentPhaseIsBase = true;
let tapTimes           = [];
let tapResetId         = null;
let beatDotEls         = [];
let timerInterval      = null;
let elapsedSeconds     = 0;

// ─── DOM ─────────────────────────────────────────────────────
const $bpmInput    = document.getElementById('bpm-input');
const $bpmDec      = document.getElementById('bpm-dec');
const $bpmInc      = document.getElementById('bpm-inc');
const $timeSig     = document.getElementById('time-sig');
const $subdivSel   = document.getElementById('subdiv-select');
const $subVolSel   = document.getElementById('sub-vol-select');
const $sound       = document.getElementById('sound-select');
const $volume      = document.getElementById('volume');
const $barsSelect  = document.getElementById('bars-select');
const $tapBtn      = document.getElementById('tap-btn');
const $startStop   = document.getElementById('start-stop-btn');
const $flash       = document.getElementById('beat-flash');
const $dotsEl      = document.getElementById('beat-dots');
const $phaseBase   = document.getElementById('phase-base');
const $phaseFast   = document.getElementById('phase-fast');
const $barCounter    = document.getElementById('bar-counter');
const $progressFill  = document.getElementById('phase-progress-fill');
const $timer         = document.getElementById('session-timer');
const $stopAfter     = document.getElementById('stop-after');
const $expanderBtn   = document.getElementById('expander-btn');
const $expanderBody  = document.getElementById('expander-body');

// ─── Boot ────────────────────────────────────────────────────
function init() {
  $bpmInput.value   = settings.bpm;
  $timeSig.value    = settings.timeSig;
  $subdivSel.value  = settings.subdivision;
  $subVolSel.value  = settings.subVolume;
  $stopAfter.value  = settings.stopAfterMins;
  $sound.value      = settings.sound;
  $volume.value     = settings.volume;
  $barsSelect.value = settings.barsPerPhase;
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
    d.classList.remove('past', 'active', 'active-accent');
    if (i < index)      d.classList.add('past');
    else if (i === index) d.classList.add(index === 0 ? 'active-accent' : 'active');
  });
}

function resetDots() {
  beatDotEls.forEach(d => d.classList.remove('past', 'active', 'active-accent'));
}

// ─── Audio context ───────────────────────────────────────────
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = settings.volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ─── Click synthesis ─────────────────────────────────────────
// type: 'accent' (bar downbeat) | 'beat' (other main beats) | 'sub' (subdivision)
function scheduleClick(time, type) {
  const effective = (type === 'sub' && settings.subVolume === 'full') ? 'beat' : type;
  (settings.sound === 'beep' ? scheduleBeep : scheduleWood)(time, effective);
}

const WOOD = {
  accent: { freq: 1400, gain: 1.00, decay: 0.06 },
  beat:   { freq: 900,  gain: 0.65, decay: 0.06 },
  sub:    { freq: 580,  gain: 0.32, decay: 0.04 },
};
const BEEP = {
  accent: { freq: 1000, gain: 0.80, decay: 0.10 },
  beat:   { freq: 750,  gain: 0.50, decay: 0.10 },
  sub:    { freq: 540,  gain: 0.25, decay: 0.07 },
};

function scheduleWood(time, type) {
  const cfg  = WOOD[type];
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);

  osc.frequency.setValueAtTime(cfg.freq, time);
  osc.frequency.exponentialRampToValueAtTime(cfg.freq * 0.35, time + 0.04);
  gain.gain.setValueAtTime(cfg.gain, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + cfg.decay);

  osc.start(time);
  osc.stop(time + cfg.decay + 0.02);
}

function scheduleBeep(time, type) {
  const cfg  = BEEP[type];
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);

  osc.type = 'sine';
  osc.frequency.value = cfg.freq;
  gain.gain.setValueAtTime(cfg.gain, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + cfg.decay);

  osc.start(time);
  osc.stop(time + cfg.decay + 0.02);
}

// ─── Beat callback ───────────────────────────────────────────
//
// The scheduler fires at (bpm × subdivMult) — one tick per subdivision.
// We decompose the tick index to find:
//   barInPhase    — which bar within the current phase (for bar counter)
//   beatInBar     — which notated beat within the bar (for dot position)
//   subdivInBeat  — which subdivision within the beat (0 = main beat)
//
// Phase cycle (in ticks):
//   subPerPhase = barsPerPhase × beatsPerBar × subdivMult
//   cycleLen    = 2 × subPerPhase  (base phase then fast phase)
//
// BPM switch fires on tick 0 of the incoming phase so the outgoing
// phase's last beat keeps its own full-length interval.
//
function onBeat(beatTime, beatIndex) {
  const beatsPerBar  = BEATS_PER_BAR[settings.timeSig];
  const subdivMult   = SUBDIV_MULT[settings.subdivision] ?? 1;
  const subPerBar    = beatsPerBar * subdivMult;
  const subPerPhase  = settings.barsPerPhase * subPerBar;
  const cycleLen     = 2 * subPerPhase;

  const subInCycle   = beatIndex % cycleLen;
  const isBase       = subInCycle < subPerPhase;
  const subInPhase   = isBase ? subInCycle : subInCycle - subPerPhase;
  const barInPhase   = Math.floor(subInPhase / subPerBar);
  const subInBar     = subInPhase % subPerBar;
  const beatInBar    = Math.floor(subInBar / subdivMult);
  const subdivInBeat = subInBar % subdivMult;
  const isMainBeat   = subdivInBeat === 0;
  const isDownbeat   = isMainBeat && beatInBar === 0;

  currentPhaseIsBase = isBase;

  // Switch tempo on tick 0 of each phase (no-op on the very first tick).
  if (subInPhase === 0) {
    scheduler.setBPM(schedulerBPM(isBase));
  }

  const type = isDownbeat ? 'accent' : isMainBeat ? 'beat' : 'sub';
  scheduleClick(beatTime, type);

  // Visuals only update on main beats to avoid overwhelming flicker.
  if (isMainBeat) {
    const msAhead = Math.max(0, (beatTime - audioCtx.currentTime) * 1000);
    setTimeout(() => {
      $flash.classList.remove('flash-accent', 'flash-beat');
      void $flash.offsetWidth;
      $flash.classList.add(isDownbeat ? 'flash-accent' : 'flash-beat');
      activateDot(beatInBar);
      updateProgress(barInPhase, beatInBar);
      updatePhaseUI(isBase, barInPhase + 1, settings.barsPerPhase);
    }, msAhead);
  }
}

// ─── Phase UI ────────────────────────────────────────────────
function updatePhaseUI(isBase, barNum, totalBars) {
  $phaseBase.classList.toggle('active-chip', isBase);
  $phaseFast.classList.toggle('active-chip', !isBase);
  $barCounter.textContent = `Bar ${barNum} of ${totalBars}`;
}

// Progress bar: fills 0→100% across the full phase (all n bars).
// At phase start we snap to 0 instantly to avoid animating backwards.
function updateProgress(barInPhase, beatInBar) {
  const beatsPerBar = BEATS_PER_BAR[settings.timeSig];
  const totalBeats  = settings.barsPerPhase * beatsPerBar;
  const beatInPhase = barInPhase * beatsPerBar + beatInBar;
  const pct         = ((beatInPhase + 1) / totalBeats) * 100;

  if (beatInPhase === 0) {
    // Instant reset, then animate to the first beat's position next frame.
    $progressFill.style.transition = 'none';
    $progressFill.style.width = '0%';
    requestAnimationFrame(() => {
      $progressFill.style.transition = '';
      $progressFill.style.width = `${pct}%`;
    });
  } else {
    $progressFill.style.width = `${pct}%`;
  }
}

function resetPhaseUI() {
  $phaseBase.classList.remove('active-chip');
  $phaseFast.classList.remove('active-chip');
  $barCounter.textContent = '';
  $progressFill.style.transition = 'none';
  $progressFill.style.width = '0%';
}

// ─── Session timer ───────────────────────────────────────────
function startTimer() {
  elapsedSeconds = 0;
  renderTimer();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    renderTimer();
    if (settings.stopAfterMins > 0 && elapsedSeconds >= settings.stopAfterMins * 60) {
      stop();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  elapsedSeconds = 0;
  renderTimer();
}

function renderTimer() {
  const m = Math.floor(elapsedSeconds / 60);
  const s = elapsedSeconds % 60;
  $timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Transport ───────────────────────────────────────────────
function start() {
  ensureAudio();
  currentPhaseIsBase = true;
  scheduler = new BeatScheduler(audioCtx, onBeat);
  scheduler.start(schedulerBPM(true));
  isRunning = true;
  startTimer();
  syncTransportUI();
}

function stop() {
  scheduler?.stop();
  scheduler = null;
  isRunning = false;
  currentPhaseIsBase = true;
  stopTimer();
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

// ─── BPM helpers ─────────────────────────────────────────────
// The scheduler always runs at the notated BPM × subdivision multiplier.
function schedulerBPM(isBase) {
  const mult = SUBDIV_MULT[settings.subdivision] ?? 1;
  return settings.bpm * (isBase ? 1 : settings.ratio) * mult;
}

function setBPM(bpm) {
  const v = Math.max(20, Math.min(300, Math.round(bpm)));
  settings.bpm    = v;
  $bpmInput.value = v;
  if (scheduler) scheduler.setBPM(schedulerBPM(currentPhaseIsBase));
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
    if (scheduler) scheduler.setBPM(schedulerBPM(currentPhaseIsBase));
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

$subdivSel.addEventListener('change', () => {
  settings.subdivision = $subdivSel.value;
  if (scheduler) scheduler.setBPM(schedulerBPM(currentPhaseIsBase));
  saveSettings(STORAGE_KEY, settings);
});

$subVolSel.addEventListener('change', () => {
  settings.subVolume = $subVolSel.value;
  saveSettings(STORAGE_KEY, settings);
});

$stopAfter.addEventListener('change', () => {
  settings.stopAfterMins = parseInt($stopAfter.value, 10);
  saveSettings(STORAGE_KEY, settings);
});

// Expander: animate using max-height so the transition works smoothly.
// The `hidden` attribute prevents the body from being focusable when closed.
$expanderBtn.addEventListener('click', () => {
  const isOpen = $expanderBtn.getAttribute('aria-expanded') === 'true';
  if (isOpen) {
    $expanderBody.style.maxHeight = $expanderBody.scrollHeight + 'px';
    requestAnimationFrame(() => {
      $expanderBody.style.maxHeight = '0';
      $expanderBody.addEventListener('transitionend', () => {
        $expanderBody.hidden = true;
      }, { once: true });
    });
    $expanderBtn.setAttribute('aria-expanded', 'false');
  } else {
    $expanderBody.hidden = false;
    requestAnimationFrame(() => {
      $expanderBody.style.maxHeight = $expanderBody.scrollHeight + 'px';
    });
    $expanderBtn.setAttribute('aria-expanded', 'true');
  }
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
