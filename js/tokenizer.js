// tokenizer.js — the shared spine both tabs sit on.
//
// v1 tokenizer: a dictionary longest-match segmenter over the embedded JLPT
// vocab list, with script-run fallback for anything not in the dictionary.
// It needs no native binary and no network — fully static, works on a plane.
//
// SWAPPABLE BY DESIGN. Everything downstream (analyze/read/flashcards) consumes
// only the token shape below, never this file's internals. To upgrade to full
// MeCab-quality morphology later, drop in a kuromoji.js-backed module that
// exposes the same `createTokenizer(...) -> { tokenize(text) -> Token[] }`
// contract and produces the same Token fields. Nothing else has to change.
//
// Token = {
//   surface: string,          // the text as it appears
//   reading: string | null,   // kana reading, only for dictionary-matched words
//   level:   number | null,   // JLPT level 5..1 for matched words, else null
//   gloss:   string | null,   // English meaning, only for dictionary-matched words
//   kind:    'word' | 'kanji' | 'kana' | 'other'
//
//   // OPTIONAL morphology, present only when the tokenizer actually analysed
//   // the text. This segmenter matches dictionary strings and cannot know any
//   // of it, so it emits none — absent, never guessed. Consumers must render
//   // nothing rather than something wrong; see js/grammar.js.
//   pos?:         string | null,  // IPADIC part of speech, e.g. 動詞
//   posDetail?:   string | null,  // IPADIC pos_detail_1, e.g. 格助詞
//   lemma?:       string | null,  // dictionary form, e.g. 食べる for 食べた
//   conjugation?: string | null,  // IPADIC 活用形, e.g. 連用タ接続
// }

import { charClass } from './script.js';

export function createTokenizer(vocab) {
  const dict = new Map();
  let maxLen = 1;
  for (const { w, r, lvl, g } of vocab) {
    if (!dict.has(w)) {
      dict.set(w, { r, lvl, g: g || null });
      if (w.length > maxLen) maxLen = w.length;
    }
  }

  function tokenize(text) {
    const chars = Array.from(text); // code-point safe
    const tokens = [];
    let i = 0;

    while (i < chars.length) {
      // 1) longest dictionary match starting at i
      let hit = null;
      const tryMax = Math.min(maxLen, chars.length - i);
      for (let len = tryMax; len >= 1; len--) {
        const sub = chars.slice(i, i + len).join('');
        if (dict.has(sub)) { hit = { sub, len }; break; }
      }
      if (hit) {
        const { r, lvl, g } = dict.get(hit.sub);
        tokens.push({ surface: hit.sub, reading: r, level: lvl, gloss: g, kind: 'word' });
        i += hit.len;
        continue;
      }

      // 2) no dictionary word here — consume a run of the same script.
      //    Stop the run early if the next char itself begins a dictionary
      //    entry, so we never swallow a known single-char word.
      const cls = charClass(chars[i]);
      let j = i + 1;
      while (j < chars.length && charClass(chars[j]) === cls && !dict.has(chars[j])) j++;
      const surface = chars.slice(i, j).join('');
      tokens.push({
        surface,
        reading: cls === 'kana' ? surface : null,
        level: null,
        gloss: null,
        kind: cls, // 'kanji' | 'kana' | 'other'
      });
      i = j;
    }
    return tokens;
  }

  return { tokenize, name: 'dict-longest-match', vocabSize: dict.size };
}
