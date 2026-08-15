import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadableCompounds, isReadableCompound, wordsContaining, unlockedBy } from './compound-words.js';

const vocab = [
  { w: '学生', r: 'がくせい', lvl: 5, g: 'student' },
  { w: '学校', r: 'がっこう', lvl: 5, g: 'school' },
  { w: '生活', r: 'せいかつ', lvl: 3, g: 'daily life' },
  { w: '一般的', r: 'いっぱんてき', lvl: null, g: 'general' },
  { w: '医学', r: 'いがく', lvl: 3, g: 'medical science' },
  { w: '学', r: 'がく', lvl: 5, g: 'learning' },
  { w: '食べる', r: 'たべる', lvl: 5, g: 'to eat' },
];

const knowing = (chars) => (char) => chars.includes(char);

test('a compound counts as readable only when every kanji is known', () => {
  const known = knowing(['学', '生']);
  assert.equal(isReadableCompound('学生', known), true);
  assert.equal(isReadableCompound('学校', known), false); // 校 unknown
});

test('single kanji and mixed-script words are never compounds', () => {
  const known = knowing(['学', '食']);
  assert.equal(isReadableCompound('学', known), false);
  assert.equal(isReadableCompound('食べる', known), false);
  assert.equal(isReadableCompound('', known), false);
  assert.equal(isReadableCompound(null, known), false);
});

test('only words built from known kanji are returned', () => {
  const result = buildReadableCompounds(vocab, knowing(['学', '生', '活']));
  assert.deepEqual(result.words.map((word) => word.w), ['学生', '生活']);
  assert.equal(result.total, 2);
});

test('results are ordered easiest first, then shorter, then deterministically', () => {
  const result = buildReadableCompounds(vocab, knowing(['学', '生', '活', '一', '般', '的', '医']));
  // N5 first, then N3 sorted by code point, then the unlevelled word last.
  assert.deepEqual(result.words.map((word) => word.w),
    ['学生', '医学', '生活', '一般的']);
});

test('the visible list is capped while the total stays honest', () => {
  const result = buildReadableCompounds(vocab, knowing(['学', '生', '活', '医']), 2);
  assert.equal(result.words.length, 2);
  assert.equal(result.total, 3);
});

test('knowing nothing yields an empty result rather than an error', () => {
  const result = buildReadableCompounds(vocab, knowing([]));
  assert.deepEqual(result.words, []);
  assert.equal(result.total, 0);
});

test('malformed input is tolerated', () => {
  assert.deepEqual(buildReadableCompounds(null, knowing(['学'])), { total: 0, words: [] });
  assert.deepEqual(buildReadableCompounds(vocab, null), { total: 0, words: [] });
  const dupes = [{ w: '学生', r: 'がくせい', lvl: 5 }, { w: '学生', r: 'x', lvl: 5 }, { w: null }];
  assert.equal(buildReadableCompounds(dupes, knowing(['学', '生'])).total, 1);
});

test('missing reading, gloss, and level become safe empty values', () => {
  const [word] = buildReadableCompounds([{ w: '学生' }], knowing(['学', '生'])).words;
  assert.deepEqual(word, { w: '学生', r: '', g: '', lvl: null });
});

test('words containing a kanji are found in any script, easiest first', () => {
  const rows = [
    { w: '学校', r: 'がっこう', lvl: 5, g: 'school' },
    { w: '学ぶ', r: 'まなぶ', lvl: 3, g: 'to study' },
    { w: '大学', r: 'だいがく', lvl: 5, g: 'university' },
    { w: '学', r: 'がく', lvl: 5, g: 'learning' },
    { w: '生活', r: 'せいかつ', lvl: 3, g: 'daily life' },
  ];
  const found = wordsContaining(rows, '学');
  // The bare kanji itself is excluded; 生活 does not contain it.
  assert.deepEqual(found.map((w) => w.w), ['大学', '学校', '学ぶ']);
});

test('wordsContaining bounds its result and rejects non-single characters', () => {
  const rows = [
    { w: '学校', lvl: 5 }, { w: '大学', lvl: 5 }, { w: '学生', lvl: 5 },
  ];
  assert.equal(wordsContaining(rows, '学', 2).length, 2);
  assert.deepEqual(wordsContaining(rows, '学校'), []);
  assert.deepEqual(wordsContaining(rows, ''), []);
  assert.deepEqual(wordsContaining(null, '学'), []);
});

const unlockVocab = [
  { w: '学校', r: 'がっこう', lvl: 5, g: 'school' },
  { w: '高校', r: 'こうこう', lvl: 4, g: 'high school' },
  { w: '校長', r: 'こうちょう', lvl: null, g: 'principal' },
  { w: '学生', r: 'がくせい', lvl: 5, g: 'student' },
  { w: '学ぶ', r: 'まなぶ', lvl: 5, g: 'to study' },
];

test('unlocking reports only the words this kanji completed', () => {
  // 校 has just been marked; 学 and 高 were already known, 長 was not.
  const known = ['学', '高', '校'];
  const result = unlockedBy(unlockVocab, '校', (c) => known.includes(c));
  // 学校 and 高校 become readable. 校長 does not (長 unknown). 学生 and 学ぶ
  // do not contain 校 at all, and 学ぶ is mixed script regardless.
  assert.deepEqual(result.words.map((w) => w.w), ['学校', '高校']);
  assert.equal(result.total, 2);
});

test('unlocking is bounded but reports the honest total', () => {
  const known = ['学', '高', '校', '長'];
  const result = unlockedBy(unlockVocab, '校', (c) => known.includes(c), 2);
  assert.equal(result.total, 3);
  assert.equal(result.words.length, 2);
});

test('a kanji that completes nothing unlocks nothing', () => {
  const result = unlockedBy(unlockVocab, '校', (c) => c === '校');
  assert.deepEqual(result, { total: 0, words: [] });
});

test('unlockedBy rejects malformed input rather than throwing', () => {
  assert.deepEqual(unlockedBy(unlockVocab, '', () => true), { total: 0, words: [] });
  assert.deepEqual(unlockedBy(unlockVocab, '学校', () => true), { total: 0, words: [] });
  assert.deepEqual(unlockedBy(unlockVocab, '校', null), { total: 0, words: [] });
  assert.deepEqual(unlockedBy(null, '校', () => true), { total: 0, words: [] });
});
