// tokenizer-kuromoji.js — the v2 "precise" tokenizer: real morphological
// analysis via kuromoji.js, vendored under vendor/kuromoji/ (browser build +
// dictionary), so it stays fully static and offline.
//
// It honors the SAME contract as the v1 dictionary segmenter — it produces the
// identical Token shape ({surface, reading, level, gloss, kind}) — so app.js can
// swap between them with nothing else changing. This is exactly the seam the v1
// tokenizer.js header promised.
//
// It also fills in the four OPTIONAL morphology fields the shared Token shape
// allows (pos, posDetail, lemma, conjugation). Those are IPADIC's own labels,
// carried through rather than interpreted; the v1 tokenizer leaves them null
// and every consumer must treat "no analysis" as absent, never as wrong. See
// js/grammar.js, which owns the only reading of these tags in the application.
//
// kuromoji loads a ~18MB dictionary once (async), so this is opt-in and lazy:
// app.js keeps the instant dictionary segmenter as the default and only loads
// this when the user asks for precision.

import { isKanji } from './script.js';

// ---- helpers ----------------------------------------------------------------
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.kuromoji) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

function katakanaToHiragana(s) {
  if (!s || s === '*') return null;
  let out = '';
  for (const ch of s) {
    const o = ch.codePointAt(0);
    out += (o >= 0x30a1 && o <= 0x30f6) ? String.fromCodePoint(o - 0x60) : ch;
  }
  return out;
}

function buildIndex(vocab) {
  const m = new Map(); // surface / lemma -> { lvl, g }
  for (const e of vocab) if (!m.has(e.w)) m.set(e.w, { lvl: e.lvl, g: e.g || null });
  return m;
}

// kuromoji POS (Japanese) → our token kind
function posToKind(pos) {
  if (pos === '記号') return 'other';                 // punctuation/symbols
  if (pos === '助詞' || pos === '助動詞') return 'kana'; // particles / aux → function words
  return 'word';                                       // 名詞/動詞/形容詞/副詞/…
}

function mapTokens(raw, idx) {
  // 1) map to intermediate items (keep POS detail for the merge pass)
  const items = raw.map((k) => ({
    surface: k.surface_form,
    reading: katakanaToHiragana(k.reading),
    lemma: k.basic_form && k.basic_form !== '*' ? k.basic_form : k.surface_form,
    pos: k.pos,
    sub: k.pos_detail_1,
    // IPADIC's 活用形 (e.g. 連用形, 基本形). Kept verbatim; nothing in this
    // application translates it into a grammar rule.
    conjugation: k.conjugated_form && k.conjugated_form !== '*' ? k.conjugated_form : null,
    kind: posToKind(k.pos),
  }));

  // 2) light merge so compounds read naturally:
  //    noun + 接尾 (suffix, e.g. 専門+家) → one word; 接頭詞 (prefix) + word → one word
  const merged = [];
  for (const it of items) {
    const prev = merged[merged.length - 1];
    if (it.sub === '接尾' && prev && prev.kind === 'word') {
      prev.surface += it.surface;
      prev.reading = (prev.reading || '') + (it.reading || '') || null;
      prev.lemma = prev.surface;
      // The merged surface is its own dictionary form, so whatever inflection
      // either half carried no longer describes the compound.
      prev.conjugation = null;
      continue;
    }
    if (prev && prev.pos === '接頭詞' && it.kind === 'word') {
      it.surface = prev.surface + it.surface;
      it.reading = (prev.reading || '') + (it.reading || '') || null;
      it.lemma = it.surface;
      it.conjugation = null;
      merged[merged.length - 1] = it;
      continue;
    }
    merged.push({ ...it });
  }

  // 3) finalize into the shared Token shape; attach JLPT level + gloss by lemma/surface
  return merged.map((m) => {
    const hasKanji = [...m.surface].some(isKanji);
    const info = idx.get(m.lemma) || idx.get(m.surface) || null;
    return {
      surface: m.surface,
      reading: hasKanji ? (m.reading || null) : null,
      level: info ? info.lvl : null,
      gloss: info ? info.g : null,
      kind: m.kind,
      pos: m.pos || null,
      posDetail: m.sub && m.sub !== '*' ? m.sub : null,
      lemma: m.lemma || null,
      conjugation: m.conjugation,
    };
  });
}

// ---- public loader ----------------------------------------------------------
export async function loadKuromojiTokenizer(vocab, opts = {}) {
  const scriptPath = opts.scriptPath || 'vendor/kuromoji/kuromoji.js';
  const dicPath = opts.dicPath || 'vendor/kuromoji/dict/';
  await loadScript(scriptPath);
  const built = await new Promise((resolve, reject) => {
    window.kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t)));
  });
  const idx = buildIndex(vocab);
  return {
    name: 'kuromoji',
    tokenize: (text) => mapTokens(built.tokenize(text), idx),
  };
}
