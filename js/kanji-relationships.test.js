import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiCatalog, buildKanjiStructureIndex } from './kanji-browser.js';
import { buildKanjiRelationshipIndex, buildKanjiRelationships } from './kanji-relationships.js';

function fixture() {
  const catalog = buildKanjiCatalog({
    清: { jlpt: 3, strokes: 11, on: 'セイ', kun: 'きよ（い）', meaning: 'pure' },
    晴: { jlpt: 3, strokes: 12, on: 'セイ', kun: 'は（れる）', meaning: 'clear weather' },
    情: { jlpt: 3, strokes: 11, on: 'ジョウ、セイ', kun: 'なさ（け）', meaning: 'feeling' },
    精: { jlpt: 2, strokes: 14, on: 'セイ', meaning: 'refined' },
    海: { jlpt: 4, strokes: 9, on: 'カイ', kun: 'うみ', meaning: 'sea' },
    湖: { jlpt: 2, strokes: 12, on: 'コ', kun: 'みずうみ', meaning: 'lake' },
    声: { jlpt: 4, strokes: 7, on: 'セイ', kun: 'こえ', meaning: 'voice' },
  });
  const structure = buildKanjiStructureIndex({
    elements: ['水', '氵', '青', '日', '忄', '心', '糸', '胡'],
    kanji: {
      清: [[0], [1, 2]],
      晴: [[3], [3, 2]],
      情: [[5], [4, 2]],
      精: [[6], [6, 2]],
      海: [[0], [1]],
      湖: [[0], [1, 7]],
      声: [[], []],
    },
  });
  return buildKanjiRelationshipIndex(catalog, structure);
}

test('relationship index combines dictionary readings with compact structural evidence', () => {
  const index = fixture();
  assert.equal(index.size, 7);
  assert.deepEqual(index.attributes.get('清'), {
    radical: ['水'], component: ['氵', '青'], 'on-reading': ['せい'], 'kun-reading': ['きよい'],
  });
  assert.deepEqual(index.buckets.component.get('青'), ['情', '晴', '清', '精']);
});

test('neighbors combine several explainable reasons and rank stronger evidence first', () => {
  const map = buildKanjiRelationships(fixture(), '清');
  assert.equal(map.center.char, '清');
  assert.equal(map.neighbors[0].item.char, '湖');
  const clearWeather = map.neighbors.find((neighbor) => neighbor.item.char === '晴');
  assert.deepEqual(clearWeather.reasons.map((reason) => reason.kind), ['component', 'on-reading', 'stroke']);
  assert.deepEqual(clearWeather.reasons.map((reason) => reason.label), ['青 component', 'セイ on’yomi', '1-stroke difference']);
  assert.equal(map.neighbors.find((neighbor) => neighbor.item.char === '海').structural, true);
  assert.equal(map.neighbors.find((neighbor) => neighbor.item.char === '声').readingOnly, true);
});

test('canonical radical and visual component remain distinct evidence', () => {
  const map = buildKanjiRelationships(fixture(), '清');
  const sea = map.neighbors.find((neighbor) => neighbor.item.char === '海');
  assert.deepEqual(sea.reasons.map((reason) => [reason.kind, reason.key]), [
    ['radical', '水'], ['component', '氵'],
  ]);
});

test('stroke proximity strengthens a real connection but never creates one', () => {
  const map = buildKanjiRelationships(fixture(), '清');
  assert.equal(map.neighbors.some((neighbor) => neighbor.item.char === '湖'), true);
  assert.equal(map.neighbors.some((neighbor) => neighbor.item.char === '晴'), true);

  const isolatedCatalog = buildKanjiCatalog({
    山: { strokes: 3, on: 'サン', meaning: 'mountain' },
    川: { strokes: 3, on: 'セン', meaning: 'river' },
  });
  const isolatedMap = buildKanjiRelationships(buildKanjiRelationshipIndex(isolatedCatalog), '山');
  assert.deepEqual(isolatedMap.neighbors, []);
});

test('reading-only neighbors are bounded without hiding multi-evidence neighbors', () => {
  const entries = { 中: { strokes: 4, on: 'チュウ', meaning: 'middle' } };
  for (let i = 0; i < 12; i += 1) {
    entries[String.fromCodePoint(0x4e10 + i)] = { strokes: 8 + (i % 3), on: 'チュウ', meaning: `reading neighbor ${i}` };
  }
  const catalog = buildKanjiCatalog(entries);
  const map = buildKanjiRelationships(buildKanjiRelationshipIndex(catalog), '中', { limit: 20, readingOnlyLimit: 3 });
  assert.equal(map.neighbors.length, 3);
  assert.equal(map.totalCandidates, 12);
  assert.equal(map.truncated, true);
  assert.deepEqual(map.neighbors.map((neighbor) => neighbor.item.char), catalog.filter((item) => item.char !== '中').slice(0, 3).map((item) => item.char));
});

test('limits and missing centers are deterministic and safe', () => {
  const index = fixture();
  assert.equal(buildKanjiRelationships(index, '無'), null);
  const first = buildKanjiRelationships(index, '清', { limit: 2 });
  const second = buildKanjiRelationships(index, '清', { limit: 2 });
  assert.deepEqual(first.neighbors.map((neighbor) => neighbor.item.char), second.neighbors.map((neighbor) => neighbor.item.char));
  assert.equal(first.neighbors.length, 2);
  assert.equal(first.truncated, true);
});
