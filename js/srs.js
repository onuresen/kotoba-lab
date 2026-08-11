// srs.js — spaced repetition scheduling (SM-2 lite), pure functions, no DOM.
// Every card carries its own state; nothing here reads or writes storage, so
// the whole schedule is testable by calling schedule() with a fixed `now`.
//
// Card shape: { due, interval, ease, reps, lapses, step, reviewedAt }
//   due        ms timestamp — when this card next wants to be seen
//   interval   DAYS between reviews; 0 means "still in learning steps"
//   ease       SM-2 ease factor, floored at 1.3
//   step       index into LEARN_STEPS_MIN while interval === 0
//   reps       total answers; 0 = never studied ("new")
//   lapses     times a graduated card was failed

const MIN = 60_000;
const DAY = 86_400_000;

const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;

// Minutes between the two learning steps a new card walks before graduating.
export const LEARN_STEPS_MIN = [1, 10];

// A learning card due within this window still counts as reviewable, so a
// 1-minute step comes back inside the same sitting instead of ending it.
// (Anki calls this the learn-ahead limit.)
export const LEARN_AHEAD_MS = 20 * MIN;

export const GRADES = ['again', 'hard', 'good', 'easy'];
export const GRADE_LABELS = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

export function newCard(now = Date.now()) {
  return { due: now, interval: 0, ease: START_EASE, reps: 0, lapses: 0, step: 0, reviewedAt: null };
}

// The card for a deck entry — deck entries saved before v5 have no `srs`, so
// they fall back to a new card due at their save time (i.e. ready now).
export function cardOf(entry, now = Date.now()) {
  return entry.srs || newCard(entry.savedAt ?? now);
}

export const isNew = (card) => card.reps === 0;
export const isLearning = (card) => card.interval === 0 && card.reps > 0;

export function isReady(card, now = Date.now()) {
  if (card.due <= now) return true;
  return card.interval === 0 && card.due <= now + LEARN_AHEAD_MS;
}

const clampDays = (d) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(d)));

// Grade a card and return the NEXT card state. Never mutates its argument.
export function schedule(card, grade, now = Date.now()) {
  const c = { ...card };
  const learning = c.interval === 0;

  if (grade === 'again') {
    // A graduated card that fails loses ease and drops back into learning.
    if (!learning) {
      c.lapses += 1;
      c.ease = Math.max(MIN_EASE, c.ease - 0.2);
    }
    c.interval = 0;
    c.step = 0;
    c.due = now + LEARN_STEPS_MIN[0] * MIN;
  } else if (learning) {
    if (grade === 'easy') {
      c.interval = 4; // skip the remaining steps entirely
      c.step = 0;
      c.due = now + 4 * DAY;
    } else if (grade === 'hard') {
      c.due = now + LEARN_STEPS_MIN[Math.min(c.step, LEARN_STEPS_MIN.length - 1)] * MIN;
    } else {
      const next = c.step + 1;
      if (next >= LEARN_STEPS_MIN.length) {
        c.interval = 1; // graduated
        c.step = 0;
        c.due = now + DAY;
      } else {
        c.step = next;
        c.due = now + LEARN_STEPS_MIN[next] * MIN;
      }
    }
  } else {
    if (grade === 'hard') {
      c.ease = Math.max(MIN_EASE, c.ease - 0.15);
      c.interval = clampDays(c.interval * 1.2);
    } else if (grade === 'good') {
      c.interval = clampDays(c.interval * c.ease);
    } else {
      c.ease = c.ease + 0.15;
      c.interval = clampDays(c.interval * c.ease * 1.3);
    }
    c.due = now + c.interval * DAY;
  }

  c.reps += 1;
  c.reviewedAt = now;
  return c;
}

// "how long until" as a short human string — used on the grade buttons so the
// cost of each answer is visible before it is given.
// Each unit is chosen from its OWN rounded value, so a card 23h59m out reads
// "1d" rather than the "24h" you get from comparing against raw thresholds.
export function formatWait(ms) {
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / MIN);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(ms / (60 * MIN));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days}d`;
  const months = Math.round(ms / (30 * DAY));
  if (months < 12) return `${months}mo`;
  return `${(ms / (365 * DAY)).toFixed(1)}y`;
}

// What the user is committing to by pressing a grade button.
export function preview(card, grade, now = Date.now()) {
  return formatWait(schedule(card, grade, now).due - now);
}

// Build the session queue, in three bands:
//   1. genuinely due cards (oldest first)
//   2. new cards, capped by `newLimit`
//   3. learning cards pulled in early by the learn-ahead window
// Band 3 goes LAST on purpose: a card you just failed is due in a minute, so
// sorting purely by due date would hand it straight back to you. Deferring
// not-yet-due cards behind everything else is what puts real spacing between
// a lapse and its retry.
// `lastAnswered` (a surface) is rotated to the back if it would otherwise come
// straight back — the banding above isn't enough on its own, because once every
// card is in learn-ahead the one you just failed is also the soonest due.
export function buildQueue(entries, { now = Date.now(), newLimit = 20, lastAnswered = null } = {}) {
  const byDue = (a, b) => a.card.due - b.card.due;
  const ready = entries
    .map((entry) => ({ entry, card: cardOf(entry, now) }))
    .filter(({ card }) => isReady(card, now));
  const due = ready.filter(({ card }) => !isNew(card) && card.due <= now).sort(byDue);
  const fresh = ready.filter(({ card }) => isNew(card)).sort(byDue).slice(0, newLimit);
  const ahead = ready.filter(({ card }) => !isNew(card) && card.due > now).sort(byDue);
  const queue = [...due, ...fresh, ...ahead];
  if (lastAnswered && queue.length > 1 && queue[0].entry.surface === lastAnswered) {
    return [...queue.slice(1), queue[0]];
  }
  return queue;
}

// Headline counts for the Review tab.
export function queueStats(entries, { now = Date.now() } = {}) {
  let due = 0, fresh = 0, learning = 0, next = Infinity;
  for (const entry of entries) {
    const card = cardOf(entry, now);
    if (isReady(card, now)) {
      if (isNew(card)) fresh += 1;
      else { due += 1; if (isLearning(card)) learning += 1; }
    } else if (card.due < next) {
      next = card.due;
    }
  }
  return { due, fresh, learning, total: entries.length, nextDue: next === Infinity ? null : next };
}
