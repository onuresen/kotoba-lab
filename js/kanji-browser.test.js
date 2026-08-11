import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiCatalog, filterKanji, groupKanji } from './kanji-browser.js';

const catalog = buildKanjiCatalog({
  学: { jlpt: 5, strokes: 8, on: 'ガク', kun: 'まな（ぶ）', meaning: 'study; educational institution' },
  語: { jlpt: 5, strokes: 14, on: 'ゴ', kun: 'かた（る）', meaning: 'word; language' },
  森: { jlpt: 4, strokes: 12, on: 'シン', kun: 'もり', meaning: 'forest' },
  鬱: { jlpt: null, strokes: 29, on: 'ウツ', kun: null, meaning: 'gloom; depression' },
});

test('catalog keeps the dictionary fields in a stable character order', () => {
  assert.deepEqual(catalog.map((item) => item.char), ['学', '森', '語', '鬱']);
  assert.equal(catalog[0].meaning, 'study; educational institution');
});

test('search covers glyph, English meaning, and either kana form', () => {
  assert.deepEqual(filterKanji(catalog, { query: 'forest' }).map((item) => item.char), ['森']);
  assert.deepEqual(filterKanji(catalog, { query: 'がく' }).map((item) => item.char), ['学']);
  assert.deepEqual(filterKanji(catalog, { query: 'まなぶ' }).map((item) => item.char), ['学']);
  assert.deepEqual(filterKanji(catalog, { query: '語' }).map((item) => item.char), ['語']);
});

test('JLPT levels can be combined and ungraded stays explicit', () => {
  assert.deepEqual(filterKanji(catalog, { levels: ['4', 'ungraded'] }).map((item) => item.char), ['森', '鬱']);
});

test('stroke bands include both ends of their range', () => {
  assert.deepEqual(filterKanji(catalog, { strokes: '11-15', sort: 'strokes' }).map((item) => item.strokes), [12, 14]);
  assert.deepEqual(filterKanji(catalog, { strokes: '21+' }).map((item) => item.char), ['鬱']);
});

test('known and unknown filters use the supplied personal set', () => {
  const isKnown = (char) => char === '語';
  assert.deepEqual(filterKanji(catalog, { known: 'known', isKnown }).map((item) => item.char), ['語']);
  assert.equal(filterKanji(catalog, { known: 'unknown', isKnown }).length, 3);
});

test('sort options are deterministic', () => {
  assert.deepEqual(filterKanji(catalog, { sort: 'strokes' }).map((item) => item.char), ['学', '森', '語', '鬱']);
  assert.deepEqual(filterKanji(catalog, { sort: 'meaning' }).map((item) => item.char), ['森', '鬱', '学', '語']);
  assert.deepEqual(filterKanji(catalog, { sort: 'kanji' }).map((item) => item.char), ['学', '森', '語', '鬱']);
});

test('JLPT grouping follows the already-sorted result order', () => {
  const rows = filterKanji(catalog, { sort: 'meaning' });
  assert.deepEqual(groupKanji(rows, 'jlpt').map((group) => [group.label, group.rows.length]), [
    ['JLPT N5', 2], ['JLPT N4', 1], ['Ungraded', 1],
  ]);
});

test('stroke grouping provides readable bands', () => {
  const rows = filterKanji(catalog, { sort: 'strokes' });
  assert.deepEqual(groupKanji(rows, 'strokes').map((group) => group.label), [
    '6–10 strokes', '11–15 strokes', '21+ strokes',
  ]);
});
