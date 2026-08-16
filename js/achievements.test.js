import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_LEVELS, buildAchievements, evaluateNewlyUnlocked } from './achievements.js';

const stats = (over = {}) => ({
  knownKanji: 0, knownWords: 0, readableWords: 0, savedCards: 0, reviewDays: 0,
  reviewStreak: 0, wellRounded: false, ...over,
});

test('every achievement declares an id, label, threshold, xp, category, and reader', () => {
  assert.ok(ACHIEVEMENTS.length >= 20);
  for (const a of ACHIEVEMENTS) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.label, 'string');
    assert.ok(Number.isFinite(a.at) && a.at > 0, `${a.id} needs a positive threshold`);
    assert.ok(Number.isFinite(a.xp) && a.xp > 0, `${a.id} needs positive xp`);
    assert.equal(typeof a.category, 'string');
    assert.equal(typeof a.value, 'function');
  }
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length, 'ids must be unique');
});

test('level thresholds are strictly increasing and the top equals total achievable xp', () => {
  for (let i = 1; i < ACHIEVEMENT_LEVELS.length; i += 1) {
    assert.ok(ACHIEVEMENT_LEVELS[i].at > ACHIEVEMENT_LEVELS[i - 1].at, 'levels must strictly increase');
  }
  const totalXp = ACHIEVEMENTS.reduce((sum, a) => sum + a.xp, 0);
  assert.equal(ACHIEVEMENT_LEVELS.at(-1).at, totalXp);
});

test('a fresh profile has everything locked, at level 1, with zero xp', () => {
  const result = buildAchievements(stats(), {});
  assert.equal(result.unlocked.length, 0);
  assert.equal(result.locked.length, ACHIEVEMENTS.length);
  assert.equal(result.totalXp, 0);
  assert.equal(result.level, 1);
  assert.equal(result.levelTitle, ACHIEVEMENT_LEVELS[0].title);
});

test('a profile past every threshold unlocks everything at the top level', () => {
  const result = buildAchievements(stats({
    knownKanji: 999, knownWords: 999, readableWords: 999, savedCards: 999,
    reviewDays: 999, reviewStreak: 999, wellRounded: true,
  }), {});
  assert.equal(result.locked.length, 0);
  assert.equal(result.unlocked.length, ACHIEVEMENTS.length);
  assert.equal(result.level, ACHIEVEMENT_LEVELS.length);
  assert.equal(result.xpForNextLevel, 0, 'nothing left to earn at the top level');
});

test('unlocked entries are reported largest threshold first, locked smallest first', () => {
  const result = buildAchievements(stats({ knownKanji: 120 }), {});
  const kanjiUnlocked = result.unlocked.filter((a) => a.category === 'kanji').map((a) => a.id);
  assert.deepEqual(kanjiUnlocked, ['kanji-100', 'kanji-50', 'kanji-10', 'kanji-1']);
  const kanjiLocked = result.locked.filter((a) => a.category === 'kanji').map((a) => a.id);
  assert.deepEqual(kanjiLocked, ['kanji-250', 'kanji-500']);
});

test('an id already in the unlocked ledger stays unlocked even if the live stat regressed', () => {
  const result = buildAchievements(stats({ knownKanji: 0 }), ['kanji-10']);
  assert.ok(result.unlocked.some((a) => a.id === 'kanji-10'), 'earned stays earned');
});

test('the well-rounded achievement reads the precomputed boolean, not the raw counts', () => {
  const almost = buildAchievements(stats({ knownKanji: 5, knownWords: 5, savedCards: 5, reviewDays: 0, wellRounded: false }), {});
  assert.ok(almost.locked.some((a) => a.id === 'allround-1'));
  const complete = buildAchievements(stats({ wellRounded: true }), {});
  assert.ok(complete.unlocked.some((a) => a.id === 'allround-1'));
});

test('streak achievements read reviewStreak, independent of reviewDays', () => {
  const result = buildAchievements(stats({ reviewDays: 30, reviewStreak: 0 }), {});
  assert.ok(result.unlocked.some((a) => a.id === 'review-30'));
  assert.ok(result.locked.some((a) => a.id === 'streak-3'), 'many non-consecutive days do not imply a streak');
});

test('evaluateNewlyUnlocked returns only ids true now but not already recorded', () => {
  const found = evaluateNewlyUnlocked(stats({ knownKanji: 15 }), ['kanji-1']);
  assert.deepEqual(found.sort(), ['kanji-10']);
});

test('evaluateNewlyUnlocked returns nothing once everything true is already recorded', () => {
  const found = evaluateNewlyUnlocked(stats({ knownKanji: 15 }), ['kanji-1', 'kanji-10']);
  assert.deepEqual(found, []);
});

test('malformed or missing stats degrade to nothing rather than throwing', () => {
  assert.deepEqual(evaluateNewlyUnlocked(null, []), []);
  assert.deepEqual(evaluateNewlyUnlocked({}, []), []);
  const result = buildAchievements(null, null);
  assert.equal(result.unlocked.length, 0);
  assert.equal(result.locked.length, ACHIEVEMENTS.length);
  assert.equal(result.level, 1);
});
