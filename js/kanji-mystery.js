// kanji-mystery.js — one kanji a day, revealed a clue at a time.
//
// The parked "Kanji Mystery Casebook" seed, narrowed until it has an ending:
// a date-seeded kanji, five clues released one at a time, and a guess allowed
// after any of them. It is the only thing in Kotoba Lab that gives a reason to
// open the application on a day with no appetite for studying.
//
// EVERY CLUE IS A COMMITTED DICTIONARY FACT — a stroke count, a JLPT grade, a
// canonical KanjiVG radical, a dictionary reading, a vocabulary entry. Nothing
// here characterises, hints at difficulty, or describes a kanji in words of its
// own, so the puzzle cannot mislead even by accident.
//
// Date seeding is the same trick Today's Brew uses (see kanji-alchemy.js), for
// the same reason: it makes "today's puzzle" identical for one person all day
// with no server, no account, and no stored state.
//
// WHAT THIS DELIBERATELY HAS NOT GOT: a streak, a score out of five, a win
// rate, a history, or a storage key. `IDEA_GARDEN.md`'s Japanese Weather System
// entry is this project's own argument against guilt-shaped mechanics, and a
// daily puzzle is exactly where they would arrive first. Clues used are
// reported because they are the shape of one day's path — not as a grade.
//
// Pure: no DOM, no storage, no fetch.

import { wordsContaining } from './compound-words.js';

export const CLUE_COUNT = 5;

// Fixed kinds in a fixed order, vaguest first: a stroke count leaves hundreds
// of candidates, a masked word leaves almost none. Fixed rather than adaptive
// so every day's puzzle is the same shape and one day's path means the same
// thing as another's.
export const CLUE_KINDS = Object.freeze(['strokes', 'level', 'radical', 'reading', 'word']);

// Same hash/PRNG pair as kanji-alchemy.js. Duplicated rather than shared
// because a seeded sequence is part of each feature's observable behavior:
// hoisting it into a common module would let a change to one daily silently
// reshuffle the other.
function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(now = new Date()) {
  // en-CA is ISO-shaped (YYYY-MM-DD) and local, so the puzzle turns over at the
  // learner's midnight rather than UTC's.
  return now.toLocaleDateString('en-CA');
}

function firstReading(value) {
  return String(value || '')
    .split(/[、,]/)
    .map((reading) => reading.trim().replace(/[*]/g, ''))
    .filter(Boolean)[0] || null;
}

// How many committed vocabulary entries a kanji appears in. One pass over the
// whole list, rather than wordsContaining() per candidate, which would be
// 6,813 scans of 10,808 entries.
function vocabTally(vocab) {
  const counts = new Map();
  for (const entry of Array.isArray(vocab) ? vocab : []) {
    const word = entry?.w;
    if (!word) continue;
    for (const char of new Set(word)) counts.set(char, (counts.get(char) || 0) + 1);
  }
  return counts;
}

// A kanji that IS its own canonical radical — 一, 口, 木, 人, and 121 others —
// cannot be a puzzle under this clue set: clue three would read "its canonical
// radical is 木" and the puzzle would be over. Losing some of the most common
// kanji in the language is the honest cost of a clue order that stays fair.
function radicalGivesItAway(item, structureIndex) {
  const radicals = structureIndex?.byKanji?.get(item.char)?.radicals || [];
  return !radicals.length || radicals.includes(item.char);
}

// Appearing in at least this many committed vocabulary entries. It is a data
// requirement first — the last clue picks a word at random, and one or two
// candidates make that clue nearly fixed — but it is also what keeps the pool
// from being mostly N1: at 8 words the 688 eligible kanji are about two thirds
// N5-N3, where at 2 words they were 48% N1. That skew is a consequence of how
// the committed vocabulary is distributed, not a difficulty scale invented
// here; nothing in this module ranks kanji by how hard they are.
const MIN_WORDS = 8;

/**
 * The kanji a fair puzzle can be built from.
 *
 * Every filter is a data requirement, not a difficulty judgment: a kanji with
 * no stroke count has no first clue, no reading has no fourth, too few words
 * has no meaningful fifth, and one that is its own radical has no third.
 * JLPT-graded only, because "somewhere in 6,813" is a lottery rather than a
 * deduction — and the grade is also clue two.
 */
export function mysteryPool(catalog, structureIndex, vocab, { minWords = MIN_WORDS } = {}) {
  const counts = vocabTally(vocab);
  return (Array.isArray(catalog) ? catalog : []).filter((item) => {
    if (!item?.char || item.jlpt == null || !(item.strokes > 0)) return false;
    if (!item.meaning) return false;
    if (!firstReading(item.on) && !firstReading(item.kun)) return false;
    if ((counts.get(item.char) || 0) < minWords) return false;
    return !radicalGivesItAway(item, structureIndex);
  }).sort((a, b) => a.char.codePointAt(0) - b.char.codePointAt(0));
}

function levelText(level) {
  return level == null ? 'ungraded' : `JLPT N${level}`;
}

// The final clue: a real word containing the kanji, with the kanji itself
// blanked out. Its reading and meaning stay, which is what makes it solvable
// rather than merely suggestive.
function maskWord(word, char) {
  return [...String(word)].map((glyph) => (glyph === char ? '◯' : glyph)).join('');
}

function buildClues(item, structureIndex, vocab, random, describe) {
  const radicals = structureIndex?.byKanji?.get(item.char)?.radicals || [];
  const radical = radicals[0];
  const onReading = firstReading(item.on);
  const kunReading = firstReading(item.kun);
  const { words } = wordsContaining(vocab, item.char, 8);
  const word = words[Math.floor(random() * words.length)] || null;
  const radicalMeaning = describe ? describe(radical) : '';

  return [
    { kind: 'strokes', label: 'Strokes', text: `${item.strokes} strokes.` },
    { kind: 'level', label: 'Level', text: `It is graded ${levelText(item.jlpt)}.` },
    {
      kind: 'radical',
      label: 'Radical',
      text: `Its canonical radical is ${radical}${radicalMeaning ? ` — ${radicalMeaning}` : ''}.`,
      glyph: radical,
    },
    onReading
      ? { kind: 'reading', label: 'Reading', text: `One on’yomi is ${onReading}.` }
      : { kind: 'reading', label: 'Reading', text: `One kun’yomi is ${kunReading}.` },
    word
      ? {
        kind: 'word',
        label: 'Appears in',
        text: `${maskWord(word.w, item.char)}${word.r ? ` (${word.r})` : ''} — ${String(word.g).split(';')[0].trim()}.`,
      }
      : { kind: 'word', label: 'Appears in', text: 'No committed vocabulary entry for this one.' },
  ];
}

/**
 * Today's puzzle. `describe` is an optional char -> meaning lookup used only to
 * gloss the radical clue; a radical that is not itself a dictionary kanji (⻖,
 * 艹) simply has none, which is what the dictionary does and does not cover.
 */
export function buildDailyMystery(catalog, structureIndex, vocab, options = {}) {
  const date = String(options.date || todayKey());
  const pool = mysteryPool(catalog, structureIndex, vocab, options);
  if (!pool.length) return null;
  const random = seededRandom(`kotoba-mystery:${date}`);
  const item = pool[Math.floor(random() * pool.length)];
  return {
    date,
    char: item.char,
    answer: { char: item.char, jlpt: item.jlpt, strokes: item.strokes, meaning: item.meaning, on: item.on, kun: item.kun },
    clues: buildClues(item, structureIndex, vocab, random, options.describe),
    poolSize: pool.length,
  };
}

export function createMysterySession(mystery) {
  if (!mystery?.char || !mystery.clues?.length) return null;
  return {
    date: mystery.date,
    char: mystery.char,
    answer: { ...mystery.answer },
    clues: mystery.clues.map((clue) => ({ ...clue })),
    // The first clue is free: a puzzle that opens with nothing at all is not a
    // puzzle, it is a blank box.
    revealed: 1,
    guesses: [],
    solved: false,
    over: false,
  };
}

export function visibleClues(session) {
  return session ? session.clues.slice(0, session.revealed) : [];
}

/** Open the next clue deliberately, without spending a guess on it. */
export function revealMysteryClue(session) {
  if (!session || session.over || session.revealed >= session.clues.length) return session;
  return { ...session, revealed: session.revealed + 1 };
}

/**
 * Guess one kanji.
 *
 * A wrong guess opens the next clue — the puzzle answers back rather than just
 * saying no — and running out of clues ends it with the answer shown. Repeating
 * a guess already made costs nothing, so a mis-tap is not a penalty.
 */
export function guessMystery(session, char) {
  const guess = String(char || '');
  if (!session || session.over || !guess) return { session, verdict: null };
  if (session.guesses.includes(guess)) return { session, verdict: 'repeat' };
  const guesses = [...session.guesses, guess];
  if (guess === session.char) {
    return { session: { ...session, guesses, solved: true, over: true }, verdict: 'correct' };
  }
  const revealed = Math.min(session.revealed + 1, session.clues.length);
  const over = session.revealed >= session.clues.length;
  return {
    session: { ...session, guesses, revealed, over },
    verdict: over ? 'lost' : 'wrong',
  };
}

export function mysteryProgress(session) {
  const total = session?.clues?.length || 0;
  return {
    revealed: session?.revealed || 0,
    total,
    remaining: Math.max(0, total - (session?.revealed || 0)),
    guesses: session?.guesses?.length || 0,
    solved: Boolean(session?.solved),
    over: Boolean(session?.over),
  };
}

/**
 * A spoiler-free line describing one day's path: which clues were opened, and
 * whether it closed. No kanji, no reading, no meaning, and deliberately no
 * score, streak, or win rate — the marks are the shape of the path, and there
 * is nothing stored anywhere for them to accumulate into.
 */
export function mysteryShareLine(session, { label = 'Kotoba Lab 謎' } = {}) {
  if (!session) return '';
  const total = session.clues.length;
  const used = session.solved ? session.revealed : total;
  const marks = '◆'.repeat(used) + '◇'.repeat(Math.max(0, total - used));
  return `${label} ${session.date}\n${marks}${session.solved ? '' : ' ✕'}`;
}
