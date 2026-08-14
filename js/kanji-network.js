// Bounded two-hop exploration for the Relations workspace.
// The graph builder and layout stay pure; this module owns the optional DOM view.

const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;',
}[char]));

const STRUCTURAL = new Set(['radical', 'component']);

function primaryKind(neighbor) {
  return STRUCTURAL.has(neighbor?.strongestKind) ? neighbor.strongestKind : 'reading';
}

function edgeFrom(from, to, neighbor) {
  return {
    from,
    to,
    kind: primaryKind(neighbor),
    label: neighbor?.reasons?.find((reason) => reason.kind !== 'stroke')?.label || 'Related kanji',
  };
}

function chooseFirstHop(neighbors, limit) {
  const rows = Array.isArray(neighbors) ? neighbors : [];
  const structural = rows.filter((neighbor) => neighbor.structural);
  const readings = rows.filter((neighbor) => !neighbor.structural);
  if (!structural.length || !readings.length) return rows.slice(0, limit);
  const structuralLimit = Math.ceil(limit / 2);
  const readingLimit = Math.floor(limit / 2);
  const selected = [...structural.slice(0, structuralLimit), ...readings.slice(0, readingLimit)];
  if (selected.length >= limit) return selected;
  const chosen = new Set(selected.map((neighbor) => neighbor.item.char));
  return [...selected, ...rows.filter((neighbor) => !chosen.has(neighbor.item.char))].slice(0, limit);
}

/** Build a deterministic, bounded graph with at most two relationship hops. */
export function buildKanjiNetwork(getRelationships, rootChar, options = {}) {
  if (typeof getRelationships !== 'function') return null;
  const rootMap = getRelationships(rootChar);
  if (!rootMap) return null;

  const maxNodes = Math.max(3, Number.isInteger(options.maxNodes) ? options.maxNodes : 36);
  const firstHopLimit = Math.max(1, Number.isInteger(options.firstHopLimit) ? options.firstHopLimit : 10);
  const baseBranchLimit = Math.max(0, Number.isInteger(options.baseBranchLimit) ? options.baseBranchLimit : 1);
  const expandedBranchLimit = Math.max(baseBranchLimit, Number.isInteger(options.expandedBranchLimit) ? options.expandedBranchLimit : 5);
  const expanded = new Set(options.expanded || []);
  const nodes = new Map([[rootChar, {
    char: rootChar, item: rootMap.center, depth: 0, cluster: 'root', parent: '', relation: null,
  }]]);
  const edges = [];
  const edgeKeys = new Set();
  let omitted = 0;

  const addEdge = (from, to, neighbor) => {
    const key = `${from}>${to}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(edgeFrom(from, to, neighbor));
  };

  const firstHop = chooseFirstHop(rootMap.neighbors, Math.min(firstHopLimit, maxNodes - 1));
  for (const neighbor of firstHop) {
    const char = neighbor.item.char;
    nodes.set(char, {
      char, item: neighbor.item, depth: 1,
      cluster: neighbor.structural ? 'structure' : 'reading',
      parent: rootChar, relation: neighbor,
    });
    addEdge(rootChar, char, neighbor);
  }

  for (const branch of firstHop) {
    const parent = branch.item.char;
    const branchMap = getRelationships(parent);
    if (!branchMap) continue;
    const branchLimit = expanded.has(parent) ? expandedBranchLimit : baseBranchLimit;
    let added = 0;
    for (const neighbor of branchMap.neighbors) {
      const char = neighbor.item.char;
      if (char === rootChar || char === parent) continue;
      // Existing nodes already have a visible route to the root. Repeating
      // cross-branch edges adds noise without adding a new study choice.
      if (nodes.has(char)) continue;
      if (added >= branchLimit || nodes.size >= maxNodes) {
        omitted += 1;
        continue;
      }
      nodes.set(char, {
        char, item: neighbor.item, depth: 2,
        cluster: branch.structural ? 'structure' : 'reading',
        parent, relation: neighbor,
      });
      addEdge(parent, char, neighbor);
      added += 1;
    }
  }

  return {
    root: rootChar,
    nodes: [...nodes.values()],
    edges,
    expanded: [...expanded].filter((char) => nodes.get(char)?.depth === 1),
    firstHop: firstHop.map((neighbor) => neighbor.item.char),
    truncated: rootMap.truncated || omitted > 0 || nodes.size >= maxNodes,
    omitted,
    maxNodes,
  };
}

function spread(index, count, start = 10, end = 90) {
  if (count <= 1) return 50;
  return Number((start + (end - start) * index / (count - 1)).toFixed(2));
}

/** Place structural and reading branches on opposite sides without overlap-prone rings. */
export function layoutKanjiNetwork(network) {
  if (!network) return [];
  const placed = [{ ...network.nodes.find((node) => node.depth === 0), x: 50, y: 50 }];
  for (const cluster of ['structure', 'reading']) {
    const first = network.nodes.filter((node) => node.depth === 1 && node.cluster === cluster);
    first.forEach((node, index) => placed.push({
      ...node,
      x: cluster === 'structure' ? 33 : 67,
      y: spread(index, first.length, 12, 88),
    }));
    const second = network.nodes.filter((node) => node.depth === 2 && node.cluster === cluster);
    const columns = [second.filter((_, index) => index % 2 === 0), second.filter((_, index) => index % 2 === 1)];
    columns.forEach((column, columnIndex) => column.forEach((node, index) => placed.push({
      ...node,
      x: cluster === 'structure' ? 8 + columnIndex * 12 : 92 - columnIndex * 12,
      y: spread(index, column.length, 8, 92),
    })));
  }
  return placed;
}

function levelLabel(level) {
  return level == null ? 'Unlisted' : `N${level}`;
}

function nodeMarkup(node, known, { mobile = false } = {}) {
  const relation = node.relation;
  const reason = relation?.reasons?.find((row) => row.kind !== 'stroke')?.label || (node.depth === 0 ? 'Current root' : 'Related kanji');
  return `<button type="button" class="kn-node${mobile ? ' kn-lane-node' : ''}" data-kn-char="${esc(node.char)}" data-depth="${node.depth}" data-kind="${primaryKind(relation)}" data-known="${known}" aria-label="${esc(`${node.char}, ${node.item.meaning || 'meaning unavailable'}, ${reason}`)}">
    <span class="kn-node-glyph">${esc(node.char)}</span>
    <span class="kn-node-copy"><strong>${esc(node.item.meaning || 'Meaning unavailable')}</strong><small>${esc(reason)}</small></span>
    <span class="kn-node-badge">${levelLabel(node.item.jlpt)}</span>
  </button>`;
}

function detailMarkup(node, root, expanded) {
  if (!node) return '<p class="hint">Select a kanji to inspect this branch.</p>';
  const reason = node.relation?.reasons?.filter((row) => row.kind !== 'stroke').map((row) => row.label).join(' · ') || 'Network root';
  return `<div class="kn-detail-head"><span>${esc(node.char)}</span><div><h3>${esc(node.item.meaning || 'Meaning unavailable')}</h3><p>${levelLabel(node.item.jlpt)} · ${node.item.strokes || '—'} strokes</p></div></div>
    <p class="kn-detail-reason">${esc(reason)}</p>
    <div class="kn-detail-actions">
      ${node.depth === 1 ? `<button type="button" class="btn btn-ghost" data-kn-expand="${esc(node.char)}">${expanded ? 'Collapse branch' : 'Expand branch'}</button>` : ''}
      ${node.char !== root ? `<button type="button" class="btn btn-primary" data-kn-root="${esc(node.char)}">Make new root</button>` : ''}
      <button type="button" class="btn btn-ghost" data-kn-tree="${esc(node.char)}">Radical Tree</button>
    </div>`;
}

export function createKanjiNetworkView({
  mount,
  getRelationships,
  isKnown = () => false,
  onOpenTree = () => {},
  onNewRoot = () => {},
  onRender = () => {},
} = {}) {
  if (typeof document === 'undefined') throw new Error('createKanjiNetworkView requires a document.');
  if (!mount || typeof getRelationships !== 'function') throw new Error('createKanjiNetworkView requires mount and getRelationships().');
  mount.innerHTML = `<section class="kn-shell">
    <header class="kn-toolbar">
      <div><span class="label">TWO-HOP NETWORK</span><h2 class="kn-title">Kanji network</h2></div>
      <div class="kn-zoom" role="group" aria-label="Network zoom"><button type="button" class="btn btn-ghost" data-kn-zoom="out" aria-label="Zoom out">−</button><button type="button" class="btn btn-ghost" data-kn-zoom="fit">Reset</button><button type="button" class="btn btn-ghost" data-kn-zoom="in" aria-label="Zoom in">＋</button></div>
    </header>
    <div class="kn-overview" aria-live="polite"></div>
    <div class="kn-desktop"><div class="kn-viewport"><div class="kn-stage"></div></div><aside class="kn-detail" aria-live="polite"></aside></div>
    <div class="kn-mobile"></div>
  </section>`;
  const shell = mount.firstElementChild;
  const stage = shell.querySelector('.kn-stage');
  const detail = shell.querySelector('.kn-detail');
  const overview = shell.querySelector('.kn-overview');
  const mobile = shell.querySelector('.kn-mobile');
  const title = shell.querySelector('.kn-title');
  let root = '';
  let selected = '';
  let zoom = 1;
  let graph = null;
  const expanded = new Set();

  function render() {
    graph = buildKanjiNetwork(getRelationships, root, { expanded: [...expanded] });
    if (!graph) return false;
    const layout = layoutKanjiNetwork(graph);
    const byChar = new Map(layout.map((node) => [node.char, node]));
    const selectedNode = byChar.get(selected) || byChar.get(root) || layout[0];
    selected = selectedNode?.char || root;
    title.textContent = `${root} — two-hop network`;
    overview.innerHTML = `<span><b>${graph.nodes.length}</b> visible kanji</span><span><b>${graph.firstHop.length}</b> direct branches</span><span><b>2</b> hops maximum</span>${graph.truncated ? '<span>Bounded for clarity</span>' : ''}`;
    const lines = graph.edges.map((edge) => {
      const from = byChar.get(edge.from);
      const to = byChar.get(edge.to);
      if (!from || !to) return '';
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" data-kind="${edge.kind}"><title>${esc(edge.label)}</title></line>`;
    }).join('');
    const nodes = layout.map((node) => `<div class="kn-node-position" style="--kn-x:${node.x}%;--kn-y:${node.y}%">${nodeMarkup(node, isKnown(node.char))}</div>`).join('');
    stage.innerHTML = `<svg class="kn-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}`;
    stage.style.transform = `scale(${zoom})`;
    detail.innerHTML = detailMarkup(selectedNode, root, expanded.has(selected));
    const lane = (cluster, label) => {
      const rows = layout.filter((node) => node.cluster === cluster);
      return `<section class="kn-lane"><div class="kn-lane-head"><h3>${label}</h3><span>${rows.length}</span></div><div class="kn-lane-track">${rows.length ? rows.map((node) => nodeMarkup(node, isKnown(node.char), { mobile: true })).join('') : '<p class="hint">No matching branch.</p>'}</div></section>`;
    };
    mobile.innerHTML = `<article class="kn-mobile-root">${nodeMarkup(byChar.get(root), isKnown(root), { mobile: true })}</article>${lane('structure', 'Structure branches')}${lane('reading', 'Reading branches')}<div class="kn-mobile-detail">${detailMarkup(selectedNode, root, expanded.has(selected))}</div>`;
    onRender(graph);
    return true;
  }

  function open(char) {
    if (!char) return false;
    root = char;
    selected = char;
    expanded.clear();
    return render();
  }

  function update() {
    if (root) render();
  }

  function handleAction(target) {
    const node = target.closest('[data-kn-char]');
    if (node) { selected = node.dataset.knChar; render(); return true; }
    const branch = target.closest('[data-kn-expand]');
    if (branch) {
      const char = branch.dataset.knExpand;
      if (expanded.has(char)) expanded.delete(char); else expanded.add(char);
      selected = char;
      render();
      return true;
    }
    const nextRoot = target.closest('[data-kn-root]');
    if (nextRoot) {
      open(nextRoot.dataset.knRoot);
      onNewRoot(root);
      return true;
    }
    const tree = target.closest('[data-kn-tree]');
    if (tree) { onOpenTree(tree.dataset.knTree, tree); return true; }
    const zoomAction = target.closest('[data-kn-zoom]')?.dataset.knZoom;
    if (zoomAction) {
      zoom = zoomAction === 'fit' ? 1 : Math.min(1.35, Math.max(.75, zoom + (zoomAction === 'in' ? .1 : -.1)));
      stage.style.transform = `scale(${zoom})`;
      return true;
    }
    return false;
  }

  shell.addEventListener('click', (event) => handleAction(event.target));
  return { open, update, currentChar: () => root, graph: () => graph };
}
