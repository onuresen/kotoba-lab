// storage.js — client-side persistence for the study deck and known-word/kanji
// sets. localStorage only: no account, no sync, no server. Falls back to an
// in-memory Map/Set (silently, for the session only) if localStorage is
// unavailable (private browsing, sandboxed iframe, etc.) so the app never
// throws — it just won't remember next time.

const PREFIX = 'kotoba-lab:';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage unavailable/full — caller keeps working in memory
  }
}

// A persisted set of strings (known words / known kanji).
export function createKnownSet(key) {
  let items = new Set(readJSON(key, []));
  const persist = () => writeJSON(key, [...items]);
  return {
    has: (s) => items.has(s),
    toggle(s) {
      const now = !items.has(s);
      if (now) items.add(s); else items.delete(s);
      persist();
      return now;
    },
    count: () => items.size,
    all: () => [...items],
    // Overwrite wholesale — used to write back a merged backup (see backup.js).
    // The merging happens there; this just lands the result in one write.
    replaceAll(list) { items = new Set(list); persist(); },
    clear() { items = new Set(); persist(); },
  };
}

// A persisted study deck: surface -> {surface, reading, gloss, level, savedAt,
// srs}. `srs` is the spaced-repetition card (see srs.js); entries written
// before v5 simply don't have it and srs.cardOf() treats them as new.
export function createDeck(key) {
  let entries = new Map(Object.entries(readJSON(key, {})));
  const persist = () => writeJSON(key, Object.fromEntries(entries));
  return {
    has: (surface) => entries.has(surface),
    get: (surface) => entries.get(surface) || null,
    toggle(entry) {
      const now = !entries.has(entry.surface);
      if (now) entries.set(entry.surface, { ...entry, savedAt: Date.now() });
      else entries.delete(entry.surface);
      persist();
      return now;
    },
    // Merge a patch into one entry (used to write back a graded srs card).
    update(surface, patch) {
      const prev = entries.get(surface);
      if (!prev) return null;
      const next = { ...prev, ...patch };
      entries.set(surface, next);
      persist();
      return next;
    },
    remove(surface) { entries.delete(surface); persist(); },
    count: () => entries.size,
    all: () => [...entries.values()].sort((a, b) => b.savedAt - a.savedAt),
    replaceAll(list) { entries = new Map(list.map((e) => [e.surface, e])); persist(); },
    clear() { entries = new Map(); persist(); },
  };
}

// A persisted per-day tally of answered cards: 'YYYY-MM-DD' (local) -> count.
// Backs the "reviewed today" figure and the study streak.
export function createReviewLog(key, keepDays = 90) {
  let days = readJSON(key, {});
  const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  const prune = () => {
    const keys = Object.keys(days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - keepDays))) delete days[k];
  };
  const persist = () => writeJSON(key, days);
  return {
    record(n = 1) {
      const k = dayKey();
      days[k] = (days[k] || 0) + n;
      prune();
      persist();
    },
    today: () => days[dayKey()] || 0,
    // Consecutive days ending today — a day with no reviews yet doesn't break
    // the streak until it's over, so counting starts at yesterday if today is 0.
    streak() {
      const cursor = new Date();
      if (!days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
      let n = 0;
      while (days[dayKey(cursor)]) {
        n += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return n;
    },
    all: () => ({ ...days }),
    replaceAll(next) { days = { ...next }; prune(); persist(); },
    clear() { days = {}; persist(); },
  };
}

// A persisted achievement ledger: id -> unlock timestamp (ms). Once an id is
// recorded it is never overwritten — first-earned wins, so re-evaluating the
// same achievement on every Achievements-tab render never loses the original
// unlock time. Unknown ids (a future catalog change) are simply carried along
// unused rather than dropped, so an earlier version's earned data is never
// destroyed by a newer one that trims the catalog.
export function createAchievementLog(key) {
  let unlocked = readJSON(key, {});
  const persist = () => writeJSON(key, unlocked);
  return {
    has: (id) => id in unlocked,
    record(id, at = Date.now()) {
      if (id in unlocked) return false;
      unlocked[id] = at;
      persist();
      return true;
    },
    all: () => ({ ...unlocked }),
    replaceAll(next) { unlocked = { ...next }; persist(); },
    clear() { unlocked = {}; persist(); },
  };
}
