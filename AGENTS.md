# Kotoba Lab agent guide

## Current release and backlog

- **v9.0.0 current.** Radical Tree component coloring and the standalone Kanji
  library are ✓ Done.
- Component/radical reverse browsing is a candidate follow-up, not implemented.
- The authoritative design record is
  `../docs/superpowers/specs/2026-08-11-kanji-radical-tree-design.md`.
- Direct Aozora URL fetching remains deferred because a static page cannot
  fetch Aozora cross-origin without a proxy.

## File map

- `js/kanjivg.js` — pure compact-tree decoder; no DOM and no fetch.
- `js/kanjitree.js` — full-screen SVG overlay, animation, drill-down, focus,
  reduced motion, and known-kanji control.
- `js/kanji-browser.js` — pure dictionary catalog search, filtering, sorting,
  and grouping; no DOM or storage.
- `tools/build-kanjivg.mjs` — pinned KanjiVG generator and `--check` command.
- `data/kanjivg.json` — committed 5.84 MB runtime artifact.
- `data/kanjivg.manifest.json` — pinned input and artifact checksums used by CI.
- `js/app.js` — retryable lazy loader plus delegated doorway integration.
- `japanese-reader.css` — app-specific styles, including the tree overlay.

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
search/filter/group/paging, explode/drill/back, `Esc` focus restoration,
known-state propagation, atomic/missing entries, reduced motion, and clean
offline-first-load failure. The only module script in `index.html` remains
`js/app.js`; its imports define load order.
