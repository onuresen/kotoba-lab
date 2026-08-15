import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageJournal, USAGE_STORAGE_KEY } from './usage-journal.js';

function fakeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key),
  };
}

const NOW = Date.UTC(2026, 7, 14, 9);

test('the journal is off by default and records no events until explicitly enabled', () => {
  const storage = fakeStorage();
  const journal = createUsageJournal({ storage, now: () => NOW });
  assert.equal(journal.isEnabled(), false);
  assert.equal(journal.record('tab.read'), false);
  assert.equal(journal.tickActiveMinute(), false);
  assert.equal(storage.value(USAGE_STORAGE_KEY), undefined);
});

test('enabled journals count sessions, approved events, and visible active minutes', () => {
  const storage = fakeStorage();
  const journal = createUsageJournal({ storage, now: () => NOW });
  journal.setEnabled(true);
  journal.startSession();
  journal.record('tab.read');
  journal.record('tree.open');
  journal.tickActiveMinute();
  assert.deepEqual(journal.summary(), {
    enabled: true, days: 1, sessions: 1, activeMinutes: 1, eventCount: 2,
    events: { 'tab.read': 1, 'tree.open': 1 },
    today: { sessions: 1, activeMinutes: 1, eventCount: 2 },
  });
});

test('arbitrary event names and payload-like strings are rejected', () => {
  const journal = createUsageJournal({ storage: fakeStorage(), now: () => NOW });
  journal.setEnabled(true);
  assert.equal(journal.record('search.日本語'), false);
  assert.equal(journal.record('kanji.学'), false);
  assert.equal(journal.summary().eventCount, 0);
});

test('the fixed report export event is allowed without accepting report content', () => {
  const journal = createUsageJournal({ storage: fakeStorage(), now: () => NOW });
  journal.setEnabled(true);
  assert.equal(journal.record('report.export'), true);
  assert.equal(journal.record('report.export.secret'), false);
  assert.deepEqual(journal.summary().events, { 'report.export': 1 });
});

test('Atlas events are fixed coarse counters and reject embedded study details', () => {
  const journal = createUsageJournal({ storage: fakeStorage(), now: () => NOW });
  journal.setEnabled(true);
  assert.equal(journal.record('atlas.open'), true);
  assert.equal(journal.record('study.atlas'), true);
  assert.equal(journal.record('study.atlas.青'), false);
  assert.deepEqual(journal.summary().events, { 'atlas.open': 1, 'study.atlas': 1 });
});

test('state survives reload, can pause without deletion, and can be reset', () => {
  const storage = fakeStorage();
  const first = createUsageJournal({ storage, now: () => NOW });
  first.setEnabled(true);
  first.record('review.answer');
  first.setEnabled(false);
  const second = createUsageJournal({ storage, now: () => NOW });
  assert.equal(second.isEnabled(), false);
  assert.equal(second.summary().eventCount, 1);
  second.clear();
  assert.equal(second.summary().eventCount, 0);
  assert.equal(second.isEnabled(), false);
});

test('corrupt or unknown stored fields are sanitized instead of escaping the allowlist', () => {
  const storage = fakeStorage({
    [USAGE_STORAGE_KEY]: JSON.stringify({ enabled: true, days: { '2026-08-14': { sessions: 2, activeMinutes: 3, events: { 'tab.kanji': 4, 'query.secret': 99 } } } }),
  });
  const journal = createUsageJournal({ storage, now: () => NOW });
  assert.deepEqual(journal.summary().events, { 'tab.kanji': 4 });
});

test('daily totals are bounded to the newest ninety days', () => {
  let time = NOW;
  const journal = createUsageJournal({ storage: fakeStorage(), now: () => time });
  journal.setEnabled(true);
  for (let day = 0; day < 92; day += 1) {
    journal.record('tab.read');
    time += 86_400_000;
  }
  assert.equal(Object.keys(journal.all().days).length, 90);
  assert.equal(journal.summary().eventCount, 90);
});
