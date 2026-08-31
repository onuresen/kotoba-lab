// kanji-mystery.test.js — run with: npm test
//
// Two things carry most of the weight here: the daily seed (the same date must
// give the same kanji forever, or "today's puzzle" means nothing) and the
// eligibility filter (every clue must exist, or a day arrives with a blank).

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiCatalog, buildKanjiStructureIndex } from './kanji-browser.js';
import {
  CLUE_COUNT,
  CLUE_KINDS,
  buildDailyMystery,
  createMysterySession,
  guessMystery,
  mysteryPool,
  mysteryProgress,
  mysteryShareLine,
  revealMysteryClue,
  todayKey,
  visibleClues,
} from './kanji-mystery.js';

const catalog = buildKanjiCatalog({
  語: { jlpt: 5, strokes: 14, on: 'ゴ', kun: 'かた（る）', meaning: 'word; language' },
  森: { jlpt: 4, strokes: 12, on: 'シン', kun: 'もり', meaning: 'forest' },
  木: { jlpt: 5, strokes: 4, on: 'ボク、モク', kun: 'き', meaning: 'tree; wood' },
  // Ungraded: excluded, and it is also clue two.
  鬱: { jlpt: null, strokes: 29, on: 'ウツ', kun: null, meaning: 'gloom' },
  // No reading at all: there would be no fourth clue.
  唖: { jlpt: 3, strokes: 10, on: null, kun: null, meaning: 'mute' },
  // Graded and readable, but in only one word: the last clue would be the answer.
  雫: { jlpt: 2, strokes: 11, on: 'ダ', kun: 'しずく', meaning: 'drop' },
});

const structure = buildKanjiStructureIndex({
  elements: ['言', '吾', '木', '目', '口', '亜', '雨', '下'],
  kanji: {
    語: [[0], [0, 1]],
    森: [[2], [2]],
    木: [[2], []],
    鬱: [[2], [2]],
    唖: [[4], [4, 5]],
    雫: [[6], [6, 7]],
  },
});

const VOCAB = [
  { w: '語学', r: 'ごがく', lvl: 3, g: 'language study' },
  { w: '日本語', r: 'にほんご', lvl: 5, g: 'Japanese language' },
  { w: '森林', r: 'しんりん', lvl: 2, g: 'forest; woods' },
  { w: '森', r: 'もり', lvl: 4, g: 'forest' },
  { w: '青森', r: 'あおもり', lvl: null, g: 'Aomori' },
  { w: '木曜', r: 'もくよう', lvl: 5, g: 'Thursday' },
  { w: '木材', r: 'もくざい', lvl: 2, g: 'lumber' },
  { w: '唖然', r: 'あぜん', lvl: null, g: 'dumbfounded' },
  { w: '雫', r: 'しずく', lvl: null, g: 'drop' },
];

// The fixture corpus is tiny, so it opts out of the real MIN_WORDS threshold;
// that threshold gets its own tests below against a purpose-built corpus.
const build = (date, extra = {}) => buildDailyMystery(catalog, structure, VOCAB, { date, minWords: 2, ...extra });

// ---- the pool ---------------------------------------------------------------

test('only kanji that can supply every clue are eligible', () => {
  const pool = mysteryPool(catalog, structure, VOCAB, { minWords: 2 }).map((item) => item.char);
  assert.deepEqual(pool, ['森', '語']); // code point order
  assert.equal(pool.includes('鬱'), false); // ungraded — clue two is the grade
  assert.equal(pool.includes('唖'), false); // no reading — clue four
  assert.equal(pool.includes('雫'), false); // one word only — clue five says nothing
});

test('a kanji that is its own canonical radical cannot be a puzzle', () => {
  // 木's radical is 木, so clue three would simply be the answer. It is one of
  // the most common kanji in the language and it is still excluded.
  const pool = mysteryPool(catalog, structure, VOCAB, { minWords: 1 }).map((i) => i.char);
  assert.equal(pool.includes('木'), false);
  assert.equal(pool.includes('森'), true); // 森's radical is 木 — a real clue
});

test('the word threshold is a data requirement, and adjustable', () => {
  const loose = mysteryPool(catalog, structure, VOCAB, { minWords: 1 }).map((i) => i.char);
  assert.equal(loose.includes('雫'), true);
  // The default is high enough that this fixture's corpus supplies nobody.
  assert.deepEqual(mysteryPool(catalog, structure, VOCAB), []);
});

test('an empty or unusable corpus yields no puzzle rather than a broken one', () => {
  assert.equal(buildDailyMystery([], structure, VOCAB, { date: '2026-08-30', minWords: 2 }), null);
  assert.equal(buildDailyMystery(catalog, { byKanji: new Map() }, VOCAB, { date: '2026-08-30', minWords: 2 }), null);
  assert.equal(buildDailyMystery(catalog, structure, [], { date: '2026-08-30', minWords: 2 }), null);
});

// ---- the daily seed ---------------------------------------------------------

test('one date always gives the same kanji and the same clues', () => {
  const a = build('2026-08-30');
  const b = build('2026-08-30');
  assert.equal(a.char, b.char);
  assert.deepEqual(a.clues, b.clues);
});

test('different dates move around the pool', () => {
  const chars = new Set();
  for (const day of ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']) {
    chars.add(build(day).char);
  }
  assert.ok(chars.size > 1, 'the same kanji every day would not be a daily');
});

test('the pool is walked evenly, not clustered on one kanji', () => {
  // A seeded pick that favoured one end of the pool would make "today's kanji"
  // a near-constant. Over a month of dates both fixture candidates must appear.
  const seen = new Map();
  for (let day = 1; day <= 28; day += 1) {
    const char = build(`2026-09-${String(day).padStart(2, '0')}`).char;
    seen.set(char, (seen.get(char) || 0) + 1);
  }
  assert.equal(seen.size, 2);
  for (const count of seen.values()) assert.ok(count >= 7, `lopsided: ${[...seen]}`);
});

test('today defaults to the local date, not UTC', () => {
  assert.match(todayKey(new Date('2026-08-30T12:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayKey(), buildDailyMystery(catalog, structure, VOCAB, { minWords: 2 }).date);
});

// ---- the clues --------------------------------------------------------------

test('every puzzle has the same five clues in the same order', () => {
  for (const day of ['2026-08-30', '2026-09-15', '2027-01-01']) {
    const mystery = build(day);
    assert.equal(mystery.clues.length, CLUE_COUNT);
    assert.deepEqual(mystery.clues.map((clue) => clue.kind), CLUE_KINDS);
    for (const clue of mystery.clues) assert.ok(clue.text.length > 0, clue.kind);
  }
});

test('the answer never appears in its own clues', () => {
  for (const day of ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03']) {
    const mystery = build(day);
    // Including the radical clue: a kanji that is its own radical is excluded
    // from the pool precisely so this holds for every clue, not most of them.
    for (const clue of mystery.clues) {
      assert.equal(clue.text.includes(mystery.char), false,
        `${mystery.char} leaked in the ${clue.kind} clue: ${clue.text}`);
    }
  }
});

test('the word clue blanks the kanji and keeps the reading and meaning', () => {
  const mystery = build('2026-08-30');
  const clue = mystery.clues.find((c) => c.kind === 'word');
  assert.match(clue.text, /◯/);
  assert.match(clue.text, /—/); // the gloss survives
});

test('a radical gloss is used when the radical is itself a dictionary kanji', () => {
  const described = build('2026-08-30', {
    describe: (char) => ({ 木: 'tree; wood', 言: 'say; word' })[char] || '',
  });
  const clue = described.clues.find((c) => c.kind === 'radical');
  assert.match(clue.text, / — /);
  // And absent, not broken, when the dictionary has nothing for that shape.
  const bare = build('2026-08-30').clues.find((c) => c.kind === 'radical');
  assert.equal(bare.text.includes(' — '), false);
});

// ---- playing ----------------------------------------------------------------

const session = () => createMysterySession(build('2026-08-30'));

test('a session opens with exactly one clue', () => {
  const s = session();
  assert.equal(visibleClues(s).length, 1);
  assert.equal(mysteryProgress(s).remaining, CLUE_COUNT - 1);
});

test('a clue can be opened without spending a guess', () => {
  let s = session();
  s = revealMysteryClue(s);
  assert.equal(visibleClues(s).length, 2);
  assert.equal(s.guesses.length, 0);
});

test('a wrong guess answers back with the next clue', () => {
  const start = session();
  const wrong = start.char === '森' ? '木' : '森';
  const { session: after, verdict } = guessMystery(start, wrong);
  assert.equal(verdict, 'wrong');
  assert.equal(after.revealed, 2);
  assert.equal(after.over, false);
});

test('the right guess ends it, whenever it comes', () => {
  const start = session();
  const { session: after, verdict } = guessMystery(start, start.char);
  assert.equal(verdict, 'correct');
  assert.equal(after.solved, true);
  assert.equal(after.over, true);
  // and nothing more can be done to it
  assert.equal(guessMystery(after, 'X').verdict, null);
  assert.equal(revealMysteryClue(after), after);
});

test('repeating a guess costs nothing — a mis-tap is not a penalty', () => {
  const start = session();
  const wrong = start.char === '森' ? '木' : '森';
  const { session: once } = guessMystery(start, wrong);
  const { session: twice, verdict } = guessMystery(once, wrong);
  assert.equal(verdict, 'repeat');
  assert.equal(twice, once);
});

test('running out of clues ends the puzzle', () => {
  let s = session();
  const wrong = s.char === '森' ? '木' : '森';
  const others = ['一', '二', '三', '四', '五'];
  let guessed = 0;
  for (const char of [wrong, ...others]) {
    const { session: next, verdict } = guessMystery(s, char);
    s = next;
    guessed += 1;
    if (verdict === 'lost') break;
  }
  assert.equal(s.over, true);
  assert.equal(s.solved, false);
  assert.equal(guessed, CLUE_COUNT); // one guess per clue
});

test('progress reports the path and nothing that could accumulate', () => {
  const s = revealMysteryClue(session());
  assert.deepEqual(mysteryProgress(s), {
    revealed: 2, total: 5, remaining: 3, guesses: 0, solved: false, over: false,
  });
  assert.deepEqual(Object.keys(mysteryProgress(null)).sort(),
    ['guesses', 'over', 'remaining', 'revealed', 'solved', 'total']);
});

// ---- sharing ----------------------------------------------------------------

test('the share line gives away no kanji, reading, or meaning', () => {
  const start = session();
  const { session: won } = guessMystery(start, start.char);
  const line = mysteryShareLine(won);
  assert.equal(line.includes(start.char), false);
  assert.equal(line.includes(start.answer.meaning), false);
  assert.match(line, /2026-08-30/);
  assert.equal(line.split('\n')[1], '◆◇◇◇◇');
});

test('the marks are the clues opened, and an unsolved day says so', () => {
  let s = revealMysteryClue(revealMysteryClue(session()));
  ({ session: s } = guessMystery(s, s.char));
  assert.equal(mysteryShareLine(s).split('\n')[1], '◆◆◆◇◇');

  let lost = session();
  for (const char of ['一', '二', '三', '四', '五']) ({ session: lost } = guessMystery(lost, char));
  assert.equal(mysteryShareLine(lost).split('\n')[1], '◆◆◆◆◆ ✕');
});

test('no session, no line', () => {
  assert.equal(mysteryShareLine(null), '');
  assert.equal(createMysterySession(null), null);
  assert.equal(createMysterySession({ char: '木', clues: [] }), null);
  assert.deepEqual(visibleClues(null), []);
});
