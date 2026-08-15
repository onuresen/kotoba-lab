import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CACHE_PREFIX,
  KUROMOJI_PREFIX,
  PRECACHE_PATHS,
  cacheNameFor,
  normalizePath,
  cacheTierFor,
  strategyFor,
  isFontHost,
  isCacheableResponse,
} from './offline-cache.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('cache names are stamped with the application version', () => {
  assert.equal(cacheNameFor('10.21.0'), `${CACHE_PREFIX}:v10.21.0`);
  assert.notEqual(cacheNameFor('10.21.0'), cacheNameFor('10.22.0'));
});

test('paths normalize to a bare relative form', () => {
  assert.equal(normalizePath('./data/kanjidic.json'), 'data/kanjidic.json');
  assert.equal(normalizePath('/kotoba-lab/js/app.js'), 'kotoba-lab/js/app.js');
  assert.equal(normalizePath(''), '');
  assert.equal(normalizePath(null), '');
});

test('tier 1 covers the whole default application including stroke data', () => {
  assert.equal(cacheTierFor('js/app.js'), 1);
  assert.equal(cacheTierFor('./index.html'), 1);
  assert.equal(cacheTierFor('data/kanjidic.json'), 1);
  assert.equal(cacheTierFor('data/kanji-families.json'), 1);
  assert.equal(cacheTierFor('data/kanjivg.json'), 1);
  assert.equal(cacheTierFor('assets/icons/icon-512.png'), 1);
});

test('tier 2 is the opt-in tokenizer only, and unknown paths are untiered', () => {
  assert.equal(cacheTierFor('vendor/kuromoji/dict/base.dat.gz'), 2);
  assert.equal(cacheTierFor(`${KUROMOJI_PREFIX}kuromoji.js`), 2);
  assert.equal(cacheTierFor('js/app.test.js'), 0);
  assert.equal(cacheTierFor('some/other/thing.txt'), 0);
});

test('the shell revalidates while data artifacts are served cache-first', () => {
  assert.equal(strategyFor('index.html'), 'shell');
  assert.equal(strategyFor(''), 'shell');
  assert.equal(strategyFor('js/kanji-atlas.js'), 'shell');
  assert.equal(strategyFor('japanese-reader.css'), 'shell');
  assert.equal(strategyFor('palettes/washi-sumi.css'), 'shell');
  assert.equal(strategyFor('data/kanjivg.json'), 'asset');
  assert.equal(strategyFor('vendor/kuromoji/dict/base.dat.gz'), 'asset');
  assert.equal(strategyFor('assets/icons/icon-192.png'), 'asset');
  assert.equal(strategyFor('favicon.png'), 'asset');
  assert.equal(strategyFor('some/other/thing.txt'), 'network');
});

test('only Google font hosts are treated as font requests', () => {
  assert.equal(isFontHost('fonts.googleapis.com'), true);
  assert.equal(isFontHost('fonts.gstatic.com'), true);
  assert.equal(isFontHost('example.com'), false);
  assert.equal(isFontHost(''), false);
});

test('failed, errored, and opaque responses are never cached', () => {
  assert.equal(isCacheableResponse({ ok: true, type: 'basic' }), true);
  assert.equal(isCacheableResponse({ ok: true, type: 'cors' }), true);
  assert.equal(isCacheableResponse({ ok: false, type: 'basic' }), false);
  assert.equal(isCacheableResponse({ ok: true, type: 'error' }), false);
  assert.equal(isCacheableResponse({ ok: true, type: 'opaque' }), false);
  assert.equal(isCacheableResponse(null), false);
});

test('every precached path exists on disk', () => {
  for (const path of PRECACHE_PATHS) {
    if (path === './') continue;
    assert.ok(existsSync(root + path), `missing precache file: ${path}`);
  }
});

test('the precache list stays in sync with the js module directory', () => {
  const onDisk = readdirSync(`${root}js`)
    .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
    .map((name) => `js/${name}`)
    .sort();
  const listed = PRECACHE_PATHS.filter((path) => path.startsWith('js/')).sort();
  assert.deepEqual(listed, onDisk);
});
