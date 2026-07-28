/**
 * DOM-only fretboard grid rendering. Knows nothing about scales/SRS —
 * takes a pre-computed cell matrix (see fretboard-model.js) and draws it.
 * The same function serves both the static reference view (interactive:
 * false, cells pre-labeled) and the drill view (interactive: true, cells
 * start blank and tappable).
 */

function cellKey(stringIndex, fret) {
  return `${stringIndex}:${fret}`;
}

/**
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {{strings: string[]}} opts.tuning
 * @param {{startFret:number, endFret:number}} opts.window
 * @param {number[]} opts.stringIndices which strings to render, any order
 * @param {ReturnType<typeof import('./fretboard-model.js').buildCellMatrix>} opts.cellMatrix
 * @param {boolean} [opts.interactive] true = every cell is a tappable button; false = only scale-tone cells are drawn
 * @param {boolean} [opts.showDegrees] label scale-tone cells with their degree
 * @param {(stringIndex:number, fret:number, selected:boolean) => void} [opts.onTap]
 */
export function renderFretboard(container, opts) {
  const { tuning, window, stringIndices, cellMatrix, interactive = false, showDegrees = true, onTap = null } = opts;

  const matrixByKey = new Map(cellMatrix.map((c) => [cellKey(c.stringIndex, c.fret), c]));
  const fretCount = window.endFret - window.startFret + 1;
  const rows = [...stringIndices].sort((a, b) => b - a); // highest string on top

  container.innerHTML = '';
  container.classList.add('fretboard');
  container.style.setProperty('--fret-count', String(fretCount));

  // Header row: blank corner + fret numbers.
  container.appendChild(makeCell('fret-header-label', ''));
  for (let f = window.startFret; f <= window.endFret; f++) {
    container.appendChild(makeCell('fret-header-num', String(f)));
  }

  for (const stringIndex of rows) {
    container.appendChild(makeCell('string-label', tuning.strings[stringIndex]));
    for (let f = window.startFret; f <= window.endFret; f++) {
      const match = matrixByKey.get(cellKey(stringIndex, f));
      container.appendChild(makeFretCell({ stringIndex, fret: f, match, interactive, showDegrees, onTap }));
    }
  }
}

function makeCell(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

function makeFretCell({ stringIndex, fret, match, interactive, showDegrees, onTap }) {
  const el = document.createElement(interactive ? 'button' : 'div');
  el.className = 'cell' + (match ? ' scale-tone' : ' empty');
  if (match?.isRoot) el.classList.add('is-root');
  el.dataset.string = String(stringIndex);
  el.dataset.fret = String(fret);

  if (interactive) {
    el.type = 'button';
    el.classList.add('tappable');
    el.addEventListener('click', () => {
      const selected = el.classList.toggle('selected');
      onTap?.(stringIndex, fret, selected);
    });
  } else if (match && showDegrees) {
    el.textContent = match.degree;
  }

  return el;
}

/**
 * After grading a drill rep, mark each tappable cell correct/wrong/missed.
 * @param {HTMLElement} container
 * @param {{correctCells: {stringIndex:number, fret:number, degree:string}[], selectedCells: {stringIndex:number, fret:number}[]}} result
 */
export function markResult(container, { correctCells, selectedCells }) {
  const correctKeys = new Set(correctCells.map((c) => cellKey(c.stringIndex, c.fret)));
  const selectedKeys = new Set(selectedCells.map((c) => cellKey(c.stringIndex, c.fret)));
  const degreeByKey = new Map(correctCells.map((c) => [cellKey(c.stringIndex, c.fret), c.degree]));

  for (const el of container.querySelectorAll('.tappable')) {
    const key = cellKey(Number(el.dataset.string), Number(el.dataset.fret));
    const isCorrect = correctKeys.has(key);
    const isSelected = selectedKeys.has(key);
    el.classList.remove('correct', 'wrong', 'missed');
    if (isCorrect && isSelected) el.classList.add('correct');
    else if (isCorrect && !isSelected) el.classList.add('missed');
    else if (!isCorrect && isSelected) el.classList.add('wrong');
    if (isCorrect) el.textContent = degreeByKey.get(key);
  }
}

/** Reset a drilled fretboard back to blank/untapped for the next rep. */
export function clearMarks(container) {
  for (const el of container.querySelectorAll('.tappable')) {
    el.classList.remove('selected', 'correct', 'wrong', 'missed');
    el.textContent = '';
  }
}
