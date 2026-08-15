// Human-readable, deliberately lossy report for sharing product-usage context.
// It accepts aggregates only and whitelists every label that can reach output.

const FEATURE_LABELS = Object.freeze({
  analyze: 'Analyze', read: 'Read', kanji: 'Kanji', relations: 'Relations', review: 'Review', data: 'Data',
});

const SIGNAL_COPY = Object.freeze({
  collecting: ['Still learning your rhythm', 'More ordinary use is needed before the pattern is meaningful.'],
  'review-ready': ['A review queue is waiting', 'Due cards exist, but no review answers appear in the journal window.'],
  'analysis-handoff': ['Analysis may be the stopping point', 'Analyze is used much more often than Read.'],
  'explore-to-study': ['Exploration is not becoming practice yet', 'Tree, relationship, and Atlas exploration has not yet led into a family, pack, or constellation study session.'],
  'brief-sessions': ['Sessions are staying brief', 'Recent use resembles quick reference more than longer study.'],
  'clear-path': ['No strong friction pattern yet', 'The aggregate feature mix does not show an obvious stalled handoff.'],
});

const whole = (value) => Math.max(0, Math.round(Number(value) || 0));
const safeVersion = (value) => String(value || 'unknown').replace(/[^0-9A-Za-z._-]/g, '').slice(0, 24) || 'unknown';

export function usageReportFilename(generatedAt = Date.now()) {
  const date = new Date(generatedAt);
  const day = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `kotoba-lab-usage-report-${day}.md`;
}

export function buildUsageReport({ summary = {}, insights = {}, profile = {}, generatedAt = Date.now(), appVersion = 'unknown' } = {}) {
  const date = new Date(generatedAt);
  const generated = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toISOString().slice(0, 10);
  const featureRows = Object.entries(FEATURE_LABELS).map(([key, label]) => {
    const match = Array.isArray(insights.featureMix) ? insights.featureMix.find((feature) => feature?.key === key) : null;
    return `| ${label} | ${whole(match?.count).toLocaleString('en-US')} |`;
  });
  const signalRows = (Array.isArray(insights.signals) ? insights.signals : [])
    .map((signal) => SIGNAL_COPY[signal?.id])
    .filter(Boolean)
    .slice(0, 3)
    .map(([title, body]) => `- **${title}** — ${body}`);

  return [
    '# Kotoba Lab Usage Report',
    '',
    `Generated: ${generated}`,
    `App version: ${safeVersion(appVersion)}`,
    `Journal state: ${summary.enabled === true ? 'enabled' : 'paused'}`,
    '',
    '## Activity window',
    '',
    `- Logged days: ${whole(summary.days).toLocaleString('en-US')} (maximum 90)`,
    `- Sessions: ${whole(summary.sessions).toLocaleString('en-US')}`,
    `- Visible active minutes: ${whole(summary.activeMinutes).toLocaleString('en-US')}`,
    `- Coarse actions: ${whole(summary.eventCount).toLocaleString('en-US')}`,
    '',
    '## Feature rhythm',
    '',
    '| Area | Coarse actions |',
    '| --- | ---: |',
    ...featureRows,
    '',
    '## Current study-profile totals',
    '',
    `- Saved cards: ${whole(profile.cards).toLocaleString('en-US')} (${whole(profile.newCards)} new, ${whole(profile.dueCards)} due, ${whole(profile.scheduledCards)} scheduled)`,
    `- Known words: ${whole(profile.knownWords).toLocaleString('en-US')}`,
    `- Known kanji: ${whole(profile.knownKanji).toLocaleString('en-US')}`,
    `- Review activity: ${whole(profile.reviewAnswers).toLocaleString('en-US')} answers across ${whole(profile.reviewDays).toLocaleString('en-US')} days`,
    '',
    '## Local friction radar',
    '',
    ...(signalRows.length ? signalRows : ['- No recognized aggregate signal is available yet.']),
    '',
    '## Privacy boundary',
    '',
    'This report contains aggregate counts and fixed suggestion labels only. It intentionally excludes pasted text, words, kanji, searches, filenames, saved sentences, answers, grades, raw event names, daily dates, and individual-action timestamps.',
    '',
    'Generated locally by Kotoba Lab. Nothing was uploaded by the app.',
    '',
  ].join('\n');
}
