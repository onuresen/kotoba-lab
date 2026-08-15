# Profile & Data Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Profile & Data its own panel, reached from a header control rather than buried inside the My Words study tab.

**Architecture:** Reuse the existing panel machinery. `switchTab()` already toggles panels by `data-panel`; only its active-state handling is bound to the `.tab` class. Widening that selector to `[data-tab]` lets a header button drive the same code path without taking a slot in the mobile bottom bar.

**Tech Stack:** Vanilla ES modules, no dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-15-profile-panel-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No dependencies and no build step.**
- **No sixth `localStorage` key.** There are exactly five.
- **The mobile bottom bar stays at six columns.** The header control must never carry the `.tab` class.
- **The usage journal stays allowlisted and payload-free.** Exactly one new fixed event, `tab.profile`. No payload, no dynamic name, no new stored field.
- **Nothing inside Profile & Data changes behavior.** This is a relocation, not a rework. Element ids stay identical so existing selectors keep working.
- **Portable Study Packs stay in My Words.**
- **Use design tokens in CSS.** No hardcoded colors. Phone controls stay at least 44 px high. Any new animation needs a matching `prefers-reduced-motion: reduce` rule.
- **`npm test` must keep the `node --test "js/*.test.js"` glob and must pass** after every task. Baseline is 236 passing.
- Target release is **v10.22.0**. Because the offline cache is named from it, `js/app.js`, `sw.js`, and `package.json` must all say `10.22.0` by the end of this plan, or `js/sw-routing.test.js` fails.

---

### Task 1: Allow the fixed `tab.profile` journal event

Pure modules, testable without a browser. Done first because nothing depends on it and it is the only TDD-able part.

**Files:**
- Modify: `js/usage-journal.js:6-7`
- Modify: `js/usage-insights.js:10`
- Test: `js/usage-journal.test.js`
- Test: `js/usage-insights.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `'tab.profile'` accepted by `createUsageJournal().record()` and counted in the `data` feature category

- [ ] **Step 1: Write the failing tests**

Append to `js/usage-journal.test.js`:

```js
test('the fixed profile panel event is allowed without accepting a payload', () => {
  const journal = createUsageJournal({ storage: fakeStorage(), now: () => NOW });
  journal.setEnabled(true);
  assert.equal(journal.record('tab.profile'), true);
  assert.equal(journal.record('tab.profile.export'), false);
  assert.equal(journal.summary().eventCount, 1);
});
```

Append to `js/usage-insights.test.js`:

```js
test('opening the profile panel counts toward the data category', () => {
  const result = buildUsageInsights(summary({ 'tab.profile': 3, 'profile.export': 1 }));
  const data = result.featureMix.find((feature) => feature.key === 'data');
  assert.equal(data.count, 4);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: 2 failures. The journal test fails because `record('tab.profile')` returns `false`; the insights test fails because `data.count` is `1`, not `4`.

- [ ] **Step 3: Add the event to the allowlist**

In `js/usage-journal.js`, line 7 currently reads:

```js
  'tab.analyze', 'tab.read', 'tab.kanji', 'tab.relations', 'tab.review', 'tab.mywords',
```

Change it to:

```js
  'tab.analyze', 'tab.read', 'tab.kanji', 'tab.relations', 'tab.review', 'tab.mywords', 'tab.profile',
```

- [ ] **Step 4: Add the event to the data category**

In `js/usage-insights.js`, line 10 currently reads:

```js
  { key: 'data', label: 'Data', glyph: '守', events: ['tab.mywords', 'profile.export', 'pack.export', 'report.export'] },
```

Change it to:

```js
  { key: 'data', label: 'Data', glyph: '守', events: ['tab.mywords', 'tab.profile', 'profile.export', 'pack.export', 'report.export'] },
```

`tab.mywords` stays because Portable Study Packs, and therefore `pack.export`, remain in My Words.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test
```

Expected: 238 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add js/usage-journal.js js/usage-insights.js js/usage-journal.test.js js/usage-insights.test.js
git commit -m "Allow the fixed profile panel usage event"
```

---

### Task 2: Empty panel and header control

Ships a reachable, empty panel. Content arrives in Task 3.

**Files:**
- Modify: `index.html` — wrap the nav, add the header button, add the panel
- Modify: `js/app.js:91-94` (`TAB_USAGE_EVENTS`), `js/app.js:2043-2050` (`switchTab` selectors), `js/app.js:2055` (`.input-card`)
- Modify: `japanese-reader.css` — header control styling

**Interfaces:**
- Consumes: `'tab.profile'` from Task 1
- Produces: a `[data-panel="profile"]` section and a `[data-tab="profile"]` header button, both driven by the existing `switchTab(name)`

- [ ] **Step 1: Wrap the nav so the button sits beside it**

In `index.html`, the header currently runs from line 31 to line 47. The `<nav class="tabs" …>` opens at line 39 and closes at line 46.

Wrap that nav and add the button, so `.head-inner` keeps exactly two flex children and its `justify-content: space-between` still puts branding left and navigation right:

```html
    <div class="head-nav">
      <nav class="tabs" aria-label="Main navigation">
        ... existing six tab buttons, unchanged ...
      </nav>
      <button type="button" class="head-action" data-tab="profile" aria-label="Data">
        <span class="head-action-icon" aria-hidden="true">守</span>
        <span class="head-action-label">Data</span>
      </button>
    </div>
```

The button must **not** have the `.tab` class. `.tabs` becomes the fixed bottom bar at ≤780 px, at which point `.head-nav` contains only the button and it sits at the right of the sticky header.

`aria-label="Data"` is required, not decorative. The glyph is `aria-hidden`, and Step 3 hides the text label with `display: none` on phones — which also removes it from the accessibility tree. Without the explicit label the button would have no accessible name on mobile. The label text and the `aria-label` are identical, so this does not create a visible-label mismatch.

- [ ] **Step 2: Add the empty panel**

In `index.html`, the My Words panel opens at line 378. Add a new sibling panel immediately after the My Words panel's closing `</section>`:

```html
  <section class="panel" data-panel="profile" data-layout="wide" id="profile-panel">
  </section>
```

`data-layout="wide"` matches My Words, because the dashboard and journal are data-heavy and rely on the wide desktop measure.

- [ ] **Step 3: Style the header control**

Append to `japanese-reader.css`:

```css
/* ---- header data control ---------------------------------------------------- */
.head-nav { display: flex; align-items: center; gap: 12px; }

.head-action {
  display: flex; align-items: center; gap: 7px;
  min-height: 44px; padding: 8px 14px;
  font-family: var(--font-body); font-size: 13px; font-weight: 500;
  color: var(--text2);
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: color 0.18s var(--ease), background 0.18s var(--ease), border-color 0.18s var(--ease);
}
.head-action:hover { color: var(--text); border-color: var(--border-strong); }
/* Mirrors .tab.is-active so the header control reads as part of the same
   navigation system. */
.head-action.is-active {
  color: var(--accent);
  background: var(--surface-raised);
  border-color: var(--accent-glow);
  box-shadow: var(--shadow-sm), inset 0 1px 0 var(--paper-glow);
}
.head-action-icon { font-family: var(--font-display); font-size: 17px; line-height: 1; }

@media (max-width: 780px) {
  .head-action-label { display: none; }
  .head-action { padding-inline: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .head-action { transition: none; }
}
```

Every token above was verified against `palettes/washi-sumi.css`. The palette defines `--text`, `--text2`, `--text3` for text and `--accent`, `--accent-dim`, `--accent-glow` for the vermilion signal — there is no `--text-soft` or `--accent-soft`. Do not invent token names, and **do not introduce a hardcoded color.**

- [ ] **Step 4: Register the usage event**

In `js/app.js`, `TAB_USAGE_EVENTS` at lines 91-94 currently reads:

```js
const TAB_USAGE_EVENTS = Object.freeze({
  analyze: 'tab.analyze', read: 'tab.read', kanji: 'tab.kanji',
  relations: 'tab.relations', review: 'tab.review', mywords: 'tab.mywords',
});
```

Change it to:

```js
const TAB_USAGE_EVENTS = Object.freeze({
  analyze: 'tab.analyze', read: 'tab.read', kanji: 'tab.kanji',
  relations: 'tab.relations', review: 'tab.review', mywords: 'tab.mywords',
  profile: 'tab.profile',
});
```

- [ ] **Step 5: Let the header button participate in navigation**

In `js/app.js`, `switchTab()` at line 2043 begins:

```js
function switchTab(name) {
  if (name !== 'relations') relationsAtlas?.setFocus(false);
  document.querySelectorAll('.tab').forEach((t) => {
```

Change that third line to:

```js
  document.querySelectorAll('[data-tab]').forEach((t) => {
```

This is what marks the header control active and gives it `aria-current="page"` while no bottom tab is current.

Then, at line 2091, the click wiring reads:

```js
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
```

Change it to:

```js
  document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
```

- [ ] **Step 6: Hide the shared text box on the profile panel**

`js/app.js` line 2055 currently reads:

```js
  $('.input-card').hidden = name === 'review' || name === 'kanji' || name === 'relations' || name === 'mywords';
```

Change it to:

```js
  $('.input-card').hidden = name === 'review' || name === 'kanji' || name === 'relations' || name === 'mywords' || name === 'profile';
```

- [ ] **Step 7: Verify navigation works**

Run `npm run serve`, load the page, then in the browser console:

```js
(() => {
  document.querySelector('[data-tab="profile"]').click();
  const panel = document.querySelector('[data-panel="profile"]');
  const btn = document.querySelector('.head-action');
  const activeTabs = [...document.querySelectorAll('.tab.is-active')].map((t) => t.dataset.tab);
  return {
    panelActive: panel.classList.contains('is-active'),
    buttonActive: btn.classList.contains('is-active'),
    buttonAriaCurrent: btn.getAttribute('aria-current'),
    bottomTabsActive: activeTabs,
    inputCardHidden: document.querySelector('.input-card').hidden,
    tabCount: document.querySelectorAll('nav.tabs .tab').length,
  };
})()
```

Expected exactly:

```
panelActive: true
buttonActive: true
buttonAriaCurrent: "page"
bottomTabsActive: []
inputCardHidden: true
tabCount: 6
```

`bottomTabsActive: []` and `tabCount: 6` are the two that matter most: no bottom tab claims to be current, and the bar did not gain a seventh column.

Then click each of the six real tabs and confirm they still activate and that the header button loses its active state. The `[data-tab]` selector change touches all navigation, so this is the regression to watch.

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: 238 passing, 0 failing.

- [ ] **Step 9: Commit**

```bash
git add index.html js/app.js japanese-reader.css
git commit -m "Add a Profile and Data panel reachable from the header"
```

---

### Task 3: Move the card and split the render

**Files:**
- Modify: `index.html` — move lines 412-490 into the new panel
- Modify: `js/app.js:1740-1757` (`renderMyWords`), plus six call sites
- Modify: `index.html:400` — turn prose into a link
- Modify: `js/app.js:1783` area — extend the delegated navigation handler

**Interfaces:**
- Consumes: the `[data-panel="profile"]` section from Task 2
- Produces: `renderProfilePanel()`, called on startup, on profile-affecting changes, and from `switchTab('profile')`

- [ ] **Step 1: Move the card**

In `index.html`, cut the entire block from line 412 (`    <div class="card profile-data-card">`) through line 490 (its matching `    </div>`) and paste it inside the `[data-panel="profile"]` section created in Task 2.

Move it verbatim. **Change no element id.** Every `#profile-…`, `#usage-…`, `#offline-…` and `#mw-backup-count` lookup in `js/app.js` depends on these ids being unchanged — that is what makes this a relocation rather than a rewrite.

After the move, My Words must contain exactly three cards: Known, Saved deck, and Portable Study Packs.

- [ ] **Step 2: Split the render function**

`js/app.js` `renderMyWords()` at line 1740 currently contains this run of lines (1749-1758):

```js
  const rows = deck.all();
  $('#mw-deck-count').textContent = `${rows.length} card${rows.length === 1 ? '' : 's'}`;
  const days = Object.keys(reviewLog.all()).length;
  $('#mw-backup-count').textContent =
    `${rows.length} cards · ${knownWords.count() + knownKanji.count()} known · ${days} day${days === 1 ? '' : 's'} of history`;
  const profileState = currentState();
  $('#profile-summary').innerHTML = profileSummaryMarkup(backupSummary(profileState));
  renderProfileDashboard(profileState);
  renderUsageJournal(profileState);
  $('#mw-deck-tbody').innerHTML = rows.length
```

Delete the five profile lines — from `const days =` through `renderUsageJournal(profileState);` — leaving:

```js
  const rows = deck.all();
  $('#mw-deck-count').textContent = `${rows.length} card${rows.length === 1 ? '' : 's'}`;
  $('#mw-deck-tbody').innerHTML = rows.length
```

Then add this new function immediately before `function renderMyWords() {`:

```js
// Profile & Data lives in its own panel, so it renders independently of the
// My Words study collection. Both read the same stores, so anything that
// changes cards or known state must refresh both.
function renderProfilePanel() {
  const rows = deck.all();
  const days = Object.keys(reviewLog.all()).length;
  $('#mw-backup-count').textContent =
    `${rows.length} cards · ${knownWords.count() + knownKanji.count()} known · ${days} day${days === 1 ? '' : 's'} of history`;
  const profileState = currentState();
  $('#profile-summary').innerHTML = profileSummaryMarkup(backupSummary(profileState));
  renderProfileDashboard(profileState);
  renderUsageJournal(profileState);
}
```

- [ ] **Step 3: Update the call sites**

`renderMyWords()` has six call sites in `js/app.js`. Add `renderProfilePanel();` immediately after it at five of them, and add one new branch.

| Line | Context | Action |
|---|---|---|
| 209 | startup | add `renderProfilePanel();` after |
| 764 | known-state change | add `renderProfilePanel();` after |
| 1604 | profile import / merge / reset | add `renderProfilePanel();` after |
| 1794 | deck row removal | add `renderProfilePanel();` after |
| 2059 | `if (name === 'mywords') renderMyWords();` | **leave unchanged** |
| 2233 | deck / known clearing | add `renderProfilePanel();` after |

Line 2059 is deliberately excluded: arriving at My Words must not re-render a panel the learner cannot see. Instead, immediately after that line, add:

```js
  if (name === 'profile') renderProfilePanel();
```

A missed call here produces a stale number rather than a crash, which is why Step 6 checks both surfaces after a data change.

- [ ] **Step 4: Turn the cross-reference into a link**

`index.html` line 400 currently ends with plain prose:

```html
Review-history totals are managed separately in Profile &amp; Data.</p>
```

Change it to:

```html
Review-history totals are managed separately in <a href="#" class="go-profile">Profile &amp; Data</a>.</p>
```

Then wire it beside the existing `.go-review` handler. `js/app.js` lines 1783-1784 read exactly:

```js
  const goReview = e.target.closest('.go-review');
  if (goReview) { e.preventDefault(); switchTab('review'); return; }
```

Insert the matching pair directly after line 1784:

```js
  const goProfile = e.target.closest('.go-profile');
  if (goProfile) { e.preventDefault(); switchTab('profile'); return; }
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 238 passing, 0 failing.

- [ ] **Step 6: Verify both surfaces stay in sync**

Run `npm run serve` and load the page. In the browser:

1. Click 守 Data. Confirm the full Profile & Data content appears: summary, dashboard, reset zone, usage journal, friction radar, report, offline availability, backup buttons.
2. Go to My Words. Confirm exactly three cards — Known, Saved deck, Portable Study Packs — and no Profile & Data.
3. Save a word while reading, then mark a kanji known. Return to Profile & Data and confirm the counts in `#mw-backup-count` and the dashboard changed.
4. Remove a row from the saved deck in My Words, then open Profile & Data and confirm the card count dropped.
5. Run a full reset with the typed phrase `RESET KOTOBA LAB`, then check both My Words and Profile & Data show zeroed values without a reload.

Step 3, 4 and 5 are the ones that catch a missed `renderProfilePanel()` call.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js
git commit -m "Move Profile and Data out of the My Words tab"
```

---

### Task 4: Version bump and documentation

Three existing statements become wrong and must be corrected, not merely extended.

**Files:**
- Modify: `js/app.js:90`, `sw.js:18`, `package.json` — version
- Modify: `AGENTS.md` — backlog line, mobile conventions, file map
- Modify: `README.md` — feature note
- Modify: `PRIVACY.md` — the location claim

**Interfaces:**
- Consumes: everything from Tasks 1-3
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Bump the version in all three places**

`js/app.js` line 90:

```js
const APP_VERSION = '10.22.0';
```

`sw.js` line 18:

```js
const APP_VERSION = '10.22.0';
```

`package.json`:

```json
  "version": "10.22.0",
```

All three must match or `js/sw-routing.test.js` fails. The bump is required regardless, because `index.html`, `js/app.js`, and `japanese-reader.css` are all precached and have changed.

- [ ] **Step 2: Update the AGENTS.md backlog**

Change the first bullet from `**v10.21.0 current.**` to `**v10.22.0 current.**`, then add after the offline PWA bullet:

```markdown
- Profile & Data is ✓ its own panel: application-level data management left the
  My Words study tab and now lives at `[data-panel="profile"]`, reached from a
  守 Data control in the header. It deliberately has no slot in the bottom tab
  bar, so the mobile bar stays at six columns. My Words keeps Known, Saved deck,
  and Portable Study Packs.
```

- [ ] **Step 3: Correct the stale mobile-tab count**

In the `## Mobile interface conventions` section, the first bullet says "keep the five primary tabs in the fixed bottom bar". This was already wrong — there are six, and the CSS grid is `repeat(6, …)`. Replace that bullet with:

```markdown
- At 780px and below, keep the six primary tabs in the fixed bottom bar and
  leave the sticky header for compact branding plus the 守 Data control. Respect
  safe-area insets and reserve enough main-content padding that the bar never
  covers actions.
- Profile & Data is a headed panel, not a tab. It is reached from the header
  control and must never gain a bottom-bar slot; the bar stays at six columns.
  Its button carries `data-tab` but never the `.tab` class, and `switchTab()`
  selects `[data-tab]` so the header control receives `is-active` and
  `aria-current` through the same path as the real tabs.
- Anything that changes cards or known state must refresh both `renderMyWords()`
  and `renderProfilePanel()`. They read the same stores but render separately,
  and a missed call shows a stale count rather than failing visibly.
```

- [ ] **Step 4: Update the AGENTS.md file map**

Add to the `## File map` section:

```markdown
- `index.html` `[data-panel="profile"]` — Profile & Data panel: summary,
  dashboard, reset, usage journal, friction radar, report, offline availability,
  backup actions, and import preview. Reached only from the header control.
```

- [ ] **Step 5: Update README.md**

In the feature list, the Profile & Data bullet currently begins "**Profile & Data:** export the complete local study profile…". Change its opening so the location is stated:

```markdown
- **Profile & Data:** a dedicated panel, opened with 守 Data in the header, that
  exports the complete local study profile as versioned JSON,
```

Leave the rest of that bullet unchanged.

- [ ] **Step 6: Correct PRIVACY.md**

The "Text and study data" section says:

```markdown
- Clearing site data removes this local state. Use **Profile & Data** in
  **My Words** if you want to retain or move it.
```

That location is no longer true. Change it to:

```markdown
- Clearing site data removes this local state. Use **Profile & Data**, opened
  with 守 Data in the header, if you want to retain or move it.
```

Then check the rest of the file for any other reference to Profile & Data living in My Words:

```bash
grep -n "My Words" PRIVACY.md README.md AGENTS.md
```

Correct any remaining claim that data management lives in that tab.

- [ ] **Step 7: Verify version consistency and run full verification**

```bash
grep -n "APP_VERSION = " js/app.js sw.js && grep -n '"version"' package.json && npm test && npm run kanjivg:check
```

Expected: all three versions read `10.22.0`, 238 tests passing, and the KanjiVG manifest reporting current checksums.

- [ ] **Step 8: Commit**

```bash
git add js/app.js sw.js package.json AGENTS.md README.md PRIVACY.md
git commit -m "Document the Profile and Data panel"
```

---

## Post-implementation manual QA

- [ ] On a phone, confirm the bottom bar still shows six tabs and the 守 control is reachable in the header without crowding branding.
- [ ] Confirm the header control shows only the 守 glyph at ≤780 px, with the accessible name still reading "Data".
- [ ] Tab through the header with the keyboard: the control must be focusable and activate with Enter and Space.
- [ ] Confirm the offline update prompt still appears correctly after the version bump deploys, since `APP_VERSION` changed.
