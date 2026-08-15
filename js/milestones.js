// milestones.js — what the learner can now do, derived from the four profile
// stores and never recorded.
//
// Deliberately not an achievements system. There is no ledger, no timestamp, no
// badge state: every milestone is recomputed from current numbers, so nothing
// can drift, nothing needs migrating, and no sixth storage key exists. Only
// milestones already passed are reported, plus at most one nearby next step.
//
// Pure: no DOM, no storage, no fetch.

// Thresholds describe real reading capability, not effort spent. Keep the list
// short: a long list reads as a checklist of things undone.
export const MILESTONES = Object.freeze([
  { id: 'kanji-10', label: '10 kanji known', at: 10, value: (s) => s.knownKanji },
  { id: 'kanji-50', label: '50 kanji known', at: 50, value: (s) => s.knownKanji },
  { id: 'kanji-100', label: '100 kanji known', at: 100, value: (s) => s.knownKanji },
  { id: 'kanji-250', label: '250 kanji known', at: 250, value: (s) => s.knownKanji },
  { id: 'kanji-500', label: '500 kanji known', at: 500, value: (s) => s.knownKanji },
  { id: 'readable-25', label: '25 words readable', at: 25, value: (s) => s.readableWords },
  { id: 'readable-100', label: '100 words readable', at: 100, value: (s) => s.readableWords },
  { id: 'readable-500', label: '500 words readable', at: 500, value: (s) => s.readableWords },
  { id: 'words-50', label: '50 words known', at: 50, value: (s) => s.knownWords },
  { id: 'words-200', label: '200 words known', at: 200, value: (s) => s.knownWords },
  { id: 'cards-50', label: '50 cards saved', at: 50, value: (s) => s.savedCards },
  { id: 'review-30', label: '30 days reviewed', at: 30, value: (s) => s.reviewDays },
]);

// A next milestone is mentioned only inside this fraction of its threshold.
// Further away it stops being encouragement and becomes a chore list.
const CLOSENESS = 0.25;

function readable(stats, milestone) {
  const value = milestone.value(stats);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function buildMilestones(stats) {
  if (!stats || typeof stats !== 'object') return { passed: [], next: null };

  const passed = [];
  let next = null;

  for (const milestone of MILESTONES) {
    const value = readable(stats, milestone);
    if (value === null) continue;
    if (value >= milestone.at) {
      passed.push({ id: milestone.id, label: milestone.label, at: milestone.at });
      continue;
    }
    const remaining = milestone.at - value;
    if (remaining > milestone.at * CLOSENESS) continue;
    // Keep the single nearest target so the strip never becomes a to-do list.
    if (!next || remaining < next.remaining) {
      next = { id: milestone.id, label: milestone.label, at: milestone.at, remaining };
    }
  }

  passed.sort((a, b) => b.at - a.at);
  return { passed, next };
}
