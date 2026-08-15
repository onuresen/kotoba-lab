// compound-words.js — which compound words your known kanji already unlock.
//
// Every other structural feature in Kotoba Lab takes kanji apart. This one is
// the opposite: it reads the known-kanji set and reports the words those kanji
// combine into, which is where the committed JLPT vocabulary earns its keep.
//
// Pure: no DOM, no storage, no fetch.

const CJK_START = 0x4e00;
const CJK_END = 0x9fff;

function isKanji(char) {
  const point = char.codePointAt(0);
  return point >= CJK_START && point <= CJK_END;
}

// A readable compound is written entirely in kanji, at least two characters
// long, and every one of those characters is already known. Mixed-script words
// like 食べる are excluded: their kana carries grammar this cannot vouch for.
export function isReadableCompound(word, isKnown) {
  const chars = [...String(word || '')];
  if (chars.length < 2) return false;
  return chars.every((char) => isKanji(char) && isKnown(char));
}

// Easiest first: JLPT N5 before N1, unlevelled words last, then shorter words,
// then code point so the same known set always produces the same list.
function compare(a, b) {
  const levelA = Number.isFinite(a.lvl) ? a.lvl : -1;
  const levelB = Number.isFinite(b.lvl) ? b.lvl : -1;
  if (levelA !== levelB) return levelB - levelA;
  const lengthA = [...a.w].length;
  const lengthB = [...b.w].length;
  if (lengthA !== lengthB) return lengthA - lengthB;
  return a.w.codePointAt(0) - b.w.codePointAt(0);
}

// The other direction: where does this one kanji actually show up? Nothing else
// in the application links a kanji to vocabulary, so this is what turns "I can
// draw 学" into "I can read 学生". Any script is allowed here — 学ぶ teaches the
// kun reading as usefully as 学校 teaches the on reading.
export function wordsContaining(vocab, char, limit = 6) {
  const target = String(char || '');
  if ([...target].length !== 1) return [];
  const cap = Math.max(0, Number(limit) || 0);
  const seen = new Set();
  const matches = [];

  for (const entry of Array.isArray(vocab) ? vocab : []) {
    const word = entry?.w;
    if (!word || word === target || seen.has(word) || !word.includes(target)) continue;
    seen.add(word);
    matches.push({
      w: word,
      r: entry.r || '',
      g: entry.g || '',
      lvl: Number.isFinite(entry.lvl) ? entry.lvl : null,
    });
  }

  matches.sort(compare);
  return cap ? matches.slice(0, cap) : [];
}

export function buildReadableCompounds(vocab, isKnown, limit = 24) {
  if (typeof isKnown !== 'function') return { total: 0, words: [] };
  const cap = Math.max(0, Number(limit) || 0);
  const seen = new Set();
  const matches = [];

  for (const entry of Array.isArray(vocab) ? vocab : []) {
    const word = entry?.w;
    if (!word || seen.has(word)) continue;
    if (!isReadableCompound(word, isKnown)) continue;
    seen.add(word);
    matches.push({
      w: word,
      r: entry.r || '',
      g: entry.g || '',
      lvl: Number.isFinite(entry.lvl) ? entry.lvl : null,
    });
  }

  matches.sort(compare);
  // total reports everything unlocked; words is the bounded slice shown.
  return { total: matches.length, words: cap ? matches.slice(0, cap) : [] };
}
