// achievements.js — the learner's earned achievement set: XP, levels, streaks,
// and locked/unlocked badges, derived from the four profile stores plus a
// persisted unlock ledger (see storage.js's createAchievementLog).
//
// Unlike milestones.js, which this replaces, unlock state IS recorded: once an
// achievement is true it stays counted even if the underlying stat later drops
// (un-marking a kanji doesn't un-earn "100 kanji known"). This module only
// decides what's currently true and what XP/level that adds up to — the
// persisted timestamps live in storage.js and app.js, not here.
//
// Pure: no DOM, no storage, no fetch.

// Real actions only. Every threshold reads a stat every learner has
// unconditionally (deck, known words, known kanji, review log) — never the
// opt-in usage journal, so achievements stay fair regardless of privacy
// settings.
export const ACHIEVEMENTS = Object.freeze([
  // Kanji known
  { id: 'kanji-1', label: '1 kanji known', at: 1, xp: 25, category: 'kanji', value: (s) => s.knownKanji },
  { id: 'kanji-10', label: '10 kanji known', at: 10, xp: 50, category: 'kanji', value: (s) => s.knownKanji },
  { id: 'kanji-50', label: '50 kanji known', at: 50, xp: 100, category: 'kanji', value: (s) => s.knownKanji },
  { id: 'kanji-100', label: '100 kanji known', at: 100, xp: 150, category: 'kanji', value: (s) => s.knownKanji },
  { id: 'kanji-250', label: '250 kanji known', at: 250, xp: 250, category: 'kanji', value: (s) => s.knownKanji },
  { id: 'kanji-500', label: '500 kanji known', at: 500, xp: 400, category: 'kanji', value: (s) => s.knownKanji },

  // Words readable
  { id: 'readable-1', label: '1 word readable', at: 1, xp: 25, category: 'readable', value: (s) => s.readableWords },
  { id: 'readable-25', label: '25 words readable', at: 25, xp: 50, category: 'readable', value: (s) => s.readableWords },
  { id: 'readable-100', label: '100 words readable', at: 100, xp: 150, category: 'readable', value: (s) => s.readableWords },
  { id: 'readable-500', label: '500 words readable', at: 500, xp: 400, category: 'readable', value: (s) => s.readableWords },

  // Words known
  { id: 'words-1', label: '1 word known', at: 1, xp: 25, category: 'words', value: (s) => s.knownWords },
  { id: 'words-50', label: '50 words known', at: 50, xp: 100, category: 'words', value: (s) => s.knownWords },
  { id: 'words-200', label: '200 words known', at: 200, xp: 250, category: 'words', value: (s) => s.knownWords },

  // Cards saved
  { id: 'cards-1', label: '1 card saved', at: 1, xp: 25, category: 'cards', value: (s) => s.savedCards },
  { id: 'cards-10', label: '10 cards saved', at: 10, xp: 50, category: 'cards', value: (s) => s.savedCards },
  { id: 'cards-50', label: '50 cards saved', at: 50, xp: 100, category: 'cards', value: (s) => s.savedCards },
  { id: 'cards-200', label: '200 cards saved', at: 200, xp: 250, category: 'cards', value: (s) => s.savedCards },

  // Review days
  { id: 'review-1', label: '1 day reviewed', at: 1, xp: 25, category: 'review', value: (s) => s.reviewDays },
  { id: 'review-7', label: '7 days reviewed', at: 7, xp: 75, category: 'review', value: (s) => s.reviewDays },
  { id: 'review-30', label: '30 days reviewed', at: 30, xp: 200, category: 'review', value: (s) => s.reviewDays },

  // Review streak — consecutive days, not just total days
  { id: 'streak-3', label: '3-day review streak', at: 3, xp: 50, category: 'streak', value: (s) => s.reviewStreak },
  { id: 'streak-7', label: '7-day review streak', at: 7, xp: 125, category: 'streak', value: (s) => s.reviewStreak },
  { id: 'streak-30', label: '30-day review streak', at: 30, xp: 400, category: 'streak', value: (s) => s.reviewStreak },

  // Well-rounded: some real progress in every kind of study at once
  { id: 'allround-1', label: 'Well-rounded learner', at: 1, xp: 200, category: 'allround', value: (s) => (s.wellRounded ? 1 : 0) },
]);

// Cumulative XP thresholds. The last equals the sum of every achievement's XP,
// so the top title is reachable only by genuinely earning everything — no
// grind manufactured beyond what the achievements themselves already require.
export const ACHIEVEMENT_LEVELS = Object.freeze([
  { title: '白紙', at: 0 },     // Blank Page
  { title: '見習い', at: 100 },   // Apprentice
  { title: '学徒', at: 250 },   // Student
  { title: '探究者', at: 500 },   // Explorer
  { title: '熟練者', at: 900 },   // Adept
  { title: '達人', at: 1500 },  // Expert
  { title: '名人', at: 2300 },  // Master
  { title: '皆伝', at: 3475 },  // Full Transmission
]);

function readable(stats, achievement) {
  const value = achievement.value(stats);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function isUnlocked(stats, achievement) {
  const value = readable(stats, achievement);
  return value !== null && value >= achievement.at;
}

function toIdSet(unlockedIds) {
  if (unlockedIds instanceof Set) return unlockedIds;
  if (Array.isArray(unlockedIds)) return new Set(unlockedIds);
  if (unlockedIds && typeof unlockedIds === 'object') return new Set(Object.keys(unlockedIds));
  return new Set();
}

// Ids that are true right now but not yet in `alreadyUnlockedIds` — what the
// caller should persist (with a timestamp) and celebrate this render.
export function evaluateNewlyUnlocked(stats, alreadyUnlockedIds) {
  if (!stats || typeof stats !== 'object') return [];
  const already = toIdSet(alreadyUnlockedIds);
  const found = [];
  for (const a of ACHIEVEMENTS) {
    if (already.has(a.id)) continue;
    if (isUnlocked(stats, a)) found.push(a.id);
  }
  return found;
}

function levelFor(totalXp) {
  let level = 1;
  for (let i = 0; i < ACHIEVEMENT_LEVELS.length; i += 1) {
    if (totalXp >= ACHIEVEMENT_LEVELS[i].at) level = i + 1;
  }
  return level;
}

// `unlockedIds` should already include every id evaluateNewlyUnlocked just
// found (the caller persists those first) — the live isUnlocked() check below
// is only a safety net for callers that don't pre-persist, e.g. tests.
export function buildAchievements(stats, unlockedIds) {
  const safeStats = stats && typeof stats === 'object' ? stats : {};
  const unlockedSet = toIdSet(unlockedIds);

  const unlocked = [];
  const locked = [];
  let totalXp = 0;

  for (const a of ACHIEVEMENTS) {
    const entry = { id: a.id, label: a.label, category: a.category, at: a.at, xp: a.xp };
    if (unlockedSet.has(a.id) || isUnlocked(safeStats, a)) {
      unlocked.push(entry);
      totalXp += a.xp;
    } else {
      locked.push(entry);
    }
  }

  unlocked.sort((a, b) => b.at - a.at);
  locked.sort((a, b) => a.at - b.at);

  const level = levelFor(totalXp);
  const currentAt = ACHIEVEMENT_LEVELS[level - 1].at;
  const nextAt = ACHIEVEMENT_LEVELS[level] ? ACHIEVEMENT_LEVELS[level].at : currentAt;

  return {
    unlocked,
    locked,
    totalXp,
    level,
    levelTitle: ACHIEVEMENT_LEVELS[level - 1].title,
    xpIntoLevel: totalXp - currentAt,
    xpForNextLevel: nextAt - currentAt,
  };
}
