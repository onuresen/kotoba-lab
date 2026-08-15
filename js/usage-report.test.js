import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUsageReport, usageReportFilename } from './usage-report.js';

const input = {
  summary: { enabled: true, days: 4, sessions: 6, activeMinutes: 42, eventCount: 28, events: { 'search.秘密': 99 } },
  insights: {
    featureMix: [
      { key: 'analyze', label: 'Injected label', count: 8 },
      { key: 'read', count: 5 },
      { key: 'mystery', count: 999 },
    ],
    signals: [{ id: 'analysis-handoff', title: 'Injected title', body: '秘密の本文' }],
  },
  profile: { cards: 12, newCards: 3, dueCards: 4, scheduledCards: 5, knownWords: 20, knownKanji: 30, reviewAnswers: 18, reviewDays: 3 },
  generatedAt: Date.UTC(2026, 7, 14, 9),
  appVersion: '10.11.0',
};

test('report is a readable aggregate Markdown snapshot', () => {
  const report = buildUsageReport(input);
  assert.match(report, /# Kotoba Lab Usage Report/);
  assert.match(report, /Generated: 2026-08-14/);
  assert.match(report, /\| Analyze \| 8 \|/);
  assert.match(report, /Saved cards: 12 \(3 new, 4 due, 5 scheduled\)/);
  assert.match(report, /Analysis may be the stopping point/);
});

test('unknown fields and caller-provided prose cannot leak into the report', () => {
  const report = buildUsageReport(input);
  for (const forbidden of ['search.秘密', 'Injected label', 'Injected title', '秘密の本文', 'mystery', '999']) {
    assert.equal(report.includes(forbidden), false);
  }
  assert.match(report, /intentionally excludes pasted text/);
});

test('malformed and negative counts become safe zeroes', () => {
  const report = buildUsageReport({ summary: { sessions: -3, eventCount: 'secret' }, profile: { cards: -8 } });
  assert.match(report, /Sessions: 0/);
  assert.match(report, /Coarse actions: 0/);
  assert.match(report, /Saved cards: 0/);
});

test('report filename is stable and date-only', () => {
  assert.equal(usageReportFilename(input.generatedAt), 'kotoba-lab-usage-report-2026-08-14.md');
  assert.equal(usageReportFilename('not-a-date'), 'kotoba-lab-usage-report-undated.md');
});

test('the fixed exploration signal copy includes the Atlas study handoff', () => {
  const report = buildUsageReport({ insights: { signals: [{ id: 'explore-to-study' }] } });
  assert.match(report, /Atlas exploration/);
  assert.match(report, /constellation study session/);
});
