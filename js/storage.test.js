// storage.test.js — run with: npm test  (or: node --test js/storage.test.js)
//
// storage.js is the only module that talks to localStorage, so these tests
// hand it a fake one. Two things here are worth the trouble: the study streak
// (a date rule that is easy to get subtly wrong and very visible when it is),
// and the promise in the README that the app "never throws" when storage is
// unavailable — which is only true if something checks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnownSet, createDeck, createReviewLog, createAchievementLog } from './storage.js';

// ---- a fake localStorage ----------------------------------------------------

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map),
  };
}
// Every read AND write fails — private browsing, sandboxed iframe, quota full.
const brokenStorage = {
  getItem() { throw new DOMException_('SecurityError'); },
  setItem() { throw new DOMException_('QuotaExceededError'); },
};
function DOMException_(name) { const e = new Error(name); e.name = name; return e; }

const useStorage = (s) => { globalThis.localStorage = s; };

// ---- known sets -------------------------------------------------------------

test('a known set toggles on and off and survives a reload', () => {
  const store = fakeStorage();
  useStorage(store);

  const set = createKnownSet('known-words');
  assert.equal(set.toggle('本'), true, 'toggle returns the NEW state');
  set.toggle('水');
  assert.ok(set.has('本'));
  assert.equal(set.count(), 2);
  assert.equal(set.toggle('本'), false);
  assert.ok(!set.has('本'));

  // "Reload": a fresh set over the same storage sees the same data.
  assert.deepEqual(createKnownSet('known-words').all(), ['水']);
  assert.ok('kotoba-lab:known-words' in store._dump(), 'namespaced key');
});

test('replaceAll swaps the whole set in one write, clear empties it', () => {
  useStorage(fakeStorage());
  const set = createKnownSet('known-kanji');
  set.toggle('一');
  set.replaceAll(['二', '三', '三']);
  assert.deepEqual(set.all(), ['二', '三'], 'deduped, and 一 is gone');
  assert.deepEqual(createKnownSet('known-kanji').all(), ['二', '三'], 'persisted');
  set.clear();
  assert.equal(set.count(), 0);
  assert.equal(createKnownSet('known-kanji').count(), 0);
});

// ---- deck -------------------------------------------------------------------

test('the deck keys by surface and stamps savedAt', () => {
  useStorage(fakeStorage());
  const deck = createDeck('deck');
  assert.equal(deck.toggle({ surface: '本', reading: 'ほん', gloss: 'book', level: 5 }), true);
  assert.ok(deck.has('本'));
  assert.ok(deck.get('本').savedAt > 0);
  assert.equal(deck.get('missing'), null);

  assert.equal(deck.toggle({ surface: '本' }), false, 'toggling again removes it');
  assert.equal(deck.count(), 0);
});

test('update merges a patch and leaves the rest of the entry intact', () => {
  useStorage(fakeStorage());
  const deck = createDeck('deck');
  deck.toggle({ surface: '水', reading: 'みず', gloss: 'water', level: 5 });
  const next = deck.update('水', { srs: { interval: 6, reps: 3 } });
  assert.equal(next.gloss, 'water', 'the patch did not wipe the card');
  assert.equal(next.srs.interval, 6);
  assert.equal(createDeck('deck').get('水').srs.reps, 3, 'persisted');
  assert.equal(deck.update('nope', { srs: {} }), null, 'updating a missing card is a no-op');
});

test('the deck lists most-recently-saved first', () => {
  useStorage(fakeStorage());
  const deck = createDeck('deck');
  deck.replaceAll([
    { surface: 'old', savedAt: 1000 },
    { surface: 'newest', savedAt: 3000 },
    { surface: 'mid', savedAt: 2000 },
  ]);
  assert.deepEqual(deck.all().map((e) => e.surface), ['newest', 'mid', 'old']);
  assert.equal(deck.count(), 3);
  deck.remove('mid');
  assert.deepEqual(createDeck('deck').all().map((e) => e.surface), ['newest', 'old']);
});

// ---- review log & streak ----------------------------------------------------

test('the log tallies per day and prunes beyond the retention window', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 7, 11, 12, 0, 0) });
  useStorage(fakeStorage());

  const log = createReviewLog('review-log', 3);
  log.record();
  log.record(4);
  assert.equal(log.today(), 5);

  log.replaceAll({ '2026-08-05': 1, '2026-08-06': 2, '2026-08-07': 3, '2026-08-08': 4 });
  assert.deepEqual(Object.keys(log.all()), ['2026-08-06', '2026-08-07', '2026-08-08'],
    'keepDays=3 drops the oldest');
});

test('the streak counts consecutive days ending today', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 7, 11, 12, 0, 0) });
  useStorage(fakeStorage());

  const log = createReviewLog('review-log');
  log.replaceAll({ '2026-08-09': 3, '2026-08-10': 5, '2026-08-11': 2 });
  assert.equal(log.streak(), 3);
});

test('a day with no reviews yet does not break the streak until it is over', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 7, 11, 9, 0, 0) });
  useStorage(fakeStorage());

  const log = createReviewLog('review-log');
  // Nothing today yet — the streak should still show yesterday's run, not 0,
  // or the counter resets every morning before you have studied.
  log.replaceAll({ '2026-08-09': 3, '2026-08-10': 5 });
  assert.equal(log.today(), 0);
  assert.equal(log.streak(), 2);

  // A real gap does break it: skipping the 10th leaves nothing to count.
  log.replaceAll({ '2026-08-08': 3, '2026-08-09': 5 });
  assert.equal(log.streak(), 0);
});

test('an empty log has no streak and no today', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 7, 11, 12, 0, 0) });
  useStorage(fakeStorage());
  const log = createReviewLog('review-log');
  assert.equal(log.streak(), 0);
  assert.equal(log.today(), 0);
  assert.deepEqual(log.all(), {});
});

// ---- achievement ledger ------------------------------------------------------

test('record persists a timestamp and never overwrites an already-earned id', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 7, 11, 12, 0, 0) });
  useStorage(fakeStorage());

  const log = createAchievementLog('achievements');
  assert.equal(log.record('kanji-10'), true, 'first record succeeds');
  const firstAt = log.all()['kanji-10'];
  assert.ok(firstAt > 0);

  t.mock.timers.tick(60_000);
  assert.equal(log.record('kanji-10'), false, 'already earned — a no-op');
  assert.equal(log.all()['kanji-10'], firstAt, 'the original timestamp is untouched');

  assert.deepEqual(createAchievementLog('achievements').all(), { 'kanji-10': firstAt }, 'persisted');
});

test('has, replaceAll, and clear behave like the other stores', () => {
  useStorage(fakeStorage());
  const log = createAchievementLog('achievements');
  assert.equal(log.has('kanji-10'), false);
  log.record('kanji-10', 1000);
  assert.equal(log.has('kanji-10'), true);

  log.replaceAll({ 'words-50': 2000 });
  assert.deepEqual(log.all(), { 'words-50': 2000 });
  assert.equal(log.has('kanji-10'), false, 'replaceAll swaps the whole ledger');

  log.clear();
  assert.deepEqual(log.all(), {});
  assert.deepEqual(createAchievementLog('achievements').all(), {});
});

// ---- the "never throws" promise --------------------------------------------

test('with localStorage unavailable, everything still works for the session', () => {
  useStorage(brokenStorage);

  const set = createKnownSet('known-words');
  const deck = createDeck('deck');
  const log = createReviewLog('review-log');

  // Reads failed at construction; every write below will throw internally too.
  assert.doesNotThrow(() => {
    set.toggle('本');
    set.replaceAll(['水']);
    deck.toggle({ surface: '本', gloss: 'book' });
    deck.update('本', { srs: { reps: 1 } });
    deck.replaceAll([{ surface: '水', savedAt: 1 }]);
    log.record();
    log.replaceAll({ '2026-08-11': 2 });
    log.streak();
    set.clear(); deck.clear(); log.clear();
  });

  // And it is genuinely usable in memory, not just silent.
  const set2 = createKnownSet('known-words');
  set2.toggle('日本');
  assert.ok(set2.has('日本'));
  assert.equal(set2.count(), 1);
});

test('corrupt stored JSON degrades to empty rather than breaking the app', () => {
  useStorage(fakeStorage({
    'kotoba-lab:known-words': 'not json {{{',
    'kotoba-lab:deck': '<html>oops</html>',
  }));
  assert.equal(createKnownSet('known-words').count(), 0);
  assert.equal(createDeck('deck').count(), 0);
});
