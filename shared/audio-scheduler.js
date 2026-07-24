/**
 * BeatScheduler — lookahead scheduler built on the Web Audio API.
 *
 * Schedules beats at exact AudioContext times, so there is no cumulative
 * drift regardless of how long the metronome runs.
 *
 * Usage:
 *   const scheduler = new BeatScheduler(audioContext, (beatTime, beatIndex) => {
 *     // beatTime: audioContext.currentTime when the beat should sound
 *     // beatIndex: 0-based beat counter since start
 *   });
 *   scheduler.start(120);   // 120 BPM
 *   scheduler.stop();
 *   scheduler.setBPM(140);  // change tempo while running
 */
export class BeatScheduler {
  /**
   * @param {AudioContext} audioContext
   * @param {(beatTime: number, beatIndex: number) => void} onBeat
   * @param {object} [options]
   * @param {number} [options.scheduleAheadTime=0.1]  seconds of lookahead window
   * @param {number} [options.tickInterval=25]         ms between scheduler ticks
   */
  constructor(audioContext, onBeat, options = {}) {
    this._ctx = audioContext;
    this._onBeat = onBeat;
    this._scheduleAheadTime = options.scheduleAheadTime ?? 0.1;
    this._tickInterval = options.tickInterval ?? 25;

    this._bpm = 120;
    this._running = false;
    this._timerId = null;
    this._nextBeatTime = 0;
    this._beatIndex = 0;
  }

  get bpm() { return this._bpm; }
  get isRunning() { return this._running; }

  /**
   * Start the scheduler at the given BPM.
   * Safe to call if already running (restarts from beat 0).
   */
  start(bpm) {
    this.stop();
    this._bpm = bpm;
    this._beatIndex = 0;
    // Schedule first beat slightly in the future so the AudioContext has time
    // to process before the beat fires.
    this._nextBeatTime = this._ctx.currentTime + 0.05;
    this._running = true;
    this._tick();
    this._timerId = setInterval(() => this._tick(), this._tickInterval);
  }

  stop() {
    this._running = false;
    if (this._timerId !== null) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  /** Change BPM mid-playback without resetting beat index or causing a gap. */
  setBPM(bpm) {
    this._bpm = bpm;
    // _nextBeatTime already computed; the interval for subsequent beats will
    // use the new BPM naturally once _tick() fires again.
  }

  _secondsPerBeat() {
    return 60 / this._bpm;
  }

  _tick() {
    const lookaheadEnd = this._ctx.currentTime + this._scheduleAheadTime;
    while (this._nextBeatTime < lookaheadEnd) {
      this._onBeat(this._nextBeatTime, this._beatIndex);
      this._nextBeatTime += this._secondsPerBeat();
      this._beatIndex += 1;
    }
  }
}
