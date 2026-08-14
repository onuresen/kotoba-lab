import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutRelationshipNodes, relationshipLane } from './kanji-map.js';

const neighbor = (char, structural = false) => ({ item: { char }, structural });

test('relationship lanes separate structural evidence from reading-only links', () => {
  assert.equal(relationshipLane(neighbor('清', true)), 'structure');
  assert.equal(relationshipLane(neighbor('声', false)), 'reading');
});

test('desktop layout is deterministic, bounded, and keeps nodes inside the canvas', () => {
  const rows = Array.from({ length: 16 }, (_, index) => neighbor(String.fromCodePoint(0x4e00 + index), index % 2 === 0));
  const first = layoutRelationshipNodes(rows);
  const second = layoutRelationshipNodes(rows);
  assert.deepEqual(first, second);
  assert.equal(first.length, 12);
  assert.ok(first.every(({ x, y }) => x >= 10 && x <= 90 && y >= 10 && y <= 90));
});

test('structural and reading nodes occupy opposite arcs', () => {
  const placed = layoutRelationshipNodes([
    neighbor('清', true), neighbor('情', true), neighbor('声'), neighbor('生'),
  ]);
  const structural = placed.filter((row) => row.lane === 'structure');
  const readings = placed.filter((row) => row.lane === 'reading');
  assert.ok(structural.every((row) => row.x < 50));
  assert.ok(readings.every((row) => row.x > 50));
});

test('a single dominant relationship family uses the full circumference', () => {
  const placed = layoutRelationshipNodes(Array.from({ length: 8 }, (_, index) => neighbor(String(index), true)));
  assert.ok(placed.some((row) => row.x < 20));
  assert.ok(placed.some((row) => row.x > 80));
  assert.ok(placed.some((row) => row.y < 20));
  assert.ok(placed.some((row) => row.y > 80));
});
