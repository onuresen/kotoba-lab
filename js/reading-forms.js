// reading-forms.js — pure conversion from tokenizer output into plain kana
// ("full furigana") and romaji text. No DOM; consumed by read.js's view-mode
// rendering and the Read tab's copy-to-clipboard actions.
//
// Only tokens that already carry a dictionary/kana reading are converted —
// an unmatched kanji run (kind 'kanji') has no known reading and is passed
// through unchanged rather than guessing one, the same "never invent it"
// stance as unlockedBy() in compound-words.js.

// Katakana → hiragana, leaving the prolonged-sound mark (ー) and everything
// else (kanji, punctuation, latin, ・) untouched.
function toHiragana(text) {
  return String(text).replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// Tokens → one plain kana string: dictionary/kana readings substituted in,
// everything else (unmatched kanji runs, punctuation, latin) left as-is.
export function tokensToKana(tokens) {
  return (tokens || []).map((t) => (t.reading != null ? t.reading : t.surface)).join('');
}

// ---- kana → romaji (approximate modified Hepburn) --------------------------
const DIGRAPHS = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  // extended digraphs used to spell loanwords
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo', いぇ: 'ye',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  ちぇ: 'che', しぇ: 'she', じぇ: 'je',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
};

const MONOGRAPHS = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', // stray small vowels (rare outside a digraph)
};

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);
const SOKUON = 'っ';
const CHOONPU = 'ー';

// One mora at position i of a hiragana-only string → { romaji, len }, or null
// when nothing kana-shaped starts there (kanji, punctuation, latin, space).
function moraAt(chars, i) {
  const two = chars[i] + (chars[i + 1] || '');
  if (DIGRAPHS[two]) return { romaji: DIGRAPHS[two], len: 2 };
  const one = MONOGRAPHS[chars[i]];
  if (one) return { romaji: one, len: 1 };
  return null;
}

// The shared conversion core: walks a hiragana-normalized string once,
// yielding one { chars, text } step per input chunk consumed (1 char, or 2
// for a digraph). kanaToRomaji flattens these into one string; the segment
// variant below regroups them at caller-supplied boundaries instead, so a
// sokuon or ん whose disambiguation depends on the mora right after it still
// resolves correctly even when that mora belongs to the next segment.
function romajiSteps(text) {
  const chars = Array.from(toHiragana(String(text || '')));
  const steps = [];
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (ch === CHOONPU) {
      const lastVowel = [...out].reverse().find((c) => VOWELS.has(c));
      const piece = lastVowel || '';
      out += piece; steps.push({ chars: 1, text: piece }); i += 1; continue;
    }
    if (ch === SOKUON) {
      const next = moraAt(chars, i + 1);
      let piece = '';
      if (next && !VOWELS.has(next.romaji[0]) && next.romaji[0] !== 'n') {
        piece = next.romaji[0] === 'c' ? 't' : next.romaji[0]; // ッチ → "tchi"
      }
      out += piece; steps.push({ chars: 1, text: piece }); i += 1; continue;
    }
    const mora = moraAt(chars, i);
    if (mora) {
      let piece;
      if (mora.romaji === 'n') {
        const next = moraAt(chars, i + 1);
        const nextStarts = next ? next.romaji[0] : chars[i + 1];
        piece = (nextStarts && (VOWELS.has(nextStarts) || nextStarts === 'y')) ? "n'" : 'n';
      } else {
        piece = mora.romaji;
      }
      out += piece; steps.push({ chars: mora.len, text: piece }); i += mora.len; continue;
    }
    out += ch; steps.push({ chars: 1, text: ch }); i += 1; // not a kana mora — pass through
  }
  return steps;
}

// Approximate modified-Hepburn romanization of a hiragana/katakana string.
// Handles the sokuon consonant-doubling (っ), ん before a vowel/y needing an
// apostrophe to stay unambiguous, and ー extending the previous vowel. Not
// exhaustive for every rare loanword spelling; anything unrecognized (kanji,
// punctuation, latin, digits) passes through unchanged.
export function kanaToRomaji(text) {
  return romajiSteps(text).map((step) => step.text).join('');
}

export function tokensToRomaji(tokens) {
  return kanaToRomaji(tokensToKana(tokens));
}

// Same conversion as kanaToRomaji, but realigned to the boundaries of each
// input segment (typically one per tokenizer token) instead of flattened to
// one string. Converting a UI's per-token spans independently would get a
// sokuon/ん wrong right at a token boundary — this joins the segments,
// converts once, then cuts the result back apart at the original lengths, so
// an interactive per-token view and the whole-text kanaToRomaji/copy button
// stay byte-identical. Not bulletproof for a boundary that lands inside a
// single digraph (きゃ split mid-character across two segments); real
// tokenizer output never does that, since it never splits inside one mora.
export function kanaToRomajiSegments(segments) {
  const list = segments || [];
  const steps = romajiSteps(list.join(''));

  const out = [];
  let stepIndex = 0, inputPos = 0;
  for (const s of list) {
    const target = inputPos + String(s || '').length;
    let piece = '';
    while (inputPos < target && stepIndex < steps.length) {
      const step = steps[stepIndex];
      piece += step.text;
      inputPos += step.chars;
      stepIndex += 1;
    }
    out.push(piece);
  }
  return out;
}
