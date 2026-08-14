import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileMetrics, clearProfileCategory, emptyProfileState } from './profile-dashboard.js';

const NOW = Date.UTC(2026, 7, 14, 12);
const card = (due, reps = 1) => ({ due, interval: 1, ease: 2.5, reps, lapses: 0, step: 0, reviewedAt: NOW - 1000 });
const state = {
  deck: [
    { surface: '新', savedAt: NOW },
    { surface: '今', savedAt: NOW, srs: card(NOW - 1) },
    { surface: '後', savedAt: NOW, srs: card(NOW + 1000) },
  ],
  knownWords: ['日本語', '勉強'],
  knownKanji: ['日'],
  reviewLog: { '2026-08-12': 3, '2026-08-14': 5 },
};

test('dashboard metrics distinguish new, due, and scheduled cards', () => {
  const metrics = buildProfileMetrics(state, NOW);
  assert.deepEqual({ cards: metrics.cards, newCards: metrics.newCards, dueCards: metrics.dueCards, scheduledCards: metrics.scheduledCards }, {
    cards: 3, newCards: 1, dueCards: 1, scheduledCards: 1,
  });
  assert.equal(metrics.knownWords, 2);
  assert.equal(metrics.knownKanji, 1);
  assert.equal(metrics.reviewDays, 2);
  assert.equal(metrics.reviewAnswers, 8);
  assert.equal(metrics.lastReview, '2026-08-14');
  assert.ok(metrics.bytes > 0);
});

test('category clearing changes only the requested collection and never mutates input', () => {
  const cleared = clearProfileCategory(state, 'knownKanji');
  assert.deepEqual(cleared.knownKanji, []);
  assert.deepEqual(cleared.deck, state.deck);
  assert.deepEqual(cleared.knownWords, state.knownWords);
  assert.deepEqual(cleared.reviewLog, state.reviewLog);
  assert.deepEqual(state.knownKanji, ['日']);
});

test('unknown categories are safe and a full reset returns the four canonical stores', () => {
  assert.deepEqual(clearProfileCategory(state, 'mystery'), state);
  assert.deepEqual(emptyProfileState(), { deck: [], knownWords: [], knownKanji: [], reviewLog: {} });
});
