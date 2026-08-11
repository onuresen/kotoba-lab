// tokenizer.test.js — run with: npm test  (or: node --test js/tokenizer.test.js)
//
// The dictionary segmenter is the spine both tabs sit on: everything
// downstream consumes only the Token shape, so these tests pin the contract as
// much as the segmentation. The known weaknesses (no morphology) are pinned
// too — see the last section — so that fixing them is a deliberate act with a
// README update, not a silent change in what the Analyze tab counts.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenizer } from './tokenizer.js';

// Vocab entry shape: { w, r, lvl, g } — as in data/jlpt-vocab.json.
const VOCAB = [
  { w: '日本', r: 'にほん', lvl: 5, g: 'Japan' },
  { w: '日本語', r: 'にほんご', lvl: 5, g: 'Japanese language' },
  { w: '本', r: 'ほん', lvl: 5, g: 'book' },
  { w: '水', r: 'みず', lvl: 5, g: 'water' },
  { w: '家', r: 'いえ', lvl: 5, g: 'house' },
  { w: '専門', r: 'せんもん', lvl: 2, g: 'speciality' },
  { w: 'の', r: 'の', lvl: 5, g: 'of' },
];
const t = createTokenizer(VOCAB);
const surfaces = (text) => t.tokenize(text).map((x) => x.surface);

// ---- the contract -----------------------------------------------------------

test('every token carries the full shape, whatever its kind', () => {
  for (const tk of t.tokenize('日本語のABC。ひらがな')) {
    assert.deepEqual(Object.keys(tk).sort(), ['gloss', 'kind', 'level', 'reading', 'surface'].sort());
    assert.equal(typeof tk.surface, 'string');
    assert.ok(['word', 'kanji', 'kana', 'other'].includes(tk.kind));
  }
});

test('tokenizing is lossless — the surfaces rejoin into the original text', () => {
  for (const text of ['日本語の本です。', 'ABC 123 の', '', '専門家の水', 'ひらがなカタカナ漢字']) {
    assert.equal(t.tokenize(text).map((x) => x.surface).join(''), text);
  }
});

test('the tokenizer reports which one it is', () => {
  assert.equal(t.name, 'dict-longest-match');
  assert.equal(t.vocabSize, VOCAB.length);
});

// ---- segmentation -----------------------------------------------------------

test('the longest dictionary match wins', () => {
  assert.deepEqual(surfaces('日本語'), ['日本語'], 'not 日本 + 語');
  assert.deepEqual(surfaces('日本'), ['日本']);
});

test('a matched word carries its reading, level and gloss', () => {
  const [tk] = t.tokenize('水');
  assert.deepEqual(tk, { surface: '水', reading: 'みず', level: 5, gloss: 'water', kind: 'word' });
});

test('unknown kanji fall back to a script run, tagged as kanji not word', () => {
  const [tk] = t.tokenize('議論');
  assert.equal(tk.surface, '議論');
  assert.equal(tk.kind, 'kanji');
  assert.equal(tk.level, null);
  assert.equal(tk.gloss, null, 'no invented meaning');
});

test('a run stops rather than swallowing a known single-character word', () => {
  // 議論 is unknown, 水 is known: the run must break before it.
  assert.deepEqual(surfaces('議論水'), ['議論', '水']);
});

test('scripts never merge into one token', () => {
  assert.deepEqual(surfaces('ABCひらがな議論'), ['ABC', 'ひらがな', '議論']);
});

test('kana runs are their own reading; other runs have none', () => {
  const [kana] = t.tokenize('ひらがな');
  assert.equal(kana.kind, 'kana');
  assert.equal(kana.reading, 'ひらがな');
  const [other] = t.tokenize('ABC');
  assert.equal(other.kind, 'other');
  assert.equal(other.reading, null);
});

test('empty input gives an empty token list', () => {
  assert.deepEqual(t.tokenize(''), []);
});

test('astral-plane characters survive as single units', () => {
  // Array.from iteration means a surrogate pair is never split down the middle.
  const out = t.tokenize('𠮟る');
  assert.equal(out.map((x) => x.surface).join(''), '𠮟る');
  assert.ok(out.every((x) => x.surface.length > 0));
});

test('duplicate vocab entries keep the first reading rather than the last', () => {
  const dupe = createTokenizer([{ w: '本', r: 'ほん', lvl: 5, g: 'book' }, { w: '本', r: 'もと', lvl: 1, g: 'origin' }]);
  assert.equal(dupe.tokenize('本')[0].reading, 'ほん');
  assert.equal(dupe.vocabSize, 1);
});

// ---- known limitations, pinned on purpose ----------------------------------
// These pass by describing what the DEFAULT tokenizer genuinely can't do. If
// one starts failing, the segmenter got better — update the README's "two
// tokenizers" section (and this test) rather than deleting the case.

test('KNOWN LIMITATION: compounds mis-split when a suffix is its own word', () => {
  // README: "it can mis-split 専門家 and read the trailing 家 as house".
  // kuromoji (opt-in) is the fix; the dictionary segmenter cannot see it.
  assert.deepEqual(surfaces('専門家'), ['専門', '家']);
  assert.equal(t.tokenize('専門家')[1].gloss, 'house', 'the wrong sense, as documented');
});

test('KNOWN LIMITATION: no lemmatisation — inflected forms are not the dictionary form', () => {
  const out = t.tokenize('本を読んだ');
  assert.ok(out.some((x) => x.surface === '本'), 'the noun is still found');
  assert.ok(!out.some((x) => x.surface === '読む'), 'but 読んだ is not resolved to 読む');
});
