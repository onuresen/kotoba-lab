# Back-button and URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the back gesture close an open overlay or step back a tab, instead of exiting the installed app.

**Architecture:** A pure `js/routing.js` owns hash parsing and the tab/route vocabulary split; `js/app.js` wires `pushState`, `popstate`, and overlay sentinel entries. Overlays gain an `onClose` callback so the app can tell when a user dismissed one and consume its sentinel.

**Tech Stack:** Vanilla ES modules, History API, hash routing. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-15-history-routing-design.md`

## Descoped during execution

**Task 3 (overlay sentinels) was not implemented.** The sentinel machinery —
a depth counter plus two re-entrancy guards — carried real risk of stranding a
history entry in ways unit tests cannot catch, for a benefit the overlays'
existing Close buttons already provide. Shipped scope is tabs only.

Overlays remain unrouted. If closing them with the back gesture proves to matter
on a phone, it is a separate, self-contained addition.

## Original deviation from the spec

The spec listed **three** participating overlays. This plan implements **two**: Radical Tree and the full-screen Relationship Map. The Read info sheet is excluded, for two reasons found while planning:

1. `setInfoSheet(false)` is called from the tab-switch path at `js/app.js:2049` and `js/app.js:2080`. If the sheet consumed a sentinel, **every tab switch would fire a spurious `history.back()`**.
2. It is not trapping anyone: `js/app.js:2109` dismisses it by tapping the scrim, which is already a natural phone gesture. The full-screen overlays have no tap-outside dismissal, which is what made them the real problem.

## Global Constraints

Every task's requirements implicitly include this section.

- **No dependencies and no build step.**
- **No new `localStorage` key.** The route lives in the URL and history only.
- **Hash routing only.** Never `pushState` a new pathname: `/kotoba-lab/kanji` 404s on GitHub Pages and would route tab switches through the service worker's navigate handler.
- **The route name for the `profile` tab is `settings`.** `#profile` is not a valid route.
- **Routing must not touch `#boot-warning`** or its four-second fallback. It is applied after boot, exactly as service-worker registration is.
- **`npm test` must keep the `node --test "js/*.test.js"` glob and must pass** after every task. Baseline is 238 passing.
- Target release is **v10.23.0**. `js/app.js`, `sw.js`, and `package.json` must all say `10.23.0` by the end, or `js/sw-routing.test.js` fails.

---

### Task 1: Pure routing module

**Files:**
- Create: `js/routing.js`
- Test: `js/routing.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ROUTABLE_TABS: readonly string[]` — the seven internal tab names
  - `isRoutableTab(name): boolean`
  - `tabToRoute(tab): string` — `'profile'` → `'settings'`
  - `routeToTab(route): string` — `'settings'` → `'profile'`
  - `parseRoute(hash): { tab: string }` — returns the **internal** tab name
  - `routeToHash(tab): string` — takes the **internal** tab name

- [ ] **Step 1: Write the failing test**

Create `js/routing.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTABLE_TABS,
  isRoutableTab,
  tabToRoute,
  routeToTab,
  parseRoute,
  routeToHash,
} from './routing.js';

test('every application tab is routable', () => {
  assert.deepEqual([...ROUTABLE_TABS].sort(),
    ['analyze', 'kanji', 'mywords', 'profile', 'read', 'relations', 'review']);
});

test('hashes parse in every shape a URL bar can produce', () => {
  assert.equal(parseRoute('#kanji').tab, 'kanji');
  assert.equal(parseRoute('kanji').tab, 'kanji');
  assert.equal(parseRoute('#/kanji').tab, 'kanji');
  assert.equal(parseRoute('#KANJI').tab, 'kanji');
});

test('unknown, empty, and malformed hashes fall back to analyze', () => {
  assert.equal(parseRoute('').tab, 'analyze');
  assert.equal(parseRoute('#').tab, 'analyze');
  assert.equal(parseRoute('#nonsense').tab, 'analyze');
  assert.equal(parseRoute(null).tab, 'analyze');
  assert.equal(parseRoute(undefined).tab, 'analyze');
  assert.equal(parseRoute(42).tab, 'analyze');
});

test('the profile tab is reached only through the settings route', () => {
  assert.equal(parseRoute('#settings').tab, 'profile');
  assert.equal(routeToHash('profile'), '#settings');
  // The internal name must not work as a URL, or two URLs would mean one view.
  assert.equal(parseRoute('#profile').tab, 'analyze');
});

test('route and tab names translate both ways and leave others alone', () => {
  assert.equal(tabToRoute('profile'), 'settings');
  assert.equal(routeToTab('settings'), 'profile');
  assert.equal(tabToRoute('kanji'), 'kanji');
  assert.equal(routeToTab('kanji'), 'kanji');
});

test('hashes round-trip for every routable tab', () => {
  for (const tab of ROUTABLE_TABS) {
    assert.equal(parseRoute(routeToHash(tab)).tab, tab, `round trip failed for ${tab}`);
  }
});

test('isRoutableTab rejects unknown names and non-strings', () => {
  assert.equal(isRoutableTab('kanji'), true);
  assert.equal(isRoutableTab('settings'), false); // a route name, not a tab name
  assert.equal(isRoutableTab('nonsense'), false);
  assert.equal(isRoutableTab(null), false);
  assert.equal(isRoutableTab(7), false);
});

test('routeToHash falls back rather than emitting an unreachable URL', () => {
  assert.equal(routeToHash('nonsense'), '#analyze');
  assert.equal(routeToHash(null), '#analyze');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL with `Cannot find module` for `./routing.js`.

- [ ] **Step 3: Write the implementation**

Create `js/routing.js`:

```js
// routing.js — the hash-route vocabulary, kept pure so it can be tested without
// a browser. Two vocabularies meet here and nowhere else:
//
//   tab name   internal, used by switchTab() and data-tab  ... 'profile'
//   route name what the user sees in the URL               ... 'settings'
//
// app.js only ever handles tab names.

export const ROUTABLE_TABS = Object.freeze([
  'analyze', 'read', 'kanji', 'relations', 'review', 'mywords', 'profile',
]);

const DEFAULT_TAB = 'analyze';
const TAB_TO_ROUTE = Object.freeze({ profile: 'settings' });
const ROUTE_TO_TAB = Object.freeze({ settings: 'profile' });

export function isRoutableTab(name) {
  return typeof name === 'string' && ROUTABLE_TABS.includes(name);
}

export function tabToRoute(tab) {
  return Object.prototype.hasOwnProperty.call(TAB_TO_ROUTE, tab) ? TAB_TO_ROUTE[tab] : tab;
}

export function routeToTab(route) {
  return Object.prototype.hasOwnProperty.call(ROUTE_TO_TAB, route) ? ROUTE_TO_TAB[route] : route;
}

export function parseRoute(hash) {
  const raw = String(hash ?? '').replace(/^#/, '').replace(/^\//, '').trim().toLowerCase();
  // A tab that has its own route name must not also answer to its internal
  // name, or one view would have two URLs.
  if (Object.prototype.hasOwnProperty.call(TAB_TO_ROUTE, raw)) return { tab: DEFAULT_TAB };
  const tab = routeToTab(raw);
  return { tab: isRoutableTab(tab) ? tab : DEFAULT_TAB };
}

export function routeToHash(tab) {
  return `#${tabToRoute(isRoutableTab(tab) ? tab : DEFAULT_TAB)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: 246 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add js/routing.js js/routing.test.js
git commit -m "Add pure hash-route module"
```

---

### Task 2: Tab history

**Files:**
- Modify: `js/app.js` — import, `switchTab()`, `popstate` handler, initial route

**Interfaces:**
- Consumes: `parseRoute`, `routeToHash` from `js/routing.js`
- Produces: `switchTab(name, push = true)` and a module-level `currentTab`, both used by Task 3

- [ ] **Step 1: Import the module**

Add beside the other imports at the top of `js/app.js`, next to the existing `import { cacheNameFor } from './offline-cache.js';`:

```js
import { parseRoute, routeToHash } from './routing.js';
```

- [ ] **Step 2: Track the current tab and push history**

`switchTab` is declared at `js/app.js:2043` as `function switchTab(name) {`.

Add a module-level declaration immediately above it:

```js
let currentTab = 'analyze';
```

Change the signature to accept a push flag:

```js
function switchTab(name, push = true) {
```

Then, at the very end of `switchTab`'s body — after every existing statement, immediately before its closing brace — add:

```js
  // Arriving somewhere is navigation whether the user clicked a tab or followed
  // an in-app link, so both create history. Re-selecting the active tab does not.
  if (push && name !== currentTab) {
    history.pushState({ tab: name }, '', routeToHash(name));
  }
  currentTab = name;
```

- [ ] **Step 3: Restore the tab on popstate**

Add near the bottom of `js/app.js`, immediately before the final `boot();` call:

```js
window.addEventListener('popstate', (event) => {
  // state is null after a browser session restore, so fall back to the URL.
  const tab = event.state?.tab || parseRoute(location.hash).tab;
  switchTab(tab, false);
});
```

Task 3 replaces this handler with one that checks overlays first. It is written plainly here so this task is independently testable.

- [ ] **Step 4: Apply the route on load**

Add immediately after the `popstate` listener:

```js
function applyInitialRoute() {
  const { tab } = parseRoute(location.hash);
  // Exactly one entry for the entry point, so back from it leaves the app.
  history.replaceState({ tab }, '', routeToHash(tab));
  // boot() already renders Analyze as active; only move if the URL asks for
  // something else, so an ordinary load records no extra usage event.
  if (tab !== 'analyze') switchTab(tab, false);
  currentTab = tab;
}
```

Then call it after `boot();` by changing the tail of the file from:

```js
boot();
registerOfflineWorker();
renderOfflineStatus();
```

to:

```js
boot();
applyInitialRoute();
registerOfflineWorker();
renderOfflineStatus();
```

- [ ] **Step 5: Verify tab history in the browser**

Run `npm run serve`, load the page, then in the console:

```js
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const start = history.length;
  document.querySelector('[data-tab="kanji"]').click();      await wait(150);
  document.querySelector('[data-tab="relations"]').click();  await wait(150);
  document.querySelector('[data-tab="profile"]').click();    await wait(150);
  const afterForward = { entries: history.length - start, hash: location.hash };
  history.back(); await wait(250);
  const back1 = { hash: location.hash, active: document.querySelector('.panel.is-active').dataset.panel };
  history.back(); await wait(250);
  const back2 = { hash: location.hash, active: document.querySelector('.panel.is-active').dataset.panel };
  return { afterForward, back1, back2 };
})()
```

Expected exactly:

```
afterForward: { entries: 3, hash: "#settings" }
back1:        { hash: "#relations", active: "relations" }
back2:        { hash: "#kanji",     active: "kanji" }
```

`hash: "#settings"` while `active: "profile"` is the point of the two vocabularies — confirm both.

Then load `http://localhost:5506/#kanji` in a fresh tab and confirm it opens on Kanji, and `http://localhost:5506/#nonsense` opens on Analyze with no console error.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 246 passing, 0 failing.

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "Route tabs through the history stack"
```

---

### Task 3: Overlay sentinels

**Files:**
- Modify: `js/kanjitree.js` — add an `onClose` option
- Modify: `js/kanji-map.js` — add an `onClose` option
- Modify: `js/app.js` — sentinel push/consume, overlay-aware `popstate`, wire both `onClose` callbacks

**Interfaces:**
- Consumes: `switchTab(name, push)` and `currentTab` from Task 2
- Produces: nothing consumed later

- [ ] **Step 1: Add onClose to the Radical Tree**

`js/kanjitree.js` begins with an options object at `export function createKanjiTree({`. Add `onClose` to it, beside the existing `onError`:

```js
export function createKanjiTree({
  loadData,
  kanjiInfo,
  isKnown = () => false,
  toggleKnown = null,
  onKnownChange = () => {},
  onOpenRelationships = null,
  onError = () => {},
  onClose = () => {},
}) {
```

Its `function close()` early-returns when already closed, so the callback only fires on a real close. Add the call as the **last statement** of `close()`, after the focus-restoration block:

```js
    onClose();
```

- [ ] **Step 2: Add onClose to the Relationship Map**

`js/kanji-map.js` begins with `export function createKanjiMap({`. Add `onClose` beside `onRender`:

```js
export function createKanjiMap({
  getRelationships,
  isKnown = () => false,
  toggleKnown = null,
  onKnownChange = () => {},
  inCurrentText = () => false,
  onOpenTree = null,
  onNavigate = () => {},
  onRender = () => {},
  onClose = () => {},
  mount = null,
} = {}) {
```

Add `onClose();` as the last statement of its `function close()`.

- [ ] **Step 3: Add the sentinel machinery**

Add to `js/app.js`, immediately above the `popstate` listener added in Task 2:

```js
// A full-screen overlay pushes a sentinel history entry so the back gesture
// closes it instead of leaving the app. Overlays can stack — Radical Tree can
// open the Relationship Map — so this is a depth counter, not a boolean.
let overlayDepth = 0;
// True while we are waiting for the popstate caused by our own history.back().
let awaitingOwnPopstate = false;
// True while we are closing an overlay *because* history moved, so its onClose
// must not try to consume an entry that is already gone.
let closingFromHistory = false;

function pushOverlaySentinel(name) {
  overlayDepth += 1;
  history.pushState({ tab: currentTab, overlay: name }, '', location.hash);
}

// Every routed overlay's onClose calls this.
function overlayDidClose() {
  if (closingFromHistory || overlayDepth === 0) return;
  overlayDepth -= 1;
  awaitingOwnPopstate = true;
  history.back();
}

// Closes the topmost open overlay. The map is checked first because the tree
// can open it, which puts the map on top.
function closeTopOverlay() {
  if (kanjiMap?.isOpen()) { kanjiMap.close(); return true; }
  if (kanjiTree?.isOpen()) { kanjiTree.close(); return true; }
  return false;
}
```

- [ ] **Step 4: Make popstate overlay-aware**

Replace the `popstate` listener written in Task 2 entirely with:

```js
window.addEventListener('popstate', (event) => {
  // Our own history.back() from overlayDidClose; the overlay is already closed.
  if (awaitingOwnPopstate) { awaitingOwnPopstate = false; return; }

  if (overlayDepth > 0) {
    overlayDepth -= 1;
    closingFromHistory = true;
    const closed = closeTopOverlay();
    closingFromHistory = false;
    if (closed) return;
    // Depth said an overlay was open but none was: fall through to the tab so
    // the press is never silently swallowed.
  }

  // state is null after a browser session restore, so fall back to the URL.
  const tab = event.state?.tab || parseRoute(location.hash).tab;
  switchTab(tab, false);
});
```

- [ ] **Step 5: Wire the tree's sentinel**

`js/app.js:180` creates the tree with `kanjiTree = createKanjiTree({`. Add one option to that object, beside the existing `onError`:

```js
      onClose: () => overlayDidClose(),
```

Both overlays have exactly one funnel, so there is exactly one place to push each sentinel. `openKanjiTree` at `js/app.js:286` currently reads:

```js
function openKanjiTree(char, trigger = document.activeElement) {
  if (!kanjiTree || !char || [...char].length !== 1) return;
  usageJournal.record('tree.open');
  kanjiTree.open(char, trigger);
}
```

Change the last line to push the sentinel **after** the open call, so the early
return above never leaves a stranded entry:

```js
function openKanjiTree(char, trigger = document.activeElement) {
  if (!kanjiTree || !char || [...char].length !== 1) return;
  usageJournal.record('tree.open');
  kanjiTree.open(char, trigger);
  pushOverlaySentinel('tree');
}
```

- [ ] **Step 6: Wire the map's sentinel**

`relationshipMapOptions(extra = {})` at `js/app.js:270` merges an overrides object, and it is shared by the full-screen map and the embedded ones. So pass `onClose` **only at the full-screen call site**, line 297:

```js
        kanjiMap = createKanjiMap(relationshipMapOptions({ onClose: () => overlayDidClose() }));
```

**Do not add `onClose` to the embedded maps** at `js/app.js:411`, `js/app.js:445`, or `js/app.js:466`. They live inside the visible Relations panel rather than covering navigation, so routing them would make back close a panel section. Passing the option at line 297 only is what keeps them out of it.

Now the sentinel. `openKanjiMap` at `js/app.js:308` opens inside a `try` after an `await`:

```js
  try {
    const map = await loadKanjiMap();
    map.open(char, trigger);
    usageJournal.record('relations.open');
  } catch (error) {
```

Push **inside the try, after the open succeeds** — never before the `await`. If the relationship index fails to load, the `catch` runs and no overlay appears, and a sentinel pushed beforehand would be stranded:

```js
  try {
    const map = await loadKanjiMap();
    map.open(char, trigger);
    pushOverlaySentinel('map');
    usageJournal.record('relations.open');
  } catch (error) {
```

- [ ] **Step 7: Verify overlay history in the browser**

Run `npm run serve`, load the page, go to the Kanji tab, and open any kanji's Radical Tree. Then in the console:

```js
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const treeOpen = () => !document.querySelector('.kt-overlay').hidden;
  const out = { openedTree: treeOpen(), hash: location.hash };
  history.back(); await wait(350);
  out.afterBack = { treeOpen: treeOpen(), hash: location.hash,
                    active: document.querySelector('.panel.is-active').dataset.panel };
  return out;
})()
```

Expected: `openedTree: true`, then `afterBack: { treeOpen: false, hash: "#kanji", active: "kanji" }` — the tree closed and the tab did **not** change.

Now the sentinel-consumption case, which is the one that breaks if the guards are wrong. Open a Radical Tree again, close it with its **Close button**, then run:

```js
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const before = { hash: location.hash, active: document.querySelector('.panel.is-active').dataset.panel };
  history.back(); await wait(350);
  return { before, after: { hash: location.hash,
                            active: document.querySelector('.panel.is-active').dataset.panel } };
})()
```

Expected: `after` shows a **different tab** from `before`. If the tab is unchanged, the sentinel was stranded — the back press was swallowed consuming a dead entry.

Finally, open a Radical Tree, use its Relationships doorway to open the map, then press back twice: the first should close the map leaving the tree open, the second should close the tree leaving the tab unchanged.

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: 246 passing, 0 failing.

- [ ] **Step 9: Commit**

```bash
git add js/app.js js/kanjitree.js js/kanji-map.js
git commit -m "Close full-screen overlays with the back gesture"
```

---

### Task 4: Version bump and documentation

**Files:**
- Modify: `js/app.js:90`, `sw.js:18`, `package.json` — version
- Modify: `AGENTS.md` — backlog line, routing conventions, file map, QA list
- Modify: `README.md` — bookmarkable views

**Interfaces:**
- Consumes: everything from Tasks 1-3
- Produces: nothing

- [ ] **Step 1: Bump the version in all three places**

Set `10.23.0` in `js/app.js` line 90 (`const APP_VERSION = '10.23.0';`), `sw.js` line 18 (same statement), and `package.json` (`"version": "10.23.0",`). All three must match or `js/sw-routing.test.js` fails. The bump is required regardless, because `index.html` and `js/app.js` are precached and have changed.

- [ ] **Step 2: Update the AGENTS.md backlog**

Change the first bullet from `**v10.22.0 current.**` to `**v10.23.0 current.**`, then add after the Profile & Data bullet:

```markdown
- Back-button routing is ✓ Done: tabs push hash routes so the Android back
  gesture steps back through views instead of leaving the installed app, and
  Radical Tree and the full-screen Relationship Map push sentinel entries so back
  closes them first. Views are bookmarkable; `#settings` opens Profile & Data.
```

- [ ] **Step 3: Add the AGENTS.md routing conventions**

Insert a new section after `## Offline and installation conventions`:

```markdown
## Routing conventions

- Hash routes only. Never push a pathname: `/kotoba-lab/kanji` 404s on GitHub
  Pages and would route every tab switch through the worker's navigate handler.
- Keep the tab/route vocabulary split inside `js/routing.js`. `app.js` handles
  only internal tab names; the module is the single place they translate. The
  `profile` tab is reached at `#settings`, and `#profile` is deliberately not a
  valid route so one view never has two URLs.
- An unknown hash resolves to Analyze. A URL is user-editable input, so parsing
  must never throw or leave a blank screen.
- Only full-screen overlays that cover navigation push a sentinel history entry:
  Radical Tree and the full-screen Relationship Map. The embedded Relations map,
  Atlas focus mode, and in-panel disclosures must not, because they are modes
  inside a visible panel rather than layers over it.
- The Read info sheet is deliberately excluded: `setInfoSheet(false)` is called
  from the tab-switch path, so routing it would fire a stray `history.back()` on
  every tab change, and it already dismisses by tapping its scrim.
- An overlay closed by its own control must consume its sentinel with
  `history.back()`, or the next back press pops a dead entry and appears to do
  nothing. `awaitingOwnPopstate` and `closingFromHistory` keep that from looping;
  do not collapse them into one flag, because they guard opposite directions.
- Overlay sentinels are a depth counter, not a boolean: Radical Tree can open the
  Relationship Map, so two can be stacked.
- Programmatic `switchTab()` calls create history entries on purpose — arriving
  via an in-app link is navigation. Any new caller must therefore be a response
  to a user action, never a timer or a loop.
```

- [ ] **Step 4: Update the AGENTS.md file map**

Add to the `## File map` section:

```markdown
- `js/routing.js` — pure hash parsing, tab/route translation, and unknown-route
  fallback; no DOM, history, or fetch.
```

- [ ] **Step 5: Extend the AGENTS.md verification list**

Add to the `## Verification` section, after the offline QA paragraph:

```markdown
Routing QA also needs a real browser: three tab switches add three history
entries and back walks them in reverse; back from the entry tab exits rather
than looping; back closes an open Radical Tree without changing tab; closing a
tree with its own button and *then* pressing back moves to the previous tab,
proving the sentinel was consumed rather than stranded; a stacked tree-then-map
closes in order; `#kanji` opens Kanji and `#nonsense` opens Analyze; and on an
installed Android PWA the back gesture behaves as above instead of closing
the app.
```

- [ ] **Step 6: Update README.md**

Add to the feature list, after the installable/offline bullet:

```markdown
- **Bookmarkable views:** each workspace has its own address, so `#kanji` opens
  the Kanji library and the browser's back button steps back through the views
  you visited — including closing a full-screen Radical Tree.
```

- [ ] **Step 7: Verify version consistency and run full verification**

```bash
grep -n "APP_VERSION = " js/app.js sw.js && grep -n '"version"' package.json && npm test && npm run kanjivg:check
```

Expected: all three versions read `10.23.0`, 246 tests passing, KanjiVG checksums current.

- [ ] **Step 8: Commit**

```bash
git add js/app.js sw.js package.json AGENTS.md README.md
git commit -m "Document back-button routing"
```

---

## Post-implementation manual QA

Only an installed Android PWA can confirm the change actually solved the problem.

- [ ] Install from the deployed site, open it from the launcher, switch tabs, and confirm the back gesture steps back through views instead of closing the app.
- [ ] Open a Radical Tree on the phone and confirm the back gesture closes it — the case that previously had no gesture-based exit at all.
- [ ] Confirm back from the first tab still exits, so the app never feels trapped.
- [ ] Confirm the update prompt appears after this version deploys, since `APP_VERSION` changed.
