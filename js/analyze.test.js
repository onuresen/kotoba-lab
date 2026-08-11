// analyze.test.js — run with: npm test  (or: node --test js/analyze.test.js)
//
// analyze.js is pure and feeds every number on the Analyze tab. The risk it
// carries isn't crashing, it's counting the wrong thing quietly — occurrences
// vs unique characters, ungraded kanji silently treated as easy, a coverage
// meter that flatters you. Those are the cases below.

import test from 'node:test';
import assert from 'node:assert/strict';
import { kanjiStats, wordStats, charMix, readability, coverage } from './analyze.js';
import { createJlpt } from './jlpt.js';

// A tiny stand-in for data/kanjidic.json. 語 is deliberately absent, so it is
// ungraded — the app must never guess a level for it.
const jlpt = createJlpt({
  日: { jlpt: 5, strokes: 4, meaning: 'day, sun' },
  本: { jlpt: 5, strokes: 5, meaning: 'book, origin' },
  水: { jlpt: 5, strokes: 4, meaning: 'water' },
  専: { jlpt: 2, strokes: 9, meaning: 'specialty' },
  門: { jlpt: 3, strokes: 8, meaning: 'gate' },
});

const tok = (surface, over = {}) => ({ surface, reading: null, level: null, gloss: null, kind: 'word', ...over });

// ---- kanji frequency --------------------------------------------------------

test('kanji are counted by occurrence, and uniques counted separately', () => {
  const s = kanjiStats('日本語の本です', jlpt);
  assert.equal(s.totalKanji, 4, '日 本 語 本 — kana excluded');
  assert.equal(s.uniqueKanji, 3);
  assert.deepEqual(s.rows[0], { ch: '本', n: 2, level: 5 }, 'most frequent first');
});

test('an ungraded kanji is reported as ungraded, never as a level', () => {
  const s = kanjiStats('語語日', jlpt);
  const go = s.rows.find((r) => r.ch === '語');
  assert.equal(go.level, null);
  assert.equal(s.ungraded, 2, 'counted by occurrence, like every other tally');
  assert.equal(s.byLevel[5], 1);
  // The level buckets plus ungraded must account for every kanji occurrence.
  const bucketed = Object.values(s.byLevel).reduce((a, b) => a + b, 0) + s.ungraded;
  assert.equal(bucketed, s.totalKanji);
});

test('text with no kanji at all yields empty stats, not NaN', () => {
  const s = kanjiStats('ひらがなだけです', jlpt);
  assert.deepEqual(s.rows, []);
  assert.equal(s.totalKanji, 0);
  assert.equal(s.ungraded, 0);
});

// ---- word frequency ---------------------------------------------------------

test('word frequency counts content tokens and ignores kana/punctuation', () => {
  const s = wordStats([
    tok('本', { level: 5 }), tok('の', { kind: 'kana' }), tok('本', { level: 5 }),
    tok('専門家', { level: 2 }), tok('。', { kind: 'other' }), tok('語', { kind: 'kanji' }),
  ]);
  assert.equal(s.uniqueWords, 3, 'の and 。 are not words');
  assert.equal(s.rows[0].surface, '本');
  assert.equal(s.rows[0].n, 2);
  assert.equal(s.byLevel[5], 2, 'by occurrence');
  assert.equal(s.byLevel[2], 1);
  assert.equal(s.ungraded, 1, 'the bare kanji run has no level');
});

test('the first occurrence carries the reading and gloss forward', () => {
  const s = wordStats([
    tok('水', { level: 5, reading: 'みず', gloss: 'water' }),
    tok('水', { level: 5, reading: 'みず', gloss: 'water' }),
  ]);
  assert.equal(s.rows[0].reading, 'みず');
  assert.equal(s.rows[0].gloss, 'water');
  assert.equal(s.rows[0].n, 2);
});

// ---- character mix ----------------------------------------------------------

test('charMix separates the three scripts and ignores whitespace', () => {
  const m = charMix('日本 語\nabc  の');
  assert.equal(m.kanji, 3);
  assert.equal(m.kana, 1);
  assert.equal(m.other, 3, 'abc — the spaces and newline are not "other"');
  assert.equal(m.jp, 4);
  assert.equal(m.total, 7);
});

test('charMix on empty text is all zeroes', () => {
  assert.deepEqual(charMix(''), { kanji: 0, kana: 0, other: 0, jp: 0, total: 0 });
});

// ---- readability ------------------------------------------------------------

test('readability counts sentences by their enders', () => {
  const text = '本です。水です。語ですか？';
  const r = readability(text, kanjiStats(text, jlpt));
  assert.equal(r.metrics.sentences, 3);
});

test('an unterminated sentence still counts as one', () => {
  const text = '日本語の本';
  const r = readability(text, kanjiStats(text, jlpt));
  assert.equal(r.metrics.sentences, 1, 'otherwise the average divides by zero');
  assert.ok(Number.isFinite(r.score));
});

test('denser, rarer kanji and longer sentences score harder', () => {
  const easy = 'これはほんです。';
  const hard = '専門家の語る本質的な議論は、極めて難解である。';
  const easyScore = readability(easy, kanjiStats(easy, jlpt)).score;
  const hardScore = readability(hard, kanjiStats(hard, jlpt)).score;
  assert.ok(hardScore > easyScore, `expected ${hardScore} > ${easyScore}`);
  assert.ok(easyScore >= 0 && hardScore <= 100, 'the score stays inside 0–100');
});

test('the band always matches the score, across the whole range', () => {
  // Bands are a presentation of the score; a gap or overlap between them would
  // show as a "Beginner" label on an N1 text.
  const bands = new Set();
  for (const text of ['', 'ですます', '日本の本です。', '専門家の語る本質的議論、極難解也。']) {
    const r = readability(text, kanjiStats(text, jlpt));
    assert.ok(r.band.label && r.band.jlpt, `no band for score ${r.score}`);
    bands.add(r.band.label);
  }
  assert.ok(bands.size > 1, 'different texts land in different bands');
});

test('readability of empty text is defined, not NaN', () => {
  const r = readability('', kanjiStats('', jlpt));
  assert.ok(Number.isFinite(r.score));
  assert.equal(r.metrics.kanjiRatio, 0);
  assert.equal(r.metrics.avgSentenceLen, 0);
});

// ---- coverage ---------------------------------------------------------------

test('coverage weights by occurrence, not by unique word', () => {
  // Knowing the one word that appears 8 times is most of the text.
  const rows = [{ surface: 'の', n: 8 }, { surface: '専門家', n: 1 }, { surface: '議論', n: 1 }];
  const known = new Set(['の']);
  const c = coverage(rows, (r) => r.surface, (k) => known.has(k));
  assert.deepEqual(c, { known: 8, total: 10, pct: 80 });
});

test('coverage of an empty text is 0%, not a division by zero', () => {
  assert.deepEqual(coverage([], (r) => r.surface, () => true), { known: 0, total: 0, pct: 0 });
});

test('knowing nothing is 0% and knowing everything is 100%', () => {
  const rows = [{ surface: 'a', n: 3 }, { surface: 'b', n: 1 }];
  assert.equal(coverage(rows, (r) => r.surface, () => false).pct, 0);
  assert.equal(coverage(rows, (r) => r.surface, () => true).pct, 100);
});
