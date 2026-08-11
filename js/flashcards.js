// flashcards.js — turn selected study words into an Anki-importable TSV.
// Fields: surface, reading, meaning (gloss), JLPT level.

import { levelName } from './jlpt.js';

// Pick study candidates from word-frequency rows: dictionary words at or above
// a chosen difficulty, plus (optionally) ungraded words. `minLevel` uses the
// 5..1 scale, so "N4 and harder" = minLevel 4 meaning level <= 4.
export function pickStudyWords(wordRows, { hardestFirst = true, maxLevel = 4, includeUngraded = true } = {}) {
  const picked = wordRows.filter((r) => {
    if (r.level == null) return includeUngraded;
    return r.level <= maxLevel; // lower number = harder
  });
  picked.sort((a, b) => {
    const la = a.level == null ? 0 : a.level; // ungraded (0) sorts hardest
    const lb = b.level == null ? 0 : b.level;
    return hardestFirst ? la - lb || b.n - a.n : b.n - a.n;
  });
  return picked;
}

// Five columns, always — a saved card carries the sentence it was met in, a
// word picked off the frequency table has none, and an export whose column
// count varies by source would break the field mapping on import.
//
// There is no escaping here and TSV has no way to express one: a tab or a
// newline in a gloss would silently shift every later field. The shipped
// dictionaries are clean (flashcards.test.js fails if that ever stops being
// true), and the sentence is stripped of both on the way in for the same reason.
export function toTSV(rows) {
  const lines = rows.map((r) =>
    [r.surface, r.reading || '', r.gloss || '', levelName(r.level), oneLine(r.sentence)].join('\t')
  );
  return lines.join('\n');
}

const oneLine = (s) => (s ? String(s).replace(/[\t\r\n]+/g, ' ').trim() : '');

// The one DOM-touching helper here — backup.js stays pure, so it borrows this
// to put its JSON on disk.
export function download(filename, text, mime = 'text/tab-separated-values') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
