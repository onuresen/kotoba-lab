// offline-cache.js — the single source of truth for what Kotoba Lab stores for
// offline use and how each kind of file is served.
//
// This module is pure: no DOM, no fetch, no Cache API, no service worker
// globals. `sw.js` imports it to drive the Cache API, `app.js` imports it to
// name the cache, and the test suite imports it directly under Node. Keeping
// the policy here is what makes offline behavior testable at all — a service
// worker has no `node --test` harness.

export const CACHE_PREFIX = 'kotoba-lab';
export const KUROMOJI_PREFIX = 'vendor/kuromoji/';
export const FONT_HOSTS = Object.freeze(['fonts.googleapis.com', 'fonts.gstatic.com']);

// Every non-test module in js/. app.js has no dynamic imports, so the whole
// graph loads at boot and all of it is tier 1. A test asserts this list matches
// the directory, so a renamed module cannot silently break offline install.
const JS_MODULES = Object.freeze([
  'js/analyze.js',
  'js/aozora.js',
  'js/app.js',
  'js/backup.js',
  'js/compound-words.js',
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
  'js/milestones.js',
  'js/offline-cache.js',
  'js/profile-dashboard.js',
  'js/read.js',
  'js/routing.js',
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
  'js/word-browser.js',
]);

const SHELL_PATHS = Object.freeze([
  './',
  'index.html',
  'ui-base.css',
  'palettes/washi-sumi.css',
  'japanese-reader.css',
]);

// data/kanjivg.json is precached despite staying lazy at runtime. Storing it on
// disk does not make app.js fetch or parse it any earlier, and it removes the
// worst offline failure: Radical Tree working only if the learner happened to
// open it before losing connection.
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

export function normalizePath(path) {
  return String(path || '').replace(/^\.\//, '').replace(/^\/+/, '');
}

const PRECACHE_SET = new Set(PRECACHE_PATHS.map((path) => normalizePath(path)));

export function cacheNameFor(version) {
  return `${CACHE_PREFIX}:v${String(version || '0.0.0')}`;
}

export function cacheTierFor(path) {
  const clean = normalizePath(path);
  if (PRECACHE_SET.has(clean)) return 1;
  if (clean.startsWith(KUROMOJI_PREFIX)) return 2;
  return 0;
}

// Shell files revalidate in the background so a deployed fix cannot be pinned
// forever by a cached copy. Data artifacts are immutable within a release, so
// revalidating 5.85 MB of stroke paths on every load would be pure waste.
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
