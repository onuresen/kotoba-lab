// jlpt.js — JLPT level lookup + kanji dictionary data.
// Level convention everywhere in this app: 5 = N5 (easiest) … 1 = N1 (hardest).
// null / undefined  = ungraded (not in the data) — shown as "—", NEVER as a
// guessed level.

export const LEVELS = [5, 4, 3, 2, 1]; // display order, easy → hard

export function levelName(lvl) {
  return lvl == null ? '—' : 'N' + lvl;
}

// Slug used for the JLPT color-scale CSS classes (see japanese-reader.css).
export function levelSlug(lvl) {
  return lvl == null ? 'ungraded' : 'n' + lvl;
}

// kanjiMap: kanji -> { jlpt, strokes, on, kun, meaning }  (see data/kanjidic.json)
export function createJlpt(kanjiMap) {
  const rec = (ch) => kanjiMap[ch] || null;
  return {
    kanjiLevel: (ch) => rec(ch)?.jlpt ?? null,
    kanjiKeyword: (ch) => rec(ch)?.meaning ?? null,
    // Full dictionary record for the Read-tab info panel, or null if ungraded.
    kanjiInfo: (ch) => rec(ch),
    has: (ch) => ch in kanjiMap,
    size: Object.keys(kanjiMap).length,
  };
}
