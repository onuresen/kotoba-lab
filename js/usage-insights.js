// Pure interpretation of payload-free journal totals. These are cautious
// prompts, not diagnoses: no text, kanji, query, or per-action timeline exists.

const FEATURE_GROUPS = Object.freeze([
  { key: 'analyze', label: 'Analyze', glyph: '析', events: ['tab.analyze', 'analyze.run'] },
  { key: 'read', label: 'Read', glyph: '読', events: ['tab.read', 'known.change'] },
  { key: 'kanji', label: 'Kanji', glyph: '漢', events: ['tab.kanji', 'tree.open', 'study.family', 'study.pack'] },
  { key: 'relations', label: 'Relations', glyph: '縁', events: ['tab.relations', 'relations.open'] },
  { key: 'review', label: 'Review', glyph: '復', events: ['tab.review', 'review.answer'] },
  { key: 'data', label: 'Data', glyph: '守', events: ['tab.mywords', 'profile.export', 'pack.export', 'report.export'] },
]);

const countOf = (events, name) => Math.max(0, Number(events?.[name]) || 0);

export function buildUsageInsights(summary = {}, profile = {}) {
  const events = summary.events || {};
  const featureMix = FEATURE_GROUPS.map((feature) => ({
    ...feature,
    count: feature.events.reduce((sum, event) => sum + countOf(events, event), 0),
  }));
  const maxCount = Math.max(1, ...featureMix.map((feature) => feature.count));
  featureMix.forEach((feature) => { feature.strength = Math.round((feature.count / maxCount) * 100); });

  const totalActions = Math.max(0, Number(summary.eventCount) || 0);
  const sessions = Math.max(0, Number(summary.sessions) || 0);
  const activeMinutes = Math.max(0, Number(summary.activeMinutes) || 0);
  const enoughData = totalActions >= 8 || sessions >= 3;
  if (!enoughData) {
    return {
      enoughData,
      featureMix,
      signals: [{
        id: 'collecting', tone: 'quiet', title: 'Still learning your rhythm',
        body: 'A few more sessions will make the suggestions useful. Nothing needs fixing yet.',
      }],
    };
  }

  const signals = [];
  const reviews = countOf(events, 'review.answer');
  const dueCards = Math.max(0, Number(profile.dueCards) || 0);
  if (dueCards >= 3 && reviews === 0) {
    signals.push({
      id: 'review-ready', tone: 'attention', title: 'A review queue is waiting',
      body: `${dueCards.toLocaleString()} cards are due, while this journal window has no review answers yet.`,
      actionTab: 'review', actionLabel: 'Open Review',
    });
  }

  const analyses = countOf(events, 'analyze.run');
  const readVisits = countOf(events, 'tab.read');
  if (analyses >= 4 && readVisits * 3 < analyses) {
    signals.push({
      id: 'analysis-handoff', tone: 'gentle', title: 'Analysis may be the stopping point',
      body: 'Analyze is used repeatedly, but Read is opened much less often. Try carrying one text into reading mode.',
      actionTab: 'read', actionLabel: 'Continue in Read',
    });
  }

  const exploration = countOf(events, 'tree.open') + countOf(events, 'relations.open');
  const practice = countOf(events, 'study.family') + countOf(events, 'study.pack');
  if (exploration >= 6 && practice === 0) {
    signals.push({
      id: 'explore-to-study', tone: 'gentle', title: 'Exploration is not becoming practice yet',
      body: 'Radical Tree and Relations get attention, but no family or pack study session is recorded. One explored family could become a short drill.',
      actionTab: 'kanji', actionLabel: 'Choose a Kanji family',
    });
  }

  if (sessions >= 4 && activeMinutes / sessions < 2 && totalActions / sessions < 4) {
    signals.push({
      id: 'brief-sessions', tone: 'quiet', title: 'Sessions are staying brief',
      body: 'Kotoba Lab currently looks more like a quick-reference tool than a study workspace. That is useful too—only change it if you intended longer study.',
    });
  }

  if (!signals.length) {
    signals.push({
      id: 'clear-path', tone: 'positive', title: 'No strong friction pattern yet',
      body: 'Your recent feature mix does not show an obvious stalled handoff. Keep using the app naturally and let the pattern develop.',
    });
  }

  return { enoughData, featureMix, signals: signals.slice(0, 3) };
}
