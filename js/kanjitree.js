// Full-screen Kanji Radical Tree overlay. This module owns DOM, animation,
// drill-down history, and focus; the compact tree logic stays in kanjivg.js.

import { createKanjiVG } from './kanjivg.js';
import {
  answerWritingStroke,
  createWritingSession,
  currentStroke,
  explainStroke,
  restartWritingSession,
  revealWritingStroke,
  undoWritingStroke,
  writingProgress,
} from './writing.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DRAW_TOTAL_MS = 600;
const ASSEMBLE_MS = 220;
const EXPLODE_DISTANCE = 10;

function esc(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[char]));
}

function levelName(level) {
  return level == null ? '—' : `N${level}`;
}

function componentDirection(node, box, index, count) {
  const position = node.position || '';
  if (position.includes('left')) return [-EXPLODE_DISTANCE, 0];
  if (position.includes('right')) return [EXPLODE_DISTANCE, 0];
  if (position.includes('top')) return [0, -EXPLODE_DISTANCE];
  if (position.includes('bottom')) return [0, EXPLODE_DISTANCE];
  if (position.includes('nyo')) return [-8, 8];
  if (position.includes('tare')) return [-7, -8];
  if (position.includes('kamae')) return [0, 8];

  const dx = box.x + box.width / 2 - 54.5;
  const dy = box.y + box.height / 2 - 54.5;
  const length = Math.hypot(dx, dy);
  if (length > 2) return [
    Math.round(dx / length * EXPLODE_DISTANCE),
    Math.round(dy / length * EXPLODE_DISTANCE),
  ];
  const angle = (Math.PI * 2 * index) / Math.max(count, 1) - Math.PI / 2;
  return [
    Math.round(Math.cos(angle) * EXPLODE_DISTANCE),
    Math.round(Math.sin(angle) * EXPLODE_DISTANCE),
  ];
}

function overlayMarkup() {
  return `
    <section class="kt-overlay" role="dialog" aria-modal="true" aria-labelledby="kt-title" hidden>
      <div class="kt-shell">
        <header class="kt-head">
          <button type="button" class="btn btn-ghost kt-back" aria-label="Back to parent component" hidden>← Back</button>
          <div class="kt-heading">
            <span class="label">Kanji Radical Tree</span>
            <h2 id="kt-title">Kanji decomposition</h2>
          </div>
          <button type="button" class="btn btn-ghost kt-close" aria-label="Close kanji tree">Close ×</button>
        </header>
        <div class="kt-status" role="status" aria-live="polite"></div>
        <div class="kt-body" hidden>
          <div class="kt-stage">
            <div class="kt-glyph" role="button" tabindex="0" aria-label="Separate kanji components">
              <svg class="kt-svg" viewBox="0 0 109 109" aria-hidden="true"></svg>
            </div>
            <div class="kt-component-list" aria-label="Kanji components" hidden></div>
            <!-- Writing practice shares the glyph's 109x109 KanjiVG box, so a
                 drawn point needs no conversion beyond the screen CTM. It takes
                 the glyph's place while practising (see .is-writing) and draws
                 its own faint outline guide, rather than overlaying a stage
                 whose strokes animate and explode independently. -->
            <svg class="kt-trace" viewBox="0 0 109 109" hidden aria-label="Writing practice surface" role="application"></svg>
            <p class="kt-instruction hint"></p>
            <div class="kt-controls">
              <button type="button" class="btn btn-primary kt-explode">Separate components</button>
              <button type="button" class="btn btn-ghost kt-replay">Replay strokes</button>
              <button type="button" class="btn btn-ghost kt-write">Practise writing</button>
            </div>
            <div class="kt-trace-tools" hidden>
              <p class="kt-trace-verdict" role="status" aria-live="polite"></p>
              <div class="kt-trace-bar"><span class="kt-trace-fill"></span></div>
              <div class="kt-trace-actions">
                <label class="check"><input type="checkbox" class="kt-trace-guide" checked> Outline guide</label>
                <button type="button" class="btn btn-ghost kt-trace-hint">Show this stroke</button>
                <button type="button" class="btn btn-ghost kt-trace-undo">Undo</button>
                <button type="button" class="btn btn-ghost kt-trace-restart">Start over</button>
              </div>
            </div>
          </div>
          <aside class="kt-info" aria-live="polite"></aside>
        </div>
      </div>
    </section>`;
}

export function createKanjiTree({
  loadData,
  kanjiInfo,
  isKnown = () => false,
  toggleKnown = null,
  onKnownChange = () => {},
  isWordKnown = () => false,
  toggleWordKnown = null,
  onWordKnownChange = () => {},
  onOpenRelationships = null,
  onError = () => {},
  wordsFor = null,
}) {
  if (typeof loadData !== 'function') throw new TypeError('createKanjiTree requires loadData().');
  document.body.insertAdjacentHTML('beforeend', overlayMarkup());
  const overlay = document.body.lastElementChild;
  const shell = overlay.querySelector('.kt-shell');
  const title = overlay.querySelector('#kt-title');
  const status = overlay.querySelector('.kt-status');
  const body = overlay.querySelector('.kt-body');
  const glyph = overlay.querySelector('.kt-glyph');
  const svg = overlay.querySelector('.kt-svg');
  const componentList = overlay.querySelector('.kt-component-list');
  const infoPanel = overlay.querySelector('.kt-info');
  const instruction = overlay.querySelector('.kt-instruction');
  const backButton = overlay.querySelector('.kt-back');
  const closeButton = overlay.querySelector('.kt-close');
  const explodeButton = overlay.querySelector('.kt-explode');
  const replayButton = overlay.querySelector('.kt-replay');
  const writeButton = overlay.querySelector('.kt-write');
  const traceSvg = overlay.querySelector('.kt-trace');
  const traceTools = overlay.querySelector('.kt-trace-tools');
  const traceVerdict = overlay.querySelector('.kt-trace-verdict');
  const traceFill = overlay.querySelector('.kt-trace-fill');
  const traceGuide = overlay.querySelector('.kt-trace-guide');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let api = null;
  let stack = [];
  let returnFocus = null;
  let exploded = false;
  let openRequest = 0;
  let transitionTimer = null;
  // Writing practice. Every one of these dies with the overlay: no storage key,
  // no profile field, no journal event, nothing carried between kanji.
  let writing = null;
  let drawing = null;

  function setReducedMotion() {
    overlay.dataset.reducedMotion = String(motionQuery.matches);
  }
  setReducedMotion();
  motionQuery.addEventListener?.('change', setReducedMotion);

  function isOpen() {
    return !overlay.hidden;
  }

  function currentNode() {
    return stack.at(-1) || null;
  }

  function focusables() {
    return [...overlay.querySelectorAll('button:not([disabled]):not([hidden]), [tabindex="0"]')]
      .filter((element) => element.getClientRects().length > 0);
  }

  function close() {
    if (!isOpen()) return;
    openRequest += 1;
    clearTimeout(transitionTimer);
    writing = null;
    drawing = null;
    overlay.classList.remove('is-writing');
    overlay.hidden = true;
    body.hidden = true;
    status.textContent = '';
    document.body.classList.remove('kt-open');
    const target = returnFocus;
    returnFocus = null;
    if (target?.isConnected && typeof target.focus === 'function') {
      target.focus();
      return;
    }
    // Known-state updates can legitimately re-render a dynamic doorway while
    // the tree is open. Restore to its replacement when possible, otherwise
    // leave keyboard users on the active tab instead of dropping focus to body.
    const char = target?.dataset?.kanjiTree;
    const replacement = char
      ? [...document.querySelectorAll('.panel.is-active [data-kanji-tree]')]
        .find((doorway) => doorway.dataset.kanjiTree === char)
      : null;
    (replacement || document.querySelector('.tab.is-active'))?.focus();
  }

  // The tree explains what a kanji is made of; this says where it is actually
  // used. Injected rather than imported so this module keeps no dictionary of
  // its own.
  function treeWordsMarkup(words) {
    if (!Array.isArray(words) || !words.length) return '';
    return `<div class="kt-info-words">
      <span class="label">Appears in</span>
      ${words.map((word) => {
        const known = isWordKnown(word.w);
        return `<div class="kt-info-word">
        <span class="jp">${esc(word.w)}</span>
        ${word.r ? `<span class="rd">${esc(word.r)}</span>` : ''}
        <small>${esc(String(word.g || '').split(';')[0].trim())}</small>
        ${typeof toggleWordKnown === 'function'
          ? `<button type="button" class="kt-word-known" data-word="${esc(word.w)}" aria-pressed="${known}" title="${known ? `Unmark ${esc(word.w)} as known` : `Mark ${esc(word.w)} as known`}" aria-label="${known ? 'Unmark' : 'Mark'} ${esc(word.w)} as known">${known ? '✓' : '○'}</button>`
          : ''}
      </div>`;
      }).join('')}
    </div>`;
  }

  function renderInfo(node, missing = false) {
    const direct = kanjiInfo?.(node.element) || null;
    const original = !direct && node.original ? kanjiInfo?.(node.original) || null : null;
    const details = direct || original;
    const label = direct
      ? node.element
      : node.original ? `${node.element} · ${node.original} form` : node.element;
    const meaning = details?.meaning || (node.original ? `${node.original} component form` : 'Component');
    infoPanel.innerHTML = `
      <div class="kt-info-head">
        <span class="kt-info-glyph">${esc(node.element)}</span>
        <div><h3>${esc(label)}</h3><p>${esc(meaning)}</p></div>
        ${details ? `<span class="badge" data-status="${details.jlpt == null ? 'archive' : 'reference'}">${levelName(details.jlpt)}</span>` : ''}
      </div>
      ${details?.on || details?.kun ? `<div class="info-yomi">
        ${details.on ? `<div><span class="label">On'yomi</span>${esc(details.on)}</div>` : ''}
        ${details.kun ? `<div><span class="label">Kun'yomi</span>${esc(details.kun)}</div>` : ''}
      </div>` : ''}
      ${details?.strokes ? `<p class="hint">${details.strokes} dictionary strokes</p>` : ''}
      <p class="hint">${missing
        ? 'KanjiVG has no decomposition for this character. Dictionary details remain available.'
        : `${api.strokesOf(node).length} drawn stroke${api.strokesOf(node).length === 1 ? '' : 's'} in this component.`}</p>
      ${direct && typeof wordsFor === 'function' ? treeWordsMarkup(wordsFor(node.element)) : ''}
      ${direct && typeof toggleKnown === 'function' ? `<div class="kt-info-actions">
        <button type="button" class="btn btn-ghost kt-known" data-known="${isKnown(node.element)}">
          ${isKnown(node.element) ? '✓ Known' : 'Mark known'}
        </button>${typeof onOpenRelationships === 'function' ? '<button type="button" class="btn btn-ghost kt-relationships">Relationship Map</button>' : ''}
      </div>` : ''}`;
  }

  function makePath(d, order) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.classList.add('kt-stroke');
    path.dataset.order = order;
    return path;
  }

  function addHitTarget(group) {
    const box = group.getBBox();
    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.classList.add('kt-hit');
    hit.setAttribute('x', box.x - 4);
    hit.setAttribute('y', box.y - 4);
    hit.setAttribute('width', Math.max(box.width + 8, 18));
    hit.setAttribute('height', Math.max(box.height + 8, 18));
    group.insertBefore(hit, group.firstChild);
    return box;
  }

  function animateStrokes() {
    const paths = [...svg.querySelectorAll('.kt-stroke')];
    if (motionQuery.matches) return;
    const duration = Math.min(220, DRAW_TOTAL_MS / Math.max(paths.length, 1));
    const delayStep = paths.length > 1 ? (DRAW_TOTAL_MS - duration) / (paths.length - 1) : 0;
    for (const [index, path] of paths.entries()) {
      const length = Math.max(1, Math.ceil(path.getTotalLength()));
      path.style.setProperty('--kt-length', length);
      path.style.setProperty('--kt-delay', `${Math.round(index * delayStep)}ms`);
      path.style.setProperty('--kt-duration', `${Math.round(duration)}ms`);
      path.classList.remove('is-drawing');
    }
    // Flush once so replaying restarts the CSS animation reliably.
    void svg.getBoundingClientRect();
    paths.forEach((path) => path.classList.add('is-drawing'));
  }

  function setExploded(next) {
    const node = currentNode();
    if (!node || node.children.length === 0) return;
    exploded = next;
    overlay.classList.toggle('is-exploded', exploded);
    explodeButton.textContent = exploded ? 'Assemble kanji' : 'Separate components';
    glyph.setAttribute('role', exploded ? 'group' : 'button');
    glyph.tabIndex = exploded ? -1 : 0;
    glyph.setAttribute('aria-label', exploded ? 'Separated kanji components' : 'Separate kanji components');
    instruction.textContent = exploded
      ? 'Tap a component to make it the new root.'
      : 'Tap the glyph to pull its components apart.';
    svg.querySelectorAll('.kt-component').forEach((group) => {
      group.setAttribute('aria-disabled', String(!exploded));
    });
    componentList.hidden = !exploded;
  }

  // ---- writing practice -----------------------------------------------------
  // The pure grading lives in writing.js; everything here is the surface it is
  // graded from. A stroke is reduced to its two endpoints, taken straight off
  // the real path with getPointAtLength() — exact, and no path parser needed.
  function pathEndpoints(d) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    // Firefox and Safari need the element in a rendered tree before
    // getPointAtLength() will answer, so it is measured inside the live SVG.
    traceSvg.appendChild(path);
    let points = null;
    try {
      const length = path.getTotalLength();
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(length);
      points = { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, d };
    } catch {
      points = null;
    }
    path.remove();
    return points;
  }

  function traceElement(tag, className, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    element.classList.add(className);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    return element;
  }

  // Redraws the practice surface from the session alone, so undo, restart, and
  // a correct stroke all go through exactly one code path.
  function renderTrace() {
    traceSvg.replaceChildren();
    if (!writing) return;
    if (traceGuide.checked) {
      for (const stroke of writing.strokes) {
        traceSvg.appendChild(traceElement('path', 'kt-trace-guide-stroke', { d: stroke.d }));
      }
    }
    // Strokes already earned, drawn as the real thing: the reward for getting
    // the order right is watching the actual kanji assemble itself.
    writing.strokes.slice(0, writing.index).forEach((stroke) => {
      traceSvg.appendChild(traceElement('path', 'kt-trace-done', { d: stroke.d }));
    });

    const progress = writingProgress(writing);
    traceFill.style.width = `${progress.pct}%`;
    traceSvg.dataset.state = progress.complete ? 'complete' : 'drawing';
    overlay.querySelector('.kt-trace-hint').disabled = progress.complete;
    overlay.querySelector('.kt-trace-undo').disabled = writing.index === 0;
    if (progress.complete) {
      traceVerdict.textContent = progress.clean
        ? `All ${progress.total} strokes, in order, first time.`
        : `Done — ${progress.total} strokes, ${progress.misses} miss${progress.misses === 1 ? '' : 'es'}${progress.hints ? `, ${progress.hints} shown` : ''}.`;
      traceVerdict.dataset.tone = progress.clean ? 'good' : 'plain';
    }
    instruction.textContent = progress.complete
      ? 'Start over to write it again, or leave practice to keep exploring.'
      : `Draw stroke ${progress.current} of ${progress.total}.`;
  }

  function setWriting(on) {
    const node = currentNode();
    if (on && !node) return;
    if (on) {
      setExploded(false);
      const strokes = api.strokesOf(node).map(pathEndpoints).filter(Boolean);
      writing = createWritingSession(strokes, { element: node.element });
      if (!writing) { onError('KanjiVG has no strokes to practise for this character.'); return; }
      traceVerdict.textContent = '';
      traceVerdict.dataset.tone = 'plain';
    } else {
      writing = null;
      drawing = null;
    }
    overlay.classList.toggle('is-writing', Boolean(writing));
    // toggleAttribute, not .hidden: `hidden` is an HTMLElement property, and
    // this is an SVGElement — assigning to it sets a JS expando and leaves the
    // attribute (and so the element) exactly where it was.
    traceSvg.toggleAttribute('hidden', !writing);
    traceTools.hidden = !writing;
    componentList.hidden = true;
    explodeButton.disabled = Boolean(writing) || !node || node.children.length === 0;
    replayButton.disabled = Boolean(writing);
    writeButton.textContent = writing ? 'Leave practice' : 'Practise writing';
    if (writing) renderTrace();
    else renderNode(node, { draw: false });
  }

  // Client coordinates → the 109x109 box the strokes are stated in. The CTM
  // handles every scale, and works the same on a phone as on a desktop.
  function tracePoint(event) {
    const ctm = traceSvg.getScreenCTM();
    if (!ctm) return null;
    const point = traceSvg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function beginDrawing(event) {
    if (!writing || writingProgress(writing).complete) return;
    const point = tracePoint(event);
    if (!point) return;
    event.preventDefault();
    traceSvg.setPointerCapture?.(event.pointerId);
    const ink = traceElement('polyline', 'kt-trace-ink', { points: `${point.x},${point.y}` });
    traceSvg.appendChild(ink);
    drawing = { ink, start: point, last: point, points: [point] };
  }

  function extendDrawing(event) {
    if (!drawing) return;
    const point = tracePoint(event);
    if (!point) return;
    event.preventDefault();
    drawing.points.push(point);
    drawing.last = point;
    drawing.ink.setAttribute('points', drawing.points.map((p) => `${p.x},${p.y}`).join(' '));
  }

  function endDrawing(event) {
    if (!drawing) return;
    const current = drawing;
    drawing = null;
    traceSvg.releasePointerCapture?.(event.pointerId);
    current.ink.remove();
    // A tap is not a stroke. Without this every stray touch would be graded,
    // and almost every one of them would be a miss the learner did not make.
    const travelled = Math.hypot(current.last.x - current.start.x, current.last.y - current.start.y);
    if (travelled < 3) return;

    const order = writing.index + 1;
    const { session, verdict } = answerWritingStroke(writing, { start: current.start, end: current.last });
    writing = session;
    traceVerdict.textContent = explainStroke(verdict, order);
    traceVerdict.dataset.tone = verdict?.ok ? 'good' : 'warn';
    renderTrace();
    if (!verdict?.ok) {
      // The rejected stroke stays visible for a moment as its own evidence —
      // "this is what you drew" beside a sentence saying what was expected.
      const ghost = traceElement('polyline', 'kt-trace-miss', {
        points: current.points.map((p) => `${p.x},${p.y}`).join(' '),
      });
      traceSvg.appendChild(ghost);
      setTimeout(() => ghost.remove(), motionQuery.matches ? 1600 : 1200);
    }
  }

  function renderNode(node, { draw = true } = {}) {
    clearTimeout(transitionTimer);
    overlay.classList.remove('is-exploded');
    exploded = false;
    // Drilling into a component, going back, or opening another kanji all mean
    // a different set of strokes, so a practice session never survives them.
    if (writing) {
      writing = null;
      drawing = null;
      overlay.classList.remove('is-writing');
      traceSvg.toggleAttribute('hidden', true);
      traceTools.hidden = true;
      writeButton.textContent = 'Practise writing';
      replayButton.disabled = false;
    }
    svg.replaceChildren();
    title.textContent = `${node.element} — decomposition`;
    backButton.hidden = stack.length < 2;

    const children = node.children || [];
    componentList.replaceChildren();
    const covered = new Set();
    for (const [index, child] of children.entries()) {
      const group = document.createElementNS(SVG_NS, 'g');
      group.classList.add('kt-component');
      group.dataset.componentIndex = index;
      group.dataset.colorSlot = index % 5;
      group.setAttribute('aria-hidden', 'true');
      group.setAttribute('aria-disabled', 'true');
      const childPaths = api.strokesOf(child);
      childPaths.forEach((d, childIndex) => {
        const order = child.strokeStart - node.strokeStart + childIndex;
        covered.add(order);
        group.appendChild(makePath(d, order));
      });
      svg.appendChild(group);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost kt-component-open';
      button.dataset.componentIndex = index;
      button.dataset.colorSlot = index % 5;
      button.innerHTML = `<strong>${esc(child.element)}</strong>${child.position ? `<span>${esc(child.position)}</span>` : ''}`;
      button.setAttribute('aria-label', `Open component ${child.element}`);
      componentList.appendChild(button);
    }

    const loose = document.createElementNS(SVG_NS, 'g');
    loose.classList.add('kt-loose-strokes');
    api.strokesOf(node).forEach((d, index) => {
      if (!covered.has(index)) loose.appendChild(makePath(d, index));
    });
    if (loose.childElementCount) svg.insertBefore(loose, svg.firstChild);

    const groups = [...svg.querySelectorAll('.kt-component')];
    groups.forEach((group, index) => {
      const box = addHitTarget(group);
      const [x, y] = componentDirection(children[index], box, index, groups.length);
      group.style.setProperty('--kt-x', `${x}px`);
      group.style.setProperty('--kt-y', `${y}px`);
    });

    renderInfo(node);
    const stopped = node.truncated || node.cycle;
    const atomic = children.length === 0;
    componentList.hidden = true;
    explodeButton.disabled = atomic;
    explodeButton.textContent = stopped ? 'Decomposition stopped' : atomic ? 'Atomic kanji' : 'Separate components';
    instruction.textContent = node.cycle
      ? 'Further decomposition stopped because this branch repeats an ancestor.'
      : node.truncated
        ? 'Further decomposition stopped at the safety depth limit.'
        : atomic
          ? 'This kanji has no smaller labelled components in KanjiVG.'
          : 'Tap the glyph to pull its components apart.';
    glyph.setAttribute('role', atomic ? 'img' : 'button');
    glyph.tabIndex = atomic ? -1 : 0;
    glyph.setAttribute('aria-label', atomic ? `Atomic kanji ${node.element}` : 'Separate kanji components');
    writeButton.hidden = api.strokesOf(node).length === 0;
    body.hidden = false;
    status.textContent = '';
    if (draw) requestAnimationFrame(animateStrokes);
  }

  function renderMissing(char) {
    const node = { element: char, original: null, children: [] };
    title.textContent = `${char} — details`;
    svg.replaceChildren();
    componentList.replaceChildren();
    componentList.hidden = true;
    backButton.hidden = true;
    explodeButton.disabled = true;
    replayButton.disabled = true;
    writeButton.hidden = true;
    traceSvg.toggleAttribute('hidden', true);
    traceTools.hidden = true;
    glyph.removeAttribute('role');
    glyph.tabIndex = -1;
    instruction.textContent = 'No KanjiVG drawing or decomposition is available.';
    renderInfo(node, true);
    body.hidden = false;
    status.textContent = '';
  }

  function drill(index) {
    if (!exploded) return;
    const child = currentNode()?.children[index];
    if (!child) return;
    stack.push(child);
    renderNode(child);
    glyph.focus();
  }

  function back() {
    if (stack.length < 2) return;
    setExploded(false);
    const finish = () => {
      stack.pop();
      renderNode(currentNode(), { draw: false });
      backButton.focus();
    };
    if (motionQuery.matches) finish();
    else transitionTimer = setTimeout(finish, ASSEMBLE_MS);
  }

  async function open(char, trigger = document.activeElement) {
    const request = ++openRequest;
    returnFocus = trigger;
    overlay.hidden = false;
    body.hidden = true;
    status.innerHTML = '<span class="kt-spinner" aria-hidden="true"></span> Loading KanjiVG stroke data…';
    document.body.classList.add('kt-open');
    closeButton.focus();
    replayButton.disabled = false;
    try {
      if (!api) api = createKanjiVG(await loadData());
      if (request !== openRequest || !isOpen()) return;
      const root = api.decompose(char);
      stack = root ? [root] : [];
      if (root) renderNode(root);
      else renderMissing(char);
    } catch (error) {
      if (request !== openRequest) return;
      console.error(error);
      onError('Could not load KanjiVG — the rest of Kotoba Lab is still available.');
      close();
    }
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) { close(); return; }
    if (event.target.closest('.kt-close')) { close(); return; }
    if (event.target.closest('.kt-back')) { back(); return; }
    if (event.target.closest('.kt-replay')) { animateStrokes(); return; }
    if (event.target.closest('.kt-write')) { setWriting(!writing); return; }
    if (event.target.closest('.kt-trace-hint')) {
      if (!writing) return;
      const order = writing.index + 1;
      writing = revealWritingStroke(writing);
      traceVerdict.textContent = `Stroke ${order} shown — it counts as a hint, not a miss.`;
      traceVerdict.dataset.tone = 'plain';
      renderTrace();
      return;
    }
    if (event.target.closest('.kt-trace-undo')) {
      if (!writing) return;
      writing = undoWritingStroke(writing);
      traceVerdict.textContent = '';
      renderTrace();
      return;
    }
    if (event.target.closest('.kt-trace-restart')) {
      if (!writing) return;
      writing = restartWritingSession(writing);
      traceVerdict.textContent = '';
      traceVerdict.dataset.tone = 'plain';
      renderTrace();
      return;
    }
    if (event.target.closest('.kt-known')) {
      const node = currentNode();
      if (node && kanjiInfo?.(node.element) && typeof toggleKnown === 'function') {
        const known = toggleKnown(node.element);
        renderInfo(node);
        onKnownChange(node.element, known);
      }
      return;
    }
    const wordKnownBtn = event.target.closest('.kt-word-known');
    if (wordKnownBtn) {
      const node = currentNode();
      const word = wordKnownBtn.dataset.word;
      if (node && word && typeof toggleWordKnown === 'function') {
        const known = toggleWordKnown(word);
        renderInfo(node);
        onWordKnownChange(word, known);
      }
      return;
    }
    if (event.target.closest('.kt-relationships') && typeof onOpenRelationships === 'function') {
      const char = currentNode()?.element;
      const target = returnFocus;
      close();
      if (char) onOpenRelationships(char, target);
      return;
    }
    if (event.target.closest('.kt-explode')) { setExploded(!exploded); return; }
    // Component drill-down is off while practising: the strokes on screen are
    // the ones being graded, so changing them mid-session would be incoherent.
    if (writing) return;
    const componentButton = event.target.closest('.kt-component-open');
    if (componentButton) { drill(Number(componentButton.dataset.componentIndex)); return; }
    const component = event.target.closest('.kt-component');
    if (component) { drill(Number(component.dataset.componentIndex)); return; }
    if (event.target.closest('.kt-glyph') && !exploded) setExploded(true);
  });

  traceGuide.addEventListener('change', renderTrace);
  traceSvg.addEventListener('pointerdown', beginDrawing);
  traceSvg.addEventListener('pointermove', extendDrawing);
  traceSvg.addEventListener('pointerup', endDrawing);
  traceSvg.addEventListener('pointercancel', endDrawing);
  // A pointer that leaves the surface mid-stroke still ends it, or the drawn
  // line would silently keep collecting points on the way back in.
  traceSvg.addEventListener('pointerleave', endDrawing);

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.target === glyph && (event.key === 'Enter' || event.key === ' ') && !exploded) {
      event.preventDefault();
      setExploded(true);
      return;
    }
    if (event.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });

  return { open, close, isOpen, destroy: () => overlay.remove() };
}
