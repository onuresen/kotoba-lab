// read.test.js — run with: npm test  (or: node --test js/read.test.js)
//
// read.js is entirely DOM rendering + click routing, so these tests run
// against test-dom-shim.js's small DOM stand-in rather than a real browser
// (see that file's header for why). Coverage here is what's uniquely
// read.js's own logic: which markup shape a token gets (span vs ruby),
// click-target precedence between a word and the kanji nested inside it,
// and the known-state repaint that runs without a full re-render.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReading, applyKnownClasses, hasGrammar } from './read.js';
import { createJlpt } from './jlpt.js';
import { createContainer } from './support/test-dom-shim.js';

const jlpt = createJlpt({
  '専': { jlpt: 2, strokes: 9, on: '', kun: '', meaning: 'special' },
  '門': { jlpt: 2, strokes: 8, on: '', kun: '', meaning: 'gate' },
  '家': { jlpt: 4, strokes: 10, on: '', kun: '', meaning: 'house' },
  '猫': { jlpt: null, strokes: 11, on: '', kun: '', meaning: 'cat' }, // dictionary miss below
});

function render(tokens, { mode = 'original', isKnown = {} } = {}) {
  const events = [];
  const container = createContainer();
  renderReading(container, tokens, jlpt, (e) => events.push(e), isKnown, mode);
  return { container, events };
}

test('a word with kanji and a reading renders as ruby, furigana in <rt>', () => {
  const { container } = render([
    { surface: '専門家', reading: 'せんもんか', level: 2, gloss: 'specialist', kind: 'word' },
  ]);
  const [word] = container.querySelectorAll('.tok.word');
  assert.equal(word.tagName, 'RUBY');
  assert.equal(word.children.find((c) => c.tagName === 'RT')?.textContent, 'せんもんか');
});

test('a kana-only word (no kanji in the surface) never renders as ruby, even with a reading', () => {
  // Regression guard for the tokenizer-kuromoji.js fix: readings are now
  // attached to katakana/kana word tokens too, but read.js must still gate
  // furigana on the surface actually containing kanji, not just on reading
  // being present — otherwise a loanword like コーヒー would get pointless
  // ruby text repeating its own surface.
  const { container } = render([
    { surface: 'コーヒー', reading: 'こーひー', level: null, gloss: 'coffee', kind: 'word' },
  ]);
  const [word] = container.querySelectorAll('.tok.word');
  assert.equal(word.tagName, 'SPAN');
  assert.equal(word.querySelectorAll('RT').length, 0);
});

test('clicking a word selects the word, even when the click lands on a kanji glyph nested inside it', () => {
  // The precedence read.js's own comment calls out: kanji spans nest INSIDE
  // .tok.word, so .tok.word must be checked first or a click anywhere on a
  // kanji-containing word would wrongly resolve to just that one kanji.
  const { container, events } = render([
    { surface: '専門家', reading: 'せんもんか', level: 2, gloss: 'specialist', kind: 'word' },
  ]);
  const kanjiSpan = container.querySelectorAll('[data-k]')[1]; // the 門 glyph, nested in the word
  assert.equal(kanjiSpan.dataset.k, '門');
  container.click(kanjiSpan);
  assert.deepEqual(events, [{
    type: 'word', index: 0, surface: '専門家', reading: 'せんもんか', gloss: 'specialist', level: 2,
  }]);
});

test('clicking an unmatched kanji run (dictionary miss) selects that kanji, with the index from its own run', () => {
  const { container, events } = render([
    { surface: '猫', reading: null, level: null, gloss: null, kind: 'kanji' },
  ]);
  const [kanjiSpan] = container.querySelectorAll('[data-k]');
  container.click(kanjiSpan);
  assert.deepEqual(events, [{ type: 'kanji', index: 0, ch: '猫', level: null }]);
});

test('applyKnownClasses toggles is-known on both word and kanji spans independently', () => {
  const { container } = render([
    { surface: '専門', reading: 'せんもん', level: 2, gloss: 'speciality', kind: 'word' },
    { surface: '猫', reading: null, level: null, gloss: null, kind: 'kanji' },
  ]);
  applyKnownClasses(container, {
    word: (s) => s === '専門',
    kanji: (c) => c === '猫',
  });
  const [word] = container.querySelectorAll('.tok.word');
  assert.equal(word.classList.contains('is-known'), true);
  const catSpan = container.querySelectorAll('[data-k]').find((el) => el.dataset.k === '猫');
  assert.equal(catSpan.classList.contains('is-known'), true);
  const specSpan = container.querySelectorAll('[data-k]').find((el) => el.dataset.k === '専');
  assert.equal(specSpan.classList.contains('is-known'), false);
});

test('applyKnownClasses defaults to nothing known when isKnown is omitted', () => {
  const { container } = render([{ surface: '猫', reading: null, level: null, gloss: null, kind: 'kanji' }]);
  applyKnownClasses(container);
  const [kanjiSpan] = container.querySelectorAll('[data-k]');
  assert.equal(kanjiSpan.classList.contains('is-known'), false);
});

test('hasGrammar is true only when at least one token carries a part of speech', () => {
  assert.equal(hasGrammar([{ surface: '猫', kind: 'kanji' }]), false);
  assert.equal(hasGrammar([{ surface: '猫', kind: 'word', pos: '名詞' }]), true);
  assert.equal(hasGrammar([]), false);
});

test('kana mode swaps a word\'s displayed text to its reading, keeping the same click data', () => {
  const { container, events } = render([
    { surface: '専門家', reading: 'せんもんか', level: 2, gloss: 'specialist', kind: 'word' },
  ], { mode: 'kana' });
  const [word] = container.querySelectorAll('.tok.word');
  assert.equal(word.tagName, 'SPAN');
  assert.equal(word.textContent, 'せんもんか');
  container.click(word);
  assert.equal(events[0].type, 'word');
  assert.equal(events[0].surface, '専門家'); // click data is unaffected by display mode
});
