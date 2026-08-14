// backup.js — the deck's way out of this browser, and back in.
//
// Everything personal lives in one browser's localStorage (see storage.js), so
// clearing site data ends a deck you may have spent months building. The TSV
// export doesn't save you: it carries word/reading/meaning/level and drops the
// `srs` card, so it can rebuild a word list but never a schedule.
//
// This module is that missing round-trip: one JSON file holding the deck WITH
// its scheduling, both known-sets, and the review log. Pure — no DOM, no
// storage, no clock except the `now` you pass — so the merge rules below can be
// tested directly.
//
// IMPORT MERGES, IT NEVER REPLACES. Restoring an old backup must not delete
// cards you've saved since, and a device that's behind must not roll a device
// that's ahead backwards. Every rule here is chosen so that importing the same
// file twice changes nothing the second time.

export const BACKUP_FORMAT = 'kotoba-lab-backup';
export const BACKUP_VERSION = 2;

// ---- shape helpers ----------------------------------------------------------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// Keep only strings, deduped, order preserved — a known-set is exactly that.
function cleanStrings(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((s) => typeof s === 'string' && s.length))];
}

// A hand-edited or half-corrupt `srs` block shouldn't cost you the whole card:
// coerce what's there and let anything unusable fall back to "new card".
function cleanCard(srs, savedAt) {
  if (!isObj(srs)) return null;
  return {
    due: num(srs.due, savedAt),
    interval: Math.max(0, num(srs.interval, 0)),
    ease: num(srs.ease, 2.5),
    reps: Math.max(0, num(srs.reps, 0)),
    lapses: Math.max(0, num(srs.lapses, 0)),
    step: Math.max(0, num(srs.step, 0)),
    reviewedAt: typeof srs.reviewedAt === 'number' ? srs.reviewedAt : null,
  };
}

function cleanEntry(raw) {
  if (!isObj(raw) || typeof raw.surface !== 'string' || !raw.surface.length) return null;
  const savedAt = num(raw.savedAt, 0);
  const entry = {
    surface: raw.surface,
    reading: typeof raw.reading === 'string' ? raw.reading : null,
    gloss: typeof raw.gloss === 'string' ? raw.gloss : null,
    level: typeof raw.level === 'number' ? raw.level : null,
    savedAt,
  };
  const srs = cleanCard(raw.srs, savedAt);
  if (srs) entry.srs = srs;
  // The sentence the word was saved from (see context.js). Optional: cards
  // saved before v7, and words added from the frequency table, have none.
  // Offsets are kept only when they actually fit the text — a mismatched pair
  // would highlight the wrong slice, and contextParts falls back cleanly.
  if (typeof raw.sentence === 'string' && raw.sentence.length) {
    entry.sentence = raw.sentence;
    const start = num(raw.sentenceStart, -1);
    const end = num(raw.sentenceEnd, -1);
    if (Number.isInteger(start) && Number.isInteger(end) &&
        start >= 0 && end <= raw.sentence.length && start < end) {
      entry.sentenceStart = start;
      entry.sentenceEnd = end;
    }
  }
  return entry;
}

// 'YYYY-MM-DD' -> non-negative count. Anything else is dropped rather than
// trusted: this feeds the study streak.
function cleanLog(raw) {
  if (!isObj(raw)) return {};
  const out = {};
  for (const [day, n] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const count = Math.max(0, Math.round(num(n, 0)));
    if (count > 0) out[day] = count;
  }
  return out;
}

// ---- export -----------------------------------------------------------------

/** state = { deck: Entry[], knownWords: string[], knownKanji: string[], reviewLog: {day:n} } */
export function backupSummary(state) {
  return {
    cards: Array.isArray(state?.deck) ? state.deck.length : 0,
    knownWords: Array.isArray(state?.knownWords) ? state.knownWords.length : 0,
    knownKanji: Array.isArray(state?.knownKanji) ? state.knownKanji.length : 0,
    reviewDays: isObj(state?.reviewLog) ? Object.keys(state.reviewLog).length : 0,
  };
}

export function buildBackup(state, now = Date.now(), { appVersion = '' } = {}) {
  const cleanState = {
    deck: (state.deck || []).map(cleanEntry).filter(Boolean),
    knownWords: cleanStrings(state.knownWords),
    knownKanji: cleanStrings(state.knownKanji),
    reviewLog: cleanLog(state.reviewLog),
  };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    appVersion: typeof appVersion === 'string' ? appVersion : '',
    summary: backupSummary(cleanState),
    ...cleanState,
  };
}

export function serializeBackup(state, now = Date.now(), options = {}) {
  return JSON.stringify(buildBackup(state, now, options), null, 2);
}

export function backupFilename(now = Date.now()) {
  return `kotoba-lab-profile-${new Date(now).toLocaleDateString('en-CA')}.json`;
}

// ---- import -----------------------------------------------------------------

/**
 * Parse a backup file into the same state shape buildBackup() consumes.
 * Throws an Error whose message is safe to show the user — the point of failing
 * loudly here is that the alternative is silently importing nothing.
 */
export function inspectBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isObj(raw)) throw new Error('That file isn\'t a Kotoba Lab backup.');
  if (raw.format !== BACKUP_FORMAT) {
    // A TSV export renamed to .json, or somebody else's data file. Say which,
    // because "invalid file" sends people hunting for corruption that isn't there.
    throw new Error('That JSON isn\'t a Kotoba Lab backup (no "kotoba-lab-backup" marker).');
  }
  if (num(raw.version, 0) > BACKUP_VERSION) {
    throw new Error(`That backup was written by a newer version (v${raw.version}); this build reads up to v${BACKUP_VERSION}.`);
  }
  const deck = (Array.isArray(raw.deck) ? raw.deck : []).map(cleanEntry).filter(Boolean);
  const state = {
    deck,
    knownWords: cleanStrings(raw.knownWords),
    knownKanji: cleanStrings(raw.knownKanji),
    reviewLog: cleanLog(raw.reviewLog),
  };
  if (!deck.length && !state.knownWords.length && !state.knownKanji.length && !Object.keys(state.reviewLog).length) {
    throw new Error('That backup is empty — no cards and no known words.');
  }
  return {
    state,
    meta: {
      version: Math.max(1, num(raw.version, 1)),
      appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '',
      exportedAt: typeof raw.exportedAt === 'string' && Number.isFinite(Date.parse(raw.exportedAt)) ? raw.exportedAt : '',
      summary: backupSummary(state),
    },
  };
}

export function parseBackup(text) {
  return inspectBackup(text).state;
}

// ---- merge ------------------------------------------------------------------

// How far along a card is. Most recent ANSWER wins, because that's the device
// you actually studied on; `reps` breaks ties for cards graded in the same
// millisecond, and a card with no schedule at all loses to one that has one.
function progress(entry) {
  const c = entry.srs;
  if (!c) return [-1, -1];
  return [c.reviewedAt ?? 0, c.reps ?? 0];
}
function isAhead(a, b) {
  const [ra, pa] = progress(a);
  const [rb, pb] = progress(b);
  return ra > rb || (ra === rb && pa > pb);
}

/**
 * Merge an imported state into the current one. Returns the merged state plus
 * counts to report back — an import that silently does nothing is worse than
 * an error, so the caller always has something concrete to say.
 */
export function mergeState(current, incoming) {
  const bySurface = new Map((current.deck || []).map((e) => [e.surface, e]));
  let cardsAdded = 0, cardsUpdated = 0;

  for (const entry of incoming.deck || []) {
    const mine = bySurface.get(entry.surface);
    if (!mine) {
      bySurface.set(entry.surface, entry);
      cardsAdded += 1;
    } else if (isAhead(entry, mine)) {
      // Keep the earliest savedAt: this card has been in the deck since then,
      // whichever browser first saw it.
      bySurface.set(entry.surface, { ...entry, savedAt: Math.min(mine.savedAt || 0, entry.savedAt || 0) || entry.savedAt });
      cardsUpdated += 1;
    }
  }

  const words = new Set(current.knownWords || []);
  const kanji = new Set(current.knownKanji || []);
  const wordsBefore = words.size, kanjiBefore = kanji.size;
  for (const w of incoming.knownWords || []) words.add(w);
  for (const k of incoming.knownKanji || []) kanji.add(k);

  // Per-day MAX, not sum: re-importing the same file must not inflate your
  // streak or double today's tally. Two devices studied on the same day is the
  // only case this under-counts, and under-counting is the safe direction.
  const log = { ...(current.reviewLog || {}) };
  let daysAdded = 0;
  for (const [day, n] of Object.entries(incoming.reviewLog || {})) {
    if (!(day in log)) daysAdded += 1;
    log[day] = Math.max(log[day] || 0, n);
  }

  return {
    state: {
      deck: [...bySurface.values()],
      knownWords: [...words],
      knownKanji: [...kanji],
      reviewLog: log,
    },
    stats: {
      cardsAdded,
      cardsUpdated,
      cardsTotal: bySurface.size,
      wordsAdded: words.size - wordsBefore,
      kanjiAdded: kanji.size - kanjiBefore,
      daysAdded,
    },
  };
}

// One sentence describing what an import actually did, for the toast.
export function describeMerge(stats) {
  const bits = [];
  if (stats.cardsAdded) bits.push(`${stats.cardsAdded} card${stats.cardsAdded === 1 ? '' : 's'} added`);
  if (stats.cardsUpdated) bits.push(`${stats.cardsUpdated} updated`);
  const known = stats.wordsAdded + stats.kanjiAdded;
  if (known) bits.push(`${known} known item${known === 1 ? '' : 's'}`);
  if (!bits.length) return 'Already up to date — nothing new in that backup.';
  return `Imported: ${bits.join(', ')}.`;
}
