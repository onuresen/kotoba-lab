# Offline PWA support — design

- **Date:** 2026-08-15
- **Target release:** v10.21.0
- **Status:** approved, ready for implementation planning

## Problem

Kotoba Lab's entire premise is that study happens locally: no accounts, no
backend, no pasted text leaving the browser. Every dictionary it needs is
already a committed static file. Yet the app cannot open without a network
connection, and it cannot be installed to an Android home screen.

This is the largest gap between what the project claims to be and what it is.
Closing it requires no new architecture and no change to the trust model — only
a service worker, a web app manifest, and icons at usable sizes.

## Goals

- The app opens and works with no network, including on a phone in airplane mode.
- The app installs to the Android launcher with its own icon and window.
- The learner can deliberately prepare large optional artifacts for offline use.
- Nothing about the local-first privacy model changes.

## Non-goals

- No Play Store packaging. TWA is parked separately; see the vault note
  *TWA — Packaging PWAs as Play Store Apps*.
- No push notifications, background sync, or any other service worker capability
  beyond caching.
- No sixth `localStorage` key. Cache Storage is a separate browser API and holds
  application files only.
- No build step and no runtime dependencies.

## Architecture

A pure module owns every decision; a thin worker performs the I/O. This mirrors
the split the codebase already enforces (`kanji-browser.js` vs `app.js`,
`kanjivg.js` vs `kanjitree.js`).

| File | Type | Role |
|---|---|---|
| `js/offline-cache.js` | new, pure | Tier lists, `cacheTierFor()`, `cacheNameFor()`, `strategyFor()`. No DOM, fetch, or Cache API. |
| `js/offline-cache.test.js` | new, test | Tier assignment, version stamping, strategy selection, tier-1 files exist on disk |
| `sw.js` | new, repo root | `install` / `activate` / `fetch` / `message`. Imports the pure module and does nothing else. |
| `manifest.webmanifest` | new, repo root | Name, icons, `display: standalone`, theme color, `start_url: "./"` |
| `assets/icons/` | new | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` |
| `index.html` | edit | Manifest link, `theme-color` meta, `apple-touch-icon` |
| `js/app.js` | edit | Registration, update toast, Offline section in Profile & Data |

`sw.js` must sit at the repository root. A service worker's scope is limited to
its own directory, and GitHub Pages serves this project from
`/kotoba-lab/`, so a root-level worker yields exactly the right scope.

The worker registers with `{ type: 'module' }` so it can import the pure module
directly rather than duplicating the tier lists. This requires Chrome 91+ or
Safari 16.4+. Older browsers fail registration and the app behaves exactly as it
does today.

## Cache tiers

Two tiers. Everything the default app can reach is precached; only the opt-in
tokenizer is held back.

| Tier | Contents | Size | Cached when |
|---|---|---|---|
| 1 | `index.html`, 3 CSS files, `palettes/washi-sumi.css`, all 29 non-test `js/*.js`, `favicon.png`, `assets/alchemy/*`, `assets/icons/*`, `manifest.webmanifest`, `data/kanjidic.json`, `data/jlpt-vocab.json`, `data/samples.json`, `data/kanji-families.json`, `data/kanjivg.json` | ~8.5 MB | worker `install` |
| 2 | `vendor/kuromoji/**` | 18 MB | opting into that tokenizer, or explicit download |
| fonts | Google Fonts CSS and woff2 responses | varies with the glyph ranges actually rendered | first online load, runtime |

### Why the stroke artifact is precached

`data/kanjivg.json` is 5.85 MB and AGENTS.md requires it stay lazy at runtime.
Precaching does not violate that rule: the worker stores the file on disk, while
`app.js` still does not fetch, parse, or hold it in memory until a Radical Tree
doorway opens. The runtime laziness the rule protects is unchanged.

What it buys is the removal of an entire class of failure. Under a lazy-cache
model, whether Radical Tree works on a train depends on whether the learner
happened to open it before leaving — an invisible, unpredictable condition. It
also collapses the Offline UI from three states to two and removes one of the
two proactive download paths.

The cost is close to zero. Service worker `install` runs in the background after
the page has already loaded and rendered, so a larger precache does not delay
first paint or first interaction. It is background bandwidth, once per release.

`data/kanji-families.json` is included on the same reasoning at 192 KB: it keeps
Relations, Atlas, Alchemy, and structural families working offline.

### How tier 2 reaches the cache

Two paths, both writing the same cache entry:

- **Passively**, when the learner opts into the kuromoji tokenizer. Cache-first
  for data artifacts stores the response as an ordinary consequence of the
  fetch; the worker does this and no extra code is involved.
- **Proactively**, through the Offline control in Profile & Data. The page
  fetches and writes the entry itself so it can drive its own progress
  indicator.

## Fetch strategy

Strategy is chosen by what a file *is*, which also prevents the classic stale
service worker problem during development.

- **App shell** (`index.html`, CSS, `js/*.js`) — **stale-while-revalidate**.
  Instant from cache, refreshed in the background. Never hard-stuck on old code.
- **Data artifacts** (`data/*.json`, `vendor/kuromoji/**`, fonts, images) —
  **cache-first**. These are immutable within a release; revalidating 5.85 MB
  on every load would be pointless.
- **Everything else** — network, never cached.

Responses are written to cache only when `response.ok` and `response.type` is
not `'error'` or `'opaque'`.

## Versioning and updates

The cache is named `kotoba-lab:v${APP_VERSION}`. On `activate`, any cache whose
name does not match the current version is deleted. `APP_VERSION` in `js/app.js`
is already kept in sync with `package.json` by the existing release ritual, so
invalidation comes for free — with one new rule:

> Any release that changes a cached file must bump `APP_VERSION`.

Update flow, using the existing mobile-safe toast system:

1. New worker installs in the background and enters `waiting`.
2. The page detects this through `registration.updatefound` — a new worker
   reaching `installed` while `navigator.serviceWorker.controller` already
   exists means an update, not a first install.
3. A toast appears: *New version ready · Reload*.
4. Reload posts `SKIP_WAITING` to the waiting worker, then reloads on
   `controllerchange`.

`SKIP_WAITING` is the only message the worker accepts. The learner chooses when
to reload, so no open Alchemy session, Atlas position, or pasted text is ever
destroyed by an update.

## Offline preparation UI

A new **Offline** section in Profile & Data. Because the Cache API is available
to the page, the page performs the tier 2 download itself, writing into the same
cache the worker reads from. No progress messaging between page and worker is
needed, and the worker stays thin.

```
App, dictionaries and stroke data   8.5 MB   ✓ Available offline
Precise tokenizer (optional)         18 MB   Not downloaded   [Download]
```

The first row is status only — it reports the precache result and has no
control, because there is nothing for the learner to decide. The second row is
the single deliberate choice: 18 MB for a tokenizer many learners never enable.

Row state is derived by querying the cache at render time; it is not persisted
anywhere. If the first row ever reports unavailable, the precache failed and the
worker did not activate — which is the honest thing to show.

`navigator.storage.persist()` is requested once on first successful
registration, asking Android not to evict the cache under storage pressure.
A denied request changes nothing and is not surfaced.

## Error handling

The governing rule: **the worker must never make the app worse than it is
today.**

- Registration failure — unsupported browser, insecure context, user has
  disabled workers — is a silent no-op. No banner, no console noise.
- The worker stays entirely out of the `#boot-warning` path. The existing
  four-second fallback and its `file://` behavior are unchanged, and a
  registration failure must never trigger the dictionary-failure banner.
- An offline navigation to an uncached URL falls back to cached `index.html`.
- An uncached data file while offline fails through to the existing
  dictionary-failure banner rather than being swallowed by the worker.
- `QuotaExceededError` during the tier 2 download is caught and reported with
  the artifact's size. Whatever was already cached is left intact; a partial
  cache degrades to a cache miss, which is harmless under cache-first.
- A failed tier-1 precache rejects `install`, so a broken worker never activates
  and the previous version keeps serving. Because tier 1 is now ~8.5 MB, this
  path matters more than it would with a small precache: a flaky connection
  during install must leave the previously working version untouched, not a
  half-populated cache.

## Testing

`js/offline-cache.test.js`, running under the existing
`node --test "js/*.test.js"` glob:

- `cacheTierFor()` assigns shell, data, vendor, and unknown URLs correctly.
- `cacheNameFor()` stamps the version and differs across versions.
- `strategyFor()` returns stale-while-revalidate for shell and cache-first for
  data artifacts.
- Non-`ok`, `error`, and `opaque` responses are rejected by the cacheability
  predicate.
- **Every tier-1 path exists on disk.** This is the failure that would otherwise
  ship silently: a renamed file makes the precache reject, and offline quietly
  stops working for everyone.

Browser QA additions to the AGENTS.md verification list:

- Install to Android home screen; confirm icon, standalone window, and the
  maskable icon surviving a circular crop.
- Launch in airplane mode after install; confirm Analyze, Read, Kanji, Review,
  and My Words all work.
- Radical Tree opens offline on a fresh install that has never opened it online.
- Kuromoji tokenizer offline before and after the tier 2 download.
- Install interrupted mid-precache leaves the previous version working.
- Update toast appears on an `APP_VERSION` bump and does not auto-reload.
- Registration failure degrades silently in an unsupported browser.
- The startup warning still behaves correctly over `http://` and `file://`.

## Documentation changes

- **AGENTS.md** — a new *Offline and installation conventions* section; the
  `APP_VERSION` bump rule; the extended browser-QA list; `sw.js`,
  `manifest.webmanifest`, `js/offline-cache.js`, and `assets/icons/` added to
  the file map.
- **README.md** — an install-and-offline section, and correcting the current
  statement that the page requests Google Fonts when online, which becomes
  first-load-only.
- **PRIVACY.md** — Cache Storage holds application files, not study data; it is
  excluded from profile backups by construction; runtime-caching fonts reduces
  requests to Google rather than adding any.

## Open risks

- **Module service worker support.** Chrome 91+ / Safari 16.4+. Acceptable:
  unsupported browsers degrade to today's behavior.
- **Font URL stability.** Google Fonts serves versioned `gstatic` URLs. If they
  rotate, the cached files remain valid and the next online load caches the new
  ones; the failure mode is a redundant cache entry, not a broken page.
- **Cache eviction on low-storage devices.** Mitigated by `storage.persist()`,
  but not guaranteed. A tier 2 eviction shows as "Not downloaded" again, which
  is honest and recoverable.
- **Repeated 8.5 MB precache across releases.** Every `APP_VERSION` bump
  discards the old cache and refetches everything, including the 5.85 MB stroke
  artifact that rarely changes. Acceptable for a personal tool on a release
  cadence of days, and the download is backgrounded. If release frequency ever
  makes this wasteful, the fix is a per-artifact cache keyed by content rather
  than a single version-stamped cache — explicitly out of scope here.
