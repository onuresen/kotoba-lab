// study-weather.js — a calm, one-line read of today's study conditions,
// expressed as weather instead of a streak counter or a due-count warning.
// This is the first bounded experiment for the "Japanese Weather System" idea
// in IDEA_GARDEN.md: real usage showed cards sitting overdue with no gentle
// way back in, so this reframes the same numbers the Review tab already
// shows — never a new stat, never a guilt-heavy "you broke your streak".
//
// Pure: no DOM, no storage, no fetch, no Date — the caller supplies every
// number, so this stays trivially testable and can never disagree with the
// due/fresh/streak figures already rendered elsewhere in the Review tab.

const FOG_DAYS = 5; // days without a review before "it's been a while" outranks the count

// stats: { due, fresh, total, streak, daysSinceReview }. daysSinceReview is
// null/undefined when no review has ever been recorded.
export function forecast(stats) {
  const s = stats && typeof stats === 'object' ? stats : {};
  const due = Number.isFinite(s.due) ? s.due : 0;
  const fresh = Number.isFinite(s.fresh) ? s.fresh : 0;
  const total = Number.isFinite(s.total) ? s.total : 0;
  const streak = Number.isFinite(s.streak) ? s.streak : 0;
  const gap = s.daysSinceReview;
  const waiting = due + fresh;

  if (total === 0) {
    return {
      icon: '🌱',
      headline: 'Clear ground',
      detail: 'Nothing saved yet — save a word from the Read tab to get your first forecast.',
    };
  }

  const longGap = gap == null || (Number.isFinite(gap) && gap >= FOG_DAYS);
  if (longGap && waiting > 0) {
    const away = Number.isFinite(gap) ? `${gap} day${gap === 1 ? '' : 's'}` : 'a while';
    return {
      icon: '🌫️',
      headline: 'A little foggy',
      detail: `It's been ${away} since your last review. No rush — just the first card clears it.`,
    };
  }

  if (waiting === 0) {
    return {
      icon: '☀️',
      headline: 'Clear skies',
      detail: streak > 1 ? `All caught up — ${streak}-day streak.` : 'All caught up — nothing due right now.',
    };
  }

  if (waiting >= 15) {
    return {
      icon: '⛈️',
      headline: 'Steady rain',
      detail: `${waiting} cards are ready whenever you are — no need to clear them all at once.`,
    };
  }

  return {
    icon: '🌦️',
    headline: 'Light showers',
    detail: `${waiting} card${waiting === 1 ? '' : 's'} ready whenever you are.`,
  };
}
