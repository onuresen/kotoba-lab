# Back-button and URL routing — design

- **Date:** 2026-08-15
- **Target release:** v10.23.0
- **Status:** approved, ready for implementation planning

## Problem

Kotoba Lab creates no history entries and never changes its URL. Measured in a
browser: three tab switches added **zero** entries and `location.href` was
unchanged throughout.

This was harmless while Kotoba Lab was a web page. It stopped being harmless in
v10.21.0, when the app became installable. In a `display: standalone` app the
Android back gesture walks the history stack, and with nothing to pop it leaves
the app. So the most natural gesture in the interface currently quits it.

The sharper half of the problem is overlays. Radical Tree, the full-screen
Relationship Map, and the Read info sheet are dismissed with `Escape` — a key
phones do not have. On a phone, a full-screen Radical Tree can only be closed by
finding its Close button, and the gesture a user reaches for instead closes the
entire application.

## Goals

- Back closes an open full-screen overlay.
- With no overlay open, back steps through visited tabs.
- Back from the entry tab exits, as expected.
- A view can be bookmarked and reopened: `#kanji` opens the Kanji tab.

## Non-goals

- No deep-linkable kanji (`#kanji/学`). Worth doing later; it touches Radical
  Tree's open path and its lazy 5.85 MB artifact load, which is a different
  change from a navigation fix.
- **No path-based routes.** `/kotoba-lab/kanji` would 404 on GitHub Pages without
  a `404.html` redirect hack, and it would route every tab switch through the
  service worker's navigate handler. Hash changes trigger no navigation at all,
  so the worker is never involved.
- No routing for the embedded Relations map, Atlas focus mode, or any in-panel
  disclosure. These are modes inside a visible panel, not full-screen layers that
  cover navigation, so back should not be their dismiss gesture.
- No new `localStorage` key. The route lives in the URL and history only.

## Architecture

A pure module decides, thin wiring acts — the split used throughout this
codebase.

| File | Type | Role |
|---|---|---|
| `js/routing.js` | new, pure | Hash parsing, serialization, tab validation. No DOM, history, or fetch. |
| `js/routing.test.js` | new, test | Parsing, serializing, unknown-hash fallback, round-tripping |
| `js/app.js` | edit | `pushState` on tab switch, `popstate` handling, overlay sentinels, initial route |

### `js/routing.js`

There are two vocabularies and the module is the only place they meet:

- **Tab names** are internal, and are what `switchTab()` and `data-tab` use:
  `analyze`, `read`, `kanji`, `relations`, `review`, `mywords`, **`profile`**.
- **Route names** are what a user sees in the URL. They are identical except that
  `profile` appears as **`settings`**, matching the visible control label.

Exports:

- `ROUTABLE_TABS: readonly string[]` — the seven internal tab names
- `isRoutableTab(name): boolean` — takes an internal tab name
- `tabToRoute(tab): string` — `'profile'` → `'settings'`, others unchanged
- `routeToTab(route): string` — `'settings'` → `'profile'`, others unchanged
- `parseRoute(hash): { tab: string }` — **returns the internal tab name**, so
  `#settings` yields `{ tab: 'profile' }`. Tolerant of `#kanji`, `kanji`,
  `#/kanji`, `''`, and `'#'`. Anything unknown or malformed resolves to
  `analyze` rather than throwing, because a URL is user-editable input.
- `routeToHash(tab): string` — **takes the internal tab name**, so
  `routeToHash('profile')` is `'#settings'`

`app.js` therefore only ever handles internal tab names; every translation is
inside this module and covered by tests.

## Tab history

`switchTab(name)` pushes `history.pushState({ tab: name }, '', routeToHash(...))`.

- Re-selecting the active tab pushes nothing, so repeated clicks do not stack
  entries.
- On `popstate`, the tab is restored from the state object, falling back to
  parsing the hash if state is absent — which happens when a user edits the URL
  directly or follows a bookmark.
- On initial load, `parseRoute(location.hash)` chooses the starting tab and
  `replaceState` normalizes the URL, so the entry point is exactly one history
  entry and back from it exits, as it should.

`switchTab` is called both by user clicks and programmatically (the `.go-review`
and `.go-profile` links, Radical Tree doorways). Both should create history
entries: arriving somewhere via a link is navigation, and back should undo it.

## Overlay history

Opening a full-screen overlay pushes a sentinel entry that keeps the same hash:

```js
history.pushState({ tab: currentTab, overlay: name }, '', location.hash);
```

Three overlays participate: Radical Tree (`kanjiTree`), the full-screen
Relationship Map (`kanjiMap`, created at `js/app.js:297`), and the Read info
sheet (`setInfoSheet`, `js/app.js:674`). The *embedded* Relations map created at
`js/app.js:411` is excluded: it lives inside the visible Relations panel and is
not a layer over navigation.

On `popstate`, if an overlay is open it is closed and the tab is left unchanged.

### The re-entrancy problem

This is the one place this kind of feature reliably breaks, so it is specified
rather than left to implementation taste.

An overlay can also be dismissed by its own Close button or `Escape`. When that
happens the sentinel entry is still on the stack, and if it is not consumed the
next back press appears to do nothing — the user presses back, the entry pops,
and nothing visible changes.

So closing an overlay by button or `Escape` must call `history.back()` to consume
its sentinel. That triggers `popstate`, which would then try to close an
already-closed overlay. A module-level guard flag must make the second close a
no-op:

- Overlay closed by user control → set guard, `history.back()`, clear guard in
  the resulting `popstate` without acting.
- Overlay closed by `popstate` → close directly, never call `history.back()`.

Getting this wrong produces either a dead back press or an infinite loop, and
neither is visible in unit tests.

## Error handling

- An unknown hash (`#nonsense`) resolves to `analyze`. No error, no blank screen.
- `history.state` may be `null` after a browser restore; the handler falls back
  to parsing the hash.
- The routing wiring must not interfere with `#boot-warning` or its four-second
  fallback. Routing is applied after boot, exactly as service-worker registration
  is.

## Testing

`js/routing.test.js`, under the existing `node --test "js/*.test.js"` glob:

- `parseRoute` accepts `#kanji`, `kanji`, `#/kanji`, `''`, and `'#'`
- `parseRoute` resolves unknown, malformed, and non-string values to `analyze`
- `routeToHash(parseRoute(h).tab)` round-trips for every tab in `ROUTABLE_TABS`
- `parseRoute('#settings').tab === 'profile'` and `routeToHash('profile') === '#settings'`
- `tabToRoute('profile') === 'settings'`; `routeToTab('settings') === 'profile'`;
  both leave every other name unchanged
- `isRoutableTab` rejects unknown names and non-strings
- No route name collides with a tab name it does not map to — specifically,
  `#profile` is not a valid route and resolves to `analyze`

Browser QA, which unit tests cannot cover:

- Three tab switches add three history entries; back walks them in reverse.
- Back from the entry tab exits rather than looping.
- Opening Radical Tree then pressing back closes the tree and stays on the tab.
- Closing Radical Tree with its Close button, then pressing back, moves to the
  previous **tab** — proving the sentinel was consumed, not stranded.
- The same for the full-screen Relationship Map and the phone info sheet.
- Loading `#kanji` directly opens the Kanji tab; loading `#nonsense` opens
  Analyze with no error.
- The startup warning still behaves over `http://` and `file://`.
- On an installed Android PWA, the back gesture behaves as above rather than
  closing the app.

## Documentation

- **AGENTS.md** — backlog line, a routing conventions section covering the hash
  form, which overlays participate, and the sentinel-consumption rule; the file
  map entry for `js/routing.js`; the extended QA list.
- **README.md** — note that views are bookmarkable.

## Risks

- **Sentinel desync** is the main one, mitigated by the explicit guard rule above
  and by the QA step that closes an overlay with its button and *then* presses
  back.
- **Programmatic `switchTab` callers** now create history entries. That is
  intended, but it means a future caller that switches tabs in a loop or on a
  timer would pollute the stack. Any new caller should be a response to a user
  action.
