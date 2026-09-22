// jlpt.test.js — run with: npm test  (or: node --test js/jlpt.test.js)

import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelName, levelSlug, createJlpt } from './jlpt.js';

test('LEVELS is easy-to-hard display order, N5 first', () => {
  assert.deepEqual(LEVELS, [5, 4, 3, 2, 1]);
});

test('levelName renders N + the level, and — for ungraded', () => {
  assert.equal(levelName(5), 'N5');
  assert.equal(levelName(1), 'N1');
  assert.equal(levelName(null), '—');
  assert.equal(levelName(undefined), '—');
});

test('levelSlug renders nN for the CSS color scale, and "ungraded" for null/undefined', () => {
  assert.equal(levelSlug(5), 'n5');
  assert.equal(levelSlug(1), 'n1');
  assert.equal(levelSlug(null), 'ungraded');
  assert.equal(levelSlug(undefined), 'ungraded');
});

const KANJI_MAP = {
  '学': { jlpt: 5, strokes: 8, on: 'ガク', kun: 'まな.ぶ', meaning: 'study' },
  '鬱': { jlpt: null, strokes: 29, on: 'ウツ', kun: '', meaning: 'gloom' },
};

test('createJlpt looks up level and keyword for a known kanji', () => {
  const jlpt = createJlpt(KANJI_MAP);
  assert.equal(jlpt.kanjiLevel('学'), 5);
  assert.equal(jlpt.kanjiKeyword('学'), 'study');
  assert.deepEqual(jlpt.kanjiInfo('学'), KANJI_MAP['学']);
  assert.equal(jlpt.has('学'), true);
});

test('createJlpt returns a null level for an ungraded kanji, never a guessed one', () => {
  const jlpt = createJlpt(KANJI_MAP);
  assert.equal(jlpt.kanjiLevel('鬱'), null);
  // Ungraded and unknown are different things — the record (and its
  // meaning) is still there, only the JLPT level is absent.
  assert.equal(jlpt.kanjiKeyword('鬱'), 'gloom');
});

test('createJlpt treats a kanji missing from the map as absent, not a crash', () => {
  const jlpt = createJlpt(KANJI_MAP);
  assert.equal(jlpt.has('猫'), false);
  assert.equal(jlpt.kanjiLevel('猫'), null);
  assert.equal(jlpt.kanjiKeyword('猫'), null);
  assert.equal(jlpt.kanjiInfo('猫'), null);
});

test('createJlpt.size reports the dictionary size', () => {
  assert.equal(createJlpt(KANJI_MAP).size, 2);
  assert.equal(createJlpt({}).size, 0);
});
