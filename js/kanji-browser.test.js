import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKanjiCatalog,
  buildKanjiFamilies,
  buildKanjiStructureIndex,
  filterKanji,
  groupKanji,
  isFamilyMode,
  isStructureFamilyMode,
} from './kanji-browser.js';

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

test('a candidate character set narrows the same filters further', () => {
  // What the component picker hands in. An empty set is an active filter that
  // nothing survived — not an absent one.
  assert.deepEqual(filterKanji(catalog, { chars: new Set(['森', '語']) }).map((item) => item.char), ['語', '森']);
  assert.deepEqual(filterKanji(catalog, { chars: new Set(['森', '語']), levels: ['4'] }).map((item) => item.char), ['森']);
  assert.deepEqual(filterKanji(catalog, { chars: new Set() }), []);
  assert.equal(filterKanji(catalog, { chars: null }).length, catalog.length);
  assert.equal(filterKanji(catalog, { chars: ['森'] }).length, catalog.length); // not a Set: ignored
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

test('exact stroke families are numeric and preserve sorted rows', () => {
  const rows = filterKanji(catalog, { sort: 'meaning' });
  assert.deepEqual(buildKanjiFamilies(rows, 'stroke-exact').map((family) => [family.label, family.rows.map((item) => item.char)]), [
    ['8 strokes', ['学']],
    ['12 strokes', ['森']],
    ['14 strokes', ['語']],
    ['29 strokes', ['鬱']],
  ]);
});

test('shared on-reading families normalize separators, kana, and source markers', () => {
  const rows = buildKanjiCatalog({
    学: { strokes: 8, on: 'ガク', meaning: 'study' },
    岳: { strokes: 8, on: 'がく', meaning: 'peak' },
    楽: { strokes: 13, on: 'ガク、ラク*', meaning: 'music' },
    絡: { strokes: 12, on: 'ラク', meaning: 'entwine' },
    独: { strokes: 9, on: 'ドク', meaning: 'alone' },
  });
  const families = buildKanjiFamilies(rows, 'on-reading');
  assert.deepEqual(families.map((family) => [family.label, family.rows.map((item) => item.char)]), [
    ['ガク on’yomi', ['学', '岳', '楽']],
    ['ラク on’yomi', ['楽', '絡']],
  ]);
});

test('shared kun-reading families compare the full spoken reading without dictionary parentheses', () => {
  const rows = buildKanjiCatalog({
    会: { strokes: 6, kun: 'あ（う）', meaning: 'meet' },
    合: { strokes: 6, kun: 'あ（う）、あ（わせる）', meaning: 'fit' },
    遭: { strokes: 14, kun: 'あ（う）*', meaning: 'encounter' },
    学: { strokes: 8, kun: 'まな（ぶ）', meaning: 'study' },
  });
  const families = buildKanjiFamilies(rows, 'kun-reading');
  assert.deepEqual(families.map((family) => [family.label, family.rows.map((item) => item.char)]), [
    ['あう kun’yomi', ['会', '合', '遭']],
  ]);
});

test('only the explicit family modes activate the family picker', () => {
  assert.equal(isFamilyMode('stroke-exact'), true);
  assert.equal(isFamilyMode('on-reading'), true);
  assert.equal(isFamilyMode('kun-reading'), true);
  assert.equal(isFamilyMode('radical'), true);
  assert.equal(isFamilyMode('component'), true);
  assert.equal(isFamilyMode('phonetic'), true);
  assert.equal(isFamilyMode('contrast'), true);
  assert.equal(isFamilyMode('strokes'), false);
  assert.equal(isFamilyMode('jlpt'), false);
  assert.equal(isStructureFamilyMode('radical'), true);
  assert.equal(isStructureFamilyMode('component'), true);
  assert.equal(isStructureFamilyMode('phonetic'), true);
  assert.equal(isStructureFamilyMode('contrast'), true);
  assert.equal(isStructureFamilyMode('on-reading'), false);
});

test('structure index decodes canonical radicals and visual components', () => {
  const index = buildKanjiStructureIndex({
    elements: ['水', '⺡', '也', '言', '吾'],
    kanji: {
      池: [[0], [1, 2, 1]],
      語: [[3], [3, 4]],
      壊: null,
    },
  });
  assert.equal(index.size, 2);
  assert.deepEqual(index.byKanji.get('池'), { radicals: ['水'], components: ['⺡', '也'] });
  assert.deepEqual(index.byKanji.get('語'), { radicals: ['言'], components: ['言', '吾'] });
});

test('radical and component families reverse-index filtered kanji', () => {
  const rows = buildKanjiCatalog({
    池: { strokes: 6, meaning: 'pond' },
    海: { strokes: 9, meaning: 'sea' },
    語: { strokes: 14, meaning: 'language' },
  });
  const index = buildKanjiStructureIndex({
    elements: ['水', '⺡', '言', '毎', '吾'],
    kanji: {
      池: [[0], [1]],
      海: [[0], [1, 3]],
      語: [[2], [2, 4]],
    },
  });
  assert.deepEqual(buildKanjiFamilies(rows, 'radical', index).map((family) => [family.label, family.rows.map((item) => item.char)]), [
    ['水 radical', ['池', '海']],
  ]);
  assert.deepEqual(buildKanjiFamilies(rows, 'component', index).map((family) => [family.label, family.rows.map((item) => item.char)]), [
    ['⺡ component', ['池', '海']],
  ]);
});
