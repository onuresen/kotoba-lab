// Pure KanjiVG tree decoder. No DOM and no fetch: callers pass the already
// loaded generated JSON, keeping the runtime fully offline and easy to test.

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function createKanjiVG(data, options = {}) {
  const maxDepth = positiveInteger(options.maxDepth, 12);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const positions = Array.isArray(data?.positions) ? data.positions : [];
  const entries = data?.kanji && typeof data.kanji === 'object' ? data.kanji : {};

  function decode(encoded, paths, depth, ancestors) {
    if (!Array.isArray(encoded) || encoded.length < 3) return null;
    const element = elements[encoded[0]] ?? null;
    const children = Array.isArray(encoded[3]) ? encoded[3] : [];
    const node = {
      element,
      original: encoded.length > 5 && encoded[5] >= 0 ? elements[encoded[5]] ?? null : null,
      position: encoded.length > 4 && encoded[4] >= 0 ? positions[encoded[4]] ?? null : null,
      strokeStart: positiveInteger(encoded[1], 0),
      strokeCount: positiveInteger(encoded[2], 0),
      children: [],
      atomic: children.length === 0,
      truncated: false,
      cycle: false,
    };
    Object.defineProperty(node, '_paths', { value: paths });

    if (ancestors.has(encoded)) {
      node.cycle = true;
      return node;
    }
    if (depth >= maxDepth) {
      node.truncated = children.length > 0;
      return node;
    }

    ancestors.add(encoded);
    node.children = children.map((child) => decode(child, paths, depth + 1, ancestors)).filter(Boolean);
    ancestors.delete(encoded);
    node.atomic = node.children.length === 0;
    return node;
  }

  function decompose(char) {
    const entry = entries[char];
    if (!Array.isArray(entry) || !Array.isArray(entry[0]) || !Array.isArray(entry[1])) return null;
    return decode(entry[1], entry[0], 0, new Set());
  }

  function strokesOf(node) {
    if (!node || !Array.isArray(node._paths)) return [];
    return node._paths.slice(node.strokeStart, node.strokeStart + node.strokeCount);
  }

  return {
    decompose,
    strokesOf,
    has: (char) => char in entries,
    size: Object.keys(entries).length,
  };
}
