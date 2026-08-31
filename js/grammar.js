// grammar.js — the only place in Kotoba Lab that reads a morphological tag.
//
// The precise (kuromoji) tokenizer has always computed a part of speech, a
// dictionary form, and an inflection label for every token; until now all
// three were thrown away at the Token boundary. This module turns them into
// something a learner can read, and it is deliberately the *whole* of the
// interpretation: everything else consumes the shapes below.
//
// THE RULE THIS MODULE EXISTS TO KEEP: describe IPADIC's own labels, never
// state a grammar rule the dictionary does not contain. So a token can be
// reported as a verb whose dictionary form is 食べる, carrying IPADIC's
// 連用タ接続 label — and it is never reported as "past tense", which is a
// claim about Japanese rather than about the analysis. Nothing here infers
// tense, politeness, transitivity, or register.
//
// Everything degrades to absent. The v1 dictionary segmenter emits no
// morphology at all, and analysis()/grammarProfile() must then report "not
// available", never an empty or zeroed grammar.
//
// Pure: no DOM, no storage, no fetch.

// IPADIC's top-level 品詞 set. Fixed and complete — this is a translation of a
// closed tagset, not a judgment about any particular word.
const POS_LABELS = Object.freeze({
  名詞: 'noun',
  動詞: 'verb',
  形容詞: 'adjective',
  副詞: 'adverb',
  助詞: 'particle',
  助動詞: 'auxiliary verb',
  連体詞: 'adnominal',
  接続詞: 'conjunction',
  感動詞: 'interjection',
  接頭詞: 'prefix',
  フィラー: 'filler',
  記号: 'symbol',
  その他: 'other',
});

// The order the profile lists them in: what a reader is most likely to be
// looking for first, not frequency, which would reshuffle per text.
const POS_ORDER = Object.freeze([
  '動詞', '名詞', '形容詞', '助詞', '助動詞', '副詞',
  '連体詞', '接続詞', '接頭詞', '感動詞', 'フィラー', '記号', 'その他',
]);

export function posLabel(pos) {
  return POS_LABELS[pos] || null;
}

/** True when this token carries analysis at all. */
export function hasAnalysis(token) {
  return Boolean(token && token.pos);
}

/**
 * One token's grammar, or null when the tokenizer produced none.
 *
 * `conjugated` is a comparison, not a claim: the surface differs from the
 * dictionary form the analyser assigned it. That is enough to show 食べた ←
 * 食べる without saying what the change means.
 */
export function tokenGrammar(token) {
  if (!hasAnalysis(token)) return null;
  const lemma = token.lemma || null;
  return {
    pos: token.pos,
    label: posLabel(token.pos),
    detail: token.posDetail || null,
    lemma,
    conjugation: token.conjugation || null,
    conjugated: Boolean(lemma && lemma !== token.surface),
  };
}

function tally(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function ranked(map, limit) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    // Ties break on the key so one text always profiles the same way.
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, limit);
}

/**
 * A whole text's grammar profile.
 *
 * `available: false` means the current tokenizer produced no analysis — the
 * caller must say so rather than draw an empty chart. Punctuation (記号) is
 * counted in `groups` but excluded from `total`, so the percentages describe
 * language rather than commas.
 */
export function grammarProfile(tokens, { particleLimit = 8, conjugatedLimit = 8 } = {}) {
  const list = Array.isArray(tokens) ? tokens.filter(hasAnalysis) : [];
  if (!list.length) return { available: false, total: 0, groups: [], particles: [], conjugated: [] };

  const byPos = new Map();
  const particles = new Map();
  const conjugated = new Map();
  let total = 0;

  for (const token of list) {
    tally(byPos, token.pos);
    if (token.pos !== '記号') total += 1;
    if (token.pos === '助詞') tally(particles, token.surface);
    const grammar = tokenGrammar(token);
    if (grammar.conjugated) tally(conjugated, `${token.surface}\t${grammar.lemma}`);
  }

  const groups = POS_ORDER
    .filter((pos) => byPos.has(pos))
    .map((pos) => ({
      pos,
      label: posLabel(pos),
      count: byPos.get(pos),
      // Of the language, not of the punctuation: 記号 itself therefore has no
      // percentage rather than a misleading one.
      pct: pos === '記号' || !total ? null : Math.round((byPos.get(pos) / total) * 100),
    }));

  return {
    available: true,
    total,
    groups,
    particles: ranked(particles, particleLimit).map(({ key, count }) => ({ surface: key, count })),
    conjugated: ranked(conjugated, conjugatedLimit).map(({ key, count }) => {
      const [surface, lemma] = key.split('\t');
      return { surface, lemma, count };
    }),
  };
}
