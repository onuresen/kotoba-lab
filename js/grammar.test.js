// grammar.test.js — run with: npm test
//
// The fixtures are shaped like real kuromoji output after mapTokens(): the
// v1 tokenizer's tokens carry no morphology at all, and half of these tests
// exist to prove that case reports "not available" rather than "nothing".

import test from 'node:test';
import assert from 'node:assert/strict';
import { grammarProfile, hasAnalysis, posLabel, tokenGrammar } from './grammar.js';

const analysed = (surface, pos, extra = {}) => ({
  surface, reading: null, level: null, gloss: null, kind: 'word',
  pos, posDetail: null, lemma: surface, conjugation: null, ...extra,
});
// What createTokenizer() in tokenizer.js actually emits.
const plain = (surface) => ({ surface, reading: null, level: null, gloss: null, kind: 'word' });

// 彼は寿司を食べた。
const SENTENCE = [
  analysed('彼', '名詞'),
  analysed('は', '助詞'),
  analysed('寿司', '名詞'),
  analysed('を', '助詞'),
  analysed('食べた', '動詞', { lemma: '食べる', conjugation: '連用タ接続' }),
  analysed('。', '記号'),
];

// ---- one token --------------------------------------------------------------

test('a token carries its dictionary form and IPADIC label', () => {
  const g = tokenGrammar(SENTENCE[4]);
  assert.equal(g.pos, '動詞');
  assert.equal(g.label, 'verb');
  assert.equal(g.lemma, '食べる');
  assert.equal(g.conjugation, '連用タ接続');
  assert.equal(g.conjugated, true);
});

test('conjugated is a comparison with the lemma, not a claim about tense', () => {
  assert.equal(tokenGrammar(analysed('食べる', '動詞')).conjugated, false);
  assert.equal(tokenGrammar(analysed('走り', '動詞', { lemma: '走る' })).conjugated, true);
  // No lemma to compare against: report nothing rather than guess.
  assert.equal(tokenGrammar(analysed('X', '名詞', { lemma: null })).conjugated, false);
});

test('an unanalysed token has no grammar at all', () => {
  assert.equal(tokenGrammar(plain('専門家')), null);
  assert.equal(tokenGrammar(null), null);
  assert.equal(hasAnalysis(plain('水')), false);
  assert.equal(hasAnalysis(SENTENCE[0]), true);
});

test('every IPADIC top-level tag has a label, and nothing else does', () => {
  for (const pos of ['名詞', '動詞', '形容詞', '副詞', '助詞', '助動詞',
    '連体詞', '接続詞', '感動詞', '接頭詞', 'フィラー', '記号', 'その他']) {
    assert.equal(typeof posLabel(pos), 'string', pos);
  }
  assert.equal(posLabel('架空詞'), null);
  assert.equal(posLabel(undefined), null);
});

// ---- whole text -------------------------------------------------------------

test('a profile counts parts of speech and ranks particles', () => {
  const p = grammarProfile(SENTENCE);
  assert.equal(p.available, true);
  assert.equal(p.total, 5); // 。 is excluded from the language total
  assert.deepEqual(p.groups.map((g) => g.pos), ['動詞', '名詞', '助詞', '記号']);
  assert.deepEqual(p.particles, [{ surface: 'は', count: 1 }, { surface: 'を', count: 1 }]);
  assert.deepEqual(p.conjugated, [{ surface: '食べた', lemma: '食べる', count: 1 }]);
});

test('percentages describe the language, and punctuation gets none', () => {
  const p = grammarProfile(SENTENCE);
  const byPos = Object.fromEntries(p.groups.map((g) => [g.pos, g.pct]));
  assert.equal(byPos['名詞'], 40); // 2 of 5
  assert.equal(byPos['助詞'], 40);
  assert.equal(byPos['動詞'], 20);
  assert.equal(byPos['記号'], null);
});

test('groups keep a fixed order, so one text always profiles the same way', () => {
  const shuffled = [SENTENCE[1], SENTENCE[4], SENTENCE[0], SENTENCE[3], SENTENCE[2]];
  assert.deepEqual(grammarProfile(shuffled).groups.map((g) => g.pos), ['動詞', '名詞', '助詞']);
});

test('ties are broken by the surface, not by encounter order', () => {
  const p = grammarProfile([analysed('を', '助詞'), analysed('は', '助詞')]);
  assert.deepEqual(p.particles.map((x) => x.surface), ['は', 'を']);
});

test('a text with no analysis reports unavailable, not empty', () => {
  for (const input of [[plain('水'), plain('を')], [], null]) {
    const p = grammarProfile(input);
    assert.equal(p.available, false);
    assert.equal(p.total, 0);
    assert.deepEqual(p.groups, []);
  }
});

test('mixed tokens profile only the analysed ones', () => {
  const p = grammarProfile([...SENTENCE, plain('謎')]);
  assert.equal(p.available, true);
  assert.equal(p.total, 5);
});

test('the ranked lists are bounded', () => {
  const many = [];
  for (const p of ['は', 'を', 'に', 'で', 'と', 'が', 'も', 'から', 'まで']) many.push(analysed(p, '助詞'));
  assert.equal(grammarProfile(many).particles.length, 8);
  assert.equal(grammarProfile(many, { particleLimit: 3 }).particles.length, 3);
});
