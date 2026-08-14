// Kanji Constellation Atlas — a bounded, explainable projection of one
// direct-component family. The graph and layout helpers are pure so the sky
// can be tested without a browser; the view adds only ephemeral UI state.

const MAX_STARS = 24;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function codePointOrder(a, b) {
  return a.char.codePointAt(0) - b.char.codePointAt(0);
}

function levelRank(value) {
  const level = Number(value);
  return level >= 1 && level <= 5 ? 6 - level : 9;
}

function familyOrder(a, b) {
  return levelRank(a.jlpt) - levelRank(b.jlpt)
    || (a.strokes || 999) - (b.strokes || 999)
    || codePointOrder(a, b);
}

export function componentConstellationChoices(index, rootChar) {
  const components = index?.attributes?.get(rootChar)?.component || [];
  return [...new Set(components)]
    .map((component) => ({
      component,
      count: index?.buckets?.component?.get(component)?.length || 0,
    }))
    .filter((choice) => choice.count >= 2)
    .sort((a, b) => Math.abs(a.count - 12) - Math.abs(b.count - 12)
      || a.count - b.count
      || a.component.localeCompare(b.component, 'ja'));
}

export function buildComponentConstellation(index, component, options = {}) {
  if (!index?.byChar || !index?.buckets?.component || !component) return null;
  const family = index.buckets.component.get(component) || [];
  const rootChar = options.rootChar || '';
  const limit = Math.min(MAX_STARS, Math.max(2, Number.isInteger(options.limit) ? options.limit : MAX_STARS));
  const rows = family.map((char) => index.byChar.get(char)).filter(Boolean).sort(familyOrder);
  const root = rows.find((item) => item.char === rootChar);
  const ordered = root ? [root, ...rows.filter((item) => item.char !== rootChar)] : rows;
  const stars = ordered.slice(0, limit).map((item, order) => ({
    char: item.char,
    meaning: item.meaning || 'Meaning unavailable',
    jlpt: item.jlpt || null,
    strokes: item.strokes || null,
    order,
    isRoot: item.char === rootChar,
  }));
  return {
    component,
    rootChar,
    stars,
    total: ordered.length,
    truncated: ordered.length > stars.length,
  };
}

function ringCounts(count) {
  if (count <= 8) return [count];
  if (count <= 18) {
    const inner = Math.min(8, Math.ceil(count * .42));
    return [inner, count - inner];
  }
  return [6, 8, count - 14];
}

export function layoutComponentConstellation(constellation) {
  const stars = constellation?.stars || [];
  const rings = ringCounts(stars.length);
  const radii = rings.length === 1
    ? [{ x: 32, y: 31 }]
    : rings.length === 2
      ? [{ x: 23, y: 22 }, { x: 42, y: 39 }]
      : [{ x: 18, y: 17 }, { x: 31, y: 29 }, { x: 44, y: 41 }];
  const layout = [];
  let cursor = 0;
  const offsets = rings.length === 3 ? [-90, -90, -57] : [-90, -77];
  rings.forEach((ringSize, ring) => {
    const offset = offsets[ring];
    for (let position = 0; position < ringSize; position += 1) {
      const angle = (offset + (360 * position) / ringSize) * Math.PI / 180;
      const star = stars[cursor++];
      layout.push({
        ...star,
        ring: ring + 1,
        x: Number((50 + Math.cos(angle) * radii[ring].x).toFixed(3)),
        y: Number((50 + Math.sin(angle) * radii[ring].y).toFixed(3)),
      });
    }
  });
  return layout;
}

function levelLabel(level) {
  return Number(level) >= 1 && Number(level) <= 5 ? `N${level}` : '—';
}

export function createKanjiAtlasView({
  mount,
  index,
  isKnown = () => false,
  onOpenRelations = () => {},
  onRender = () => {},
} = {}) {
  if (typeof document === 'undefined') throw new Error('createKanjiAtlasView requires a document.');
  if (!mount || !index) throw new Error('createKanjiAtlasView requires mount and index.');
  mount.innerHTML = `<section class="ka-shell">
    <header class="ka-toolbar">
      <div><span class="label">KANJI CONSTELLATION ATLAS</span><h2 class="ka-title">Component constellation</h2></div>
      <label class="label ka-picker">Direct component<select class="select" data-ka-component></select></label>
    </header>
    <div class="ka-overview" aria-live="polite"></div>
    <div class="ka-viewport"><div class="ka-stage"></div></div>
    <p class="ka-caption hint">Each line means “contains this direct visual component.” Illuminated stars are kanji already marked known.</p>
  </section>`;
  const shell = mount.firstElementChild;
  const title = shell.querySelector('.ka-title');
  const picker = shell.querySelector('[data-ka-component]');
  const overview = shell.querySelector('.ka-overview');
  const viewport = shell.querySelector('.ka-viewport');
  const stage = shell.querySelector('.ka-stage');
  let root = '';
  let component = '';
  let graph = null;

  function render() {
    const choices = componentConstellationChoices(index, root);
    if (!choices.length) {
      component = '';
      graph = null;
      title.textContent = `${root || 'Kanji'} — no constellation`;
      picker.replaceChildren();
      picker.disabled = true;
      overview.innerHTML = '<span>No shared direct-component family is available.</span>';
      stage.innerHTML = '<div class="ka-empty"><strong>No shared component sky yet</strong><span>Try another kanji in Neighborhood or Two-hop network.</span></div>';
      onRender(null);
      return false;
    }
    picker.disabled = false;
    if (!choices.some((choice) => choice.component === component)) component = choices[0].component;
    picker.innerHTML = choices.map((choice) => `<option value="${esc(choice.component)}"${choice.component === component ? ' selected' : ''}>${esc(choice.component)} · ${choice.count} kanji</option>`).join('');
    graph = buildComponentConstellation(index, component, { rootChar: root });
    const layout = layoutComponentConstellation(graph);
    const knownCount = graph.stars.filter((star) => isKnown(star.char)).length;
    title.textContent = `${component} — component constellation`;
    overview.innerHTML = `<span><b>${graph.stars.length}</b> visible stars</span><span><b>${knownCount}</b> illuminated</span><span><b>${graph.total}</b> in this component family</span>${graph.truncated ? '<span>Bounded for clarity</span>' : ''}`;
    const lines = layout.map((star) => `<line x1="50" y1="50" x2="${star.x}" y2="${star.y}" data-known="${isKnown(star.char)}" />`).join('');
    const stars = layout.map((star) => `<div class="ka-star-position" style="--ka-x:${star.x}%;--ka-y:${star.y}%">
      <button type="button" class="ka-star" data-ka-char="${esc(star.char)}" data-known="${isKnown(star.char)}" data-root="${star.isRoot}" aria-label="Open ${esc(star.char)}, ${esc(star.meaning)}, in Relations">
        <span class="ka-star-glyph">${esc(star.char)}</span><span class="ka-star-copy"><strong>${esc(star.meaning)}</strong><small>${levelLabel(star.jlpt)} · ${star.strokes || '—'} strokes</small></span>
      </button></div>`).join('');
    stage.innerHTML = `<svg class="ka-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <div class="ka-center"><span>${esc(component)}</span><small>direct component</small></div>${stars}`;
    requestAnimationFrame(() => { viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2); });
    onRender({ ...graph, knownCount });
    return true;
  }

  function open(char) {
    if (!char || !index.byChar.has(char)) return false;
    root = char;
    component = '';
    return render();
  }

  picker.addEventListener('change', () => { component = picker.value; render(); });
  shell.addEventListener('click', (event) => {
    const star = event.target.closest('[data-ka-char]');
    if (star) onOpenRelations(star.dataset.kaChar, star);
  });
  return { open, update: () => root && render(), currentChar: () => root, currentComponent: () => component, graph: () => graph };
}
