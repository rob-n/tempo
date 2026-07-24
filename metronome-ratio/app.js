/**
 * Metronome Ratio app — Phase 1 scaffold.
 * Full implementation added in subsequent phases.
 */

import { BeatScheduler } from '../shared/audio-scheduler.js';
import { loadSettings, saveSettings } from '../shared/storage.js';

// Phase 1: console-logging smoke test.
// Open browser DevTools to see scheduled beat times.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('test-btn');
  if (!btn) return;

  let scheduler = null;
  let audioCtx = null;

  btn.addEventListener('click', () => {
    if (scheduler && scheduler.isRunning) {
      scheduler.stop();
      btn.textContent = 'Start scheduler test (120 BPM)';
      return;
    }

    // AudioContext must be created inside a user gesture.
    audioCtx = audioCtx ?? new AudioContext();

    scheduler = new BeatScheduler(audioCtx, (beatTime, beatIndex) => {
      const drift = beatTime - audioCtx.currentTime;
      console.log(`beat ${beatIndex} | scheduled=${beatTime.toFixed(4)}s | ahead=${(drift * 1000).toFixed(1)}ms`);
    });

    scheduler.start(120);
    btn.textContent = 'Stop scheduler test';
  });
});
