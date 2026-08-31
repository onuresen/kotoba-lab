// component-lookup.js — search the kanji library by the parts you can see.
//
// Every existing way into the Kanji library (glyph, reading, meaning) assumes
// the learner can already name the kanji. This is the one a paper dictionary
// gives them instead: pick the shapes out of the character in front of you and
// let the index do the naming.
//
// Built from the same compact `data/kanji-families.json` the structural family
// views already load, so it costs no new download and no new artifact.
//
// ONE DELIBERATE DIFFERENCE from the "Shared component families" view, which
// groups by DIRECT KanjiVG components only: this index is transitive. 語's
// direct components are 言 and 吾, but 口 is plainly visible inside it, and a
// learner picking shapes off the page has no way to know which level of the
// decomposition tree a shape happens to sit on. So a component is expanded
// through its own entry whenever it has one, and 語 is findable by 言, 吾, 口,
// 五, or 二. That is still committed KanjiVG structure — a deeper reading of
// it, not a looser one — and it never claims the parts mean anything.
//
// Pure: no DOM, no storage, no fetch.

function readingForm(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[\s、,;；・()（）.]/g, '');
}

// Every component of `char`, at any depth. `seen` guards the recursion against
// a decomposition that cycles back on itself (KanjiVG's own decoder carries the
// same guard) and against re-walking a shape two branches share.
function expand(char, directOf, out, seen) {
  for (const component of directOf.get(char) || []) {
    if (out.has(component)) continue;
    out.add(component);
    if (directOf.has(component) && !seen.has(component)) {
      seen.add(component);
      expand(component, directOf, out, seen);
    }
  }
  return out;
}

/**
 * @param structureIndex the { byKanji } index from buildKanjiStructureIndex()
 * @param meaningOf      optional char -> short English gloss, used only to make
 *                       a component chip searchable by meaning ("water" → 氵).
 *                       Components that are not themselves dictionary kanji
 *                       (氵, 艹, 𠂊 …) simply have none, and that is not an
 *                       error — it is what the dictionary does and does not
 *                       cover.
 */
export function buildComponentLookup(structureIndex, { meaningOf } = {}) {
  const directOf = new Map();
  for (const [char, entry] of structureIndex?.byKanji || []) {
    directOf.set(char, entry?.components || []);
  }

  const componentsOf = new Map();
  const byElement = new Map();
  for (const char of directOf.keys()) {
    const components = expand(char, directOf, new Set(), new Set());
    if (!components.size) continue;
    componentsOf.set(char, components);
    for (const component of components) {
      if (!byElement.has(component)) byElement.set(component, new Set());
      byElement.get(component).add(char);
    }
  }

  // Ordered by how many kanji actually use each shape. That is a fact this
  // index can count, unlike "importance" or "difficulty", and it happens to put
  // the shapes a learner meets most within reach of the top of the picker.
  const elements = [...byElement.entries()]
    .map(([element, chars]) => {
      const meaning = typeof meaningOf === 'function' ? meaningOf(element) || '' : '';
      const item = { element, count: chars.size, meaning };
      Object.defineProperty(item, '_search', {
        enumerable: false,
        value: readingForm(`${element} ${meaning}`),
      });
      return item;
    })
    .sort((a, b) => b.count - a.count || a.element.codePointAt(0) - b.element.codePointAt(0));

  return { elements, byElement, componentsOf, size: byElement.size };
}

/**
 * The kanji containing EVERY selected component — intersection, not union, so
 * each added shape narrows the result the way a physical radical table does.
 * Returns null for an empty selection, meaning "no component filter at all",
 * which callers must not confuse with an empty Set ("nothing matches").
 */
export function matchingKanji(lookup, selected) {
  const wanted = [...new Set(selected || [])].filter((element) => lookup?.byElement?.has(element));
  if (!wanted.length) return null;
  // Start from the rarest shape: the intersection can only shrink, so the
  // smallest set is the cheapest thing to walk.
  wanted.sort((a, b) => lookup.byElement.get(a).size - lookup.byElement.get(b).size);
  let matches = new Set(lookup.byElement.get(wanted[0]));
  for (const element of wanted.slice(1)) {
    const next = lookup.byElement.get(element);
    matches = new Set([...matches].filter((char) => next.has(char)));
    if (!matches.size) break;
  }
  return matches;
}

/**
 * The components still worth offering once `matches` is what remains: every
 * shape appearing in at least one of those kanji. Dimming the rest turns a
 * dead end into something visible before it is chosen rather than after.
 * With no selection every component is still usable.
 */
export function usableComponents(lookup, matches) {
  if (!matches) return new Set(lookup?.byElement?.keys() || []);
  const usable = new Set();
  for (const char of matches) {
    for (const component of lookup.componentsOf.get(char) || []) usable.add(component);
  }
  return usable;
}

/** Components whose glyph or dictionary meaning matches a typed query. */
export function filterComponents(lookup, query) {
  const needle = readingForm(query);
  if (!needle) return lookup?.elements || [];
  return (lookup?.elements || []).filter((item) => item._search.includes(needle));
}
