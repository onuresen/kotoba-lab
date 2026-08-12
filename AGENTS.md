# Kotoba Lab agent guide

## Current release and backlog

- **v9.2.0 current.** Radical Tree component coloring, the standalone Kanji
  library, Group A stroke/reading families, and Group B radical/component
  reverse browsing are ✓ Done.
- Group C study workspaces is next.
- Direct Aozora URL fetching remains deferred because a static page cannot
  fetch Aozora cross-origin without a proxy.

## Public repository conventions

- This repository is the canonical, self-contained Kotoba Lab source.
- Keep documentation public-facing. Do not add local absolute paths, private
  vault links, generated portfolio notes, or dependencies on sibling repos.
- Original source uses the top-level MIT license. Preserve the separate
  licenses and attribution described in `data/ATTRIBUTION.md` and
  `vendor/kuromoji/VENDORED.txt`.
- The privacy promise is documented in `PRIVACY.md`: Japanese text and study
  state stay in the browser. Any future networked feature requires an explicit
  privacy and architecture decision before implementation.
- GitHub Pages publishes `main` at `https://onuresen.github.io/kotoba-lab/`
  through `.github/workflows/pages.yml`. Keep deployment test-gated and do not
  grant Pages write or OIDC permissions to the pull-request test job.

## File map

- `js/kanjivg.js` — pure compact-tree decoder; no DOM and no fetch.
- `js/kanjitree.js` — full-screen SVG overlay, animation, drill-down, focus,
  reduced motion, and known-kanji control.
- `js/kanji-browser.js` — pure dictionary catalog search, filtering, sorting,
  sections, and stroke/reading/radical/component families; no DOM or storage.
- `tools/build-kanjivg.mjs` — pinned KanjiVG generator and `--check` command.
- `data/kanjivg.json` — committed 5.84 MB runtime artifact.
- `data/kanji-families.json` — committed compact radical/direct-component
  reverse index; lazy-loaded only for structural family views.
- `data/kanjivg.manifest.json` — pinned input and artifact checksums used by CI.
- `js/app.js` — retryable lazy loader plus delegated doorway integration.
- `japanese-reader.css` — app-specific styles, including the tree overlay.
- `README.md` — concise public overview, local setup, architecture, and license
  boundaries.
- `PRIVACY.md` — public description of local storage and network requests.
- `.github/workflows/pages.yml` — tests pushes and pull requests; deploys the
  static repository root only after tests pass on `main`.

## Kanji Radical Tree conventions

- Runtime stays offline: fetch only committed `data/`; never call KanjiVG at
  runtime.
- Keep one delegated `[data-kanji-tree]` path. The approved doorways are Read
  info chips, revealed Review kanji, and My Words known-kanji buttons.
- Do not turn reading-view `[data-k]` spans into tree doorways; they select the
  containing word by design.
- The Read info chip opens the tree without replacing its surrounding word
  panel, so `Esc` can restore focus to the same chip.
- My Words glyph and remove actions must remain separate real buttons.
- Preserve the pure/DOM split: decomposition belongs in `kanjivg.js`; overlay
  behavior belongs in `kanjitree.js`.
- Use design tokens in CSS; do not add hardcoded colors.
- Component colors are positional and non-semantic. Keep the assembled kanji
  monochrome; color direct children only in the separated state, and match each
  component button without relying on color as its label.

## Kanji library conventions

- The Kanji tab is text-independent and uses the already-loaded
  `data/kanjidic.json`; do not make KanjiVG a prerequisite for browsing.
- Keep catalog logic pure in `kanji-browser.js`. The DOM renderer stays in
  `app.js`, with bounded result rendering and one delegated
  `[data-kanji-tree]` doorway per card.
- Search covers glyph, English meaning, on'yomi, and kun'yomi with normalized
  hiragana/katakana and punctuation-insensitive readings.
- Filters add no persisted preferences. Known/unknown uses the existing
  `kotoba-lab:known-kanji` set.
- `buildKanjiFamilies()` owns family membership. Exact strokes are
  single-membership; on’yomi and kun’yomi are multi-membership, so one kanji
  may appear in several reading families.
- Split readings on `、`, normalize hiragana/katakana for matching, remove
  source `*` markers, and compare the full spoken kun reading without
  dictionary okurigana parentheses. Keep the original dictionary strings on
  cards.
- Shared-reading families require at least two matching kanji and sort by
  family size, then Japanese label. Exact-stroke families sort numerically.
- Radical families use KanjiVG's `kvg:radical` marker and normalize variant
  shapes through `kvg:original` (for example, ⺡ under 水). Component families
  use the direct labelled children shown by the first Radical Tree separation;
  keep visual variants distinct. Both require at least two matching kanji and
  preserve the current card sort inside each family.
- Load `data/kanji-families.json` only when a radical/component view is chosen.
  Do not load the 5.84 MB stroke-path artifact until a Radical Tree doorway is
  opened. Both generated artifacts come from the same pinned KanjiVG release
  and are covered by the manifest/check command.
- The selected family is ephemeral UI state. Do not add a localStorage key for
  browsing preferences.

## Persistent state

There are exactly four localStorage keys. The Radical Tree adds none:

- `kotoba-lab:deck`
- `kotoba-lab:known-words`
- `kotoba-lab:known-kanji`
- `kotoba-lab:review-log`

## Verification

```bash
npm test
npm run kanjivg:check
```

`npm test` must keep the explicit `node --test "js/*.test.js"` glob. Browser QA
must cover Read, Review, My Words, and Kanji-library doorways,
search/filter/group/family switching/paging (including lazy structural-family loading),
explode/drill/back, `Esc` focus restoration,
known-state propagation, atomic/missing entries, reduced motion, and clean
offline-first-load failure. The only module script in `index.html` remains
`js/app.js`; its imports define load order.
