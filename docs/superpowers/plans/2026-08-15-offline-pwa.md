# Offline PWA Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kotoba Lab open and work with no network connection, and install to an Android home screen as a standalone app.

**Architecture:** A pure module (`js/offline-cache.js`) owns every caching decision — path lists, tier assignment, strategy selection, cache naming — and is tested with plain Node. A thin service worker (`sw.js`) imports it and does nothing but wire those decisions to the Cache API. This mirrors the pure/DOM split the codebase already enforces (`kanji-browser.js` vs `app.js`).

**Tech Stack:** Vanilla ES modules, Service Worker API, Cache API, Web App Manifest. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-15-offline-pwa-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No dependencies and no build step.** Do not add anything to `package.json` except the version bump.
- **No sixth `localStorage` key.** There are exactly five. Cache Storage is a separate browser API and is not persistent app state.
- **All runtime paths must be relative** (`./data/x.json`, never `/data/x.json`). GitHub Pages serves this project from `/kotoba-lab/`, so absolute paths break in production.
- **`sw.js` and `manifest.webmanifest` must live at the repository root.** A service worker's scope is limited to its own directory.
- **Cache name is `kotoba-lab:v${APP_VERSION}`.** Target release is `10.21.0`; `js/app.js` `APP_VERSION` and `package.json` `version` must both say `10.21.0` by the end of this plan.
- **The service worker must never make the app worse than it is today.** Registration failure is a silent no-op: no banner, no console error, no interference with the `#boot-warning` element or its four-second fallback timer.
- **Use design tokens in CSS.** No hardcoded colors. Any new animation needs a matching `prefers-reduced-motion: reduce` rule. Phone controls stay at least 44px high.
- **`npm test` must keep the `node --test "js/*.test.js"` glob and must pass** after every task.

---

### Task 1: Installable icons

Android requires 192×192 and 512×512 PNG icons plus a maskable variant. The existing `favicon.png` is 46×46 — too small. The design is the existing mark: white 言 on a vermilion rounded square.

This task comes first because Task 2's test asserts every precached file exists on disk.

**Files:**
- Create: `assets/icons/icon-192.png`
- Create: `assets/icons/icon-512.png`
- Create: `assets/icons/icon-maskable-512.png`
- Create: `assets/icons/README.md`

**Interfaces:**
- Consumes: nothing
- Produces: three PNG files at the exact paths above, referenced by `manifest.webmanifest` in Task 3 and `PRECACHE_PATHS` in Task 2

- [ ] **Step 1: Start the local server**

```bash
npm run serve
```

Expected: `Kotoba Lab running at http://localhost:5506` (or the next free port). Note the port — the browser step needs it.

- [ ] **Step 2: Open the app in the browser tool**

Navigate the browser to `http://localhost:5506`. This loads the real page, which means Zen Old Mincho is already available to canvas rendering and the icon will match the app's typography.

- [ ] **Step 3: Render the three icons to base64**

Execute this in the page. It draws a vermilion rounded square with a centred white 言 and returns three data URLs. The maskable variant scales the glyph to 62% so it survives Android's circular crop (the safe zone is the centre 80%, and this leaves margin beyond it).

```js
(() => {
  const VERMILION = '#c8443c';
  function draw(size, glyphRatio, radiusRatio) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const r = size * radiusRatio;
    ctx.fillStyle = VERMILION;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(size * glyphRatio)}px "Zen Old Mincho", serif`;
    ctx.fillText('言', size / 2, size / 2 + size * 0.02);
    return c.toDataURL('image/png').split(',')[1];
  }
  return {
    i192: draw(192, 0.72, 0.22),
    i512: draw(512, 0.72, 0.22),
    maskable: draw(512, 0.62, 0.5),
  };
})()
```

Expected: an object with three long base64 strings.

- [ ] **Step 4: Write the PNG files**

Create `assets/icons/`, then write each base64 string to its file. Replace `<BASE64>` with the corresponding value from Step 3.

```bash
mkdir -p assets/icons
node -e "require('fs').writeFileSync('assets/icons/icon-192.png', Buffer.from('<BASE64_i192>','base64'))"
node -e "require('fs').writeFileSync('assets/icons/icon-512.png', Buffer.from('<BASE64_i512>','base64'))"
node -e "require('fs').writeFileSync('assets/icons/icon-maskable-512.png', Buffer.from('<BASE64_maskable>','base64'))"
```

- [ ] **Step 5: Verify the dimensions are correct**

```bash
node -e "for (const f of ['icon-192','icon-512','icon-maskable-512']) { const b=require('fs').readFileSync('assets/icons/'+f+'.png'); console.log(f, b.readUInt32BE(16)+'x'+b.readUInt32BE(20), b.length+' bytes'); }"
```

Expected:
```
icon-192 192x192 <n> bytes
icon-512 512x512 <n> bytes
icon-maskable-512 512x512 <n> bytes
```

If any dimension is wrong, redo Step 3. Do not proceed with wrong sizes — Android silently renders a blurry launcher icon.

- [ ] **Step 6: Look at the icons**

Open each PNG and confirm: the glyph is centred, fully inside the square, white on vermilion, and not clipped. For the maskable variant, confirm the glyph is visibly smaller with generous margin — imagine a circle inscribed in the square; the glyph must sit well inside it.

- [ ] **Step 7: Write the provenance note**

Create `assets/icons/README.md`, matching the existing `assets/alchemy/README.md` convention:

```markdown
# Application icons

Installable PWA icons generated from the original Kotoba Lab mark: a white
言 on a vermilion rounded square, matching `favicon.png`.

- `icon-192.png` — 192×192, Android launcher baseline
- `icon-512.png` — 512×512, splash and store-quality any-purpose icon
- `icon-maskable-512.png` — 512×512, `purpose: maskable`. The glyph is scaled
  to 62% so it survives Android cropping the icon to a circle or squircle.

Rendered with canvas using Zen Old Mincho, the same typeface the application
uses. Original work, covered by the repository's MIT license.
```

- [ ] **Step 8: Commit**

```bash
git add assets/icons
git commit -m "Add installable application icons"
```

---

### Task 2: Pure offline-cache module

All caching decisions live here as pure functions so they can be tested without a browser. `sw.js` (Task 4) and `js/app.js` (Tasks 5 and 6) both import from this module — the path lists exist in exactly one place.

**Files:**
- Create: `js/offline-cache.js`
- Test: `js/offline-cache.test.js`

**Interfaces:**
- Consumes: `assets/icons/*` from Task 1 (existence asserted by test)
- Produces:
  - `CACHE_PREFIX: string` — `'kotoba-lab'`
  - `KUROMOJI_PREFIX: string` — `'vendor/kuromoji/'`
  - `FONT_HOSTS: readonly string[]`
  - `PRECACHE_PATHS: readonly string[]` — every tier-1 path, relative, no leading slash
  - `cacheNameFor(version: string): string`
  - `normalizePath(path: string): string`
  - `cacheTierFor(path: string): 0 | 1 | 2`
  - `strategyFor(path: string): 'shell' | 'asset' | 'network'`
  - `isFontHost(hostname: string): boolean`
  - `isCacheableResponse(response: {ok: boolean, type: string}): boolean`

- [ ] **Step 1: Write the failing test**

Create `js/offline-cache.test.js`:

```js
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
  const onDisk = readdirSync(root + 'js')
    .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
    .map((name) => `js/${name}`)
    .sort();
  const listed = PRECACHE_PATHS.filter((path) => path.startsWith('js/')).sort();
  assert.deepEqual(listed, onDisk);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL with `Cannot find module` for `./offline-cache.js`.

- [ ] **Step 3: Write the implementation**

Create `js/offline-cache.js`:

```js
export const CACHE_PREFIX = 'kotoba-lab';
export const KUROMOJI_PREFIX = 'vendor/kuromoji/';
export const FONT_HOSTS = Object.freeze(['fonts.googleapis.com', 'fonts.gstatic.com']);

const JS_MODULES = Object.freeze([
  'js/analyze.js',
  'js/aozora.js',
  'js/app.js',
  'js/backup.js',
  'js/context.js',
  'js/flashcards.js',
  'js/jlpt.js',
  'js/kanji-alchemy.js',
  'js/kanji-atlas.js',
  'js/kanji-browser.js',
  'js/kanji-labs.js',
  'js/kanji-map.js',
  'js/kanji-network.js',
  'js/kanji-relationships.js',
  'js/kanji-study.js',
  'js/kanjitree.js',
  'js/kanjivg.js',
  'js/offline-cache.js',
  'js/profile-dashboard.js',
  'js/read.js',
  'js/script.js',
  'js/srs.js',
  'js/storage.js',
  'js/study-pack.js',
  'js/text-journey.js',
  'js/tokenizer-kuromoji.js',
  'js/tokenizer.js',
  'js/usage-insights.js',
  'js/usage-journal.js',
  'js/usage-report.js',
]);

const SHELL_PATHS = Object.freeze([
  './',
  'index.html',
  'ui-base.css',
  'palettes/washi-sumi.css',
  'japanese-reader.css',
]);

const ASSET_PATHS = Object.freeze([
  'manifest.webmanifest',
  'favicon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/alchemy/alchemy-icons.svg',
  'assets/alchemy/laboratory-backdrop.webp',
  'data/kanjidic.json',
  'data/jlpt-vocab.json',
  'data/samples.json',
  'data/kanji-families.json',
  'data/kanjivg.json',
]);

export const PRECACHE_PATHS = Object.freeze([...SHELL_PATHS, ...JS_MODULES, ...ASSET_PATHS]);

const PRECACHE_SET = new Set(PRECACHE_PATHS.map((path) => normalizePath(path)));

export function normalizePath(path) {
  return String(path || '').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function cacheNameFor(version) {
  return `${CACHE_PREFIX}:v${String(version || '0.0.0')}`;
}

export function cacheTierFor(path) {
  const clean = normalizePath(path);
  if (PRECACHE_SET.has(clean) || (clean === '' && PRECACHE_SET.has(''))) return 1;
  if (clean.startsWith(KUROMOJI_PREFIX)) return 2;
  return 0;
}

export function strategyFor(path) {
  const clean = normalizePath(path);
  if (clean === '' || clean === 'index.html') return 'shell';
  if (clean.endsWith('.css')) return 'shell';
  if (clean.startsWith('js/') && clean.endsWith('.js')) return 'shell';
  if (clean.startsWith('data/') || clean.startsWith('assets/') || clean.startsWith(KUROMOJI_PREFIX)) return 'asset';
  if (clean === 'favicon.png' || clean === 'manifest.webmanifest') return 'asset';
  return 'network';
}

export function isFontHost(hostname) {
  return FONT_HOSTS.includes(String(hostname || ''));
}

export function isCacheableResponse(response) {
  if (!response || !response.ok) return false;
  return response.type !== 'error' && response.type !== 'opaque';
}
```

Note: `normalizePath('./')` yields `''`, so `SHELL_PATHS`' `'./'` entry normalizes into the set as the empty string, which is what a request for the directory root resolves to.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: all tests pass, total count rises from 220 to 229.

If `every precached path exists on disk` fails, Task 1 was not completed or an icon filename differs. Fix the file, not the test.

- [ ] **Step 5: Commit**

```bash
git add js/offline-cache.js js/offline-cache.test.js
git commit -m "Add pure offline cache policy module"
```

---

### Task 3: Web app manifest and document wiring

**Files:**
- Create: `manifest.webmanifest`
- Modify: `index.html` (head, after the existing `<link rel="icon">` on line 7)

**Interfaces:**
- Consumes: `assets/icons/*` from Task 1
- Produces: an installable manifest at `./manifest.webmanifest`

- [ ] **Step 1: Create the manifest**

Create `manifest.webmanifest` at the repository root. Every path is relative so it works under the `/kotoba-lab/` GitHub Pages subpath.

```json
{
  "name": "Kotoba Lab",
  "short_name": "Kotoba Lab",
  "description": "Japanese reading, kanji exploration, and browser-only study.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#f4efe6",
  "theme_color": "#c8443c",
  "lang": "en",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Link the manifest from the document**

In `index.html`, immediately after the existing line 7 `<link rel="icon" type="image/png" href="favicon.png">`, add:

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#c8443c">
<link rel="apple-touch-icon" href="assets/icons/icon-192.png">
```

- [ ] **Step 3: Verify the manifest parses and resolves**

Start the server and load the page in the browser tool, then run:

```js
fetch('manifest.webmanifest')
  .then((r) => r.json())
  .then((m) => Promise.all(m.icons.map((i) => fetch(i.src).then((r) => `${i.src} ${r.status}`))))
```

Expected: three entries all ending in `200`.

- [ ] **Step 4: Commit**

```bash
git add manifest.webmanifest index.html
git commit -m "Add web app manifest and installable document metadata"
```

---

### Task 4: Service worker

The worker is deliberately thin: it holds no path lists and no policy, only the Cache API wiring around decisions imported from Task 2.

**Files:**
- Create: `sw.js` (repository root)

**Interfaces:**
- Consumes: `PRECACHE_PATHS`, `cacheNameFor`, `strategyFor`, `isFontHost`, `isCacheableResponse` from `js/offline-cache.js`
- Produces: a worker that accepts exactly one message, `{ type: 'SKIP_WAITING' }`

- [ ] **Step 1: Write the worker**

Create `sw.js` at the repository root. `APP_VERSION` is duplicated here rather than imported because `js/app.js` is a DOM module that cannot be imported into a worker context.

```js
import {
  PRECACHE_PATHS,
  cacheNameFor,
  strategyFor,
  isFontHost,
  isCacheableResponse,
} from './js/offline-cache.js';

// Must match APP_VERSION in js/app.js and version in package.json.
const APP_VERSION = '10.21.0';
const CACHE = cacheNameFor(APP_VERSION);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_PATHS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => (name === CACHE ? null : caches.delete(name))));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  throw new Error('offline and uncached');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isFontHost(url.hostname)) {
    event.respondWith(cacheFirst(request).catch(() => fetch(request)));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(request).catch(() => caches.match('./index.html').then((r) => r || Response.error())),
    );
    return;
  }

  const scopePath = new URL('./', self.location).pathname;
  const path = url.pathname.startsWith(scopePath) ? url.pathname.slice(scopePath.length) : url.pathname;
  const strategy = strategyFor(path);

  if (strategy === 'asset') {
    event.respondWith(cacheFirst(request));
  } else if (strategy === 'shell') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
```

Note the `scopePath` calculation: on GitHub Pages the worker lives at `/kotoba-lab/sw.js`, so `url.pathname` is `/kotoba-lab/js/app.js` and must be reduced to `js/app.js` before `strategyFor()` sees it. Locally the scope is `/`, so the same code yields `js/app.js` there too.

- [ ] **Step 2: Verify registration in a browser**

There is no useful offline syntax check here: `node --check` parses `sw.js` as CommonJS and fails on the `import` statement, and the worker cannot execute under Node because `self`, `caches`, and `clients` do not exist. The browser is the only real verification.

Registration is added properly in Task 5. For now, start the server, load the page, and confirm the worker parses and installs by running:

```js
navigator.serviceWorker.register('sw.js', { type: 'module' })
  .then((r) => `registered scope=${r.scope}`)
  .catch((e) => `FAILED: ${e.message}`)
```

Expected: `registered scope=http://localhost:5506/`

Then confirm the precache populated:

```js
caches.open('kotoba-lab:v10.21.0').then((c) => c.keys()).then((k) => k.length)
```

Expected: `47` (5 shell + 30 js + 12 asset paths).

If this number is lower, `cache.addAll` rejected — one path 404s. Check the browser Network tab for the failing URL and fix the path in `js/offline-cache.js`.

- [ ] **Step 3: Unregister before continuing**

```js
navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister())))
```

Leaving a manually registered worker running will confuse Task 5's testing.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "Add service worker with tiered caching strategies"
```

---

### Task 5: Registration and update prompt

**Files:**
- Modify: `js/app.js` — bump `APP_VERSION` on line 89, and append a new registration section near the end of the module
- Modify: `package.json` — version

**Interfaces:**
- Consumes: `sw.js` from Task 4, the existing `toast(msg, kind)` helper at `js/app.js:2069`
- Produces: `registerOfflineWorker()`, called during startup

- [ ] **Step 1: Bump the version in both places**

In `js/app.js` line 89:

```js
const APP_VERSION = '10.21.0';
```

In `package.json`:

```json
  "version": "10.21.0",
```

Confirm `sw.js` already says `10.21.0` from Task 4. All three must match.

- [ ] **Step 2: Add the registration function**

Append to `js/app.js`, before the final startup call:

```js
function promptForUpdate(worker) {
  // The toast helper supports only 'success' and 'error' variants; an update
  // notice is neither, so it uses the neutral default.
  toast('New version ready · reload to update');
  const bar = $('#sw-update');
  if (!bar) return;
  bar.hidden = false;
  $('#sw-update-reload').onclick = () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}

function registerOfflineWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js', { type: 'module' });

      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // A worker reaching "installed" while one already controls the page
          // is an update, not a first install.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            promptForUpdate(installing);
          }
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch {
      // Offline support is optional. An unsupported browser, an insecure
      // context, or disabled workers must leave the application unchanged.
    }
  });
}

registerOfflineWorker();
```

The `try/catch` swallowing the error is deliberate and required by the spec: registration failure must be completely silent.

- [ ] **Step 3: Add the update bar markup**

In `index.html`, immediately before the closing `</body>` tag, alongside the existing `#toast` element:

```html
<div id="sw-update" class="sw-update" role="status" hidden>
  <span>A new version of Kotoba Lab is ready.</span>
  <button type="button" id="sw-update-reload" class="btn btn-primary">Reload</button>
</div>
```

- [ ] **Step 4: Style the update bar**

Append to `japanese-reader.css`, using existing design tokens only:

```css
.sw-update {
  position: fixed;
  left: 50%;
  bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-ink-2);
  animation: sw-update-in 240ms ease-out both;
}

.sw-update button { min-height: 44px; }

@keyframes sw-update-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (max-width: 780px) {
  .sw-update { bottom: calc(var(--tabbar-height) + var(--space-3) + env(safe-area-inset-bottom, 0px)); }
}

@media (prefers-reduced-motion: reduce) {
  .sw-update { animation: none; }
}
```

Before writing this, confirm the token names `--space-3`, `--space-4`, `--surface-raised`, `--border`, `--radius-lg`, `--shadow-ink-2`, and `--tabbar-height` exist:

```bash
grep -c -- "--surface-raised\|--shadow-ink-2\|--tabbar-height" palettes/washi-sumi.css japanese-reader.css ui-base.css
```

If any token does not exist, find the nearest equivalent already used by `.ui-toast` and use that instead. Do not introduce a hardcoded color.

- [ ] **Step 5: Verify offline operation**

Run `npm run serve`, load the page, then in the browser:

```js
navigator.serviceWorker.ready.then((r) => `active=${!!r.active}`)
```

Expected: `active=true`.

Now stop the server (Ctrl-C) and reload the page. Expected: the application loads completely — samples, Analyze, Kanji library, and Radical Tree all work with no server running.

- [ ] **Step 6: Verify tests still pass**

```bash
npm test
```

Expected: 229 passing, 0 failing.

- [ ] **Step 7: Commit**

```bash
git add js/app.js index.html japanese-reader.css package.json
git commit -m "Register the offline worker and prompt for updates"
```

---

### Task 6: Offline section in Profile & Data

**Files:**
- Modify: `index.html` — new section inside the Profile & Data card, after the `usage-journal` section closes on line 462
- Modify: `js/app.js` — render and wire the section
- Modify: `japanese-reader.css` — row styling

**Interfaces:**
- Consumes: `KUROMOJI_PREFIX`, `cacheNameFor` from `js/offline-cache.js`; `APP_VERSION`; the existing `toast()` helper
- Produces: `renderOfflineStatus()`, called on startup and after a download completes

- [ ] **Step 1: Add the markup**

In `index.html`, after line 462's `</section>` closing the usage journal, insert:

```html
<section class="offline-store" aria-labelledby="offline-store-title">
  <div class="usage-journal-head">
    <div><span class="label">INSTALLABLE · WORKS OFFLINE</span><h3 id="offline-store-title">Offline availability</h3></div>
    <span id="offline-store-status" class="badge" data-status="archive">Checking…</span>
  </div>
  <p class="hint">Kotoba Lab stores its own application files so it opens without a connection. This is separate from your study data and is never included in a profile backup.</p>
  <div id="offline-rows" class="offline-rows"></div>
</section>
```

- [ ] **Step 2: Add the render and wiring code**

Append to `js/app.js`, after `registerOfflineWorker()`:

```js
// The browser build plus every dictionary shard kuromoji fetches at runtime.
// cache.addAll needs concrete URLs, so these are listed explicitly.
const KUROMOJI_FILES = [
  './vendor/kuromoji/kuromoji.js',
  './vendor/kuromoji/dict/base.dat.gz',
  './vendor/kuromoji/dict/cc.dat.gz',
  './vendor/kuromoji/dict/check.dat.gz',
  './vendor/kuromoji/dict/tid.dat.gz',
  './vendor/kuromoji/dict/tid_map.dat.gz',
  './vendor/kuromoji/dict/tid_pos.dat.gz',
  './vendor/kuromoji/dict/unk.dat.gz',
  './vendor/kuromoji/dict/unk_char.dat.gz',
  './vendor/kuromoji/dict/unk_compat.dat.gz',
  './vendor/kuromoji/dict/unk_invoke.dat.gz',
  './vendor/kuromoji/dict/unk_map.dat.gz',
  './vendor/kuromoji/dict/unk_pos.dat.gz',
];

async function cachedCount(paths) {
  if (!('caches' in window)) return 0;
  const cache = await caches.open(cacheNameFor(APP_VERSION));
  const found = await Promise.all(paths.map((path) => cache.match(path)));
  return found.filter(Boolean).length;
}

async function renderOfflineStatus() {
  const host = $('#offline-rows');
  const badge = $('#offline-store-status');
  if (!host) return;

  if (!('caches' in window) || !('serviceWorker' in navigator)) {
    badge.textContent = 'Unavailable';
    badge.dataset.status = 'archive';
    host.innerHTML = '<p class="hint">This browser does not support offline storage. Kotoba Lab still works normally with a connection.</p>';
    return;
  }

  const core = await cachedCount(['./index.html', './data/kanjidic.json', './data/kanjivg.json']);
  const kuromoji = await cachedCount(KUROMOJI_FILES);
  const coreReady = core === 3;

  badge.textContent = coreReady ? 'Available offline' : 'Preparing…';
  badge.dataset.status = coreReady ? 'stable' : 'archive';

  host.innerHTML = `
    <div class="offline-row">
      <div><strong>App, dictionaries and stroke data</strong><span class="hint">8.5 MB</span></div>
      <span class="badge" data-status="${coreReady ? 'stable' : 'archive'}">${coreReady ? '✓ Available offline' : 'Downloading…'}</span>
    </div>
    <div class="offline-row">
      <div><strong>Precise tokenizer (optional)</strong><span class="hint">18 MB · only needed for the kuromoji tokenizer</span></div>
      ${kuromoji === KUROMOJI_FILES.length
        ? '<span class="badge" data-status="stable">✓ Available offline</span>'
        : '<button type="button" id="offline-get-kuromoji" class="btn">Download</button>'}
    </div>`;

  const button = $('#offline-get-kuromoji');
  if (button) button.onclick = () => downloadKuromoji(button);
}

async function downloadKuromoji(button) {
  button.disabled = true;
  button.textContent = 'Downloading…';
  try {
    const cache = await caches.open(cacheNameFor(APP_VERSION));
    await cache.addAll(KUROMOJI_FILES);
    toast('Tokenizer available offline', 'success');
  } catch (error) {
    const quota = error && error.name === 'QuotaExceededError';
    toast(quota ? 'Not enough storage for the 18 MB tokenizer' : 'Download failed — try again online', 'error');
  }
  renderOfflineStatus();
}

renderOfflineStatus();
```

Add `cacheNameFor` to the existing import block at the top of `js/app.js`:

```js
import { cacheNameFor } from './offline-cache.js';
```

**Confirm the file list still matches the vendored directory before relying on it:**

```bash
ls vendor/kuromoji/ && ls vendor/kuromoji/dict 2>/dev/null | head -20
```

Expected: `kuromoji.js` plus a `dict/` directory holding exactly the twelve `.dat.gz` shards listed above. `LICENSE-2.0.txt` and `VENDORED.txt` are documentation and are deliberately excluded — they are never fetched at runtime.

If the shard list differs, update `KUROMOJI_FILES` to match the directory exactly. A single missing shard makes `cache.addAll` reject and the whole download fail.

Note that `js/tokenizer-kuromoji.js` loads `kuromoji.js` with a `<script>` tag rather than `fetch`, and kuromoji then requests the shards itself. Both still pass through the worker's `fetch` handler as same-origin GETs under `vendor/kuromoji/`, so they resolve to the `asset` strategy and are cache-first either way.

- [ ] **Step 3: Style the rows**

Append to `japanese-reader.css`:

```css
.offline-rows { display: grid; gap: var(--space-2); margin-top: var(--space-3); }

.offline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
}

.offline-row > div { display: grid; gap: 2px; }
.offline-row button { min-height: 44px; }

@media (max-width: 480px) {
  .offline-row { flex-direction: column; align-items: flex-start; }
  .offline-row button { width: 100%; }
}
```

Verify `--surface-sunken`, `--radius-md`, `--space-2`, and `--space-3` exist before using them, the same way as Task 5 Step 4.

- [ ] **Step 4: Verify the section renders correctly**

Load the page with the server running and open Profile & Data. Expected: the first row reads `✓ Available offline`, the second offers a `Download` button.

Click Download. Expected: the button disables and reads `Downloading…`, then a success toast appears and the row becomes `✓ Available offline`.

Reload the page and confirm the second row still reads `✓ Available offline` — the state is read from the cache, not from any stored flag.

- [ ] **Step 5: Verify no new storage key was introduced**

```bash
grep -n "localStorage" js/app.js | grep -v "kotoba-lab:deck\|kotoba-lab:known-words\|kotoba-lab:known-kanji\|kotoba-lab:review-log\|kotoba-lab:usage-journal"
```

Expected: no output beyond generic storage helpers. If a new key appears, remove it — offline state must be derived from the cache.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 229 passing, 0 failing.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js japanese-reader.css
git commit -m "Show offline availability in Profile and Data"
```

---

### Task 7: Documentation

**Files:**
- Modify: `AGENTS.md` — backlog line, file map, new conventions section, verification list
- Modify: `README.md` — features, install section, project structure, fonts sentence
- Modify: `PRIVACY.md` — Cache Storage paragraph

**Interfaces:**
- Consumes: everything from Tasks 1–6
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Update the AGENTS.md backlog line**

Change the first bullet from `**v10.20.0 current.**` to `**v10.21.0 current.**`, then add after the Radical Alchemy Group C bullet:

```markdown
- Offline PWA support is ✓ Done: a pure `js/offline-cache.js` policy module owns
  the precache list, tier assignment, and per-type strategies while `sw.js` stays
  a thin Cache API shell. Tier 1 precaches the whole default application
  including the stroke artifact; only the opt-in kuromoji tokenizer is held back
  behind a deliberate download in Profile & Data. Updates are version-stamped and
  offered through an explicit reload prompt so no ephemeral session is destroyed.
```

- [ ] **Step 2: Add the AGENTS.md conventions section**

Insert a new section after the `## Desktop layout conventions` section:

```markdown
## Offline and installation conventions

- `sw.js` and `manifest.webmanifest` must stay at the repository root. A service
  worker's scope is its own directory, and Pages serves the project from
  `/kotoba-lab/`.
- All precache paths stay relative. An absolute `/data/...` path resolves outside
  the project subpath in production.
- Keep policy in `js/offline-cache.js` and I/O in `sw.js`. The worker must hold no
  path list of its own.
- **Any release that changes a cached file must bump `APP_VERSION`.** The cache is
  named `kotoba-lab:v${APP_VERSION}` and stale caches are deleted on activate, so
  a forgotten bump ships a permanently stale install.
- `APP_VERSION` appears in `js/app.js`, `sw.js`, and `package.json`. All three
  must match.
- Registration failure is silent. An unsupported browser, insecure context, or
  disabled worker must leave the application exactly as it behaves today and must
  never touch `#boot-warning` or the dictionary-failure banner.
- Never auto-reload on update. Offer the reload and let the learner choose, so an
  open Alchemy, Atlas, or study session is never destroyed.
- Cache Storage holds application files only. It is not study data, adds no
  localStorage key, and must never be written into a profile backup or study pack.
- Offline availability is derived by querying the cache at render time. Do not
  persist a "downloaded" flag.
```

- [ ] **Step 3: Update the AGENTS.md file map**

Add to the `## File map` section:

```markdown
- `js/offline-cache.js` — pure precache list, tier assignment, per-type strategy
  selection, and version-stamped cache naming; no DOM, fetch, or Cache API.
- `sw.js` — thin service worker: precache on install, discard stale caches on
  activate, apply imported strategies on fetch, accept only `SKIP_WAITING`.
- `manifest.webmanifest` — installable metadata; all paths relative.
- `assets/icons/` — 192/512 any-purpose and 512 maskable application icons.
```

- [ ] **Step 4: Extend the AGENTS.md verification list**

Add to the browser QA paragraph in `## Verification`:

```markdown
Offline QA must also cover installing to an Android home screen (icon, standalone
window, maskable crop), launching in airplane mode, Radical Tree opening offline
on an install that never opened it online, the kuromoji download before and
after, an update toast appearing on an `APP_VERSION` bump without auto-reloading,
an interrupted precache leaving the previous version working, and silent
degradation in a browser without module service worker support.
```

- [ ] **Step 5: Update README.md**

Add to the feature list:

```markdown
- **Installable and offline:** install to a phone home screen and open with no
  connection. The application, dictionaries, and stroke data are stored locally;
  the optional precise tokenizer is a separate deliberate download in
  Profile & Data.
```

Correct the existing fonts sentence, which currently says the page requests Google Fonts when online. Replace it with:

```markdown
The application and its language data are committed to this repository. It
does not call an AI service or send pasted text to a backend. Web fonts are
requested from Google Fonts on the first online load and then served from the
local cache; system-font fallbacks keep the application usable when those fonts
are unavailable.
```

Add to the `## Project structure` block:

```text
sw.js                    thin service worker: precache, strategies, updates
manifest.webmanifest     installable metadata
js/offline-cache.js      pure precache list, tiers, and cache-strategy policy
assets/icons/            installable application icons
```

- [ ] **Step 6: Update PRIVACY.md**

Add a section:

```markdown
## Offline storage

Kotoba Lab installs a service worker so it can open without a connection. The
worker stores **application files only** — HTML, CSS, JavaScript, icons, and the
committed dictionary data. It never stores your pasted text, saved words, review
history, or known-kanji state, and Cache Storage is not included in a profile
backup or a study pack.

Because web fonts are cached after the first online load, an installed copy makes
fewer requests to Google Fonts than an uninstalled one, not more.

Clearing site data in your browser removes this cache. The application then
re-downloads its files on the next online visit.
```

- [ ] **Step 7: Verify version consistency**

```bash
grep -n "APP_VERSION = " js/app.js sw.js && grep -n '"version"' package.json && grep -n "v10.21.0 current" AGENTS.md
```

Expected: all four report `10.21.0`.

- [ ] **Step 8: Run the full verification**

```bash
npm test && npm run kanjivg:check
```

Expected: 229 tests passing, and the KanjiVG manifest check reporting matching checksums.

- [ ] **Step 9: Commit**

```bash
git add AGENTS.md README.md PRIVACY.md
git commit -m "Document offline PWA support"
```

---

## Post-implementation manual QA

These require a real Android device and cannot be automated. Run before considering the release done.

- [ ] Deploy to Pages, open on the phone, use Chrome's **Install app**. Confirm the launcher icon is sharp and the app opens in its own window with no address bar.
- [ ] Enable airplane mode and launch from the launcher. Confirm Analyze, Read, Kanji, Relations, Review, and My Words all work.
- [ ] Open Radical Tree offline on an install that never opened it while online. This is the specific failure the two-tier design exists to prevent.
- [ ] Confirm the maskable icon is not clipped — compare the launcher icon against the app switcher, which crops differently.
- [ ] Bump `APP_VERSION`, deploy, reopen. Confirm the update bar appears and that the app does **not** reload until Reload is pressed.
- [ ] Confirm the startup warning still behaves correctly by opening `index.html` directly with `file://` on desktop.
