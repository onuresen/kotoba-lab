import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomophoneGroups, homophoneQuestion, answerHomophoneQuestion } from './false-friends.js';

const w = (surface, reading, lvl, gloss) => ({ w: surface, r: reading, lvl, g: gloss });

const VOCAB = [
  w('取る', 'とる', 3, 'to take'),
  w('執る', 'とる', null, 'to take (trouble)'),
  w('捕る', 'とる', 2, 'to take (a fish)'),
  w('採る', 'とる', 2, 'to adopt (measure)'),
  w('返る', 'かえる', 1, 'to return'),
  w('帰る', 'かえる', 4, 'to go home'),
  w('一', 'いち', 5, 'one'), // single kanji — excluded from grouping
  w('市', 'いち', 4, 'market'), // single kanji — excluded from grouping
  w('学校', 'がっこう', 5, 'school'), // no homophone partner
];

test('groups words by identical reading, single-kanji entries excluded', () => {
  const groups = buildHomophoneGroups(VOCAB);
  const readings = groups.map((g) => g.reading).sort();
  assert.deepEqual(readings, ['とる', 'かえる'].sort());
  assert.equal(groups.find((g) => g.reading === 'いち'), undefined, 'single-kanji homophones are not multi-char words');
});

test('a group with only one multi-character member is dropped (minSize default 2)', () => {
  const groups = buildHomophoneGroups(VOCAB);
  assert.equal(groups.some((g) => g.rows.some((r) => r.w === '学校')), false);
});

test('group rows are capped at maxSize and distinct by meaning', () => {
  const groups = buildHomophoneGroups(VOCAB, { maxSize: 2 });
  const toru = groups.find((g) => g.reading === 'とる');
  assert.equal(toru.rows.length, 2);
});

test('an exact duplicate meaning within a reading is collapsed to one row', () => {
  const vocab = [
    w('AA', 'たべる', 3, 'to eat'),
    w('BB', 'たべる', 2, 'to eat'), // identical gloss to AA
    w('CC', 'たべる', 1, 'to devour'),
  ];
  const groups = buildHomophoneGroups(vocab);
  const group = groups.find((g) => g.reading === 'たべる');
  assert.deepEqual(group.rows.map((r) => r.w), ['AA', 'CC']);
});

test('groups sort by graded-member count, then size, then reading', () => {
  const groups = buildHomophoneGroups(VOCAB);
  // とる has 3 graded members (執る is ungraded), かえる has 2 — とる should sort first.
  assert.equal(groups[0].reading, 'とる');
});

test('homophoneQuestion targets one member and never leaks reading as the clue', () => {
  const groups = buildHomophoneGroups(VOCAB);
  const toru = groups.find((g) => g.reading === 'とる');
  const q = homophoneQuestion(toru, 0);
  assert.equal(q.target.w, toru.rows[0].w);
  assert.ok(q.prompt.includes(toru.reading), 'prompt names the shared reading');
  assert.ok(q.prompt.includes(q.clue), 'prompt names the meaning clue');
  assert.equal(q.choices.length, toru.rows.length);
});

test('homophoneQuestion returns null past the end of the group', () => {
  const groups = buildHomophoneGroups(VOCAB);
  const toru = groups.find((g) => g.reading === 'とる');
  assert.equal(homophoneQuestion(toru, 99), null);
  assert.equal(homophoneQuestion(null, 0), null);
});

test('answerHomophoneQuestion scores correct and incorrect choices', () => {
  const groups = buildHomophoneGroups(VOCAB);
  const toru = groups.find((g) => g.reading === 'とる');
  const q = homophoneQuestion(toru, 0);
  assert.equal(answerHomophoneQuestion(q, q.target.w).correct, true);
  assert.equal(answerHomophoneQuestion(q, 'not-a-real-choice').correct, false);
  assert.equal(answerHomophoneQuestion(null, 'x'), null);
});
