# Achievements — full game layer — design

- **Date:** 2026-08-16
- **Target release:** v10.31.0
- **Status:** approved, ready for implementation planning

## Problem

Kotoba Lab's Achievements tab (`js/app.js:1827`, `js/milestones.js`) is deliberately
anti-gamified: 12 capability thresholds, computed fresh from current stats on every
render, nothing ever stored, nothing ever shown as locked. That shape was chosen on
purpose — see the "Vocabulary conventions" section of `AGENTS.md` — to avoid the
guilt-heavy feel of an empty badge cabinet.

The owner has now asked, with full awareness of that history, for the opposite: a
genuinely game-like Achievements page inspired by (not copied from) a sibling
project, Thinking Hub — XP, levels, a streak, locked/unlocked badges, an activity
view. This spec is that reversal, scoped and made concrete.

## Goals

- A broader, still-honest achievement set: every achievement fires off data the
  learner already has unconditionally (deck, known words, known kanji, review
  log) — never the opt-in usage journal, so achievements stay fair regardless of
  privacy settings.
- Persisted unlock state: once earned, an achievement stays earned, with a
  timestamp, even if the underlying stat later drops.
- An XP total and a level derived purely from unlocked achievements — no
  separate counter to keep in sync, no grind beyond real accomplishments.
- Locked achievements are visible (grayed badge, label, XP value) rather than
  hidden — the explicit point of this reversal.
- A review streak and a short activity heatmap, both driven by data that
  already exists (`reviewLog`), not new tracking.
- An unlock moment that feels like something, reusing the ink-seal-stamp motif
  already built for Radical Alchemy rather than inventing new motion.
- Round-trips through backup export/import and survives the data-wipe flow like
  every other piece of profile state.

## Non-goals

- No opt-in-usage-journal-sourced achievements ("first Analyze run", "first
  Atlas visit"). Journal is off by default; gating real trophies on it would
  make them silently unavailable to most users. Explicitly out of scope for
  this pass — could be revisited later as a clearly-labeled *bonus* category if
  the owner wants it, but is not part of this spec.
- No live/anywhere unlock detection. Achievements are (re)computed only when
  the Achievements tab renders, same lifecycle as Kanji/Review/Relations today.
  Wiring an achievement check into every mutating action across the app is a
  materially bigger change and isn't needed for the feature to feel good.
- No 365-day heatmap. `reviewLog` keeps 90 days; the heatmap shows exactly that,
  honestly labeled, rather than padding a claim it can't back.
- No changes to the five capability categories' *meaning* — kanji known, words
  readable, words known, cards saved, review days remain exactly what they
  measure today. This spec adds thresholds and two new categories; it does not
  redefine existing ones.

## Architecture

| File | Type | Role |
|---|---|---|
| `js/achievements.js` | new, pure | Replaces `js/milestones.js`. Achievement catalog, XP, level curve, unlock evaluation. No DOM, storage, or fetch. |
| `js/achievements.test.js` | new, test | Catalog shape, unlock evaluation, XP/level math. |
| `js/milestones.js`, `js/milestones.test.js` | delete | Superseded — the file's own header comment ("Deliberately not an achievements system") is no longer true. |
| `js/storage.js` | edit | New `createAchievementLog(key)` factory, mirroring the existing `createReviewLog()` shape. |
| `js/storage.test.js` | edit | Tests for the new factory. |
| `js/backup.js` | edit | `BACKUP_VERSION` 2 → 3. New `achievements` field in state, clean/merge/summary/describe functions. |
| `js/backup.test.js` | edit | Round-trip and merge tests for the new field. |
| `js/app.js` | edit | Import swap, `renderAchievements()` rewrite, wipe-flow and `currentState()`/restore wiring, unlock-celebration trigger. |
| `japanese-reader.css` | edit | Level header, XP bar, category filter pills, locked/unlocked badge states, heatmap, seal-stamp reuse. |
| `js/offline-cache.js` | edit | `JS_MODULES`: remove `js/milestones.js`, add `js/achievements.js`. |
| `AGENTS.md` | edit | Record this reversal the same way the tab-destination reversal was recorded — reasoning kept, not silently overwritten. |
| `README.md` | edit | Feature bullet update. |

### `js/achievements.js`

Exports:

- `ACHIEVEMENTS: readonly Achievement[]` — `{ id, label, category, at, xp, value }`,
  where `value(stats)` reads the relevant stat, matching `js/milestones.js`'s
  existing shape plus `xp` and a fixed `category`.
- `LEVELS: readonly { title: string, at: number }[]` — 8 entries, cumulative XP
  thresholds, see below.
- `buildAchievements(stats, unlockedIds): { unlocked: [...], locked: [...], totalXp, level, levelTitle, xpIntoLevel, xpForNextLevel }`
  — pure function. `unlockedIds` is a `Set<string>` or array of already-persisted
  ids; the function does not decide what's newly true, only what's currently
  true. `unlocked` entries carry `{ id, label, category, at, xp }`; the caller
  attaches the stored timestamp (this module has no concept of "when").
- `evaluateNewlyUnlocked(stats, alreadyUnlockedIds): string[]` — the ids that are
  now true but not yet in `alreadyUnlockedIds`. This is what `app.js` calls once
  per Achievements-tab render to decide what to persist and animate.

Same malformed-input tolerance as `milestones.js`: bad/missing stats degrade to
empty results rather than throwing.

## Achievement catalog

24 achievements across 7 categories. Categories map to existing `--nav-*` tokens
where a natural tab already owns that color, and to `--accent` (seal-ink red) /
`--accent2` (indigo) — both already-defined, already-thematic tokens — for the
two new categories, so no new color tokens are needed.

| Category | Icon | Color token | ids → threshold → XP |
|---|---|---|---|
| Kanji known | 漢 | `--nav-kanji` | `kanji-1`→1→25, `kanji-10`→10→50, `kanji-50`→50→100, `kanji-100`→100→150, `kanji-250`→250→250, `kanji-500`→500→400 |
| Words readable | 読 | `--nav-read` | `readable-1`→1→25, `readable-25`→25→50, `readable-100`→100→150, `readable-500`→500→400 |
| Words known | 語 | `--nav-words` | `words-1`→1→25, `words-50`→50→100, `words-200`→200→250 |
| Cards saved | 札 | `--nav-review` | `cards-1`→1→25, `cards-10`→10→50, `cards-50`→50→100, `cards-200`→200→250 |
| Review days | 暦 | `--nav-relations` | `review-1`→1→25, `review-7`→7→75, `review-30`→30→200 |
| Review streak (new) | 続 | `--accent` | `streak-3`→3→50, `streak-7`→7→125, `streak-30`→30→400 |
| Well-rounded (new) | 全 | `--accent2` | `allround-1`: 1+ kanji known **and** 1+ word known **and** 1+ card saved **and** 1+ review day, simultaneously →200 |

Total achievable XP: **3,475**.

`value(stats)` for the new categories:

- `streak-*` reads `stats.reviewStreak` (new field, sourced from
  `reviewLog.streak()` — see below).
- `allround-1` reads a boolean-ish `stats.wellRounded` computed by the caller as
  `knownKanji >= 1 && knownWords >= 1 && savedCards >= 1 && reviewDays >= 1`,
  passed in already evaluated (keeps `achievements.js` free of compound stat
  logic beyond simple threshold comparisons, matching the existing style).

## Level & XP

Level is a pure function of `totalXp` (sum of XP for every currently-unlocked
achievement) — never stored separately.

```
LEVELS = [
  { title: '白紙',   at: 0 },     // Blank Page
  { title: '見習い', at: 100 },   // Apprentice
  { title: '学徒',   at: 250 },   // Student
  { title: '探究者', at: 500 },   // Explorer
  { title: '熟練者', at: 900 },   // Adept
  { title: '達人',   at: 1500 },  // Expert
  { title: '名人',   at: 2300 },  // Master
  { title: '皆伝',   at: 3475 },  // Full Transmission — earning every achievement
]
```

Reaching 3,475 XP (every achievement) lands exactly on level 8, so the top title
is only reachable by genuinely unlocking everything — no grind manufactured
beyond what the achievements themselves already require.

## Storage & persistence

New `localStorage` key: `kotoba-lab:achievements`. This is the sixth key,
reversing the "exactly five keys is doctrine" rule — recorded in AGENTS.md
alongside the reasoning below, same as the earlier tab-destination reversal.

`createAchievementLog(key)` in `js/storage.js`, mirroring `createReviewLog`:

```js
export function createAchievementLog(key) {
  let unlocked = readJSON(key, {}); // { [id]: timestampMs }
  const persist = () => writeJSON(key, unlocked);
  return {
    has: (id) => id in unlocked,
    record(id, at = Date.now()) {
      if (id in unlocked) return false; // already earned — never overwritten
      unlocked[id] = at;
      persist();
      return true;
    },
    all: () => ({ ...unlocked }),
    replaceAll(next) { unlocked = { ...next }; persist(); },
    clear() { unlocked = {}; persist(); },
  };
}
```

`record()` never overwrites an existing timestamp — first-earned wins, which
matters once backup import can also call it (see below).

### Backup integration

`BACKUP_VERSION` 2 → 3. `state.achievements: { [id]: timestampMs }` joins
`deck`/`knownWords`/`knownKanji`/`reviewLog` everywhere that shape appears:

- `cleanLog`-style validator: keys must be a known achievement id (checked
  against `ACHIEVEMENTS` ids at call time, matching how `cleanCard` tolerates
  garbage) and values a finite non-negative number; anything else is dropped.
- `backupSummary()` gains `achievementsUnlocked: Object.keys(...).length`.
- `mergeState()`: per id, keep the **earlier** timestamp
  (`Math.min(current[id] ?? Infinity, incoming[id] ?? Infinity)`) — the trophy
  was earned whenever it was first true on whichever device got there first,
  mirroring the "earliest `savedAt` wins" rule already used for deck cards.
  Track `achievementsAdded` in the returned `stats` for `describeMerge()`.
- `describeMerge()` adds an `"N achievement(s)"` clause when
  `stats.achievementsAdded > 0`.
- Old (v2) backups have no `achievements` field at all; `inspectBackup` treats
  a missing field exactly like an empty object, so importing an old backup
  unlocks nothing retroactively and imports cleanly.

### `js/app.js` wiring

- `currentState()` (around `js/app.js:2064`) adds `achievements: achievementLog.all()`.
- The restore path (around `js/app.js:2115`) adds
  `achievementLog.replaceAll(state.achievements)`.
- The wipe-confirmation `names` map (around `js/app.js:2017`) adds
  `achievements: 'achievement history'`.
- The empty-state check (around `js/app.js:2070`) includes
  `Object.keys(state.achievements).length`.
- `js/offline-cache.js`'s `JS_MODULES` drops `'js/milestones.js'`, adds
  `'js/achievements.js'` — alphabetically first in the array, ahead of
  `js/analyze.js`.

## Unlock detection & celebration

`renderAchievements()` (replacing today's version) on every tab render:

1. Computes `stats` (same shape as today, plus `reviewStreak: reviewLog.streak()`
   and the derived `wellRounded` boolean).
2. Calls `evaluateNewlyUnlocked(stats, achievementLog.all())` to get ids that
   just became true.
3. For each, `achievementLog.record(id)` — persists with `Date.now()`.
4. Calls `buildAchievements(stats, achievementLog.all())` for the full
   unlocked/locked view, attaching stored timestamps from `achievementLog.all()`
   to each unlocked entry for the "earned on …" hover/tap detail.
5. Renders the grid; badges whose id was in step 2's list get the
   `.achievement-unlocking` class for one animation cycle, then it's not
   reapplied on the next render (a module-level `Set` of "already celebrated
   this session" ids, cleared only on reload — celebration is a one-time thing
   per session, not per render).

### Animation

Reuses the existing `#seal` symbol (`assets/alchemy/alchemy-icons.svg`) and the
`alchemy-seal-stamp` keyframe (`japanese-reader.css:689`,
`scale(1.8) rotate(-14deg)` → settle) rather than building a new motif. The
keyframe is generalized to a shared name (e.g. `seal-stamp`) usable from both
Radical Alchemy and Achievements, with the Alchemy-specific alias kept as an
`animation-name` reference so nothing there needs to change.

Newly-unlocked badges: the `#seal` glyph stamps down in `--accent` (seal-ink
red) over the badge on first render after unlock, then settles to the badge's
normal unlocked state. Under `prefers-reduced-motion: reduce`, the stamp
appears instantly at its settled state — no animation, matching the project's
existing reduced-motion rule for Alchemy's own seal stamp.

## Streak & activity heatmap

Both computed from the existing `reviewLog` — no new tracking module.

- **Streak**: `reviewLog.streak()` already exists (`js/storage.js:100`),
  unchanged. Shown in the page header as "N day streak" with the 続 glyph.
- **Heatmap**: a 90-day grid (13 columns × 7 rows, GitHub-contribution-style)
  built directly from `reviewLog.all()` (`{ 'YYYY-MM-DD': count }`). Intensity
  bucketed into 4 steps (0 / 1–2 / 3–5 / 6+) using `color-mix` steps of
  `--nav-relations` (the streak category's neighbor tone) rather than inventing
  a new scale. Explicitly labeled "Review activity — last 90 days", not a
  generic "activity" claim, since it only reflects review answers, not every
  tab visited.

## Visual & interaction design

- **Header**: level title (皆伝 etc.) + XP bar to next level (`xpIntoLevel` /
  `xpForNextLevel` from `buildAchievements()`), "N of 24 unlocked" count,
  current streak. All derived, nothing separately stored.
- **Category filter pills**: All / Kanji / Readable / Words / Cards / Review /
  Streak / Well-rounded, colored via each category's token. Filtering is
  client-side, no persisted filter state (ephemeral UI state only, consistent
  with e.g. Alchemy's mode toggles).
- **Badge grid**: extends today's `.achievement-card` (`japanese-reader.css:1999`)
  with a locked variant:
  - Unlocked: full category color, glyph, label; hover/tap reveals the earned
    date (from the persisted timestamp).
  - Locked: `filter: grayscale(1) opacity(.5)`-style desaturation on the same
    glyph, label, and an XP value badge (e.g. "+150 XP") — no "N to go"
    countdown text, so a locked badge states what it's worth, not how far away
    it is. This is the deliberate middle ground: locked slots are now visible
    (the whole point of this reversal) without reintroducing the countdown
    framing the original doctrine specifically objected to.
- **Reduced motion**: XP bar fill, seal-stamp, and any card hover transform all
  get static equivalents under `prefers-reduced-motion: reduce`, per the
  existing project-wide rule.

## Error handling

- Malformed/missing stats → `buildAchievements` returns an all-locked,
  zero-XP, level-1 result rather than throwing (mirrors `milestones.js`'s
  existing tolerance).
- A corrupted `kotoba-lab:achievements` value in `localStorage` (hand-edited or
  from a future version) → `readJSON` already falls back to `{}` on parse
  failure (existing `storage.js` behavior reused, not new).
- An achievement id present in storage but no longer in the `ACHIEVEMENTS`
  catalog (a future removal) is preserved in storage but simply doesn't render
  — never crashes, never silently deletes the user's earned data.

## Testing

`js/achievements.test.js`:

- Every entry in `ACHIEVEMENTS` has a unique id, positive `at`, positive `xp`,
  a valid `category`, and a `value` function.
- `LEVELS` thresholds are strictly increasing and the last equals the sum of
  every achievement's `xp`.
- `buildAchievements` with all-zero stats returns everything locked, level 1,
  `totalXp: 0`.
- `buildAchievements` with stats past every threshold returns everything
  unlocked and `level === LEVELS.length`.
- `evaluateNewlyUnlocked` returns only ids that are true-now-but-not-in-the-
  already-unlocked-set; returns `[]` when nothing changed; returns `[]` (not a
  throw) for malformed input.
- The well-rounded achievement requires all four conditions — verify each
  condition alone is insufficient.
- Streak achievements read `stats.reviewStreak`, independent of `reviewDays`.

`js/storage.test.js` additions: `createAchievementLog` — `record()` persists,
`record()` on an already-present id is a no-op (timestamp unchanged),
`replaceAll`/`clear`/`all` round-trip.

`js/backup.test.js` additions: v3 round-trip includes `achievements`; importing
a v2 backup (no `achievements` field) doesn't throw and yields `{}`; merge keeps
the earlier of two timestamps for the same id; a garbage `achievements` value
degrades to `{}` rather than throwing.

Browser QA (unit tests can't cover rendering):

- Seed known-kanji/words/cards/review data, open Achievements: correct badges
  unlocked, correct XP/level, locked badges show grayed glyph + XP only.
- Cross a new threshold via Kanji tab, then open Achievements: new badge plays
  the seal-stamp once; reopening the tab afterward does not replay it.
- Un-mark a kanji that had unlocked `kanji-10`: badge stays unlocked (ledger,
  not derived).
- Export a backup, wipe data, import it back: achievements, level, and streak
  all restored.
- Reduced-motion OS setting: seal-stamp and XP bar fill are static, everything
  else about the page is unchanged.
- Heatmap matches `reviewLog` data exactly for a seeded 90-day window.

## Documentation

- **AGENTS.md**: replace the "Milestones are derived, never recorded" /
  "no locked slots, badge grids, tier progress" bullets with the new rules,
  keeping the old reasoning quoted for context (same pattern already used for
  the tab-destination reversal at `AGENTS.md:555`). New bullets cover: the
  sixth storage key, XP/level derivation, the "earned stays earned" rule, and
  that opt-in usage-journal events are deliberately excluded from achievement
  sourcing.
- **File map**: replace the `js/milestones.js` entry with `js/achievements.js`.
- **Backlog line**: new v10.31.0 entry describing the game layer.
- **README.md**: feature bullet update from "Milestones" language to
  "Achievements" language.

## Versioning

`APP_VERSION` → `10.31.0` in `js/app.js` and `sw.js`; `package.json` `version`
→ `10.31.0`. Required regardless, since `index.html`, `js/app.js`, and
`japanese-reader.css` all change and are precached.

## Risks

- **Backup format bump (v2→v3)** is the main compatibility-sensitive change.
  Mitigated by treating a missing `achievements` field as `{}` on import
  (tested explicitly) rather than requiring every backup to carry it.
- **Session-scoped celebration tracking** (the "don't replay the stamp" set)
  is memory-only and resets on reload. If a user unlocks something and reloads
  before seeing Achievements, the stamp still plays once on next visit — this
  is fine (the point is "don't spam it every render"), not "show it exactly
  once ever."
- **Renaming `js/milestones.js` → `js/achievements.js`** touches the
  `offline-cache.js` precache list and both files' test suites. Low risk since
  it's a pure module with no external consumers besides `app.js`'s single
  render function, but worth calling out as a rename, not just an addition.
