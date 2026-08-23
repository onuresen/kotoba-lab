import test from 'node:test';
import assert from 'node:assert/strict';
import { forecast } from './study-weather.js';

test('no cards saved yet reads as clear ground, not zero-anything', () => {
  const f = forecast({ due: 0, fresh: 0, total: 0, streak: 0, daysSinceReview: null });
  assert.equal(f.icon, '🌱');
  assert.match(f.detail, /save a word/i);
});

test('caught up with nothing due is clear skies, and names a real streak', () => {
  const quiet = forecast({ due: 0, fresh: 0, total: 3, streak: 0, daysSinceReview: 0 });
  assert.equal(quiet.headline, 'Clear skies');
  assert.doesNotMatch(quiet.detail, /streak/);

  const streaking = forecast({ due: 0, fresh: 0, total: 3, streak: 4, daysSinceReview: 0 });
  assert.match(streaking.detail, /4-day streak/);
});

test('a small number of ready cards is light showers, not a warning', () => {
  const f = forecast({ due: 2, fresh: 1, total: 5, streak: 1, daysSinceReview: 0 });
  assert.equal(f.headline, 'Light showers');
  assert.match(f.detail, /3 cards ready/);
});

test('a lot of ready cards is steady rain but still no pressure to clear it all', () => {
  const f = forecast({ due: 20, fresh: 0, total: 20, streak: 0, daysSinceReview: 1 });
  assert.equal(f.headline, 'Steady rain');
  assert.match(f.detail, /no need to clear them all/);
});

test('a long gap since the last review outranks the count and stays calm', () => {
  const f = forecast({ due: 2, fresh: 0, total: 2, streak: 0, daysSinceReview: 6 });
  assert.equal(f.headline, 'A little foggy');
  assert.match(f.detail, /6 days/);
  assert.doesNotMatch(f.detail, /broke|lost|missed/i);
});

test('never having reviewed at all is also foggy, not a streak of zero', () => {
  const f = forecast({ due: 0, fresh: 2, total: 2, streak: 0, daysSinceReview: null });
  assert.equal(f.headline, 'A little foggy');
  assert.match(f.detail, /a while/);
});

test('a short gap with cards waiting does not trigger fog early', () => {
  const f = forecast({ due: 1, fresh: 0, total: 1, streak: 0, daysSinceReview: 2 });
  assert.equal(f.headline, 'Light showers');
});

test('malformed input never throws and falls back to clear ground', () => {
  assert.equal(forecast(null).headline, 'Clear ground');
  assert.equal(forecast(undefined).headline, 'Clear ground');
  assert.equal(forecast({}).headline, 'Clear ground');
});
