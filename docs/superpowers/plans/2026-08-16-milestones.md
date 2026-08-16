# Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the capability milestones a learner has actually passed, as a compact strip inside the existing Profile & Data panel.

**Architecture:** A pure module derives milestones from the four existing profile stores — nothing is recorded, awarded, or persisted. `js/app.js` renders the passed milestones beneath the profile summary that already sits there. No new panel, no new tab, no new storage key.

**Tech Stack:** Vanilla ES modules, no dependencies, no build step.

---

## Why this shape (read before changing it)

This was decided against the project owner's own precedent in a sibling project, Thinking Hub. On 2026-06-13 he relabelled its **"Achievements" tool to "Profile"** (icon 🏅→👤), reasoning that the page leads with identity and *"the achievements become the content of the profile, GitHub-style"* — and he folded it into an existing surface specifically to pass a *"don't add surfaces"* test. In a third project, ONES, the gamified achievements screen is described in his notes as *"an island, not representative of ONES's look."*

He also applies a **solo-app test** to new surfaces: *"would the solo user open this weekly?"* Two Thinking Hub tools were deleted for failing it. A dedicated achievements page in Kotoba Lab fails that test too — nobody goes looking for one. Profile & Data is passed through anyway, so milestones live there as content.

So, deliberately:

- **Not a tab, not a panel, not a modal.** A strip under the existing profile summary.
- **Derived, never stored.** Every milestone is recomputed from `kotoba-lab:deck`, `kotoba-lab:known-words`, `kotoba-lab:known-kanji`, and `kotoba-lab:review-log`. There is no earned-badge ledger and no timestamp.
- **No trophy vocabulary.** No 🏅, no locked/unlocked grid, no progress bars to the next tier, no percentages. `IDEA_GARDEN.md` rejects guilt-heavy mechanics, and a half-empty badge cabinet converts "here is what you can read" into "here is what you have not done."
- **Only passed milestones are listed.** At most one *forward* line is shown, and only when it is genuinely close.

If a future change wants a heatmap, a badge grid, or an Achievements destination, that is a different decision and needs the owner's explicit sign-off — it reverses the reasoning above.

## Global Constraints

Every task's requirements implicitly include this section.

- **No dependencies and no build step.**
- **No sixth `localStorage` key.** There are exactly five and the count is doctrine. Milestones are derived at render time.
- **No new usage-journal event.** The journal allowlist is not touched.
- **Use design tokens in CSS.** No hardcoded colors. Phone controls stay at least 44px high. Any new animation needs a matching `prefers-reduced-motion: reduce` rule.
- **`npm test` must keep the `node --test "js/*.test.js"` glob and must pass** after every task. Baseline is **270 passing**.
- Target release is **v10.25.0**. `js/app.js`, `sw.js`, and `package.json` must all say `10.25.0` by the end, or `js/sw-routing.test.js` fails.
- **Any new `js/*.js` module must be added to `JS_MODULES` in `js/offline-cache.js`,** or `js/offline-cache.test.js` fails with "the precache list stays in sync with the js module directory". This has caught three modules already; it will catch this one.

---

### Task 1: Pure milestones module

**Files:**
- Create: `js/milestones.js`
- Test: `js/milestones.test.js`
- Modify: `js/offline-cache.js` — add `'js/milestones.js'` to `JS_MODULES`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `MILESTONES: readonly Milestone[]` where a Milestone is `{ id, label, at, value }` — `value` is a function taking the stats object
  - `buildMilestones(stats): { passed: Array<{id,label,at}>, next: {id,label,at,remaining}|null }`
  - `stats` shape: `{ knownKanji: number, knownWords: number, readableWords: number, savedCards: number, reviewDays: number }`

- [x] **Step 1: Write the failing test**

Create `js/milestones.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, buildMilestones } from './milestones.js';

const stats = (over = {}) => ({
  knownKanji: 0, knownWords: 0, readableWords: 0, savedCards: 0, reviewDays: 0, ...over,
});

test('every milestone declares an id, a label, a threshold, and a reader', () => {
  assert.ok(MILESTONES.length >= 8);
  for (const m of MILESTONES) {
    assert.equal(typeof m.id, 'string');
    assert.equal(typeof m.label, 'string');
    assert.ok(Number.isFinite(m.at) && m.at > 0, `${m.id} needs a positive threshold`);
    assert.equal(typeof m.value, 'function');
  }
  assert.equal(new Set(MILESTONES.map((m) => m.id)).size, MILESTONES.length, 'ids must be unique');
});

test('a fresh profile has passed nothing and is offered no forward line', () => {
  const result = buildMilestones(stats());
  assert.deepEqual(result.passed, []);
  // Nothing is close when everything is zero, so nothing is dangled.
  assert.equal(result.next, null);
});

test('passed milestones are reported, largest first', () => {
  const result = buildMilestones(stats({ knownKanji: 120 }));
  const ids = result.passed.map((m) => m.id);
  assert.ok(ids.includes('kanji-10'));
  assert.ok(ids.includes('kanji-100'));
  assert.equal(ids.indexOf('kanji-100') < ids.indexOf('kanji-10'), true, 'largest first');
});

test('a milestone that is not passed never appears in passed', () => {
  const result = buildMilestones(stats({ knownKanji: 99 }));
  assert.equal(result.passed.some((m) => m.id === 'kanji-100'), false);
});

test('the next milestone is offered only when it is genuinely close', () => {
  // 90 of 100 known kanji: within the 25% closeness window, so worth saying.
  const close = buildMilestones(stats({ knownKanji: 90 }));
  assert.equal(close.next.id, 'kanji-100');
  assert.equal(close.next.remaining, 10);

  // 12 of 100: far away, and dangling it would read as nagging.
  const far = buildMilestones(stats({ knownKanji: 12 }));
  assert.equal(far.next, null);
});

test('exactly one forward line is offered, never a list', () => {
  const result = buildMilestones(stats({ knownKanji: 95, readableWords: 96, savedCards: 48 }));
  assert.equal(result.next === null || typeof result.next === 'object', true);
  assert.equal(Array.isArray(result.next), false);
});

test('milestones cover capability, not just activity', () => {
  const ids = MILESTONES.map((m) => m.id).join(' ');
  for (const kind of ['kanji', 'words', 'readable']) {
    assert.ok(ids.includes(kind), `expected a ${kind} milestone`);
  }
});

test('malformed or missing stats degrade to nothing rather than throwing', () => {
  assert.deepEqual(buildMilestones(null), { passed: [], next: null });
  assert.deepEqual(buildMilestones({}), { passed: [], next: null });
  assert.deepEqual(buildMilestones({ knownKanji: NaN }), { passed: [], next: null });
  assert.deepEqual(buildMilestones({ knownKanji: -5 }), { passed: [], next: null });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL with `Cannot find module` for `./milestones.js`.

- [x] **Step 3: Write the implementation**

Create `js/milestones.js`:

```js
// milestones.js — what the learner can now do, derived from the four profile
// stores and never recorded.
//
// Deliberately not an achievements system. There is no ledger, no timestamp, no
// badge state: every milestone is recomputed from current numbers, so nothing
// can drift, nothing needs migrating, and no sixth storage key exists. Only
// milestones already passed are reported, plus at most one nearby next step.
//
// Pure: no DOM, no storage, no fetch.

// Thresholds describe real reading capability, not effort spent. Keep the list
// short: a long list reads as a checklist of things undone.
export const MILESTONES = Object.freeze([
  { id: 'kanji-10', label: '10 kanji known', at: 10, value: (s) => s.knownKanji },
  { id: 'kanji-50', label: '50 kanji known', at: 50, value: (s) => s.knownKanji },
  { id: 'kanji-100', label: '100 kanji known', at: 100, value: (s) => s.knownKanji },
  { id: 'kanji-250', label: '250 kanji known', at: 250, value: (s) => s.knownKanji },
  { id: 'kanji-500', label: '500 kanji known', at: 500, value: (s) => s.knownKanji },
  { id: 'readable-25', label: '25 words readable', at: 25, value: (s) => s.readableWords },
  { id: 'readable-100', label: '100 words readable', at: 100, value: (s) => s.readableWords },
  { id: 'readable-500', label: '500 words readable', at: 500, value: (s) => s.readableWords },
  { id: 'words-50', label: '50 words known', at: 50, value: (s) => s.knownWords },
  { id: 'words-200', label: '200 words known', at: 200, value: (s) => s.knownWords },
  { id: 'cards-50', label: '50 cards saved', at: 50, value: (s) => s.savedCards },
  { id: 'review-30', label: '30 days reviewed', at: 30, value: (s) => s.reviewDays },
]);

// A next milestone is mentioned only inside this fraction of its threshold.
// Further away it stops being encouragement and becomes a chore list.
const CLOSENESS = 0.25;

function readable(stats, milestone) {
  const value = milestone.value(stats);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function buildMilestones(stats) {
  if (!stats || typeof stats !== 'object') return { passed: [], next: null };

  const passed = [];
  let next = null;

  for (const milestone of MILESTONES) {
    const value = readable(stats, milestone);
    if (value === null) continue;
    if (value >= milestone.at) {
      passed.push({ id: milestone.id, label: milestone.label, at: milestone.at });
      continue;
    }
    const remaining = milestone.at - value;
    if (remaining > milestone.at * CLOSENESS) continue;
    // Keep the single nearest target so the strip never becomes a to-do list.
    if (!next || remaining < next.remaining) {
      next = { id: milestone.id, label: milestone.label, at: milestone.at, remaining };
    }
  }

  passed.sort((a, b) => b.at - a.at);
  return { passed, next };
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: **278 passing, 0 failing.**

If `the precache list stays in sync with the js module directory` fails, do Step 5 — that is exactly what it is telling you.

- [x] **Step 5: Register the module for offline caching**

In `js/offline-cache.js`, the `JS_MODULES` array is alphabetical. Add the new entry between `'js/kanjivg.js'` and `'js/offline-cache.js'`:

```js
  'js/kanjivg.js',
  'js/milestones.js',
  'js/offline-cache.js',
```

- [x] **Step 6: Run tests again**

```bash
npm test
```

Expected: 278 passing, 0 failing.

- [x] **Step 7: Commit**

```bash
git add js/milestones.js js/milestones.test.js js/offline-cache.js
git commit -m "Add pure milestones module"
```

---

### Task 2: Render the strip in Profile & Data

**Files:**
- Modify: `index.html` — one element after `#profile-summary` (currently `index.html:495`)
- Modify: `js/app.js` — import, render function, one call site
- Modify: `japanese-reader.css` — append the strip styles

**Interfaces:**
- Consumes: `buildMilestones(stats)` from `js/milestones.js`
- Produces: nothing consumed later

- [x] **Step 1: Add the markup**

`index.html:495` currently reads:

```html
      <div id="profile-summary" class="profile-summary" aria-label="Local profile summary"></div>
```

Add a sibling immediately after it:

```html
      <div id="profile-milestones" class="milestones" aria-label="Study milestones"></div>
```

- [x] **Step 2: Import the module**

In `js/app.js`, beside the other local imports near the top (there is already a line `import { searchWords } from './word-browser.js';`), add:

```js
import { buildMilestones } from './milestones.js';
```

- [x] **Step 3: Add the render function**

`js/app.js` already contains `function renderProfilePanel()`. Add this function immediately **above** it:

```js
// Capability milestones, recomputed from current profile numbers every render.
// Nothing here is stored: see js/milestones.js for why.
function renderMilestones() {
  const host = $('#profile-milestones');
  if (!host) return;

  const readableWords = buildReadableCompounds(
    vocabList, (char) => knownKanji.has(char), 0,
  ).total;

  const { passed, next } = buildMilestones({
    knownKanji: knownKanji.count(),
    knownWords: knownWords.count(),
    readableWords,
    savedCards: deck.count(),
    reviewDays: Object.keys(reviewLog.all()).length,
  });

  if (!passed.length && !next) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  host.hidden = false;

  // Passed milestones only. A forward line appears just once, and only when the
  // pure module judged it close enough to be encouraging rather than nagging.
  host.innerHTML = `
    ${passed.map((m) => `<span class="milestone">${esc(m.label)}</span>`).join('')}
    ${next ? `<span class="milestone milestone--next">${next.remaining.toLocaleString()} to ${esc(next.label)}</span>` : ''}`;
}
```

Note `buildReadableCompounds(..., 0)` — passing `0` as the limit returns an empty `words` array while still reporting the honest `total`, which is all this needs.

- [x] **Step 4: Call it**

Inside `function renderProfilePanel()`, after the existing line `renderUsageJournal(profileState);`, add:

```js
  renderMilestones();
```

It takes no argument on purpose: it reads the live stores directly, so it cannot
be handed a stale snapshot.

`renderProfilePanel()` is already invoked from every place that changes cards or known state, so milestones refresh with everything else and need no call sites of their own.

- [x] **Step 5: Style the strip**

Append to `japanese-reader.css`:

```css
/* ---- milestones ---------------------------------------------------------------- */
/* Passed capability only. No badges, no progress bars, no locked slots: an empty
   slot would turn "what you can read" into "what you have not done". */
.milestones { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.milestones[hidden] { display: none; }

.milestone {
  padding: 4px 10px;
  font: 600 11px/1.5 var(--font-body);
  color: var(--accent2-text);
  background: color-mix(in srgb, var(--accent2-dim) 50%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent2) 24%, var(--border));
  border-radius: var(--r-pill);
}

.milestone--next {
  color: var(--text3);
  background: var(--surface-sunken);
  border-style: dashed;
  border-color: var(--border);
}
```

- [x] **Step 6: Verify in the browser**

Start the server:

```bash
npm run serve
```

Open `http://localhost:5506/#settings`. With an empty profile the strip must be **absent** — no empty box, no zero-state text.

Then paste this into the DevTools console to seed a profile and reload:

```js
localStorage.setItem('kotoba-lab:known-kanji', JSON.stringify(
  ['学','生','校','人','日','本','語','先','大','小','中','一','国','年','時']));
location.reload();
```

Expected after reload, on `#settings`: a `10 kanji known` chip, plus readable-word chips reflecting the real count, and at most one dashed "N to …" chip. Confirm:

- Every chip names something already true.
- There is **at most one** dashed forward chip.
- No badge icons, no locked placeholders, no percentages.

Clean up afterwards:

```js
localStorage.removeItem('kotoba-lab:known-kanji');
```

- [x] **Step 7: Run tests**

```bash
npm test
```

Expected: 278 passing, 0 failing.

- [x] **Step 8: Commit**

```bash
git add index.html js/app.js japanese-reader.css
git commit -m "Show passed capability milestones in Profile and Data"
```

---

### Task 3: Version bump and documentation

**Files:**
- Modify: `js/app.js` (the `APP_VERSION` line), `sw.js` (its `APP_VERSION` line), `package.json`
- Modify: `AGENTS.md` — backlog line, a conventions entry, the file map
- Modify: `README.md` — feature bullet

**Interfaces:**
- Consumes: everything from Tasks 1–2
- Produces: nothing

- [x] **Step 1: Bump the version in all three places**

Set `10.25.0` in each of:

- `js/app.js` — the line `const APP_VERSION = '10.24.0';`
- `sw.js` — the identical line
- `package.json` — `"version": "10.24.0",`

All three must match, or `js/sw-routing.test.js` fails. The bump is required regardless, because `index.html`, `js/app.js`, and `japanese-reader.css` are precached and have changed.

- [x] **Step 2: Update the AGENTS.md backlog**

Change the first bullet from `**v10.24.0 current.**` to `**v10.25.0 current.**`, then add a bullet immediately after the "Unlock feedback is ✓ Done" bullet:

```markdown
- Milestones are ✓ Done: Profile & Data lists the capability thresholds already
  passed — kanji known, words readable, words known, cards saved, days reviewed —
  derived from the four profile stores at render time. No ledger, no badges, no
  sixth storage key, and no new surface.
```

- [x] **Step 3: Add the convention**

In `AGENTS.md`, inside the `## Vocabulary conventions` section (it already contains the rule "Reward the learner with real consequences, never invented ones"), add:

```markdown
- Milestones are derived, never recorded. `buildMilestones()` recomputes from
  current profile numbers, so there is no earned-badge state to store, migrate,
  or resynchronise after a profile import.
- Show only milestones already passed, plus at most one nearby next step. Never
  render locked slots, badge grids, tier progress, or percentages: an empty slot
  turns "what you can read" into "what you have not done", which is the
  guilt-heavy shape `IDEA_GARDEN.md` rejects.
- Milestones live inside Profile & Data as content. They must not become their
  own tab or panel — a dedicated page fails the "would the solo user open this
  weekly?" test, and the same call was already made in a sibling project by
  relabelling its Achievements tool to Profile.
```

- [x] **Step 4: Update the AGENTS.md file map**

Add to the `## File map` section:

```markdown
- `js/milestones.js` — pure capability thresholds derived from profile counts;
  no DOM, storage, or fetch, and no persisted earned state.
```

- [x] **Step 5: Update README.md**

Add to the feature list, immediately before the `- **Unlock feedback:**` bullet:

```markdown
- **Milestones:** Profile & Data shows the reading milestones you have actually
  passed — kanji known, words readable, days reviewed — worked out from your
  local data each time it renders, with nothing recorded or awarded.
```

- [x] **Step 6: Verify version consistency and run the full check**

```bash
grep -n "APP_VERSION = " js/app.js sw.js && grep -n '"version"' package.json && npm test && npm run kanjivg:check
```

Expected: all three versions read `10.25.0`, 278 tests passing, and the KanjiVG manifest reporting current checksums.

- [x] **Step 7: Commit**

```bash
git add js/app.js sw.js package.json AGENTS.md README.md
git commit -m "Document milestones"
```

---

## Notes for whoever implements this

- The repository is a static, dependency-free, build-step-free browser app. Do not add a package, a bundler, or a framework.
- `js/app.js` is the single DOM layer and is large. That is known and deliberate; do not refactor it as part of this work.
- Read `AGENTS.md` before starting. It is the project's binding contract, not background reading — especially the five-localStorage-key rule and the design-token rule.
- Verify claims in a browser before reporting the work done. `npm test` cannot see any of the rendering in Task 2.
