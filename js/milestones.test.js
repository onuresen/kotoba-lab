import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, buildMilestones } from './milestones.js';

const stats = (over = {}) => ({
  knownKanji: 0, knownWords: 0, readableWords: 0, savedCards: 0, reviewDays: 0, ...over,
});

test('every milestone declares an id, a label, a threshold, and a reader', () => {
  assert.ok(MILESTONES.length >= 8);
  for (const m of MILESTONES) {
    assert.equal(typeof m.id, 'string');
    assert.equal(typeof m.label, 'string');
    assert.ok(Number.isFinite(m.at) && m.at > 0, `${m.id} needs a positive threshold`);
    assert.equal(typeof m.value, 'function');
  }
  assert.equal(new Set(MILESTONES.map((m) => m.id)).size, MILESTONES.length, 'ids must be unique');
});

test('a fresh profile has passed nothing and is offered no forward line', () => {
  const result = buildMilestones(stats());
  assert.deepEqual(result.passed, []);
  // Nothing is close when everything is zero, so nothing is dangled.
  assert.equal(result.next, null);
});

test('passed milestones are reported, largest first', () => {
  const result = buildMilestones(stats({ knownKanji: 120 }));
  const ids = result.passed.map((m) => m.id);
  assert.ok(ids.includes('kanji-10'));
  assert.ok(ids.includes('kanji-100'));
  assert.equal(ids.indexOf('kanji-100') < ids.indexOf('kanji-10'), true, 'largest first');
});

test('a milestone that is not passed never appears in passed', () => {
  const result = buildMilestones(stats({ knownKanji: 99 }));
  assert.equal(result.passed.some((m) => m.id === 'kanji-100'), false);
});

test('the next milestone is offered only when it is genuinely close', () => {
  // 90 of 100 known kanji: within the 25% closeness window, so worth saying.
  const close = buildMilestones(stats({ knownKanji: 90 }));
  assert.equal(close.next.id, 'kanji-100');
  assert.equal(close.next.remaining, 10);

  // 12 of 100: far away, and dangling it would read as nagging.
  const far = buildMilestones(stats({ knownKanji: 12 }));
  assert.equal(far.next, null);
});

test('exactly one forward line is offered, never a list', () => {
  const result = buildMilestones(stats({ knownKanji: 95, readableWords: 96, savedCards: 48 }));
  assert.equal(result.next === null || typeof result.next === 'object', true);
  assert.equal(Array.isArray(result.next), false);
});

test('milestones cover capability, not just activity', () => {
  const ids = MILESTONES.map((m) => m.id).join(' ');
  for (const kind of ['kanji', 'words', 'readable']) {
    assert.ok(ids.includes(kind), `expected a ${kind} milestone`);
  }
});

test('malformed or missing stats degrade to nothing rather than throwing', () => {
  assert.deepEqual(buildMilestones(null), { passed: [], next: null });
  assert.deepEqual(buildMilestones({}), { passed: [], next: null });
  assert.deepEqual(buildMilestones({ knownKanji: NaN }), { passed: [], next: null });
  assert.deepEqual(buildMilestones({ knownKanji: -5 }), { passed: [], next: null });
});
