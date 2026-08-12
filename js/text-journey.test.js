import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTextJourney,
  createJourneySession,
  currentJourneyStep,
  moveJourneyStep,
  revealJourneyStep,
} from './text-journey.js';

const tokens = [
  { surface: '学校', kind: 'word', reading: 'がっこう', gloss: 'school' },
  { surface: 'で', kind: 'kana' },
  { surface: '学生', kind: 'word', reading: 'がくせい', gloss: 'student' },
  { surface: 'が学ぶ。', kind: 'kanji', reading: '', gloss: '' },
];
const rows = [{ ch: '学', n: 3 }, { ch: '校', n: 1 }, { ch: '生', n: 1 }];
const catalog = [
  { char: '学', meaning: 'study' }, { char: '校', meaning: 'school' }, { char: '生', meaning: 'life' },
];

test('journey ranks unknown kanji by occurrence and projects cumulative coverage', () => {
  const journey = buildTextJourney(rows, tokens, catalog, (char) => char === '校', { limit: 2 });
  assert.equal(journey.currentPct, 20);
  assert.equal(journey.projectedPct, 100);
  assert.deepEqual(journey.route.map((item) => [item.char, item.occurrences, item.projectedPct]), [
    ['学', 3, 80], ['生', 1, 100],
  ]);
});

test('journey connects a kanji to unique words and original sentence context', () => {
  const journey = buildTextJourney(rows, tokens, catalog, () => false);
  const study = journey.route[0];
  assert.deepEqual(study.words.map((word) => word.surface), ['学校', '学生', 'が学ぶ。']);
  assert.equal(study.contexts.length, 1);
  assert.equal(study.contexts[0].text, '学校で学生が学ぶ。');
});

test('journey session reveals, records progress, and moves within bounds', () => {
  let session = createJourneySession(buildTextJourney(rows, tokens, catalog, () => false));
  assert.equal(currentJourneyStep(session).char, '学');
  session = revealJourneyStep(session);
  assert.equal(session.visited.has('学'), true);
  session = moveJourneyStep(session, 1);
  assert.equal(session.revealed, false);
  assert.equal(moveJourneyStep(session, 99).index, session.route.length - 1);
});
