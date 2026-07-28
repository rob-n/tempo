# Practice Tools Hub

A static-site collection of small practice/utility tools for musicians, hosted on GitHub Pages. No build step required — open any `index.html` directly in a browser or serve the repo root with any static file server. Primary target is mobile Safari.

## Repo structure

```
/index.html                  Landing page — lists all available tools
/metronome-ratio/
  index.html                 Ratio-training metronome UI
  app.js                     Metronome app logic
  styles.css                 Metronome styles
/fretboard-trainer/
  index.html                 Fretboard/scale trainer UI
  app.js                     Tab switching + settings orchestration
  scales-data.js             Scale/tuning/string-set data
  fretboard-model.js         Pure scale-position math (no DOM)
  fretboard-render.js        Fretboard grid rendering (no scale logic)
  srs.js                     Spaced-repetition scheduling (no DOM)
  drill.js                   Drill mode controller
  reference.js               Reference mode controller
  styles.css                 Fretboard trainer styles
/shared/
  audio-scheduler.js         Reusable lookahead beat scheduler (Web Audio API)
  storage.js                 Reusable localStorage get/set helpers
README.md
```

## Running locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static file server works. **Do not** open files via `file://` — ES modules require HTTP.

## Ratio Metronome

Alternates between a base tempo and a faster tempo (default ×2) for a set number of bars, then loops back. Designed for building comfort at a target speed by repeatedly crossing the boundary between comfortable and fast.

**Controls**

| Control | Description |
|---|---|
| BPM | Numeric input, 20–300. Tap +/− or hold for continuous change. |
| Tap Tempo | Averages the last 4–6 tap intervals; resets after a 3 s gap. |
| Bars | How many bars each phase lasts (1–8). |
| Time | Time signature: 4/4, 3/4, or 6/8. |
| Beat | Subdivision: quarter, eighth, triplet, or sixteenth. |
| Stop | Auto-stop after 1–30 minutes, or ∞ for continuous play. |
| Sound settings | Expander containing sub-tick volume (Full/Soft), click sound (Wood/Beep), and volume slider. |
| Start / Stop | Spacebar also toggles. |

**Visual feedback**
- Beat flash circle pulses on every main beat (amber on bar downbeat, white on others).
- Dot row shows beat position within the current bar — past beats stay dimly lit.
- Phase progress bar fills across the full phase (all n bars), resets at each transition.
- BASE / FAST chips show the active phase at a glance.
- Session timer counts up in the header; resets on stop.

**Sound**
- Three click levels: accent (bar downbeat), beat (other main beats), subdivision.
- Wood and Beep sounds synthesised via Web Audio API — no sample files needed.
- All synthesised at precise `AudioContext` times; no drift at any BPM.

**Settings** persist to `localStorage` across reloads (BPM, time sig, subdivision, bars, sound, volume, stop timer).

## Fretboard Trainer

Learns scale shapes across the neck via spaced-repetition drilling, plus a static reference view for quick lookup. Defaults to an 8-string tuned in standard extended range (F#–B–E–A–D–G–B–E); also supports standard 6-string.

**Drill mode**
- Shows a root + scale name and a blank, tappable region of the fretboard; tap every scale tone in that region, then Check.
- A pattern you've never drilled before is shown once as a labeled study card ("Got it — quiz me") before being tested blind — cold-testing something you've never seen isn't retrieval practice, it's guessing.
- A Leitner-style scheduler tracks each (scale, root, string set, position) combination independently: misses resurface almost immediately, correct answers push it further out (hours, then days).
- Picks interleave scale type/root/position rather than blocking repeats of the same one, and a difficulty ramp (gated on total correct reps) progressively removes the root-note hint, widens the string range from the standard low-E-up range to the full extended range, and adds a countdown timer.
- Stats line shows total correct reps and overall accuracy.

**Reference mode**
- Pick a scale, root, string set, and position (or toggle "Full neck" for the whole range, horizontally scrollable) to see a static labeled diagram — no quiz, just lookup.

**Settings** (expander, top of page)
- Tuning selector, a "sharps/flats" toggle for whether the drill's root pool includes accidentals (off by default), and a reset-progress action that clears spaced-repetition/ramp state.

**Settings** persist to `localStorage` across reloads (tuning, accidentals toggle, reference-view selections, drill ramp progress, per-item spaced-repetition state).

## Adding a new tool

1. Create a new folder at the repo root (e.g. `/chord-trainer/`).
2. Add `index.html`, your JS, and CSS inside it. Use relative paths (`../shared/`) to import shared modules.
3. Add a link card to the root `index.html`.

No config, no build pipeline to update.

## Key shared modules

**`shared/audio-scheduler.js` — `BeatScheduler`**

```js
import { BeatScheduler } from '../shared/audio-scheduler.js';

const scheduler = new BeatScheduler(audioContext, (beatTime, beatIndex) => {
  // beatTime: exact AudioContext time the beat should sound
  // beatIndex: 0-based counter since start
});
scheduler.start(120);   // BPM
scheduler.setBPM(240);  // change tempo mid-playback
scheduler.stop();
```

Schedules beats against `AudioContext.currentTime` with a lookahead window (default 100 ms, ticking every 25 ms). No cumulative drift.

**`shared/storage.js`**

```js
import { saveSettings, loadSettings } from '../shared/storage.js';

saveSettings('my-tool', { bpm: 120 });
const s = loadSettings('my-tool', { bpm: 120 }); // defaults merged in
```

Thin wrappers around `localStorage` — JSON serialisation, default-merging on load, silent failure in private-browsing mode.
