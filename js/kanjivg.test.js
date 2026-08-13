import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createKanjiVG } from './kanjivg.js';
import { compactPath } from '../tools/build-kanjivg.mjs';

const fixture = {
  elements: ['語', '言', '吾', '一', '⺡', '水'],
  positions: ['left', 'right'],
  kanji: {
    語: [['p1', 'p2', 'p3', 'p4'], [0, 0, 4, [[1, 0, 2, [], 0], [2, 2, 2, [], 1]]]],
    一: [['only'], [3, 0, 1]],
    池: [['water'], [4, 0, 1, [], 0, 5]],
  },
};

test('path compaction preserves negative-zero number separators', () => {
  assert.equal(
    compactPath('M40.01,11.89c0.24,1.61-0.01,2.86-0.84,4.46'),
    'M40,11.9c0.2,1.6-0,2.9-0.8,4.5',
  );
  assert.equal(
    compactPath('M69.62,42.18c0.5,1.7,0.63,3.57-0.01,5.93'),
    'M69.6,42.2c0.5,1.7,0.6,3.6-0,5.9',
  );
});

test('decomposition preserves component shape and position', () => {
  const tree = createKanjiVG(fixture).decompose('語');
  assert.equal(tree.element, '語');
  assert.deepEqual(tree.children.map((node) => [node.element, node.position]), [
    ['言', 'left'], ['吾', 'right'],
  ]);
});

test('strokes stay in source draw order for roots and components', () => {
  const api = createKanjiVG(fixture);
  const tree = api.decompose('語');
  assert.deepEqual(api.strokesOf(tree), ['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(api.strokesOf(tree.children[1]), ['p3', 'p4']);
});

test('missing kanji return null and atomic kanji expose no children', () => {
  const api = createKanjiVG(fixture);
  assert.equal(api.decompose('無'), null);
  const atomic = api.decompose('一');
  assert.equal(atomic.atomic, true);
  assert.deepEqual(atomic.children, []);
});

test('radical-only components retain their original kanji for labelling', () => {
  const radical = createKanjiVG(fixture).decompose('池');
  assert.equal(radical.element, '⺡');
  assert.equal(radical.original, '水');
});

test('depth is capped explicitly instead of silently dropping the branch', () => {
  const data = { elements: ['a', 'b', 'c'], positions: [], kanji: {
    深: [['p'], [0, 0, 1, [[1, 0, 1, [[2, 0, 1]]]]]],
  } };
  const tree = createKanjiVG(data, { maxDepth: 1 }).decompose('深');
  assert.equal(tree.children[0].truncated, true);
  assert.deepEqual(tree.children[0].children, []);
});

test('cyclic in-memory input is guarded', () => {
  const root = [0, 0, 1, []];
  root[3].push(root);
  const tree = createKanjiVG({ elements: ['回'], positions: [], kanji: { 回: [['p'], root] } }).decompose('回');
  assert.equal(tree.children[0].cycle, true);
});

test('the committed artifact matches its pinned-input manifest', async () => {
  const [artifact, familyArtifact, manifestText] = await Promise.all([
    readFile(new URL('../data/kanjivg.json', import.meta.url)),
    readFile(new URL('../data/kanji-families.json', import.meta.url)),
    readFile(new URL('../data/kanjivg.manifest.json', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const digest = createHash('sha256').update(artifact).digest('hex');
  const familyDigest = createHash('sha256').update(familyArtifact).digest('hex');
  assert.equal(artifact.length, manifest.artifact.bytes);
  assert.equal(digest, manifest.artifact.sha256);
  assert.equal(familyArtifact.length, manifest.familyArtifact.bytes);
  assert.equal(familyDigest, manifest.familyArtifact.sha256);

  const data = JSON.parse(artifact);
  assert.equal(data._meta.release, manifest.source.release);
  assert.equal(data._meta.archiveSha256, manifest.source.sha256);
  assert.equal(data._meta.covered + data._meta.missing, data._meta.requested);
  assert.equal(data._meta.requested, 6813);
  const api = createKanjiVG(data);
  assert.match(api.strokesOf(api.decompose('語'))[0], /^M-?\d/);
  assert.deepEqual(api.decompose('語').children.map((node) => node.element), ['言', '吾']);
  assert.equal(api.decompose('一').atomic, true);
  assert.equal(api.decompose('池').children[0].original, '水');

  const families = JSON.parse(familyArtifact);
  assert.equal(families._meta.covered, data._meta.covered);
  const water = families.elements.indexOf('水');
  const pond = families.kanji.池;
  assert.ok(pond[0].includes(water));
});
