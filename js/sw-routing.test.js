// Loads the real sw.js under Node with stubbed worker globals.
//
// A service worker cannot be driven by node --test, and the Electron-based
// review browser cannot register one at all, so this is the only automated
// check that sw.js parses, resolves its import, and routes requests the way the
// policy module intends. It deliberately does not test the Cache API itself —
// that still needs a real browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const handlers = {};
let skipWaitingCalled = false;
let deletedCaches = [];
let cacheKeys = [];

globalThis.self = {
  addEventListener: (type, fn) => { handlers[type] = fn; },
  location: new URL('http://localhost:5506/sw.js'),
  clients: { claim: async () => {} },
  skipWaiting: () => { skipWaitingCalled = true; },
};
globalThis.caches = {
  open: async () => ({ addAll: async () => {}, put: async () => {} }),
  keys: async () => cacheKeys,
  delete: async (name) => { deletedCaches.push(name); return true; },
  match: async () => null,
};
globalThis.fetch = async () => ({ ok: true, type: 'basic', clone: () => ({}) });
globalThis.Response = { error: () => ({ error: true }) };

await import('../sw.js');

function routes(url, mode = 'no-cors', method = 'GET') {
  let intercepted = false;
  handlers.fetch({
    request: { url, method, mode },
    respondWith: () => { intercepted = true; },
  });
  return intercepted;
}

test('the worker wires every lifecycle handler', () => {
  assert.deepEqual(Object.keys(handlers).sort(), ['activate', 'fetch', 'install', 'message']);
});

test('application files, navigations, and fonts are intercepted', () => {
  assert.equal(routes('http://localhost:5506/js/app.js'), true);
  assert.equal(routes('http://localhost:5506/japanese-reader.css'), true);
  assert.equal(routes('http://localhost:5506/data/kanjivg.json'), true);
  assert.equal(routes('http://localhost:5506/vendor/kuromoji/dict/base.dat.gz'), true);
  assert.equal(routes('http://localhost:5506/', 'navigate'), true);
  assert.equal(routes('https://fonts.gstatic.com/s/zenoldmincho/x.woff2'), true);
  assert.equal(routes('https://fonts.googleapis.com/css2?family=DM+Sans'), true);
});

test('third-party origins and unrouted paths pass through untouched', () => {
  assert.equal(routes('https://example.com/tracker.js'), false);
  assert.equal(routes('http://localhost:5506/some/other.txt'), false);
});

test('only GET requests are ever intercepted', () => {
  assert.equal(routes('http://localhost:5506/js/app.js', 'no-cors', 'POST'), false);
  assert.equal(routes('http://localhost:5506/js/app.js', 'no-cors', 'HEAD'), false);
});

test('activate discards stale version caches and keeps the current one', async () => {
  deletedCaches = [];
  cacheKeys = ['kotoba-lab:v10.19.0', 'kotoba-lab:v10.20.0', 'kotoba-lab:v10.21.0', 'unrelated-cache'];
  await new Promise((resolve) => handlers.activate({ waitUntil: (p) => p.then(resolve) }));
  assert.deepEqual(deletedCaches.sort(), ['kotoba-lab:v10.19.0', 'kotoba-lab:v10.20.0', 'unrelated-cache']);
});

test('the worker accepts only the SKIP_WAITING message', () => {
  skipWaitingCalled = false;
  handlers.message({ data: { type: 'CLEAR_EVERYTHING' } });
  handlers.message({ data: null });
  handlers.message({});
  assert.equal(skipWaitingCalled, false);
  handlers.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(skipWaitingCalled, true);
});

// The cache is named from APP_VERSION, and activate deletes every cache that
// does not match. A forgotten bump therefore ships a permanently stale install,
// so the three declarations must never drift apart.
test('APP_VERSION matches across sw.js, app.js, and package.json', () => {
  const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')).version;
  const inWorker = readFileSync(`${root}sw.js`, 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/);
  const inApp = readFileSync(`${root}js/app.js`, 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/);
  assert.ok(inWorker, 'sw.js declares APP_VERSION');
  assert.ok(inApp, 'js/app.js declares APP_VERSION');
  assert.equal(inWorker[1], pkg, 'sw.js APP_VERSION must match package.json');
  assert.equal(inApp[1], pkg, 'js/app.js APP_VERSION must match package.json');
});
