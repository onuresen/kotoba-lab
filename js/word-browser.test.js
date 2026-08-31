import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWords, prepareWordQuery, matchesWordQuery, hasCounterSense, counterGloss } from './word-browser.js';

const vocab = [
  { w: '学生', r: 'がくせい', lvl: 5, g: 'student' },
  { w: '学校', r: 'がっこう', lvl: 5, g: 'school' },
  { w: '留学生', r: 'りゅうがくせい', lvl: 5, g: 'overseas student' },
  { w: '医学', r: 'いがく', lvl: 3, g: 'medical science' },
  { w: '先生', r: 'せんせい', lvl: 5, g: 'teacher; master' },
  { w: '猫', r: 'ねこ', lvl: null, g: 'cat' },
];

test('a surface query matches by substring', () => {
  const { words } = searchWords(vocab, { term: '学' });
  assert.deepEqual(words.map((w) => w.w), ['学校', '学生', '留学生', '医学']);
});

test('readings match typed either as hiragana or katakana', () => {
  assert.deepEqual(searchWords(vocab, { term: 'がくせい' }).words.map((w) => w.w), ['学生', '留学生']);
  assert.deepEqual(searchWords(vocab, { term: 'ガクセイ' }).words.map((w) => w.w), ['学生', '留学生']);
});

test('english meanings match case-insensitively', () => {
  assert.deepEqual(searchWords(vocab, { term: 'STUDENT' }).words.map((w) => w.w), ['学生', '留学生']);
  assert.deepEqual(searchWords(vocab, { term: 'cat' }).words.map((w) => w.w), ['猫']);
});

test('results are ordered easiest first, then shorter', () => {
  const { words } = searchWords(vocab, { term: '学' });
  // Every N5 entry precedes the N3 one; inside N5 the two-character words
  // precede the three-character one, then code point order breaks the tie.
  assert.deepEqual(words.map((w) => `${w.w}:${w.lvl}`),
    ['学校:5', '学生:5', '留学生:5', '医学:3']);
});

test('a JLPT filter narrows the set', () => {
  assert.deepEqual(searchWords(vocab, { term: '学', level: 3 }).words.map((w) => w.w), ['医学']);
  assert.equal(searchWords(vocab, { level: 5 }).total, 4);
});

test('readability filtering uses the supplied predicate', () => {
  const canRead = (word) => word === '学生' || word === '学校';
  assert.deepEqual(
    searchWords(vocab, { term: '学', readable: 'readable', isReadable: canRead }).words.map((w) => w.w),
    ['学校', '学生']);
  assert.deepEqual(
    searchWords(vocab, { term: '学', readable: 'unreadable', isReadable: canRead }).words.map((w) => w.w),
    ['留学生', '医学']);
});

test('the page is bounded while the total stays honest', () => {
  const result = searchWords(vocab, { term: '学', limit: 2 });
  assert.equal(result.words.length, 2);
  assert.equal(result.total, 4);
});

test('an empty query returns everything, and malformed input is safe', () => {
  assert.equal(searchWords(vocab, {}).total, vocab.length);
  assert.equal(searchWords(vocab, { term: '   ' }).total, vocab.length);
  assert.deepEqual(searchWords(null, { term: '学' }), { total: 0, words: [] });
  assert.equal(searchWords(vocab, { term: 'zzzz' }).total, 0);
});

test('query preparation normalises once and flags latin input', () => {
  assert.equal(prepareWordQuery('  '), null);
  const jp = prepareWordQuery('ガクセイ');
  assert.equal(jp.reading, 'がくせい');
  assert.equal(jp.latin, '');
  assert.equal(prepareWordQuery('Student').latin, 'student');
});

test('matchesWordQuery accepts every entry when there is no query', () => {
  assert.equal(matchesWordQuery({ w: '猫' }, null), true);
});

// ---- counters -----------------------------------------------------------
// Real Kanjium glosses: a kanji whose other senses are entirely unrelated to
// counting (乗 "(nth) power"; 縮 "shrink"; 門 "gate") still has to match on the
// one clause that actually is a counter, and show only that clause.

test('hasCounterSense matches on the gloss clause, not the whole gloss', () => {
  assert.equal(hasCounterSense('counter for books'), true);
  assert.equal(hasCounterSense('(nth) power; counter for vehicles; multiplication'), true);
  assert.equal(hasCounterSense('wearing armour (armor); counter for suits of armour'), true);
  assert.equal(hasCounterSense('gate; branch of learning; counter for cannons'), true);
});

test('hasCounterSense rejects an unrelated gloss and malformed input', () => {
  assert.equal(hasCounterSense('cat'), false);
  assert.equal(hasCounterSense('countertop; kitchen fixture'), false); // "counter" alone is not enough
  assert.equal(hasCounterSense(''), false);
  assert.equal(hasCounterSense(null), false);
  assert.equal(hasCounterSense(undefined), false);
});

test('counterGloss shows the counting sense in place of an unrelated first sense', () => {
  assert.equal(counterGloss('(nth) power; counter for vehicles; multiplication'), 'counter for vehicles');
  assert.equal(counterGloss('gate; branch of learning; (biology) division; counter for cannons'),
    'counter for cannons');
});

test('counterGloss joins every counting clause rather than picking one', () => {
  // 丁's real gloss: four unrelated things it counts, no non-counter sense at all.
  const teiGloss = 'counter for sheets, pages, leaves, etc.; counter for blocks of tofu; '
    + 'counter for servings in a restaurant; counter for long and narrow things such as guns';
  assert.equal(counterGloss(teiGloss), teiGloss);
});

test('counterGloss falls back to the full gloss when nothing matches', () => {
  assert.equal(counterGloss('cat'), 'cat');
  assert.equal(counterGloss(''), '');
});

test('searchWords composes the counter filter with term, level, and readable, like every other filter', () => {
  const counters = [
    { w: '丁', r: 'ちょう', lvl: null, g: 'counter for sheets, pages, leaves, etc.; counter for blocks of tofu' },
    { w: '個', r: 'こ', lvl: 5, g: 'counter for articles; counter for military units; individual' },
    { w: '乗', r: 'じょう', lvl: 3, g: '(nth) power; counter for vehicles; multiplication' },
  ];
  const notCounters = [
    { w: '猫', r: 'ねこ', lvl: null, g: 'cat' },
    { w: '個人', r: 'こじん', lvl: 4, g: 'individual; private person' }, // contains 個 but is not itself a counter sense
  ];
  const vocabWithCounters = [...counters, ...notCounters];

  const { total, words } = searchWords(vocabWithCounters, { kind: 'counter' });
  assert.deepEqual(words.map((w) => w.w).sort(), ['丁', '乗', '個'].sort());
  assert.equal(total, 3);

  // AND-composes with the JLPT filter, exactly like readable/term already do.
  assert.deepEqual(searchWords(vocabWithCounters, { kind: 'counter', level: 5 }).words.map((w) => w.w), ['個']);

  // AND-composes with a text search too.
  assert.deepEqual(searchWords(vocabWithCounters, { kind: 'counter', term: 'vehicles' }).words.map((w) => w.w), ['乗']);

  // An unrecognised kind value is not silently accepted as a filter.
  assert.equal(searchWords(vocabWithCounters, { kind: 'nonsense' }).total, vocabWithCounters.length);
});
