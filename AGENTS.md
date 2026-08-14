# Kotoba Lab agent guide

## Current release and backlog

- **v10.4.0 current.** Radical Tree component coloring, the standalone Kanji
  library, Group A stroke/reading families, and Group B radical/component
  reverse browsing are ✓ Done. Group C family study workspaces is also ✓ Done.
- Phonetic Component Lab, Kanji Contrast Lab, Text-to-Study Journey, and Family
  Mix Challenge are ✓ Done.
- The first/default sample is the original mixed-level anime-style scene
  `星が消える前に`; keep public samples original or clearly licensed.
- Mobile Group A is ✓ Done: compact sticky branding, a safe-area-aware bottom
  tab bar, touch-sized input/sample controls, and a Read details bottom sheet.
- Mobile Group B is ✓ Done: always-visible search/JLPT controls, collapsible
  advanced filters, compact result cards, and phone-sized family-study layouts.
- Mobile Group C is ✓ Done: focused Review cards, saved-deck cards and backup
  controls, direct My Words entry, and a compact full-screen Radical Tree.
- Direct Aozora URL fetching remains deferred because a static page cannot
  fetch Aozora cross-origin without a proxy.
- The startup warning flash is ✓ Fixed: it stays hidden during normal HTTP
  loading, appears immediately for `file://`, and falls back after four seconds
  only when the module graph genuinely never starts.
- KanjiVG path compaction is ✓ Fixed: tiny negative coordinates that round to
  zero retain `-0` so their minus sign continues to separate adjacent SVG
  numbers. The corrected artifact repairs 9,051 paths across 4,484 kanji.
- Visual polish Group A is ✓ Done: layered washi surfaces, clearer elevation,
  stronger hierarchy, indigo support, and harmonized Kanji/Review/Tree styling.
- Interaction polish Group B is ✓ Done: tab and panel transitions, tactile
  controls, animated disclosures, staggered Kanji results, and a complete
  reduced-motion path.
- Study feedback Group C is ✓ Done: answer reveals, Review-grade acknowledgement,
  correct/incorrect result treatments, progress/completion moments, known/save
  confirmations, mobile-safe toasts, and richer Radical Tree component focus.
- Kanji Relationship Map Groups A–C are ✓ Done: the pure engine combines
  canonical radicals, direct components, normalized readings, and supporting
  stroke proximity into bounded neighborhoods; the full-screen map adds
  evidence connectors, recenter/back navigation, known/text/JLPT context, and
  app-wide doorways. Phones use swipeable Structure and Readings lanes.

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
- Keep the inline classic startup fallback immediately beside
  `#boot-warning`. `js/app.js` must cancel its timer as soon as the module graph
  starts and explicitly reveal the banner only for a real dictionary failure.

## File map

- `js/kanjivg.js` — pure compact-tree decoder; no DOM and no fetch.
- `js/kanjitree.js` — full-screen SVG overlay, animation, drill-down, focus,
  reduced motion, and known-kanji control.
- `js/kanji-browser.js` — pure dictionary catalog search, filtering, sorting,
  sections, and stroke/reading/radical/component families; no DOM or storage.
- `js/kanji-relationships.js` — pure reusable relationship index, evidence
  ranking, common-reading bounds, and deterministic neighborhood selection;
  no DOM, storage, fetch, or stroke paths.
- `js/kanji-map.js` — accessible full-screen relationship canvas, evidence
  detail, navigation history, known-state control, and compact mobile lanes.
- `js/kanji-study.js` — pure ephemeral family-session state, reveal progress,
  bounded navigation, and shuffle/restart behavior; no DOM or storage.
- `js/kanji-labs.js` — pure phonetic-signal analysis, contrast-set generation,
  question selection, and session scoring; no DOM or storage.
- `js/text-journey.js` — pure text-specific route ranking, projected coverage,
  word/context collection, and ephemeral journey navigation; no DOM/storage.
- `tools/build-kanjivg.mjs` — pinned KanjiVG generator and `--check` command.
- `data/kanjivg.json` — committed 5.84 MB runtime artifact.
- `data/kanji-families.json` — committed compact radical/direct-component
  reverse index; lazy-loaded only for structural family views.
- `data/kanjivg.manifest.json` — pinned input and artifact checksums used by CI.
- `js/app.js` — retryable lazy loader plus delegated doorway integration.
- `japanese-reader.css` — app-specific styles, including Tree and Relationship
  Map overlays and their responsive layouts.
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
- Keep visual depth derived from the palette tokens (`--surface-raised`,
  `--surface-sunken`, `--surface-warm`, and ink-shadow tokens). Vermilion is
  the primary action signal; indigo supports structure and depth.
- Motion confirms navigation and newly rendered content but never carries
  meaning alone. Every new animation or transform needs a matching
  `prefers-reduced-motion` rule.
- Review scheduling must be persisted before its 240 ms grade acknowledgement;
  the animation may delay rendering the next card, never saving the answer.
- Component colors are positional and non-semantic. Keep the assembled kanji
  monochrome; color direct children only in the separated state, and match each
  component button without relying on color as its label.
- `compactPath()` must preserve negative zero. In SVG path syntax a minus sign
  can separate adjacent coordinates, so converting `3.57-0.01` to `3.60`
  silently merges two Bézier parameters and distorts the stroke.

## Mobile interface conventions

- At 780px and below, keep the five primary tabs in the fixed bottom bar and
  leave the sticky header for compact branding. Respect safe-area insets and
  reserve enough main-content padding that the bar never covers actions.
- Tab changes return phone layouts to the top of the new workspace and keep
  `aria-current` synchronized with the active panel.
- Sample passages swipe horizontally on phones. Primary touch controls should
  be at least 44px high without enlarging desktop controls.
- Read details use the inline sticky sidebar on desktop and an anchored bottom
  sheet above the tab bar on phones. The close button, scrim, and Escape must
  all dismiss it; do not add navigation or persistence for sheet state.
- Keep Kanji search and the horizontally swipeable JLPT levels visible on
  phones. Stroke, learning-state, sort, and view controls belong in the
  ephemeral advanced-filter disclosure; its badge reflects active filters.
- Starting any family, phonetic, contrast, or mix session on a phone scrolls
  the study workspace beneath the sticky header. Hidden answers must not take
  vertical space, and study controls remain at least 44px high.
- The shared text editor belongs only to Analyze and Read. Kanji, Review, and
  My Words open directly at their independent workspace content.
- Review uses a two-column grade grid on phones. My Words turns saved-deck
  table rows into labelled cards and stacks export/backup actions at the
  narrowest width; desktop retains the table.
- The phone Radical Tree keeps the dictionary panel visible below a compact
  drawing stage, uses horizontal component chips, and preserves 44px controls,
  drill-down, Back, Close, replay, and focus restoration.

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

## Kanji family study conventions

- A study session snapshots the selected family after the current search,
  JLPT, stroke, known-state, and sort filters have been applied. It does not
  silently expand to the unfiltered family.
- Reveal progress, order, and the current card are session-only. Closing,
  changing a family/filter, or reloading ends that progress; do not add a
  storage key for it.
- Known-state changes reuse `kotoba-lab:known-kanji` and must refresh the Read,
  My Words, Kanji browser, Review, and study-workspace views together.
- Keep study controls keyboard reachable. Left/right navigation resets the
  answer and returns focus to Reveal; Space activates Reveal through the
  focused button. Radical Tree close returns focus to its study doorway.
- Shuffle & restart randomizes the full session snapshot and clears reveal
  progress without changing known-kanji state.

## Kanji Relationship Map conventions

- Every connection must expose its evidence. Approved primary reasons are a
  shared canonical radical, direct visual component, normalized on’yomi, or
  normalized kun’yomi; do not infer etymology or semantic similarity.
- Stroke proximity is supporting evidence only. It may strengthen an existing
  relationship but must never create a neighbor by itself.
- Structural evidence outranks readings. Smaller families receive only a
  modest rarity bonus, and reading-only neighbors stay bounded so a common
  reading cannot fill the future canvas.
- Reuse `data/kanji-families.json` for structure. Building or browsing a
  relationship neighborhood must not load the 5.84 MB KanjiVG stroke artifact.
- Relationship indexes and navigation are ephemeral. Do not add a storage key;
  known state must continue to use `kotoba-lab:known-kanji` when UI arrives.

## Phonetic Component Lab conventions

- A signal is a measured correlation between one direct visual component and
  the listed on’yomi of filtered family members. Never label it an etymology,
  historical derivation, or formal phonetic-role classification.
- Require at least three family members with on’yomi, at least two matches for
  the dominant normalized reading, and at least 50% consistency. Show evidence
  as matches/readable members and keep exceptions in the practice session.
- Count each normalized reading at most once per kanji. Multi-reading kanji may
  support several candidate readings, but only the deterministic dominant
  signal is presented for a component.
- Phonetic sessions are ephemeral and reuse the existing family-study surface,
  known-kanji state, filters, sorting, and Radical Tree doorway. Do not add a
  score or progress storage key.

## Kanji Contrast Lab conventions

- Contrast sets contain three to five filtered kanji that share one direct
  visual component and have distinct dictionary meanings. Preserve the active
  card sort when choosing the bounded set.
- Meaning questions are always available. Use an on’yomi question only when
  that normalized reading uniquely identifies the current answer inside its
  set; otherwise fall back to meaning instead of presenting an ambiguous clue.
- Keep the answer glyph hidden until a real choice is made. After reveal, show
  meaning, both dictionary reading fields, known-state control, and the same
  Radical Tree doorway used elsewhere.
- Contrast sessions and scores are ephemeral, filter-aware, and use no new
  storage key. Shuffle & restart clears both progress and answers.

## Text-to-Study Journey conventions

- Rank only unknown kanji from the active text, primarily by occurrence count
  and secondarily by the number of distinct tokenizer words they unlock. Keep
  the default route bounded to six kanji.
- Coverage projections count kanji occurrences, matching the Analyze coverage
  meter. Label the result as projected coverage, never a fluency estimate.
- Derive words and sentence contexts from the current tokenizer pass. Do not
  call an external corpus or manufacture example sentences.
- Journey routes, reveal progress, and navigation are temporary. Mark known is
  the only persistent action and must reuse `kotoba-lab:known-kanji`; finishing
  returns to the existing Read view of the unchanged source text.

## Family Mix Challenge conventions

- Mix mode is optional and available for exact-stroke, on’yomi, kun’yomi,
  radical, and direct-component families. Keep phonetic signals and contrast
  sets in their dedicated practice modes.
- Require two to five selected families. Exclude a kanji when it belongs to
  more than one selected family so every question has exactly one valid answer.
- Build at most 20 questions in balanced round-robin family order before any
  shuffle. Preserve the filtered family snapshots and their current card sort.
- Mix selection, score, order, and progress are ephemeral. Shuffle & restart
  clears answers and progress; known state and Radical Tree use existing paths.

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
family-study start/reveal/move/shuffle/known/tree/close behavior,
phonetic-signal thresholds/evidence/prediction scoring,
contrast-set bounds/distinct clues/answer scoring,
text-journey ranking/coverage/context/session navigation,
family-mix selection/ambiguity exclusion/interleaving/scoring/restart,
explode/drill/back, `Esc` focus restoration,
known-state propagation, atomic/missing entries, reduced motion, and clean
offline-first-load failure. The only module script in `index.html` remains
`js/app.js`; its imports define load order.
