# Practice Tools Hub

A static-site collection of small practice/utility tools for musicians, hosted on GitHub Pages. No build step required — open any `index.html` directly in a browser or serve the repo root with any static file server.

## Repo structure

```
/index.html                  Landing page — lists all available tools
/metronome-ratio/
  index.html                 Ratio-training metronome UI
  app.js                     Metronome app logic
  styles.css                 Metronome styles
/shared/
  audio-scheduler.js         Reusable lookahead beat scheduler (Web Audio API)
  storage.js                 Reusable localStorage get/set helpers
README.md
```

## Running locally

```bash
# Python 3
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static file server works. **Do not** open files via `file://` — ES modules require HTTP.

## Adding a new tool

1. Create a new folder at the repo root (e.g. `/chord-trainer/`).
2. Add `index.html`, your JS, and CSS inside it. Use relative paths (`../shared/`) to import shared modules.
3. Add a link card to the root `index.html` pointing at your new folder.

That's it — no config, no build pipeline to update.

## Key modules

**`shared/audio-scheduler.js` — `BeatScheduler`**
Schedules beats against `AudioContext.currentTime` using a lookahead window so there is no cumulative drift. Pass it an `AudioContext` and a callback; it calls the callback at precise scheduled times regardless of `setInterval` jitter.

**`shared/storage.js`**
Thin wrappers around `localStorage` with JSON serialization, default-merging, and silent failure in private-browsing mode.
