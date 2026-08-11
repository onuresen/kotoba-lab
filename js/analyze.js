// analyze.js — pure analysis over tokens + raw text. No DOM here.
// Produces the numbers the Analyze tab renders: frequency tables, JLPT
// breakdowns, and a (clearly heuristic) readability estimate.

import { isKanji, isKana, isSentenceEnd, charClass } from './script.js';
import { LEVELS } from './jlpt.js';

// ---- Kanji frequency + JLPT distribution -----------------------------------
export function kanjiStats(text, jlpt) {
  const counts = new Map(); // char -> occurrences
  let totalKanji = 0;
  for (const ch of text) {
    if (!isKanji(ch)) continue;
    totalKanji++;
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }

  const rows = [...counts.entries()]
    .map(([ch, n]) => ({ ch, n, level: jlpt.kanjiLevel(ch) }))
    .sort((a, b) => b.n - a.n || a.ch.localeCompare(b.ch));

  // Distribution by level, counted over OCCURRENCES (not unique chars).
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let ungraded = 0;
  for (const { n, level } of rows) {
    if (level == null) ungraded += n;
    else byLevel[level] += n;
  }

  return { rows, uniqueKanji: rows.length, totalKanji, byLevel, ungraded };
}

// ---- Word frequency (content tokens: dictionary words + kanji runs) ---------
export function wordStats(tokens) {
  const counts = new Map(); // surface -> { n, reading, level, kind }
  for (const t of tokens) {
    if (t.kind !== 'word' && t.kind !== 'kanji') continue;
    const cur = counts.get(t.surface);
    if (cur) cur.n++;
    else counts.set(t.surface, { surface: t.surface, n: 1, reading: t.reading, level: t.level, gloss: t.gloss, kind: t.kind });
  }
  const rows = [...counts.values()].sort((a, b) => b.n - a.n || a.surface.localeCompare(b.surface));

  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let ungraded = 0;
  for (const r of rows) {
    if (r.level == null) ungraded += r.n;
    else byLevel[r.level] += r.n;
  }
  return { rows, uniqueWords: rows.length, byLevel, ungraded };
}

// ---- Character mix ----------------------------------------------------------
export function charMix(text) {
  let kanji = 0, kana = 0, other = 0, jp = 0;
  for (const ch of text) {
    const c = charClass(ch);
    if (c === 'kanji') { kanji++; jp++; }
    else if (c === 'kana') { kana++; jp++; }
    else if (ch.trim()) other++; // ignore whitespace in the "other" tally
  }
  return { kanji, kana, other, jp, total: kanji + kana + other };
}

// ---- Readability estimate (HEURISTIC — not an official JLPT verdict) --------
// Blends three signals into a 0–100 difficulty score:
//   • kanji density         (more kanji  → harder)
//   • average sentence length (longer   → harder)
//   • average kanji rarity   (rarer/higher-JLPT kanji → harder)
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function norm(x, lo, hi) { return clamp01((x - lo) / (hi - lo)); }

export function readability(text, kStats) {
  const mix = charMix(text);
  const kanjiRatio = mix.jp ? mix.kanji / mix.jp : 0;

  // sentences
  let sentences = 0;
  for (const ch of text) if (isSentenceEnd(ch)) sentences++;
  if (sentences === 0 && mix.jp > 0) sentences = 1;
  const avgSentenceLen = sentences ? mix.jp / sentences : mix.jp;

  // average kanji rarity: map level 5..1 → difficulty 1..5, ungraded → 6
  let diffSum = 0, diffCount = 0;
  for (const { n, level } of kStats.rows) {
    const d = level == null ? 6 : 6 - level;
    diffSum += d * n;
    diffCount += n;
  }
  const avgKanjiDifficulty = diffCount ? diffSum / diffCount : 0;

  const score = Math.round(
    100 * (
      0.45 * norm(kanjiRatio, 0.05, 0.5) +
      0.25 * norm(avgSentenceLen, 12, 60) +
      0.30 * norm(avgKanjiDifficulty, 1, 6)
    )
  );

  const band = score < 25 ? { label: 'Beginner', jlpt: '≈ N5' }
    : score < 45 ? { label: 'Elementary', jlpt: '≈ N4' }
    : score < 65 ? { label: 'Intermediate', jlpt: '≈ N3' }
    : score < 82 ? { label: 'Upper-Intermediate', jlpt: '≈ N2' }
    : { label: 'Advanced', jlpt: '≈ N1' };

  return {
    score, band,
    metrics: {
      kanjiRatio: Math.round(kanjiRatio * 100),
      avgSentenceLen: Math.round(avgSentenceLen),
      sentences,
      avgKanjiDifficulty: Math.round(avgKanjiDifficulty * 10) / 10,
    },
  };
}

// ---- "you already know" coverage --------------------------------------------
// Pure: takes frequency rows + a plain key-membership check, so it has no idea
// where "known" comes from (storage.js) — it just counts occurrences.
export function coverage(rows, keyOf, isKnown) {
  let known = 0, total = 0;
  for (const r of rows) {
    total += r.n;
    if (isKnown(keyOf(r))) known += r.n;
  }
  return { known, total, pct: total ? Math.round((known / total) * 100) : 0 };
}
