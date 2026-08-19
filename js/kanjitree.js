// Full-screen Kanji Radical Tree overlay. This module owns DOM, animation,
// drill-down history, and focus; the compact tree logic stays in kanjivg.js.

import { createKanjiVG } from './kanjivg.js';

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
            <p class="kt-instruction hint"></p>
            <div class="kt-controls">
              <button type="button" class="btn btn-primary kt-explode">Separate components</button>
              <button type="button" class="btn btn-ghost kt-replay">Replay strokes</button>
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
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let api = null;
  let stack = [];
  let returnFocus = null;
  let exploded = false;
  let openRequest = 0;
  let transitionTimer = null;

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

  function renderNode(node, { draw = true } = {}) {
    clearTimeout(transitionTimer);
    overlay.classList.remove('is-exploded');
    exploded = false;
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
    const componentButton = event.target.closest('.kt-component-open');
    if (componentButton) { drill(Number(componentButton.dataset.componentIndex)); return; }
    const component = event.target.closest('.kt-component');
    if (component) { drill(Number(component.dataset.componentIndex)); return; }
    if (event.target.closest('.kt-glyph') && !exploded) setExploded(true);
  });

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
