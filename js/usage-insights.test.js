import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUsageInsights } from './usage-insights.js';

function summary(events, sessions = 3, activeMinutes = 12) {
  return {
    events,
    sessions,
    activeMinutes,
    eventCount: Object.values(events).reduce((sum, count) => sum + count, 0),
  };
}

test('small samples ask for more activity instead of inventing friction', () => {
  const result = buildUsageInsights(summary({ 'tab.read': 2 }, 1, 2));
  assert.equal(result.enoughData, false);
  assert.equal(result.signals[0].id, 'collecting');
});

test('feature mix groups only the fixed coarse event names', () => {
  const result = buildUsageInsights(summary({ 'tab.kanji': 2, 'tree.open': 3, 'query.secret': 99 }));
  const kanji = result.featureMix.find((feature) => feature.key === 'kanji');
  assert.equal(kanji.count, 5);
  assert.equal(kanji.strength, 100);
  assert.equal(result.featureMix.some((feature) => feature.count === 99), false);
});

test('due cards with no journal-window answers become an actionable signal', () => {
  const result = buildUsageInsights(summary({ 'tab.analyze': 8 }), { dueCards: 7 });
  const signal = result.signals.find((item) => item.id === 'review-ready');
  assert.equal(signal.actionTab, 'review');
  assert.match(signal.body, /7 cards/);
});

test('repeated analysis with little reading suggests the missing handoff', () => {
  const result = buildUsageInsights(summary({ 'analyze.run': 6, 'tab.read': 1, 'tab.analyze': 2 }));
  assert.equal(result.signals.some((item) => item.id === 'analysis-handoff'), true);
});

test('repeated relationship exploration without study suggests a family drill', () => {
  const result = buildUsageInsights(summary({ 'tree.open': 4, 'relations.open': 3, 'tab.kanji': 1 }));
  assert.equal(result.signals.some((item) => item.id === 'explore-to-study'), true);
});

test('balanced activity produces a neutral positive result', () => {
  const result = buildUsageInsights(summary({
    'analyze.run': 2, 'tab.read': 2, 'tree.open': 2, 'study.family': 1, 'review.answer': 2,
  }), { dueCards: 0 });
  assert.deepEqual(result.signals.map((item) => item.id), ['clear-path']);
});
