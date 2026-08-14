// Interactive, ephemeral UI for the Kanji Relationship Map.
// Data construction stays in kanji-relationships.js; this module owns only
// layout, focus, history, and rendering.

const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;',
}[char]));

const STRUCTURAL = new Set(['radical', 'component']);
let mapSequence = 0;

export function relationshipLane(neighbor) {
  return neighbor?.structural ? 'structure' : 'reading';
}

export function layoutRelationshipNodes(neighbors, { limit = 12 } = {}) {
  const source = Array.isArray(neighbors) ? neighbors : [];
  const boundedLimit = Math.max(0, limit);
  const allStructural = source.filter((neighbor) => relationshipLane(neighbor) === 'structure');
  const allReadings = source.filter((neighbor) => relationshipLane(neighbor) === 'reading');
  const mixed = allStructural.length > 0 && allReadings.length > 0;
  const perMixedArc = Math.min(4, Math.floor(boundedLimit / 2));
  const structural = mixed ? allStructural.slice(0, perMixedArc) : allStructural.slice(0, boundedLimit);
  const readings = mixed ? allReadings.slice(0, perMixedArc) : allReadings.slice(0, boundedLimit);
  const rows = [...structural, ...readings];
  const place = (group, start, end) => group.map((neighbor, index) => {
    const ratio = group.length === 1 ? 0.5 : index / (group.length - 1);
    const angle = (start + (end - start) * ratio) * Math.PI / 180;
    return {
      neighbor,
      x: Number((50 + Math.cos(angle) * 39).toFixed(2)),
      y: Number((50 + Math.sin(angle) * 38).toFixed(2)),
      lane: relationshipLane(neighbor),
    };
  });
  const placeCircle = (group) => group.map((neighbor, index) => {
    const angle = (-90 + (360 * index / group.length)) * Math.PI / 180;
    return {
      neighbor,
      x: Number((50 + Math.cos(angle) * 39).toFixed(2)),
      y: Number((50 + Math.sin(angle) * 38).toFixed(2)),
      lane: relationshipLane(neighbor),
    };
  });
  // Mixed evidence stays grouped on opposite halves. When one family dominates,
  // use the whole circumference instead of piling every node onto one arc.
  if (!structural.length || !readings.length) return placeCircle(rows);
  return [...place(structural, 110, 250), ...place(readings, -70, 70)];
}

function levelLabel(level) {
  return level == null ? 'Unlisted' : `N${level}`;
}

function relationshipLabel(neighbor) {
  return neighbor.reasons.filter((reason) => reason.kind !== 'stroke').map((reason) => reason.label).join(', ');
}

function primaryKind(neighbor) {
  return STRUCTURAL.has(neighbor.strongestKind) ? neighbor.strongestKind : 'reading';
}

function nodeMarkup(neighbor, { lane = false } = {}) {
  const item = neighbor.item;
  const known = item.known === true;
  const text = item.inText === true;
  const label = `${item.char}, ${item.meaning || 'meaning unavailable'}, related by ${relationshipLabel(neighbor)}`;
  return `<button type="button" class="krm-node${lane ? ' krm-lane-node' : ''}" data-krm-char="${esc(item.char)}" data-kind="${primaryKind(neighbor)}" data-known="${known}" aria-label="${esc(label)}">
    <span class="krm-node-glyph">${esc(item.char)}</span>
    <span class="krm-node-copy"><strong>${esc(item.meaning || 'Meaning unavailable')}</strong><small>${esc(neighbor.reasons[0]?.label || 'Related kanji')}</small></span>
    <span class="krm-node-badges"><i>${levelLabel(item.jlpt)}</i>${known ? '<i>Known</i>' : ''}${text ? '<i>In text</i>' : ''}</span>
  </button>`;
}

function detailMarkup(center, neighbor) {
  if (!neighbor) return `<div class="krm-detail-empty"><span>↗</span><p>Focus or tap a connected kanji to inspect the evidence.</p></div>`;
  const item = neighbor.item;
  return `<div class="krm-detail-head"><span class="krm-detail-pair">${esc(center.char)} → ${esc(item.char)}</span><span class="badge" data-status="reference">${levelLabel(item.jlpt)}</span></div>
    <h3>${esc(item.char)} · ${esc(item.meaning || 'Meaning unavailable')}</h3>
    <ul class="krm-reasons">${neighbor.reasons.map((reason) => `<li data-kind="${esc(reason.kind)}"><span></span>${esc(reason.label)}</li>`).join('')}</ul>
    <p class="hint">These links use dictionary and KanjiVG evidence only; they do not claim etymology.</p>`;
}

function mapMarkup({ embedded, titleId }) {
  return `<section class="${embedded ? 'krm-embedded' : 'krm-overlay'}" ${embedded ? '' : 'role="dialog" aria-modal="true"'} aria-labelledby="${titleId}"${embedded ? '' : ' hidden'}>
    <div class="krm-shell">
      <header class="krm-head">
        <button type="button" class="btn btn-ghost krm-back" aria-label="Go back in relationship history" hidden>← Back</button>
        <div class="krm-heading"><span class="label">KANJI RELATIONSHIP MAP</span><h2 class="krm-title" id="${titleId}">Kanji connections</h2></div>
        ${embedded ? '<span class="krm-head-spacer" aria-hidden="true"></span>' : '<button type="button" class="btn btn-ghost krm-close" aria-label="Close relationship map">Close ×</button>'}
      </header>
      <div class="krm-body">
        <main class="krm-explorer"></main>
        <aside class="krm-detail" aria-live="polite"></aside>
      </div>
    </div>
  </section>`;
}

export function createKanjiMap({
  getRelationships,
  isKnown = () => false,
  toggleKnown = null,
  onKnownChange = () => {},
  inCurrentText = () => false,
  onOpenTree = null,
  onNavigate = () => {},
  mount = null,
} = {}) {
  if (typeof document === 'undefined') throw new Error('createKanjiMap requires a document.');
  if (typeof getRelationships !== 'function') throw new Error('createKanjiMap requires getRelationships().');
  const embedded = Boolean(mount);
  const titleId = `krm-title-${++mapSequence}`;
  const parent = mount || document.body;
  parent.insertAdjacentHTML('beforeend', mapMarkup({ embedded, titleId }));
  const overlay = parent.lastElementChild;
  const explorer = overlay.querySelector('.krm-explorer');
  const detail = overlay.querySelector('.krm-detail');
  const title = overlay.querySelector('.krm-title');
  const backButton = overlay.querySelector('.krm-back');
  const closeButton = overlay.querySelector('.krm-close');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let history = [];
  let currentMap = null;
  let selectedChar = '';
  let returnFocus = null;

  const isOpen = () => embedded ? Boolean(currentMap) : !overlay.hidden;
  const currentChar = () => currentMap?.center?.char || '';

  function focusables() {
    return [...overlay.querySelectorAll('button:not([disabled]):not([hidden])')]
      .filter((element) => element.getClientRects().length > 0);
  }

  function decorate(map) {
    map.center = { ...map.center, known: isKnown(map.center.char), inText: inCurrentText(map.center.char) };
    map.neighbors = map.neighbors.map((neighbor) => ({
      ...neighbor,
      item: { ...neighbor.item, known: isKnown(neighbor.item.char), inText: inCurrentText(neighbor.item.char) },
    }));
    return map;
  }

  function render() {
    if (!currentMap) return;
    const center = currentMap.center;
    const layout = layoutRelationshipNodes(currentMap.neighbors);
    const selected = currentMap.neighbors.find((neighbor) => neighbor.item.char === selectedChar) || currentMap.neighbors[0] || null;
    selectedChar = selected?.item.char || '';
    title.textContent = `${center.char} — relationships`;
    backButton.hidden = history.length < 2;

    const lines = layout.map(({ neighbor, x, y }) => `<line x1="50" y1="50" x2="${x}" y2="${y}" data-kind="${primaryKind(neighbor)}"></line>`).join('');
    const nodes = layout.map(({ neighbor, x, y }) => `<div class="krm-node-position" style="--krm-x:${x}%;--krm-y:${y}%">${nodeMarkup(neighbor)}</div>`).join('');
    const structure = currentMap.neighbors.filter((neighbor) => relationshipLane(neighbor) === 'structure');
    const readings = currentMap.neighbors.filter((neighbor) => relationshipLane(neighbor) === 'reading');
    const lane = (label, rows, empty) => `<section class="krm-lane"><div class="krm-lane-head"><h3>${label}</h3><span>${rows.length}</span></div><div class="krm-lane-track">${rows.length ? rows.map((neighbor) => nodeMarkup(neighbor, { lane: true })).join('') : `<p class="hint">${empty}</p>`}</div></section>`;

    explorer.innerHTML = `<div class="krm-legend" aria-label="Relationship legend"><span data-kind="radical">Radical</span><span data-kind="component">Component</span><span data-kind="reading">Reading</span></div>
      <div class="krm-canvas" aria-label="Relationship canvas">
        <svg class="krm-connectors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${nodes}
        <article class="krm-center" data-known="${center.known}">
          <span class="krm-center-glyph">${esc(center.char)}</span>
          <div><h3>${esc(center.meaning || 'Meaning unavailable')}</h3><p>${center.strokes || '—'} strokes · ${levelLabel(center.jlpt)}${center.inText ? ' · In current text' : ''}</p></div>
          <div class="krm-center-readings"><span><b>On</b>${esc(center.on || '—')}</span><span><b>Kun</b>${esc(center.kun || '—')}</span></div>
          <div class="krm-center-actions">
            ${typeof toggleKnown === 'function' ? `<button type="button" class="btn btn-ghost krm-known" data-known="${center.known}">${center.known ? '✓ Known' : 'Mark known'}</button>` : ''}
            ${typeof onOpenTree === 'function' ? '<button type="button" class="btn btn-ghost krm-tree">Radical Tree</button>' : ''}
          </div>
        </article>
      </div>
      <div class="krm-mobile-lanes">${lane('Structure', structure, 'No structural neighbor in this bounded map.')}${lane('Readings', readings, 'No shared reading in this bounded map.')}</div>
      <p class="krm-summary">${currentMap.neighbors.length} ranked connection${currentMap.neighbors.length === 1 ? '' : 's'} loaded · strongest evidence first${currentMap.truncated ? ` · ${currentMap.totalCandidates} total candidates` : ''}.</p>`;
    detail.innerHTML = detailMarkup(center, selected);
    overlay.dataset.reducedMotion = String(motionQuery.matches);
  }

  function moveTo(char, { push = true, focus = true } = {}) {
    const next = getRelationships(char);
    if (!next) return false;
    currentMap = decorate(next);
    selectedChar = currentMap.neighbors[0]?.item.char || '';
    if (push && history.at(-1) !== char) history.push(char);
    render();
    onNavigate(char);
    if (focus) requestAnimationFrame(() => overlay.querySelector('.krm-center .krm-known, .krm-center .krm-tree, .krm-close, .krm-back')?.focus());
    return true;
  }

  function open(char, trigger = document.activeElement) {
    if (!embedded) returnFocus = trigger;
    history = [];
    if (!embedded) {
      overlay.hidden = false;
      document.body.classList.add('krm-open');
    }
    if (!moveTo(char, { push: true, focus: false })) {
      close();
      return false;
    }
    if (closeButton) closeButton.focus();
    return true;
  }

  function close({ restore = true } = {}) {
    if (!isOpen()) return;
    if (embedded) return;
    overlay.hidden = true;
    document.body.classList.remove('krm-open');
    const target = returnFocus;
    returnFocus = null;
    if (restore) {
      if (target?.isConnected) target.focus?.();
      else {
        const char = target?.dataset?.kanjiMap;
        const replacement = char
          ? [...document.querySelectorAll('.panel.is-active [data-kanji-map]')]
            .find((doorway) => doorway.dataset.kanjiMap === char)
          : null;
        (replacement || document.querySelector('.tab.is-active'))?.focus?.();
      }
    }
  }

  function update() {
    if (!isOpen() || !currentChar()) return;
    moveTo(currentChar(), { push: false, focus: false });
  }

  function selectNeighbor(char) {
    const neighbor = currentMap?.neighbors.find((row) => row.item.char === char);
    if (!neighbor) return;
    selectedChar = char;
    detail.innerHTML = detailMarkup(currentMap.center, neighbor);
  }

  overlay.addEventListener('pointerover', (event) => {
    const node = event.target.closest('[data-krm-char]');
    if (node) selectNeighbor(node.dataset.krmChar);
  });
  overlay.addEventListener('focusin', (event) => {
    const node = event.target.closest('[data-krm-char]');
    if (node) selectNeighbor(node.dataset.krmChar);
  });
  overlay.addEventListener('click', (event) => {
    if ((!embedded && event.target === overlay) || event.target.closest('.krm-close')) { close(); return; }
    if (event.target.closest('.krm-back')) {
      if (history.length > 1) { history.pop(); moveTo(history.at(-1), { push: false }); }
      return;
    }
    if (event.target.closest('.krm-known') && typeof toggleKnown === 'function') {
      const char = currentChar();
      const known = toggleKnown(char);
      onKnownChange(char, known);
      update();
      return;
    }
    if (event.target.closest('.krm-tree') && typeof onOpenTree === 'function') {
      const char = currentChar();
      const target = embedded ? event.target.closest('.krm-tree') : returnFocus;
      if (!embedded) close({ restore: false });
      onOpenTree(char, target);
      return;
    }
    const node = event.target.closest('[data-krm-char]');
    if (node) moveTo(node.dataset.krmChar);
  });
  overlay.addEventListener('keydown', (event) => {
    if (!embedded && event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (!embedded && event.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  motionQuery.addEventListener?.('change', () => { overlay.dataset.reducedMotion = String(motionQuery.matches); });
  return { open, close, update, isOpen, currentChar, destroy: () => overlay.remove() };
}
