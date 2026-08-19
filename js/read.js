// read.js — renders the Read tab: text with furigana, per-kanji JLPT coloring,
// and click-to-inspect. No analysis logic here; it only draws tokens.

import { isKanji } from './script.js';
import { levelSlug } from './jlpt.js';
import { kanaToRomajiSegments } from './reading-forms.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Wrap each kanji glyph in a colored, inspectable span; leave kana/other as-is.
function colorize(surface, jlpt) {
  let out = '';
  for (const ch of surface) {
    if (isKanji(ch)) {
      const lvl = jlpt.kanjiLevel(ch);
      out += `<span class="k jlpt-${levelSlug(lvl)}" data-k="${esc(ch)}" data-klevel="${lvl == null ? '' : lvl}">${esc(ch)}</span>`;
    } else {
      out += esc(ch);
    }
  }
  return out;
}

// A token's own reading, independent of display mode: the dictionary/kana
// reading when one exists, the original surface otherwise — an unmatched
// kanji run is never guessed, same rule tokensToKana() uses.
function tokenKana(t) {
  return t.reading != null ? t.reading : t.surface;
}

// `i` is the token's position in the list the caller rendered. It rides along
// as data-i so a click can be traced back to the token, and from there to the
// sentence it sits in (see context.js) — the reader is the only place that
// still knows where a word came from. `mode` swaps what a word token shows
// (kanji+furigana, plain kana, or romaji) without changing what a click
// resolves to — the info panel always reflects the token's real data.
function tokenHtml(t, jlpt, i, mode, romajiText) {
  if (t.kind === 'other') return esc(t.surface);
  if (t.kind === 'kana') return `<span class="kana">${esc(mode === 'romaji' ? romajiText : t.surface)}</span>`;

  if (t.kind === 'word') {
    const attrs =
      `class="tok word" data-i="${i}" data-surface="${esc(t.surface)}" ` +
      `data-reading="${t.reading == null ? '' : esc(t.reading)}" ` +
      `data-gloss="${t.gloss == null ? '' : esc(t.gloss)}" ` +
      `data-level="${t.level == null ? '' : t.level}"`;
    if (mode === 'kana') return `<span ${attrs}>${esc(tokenKana(t))}</span>`;
    if (mode === 'romaji') return `<span ${attrs}>${esc(romajiText)}</span>`;
    const inner = colorize(t.surface, jlpt);
    const hasKanji = [...t.surface].some(isKanji);
    if (t.reading && hasKanji) {
      return `<ruby ${attrs}>${inner}<rt>${esc(t.reading)}</rt></ruby>`;
    }
    return `<span ${attrs}>${inner}</span>`;
  }
  // kind === 'kanji' (dictionary miss) — no reading to substitute in any
  // mode, so it always shows (and stays clickable as) the original glyphs.
  return `<span class="tok run" data-i="${i}">${colorize(t.surface, jlpt)}</span>`;
}

// Re-applies "already known" styling without re-rendering tokens — cheap to
// call again after the user toggles a word/kanji as known. `isKnown` is
// {word(surface)->bool, kanji(ch)->bool}; both optional (default: nothing known).
export function applyKnownClasses(container, isKnown = {}) {
  const knowsWord = isKnown.word || (() => false);
  const knowsKanji = isKnown.kanji || (() => false);
  container.querySelectorAll('.tok.word').forEach((el) => {
    el.classList.toggle('is-known', knowsWord(el.dataset.surface));
  });
  container.querySelectorAll('[data-k]').forEach((el) => {
    el.classList.toggle('is-known', knowsKanji(el.dataset.k));
  });
}

// Render tokens into `container`. `onSelect` receives {type:'kanji'|'word', …}.
// `mode` is 'original' (default, kanji + furigana, the only interactive
// mode with per-kanji color), 'kana' (plain readings, no kanji), or 'romaji'.
// Every mode keeps the same click targets/data, so switching mode never
// costs the tap-to-inspect info panel — only what a word visually shows.
export function renderReading(container, tokens, jlpt, onSelect, isKnown, mode = 'original') {
  // Romaji needs the whole text converted in one pass — a sokuon or ん right
  // at a token boundary depends on the mora just after it, which a per-token
  // conversion can't see on its own. See kanaToRomajiSegments() for why.
  const romajiSegments = mode === 'romaji' ? kanaToRomajiSegments(tokens.map(tokenKana)) : null;
  container.innerHTML = tokens.map((t, i) => tokenHtml(t, jlpt, i, mode, romajiSegments?.[i])).join('');
  applyKnownClasses(container, isKnown);

  container.onclick = (e) => {
    // Word wrapper first: kanji spans nest INSIDE .tok.word, so checking
    // [data-k] first would make every click on a kanji-containing word
    // resolve to that single kanji instead of the word's own reading/meaning.
    // Bare, unmatched kanji runs (.tok.run, no word wrapper) still fall
    // through to the per-kanji branch below.
    const wEl = e.target.closest('.tok.word');
    if (wEl) {
      container.querySelectorAll('.is-picked').forEach((n) => n.classList.remove('is-picked'));
      wEl.classList.add('is-picked');
      onSelect({
        type: 'word',
        index: Number(wEl.dataset.i),
        surface: wEl.dataset.surface,
        reading: wEl.dataset.reading || null,
        gloss: wEl.dataset.gloss || null,
        level: wEl.dataset.level === '' ? null : Number(wEl.dataset.level),
      });
      return;
    }
    const kEl = e.target.closest('[data-k]');
    if (kEl) {
      container.querySelectorAll('.is-picked').forEach((n) => n.classList.remove('is-picked'));
      kEl.classList.add('is-picked');
      // The kanji span nests inside its token, so the index comes from the
      // ancestor — a bare kanji run has one, a colored glyph never does.
      const owner = kEl.closest('[data-i]');
      onSelect({
        type: 'kanji',
        index: owner ? Number(owner.dataset.i) : null,
        ch: kEl.dataset.k,
        level: kEl.dataset.klevel === '' ? null : Number(kEl.dataset.klevel),
      });
    }
  };
}
