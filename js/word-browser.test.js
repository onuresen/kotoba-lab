import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWords, prepareWordQuery, matchesWordQuery } from './word-browser.js';

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
