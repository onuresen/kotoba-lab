// context.test.js — run with: npm test  (or: node --test js/context.test.js)
//
// The offsets are the fiddly part: every trim and every window shift has to
// carry them, or the review card emphasises the wrong slice of its own
// sentence. contextParts is the consumer, so it is tested against the same
// fixtures rather than in isolation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sentenceAt, contextParts, clozeParts, MAX_CONTEXT_CHARS } from './context.js';
import { createTokenizer } from './tokenizer.js';

const VOCAB = [
  { w: '専門', r: 'せんもん', lvl: 2, g: 'speciality' },
  { w: '家', r: 'いえ', lvl: 5, g: 'house' },
  { w: '本', r: 'ほん', lvl: 5, g: 'book' },
  { w: '水', r: 'みず', lvl: 5, g: 'water' },
  { w: 'の', r: 'の', lvl: 5, g: 'of' },
  { w: 'です', r: 'です', lvl: 5, g: 'to be' },
];
const t = createTokenizer(VOCAB);

// Tokenize, then find the index of a given surface (nth occurrence).
function at(text, surface, nth = 0) {
  const tokens = t.tokenize(text);
  let seen = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].surface === surface && seen++ === nth) return { tokens, index: i };
  }
  throw new Error(`no token "${surface}" #${nth} in ${text}`);
}
const ctx = (text, surface, nth = 0, opts) => {
  const { tokens, index } = at(text, surface, nth);
  return sentenceAt(tokens, index, opts);
};

// ---- finding the sentence ---------------------------------------------------

test('picks out the one sentence containing the word', () => {
  const s = ctx('これは本です。水を飲む。', '水');
  assert.equal(s.text, '水を飲む。');
});

test('the sentence keeps its closing mark but not the previous one', () => {
  const s = ctx('前の文です。本を読む。', '本');
  assert.equal(s.text, '本を読む。');
  assert.ok(!s.text.includes('前の文'));
});

test('？ ！ and a newline all end a sentence', () => {
  assert.equal(ctx('だれ？本です。', '本').text, '本です。');
  assert.equal(ctx('すごい！水だ。', '水').text, '水だ。');
  assert.equal(ctx('一行目\n本です。', '本').text, '本です。');
});

test('a sentence ending mid-token is still found', () => {
  // 。「 is a single 'other' token — bounds must come from the text, not the
  // token edges, or the previous sentence leaks into the context.
  const s = ctx('前です。「本を読む」', '本');
  assert.ok(!s.text.includes('前です'), `leaked: ${s.text}`);
  assert.ok(s.text.includes('本を読む'));
});

test('text with no sentence marks at all yields the whole thing', () => {
  const s = ctx('本を読む', '本');
  assert.equal(s.text, '本を読む');
});

test('leading whitespace and newlines are trimmed off the context', () => {
  const s = ctx('前です。\n\n  本を読む。', '本');
  assert.equal(s.text, '本を読む。', 'no stray indent');
  assert.equal(s.text[s.start], '本', 'and the offset still points at the word');
});

// ---- the offsets ------------------------------------------------------------

test('start/end locate the word inside the returned text', () => {
  const s = ctx('これは本です。', '本');
  assert.equal(s.text.slice(s.start, s.end), '本');
});

test('the offsets point at the occurrence clicked, not the first match', () => {
  const text = '本を読んで本を書く。';
  const second = ctx(text, '本', 1);
  assert.equal(second.text.slice(second.start, second.end), '本');
  assert.ok(second.start > 0, 'the second 本, not the one at index 0');
  assert.equal(second.start, text.indexOf('本', 1));
});

test('a multi-character word is bounded exactly', () => {
  const s = ctx('これは専門の話です。', '専門');
  assert.equal(s.text.slice(s.start, s.end), '専門');
});

// ---- windowing long sentences ----------------------------------------------

test('an over-long sentence is windowed around the word, with ellipses', () => {
  const filler = 'あ'.repeat(200);
  const s = ctx(`${filler}本${filler}。`, '本');
  assert.ok(s.text.length <= MAX_CONTEXT_CHARS + 2, `too long: ${s.text.length}`);
  assert.equal(s.text.slice(s.start, s.end), '本', 'offsets survive the window shift');
  assert.ok(s.text.startsWith('…') && s.text.endsWith('…'), 'clipped on both sides');
});

test('a word near the start is not padded with a leading ellipsis', () => {
  const s = ctx(`本${'あ'.repeat(300)}。`, '本');
  assert.ok(!s.text.startsWith('…'));
  assert.ok(s.text.endsWith('…'));
  assert.equal(s.text.slice(s.start, s.end), '本');
});

test('a word near the end keeps the window against the right edge', () => {
  const s = ctx(`${'あ'.repeat(300)}本`, '本');
  assert.ok(s.text.startsWith('…'));
  assert.equal(s.text.slice(s.start, s.end), '本', 'not pushed past the end');
});

test('maxChars is configurable and respected', () => {
  const s = ctx(`${'あ'.repeat(80)}本${'あ'.repeat(80)}。`, '本', 0, { maxChars: 20 });
  assert.ok(s.text.length <= 22, `got ${s.text.length}`);
  assert.equal(s.text.slice(s.start, s.end), '本');
});

// ---- refusing to guess ------------------------------------------------------

test('an out-of-range or malformed index yields no context', () => {
  const tokens = t.tokenize('本です。');
  assert.equal(sentenceAt(tokens, -1), null);
  assert.equal(sentenceAt(tokens, 99), null);
  assert.equal(sentenceAt(tokens, 1.5), null);
  assert.equal(sentenceAt(tokens, null), null);
  assert.equal(sentenceAt(null, 0), null);
  assert.equal(sentenceAt([], 0), null);
});

test('a word surrounded by nothing but punctuation still yields itself', () => {
  const s = ctx('。本。', '本');
  assert.equal(s.text, '本。');
  assert.equal(s.text.slice(s.start, s.end), '本');
});

// ---- contextParts -----------------------------------------------------------

test('contextParts splits into before / word / after', () => {
  const s = ctx('これは本です。', '本');
  assert.deepEqual(contextParts(s), { before: 'これは', word: '本', after: 'です。' });
});

test('contextParts rejoins into exactly the original text', () => {
  for (const [text, surface] of [['これは本です。', '本'], ['水。', '水'], ['本を読んで本を書く。', '本']]) {
    const s = ctx(text, surface);
    const p = contextParts(s);
    assert.equal(p.before + p.word + p.after, s.text);
  }
});

test('contextParts degrades to plain text when the offsets do not fit', () => {
  // An entry hand-edited, or written by a future version with different bounds.
  assert.deepEqual(contextParts({ text: '本です。', start: 99, end: 200 }),
    { before: '本です。', word: '', after: '' });
  assert.deepEqual(contextParts({ text: '本です。' }),
    { before: '本です。', word: '', after: '' });
  assert.equal(contextParts(null), null);
  assert.equal(contextParts({ text: 5 }), null);
});

// ---- clozeParts -------------------------------------------------------------

test('clozeParts gives the same split a cloze prompt blanks out', () => {
  const s = ctx('これは本です。', '本');
  assert.deepEqual(clozeParts(s), { before: 'これは', word: '本', after: 'です。' });
});

test('clozeParts refuses an entry whose offsets no longer locate the word', () => {
  // contextParts degrades to an unhighlighted sentence here, which would blank
  // nothing at all — the card must fall back to an ordinary face instead.
  assert.equal(clozeParts({ text: '本です。', start: 99, end: 200 }), null);
  assert.equal(clozeParts({ text: '本です。' }), null);
  assert.equal(clozeParts(null), null);
});

test('clozeParts refuses a sentence with nothing readable left around the blank', () => {
  // Nothing would remain on the front of the card but the blank itself.
  assert.equal(clozeParts({ text: '本', start: 0, end: 1 }), null);
  assert.equal(clozeParts(ctx('。本。', '本')), null);   // → 本。 — a box and a full stop
  assert.equal(clozeParts({ text: '「本」', start: 1, end: 2 }), null); // quotes are no better
});

test('clozeParts keeps an entry with context on just one side', () => {
  const before = clozeParts({ text: 'これは本', start: 3, end: 4 });
  assert.deepEqual(before, { before: 'これは', word: '本', after: '' });
  const after = clozeParts({ text: '本です。', start: 0, end: 1 });
  assert.deepEqual(after, { before: '', word: '本', after: 'です。' });
});
