const STROKE_BANDS = Object.freeze({
  '1-5': [1, 5],
  '6-10': [6, 10],
  '11-15': [11, 15],
  '16-20': [16, 20],
  '21+': [21, Infinity],
});

function readingForm(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[\s、,;；・()（）.]/g, '');
}

function levelRank(level) {
  return level == null ? 5 : 5 - level;
}

function codePointOrder(a, b) {
  return a.char.codePointAt(0) - b.char.codePointAt(0);
}

export function buildKanjiCatalog(kanjiMap) {
  if (!kanjiMap || typeof kanjiMap !== 'object') return [];
  return Object.entries(kanjiMap).map(([char, info]) => {
    const item = {
      char,
      jlpt: Number.isInteger(info?.jlpt) ? info.jlpt : null,
      strokes: Number.isInteger(info?.strokes) ? info.strokes : 0,
      on: info?.on || '',
      kun: info?.kun || '',
      meaning: info?.meaning || '',
    };
    Object.defineProperty(item, '_search', {
      enumerable: false,
      value: readingForm([item.char, item.meaning, item.on, item.kun].join(' ')),
    });
    return item;
  }).sort(codePointOrder);
}

export function filterKanji(catalog, options = {}) {
  const query = readingForm(options.query);
  const levels = new Set((options.levels || []).map(String));
  const band = STROKE_BANDS[options.strokes] || null;
  const knownMode = options.known || 'all';
  const isKnown = typeof options.isKnown === 'function' ? options.isKnown : () => false;

  const rows = catalog.filter((item) => {
    if (query && !item._search.includes(query)) return false;
    if (levels.size) {
      const key = item.jlpt == null ? 'ungraded' : String(item.jlpt);
      if (!levels.has(key)) return false;
    }
    if (band && (item.strokes < band[0] || item.strokes > band[1])) return false;
    if (knownMode === 'known' && !isKnown(item.char)) return false;
    if (knownMode === 'unknown' && isKnown(item.char)) return false;
    return true;
  });

  const sort = options.sort || 'jlpt';
  return rows.sort((a, b) => {
    if (sort === 'strokes') return a.strokes - b.strokes || levelRank(a.jlpt) - levelRank(b.jlpt) || codePointOrder(a, b);
    if (sort === 'meaning') return a.meaning.localeCompare(b.meaning, 'en') || codePointOrder(a, b);
    if (sort === 'kanji') return codePointOrder(a, b);
    return levelRank(a.jlpt) - levelRank(b.jlpt) || a.strokes - b.strokes || codePointOrder(a, b);
  });
}

function strokeGroup(item) {
  if (item.strokes <= 5) return ['1-5', '1–5 strokes'];
  if (item.strokes <= 10) return ['6-10', '6–10 strokes'];
  if (item.strokes <= 15) return ['11-15', '11–15 strokes'];
  if (item.strokes <= 20) return ['16-20', '16–20 strokes'];
  return ['21+', '21+ strokes'];
}

export function groupKanji(rows, mode = 'none') {
  if (mode === 'none') return [{ key: 'all', label: '', rows }];
  const groups = new Map();
  for (const item of rows) {
    const [key, label] = mode === 'strokes'
      ? strokeGroup(item)
      : [item.jlpt == null ? 'ungraded' : `n${item.jlpt}`, item.jlpt == null ? 'Ungraded' : `JLPT N${item.jlpt}`];
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key).rows.push(item);
  }
  const order = mode === 'strokes'
    ? ['1-5', '6-10', '11-15', '16-20', '21+']
    : ['n5', 'n4', 'n3', 'n2', 'n1', 'ungraded'];
  return order.map((key) => groups.get(key)).filter(Boolean);
}
