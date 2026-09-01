// word-browser.js — vocabulary lookup, the counterpart to kanji-browser.js.
//
// 10,808 committed vocabulary entries were reachable only if a word happened to
// appear in pasted text or fell out of the known-kanji set. This makes them
// searchable on their own terms, using the same normalisation rules the kanji
// library already applies to readings.
//
// Pure: no DOM, no storage, no fetch.

// Mirrors readingForm() in kanji-browser.js: katakana folds to hiragana so a
// query typed either way matches, and separators are ignored.
function readingForm(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[\s、,;；・()（）.]/g, '');
}

function levelRank(level) {
  return level == null ? 5 : 5 - level;
}

// Shorter words first within a level: 学 before 留学生 when both match, because
// the shorter entry is almost always the one being looked for.
function compare(a, b) {
  const rank = levelRank(a.lvl) - levelRank(b.lvl);
  if (rank !== 0) return rank;
  const lengthA = [...a.w].length;
  const lengthB = [...b.w].length;
  if (lengthA !== lengthB) return lengthA - lengthB;
  // Code point order rather than localeCompare: collation depends on ICU being
  // present, and this list must sort identically in every browser and in Node.
  if (a.w === b.w) return 0;
  return a.w < b.w ? -1 : 1;
}

// Counters (枚, 匹, 冊…) read straight out of the dictionary's own gloss text,
// not a curated list. Kanjium's glosses are semicolon-separated senses, so a
// kanji with several unrelated meanings — 縮 "shrink" / "counter for suits of
// armour", 門 "gate" / "counter for cannons" — still matches on the one clause
// that actually says so, never on its other, unrelated senses.
const COUNTER_CLAUSE = /counter for\b/i;

function counterClauses(gloss) {
  return String(gloss || '')
    .split(';')
    .map((clause) => clause.trim())
    .filter((clause) => COUNTER_CLAUSE.test(clause));
}

export function hasCounterSense(gloss) {
  return counterClauses(gloss).length > 0;
}

// What a Counters view shows in place of the word's usual first sense, which
// is very often unrelated (乗's first sense is "(nth) power", not the counter
// for vehicles three clauses later). Every counting use the entry's own gloss
// states, joined — 丁 alone counts sheets, tofu, restaurant servings, and long
// narrow objects, and picking only one clause would hide the other three.
export function counterGloss(gloss) {
  const clauses = counterClauses(gloss);
  return clauses.length ? clauses.join('; ') : String(gloss || '');
}

export function matchesWordQuery(entry, query) {
  if (!query) return true;
  const surface = String(entry.w || '');
  if (surface.includes(query.raw)) return true;
  if (query.reading && readingForm(entry.r).includes(query.reading)) return true;
  if (query.latin && String(entry.g || '').toLowerCase().includes(query.latin)) return true;
  return false;
}

// A query is prepared once per search rather than per entry: normalising the
// needle 10,808 times is the difference between instant and sluggish.
export function prepareWordQuery(term) {
  const raw = String(term ?? '').trim();
  if (!raw) return null;
  return {
    raw,
    reading: readingForm(raw),
    latin: /^[\x20-\x7e]+$/.test(raw) ? raw.toLowerCase() : '',
  };
}

export function searchWords(vocab, options = {}) {
  const query = prepareWordQuery(options.term);
  const level = Number.isFinite(options.level) ? options.level : null;
  const readable = options.readable === 'readable' || options.readable === 'unreadable'
    ? options.readable
    : 'all';
  const isReadable = typeof options.isReadable === 'function' ? options.isReadable : null;
  const kind = options.kind === 'counter' ? 'counter' : 'all';
  const limit = Math.max(1, Number(options.limit) || 40);

  const matches = [];
  const seen = new Set();

  for (const entry of Array.isArray(vocab) ? vocab : []) {
    const word = entry?.w;
    if (!word || seen.has(word)) continue;
    if (level !== null && entry.lvl !== level) continue;
    if (kind === 'counter' && !hasCounterSense(entry.g)) continue;
    if (!matchesWordQuery(entry, query)) continue;
    if (readable !== 'all' && isReadable) {
      const can = isReadable(word);
      if (readable === 'readable' ? !can : can) continue;
    }
    seen.add(word);
    matches.push({
      w: word,
      r: entry.r || '',
      g: entry.g || '',
      lvl: Number.isFinite(entry.lvl) ? entry.lvl : null,
    });
  }

  matches.sort(compare);
  // total stays honest so the interface never implies the page is everything.
  return { total: matches.length, words: matches.slice(0, limit) };
}
