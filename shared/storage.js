/**
 * Thin localStorage helpers with JSON serialization and safe fallbacks.
 *
 * Usage:
 *   import { saveSettings, loadSettings } from '../shared/storage.js';
 *   saveSettings('metronome', { bpm: 120, bars: 2 });
 *   const s = loadSettings('metronome', { bpm: 120, bars: 2 }); // defaults merged
 */

/**
 * Persist an object under the given key (namespaced with a prefix).
 * @param {string} key
 * @param {object} data
 */
export function saveSettings(key, data) {
  try {
    localStorage.setItem(`tempo:${key}`, JSON.stringify(data));
  } catch {
    // Private-browsing or storage-full — silently skip.
  }
}

/**
 * Load a previously-saved object, merging with defaults so new keys added
 * in later versions are still present even on older saved data.
 * @param {string} key
 * @param {object} defaults
 * @returns {object}
 */
export function loadSettings(key, defaults = {}) {
  try {
    const raw = localStorage.getItem(`tempo:${key}`);
    if (raw === null) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

/**
 * Remove a saved settings entry.
 * @param {string} key
 */
export function clearSettings(key) {
  try {
    localStorage.removeItem(`tempo:${key}`);
  } catch {
    // ignore
  }
}
