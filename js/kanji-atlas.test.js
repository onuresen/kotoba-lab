import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComponentConstellation,
  componentConstellationChoices,
  layoutComponentConstellation,
} from './kanji-atlas.js';

function fixture() {
  const rows = [
    { char: '晴', meaning: 'clear', jlpt: 3, strokes: 12, on: 'セイ', kun: 'は.れる' },
    { char: '清', meaning: 'pure', jlpt: 2, strokes: 11 },
    { char: '情', meaning: 'feeling', jlpt: 3, strokes: 11 },
    { char: '静', meaning: 'quiet', jlpt: 3, strokes: 14 },
  ];
  return {
    byChar: new Map(rows.map((row) => [row.char, row])),
    attributes: new Map([
      ['晴', { component: ['青', '日'] }],
      ['清', { component: ['青'] }],
      ['情', { component: ['青'] }],
      ['静', { component: ['青'] }],
    ]),
    buckets: { component: new Map([['青', rows.map((row) => row.char)], ['日', ['晴']]]) },
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
