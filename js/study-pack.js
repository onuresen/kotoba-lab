// Portable, non-persistent kanji collections. Study packs deliberately contain
// no schedules, known-state, review history, pasted text, or saved sentences.

export const STUDY_PACK_FORMAT = 'kotoba-lab-study-pack';
export const STUDY_PACK_VERSION = 1;

const isObj = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanItem(raw) {
  if (!isObj(raw)) return null;
  const char = cleanText(raw.char);
  if ([...char].length !== 1 || !/\p{Script=Han}/u.test(char)) return null;
  const jlpt = Number.isInteger(raw.jlpt) && raw.jlpt >= 1 && raw.jlpt <= 5 ? raw.jlpt : null;
  const strokes = Number.isInteger(raw.strokes) && raw.strokes > 0 ? raw.strokes : 0;
  return {
    char,
    meaning: cleanText(raw.meaning),
    on: cleanText(raw.on),
    kun: cleanText(raw.kun),
    jlpt,
    strokes,
  };
}

function cleanItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(cleanItem)
    .filter((item) => item && !seen.has(item.char) && seen.add(item.char));
}

export function buildStudyPack({ title, source = 'custom', items = [] } = {}, now = Date.now(), { appVersion = '' } = {}) {
  return {
    format: STUDY_PACK_FORMAT,
    version: STUDY_PACK_VERSION,
    exportedAt: new Date(now).toISOString(),
    appVersion: cleanText(appVersion),
    title: cleanText(title) || 'Kotoba Lab study pack',
    source: cleanText(source) || 'custom',
    kanji: cleanItems(items),
  };
}

export function serializeStudyPack(input, now = Date.now(), options = {}) {
  return JSON.stringify(buildStudyPack(input, now, options), null, 2);
}

export function parseStudyPack(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isObj(raw) || raw.format !== STUDY_PACK_FORMAT) {
    throw new Error('That JSON is not a Kotoba Lab study pack.');
  }
  if (Number(raw.version) > STUDY_PACK_VERSION) {
    throw new Error(`That study pack was written by a newer version (v${raw.version}).`);
  }
  const exportedAt = typeof raw.exportedAt === 'string' && Number.isFinite(Date.parse(raw.exportedAt)) ? Date.parse(raw.exportedAt) : null;
  const pack = buildStudyPack({ title: raw.title, source: raw.source, items: raw.kanji }, exportedAt ?? 0, { appVersion: raw.appVersion });
  if (exportedAt == null) pack.exportedAt = '';
  if (!pack.kanji.length) throw new Error('That study pack contains no readable kanji.');
  return pack;
}

export function studyPackFilename(title, now = Date.now()) {
  const slug = cleanText(title).toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'study-pack';
  return `kotoba-${slug}-${new Date(now).toLocaleDateString('en-CA')}.json`;
}

export function studyPackFamily(pack) {
  if (!pack?.kanji?.length) return null;
  return {
    key: `study-pack:${pack.title}`,
    label: pack.title,
    rows: pack.kanji,
    totalRows: pack.kanji.length,
  };
}
