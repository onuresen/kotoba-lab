// backup.test.js — run with: node --test js/
//
// backup.js is pure, so the merge rules can be checked directly with a fixed
// clock. These tests exist because the failure mode they guard is silent: a
// bad merge doesn't throw, it just quietly loses a schedule you can't rebuild.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBackup, serializeBackup, parseBackup, inspectBackup, backupSummary, backupFilename, mergeState, describeMerge,
  BACKUP_FORMAT, BACKUP_VERSION,
} from './backup.js';

const T0 = Date.UTC(2026, 0, 15, 9, 0, 0);
const DAY = 86_400_000;

const card = (over = {}) => ({ due: T0, interval: 1, ease: 2.5, reps: 1, lapses: 0, step: 0, reviewedAt: T0, ...over });
const entry = (surface, over = {}) => ({
  surface, reading: 'よみ', gloss: 'meaning', level: 3, savedAt: T0, srs: card(), ...over,
});
const state = (over = {}) => ({
  deck: [], knownWords: [], knownKanji: [], favoriteKanji: [], favoriteWords: [],
  reviewLog: {}, achievements: {}, ...over,
});

// ---- export -----------------------------------------------------------------

test('backup carries the srs card that TSV export drops', () => {
  const out = buildBackup(state({ deck: [entry('専門家')] }), T0, { appVersion: '10.7.0' });
  assert.equal(out.format, BACKUP_FORMAT);
  assert.equal(out.version, BACKUP_VERSION);
  assert.equal(out.appVersion, '10.7.0');
  assert.deepEqual(out.summary, { cards: 1, knownWords: 0, knownKanji: 0, favorites: 0, reviewDays: 0 });
  assert.deepEqual(out.deck[0].srs, card());
});

test('profile metadata is inspectable without changing the parsed state shape', () => {
  const original = state({ deck: [entry('本')], knownKanji: ['本'], reviewLog: { '2026-01-15': 2 } });
  const inspected = inspectBackup(serializeBackup(original, T0, { appVersion: '10.7.0' }));
  assert.deepEqual(inspected.state, original);
  assert.deepEqual(inspected.meta, {
    version: BACKUP_VERSION,
    appVersion: '10.7.0',
    exportedAt: new Date(T0).toISOString(),
    summary: { cards: 1, knownWords: 0, knownKanji: 1, favorites: 0, reviewDays: 1 },
  });
  assert.deepEqual(backupSummary(original), inspected.meta.summary);
  assert.match(backupFilename(T0), /^kotoba-lab-profile-\d{4}-\d{2}-\d{2}\.json$/);
});

test('legacy v1 profiles remain readable and history-only profiles are not discarded', () => {
  const legacy = inspectBackup(JSON.stringify({
    format: BACKUP_FORMAT, version: 1, exportedAt: new Date(T0).toISOString(), reviewLog: { '2026-01-15': 4 },
  }));
  assert.equal(legacy.meta.version, 1);
  assert.equal(legacy.meta.appVersion, '');
  assert.deepEqual(legacy.state.reviewLog, { '2026-01-15': 4 });
});

test('export → parse is a faithful round trip', () => {
  const original = state({
    deck: [
      entry('本'),
      entry('水', { srs: card({ reps: 9, interval: 21 }) }),
      entry('専門', { sentence: 'これは専門の話です。', sentenceStart: 3, sentenceEnd: 5 }),
    ],
    knownWords: ['私', '日本'],
    knownKanji: ['一', '二'],
    reviewLog: { '2026-01-14': 12, '2026-01-15': 3 },
  });
  const back = parseBackup(serializeBackup(original, T0));
  assert.deepEqual(back, original);
});

test('the saved sentence and its offsets survive a backup', () => {
  const original = state({ deck: [entry('専門', { sentence: 'これは専門の話です。', sentenceStart: 3, sentenceEnd: 5 })] });
  const [restored] = parseBackup(serializeBackup(original, T0)).deck;
  assert.equal(restored.sentence, 'これは専門の話です。');
  assert.equal(restored.sentence.slice(restored.sentenceStart, restored.sentenceEnd), '専門',
    'the offsets still point at the word after the round trip');
});

test('offsets that do not fit their sentence are dropped, not carried', () => {
  const parsed = parseBackup(JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    deck: [
      { surface: '本', savedAt: T0, sentence: '本です。', sentenceStart: 40, sentenceEnd: 99 },
      { surface: '水', savedAt: T0, sentence: '水だ。', sentenceStart: 2, sentenceEnd: 1 },
      { surface: '専門', savedAt: T0, sentence: '', sentenceStart: 0, sentenceEnd: 1 },
    ],
  }));
  assert.equal(parsed.deck[0].sentence, '本です。', 'the sentence is still worth keeping');
  assert.equal(parsed.deck[0].sentenceStart, undefined, 'but a nonsense highlight is not');
  assert.equal(parsed.deck[1].sentenceStart, undefined, 'end before start is nonsense too');
  assert.equal(parsed.deck[2].sentence, undefined, 'an empty sentence is no sentence');
});

test('a card with no sentence stays that way — the field is optional', () => {
  const [restored] = parseBackup(serializeBackup(state({ deck: [entry('本')] }), T0)).deck;
  assert.ok(!('sentence' in restored), 'no empty string invented for pre-v7 cards');
});

// ---- parse: refusing the wrong file -----------------------------------------

test('rejects non-JSON, foreign JSON, and future versions with readable messages', () => {
  assert.throws(() => parseBackup('本\tほん\tbook\tN5'), /valid JSON/);
  assert.throws(() => parseBackup('{"cards":[]}'), /kotoba-lab-backup/);
  assert.throws(
    () => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, deck: [entry('本')] })),
    /newer version/,
  );
});

test('an empty backup is an error, not a silent no-op', () => {
  assert.throws(() => parseBackup(serializeBackup(state(), T0)), /empty/);
});

test('a half-corrupt card is downgraded to new, not thrown away', () => {
  const parsed = parseBackup(JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    deck: [
      { surface: '本', savedAt: T0, srs: 'nonsense' },   // unusable schedule
      { reading: 'よみ' },                                // no surface at all
      { surface: '水', savedAt: T0, srs: { reps: 4 } },   // partial schedule
    ],
  }));
  assert.equal(parsed.deck.length, 2, 'the entry with no surface is dropped');
  assert.equal(parsed.deck[0].srs, undefined, 'unusable srs falls back to "new card"');
  assert.equal(parsed.deck[1].srs.reps, 4);
  assert.equal(parsed.deck[1].srs.ease, 2.5, 'missing fields take SM-2 defaults');
});

test('review-log entries that could inflate a streak are dropped', () => {
  const parsed = parseBackup(JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    deck: [entry('本')],
    reviewLog: { '2026-01-15': 4, 'yesterday': 99, '2026-1-5': 3, '2026-01-16': -2 },
  }));
  assert.deepEqual(parsed.reviewLog, { '2026-01-15': 4 });
});

// ---- merge ------------------------------------------------------------------

test('import adds new cards and never deletes existing ones', () => {
  const mine = state({ deck: [entry('本')] });
  const theirs = state({ deck: [entry('水')] });
  const { state: merged, stats } = mergeState(mine, theirs);
  assert.deepEqual(merged.deck.map((e) => e.surface).sort(), ['本', '水'].sort());
  assert.equal(stats.cardsAdded, 1);
  assert.equal(stats.cardsTotal, 2);
});

test('the more recently studied card wins, in both directions', () => {
  const behind = entry('本', { srs: card({ reps: 1, interval: 1, reviewedAt: T0 }) });
  const ahead = entry('本', { srs: card({ reps: 8, interval: 30, reviewedAt: T0 + 5 * DAY }) });

  const forward = mergeState(state({ deck: [behind] }), state({ deck: [ahead] }));
  assert.equal(forward.state.deck[0].srs.interval, 30, 'incoming ahead → adopted');
  assert.equal(forward.stats.cardsUpdated, 1);

  const backward = mergeState(state({ deck: [ahead] }), state({ deck: [behind] }));
  assert.equal(backward.state.deck[0].srs.interval, 30, 'incoming behind → kept, not rolled back');
  assert.equal(backward.stats.cardsUpdated, 0);
});

test('a restored card keeps the earliest savedAt', () => {
  const old = entry('本', { savedAt: T0, srs: card({ reviewedAt: T0 }) });
  const newer = entry('本', { savedAt: T0 + 30 * DAY, srs: card({ reviewedAt: T0 + 31 * DAY }) });
  const { state: merged } = mergeState(state({ deck: [old] }), state({ deck: [newer] }));
  assert.equal(merged.deck[0].savedAt, T0);
});

test('known sets union; review days take the max, never the sum', () => {
  const mine = state({ knownWords: ['私'], knownKanji: ['一'], reviewLog: { '2026-01-15': 10 } });
  const theirs = state({ knownWords: ['私', '本'], knownKanji: ['二'], reviewLog: { '2026-01-15': 4, '2026-01-14': 7 } });
  const { state: merged, stats } = mergeState(mine, theirs);
  assert.deepEqual(merged.knownWords.sort(), ['本', '私'].sort());
  assert.deepEqual(merged.reviewLog, { '2026-01-15': 10, '2026-01-14': 7 });
  assert.equal(stats.wordsAdded, 1);
  assert.equal(stats.kanjiAdded, 1);
});

test('importing the same backup twice is a no-op the second time', () => {
  const mine = state({
    deck: [entry('本'), entry('水', { srs: card({ reps: 5 }) })],
    knownWords: ['私'],
    reviewLog: { '2026-01-15': 10 },
  });
  const file = serializeBackup(mine, T0);
  const once = mergeState(mine, parseBackup(file));
  const twice = mergeState(once.state, parseBackup(file));
  assert.deepEqual(twice.state, once.state);
  assert.deepEqual(twice.stats, {
    cardsAdded: 0, cardsUpdated: 0, cardsTotal: 2, wordsAdded: 0, kanjiAdded: 0,
    favoritesAdded: 0, daysAdded: 0, achievementsAdded: 0,
  });
  assert.match(describeMerge(twice.stats), /Already up to date/);
});

// ---- achievement ledger ------------------------------------------------------

test('an achievement ledger round-trips through export and import', () => {
  const original = state({ deck: [entry('本')], achievements: { 'kanji-1': T0, 'words-1': T0 + DAY } });
  const back = parseBackup(serializeBackup(original, T0));
  assert.deepEqual(back.achievements, { 'kanji-1': T0, 'words-1': T0 + DAY });
});

test('an achievement id this build does not recognize is dropped, not trusted', () => {
  const parsed = parseBackup(JSON.stringify({
    format: BACKUP_FORMAT, version: 1, deck: [entry('本')],
    achievements: { 'kanji-1': T0, 'not-a-real-id': T0, 'kanji-10': 'nonsense', 'words-1': -5 },
  }));
  assert.deepEqual(parsed.achievements, { 'kanji-1': T0 });
});

test('a v2 backup with no achievements field imports cleanly as empty, not a throw', () => {
  const legacyV2 = JSON.stringify({
    format: BACKUP_FORMAT, version: 2, exportedAt: new Date(T0).toISOString(), deck: [entry('本')],
  });
  const inspected = inspectBackup(legacyV2);
  assert.deepEqual(inspected.state.achievements, {});
});

test('merging achievements keeps the earlier of two unlock timestamps', () => {
  const mine = state({ deck: [entry('本')], achievements: { 'kanji-1': T0 + DAY } });
  const theirs = state({ deck: [entry('水')], achievements: { 'kanji-1': T0, 'words-1': T0 } });
  const { state: merged, stats } = mergeState(mine, theirs);
  assert.equal(merged.achievements['kanji-1'], T0, 'the earlier timestamp wins');
  assert.equal(merged.achievements['words-1'], T0, 'a new id is simply added');
  assert.equal(stats.achievementsAdded, 1, 'kanji-1 already existed — only words-1 is new');
  assert.match(describeMerge(stats), /1 achievement/);
});

// ---- favorites ---------------------------------------------------------------
// The one collection here that cannot be re-derived: a known list comes back by
// studying and a deck comes back by reading, but nothing reconstructs which
// kanji someone liked. These tests are the reason favorites are in the file.

test('favorites round-trip through export and import', () => {
  const original = state({
    deck: [entry('本')],
    favoriteKanji: ['河', '雫'],
    favoriteWords: ['天の川'],
  });
  const back = parseBackup(serializeBackup(original, T0));
  assert.deepEqual(back.favoriteKanji, ['河', '雫']);
  assert.deepEqual(back.favoriteWords, ['天の川']);
  assert.deepEqual(back, original);
});

test('a profile that has only favorites is not treated as empty', () => {
  const only = serializeBackup(state({ favoriteKanji: ['河'] }), T0);
  assert.deepEqual(parseBackup(only).favoriteKanji, ['河']);
  // ...but a genuinely empty one still says so.
  assert.throws(() => parseBackup(serializeBackup(state(), T0)), /empty/);
});

test('favorites count toward the summary as one collection', () => {
  const s = state({ favoriteKanji: ['河', '雫'], favoriteWords: ['天の川'] });
  assert.equal(backupSummary(s).favorites, 3);
});

test('a v3 profile written before favorites existed imports as having kept nothing', () => {
  const legacy = inspectBackup(JSON.stringify({
    format: BACKUP_FORMAT, version: 3, exportedAt: new Date(T0).toISOString(),
    deck: [entry('本')], knownKanji: ['本'],
  }));
  assert.equal(legacy.meta.version, 3);
  assert.deepEqual(legacy.state.favoriteKanji, []);
  assert.deepEqual(legacy.state.favoriteWords, []);
});

test('merging unions favorites and never un-keeps anything', () => {
  const mine = state({ favoriteKanji: ['河'], favoriteWords: ['天の川'] });
  const theirs = state({ favoriteKanji: ['雫'], favoriteWords: ['天の川', '雪'] });
  const { state: merged, stats } = mergeState(mine, theirs);
  assert.deepEqual(merged.favoriteKanji.sort(), ['河', '雫'].sort());
  assert.deepEqual(merged.favoriteWords.sort(), ['天の川', '雪'].sort());
  assert.equal(stats.favoritesAdded, 2);
  // An import must never remove one the other device had unstarred: there is no
  // timestamp to tell a removal from a device that simply never had it.
  const back = mergeState(merged, mine);
  assert.deepEqual(back.state.favoriteKanji.sort(), merged.favoriteKanji.sort());
  assert.equal(back.stats.favoritesAdded, 0);
});

test('an import that only adds favorites still says what it did', () => {
  const { stats } = mergeState(state(), state({ favoriteKanji: ['河'] }));
  assert.match(describeMerge(stats), /1 favorite/);
  const two = mergeState(state(), state({ favoriteKanji: ['河'], favoriteWords: ['雪'] }));
  assert.match(describeMerge(two.stats), /2 favorites/);
});
