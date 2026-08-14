import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiNetwork, layoutKanjiNetwork } from './kanji-network.js';

function fixture(size = 50) {
  const chars = Array.from({ length: size }, (_, index) => String.fromCodePoint(0x4e00 + index));
  return (char) => {
    const centerIndex = chars.indexOf(char);
    if (centerIndex < 0) return null;
    return {
      center: { char, meaning: `kanji ${centerIndex}`, strokes: 4 + centerIndex % 12, jlpt: 5 - centerIndex % 5 },
      neighbors: chars.filter((candidate) => candidate !== char).map((candidate, index) => ({
        item: { char: candidate, meaning: candidate, strokes: 5, jlpt: 3 },
        reasons: [{ kind: index % 2 ? 'on-reading' : 'component', label: index % 2 ? 'セイ on’yomi' : '青 component' }],
        strongestKind: index % 2 ? 'on-reading' : 'component',
        structural: index % 2 === 0,
      })),
      truncated: true,
    };
  };
}

test('two-hop networks are deterministic and stay inside the node budget', () => {
  const getRelationships = fixture();
  const first = buildKanjiNetwork(getRelationships, '一');
  const second = buildKanjiNetwork(getRelationships, '一');
  assert.deepEqual(first, second);
  assert.ok(first.nodes.length <= 36);
  assert.ok(first.nodes.every((node) => node.depth >= 0 && node.depth <= 2));
  assert.equal(first.nodes.filter((node) => node.depth === 0).length, 1);
});

test('expanding a branch adds second-hop context without changing the root', () => {
  const getRelationships = fixture();
  const compact = buildKanjiNetwork(getRelationships, '一');
  const branch = compact.firstHop[0];
  const expanded = buildKanjiNetwork(getRelationships, '一', { expanded: [branch] });
  assert.equal(expanded.root, compact.root);
  assert.ok(expanded.nodes.length > compact.nodes.length);
  assert.ok(expanded.nodes.length <= expanded.maxNodes);
  assert.deepEqual(expanded.expanded, [branch]);
});

test('layout keeps structural and reading clusters on opposite sides', () => {
  const graph = buildKanjiNetwork(fixture(), '一');
  assert.ok(graph.nodes.some((node) => node.depth === 1 && node.cluster === 'structure'));
  assert.ok(graph.nodes.some((node) => node.depth === 1 && node.cluster === 'reading'));
  const layout = layoutKanjiNetwork(graph);
  assert.ok(layout.every((node) => node.x >= 7 && node.x <= 93 && node.y >= 8 && node.y <= 92));
  assert.ok(layout.filter((node) => node.cluster === 'structure').every((node) => node.x < 50));
  assert.ok(layout.filter((node) => node.cluster === 'reading').every((node) => node.x > 50));
  assert.deepEqual(layout, layoutKanjiNetwork(graph));
});

test('missing roots fail safely', () => {
  assert.equal(buildKanjiNetwork(fixture(), '無'), null);
  assert.equal(buildKanjiNetwork(null, '一'), null);
  assert.deepEqual(layoutKanjiNetwork(null), []);
});
