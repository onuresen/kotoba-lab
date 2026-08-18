// flashcards.test.js — run with: npm test  (or: node --test js/flashcards.test.js)
//
// pickStudyWords and toTSV are pure; download() touches the DOM and is not
// tested here. The last test reaches into data/ on purpose: TSV has no
// escaping, so "no tabs or newlines in the shipped glosses" is the invariant
// that makes the export correct at all, and it lives in the data, not the code.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pickStudyWords, toTSV } from './flashcards.js';

const row = (surface, level, n = 1, over = {}) => ({
  surface, level, n, reading: 'よみ', gloss: 'meaning', kind: 'word', ...over,
});

// N5=5 … N1=1, so "harder" means a LOWER number, and null means ungraded.
const ROWS = [
  row('easy', 5, 10), row('mid', 3, 5), row('hard', 1, 2), row('ungraded', null, 7),
];

// ---- selection --------------------------------------------------------------

test('maxLevel keeps the chosen level and everything harder', () => {
  const picked = pickStudyWords(ROWS, { maxLevel: 3, includeUngraded: false });
  assert.deepEqual(picked.map((r) => r.surface), ['hard', 'mid'], 'N5 is easier than N3, so it is dropped');
});

test('ungraded words are opt-in, and sort as the hardest of all', () => {
  const without = pickStudyWords(ROWS, { maxLevel: 5, includeUngraded: false });
  assert.ok(!without.some((r) => r.surface === 'ungraded'));

  const with_ = pickStudyWords(ROWS, { maxLevel: 5, includeUngraded: true });
  assert.equal(with_[0].surface, 'ungraded', 'unknown difficulty is treated as hardest');
});

test('hardestFirst false falls back to plain frequency order', () => {
  const byFreq = pickStudyWords(ROWS, { maxLevel: 5, includeUngraded: true, hardestFirst: false });
  assert.deepEqual(byFreq.map((r) => r.n), [10, 7, 5, 2]);
});

test('within one level, the more frequent word comes first', () => {
  const rows = [row('rare', 3, 1), row('common', 3, 40)];
  assert.deepEqual(pickStudyWords(rows, { maxLevel: 3 }).map((r) => r.surface), ['common', 'rare']);
});

test('selecting from nothing gives nothing, not an error', () => {
  assert.deepEqual(pickStudyWords([], { maxLevel: 4 }), []);
  assert.deepEqual(pickStudyWords(ROWS, { maxLevel: 1, includeUngraded: false }).map((r) => r.surface), ['hard']);
});

test('the defaults are N4-and-harder, including ungraded', () => {
  const picked = pickStudyWords(ROWS);
  assert.deepEqual(picked.map((r) => r.surface).sort(), ['hard', 'mid', 'ungraded'].sort());
});

// ---- TSV --------------------------------------------------------------------

test('TSV is five tab-separated fields per line, one line per card', () => {
  const tsv = toTSV([row('本', 5, 1, { reading: 'ほん', gloss: 'book', sentence: '本を読む。' })]);
  assert.equal(tsv, '本\tほん\tbook\tN5\t本を読む。');
  assert.equal(tsv.split('\t').length, 5);
});

test('the column count is the same whether or not a card has a sentence', () => {
  // Analyze-tab exports come from the frequency table and never have one; a
  // varying column count would break the field mapping on import.
  const withCtx = toTSV([row('本', 5, 1, { sentence: '本を読む。' })]).split('\t');
  const without = toTSV([row('本', 5, 1)]).split('\t');
  assert.equal(withCtx.length, 5);
  assert.equal(without.length, 5);
  assert.equal(without[4], '', 'empty, not missing');
});

test('a missing reading or gloss leaves the column empty, not "null"', () => {
  const tsv = toTSV([row('議論', null, 1, { reading: null, gloss: null })]);
  assert.equal(tsv, '議論\t\t\t—\t', 'ungraded prints as an em dash, matching the UI');
  assert.ok(!tsv.includes('null') && !tsv.includes('undefined'));
});

test('a sentence is flattened to one line so it cannot corrupt the row', () => {
  // A sentence can reach TSV from an imported backup or a hand-edited deck,
  // where it may well contain a newline. It is the one field TSV cannot trust.
  const tsv = toTSV([row('本', 5, 1, { sentence: '一行目\n二行目\tタブ' })]);
  assert.equal(tsv.split('\n').length, 1, 'still a single row');
  assert.equal(tsv.split('\t').length, 5, 'still five fields');
  assert.equal(tsv.split('\t')[4], '一行目 二行目 タブ');
});

test('rows become lines, in the order given', () => {
  const tsv = toTSV([row('a', 5), row('b', 4)]);
  assert.deepEqual(tsv.split('\n').map((l) => l.split('\t')[0]), ['a', 'b']);
  assert.equal(toTSV([]), '');
});

test('every row has the same field count, so the file is a valid table', () => {
  const rows = [
    row('本', 5, 1, { sentence: '本を読む。' }),
    row('議論', null, 1, { reading: null, gloss: null }),
    row('水', 5, 1, { sentence: 'これ\tは\n水' }),
  ];
  const counts = new Set(toTSV(rows).split('\n').map((l) => l.split('\t').length));
  assert.deepEqual([...counts], [5]);
});

// ---- romaji column (opt-in) --------------------------------------------------

test('romaji is opt-in: the default stays five fields, unchanged', () => {
  const rows = [row('本', 5, 1, { reading: 'ほん' })];
  assert.equal(toTSV(rows), toTSV(rows, { romaji: false }));
  assert.equal(toTSV(rows).split('\t').length, 5);
});

test('romaji: true appends a sixth field derived from the reading', () => {
  const tsv = toTSV([row('学校', 5, 1, { reading: 'がっこう', gloss: 'school' })], { romaji: true });
  assert.equal(tsv, '学校\tがっこう\tschool\tN5\t\tgakkou');
  assert.equal(tsv.split('\t').length, 6);
});

test('romaji: true leaves the sixth field empty rather than guessing when there is no reading', () => {
  const tsv = toTSV([row('議論', null, 1, { reading: null })], { romaji: true });
  assert.equal(tsv.split('\t').length, 6);
  assert.equal(tsv.split('\t')[5], '');
});

test('romaji column keeps the field count uniform across mixed rows', () => {
  const rows = [
    row('本', 5, 1, { reading: 'ほん' }),
    row('議論', null, 1, { reading: null, gloss: null }),
  ];
  const counts = new Set(toTSV(rows, { romaji: true }).split('\n').map((l) => l.split('\t').length));
  assert.deepEqual([...counts], [6]);
});

// ---- the invariant TSV depends on -------------------------------------------

test('no shipped gloss contains a tab or newline (TSV has no escaping)', () => {
  const read = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), 'utf8'));
  const offenders = [];

  for (const e of read('jlpt-vocab.json').vocab) {
    if (/[\t\r\n]/.test(e.g || '') || /[\t\r\n]/.test(e.r || '')) offenders.push(`vocab:${e.w}`);
  }
  for (const [ch, rec] of Object.entries(read('kanjidic.json').kanji)) {
    if (/[\t\r\n]/.test(rec.meaning || '')) offenders.push(`kanji:${ch}`);
  }

  assert.deepEqual(offenders, [],
    'a tab or newline in a gloss would silently corrupt every exported deck — ' +
    'escape it in toTSV() before adding data like this');
});
