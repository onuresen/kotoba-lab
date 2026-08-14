import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDY_PACK_FORMAT,
  STUDY_PACK_VERSION,
  buildStudyPack,
  serializeStudyPack,
  parseStudyPack,
  studyPackFilename,
  studyPackFamily,
} from './study-pack.js';

const T0 = Date.UTC(2026, 7, 14, 9, 0, 0);
const rows = [
  { char: '青', meaning: 'blue; green', on: 'セイ', kun: 'あお', jlpt: 4, strokes: 8 },
  { char: '清', meaning: 'pure', on: 'セイ', kun: 'きよい', jlpt: 3, strokes: 11 },
];

test('study packs carry kanji metadata but no personal progress or source text', () => {
  const pack = buildStudyPack({ title: '青 family', source: 'family', items: rows }, T0, { appVersion: '10.7.0' });
  assert.equal(pack.format, STUDY_PACK_FORMAT);
  assert.equal(pack.version, STUDY_PACK_VERSION);
  assert.equal(pack.appVersion, '10.7.0');
  assert.deepEqual(pack.kanji, rows);
  assert.equal('knownKanji' in pack, false);
  assert.equal('reviewLog' in pack, false);
  assert.equal('text' in pack, false);
});

test('export and parse are deterministic, deduplicated, and sanitized', () => {
  const parsed = parseStudyPack(serializeStudyPack({
    title: '  青 family  ', source: 'relations', items: [...rows, rows[0], { char: 'abc' }, { char: '学', strokes: -2, jlpt: 8 }],
  }, T0));
  assert.equal(parsed.title, '青 family');
  assert.deepEqual(parsed.kanji.map((item) => item.char), ['青', '清', '学']);
  assert.equal(parsed.kanji[2].strokes, 0);
  assert.equal(parsed.kanji[2].jlpt, null);
});

test('foreign, empty, and future packs fail with readable errors', () => {
  assert.throws(() => parseStudyPack('not json'), /valid JSON/);
  assert.throws(() => parseStudyPack('{"format":"other"}'), /not a Kotoba Lab study pack/);
  assert.throws(() => parseStudyPack(JSON.stringify({ format: STUDY_PACK_FORMAT, version: 99, kanji: rows })), /newer version/);
  assert.throws(() => parseStudyPack(JSON.stringify({ format: STUDY_PACK_FORMAT, version: 1, kanji: [] })), /no readable kanji/);
});

test('filenames are safe and packs become ordinary ephemeral study families', () => {
  assert.match(studyPackFilename('青 / 清 family', T0), /^kotoba-青-清-family-\d{4}-\d{2}-\d{2}\.json$/);
  const pack = buildStudyPack({ title: '青 family', items: rows }, T0);
  assert.deepEqual(studyPackFamily(pack), {
    key: 'study-pack:青 family', label: '青 family', rows, totalRows: 2,
  });
  assert.equal(studyPackFamily(null), null);
});
