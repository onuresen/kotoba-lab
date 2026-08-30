// component-lookup.test.js — run with: npm test
//
// The fixture mirrors the real artifact's shape: 語's direct components are
// 言 and 吾, and 吾 has its own entry — which is exactly the case the
// transitive expansion exists for.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComponentLookup,
  matchingKanji,
  usableComponents,
  filterComponents,
} from './component-lookup.js';

const index = (entries) => ({
  byKanji: new Map(Object.entries(entries).map(([char, components]) => [char, { radicals: [], components }])),
});

const FIXTURE = index({
  語: ['言', '吾'],
  吾: ['五', '口'],
  話: ['言', '舌'],
  相: ['木', '目'],
  想: ['相', '心'],
  木: [],
  口: [],
});

const lookup = buildComponentLookup(FIXTURE);
const chars = (set) => [...(set || [])].sort().join('');

// ---- building ---------------------------------------------------------------

test('a component reaches the kanji it sits inside at any depth', () => {
  // 口 is not a direct component of 語 — it is inside 吾, which is.
  assert.equal(chars(lookup.byElement.get('口')), '吾語');
  assert.equal(chars(lookup.componentsOf.get('語')), '五口吾言');
});

test('depth chains all the way down', () => {
  // 想 → 相 → 木 目, plus 心 directly.
  assert.equal(chars(lookup.componentsOf.get('想')), '心木目相');
});

test('a kanji with no components of its own is indexed as a component only', () => {
  assert.equal(lookup.componentsOf.has('木'), false);
  assert.equal(chars(lookup.byElement.get('木')), '想相');
});

test('components are offered commonest first, ties in dictionary order', () => {
  const counts = lookup.elements.map((item) => item.count);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  // 五 口 木 目 言 are all used twice here, so the tie-break has to be the
  // thing that keeps the picker from reshuffling itself between builds.
  const tied = lookup.elements.filter((item) => item.count === 2).map((item) => item.element);
  assert.deepEqual(tied, ['五', '口', '木', '目', '言']);
  assert.equal(lookup.size, lookup.elements.length);
});

test('a decomposition that cycles back on itself still terminates', () => {
  const cyclic = buildComponentLookup(index({ 甲: ['乙'], 乙: ['甲'] }));
  assert.equal(chars(cyclic.componentsOf.get('甲')), '乙甲');
});

test('an absent or malformed index builds an empty lookup', () => {
  for (const input of [null, {}, { byKanji: new Map() }]) {
    const empty = buildComponentLookup(input);
    assert.equal(empty.size, 0);
    assert.deepEqual(empty.elements, []);
  }
});

// ---- selecting --------------------------------------------------------------

test('each added component narrows the result', () => {
  assert.equal(chars(matchingKanji(lookup, ['言'])), '話語');
  assert.equal(chars(matchingKanji(lookup, ['言', '口'])), '語');
});

test('an impossible combination matches nothing, and says so as an empty set', () => {
  const matches = matchingKanji(lookup, ['木', '言']);
  assert.equal(matches.size, 0);
  assert.notEqual(matches, null); // null means "no filter", which is different
});

test('no selection means no filter at all', () => {
  assert.equal(matchingKanji(lookup, []), null);
  assert.equal(matchingKanji(lookup, null), null);
  assert.equal(matchingKanji(lookup, ['㐀']), null); // unknown shapes are ignored
});

test('a repeated selection is the same as selecting it once', () => {
  assert.equal(chars(matchingKanji(lookup, ['言', '言'])), '話語');
});

// ---- dimming ----------------------------------------------------------------

test('only components that can still co-occur stay usable', () => {
  const usable = usableComponents(lookup, matchingKanji(lookup, ['言']));
  assert.equal(usable.has('吾'), true);  // 語
  assert.equal(usable.has('舌'), true);  // 話
  assert.equal(usable.has('木'), false); // no 言 kanji contains 木
});

test('with nothing selected every component is usable', () => {
  assert.equal(usableComponents(lookup, null).size, lookup.size);
});

test('a dead-end selection leaves nothing usable', () => {
  assert.equal(usableComponents(lookup, matchingKanji(lookup, ['木', '言'])).size, 0);
});

// ---- searching the picker ---------------------------------------------------

test('components are searchable by glyph and by meaning where one exists', () => {
  const described = buildComponentLookup(FIXTURE, {
    meaningOf: (char) => ({ 言: 'say; word', 木: 'tree; wood' })[char] || '',
  });
  assert.deepEqual(filterComponents(described, '木').map((i) => i.element), ['木']);
  assert.deepEqual(filterComponents(described, 'tree').map((i) => i.element), ['木']);
  assert.deepEqual(filterComponents(described, 'WORD').map((i) => i.element), ['言']);
  assert.deepEqual(filterComponents(described, 'zzz'), []);
  assert.equal(filterComponents(described, '  ').length, described.elements.length);
});
