import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAtlasChallenges,
  buildAtlasStudyFamily,
  buildComponentConstellation,
  buildConstellationReadingRoutes,
  componentConstellationChoices,
  layoutComponentConstellation,
} from './kanji-atlas.js';

function fixture() {
  const rows = [
    { char: '晴', meaning: 'clear', jlpt: 3, strokes: 12, on: 'セイ', kun: 'は.れる', _onReadings: [{ key: 'せい', display: 'セイ' }] },
    { char: '清', meaning: 'pure', jlpt: 2, strokes: 11, on: 'セイ', _onReadings: [{ key: 'せい', display: 'セイ' }] },
    { char: '情', meaning: 'feeling', jlpt: 3, strokes: 11, on: 'ジョウ', _onReadings: [{ key: 'じょう', display: 'ジョウ' }] },
    { char: '静', meaning: 'quiet', jlpt: 3, strokes: 14, on: 'セイ', _onReadings: [{ key: 'せい', display: 'セイ' }] },
  ];
  return {
    byChar: new Map(rows.map((row) => [row.char, row])),
    attributes: new Map([
      ['晴', { component: ['青', '日'], 'on-reading': ['せい'], 'kun-reading': [] }],
      ['清', { component: ['青'], 'on-reading': ['せい'], 'kun-reading': [] }],
      ['情', { component: ['青'], 'on-reading': ['じょう'], 'kun-reading': [] }],
      ['静', { component: ['青'], 'on-reading': ['せい'], 'kun-reading': [] }],
    ]),
    buckets: {
      component: new Map([['青', rows.map((row) => row.char)], ['日', ['晴']]]),
      'on-reading': new Map([['せい', ['晴', '清', '静']], ['じょう', ['情']]]),
      'kun-reading': new Map(),
    },
  };
}

test('component choices keep only shared direct components', () => {
  assert.deepEqual(componentConstellationChoices(fixture(), '晴'), [{ component: '青', count: 4 }]);
});

test('constellation is deterministic, bounded, and keeps the root visible first', () => {
  const index = fixture();
  const first = buildComponentConstellation(index, '青', { rootChar: '情', limit: 3 });
  const second = buildComponentConstellation(index, '青', { rootChar: '情', limit: 3 });
  assert.deepEqual(first, second);
  assert.equal(first.stars[0].char, '情');
  assert.equal(first.stars.length, 3);
  assert.equal(first.total, 4);
  assert.equal(first.truncated, true);
  assert.equal(first.stars.find((star) => star.char === '晴').on, 'セイ');
  assert.equal(first.stars.find((star) => star.char === '晴').kun, 'は.れる');
});

test('layout stays within the sky and assigns every star exactly once', () => {
  const constellation = buildComponentConstellation(fixture(), '青', { rootChar: '晴' });
  const layout = layoutComponentConstellation(constellation);
  assert.equal(layout.length, constellation.stars.length);
  assert.deepEqual(new Set(layout.map((star) => star.char)), new Set(constellation.stars.map((star) => star.char)));
  assert.ok(layout.every((star) => star.x >= 6 && star.x <= 94 && star.y >= 6 && star.y <= 94));
});

test('reading routes are visible-only, deterministic, explainable, and bounded', () => {
  const index = fixture();
  const stars = buildComponentConstellation(index, '青', { rootChar: '晴' }).stars;
  const first = buildConstellationReadingRoutes(index, stars, { limit: 2 });
  const second = buildConstellationReadingRoutes(index, stars, { limit: 2 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.ok(first.every((route) => route.kind === 'on-reading' && route.key === 'せい'));
  assert.ok(first.every((route) => route.label === 'セイ on’yomi'));
  assert.ok(first.every((route) => stars.some((star) => star.char === route.from) && stars.some((star) => star.char === route.to)));
  assert.equal(new Set(first.map((route) => [route.from, route.to].sort().join(':'))).size, first.length);
  assert.deepEqual(buildConstellationReadingRoutes(index, stars.slice(0, 1)), []);
});

test('Atlas study snapshots only unknown visible stars without persistence metadata', () => {
  const graph = buildComponentConstellation(fixture(), '青', { rootChar: '晴' });
  const family = buildAtlasStudyFamily(graph, (char) => char === '晴' || char === '清');
  assert.equal(family.key, 'atlas:青');
  assert.equal(family.label, '青 constellation · unknown stars');
  assert.deepEqual(family.rows.map((row) => row.char), ['情', '静']);
  assert.equal('progress' in family, false);
  assert.equal(buildAtlasStudyFamily(graph, () => true), null);
});

test('Atlas challenges explain the shared component and a real reading exception', () => {
  const index = fixture();
  const graph = buildComponentConstellation(index, '青', { rootChar: '晴' });
  const routes = buildConstellationReadingRoutes(index, graph.stars);
  const challenges = buildAtlasChallenges(index, graph, routes);
  const component = challenges.find((challenge) => challenge.kind === 'component');
  const exception = challenges.find((challenge) => challenge.kind === 'reading-exception');
  assert.equal(component.answer, '青');
  assert.ok(component.options.includes('青'));
  assert.equal(exception.answer, '情');
  assert.match(exception.prompt, /セイ on’yomi/);
  assert.ok(exception.options.includes('情'));
  assert.deepEqual(buildAtlasChallenges(null, graph, routes), []);
});

test('the full 24-star layout does not overlap desktop cards', () => {
  const stars = Array.from({ length: 24 }, (_, order) => ({ char: String.fromCodePoint(0x4e00 + order), order }));
  const layout = layoutComponentConstellation({ stars });
  // Stage is 980 × 640; star cards are 112 × 68 CSS pixels.
  const boxes = layout.map((star) => ({ x: star.x * 9.8, y: star.y * 6.4 }));
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const overlaps = Math.abs(boxes[left].x - boxes[right].x) < 112
        && Math.abs(boxes[left].y - boxes[right].y) < 68;
      assert.equal(overlaps, false, `stars ${left} and ${right} overlap`);
    }
  }
  const phoneBoxes = layout.map((star) => ({ x: star.x * 8.4, y: star.y * 5.8 }));
  for (let left = 0; left < phoneBoxes.length; left += 1) {
    for (let right = left + 1; right < phoneBoxes.length; right += 1) {
      const overlaps = Math.abs(phoneBoxes[left].x - phoneBoxes[right].x) < 96
        && Math.abs(phoneBoxes[left].y - phoneBoxes[right].y) < 64;
      assert.equal(overlaps, false, `phone stars ${left} and ${right} overlap`);
    }
  }
});

test('missing indexes and components fail quietly', () => {
  assert.equal(buildComponentConstellation(null, '青'), null);
  assert.deepEqual(componentConstellationChoices(fixture(), '山'), []);
});
