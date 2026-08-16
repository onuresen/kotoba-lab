// Pure summaries and category-level reset helpers for Profile & Data.
// This module never reads or writes storage; app.js lands approved changes.

import { cardOf, isNew } from './srs.js';

export const EMPTY_PROFILE = Object.freeze({
  deck: Object.freeze([]),
  knownWords: Object.freeze([]),
  knownKanji: Object.freeze([]),
  reviewLog: Object.freeze({}),
  achievements: Object.freeze({}),
});

function normalizedState(state = {}) {
  return {
    deck: Array.isArray(state.deck) ? state.deck : [],
    knownWords: Array.isArray(state.knownWords) ? state.knownWords : [],
    knownKanji: Array.isArray(state.knownKanji) ? state.knownKanji : [],
    reviewLog: state.reviewLog && typeof state.reviewLog === 'object' && !Array.isArray(state.reviewLog) ? state.reviewLog : {},
    achievements: state.achievements && typeof state.achievements === 'object' && !Array.isArray(state.achievements) ? state.achievements : {},
  };
}

export function buildProfileMetrics(state, now = Date.now()) {
  const clean = normalizedState(state);
  let newCards = 0;
  let dueCards = 0;
  let scheduledCards = 0;
  for (const entry of clean.deck) {
    const card = cardOf(entry);
    if (isNew(card)) newCards += 1;
    else if (card.due <= now) dueCards += 1;
    else scheduledCards += 1;
  }
  const reviewDays = Object.keys(clean.reviewLog).filter((day) => clean.reviewLog[day] > 0).sort();
  const reviewAnswers = reviewDays.reduce((sum, day) => sum + clean.reviewLog[day], 0);
  const bytes = new TextEncoder().encode(JSON.stringify(clean)).length;
  return {
    cards: clean.deck.length,
    newCards,
    dueCards,
    scheduledCards,
    knownWords: clean.knownWords.length,
    knownKanji: clean.knownKanji.length,
    reviewDays: reviewDays.length,
    reviewAnswers,
    lastReview: reviewDays.at(-1) || '',
    bytes,
  };
}

export function clearProfileCategory(state, category) {
  const clean = normalizedState(state);
  if (!Object.hasOwn(EMPTY_PROFILE, category)) return { ...clean };
  return {
    ...clean,
    [category]: Array.isArray(EMPTY_PROFILE[category]) ? [] : {},
  };
}

export function emptyProfileState() {
  return { deck: [], knownWords: [], knownKanji: [], reviewLog: {}, achievements: {} };
}
