// Pure relationship engine for the Kanji Relationship Map.
//
// Connections are evidence from the dictionaries already shipped with Kotoba
// Lab. Stroke proximity may strengthen an existing connection, but deliberately
// never creates one by itself: "both have eight strokes" is not a useful family.

const BASE_WEIGHT = Object.freeze({
  radical: 64,
  component: 48,
  'on-reading': 36,
  'kun-reading': 32,
});

const STRUCTURAL_KINDS = new Set(['radical', 'component']);
const READING_KINDS = new Set(['on-reading', 'kun-reading']);

function codePointOrder(a, b) {
  return a.char.codePointAt(0) - b.char.codePointAt(0);
}

function addToBucket(map, key, char) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(char);
}

function unique(values) {
  return [...new Set(Array.isArray(values) ? values.filter(Boolean) : [])];
}

function attributesFor(item, structureIndex) {
  const structure = structureIndex?.byKanji?.get(item.char) || {};
  return {
    radical: unique(structure.radicals),
    component: unique(structure.components),
    'on-reading': (item._onReadings || []).map((reading) => reading.key),
    'kun-reading': (item._kunReadings || []).map((reading) => reading.key),
  };
}

function readingDisplay(item, kind, key) {
  const readings = kind === 'on-reading' ? item._onReadings : item._kunReadings;
  return readings?.find((reading) => reading.key === key)?.display || key;
}

function reasonLabel(item, kind, key) {
  if (kind === 'radical') return `${key} radical`;
  if (kind === 'component') return `${key} component`;
  return `${readingDisplay(item, kind, key)} ${kind === 'on-reading' ? 'on’yomi' : 'kun’yomi'}`;
}

function rarityBonus(familySize) {
  // Small, legible families are more informative. The bonus is intentionally
  // modest so a rare reading cannot outrank a genuine structural connection.
  const bucket = Math.floor(Math.log2(Math.max(2, familySize)));
  return Math.max(0, 12 - bucket * 2);
}

function reasonOrder(a, b) {
  return b.weight - a.weight || a.label.localeCompare(b.label, 'ja');
}

/**
 * Build reusable reverse indexes from the already-loaded dictionary catalog
 * and compact KanjiVG family index. No DOM, storage, fetch, or stroke paths.
 */
export function buildKanjiRelationshipIndex(catalog, structureIndex = null) {
  const rows = Array.isArray(catalog) ? catalog.filter((item) => item?.char) : [];
  const byChar = new Map(rows.map((item) => [item.char, item]));
  const attributes = new Map();
  const buckets = {
    radical: new Map(),
    component: new Map(),
    'on-reading': new Map(),
    'kun-reading': new Map(),
  };

  for (const item of rows) {
    const itemAttributes = attributesFor(item, structureIndex);
    attributes.set(item.char, itemAttributes);
    for (const [kind, values] of Object.entries(itemAttributes)) {
      for (const key of values) addToBucket(buckets[kind], key, item.char);
    }
  }

  return { byChar, attributes, buckets, size: byChar.size };
}

/**
 * Return a bounded, deterministic neighborhood around one kanji.
 *
 * A neighbor can carry several reasons. Structural evidence is weighted above
 * readings; stroke proximity is appended only after a real relationship is
 * found. `readingOnlyLimit` prevents broad readings from filling the canvas.
 */
export function buildKanjiRelationships(index, centerChar, options = {}) {
  const center = index?.byChar?.get(centerChar);
  const centerAttributes = index?.attributes?.get(centerChar);
  if (!center || !centerAttributes) return null;

  const limit = Math.max(1, Number.isInteger(options.limit) ? options.limit : 24);
  const readingOnlyLimit = Math.max(0, Number.isInteger(options.readingOnlyLimit) ? options.readingOnlyLimit : 8);
  const allowedKinds = new Set(Array.isArray(options.kinds)
    ? options.kinds.filter((kind) => Object.hasOwn(index.buckets, kind))
    : Object.keys(index.buckets));
  const includeItem = typeof options.includeItem === 'function' ? options.includeItem : () => true;
  const candidates = new Map();

  const addReason = (char, kind, key) => {
    if (char === centerChar) return;
    const item = index.byChar.get(char);
    if (!item || !includeItem(item)) return;
    if (!candidates.has(char)) candidates.set(char, { item, reasons: [] });
    const familySize = index.buckets[kind].get(key)?.length || 0;
    candidates.get(char).reasons.push({
      kind,
      key,
      label: reasonLabel(center, kind, key),
      familySize,
      weight: BASE_WEIGHT[kind] + rarityBonus(familySize),
    });
  };

  for (const [kind, keys] of Object.entries(centerAttributes)) {
    if (!allowedKinds.has(kind)) continue;
    for (const key of keys) {
      for (const char of index.buckets[kind].get(key) || []) addReason(char, kind, key);
    }
  }

  const allNeighbors = [...candidates.values()].map((neighbor) => {
    const strokeDifference = center.strokes > 0 && neighbor.item.strokes > 0
      ? Math.abs(center.strokes - neighbor.item.strokes)
      : Infinity;
    if (strokeDifference <= 1) {
      neighbor.reasons.push({
        kind: 'stroke',
        key: String(neighbor.item.strokes),
        label: strokeDifference === 0 ? `same ${center.strokes}-stroke count` : '1-stroke difference',
        familySize: 0,
        weight: strokeDifference === 0 ? 10 : 6,
      });
    }
    neighbor.reasons.sort(reasonOrder);
    const relationshipKinds = new Set(neighbor.reasons.filter((reason) => reason.kind !== 'stroke').map((reason) => reason.kind));
    return {
      item: neighbor.item,
      score: neighbor.reasons.reduce((sum, reason) => sum + reason.weight, 0),
      reasons: neighbor.reasons,
      structural: [...relationshipKinds].some((kind) => STRUCTURAL_KINDS.has(kind)),
      readingOnly: [...relationshipKinds].every((kind) => READING_KINDS.has(kind)),
      strongestKind: neighbor.reasons[0].kind,
    };
  }).sort((a, b) => b.score - a.score || b.reasons.length - a.reasons.length || codePointOrder(a.item, b.item));

  let readingOnlyCount = 0;
  const neighbors = [];
  for (const neighbor of allNeighbors) {
    if (neighbor.readingOnly && readingOnlyCount >= readingOnlyLimit) continue;
    neighbors.push(neighbor);
    if (neighbor.readingOnly) readingOnlyCount += 1;
    if (neighbors.length >= limit) break;
  }

  const reasonCounts = allNeighbors.reduce((counts, neighbor) => {
    for (const kind of new Set(neighbor.reasons.map((reason) => reason.kind))) {
      counts[kind] = (counts[kind] || 0) + 1;
    }
    return counts;
  }, {});

  return {
    center,
    neighbors,
    totalCandidates: allNeighbors.length,
    truncated: neighbors.length < allNeighbors.length,
    reasonCounts,
  };
}
