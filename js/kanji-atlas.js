// Kanji Constellation Atlas — a bounded, explainable projection of one
// direct-component family. The graph and layout helpers are pure so the sky
// can be tested without a browser; the view adds only ephemeral UI state.

const MAX_STARS = 24;
const MAX_READING_ROUTES = 12;
const MAX_EDGES_PER_READING = 3;

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
    on: item.on || '',
    kun: item.kun || '',
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

function readingRouteLabel(index, kind, key, char) {
  const readings = kind === 'on-reading' ? index.byChar.get(char)?._onReadings : index.byChar.get(char)?._kunReadings;
  const display = readings?.find((reading) => reading.key === key)?.display || key;
  return `${display} ${kind === 'on-reading' ? 'on’yomi' : 'kun’yomi'}`;
}

export function buildConstellationReadingRoutes(index, stars, options = {}) {
  if (!index?.attributes || !Array.isArray(stars) || stars.length < 2) return [];
  const limit = Math.min(MAX_READING_ROUTES, Math.max(0, Number.isInteger(options.limit) ? options.limit : MAX_READING_ROUTES));
  if (!limit) return [];
  const order = new Map(stars.map((star, position) => [star.char, position]));
  const groups = new Map();
  for (const star of stars) {
    const attributes = index.attributes.get(star.char) || {};
    for (const kind of ['on-reading', 'kun-reading']) {
      for (const key of attributes[kind] || []) {
        const id = `${kind}:${key}`;
        if (!groups.has(id)) groups.set(id, { kind, key, chars: [] });
        groups.get(id).chars.push(star.char);
      }
    }
  }
  const candidates = [...groups.values()]
    .map((group) => ({ ...group, chars: [...new Set(group.chars)].sort((a, b) => order.get(a) - order.get(b)) }))
    .filter((group) => group.chars.length >= 2)
    .sort((a, b) => a.chars.length - b.chars.length
      || (a.kind === b.kind ? 0 : a.kind === 'on-reading' ? -1 : 1)
      || a.key.localeCompare(b.key, 'ja'));
  const routes = [];
  const pairs = new Set();
  for (const group of candidates) {
    let used = 0;
    for (let position = 1; position < group.chars.length && used < MAX_EDGES_PER_READING; position += 1) {
      const from = group.chars[position - 1];
      const to = group.chars[position];
      const pair = [from, to].sort().join(':');
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      routes.push({
        from,
        to,
        kind: group.kind,
        key: group.key,
        label: readingRouteLabel(index, group.kind, group.key, from),
        familySize: index.buckets?.[group.kind]?.get(group.key)?.length || group.chars.length,
      });
      used += 1;
      if (routes.length >= limit) return routes;
    }
  }
  return routes;
}

export function buildAtlasStudyFamily(constellation, isKnown = () => false) {
  const rows = (constellation?.stars || []).filter((star) => !isKnown(star.char));
  if (!constellation?.component || !rows.length) return null;
  return {
    key: `atlas:${constellation.component}`,
    label: `${constellation.component} constellation · unknown stars`,
    rows,
    totalRows: rows.length,
  };
}

export function buildAtlasChallenges(index, constellation, routes = []) {
  const stars = constellation?.stars || [];
  if (!index?.attributes || !constellation?.component || stars.length < 3) return [];
  const challenges = [];
  const distractors = [...new Set(stars.flatMap((star) => index.attributes.get(star.char)?.component || []))]
    .filter((value) => value !== constellation.component)
    .sort((a, b) => a.localeCompare(b, 'ja'));
  if (distractors.length) {
    const context = stars.slice(0, 3).map((star) => star.char);
    challenges.push({
      id: `component:${constellation.component}`,
      kind: 'component',
      prompt: `${context.join('・')} all share which direct visual component?`,
      options: [constellation.component, ...distractors.slice(0, 2)].sort((a, b) => a.localeCompare(b, 'ja')),
      answer: constellation.component,
      explanation: `KanjiVG lists ${constellation.component} as a direct component in every visible star.`,
    });
  }
  const seenReadings = new Set();
  for (const route of routes) {
    const id = `${route.kind}:${route.key}`;
    if (seenReadings.has(id)) continue;
    seenReadings.add(id);
    const matches = stars.filter((star) => (index.attributes.get(star.char)?.[route.kind] || []).includes(route.key));
    const exceptions = stars.filter((star) => !(index.attributes.get(star.char)?.[route.kind] || []).includes(route.key));
    if (matches.length < 2 || !exceptions.length) continue;
    const options = [...matches.slice(0, 2), exceptions[0]].sort(familyOrder).map((star) => star.char);
    challenges.push({
      id,
      kind: 'reading-exception',
      prompt: `Which kanji does not list ${route.label}?`,
      options,
      answer: exceptions[0].char,
      explanation: `${matches.slice(0, 2).map((star) => star.char).join(' and ')} list ${route.label}; ${exceptions[0].char} is the exception in this set.`,
    });
    if (challenges.length >= 6) break;
  }
  return challenges;
}

function levelLabel(level) {
  return Number(level) >= 1 && Number(level) <= 5 ? `N${level}` : '—';
}

function detailMarkup(item, { root, known, canToggleKnown, canOpenTree, routes = [] } = {}) {
  if (!item) return '<div class="ka-detail-empty"><span>✦</span><p>Select a star to inspect this component family.</p></div>';
  const rootAction = item.char === root
    ? '<button type="button" class="btn btn-ghost" disabled>Current root</button>'
    : '<button type="button" class="btn btn-ghost" data-ka-action="root">Make Atlas root</button>';
  return `<article class="ka-detail-card" data-known="${known}">
    <header class="ka-detail-head"><span>${esc(item.char)}</span><div><span class="badge" data-status="reference">${levelLabel(item.jlpt)}</span><h3>${esc(item.meaning || 'Meaning unavailable')}</h3><p>${item.strokes || '—'} dictionary strokes${item.char === root ? ' · Current Atlas root' : ''}</p></div></header>
    <div class="ka-detail-readings"><span><b>On’yomi</b>${esc(item.on || '—')}</span><span><b>Kun’yomi</b>${esc(item.kun || '—')}</span></div>
    ${routes.length ? `<div class="ka-detail-routes"><b>Reading routes</b>${routes.slice(0, 3).map((route) => `<span data-kind="${esc(route.kind)}"><i></i>${esc(route.label)} · ${esc(route.from === item.char ? route.to : route.from)}</span>`).join('')}</div>` : ''}
    <p class="ka-detail-evidence">This kanji is here because KanjiVG lists <strong>${esc(item.component)}</strong> as a direct visual component.</p>
    <div class="ka-detail-actions">
      ${canToggleKnown ? `<button type="button" class="btn btn-ghost ka-known" data-ka-action="known" data-known="${known}">${known ? '✓ Known' : 'Mark known'}</button>` : ''}
      ${rootAction}
      <button type="button" class="btn btn-primary" data-ka-action="relations">Open neighborhood</button>
      ${canOpenTree ? '<button type="button" class="btn btn-ghost" data-ka-action="tree">Radical Tree</button>' : ''}
    </div>
  </article>`;
}

function challengeMarkup(challenge, { position = 0, total = 0, choice = '' } = {}) {
  if (!challenge) return '<div class="ka-detail-empty"><span>✦</span><p>No quick challenge is available in this sky yet.</p></div>';
  const answered = Boolean(choice);
  const correct = choice === challenge.answer;
  return `<article class="ka-challenge" data-answered="${answered}" data-correct="${correct}">
    <header><div><span class="label">ATLAS QUICK CHALLENGE</span><h3>${challenge.kind === 'component' ? 'Find the shared component' : 'Spot the reading exception'}</h3></div><button type="button" class="btn btn-ghost" data-ka-action="challenge-close" aria-label="Close Atlas challenge">×</button></header>
    <p class="ka-challenge-count">Challenge ${position + 1} of ${total}</p>
    <p class="ka-challenge-prompt">${esc(challenge.prompt)}</p>
    <div class="ka-challenge-options" role="group" aria-label="Challenge choices">${challenge.options.map((option) => `<button type="button" class="btn" data-ka-challenge-choice="${esc(option)}" data-selected="${choice === option}" data-answer="${answered && option === challenge.answer}" ${answered ? 'disabled' : ''}>${esc(option)}</button>`).join('')}</div>
    ${answered ? `<div class="ka-challenge-result" role="status"><strong>${correct ? 'Correct — route found.' : `Not quite — the answer is ${esc(challenge.answer)}.`}</strong><p>${esc(challenge.explanation)}</p></div>` : '<p class="hint">Nothing is scored or stored. Follow the visible evidence and make a choice.</p>'}
    <button type="button" class="btn ${answered ? 'btn-primary' : 'btn-ghost'}" data-ka-action="challenge-next" ${answered ? '' : 'disabled'}>${answered ? 'Next challenge →' : 'Choose an answer'}</button>
  </article>`;
}

export function createKanjiAtlasView({
  mount,
  index,
  isKnown = () => false,
  toggleKnown = null,
  onKnownChange = () => {},
  onOpenRelations = () => {},
  onOpenTree = null,
  onNewRoot = () => {},
  onStartStudy = null,
  onExportPack = null,
  onRender = () => {},
} = {}) {
  if (typeof document === 'undefined') throw new Error('createKanjiAtlasView requires a document.');
  if (!mount || !index) throw new Error('createKanjiAtlasView requires mount and index.');
  mount.innerHTML = `<section class="ka-shell">
    <header class="ka-toolbar">
      <div><span class="label">KANJI CONSTELLATION ATLAS</span><h2 class="ka-title">Component constellation</h2></div>
      <div class="ka-toolbar-tools"><label class="label ka-picker">Direct component<select class="select" data-ka-component></select></label>
        <div class="ka-sky-controls" role="group" aria-label="Constellation controls">
          <button type="button" class="btn btn-ghost ka-routes-toggle" data-ka-control="routes" aria-pressed="true">Routes on</button>
          <button type="button" class="btn btn-ghost" data-ka-control="out" aria-label="Zoom constellation out">−</button>
          <button type="button" class="btn btn-ghost ka-zoom-value" data-ka-control="reset" aria-label="Reset constellation zoom">100%</button>
          <button type="button" class="btn btn-ghost" data-ka-control="in" aria-label="Zoom constellation in">＋</button>
        </div>
      </div>
    </header>
    <div class="ka-overview" aria-live="polite"></div>
    <div class="ka-study-bar" aria-live="polite"></div>
    <div class="ka-explorer"><aside class="ka-detail" aria-live="polite"></aside><div class="ka-viewport"><div class="ka-stage"></div></div></div>
    <p class="ka-caption hint">Solid spokes mean “contains this direct visual component.” Dashed routes mean a shared dictionary reading. Illuminated stars are kanji already marked known.</p>
  </section>`;
  const shell = mount.firstElementChild;
  const title = shell.querySelector('.ka-title');
  const picker = shell.querySelector('[data-ka-component]');
  const overview = shell.querySelector('.ka-overview');
  const studyBar = shell.querySelector('.ka-study-bar');
  const viewport = shell.querySelector('.ka-viewport');
  const stage = shell.querySelector('.ka-stage');
  const detail = shell.querySelector('.ka-detail');
  const routesToggle = shell.querySelector('[data-ka-control="routes"]');
  const zoomValue = shell.querySelector('.ka-zoom-value');
  const phoneQuery = window.matchMedia('(max-width: 720px)');
  let root = '';
  let component = '';
  let selected = '';
  let zoom = 1;
  let showRoutes = true;
  let challengeOpen = false;
  let challengeIndex = 0;
  let challengeChoice = '';
  let graph = null;

  function selectedItem() {
    const star = graph?.stars.find((item) => item.char === selected) || graph?.stars[0];
    return star ? { ...star, component } : null;
  }

  function renderDetail() {
    if (challengeOpen) {
      const challenges = graph?.challenges || [];
      challengeIndex = challenges.length ? challengeIndex % challenges.length : 0;
      detail.innerHTML = challengeMarkup(challenges[challengeIndex], {
        position: challengeIndex, total: challenges.length, choice: challengeChoice,
      });
      return;
    }
    const item = selectedItem();
    selected = item?.char || '';
    const routes = showRoutes ? (graph?.routes || []).filter((route) => route.from === selected || route.to === selected) : [];
    detail.innerHTML = detailMarkup(item, {
      root,
      known: item ? isKnown(item.char) : false,
      canToggleKnown: typeof toggleKnown === 'function',
      canOpenTree: typeof onOpenTree === 'function',
      routes,
    });
    stage.querySelectorAll('[data-ka-char]').forEach((star) => {
      const active = star.dataset.kaChar === selected;
      star.dataset.selected = String(active);
      star.setAttribute('aria-pressed', String(active));
    });
    stage.querySelectorAll('.ka-component-lines line').forEach((line) => { line.dataset.selected = String(line.dataset.char === selected); });
    stage.querySelectorAll('.ka-reading-routes line').forEach((line) => {
      line.dataset.selected = String(line.dataset.from === selected || line.dataset.to === selected);
    });
  }

  function applyZoom({ preserveCenter = true } = {}) {
    const oldWidth = Math.max(1, stage.scrollWidth || stage.getBoundingClientRect().width);
    const centerRatio = (viewport.scrollLeft + viewport.clientWidth / 2) / oldWidth;
    const base = phoneQuery.matches ? { width: 840, height: 580 } : { width: 980, height: 640 };
    stage.style.width = `${Math.round(base.width * zoom)}px`;
    stage.style.height = `${Math.round(base.height * zoom)}px`;
    stage.querySelector('.ka-sky')?.style.setProperty('--ka-zoom', String(zoom));
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    shell.querySelector('[data-ka-control="out"]').disabled = zoom <= .8;
    shell.querySelector('[data-ka-control="in"]').disabled = zoom >= 1.2;
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (preserveCenter ? centerRatio * stage.scrollWidth : stage.scrollWidth / 2) - viewport.clientWidth / 2);
    });
  }

  function render({ preserveScroll = false, preserveSelection = false } = {}) {
    const previousScroll = viewport.scrollLeft;
    const choices = componentConstellationChoices(index, root);
    if (!choices.length) {
      component = '';
      graph = null;
      title.textContent = `${root || 'Kanji'} — no constellation`;
      picker.replaceChildren();
      picker.disabled = true;
      overview.innerHTML = '<span>No shared direct-component family is available.</span>';
      studyBar.replaceChildren();
      stage.innerHTML = '<div class="ka-empty"><strong>No shared component sky yet</strong><span>Try another kanji in Neighborhood or Two-hop network.</span></div>';
      detail.innerHTML = detailMarkup(null);
      onRender(null);
      return false;
    }
    picker.disabled = false;
    if (!choices.some((choice) => choice.component === component)) component = choices[0].component;
    picker.innerHTML = choices.map((choice) => `<option value="${esc(choice.component)}"${choice.component === component ? ' selected' : ''}>${esc(choice.component)} · ${choice.count} kanji</option>`).join('');
    graph = buildComponentConstellation(index, component, { rootChar: root });
    if (!preserveSelection || !graph.stars.some((star) => star.char === selected)) selected = root;
    if (!graph.stars.some((star) => star.char === selected)) selected = graph.stars[0]?.char || '';
    const layout = layoutComponentConstellation(graph);
    graph.routes = buildConstellationReadingRoutes(index, graph.stars);
    graph.studyFamily = buildAtlasStudyFamily(graph, isKnown);
    graph.challenges = buildAtlasChallenges(index, graph, graph.routes);
    const knownCount = graph.stars.filter((star) => isKnown(star.char)).length;
    title.textContent = `${component} — component constellation`;
    overview.innerHTML = `<span><b>${graph.stars.length}</b> visible stars</span><span><b>${knownCount}</b> illuminated</span><span><b>${graph.routes.length}</b> reading routes</span><span><b>${graph.total}</b> in this component family</span>${graph.truncated ? '<span>Bounded for clarity</span>' : ''}`;
    const studyCount = graph.studyFamily?.rows.length || 0;
    studyBar.innerHTML = `<div><button type="button" class="btn btn-primary" data-ka-action="study" ${studyCount && typeof onStartStudy === 'function' ? '' : 'disabled'}>${studyCount ? `Study ${studyCount} unknown` : 'All visible stars known'}</button>
      <button type="button" class="btn btn-ghost" data-ka-action="export" ${typeof onExportPack === 'function' ? '' : 'disabled'}>Export constellation</button>
      <button type="button" class="btn btn-ghost" data-ka-action="challenge" ${graph.challenges.length ? '' : 'disabled'}>Quick challenge</button></div>
      <p>Temporary practice · exports contain dictionary fields only · challenge answers are not stored.</p>`;
    const byChar = new Map(layout.map((star) => [star.char, star]));
    const lines = layout.map((star) => `<line x1="50" y1="50" x2="${star.x}" y2="${star.y}" data-char="${esc(star.char)}" data-known="${isKnown(star.char)}" data-selected="${star.char === selected}" />`).join('');
    const readingRoutes = graph.routes.map((route) => {
      const from = byChar.get(route.from);
      const to = byChar.get(route.to);
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" data-from="${esc(route.from)}" data-to="${esc(route.to)}" data-kind="${esc(route.kind)}" data-selected="${route.from === selected || route.to === selected}"><title>${esc(route.label)}</title></line>`;
    }).join('');
    const stars = layout.map((star) => `<div class="ka-star-position" style="--ka-x:${star.x}%;--ka-y:${star.y}%">
      <button type="button" class="ka-star" data-ka-char="${esc(star.char)}" data-known="${isKnown(star.char)}" data-root="${star.isRoot}" data-selected="${star.char === selected}" aria-pressed="${star.char === selected}" aria-label="Inspect ${esc(star.char)}, ${esc(star.meaning)}">
        <span class="ka-star-glyph">${esc(star.char)}</span><span class="ka-star-copy"><strong>${esc(star.meaning)}</strong><small>${levelLabel(star.jlpt)} · ${star.strokes || '—'} strokes</small></span>
      </button></div>`).join('');
    stage.innerHTML = `<div class="ka-sky"><svg class="ka-lines ka-component-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <svg class="ka-lines ka-reading-routes" data-visible="${showRoutes}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${readingRoutes}</svg>
      <div class="ka-center"><span>${esc(component)}</span><small>direct component</small></div>${stars}</div>`;
    routesToggle.disabled = graph.routes.length === 0;
    routesToggle.setAttribute('aria-pressed', String(showRoutes));
    routesToggle.textContent = showRoutes ? 'Routes on' : 'Routes off';
    applyZoom({ preserveCenter: preserveScroll });
    renderDetail();
    requestAnimationFrame(() => {
      viewport.scrollLeft = preserveScroll ? previousScroll : Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    });
    onRender({ ...graph, knownCount });
    return true;
  }

  function open(char, { preserveComponent = false } = {}) {
    if (!char || !index.byChar.has(char)) return false;
    const preserve = preserveComponent && char === root;
    root = char;
    if (!preserve) component = '';
    if (!preserve) selected = char;
    challengeOpen = false;
    challengeIndex = 0;
    challengeChoice = '';
    return render({ preserveScroll: preserve, preserveSelection: preserve });
  }

  picker.addEventListener('change', () => { component = picker.value; selected = root; challengeOpen = false; challengeIndex = 0; challengeChoice = ''; render(); });
  phoneQuery.addEventListener?.('change', () => applyZoom({ preserveCenter: false }));
  shell.addEventListener('focusin', (event) => {
    const star = event.target.closest('[data-ka-char]');
    if (star && star.dataset.kaChar !== selected) { selected = star.dataset.kaChar; renderDetail(); }
  });
  shell.addEventListener('click', (event) => {
    const star = event.target.closest('[data-ka-char]');
    if (star) { selected = star.dataset.kaChar; challengeOpen = false; renderDetail(); return; }
    const challengeChoiceButton = event.target.closest('[data-ka-challenge-choice]');
    if (challengeChoiceButton && challengeOpen && !challengeChoice) {
      challengeChoice = challengeChoiceButton.dataset.kaChallengeChoice;
      renderDetail();
      return;
    }
    const action = event.target.closest('[data-ka-action]')?.dataset.kaAction;
    const control = event.target.closest('[data-ka-control]')?.dataset.kaControl;
    if (control) {
      if (control === 'routes') {
        showRoutes = !showRoutes;
        stage.querySelector('.ka-reading-routes')?.setAttribute('data-visible', String(showRoutes));
        routesToggle.setAttribute('aria-pressed', String(showRoutes));
        routesToggle.textContent = showRoutes ? 'Routes on' : 'Routes off';
        renderDetail();
      } else {
        zoom = control === 'reset' ? 1 : Math.min(1.2, Math.max(.8, zoom + (control === 'in' ? .1 : -.1)));
        applyZoom();
      }
      return;
    }
    const item = selectedItem();
    if (!action) return;
    if (action === 'study' && graph?.studyFamily && typeof onStartStudy === 'function') {
      onStartStudy(graph.studyFamily);
      return;
    }
    if (action === 'export' && graph && typeof onExportPack === 'function') {
      onExportPack({ title: `${component} constellation`, source: 'atlas', items: graph.stars });
      return;
    }
    if (action === 'challenge') {
      challengeOpen = true;
      challengeChoice = '';
      renderDetail();
      detail.querySelector('[data-ka-challenge-choice]')?.focus();
      return;
    }
    if (action === 'challenge-close') {
      challengeOpen = false;
      challengeChoice = '';
      renderDetail();
      studyBar.querySelector('[data-ka-action="challenge"]')?.focus();
      return;
    }
    if (action === 'challenge-next' && challengeChoice && graph?.challenges?.length) {
      challengeIndex = (challengeIndex + 1) % graph.challenges.length;
      challengeChoice = '';
      renderDetail();
      detail.querySelector('[data-ka-challenge-choice]')?.focus();
      return;
    }
    if (!item) return;
    if (action === 'known' && typeof toggleKnown === 'function') {
      const known = toggleKnown(item.char);
      render({ preserveScroll: true, preserveSelection: true });
      onKnownChange(item.char, known);
    } else if (action === 'root') {
      root = item.char;
      render({ preserveScroll: true, preserveSelection: true });
      onNewRoot(root, { component });
    } else if (action === 'relations') {
      onOpenRelations(item.char, event.target.closest('[data-ka-action]'));
    } else if (action === 'tree' && typeof onOpenTree === 'function') {
      onOpenTree(item.char, event.target.closest('[data-ka-action]'));
    }
  });
  return {
    open,
    update: () => root && render({ preserveScroll: true, preserveSelection: true }),
    currentChar: () => root,
    currentComponent: () => component,
    selectedChar: () => selected,
    graph: () => graph,
  };
}
