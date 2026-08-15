import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alchemyProgress,
  answerAlchemyQuestion,
  buildAlchemyRecipes,
  buildDailyAlchemyChallenge,
  createAlchemySession,
  currentAlchemyQuestion,
  moveAlchemyQuestion,
  restartAlchemySession,
} from './kanji-alchemy.js';

const catalog = [
  { char: '明', jlpt: 5, strokes: 8, meaning: 'bright' },
  { char: '林', jlpt: 4, strokes: 8, meaning: 'woods' },
  { char: '休', jlpt: 3, strokes: 6, meaning: 'rest' },
  { char: '語', jlpt: 2, strokes: 14, meaning: 'language' },
  { char: '好', jlpt: 1, strokes: 6, meaning: 'fond' },
  { char: '晶', jlpt: 1, strokes: 12, meaning: 'sparkle' },
  { char: '朋', jlpt: null, strokes: 8, meaning: 'companion' },
];
const structureIndex = { byKanji: new Map([
  ['明', { components: ['日', '月'] }],
  ['林', { components: ['木', '木'] }],
  ['休', { components: ['亻', '木'] }],
  ['語', { components: ['言', '吾'] }],
  ['好', { components: ['女', '子'] }],
  ['晶', { components: ['日', '月'] }],
  ['朋', { components: ['月', '月'] }],
]) };

test('recipes require two distinct direct components and an unambiguous pair', () => {
  assert.deepEqual(buildAlchemyRecipes(catalog, structureIndex).map((recipe) => recipe.target.char), ['休', '好', '語']);
});

test('daily challenge is deterministic and contains valid choices', () => {
  const componentPairs = [['一', '丨'], ['丶', '丿'], ['乙', '亅'], ['二', '亠'], ['人', '儿'], ['入', '八'], ['冂', '冖']];
  const expanded = {
    byKanji: new Map(catalog.map((item, index) => [item.char, { components: componentPairs[index] }]))
  };
  const first = buildDailyAlchemyChallenge(catalog, expanded, { date: '2026-08-15', count: 5 });
  const again = buildDailyAlchemyChallenge(catalog, expanded, { date: '2026-08-15', count: 5 });
  assert.deepEqual(first, again);
  assert.deepEqual(first.questions.map((question) => question.target.jlpt), [5, 4, 3, 2, 1]);
  assert.ok(first.questions.every((question) => question.choices.length === 4));
  assert.ok(first.questions.every((question) => question.choices.some((choice) => choice.char === question.target.char)));
});

test('session answers once, navigates within bounds, and reports score', () => {
  const challenge = {
    date: '2026-08-15',
    questions: [
      { ingredients: ['日', '月'], target: { char: '明' }, choices: [{ char: '明' }, { char: '林' }] },
      { ingredients: ['亻', '木'], target: { char: '休' }, choices: [{ char: '好' }, { char: '休' }] },
    ],
  };
  let session = createAlchemySession(challenge);
  assert.equal(currentAlchemyQuestion(session).target.char, '明');
  session = answerAlchemyQuestion(session, '明');
  session = answerAlchemyQuestion(session, '林');
  assert.deepEqual(alchemyProgress(session), { current: 1, total: 2, answered: 1, correct: 1, complete: false });
  session = moveAlchemyQuestion(session, 1);
  session = answerAlchemyQuestion(session, '好');
  assert.deepEqual(alchemyProgress(session), { current: 2, total: 2, answered: 2, correct: 1, complete: true });
  assert.equal(moveAlchemyQuestion(session, 1).index, 1);
  session = restartAlchemySession(session);
  assert.equal(session.index, 0);
  assert.deepEqual(session.answers, [null, null]);
});

test('challenge declines an undersized recipe pool', () => {
  assert.equal(buildDailyAlchemyChallenge(catalog, structureIndex, { count: 5 }), null);
});
