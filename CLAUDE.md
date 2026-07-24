# Project: Practice Tools Hub — Ratio-Training Metronome (Phase 1)

## Context
This repo is a personal "tools hub" — a single GitHub Pages static site that
will host multiple small practice/utility tools over time, each in its own
route, sharing common code. Today's task is the first tool: a guitar
metronome with a "ratio training" mode. Build it to a working, deployable
state. Do not add a build step, framework, or package manager unless
something in this spec requires it — plain HTML/CSS/JS is the goal.

## Repo structure to create
```
/index.html                 landing page, lists available tools (just this one for now)
/metronome-ratio/
  index.html
  app.js
  styles.css
/shared/
  audio-scheduler.js         reusable lookahead scheduler (see below)
  storage.js                 reusable localStorage get/set helpers
README.md                    what this repo is, how to add a new tool, how to run locally
```

## Core requirement: timing engine
Do not use `setInterval` to trigger clicks — it drifts. Implement the
standard **lookahead scheduler** pattern against the Web Audio API:

- One `AudioContext`, created on first user interaction (required by
  browser autoplay policy — don't create it on page load).
- A scheduler function that runs frequently (e.g. every 25ms via
  `setInterval` or `requestAnimationFrame`) and, each time it runs, checks
  whether the *next* beat's scheduled time falls within a lookahead window
  (e.g. 100ms) from `audioContext.currentTime`. If so, schedule that beat's
  click via an `OscillatorNode` or buffered sample at its exact
  `audioContext.currentTime`-relative time, and compute the time for the
  beat after that.
- Beat times are computed from BPM math, not from "now + interval" at
  trigger time, so no cumulative drift.
- Put this in `/shared/audio-scheduler.js` as a small reusable class/module
  (e.g. `class BeatScheduler`) that other future tools can import — it
  shouldn't know anything about "ratio training" or guitars, just: given a
  tempo and a callback, call the callback at precisely the right times.

## Feature requirements

### Transport
- BPM: numeric input, range 20–300, plus tap-tempo (button user taps at
  desired rate; average the last 4–6 tap intervals).
- Start / Stop.

### Ratio training mode
- User sets: base BPM, bars-per-phase (`n`, integer 1–8), time signature
  (4/4, 3/4, 6/8 to start), subdivision (quarter, eighth, eighth-triplet,
  sixteenth).
- Playback: `n` bars at base BPM, then `n` bars at 2x BPM (same
  subdivision — so click rate literally doubles), then loop back to base.
  Continuous, no manual retrigger between phases.
- Model the ratio as a config value (default `2`) rather than a hardcoded
  doubling, so a future settings option (1.5x, 3x) is a one-line change,
  not a rewrite. You do not need to expose that setting in the UI yet —
  just don't hardcode "×2" logic in a way that makes it hard to change later.

### Visual feedback
- Beat flash (visually pulse on each click).
- Bar counter (which bar within the current phase).
- Phase indicator — make it obvious at a glance whether you're currently
  in the base-tempo phase or the double-tempo phase; this is easy to lose
  track of with audio alone.

### Timer
- Simple count-up session timer, start/reset with the transport.

### Settings persistence
- Save current settings (BPM, n, time signature, subdivision, click sound,
  volume) to localStorage via `/shared/storage.js` and restore on load.

### Sound
- At least 2 click sound options (e.g. a woodblock-style tick and a softer
  beep) and a volume slider. Accent the first beat of each bar (louder or
  distinct sound) — standard metronome behavior, don't skip it even though
  it wasn't explicitly called out.

## Explicitly out of scope for this pass
- PWA manifest/service worker (next phase — don't build it yet, but don't
  write code that would make adding it later awkward, e.g. keep all assets
  relative-pathed and avoid anything that assumes a specific hosting root).
- Native app work.
- Additional tools beyond the metronome (just scaffold the landing page
  and structure to make adding one later easy — don't build placeholder
  tools).

## Acceptance criteria (please verify these yourself before calling it done)
1. Runs correctly when opened as a static file / served via GitHub Pages
   — no build step required.
2. At 60, 120, and 200 BPM, let it run for 2+ minutes and confirm (by ear
   or by logging scheduled vs. actual beat times to console) that there's
   no audible/measurable drift.
3. Ratio mode correctly alternates n bars at base tempo / n bars at double
   tempo, indefinitely, matching the configured time signature and
   subdivision.
4. Settings survive a page reload.
5. Works on mobile Safari (this is the primary target device) — test
   viewport sizing and touch targets, not just desktop Chrome.
6. `README.md` explains repo structure and, in a couple sentences, the
   pattern for adding a new tool folder later.

## Workflow
Work in phases, and pause for review after each rather than doing
everything in one pass:
1. Repo scaffold + shared scheduler/storage modules (no UI yet) — confirm
   the scheduler works via console logging before building UI on top of it.
2. Basic transport + steady click (no ratio logic yet).
3. Ratio phase logic wired to the scheduler.
4. Full UI: bar/phase indicators, timer, subdivision/time-signature
   selectors, settings persistence, sound options.
5. Mobile Safari pass + README.

Commit at the end of each phase with a clear message rather than one large
commit at the end.
