// srs.test.js — run with: npm test  (or: node --test js/srs.test.js)
//
// The scheduler is the code most worth testing here and the least likely to
// tell you it broke: a wrong interval doesn't throw, it just quietly teaches
// you on the wrong days for a month. Everything below pins a behaviour the
// module's own comments claim, with a fixed clock.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCard, cardOf, isNew, isLearning, isReady, schedule, preview, formatWait,
  buildQueue, queueStats, LEARN_STEPS_MIN, LEARN_AHEAD_MS, GRADES,
} from './srs.js';

const T0 = Date.UTC(2026, 0, 15, 9, 0, 0);
const MIN = 60_000;
const DAY = 86_400_000;

// A graduated card: past the learning steps, with a real day-interval.
const graduated = (over = {}) => ({
  due: T0, interval: 10, ease: 2.5, reps: 5, lapses: 0, step: 0, reviewedAt: T0 - DAY, ...over,
});

// ---- card states ------------------------------------------------------------

test('a new card is due immediately and reads as new, not learning', () => {
  const c = newCard(T0);
  assert.equal(c.due, T0);
  assert.equal(c.interval, 0);
  assert.equal(c.ease, 2.5);
  assert.ok(isNew(c));
  assert.ok(!isLearning(c), 'never answered, so not yet "learning"');
  assert.ok(isReady(c, T0));
});

test('cardOf falls back to a new card for pre-v5 deck entries', () => {
  const withSrs = { surface: '本', srs: graduated() };
  assert.equal(cardOf(withSrs, T0).interval, 10);

  // Saved before v5: no srs at all. It should be ready now, not lost.
  const legacy = { surface: '水', savedAt: T0 - 30 * DAY };
  const c = cardOf(legacy, T0);
  assert.ok(isNew(c));
  assert.ok(isReady(c, T0));

  // No savedAt either — falls back to `now` rather than NaN.
  assert.equal(Number.isFinite(cardOf({ surface: '火' }, T0).due), true);
});

test('learn-ahead makes a 1-minute card reviewable, a graduated one not', () => {
  const learning = { ...newCard(T0), reps: 1, due: T0 + MIN };
  assert.ok(isReady(learning, T0), 'inside the learn-ahead window');
  assert.ok(!isReady({ ...learning, due: T0 + LEARN_AHEAD_MS + MIN }, T0), 'beyond it');
  // Learn-ahead is for learning cards only: a card with a day-interval waits.
  assert.ok(!isReady(graduated({ due: T0 + MIN }), T0));
});

// ---- schedule: learning steps ----------------------------------------------

test('a new card walks the learning steps, then graduates to 1 day', () => {
  let c = newCard(T0);
  c = schedule(c, 'good', T0);
  assert.equal(c.due - T0, LEARN_STEPS_MIN[1] * MIN, 'step 1 → the 10-minute step');
  assert.equal(c.interval, 0, 'still learning');
  assert.ok(isLearning(c));

  c = schedule(c, 'good', T0);
  assert.equal(c.interval, 1, 'graduated');
  assert.equal(c.due - T0, DAY);
  assert.equal(c.step, 0);
  assert.equal(c.reps, 2);
});

test('Hard repeats the current learning step instead of advancing it', () => {
  const atStep1 = { ...newCard(T0), reps: 1, step: 1 };
  const c = schedule(atStep1, 'hard', T0);
  assert.equal(c.step, 1, 'stays put');
  assert.equal(c.due - T0, LEARN_STEPS_MIN[1] * MIN);
  assert.equal(c.interval, 0);
});

test('Easy skips the remaining learning steps entirely', () => {
  const c = schedule(newCard(T0), 'easy', T0);
  assert.equal(c.interval, 4);
  assert.equal(c.due - T0, 4 * DAY);
  assert.equal(c.step, 0);
});

// ---- schedule: graduated cards ---------------------------------------------

test('Good multiplies the interval by the card ease', () => {
  const c = schedule(graduated({ interval: 10, ease: 2.5 }), 'good', T0);
  assert.equal(c.interval, 25);
  assert.equal(c.due - T0, 25 * DAY);
  assert.equal(c.ease, 2.5, 'Good leaves ease alone');
});

test('Hard shrinks both ease and growth; Easy boosts both', () => {
  const hard = schedule(graduated({ interval: 10, ease: 2.5 }), 'hard', T0);
  assert.equal(hard.ease, 2.35);
  assert.equal(hard.interval, 12, '10 × 1.2');

  const easy = schedule(graduated({ interval: 10, ease: 2.5 }), 'easy', T0);
  assert.equal(easy.ease, 2.65);
  assert.equal(easy.interval, 34, '10 × the NEW ease (2.65) × 1.3, rounded');
  assert.ok(easy.interval > schedule(graduated(), 'good', T0).interval, 'Easy always beats Good');
});

test('Again costs ease, records a lapse, and drops back into learning', () => {
  const c = schedule(graduated({ interval: 30, ease: 2.5, lapses: 1 }), 'again', T0);
  assert.equal(c.lapses, 2);
  assert.equal(c.ease, 2.3);
  assert.equal(c.interval, 0, 'back to learning');
  assert.equal(c.step, 0);
  assert.equal(c.due - T0, LEARN_STEPS_MIN[0] * MIN);
});

test('failing a card still in learning costs no ease and no lapse', () => {
  const learning = { ...newCard(T0), reps: 1, step: 1 };
  const c = schedule(learning, 'again', T0);
  assert.equal(c.lapses, 0, "you can't lapse a card you never learned");
  assert.equal(c.ease, 2.5);
  assert.equal(c.step, 0, 'restarts the steps');
});

test('ease floors at 1.3 and intervals cap at a year', () => {
  let c = graduated({ ease: 1.35, interval: 10 });
  c = schedule(c, 'again', T0);
  assert.equal(c.ease, 1.3, 'floored, not 1.15');
  c = schedule(graduated({ ease: 1.3, interval: 10 }), 'hard', T0);
  assert.equal(c.ease, 1.3, 'stays at the floor');

  const capped = schedule(graduated({ interval: 300, ease: 2.5 }), 'good', T0);
  assert.equal(capped.interval, 365);
  assert.equal(capped.due - T0, 365 * DAY);
});

test('every grade advances reps and stamps reviewedAt, and never mutates the input', () => {
  for (const grade of GRADES) {
    const before = graduated();
    const snapshot = { ...before };
    const after = schedule(before, grade, T0);
    assert.deepEqual(before, snapshot, `${grade} mutated its argument`);
    assert.equal(after.reps, snapshot.reps + 1);
    assert.equal(after.reviewedAt, T0);
  }
});

// ---- interval previews ------------------------------------------------------

test('formatWait picks each unit from its own rounded value', () => {
  assert.equal(formatWait(0), 'now');
  assert.equal(formatWait(45 * MIN), '45m');
  assert.equal(formatWait(30_000), '1m', 'never rounds down to "0m"');
  assert.equal(formatWait(DAY - MIN), '1d', 'not "24h"');
  assert.equal(formatWait(10 * DAY), '10d');
  assert.equal(formatWait(45 * DAY), '2mo');
  assert.equal(formatWait(400 * DAY), '1.1y');
});

test('the preview on a button is what pressing it actually buys', () => {
  const c = graduated({ interval: 10, ease: 2.5 });
  for (const grade of GRADES) {
    assert.equal(preview(c, grade, T0), formatWait(schedule(c, grade, T0).due - T0));
  }
  assert.equal(preview(c, 'good', T0), '25d');
  assert.equal(preview(c, 'again', T0), '1m');
});

// ---- session queue ----------------------------------------------------------

const entry = (surface, card) => ({ surface, reading: null, gloss: 'x', level: 3, savedAt: T0, srs: card });

test('the queue runs due → new → learn-ahead, so a lapse is not handed straight back', () => {
  const entries = [
    entry('ahead', { ...newCard(T0), reps: 3, interval: 0, due: T0 + MIN }),  // just failed
    entry('new', newCard(T0)),
    entry('due', graduated({ due: T0 - DAY })),
  ];
  const q = buildQueue(entries, { now: T0 });
  assert.deepEqual(q.map((x) => x.entry.surface), ['due', 'new', 'ahead'],
    'the card due in 1 minute sorts last despite being the soonest due');
});

test('the card you just answered is rotated off the front', () => {
  const entries = [
    entry('a', { ...newCard(T0), reps: 2, due: T0 + MIN }),
    entry('b', { ...newCard(T0), reps: 2, due: T0 + 2 * MIN }),
  ];
  const plain = buildQueue(entries, { now: T0 });
  assert.equal(plain[0].entry.surface, 'a');

  const rotated = buildQueue(entries, { now: T0, lastAnswered: 'a' });
  assert.deepEqual(rotated.map((x) => x.entry.surface), ['b', 'a']);

  // With nothing else to show, it has to come back — better than an empty session.
  const alone = buildQueue([entries[0]], { now: T0, lastAnswered: 'a' });
  assert.equal(alone.length, 1);
});

test('newLimit caps new cards without touching due ones', () => {
  const entries = [
    ...Array.from({ length: 5 }, (_, i) => entry(`new${i}`, newCard(T0 - i))),
    entry('due1', graduated({ due: T0 - DAY })),
    entry('due2', graduated({ due: T0 - 2 * DAY })),
  ];
  const q = buildQueue(entries, { now: T0, newLimit: 2 });
  const kinds = q.map((x) => (isNew(x.card) ? 'new' : 'due'));
  assert.equal(kinds.filter((k) => k === 'new').length, 2, 'new cards capped');
  assert.equal(kinds.filter((k) => k === 'due').length, 2, 'due cards all kept');
  assert.deepEqual(q.slice(0, 2).map((x) => x.entry.surface), ['due2', 'due1'], 'oldest due first');
});

test('cards that are genuinely not due yet stay out of the queue', () => {
  const entries = [entry('later', graduated({ due: T0 + 5 * DAY }))];
  assert.equal(buildQueue(entries, { now: T0 }).length, 0);
});

test('queueStats reports what the Review tab shows, including the next due time', () => {
  const entries = [
    entry('new1', newCard(T0)),
    entry('due1', graduated({ due: T0 - DAY })),
    entry('learn', { ...newCard(T0), reps: 2, interval: 0, due: T0 + MIN }),
    entry('later', graduated({ due: T0 + 5 * DAY })),
  ];
  const s = queueStats(entries, { now: T0 });
  assert.equal(s.total, 4);
  assert.equal(s.fresh, 1);
  assert.equal(s.due, 2, 'the graduated due card plus the learn-ahead one');
  assert.equal(s.learning, 1);
  assert.equal(s.nextDue, T0 + 5 * DAY, 'the soonest card that is NOT already reviewable');
});

test('an empty deck reports an empty session rather than throwing', () => {
  assert.deepEqual(buildQueue([], { now: T0 }), []);
  assert.deepEqual(queueStats([], { now: T0 }),
    { due: 0, fresh: 0, learning: 0, total: 0, nextDue: null });
});

// ---- the property that matters over months ---------------------------------

test('a card answered Good repeatedly grows monotonically to the cap', () => {
  let c = newCard(T0);
  let now = T0;
  const intervals = [];
  for (let i = 0; i < 20; i++) {
    c = schedule(c, 'good', now);
    now = c.due;
    if (c.interval) intervals.push(c.interval);
  }
  for (let i = 1; i < intervals.length; i++) {
    assert.ok(intervals[i] >= intervals[i - 1], `interval shrank: ${intervals[i - 1]} → ${intervals[i]}`);
  }
  assert.equal(intervals.at(-1), 365, 'and settles at the one-year cap');
});
