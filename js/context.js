// context.js — the sentence a saved word came from.
//
// A card that says 専門家 → "expert" teaches you the gloss, not the word. The
// sentence you actually met it in is already on screen when you press ★ Save,
// so this pulls it out of the same token list the Read tab is drawing.
//
// Pure: tokens in, a string out. Sentence bounds are found in the joined TEXT
// rather than at token boundaries, because the tokenizer groups runs of the
// same script — `。「` is one 'other' token, so a sentence can end partway
// through one.

import { isKana, isKanji, isSentenceEnd } from './script.js';

// Longest sentence we'll keep whole. Beyond this the sentence is windowed
// around the word, so one runaway paragraph can't bloat every deck entry (and
// with it localStorage, the backup file, and the review card).
export const MAX_CONTEXT_CHARS = 140;

const ELLIPSIS = '…';

/**
 * The sentence containing tokens[index].
 *
 * Returns `{ text, start, end }` — `start`/`end` locate the word INSIDE `text`,
 * so the card can emphasise the exact occurrence rather than the first string
 * match (the same word often appears twice in one sentence). Returns null when
 * there is no usable context.
 */
export function sentenceAt(tokens, index, { maxChars = MAX_CONTEXT_CHARS } = {}) {
  if (!Array.isArray(tokens) || !Number.isInteger(index)) return null;
  if (index < 0 || index >= tokens.length) return null;

  const text = tokens.map((t) => t.surface).join('');
  let from = 0;
  for (let i = 0; i < index; i++) from += tokens[i].surface.length;
  const to = from + tokens[index].surface.length;
  if (to === from) return null;

  // Widen to the enclosing sentence: back to just after the previous ender,
  // forward through the next one (the ender itself is part of the sentence).
  let lo = from;
  while (lo > 0 && !isSentenceEnd(text[lo - 1])) lo--;
  let hi = to;
  while (hi < text.length && !isSentenceEnd(text[hi])) hi++;
  if (hi < text.length) hi++; // keep the 。 / ？ / ！

  return window(text.slice(lo, hi), from - lo, to - lo, maxChars);
}

// Trim surrounding whitespace and, if still too long, keep a window around the
// word instead of the whole sentence. Offsets are carried through every shift.
function window(raw, start, end, maxChars) {
  // --- trim, keeping the word's offsets honest
  const lead = raw.length - raw.trimStart().length;
  let text = raw.trim();
  start -= lead;
  end -= lead;
  if (!text || start < 0 || end > text.length || start >= end) return null;

  if (text.length <= maxChars) return { text, start, end };

  // --- window around the word, centred where possible
  const wordLen = end - start;
  const slack = Math.max(0, maxChars - wordLen);
  let lo = Math.max(0, start - Math.floor(slack / 2));
  let hi = Math.min(text.length, lo + maxChars);
  lo = Math.max(0, hi - maxChars); // pull back if we hit the right edge

  const prefix = lo > 0 ? ELLIPSIS : '';
  const suffix = hi < text.length ? ELLIPSIS : '';
  text = prefix + text.slice(lo, hi) + suffix;
  start = start - lo + prefix.length;
  end = end - lo + prefix.length;

  // A word longer than the window itself would leave `end` past the string.
  if (end > text.length) end = text.length;
  return { text, start, end };
}

/** Split a context into the three parts a card renders: before, word, after. */
export function contextParts(sentence) {
  if (!sentence || typeof sentence.text !== 'string') return null;
  const { text } = sentence;
  const start = Number.isInteger(sentence.start) ? sentence.start : -1;
  const end = Number.isInteger(sentence.end) ? sentence.end : -1;
  // Offsets from an older or hand-edited entry may not fit the text any more.
  // Showing the sentence unhighlighted beats showing it sliced in the wrong place.
  if (start < 0 || end > text.length || start >= end) return { before: text, word: '', after: '' };
  return { before: text.slice(0, start), word: text.slice(start, end), after: text.slice(end) };
}

/**
 * The same context, prepared for a cloze prompt: the sentence with the word
 * itself withheld. Returns `{ before, after, word }` or null when this entry
 * cannot be clozed.
 *
 * Two entries can't: one whose offsets no longer locate the word (contextParts
 * falls back to an unhighlighted sentence, so there is nothing to blank), and
 * one whose stored sentence is the word plus nothing readable — 本。 blanks
 * down to a box and a full stop, which is a worse card than the ordinary one.
 * "Readable" is one kana or kanji outside the blank, rather than a list of
 * punctuation to ignore: brackets and quotes are no more of a clue than 。 is.
 * Callers fall back to a normal face rather than showing an empty box.
 */
export function clozeParts(sentence) {
  const parts = contextParts(sentence);
  if (!parts || !parts.word) return null;
  const rest = parts.before + parts.after;
  if (![...rest].some((ch) => isKana(ch) || isKanji(ch))) return null;
  return parts;
}
