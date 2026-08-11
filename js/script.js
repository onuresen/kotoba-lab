// script.js — Japanese script/character classification helpers.
// Shared by the tokenizer, the analyzer, and the reader so they all agree on
// what counts as a kanji vs. kana vs. everything else.

// CJK Unified Ideographs (+ Extension A). Astral-plane kanji (Ext B+) are rare
// in modern text; callers iterate by code point (Array.from) so they still pass
// through as single "other/kanji" units without crashing.
export function isKanji(ch) {
  const o = ch.codePointAt(0);
  return (o >= 0x4e00 && o <= 0x9fff) || (o >= 0x3400 && o <= 0x4dbf);
}

// Hiragana + Katakana (incl. the prolonged-sound mark ー and small kana).
export function isKana(ch) {
  const o = ch.codePointAt(0);
  return (o >= 0x3040 && o <= 0x309f) || (o >= 0x30a0 && o <= 0x30ff) || o === 0x30fc;
}

// 'kanji' | 'kana' | 'other'  (other = punctuation, latin, digits, spaces …)
export function charClass(ch) {
  if (isKanji(ch)) return 'kanji';
  if (isKana(ch)) return 'kana';
  return 'other';
}

// Sentence-ending marks, used by the readability estimate.
const SENTENCE_ENDERS = new Set(['。', '．', '！', '？', '!', '?', '\n']);
export function isSentenceEnd(ch) {
  return SENTENCE_ENDERS.has(ch);
}
