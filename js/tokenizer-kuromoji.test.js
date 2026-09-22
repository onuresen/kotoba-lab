// tokenizer-kuromoji.test.js — run with: npm test  (or: node --test js/tokenizer-kuromoji.test.js)
//
// loadKuromojiTokenizer needs a real kuromoji build plus its vendored
// dictionary, so this only exercises mapTokens, the pure raw-kuromoji-output
// -> shared Token shape step. Raw tokens are shaped like kuromoji's own
// IpadicFeatures, built here by hand rather than by running the real
// tokenizer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTokens, buildIndex } from './tokenizer-kuromoji.js';

// A minimal IpadicFeatures-shaped raw token. surface_form/pos are required by
// every consumer; the rest default to kuromoji's own "not analysed" marker.
function raw(surface, { reading = '*', basic = '*', pos = '名詞', sub = '*', conj = '*' } = {}) {
  return {
    surface_form: surface,
    reading,
    basic_form: basic,
    pos,
    pos_detail_1: sub,
    conjugated_form: conj,
  };
}

const VOCAB = [
  { w: 'コーヒー', r: 'こーひー', lvl: 5, g: 'coffee' },
  { w: '専門家', r: 'せんもんか', lvl: 2, g: 'specialist' },
];
const idx = buildIndex(VOCAB);

test('a katakana loanword keeps its reading (kind "word", no kanji in the surface)', () => {
  const [token] = mapTokens([raw('コーヒー', { reading: 'コーヒー', basic: 'コーヒー' })], idx);
  assert.equal(token.kind, 'word');
  assert.equal(token.reading, 'こーひー');
  assert.equal(token.gloss, 'coffee');
});

test('a kanji word keeps its reading, converted to hiragana', () => {
  const [token] = mapTokens([raw('専門', { reading: 'センモン', basic: '専門' })], idx);
  assert.equal(token.reading, 'せんもん');
});

test('a symbol with no analysis (reading "*") gets a null reading, not the surface', () => {
  const [token] = mapTokens([raw('。', { reading: '*', pos: '記号' })], idx);
  assert.equal(token.kind, 'other');
  assert.equal(token.reading, null);
});

test('a 接尾 suffix merges into the preceding word, readings concatenated', () => {
  const tokens = mapTokens([
    raw('専門', { reading: 'センモン', basic: '専門' }),
    raw('家', { reading: 'カ', basic: '家', sub: '接尾' }),
  ], idx);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].surface, '専門家');
  assert.equal(tokens[0].reading, 'せんもんか');
  assert.equal(tokens[0].gloss, 'specialist');
});

test('a 接頭詞 prefix merges into the following word, readings concatenated', () => {
  const tokens = mapTokens([
    raw('お', { reading: 'オ', pos: '接頭詞' }),
    raw('茶', { reading: 'チャ', basic: '茶' }),
  ], idx);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].surface, 'お茶');
  assert.equal(tokens[0].reading, 'おちゃ');
});
