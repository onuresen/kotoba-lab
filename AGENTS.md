# Kotoba Lab agent guide

## Current release and backlog

- **v10.24.0 current.** Radical Tree component coloring, the standalone Kanji
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
- Relations workspace Groups A–C are ✓ Done: the `縁 Relations` tab lazy-loads the
  compact relationship index, embeds the existing one-hop explorer, and offers
  dictionary search plus current-text, known-kanji, and discovery starting
  points. Evidence, JLPT, learning-context, and 12/24/40-result filters apply
  before ranking; overflow results use a desktop gallery and mobile lanes.
  The optional bounded two-hop view balances structural and reading branches,
  supports branch expansion, root changes, zoom/reset, Radical Tree doorways,
  and clustered mobile swipe lanes without replacing the one-hop default.
- Kanji Constellation Atlas Groups A–D are ✓ Done: an experimental third Relations
  view projects one selected direct-component family into a deterministic,
  bounded 24-star sky. Existing known-kanji state illuminates stars, unfamiliar
  stars stay quiet, and each star returns to its normal one-hop neighborhood.
  Star focus now opens a reading/detail panel with known-state control, explicit
  Neighborhood and Radical Tree doorways, and an Atlas-root action that keeps
  the current component when valid. The chosen component, star, and Atlas
  position are ephemeral and add no storage key. Solid component spokes now
  sit beside bounded dashed reading routes; learners can hide those routes and
  zoom the sky from 80–120%. Gentle route, center, and known-star motion makes
  the sky feel alive while the reduced-motion path remains completely still.
  The final study loop opens unknown visible stars as a temporary constellation
  session, returns directly to the same Atlas, exports all visible stars through
  the existing private-data-free pack format, and offers ephemeral component
  and reading-exception challenges. Opt-in usage counts stay payload-free.
- Desktop space-efficiency Groups A–C are ✓ Done: shared layout tokens keep
  Analyze, Read, and Review at the focused reading measure while data-heavy
  Kanji and My Words expand to 1440 px and Relations to 1560 px. Atlas uses a
  larger canvas from 1440 px upward without page overflow. Its session-only
  focus mode hides the surrounding Relations setup, preserves the current
  component and selected star, exits with Escape or when leaving the view, and
  stays unavailable on phones where touch panning remains.
- Radical Alchemy Group A is ✓ Done: the Kanji-library doorway opens a
  deterministic five-formula Today’s Brew spanning N5–N1. Only unique pairs
  of exactly two direct labelled components become questions; every reveal
  cites that visual-structure evidence, avoids etymology claims, and offers a
  delegated Radical Tree doorway. The lab, score, and current formula are
  ephemeral, add no storage key, and keep full stroke paths lazy.
- Radical Alchemy Group B is ✓ Done: a 78 KB original text-free workbench WebP
  provides quiet atmosphere while a reusable SVG sprite owns every functional
  flask, crucible, book, seal, spark, and transmutation-circle symbol. Bubbles,
  vessel pours, ink bloom, seal stamping, and completion sparkle remain
  restrained and become fully static under reduced motion. Study meaning and
  controls stay in accessible HTML rather than the generated image.
- Radical Alchemy Group C is ✓ Done: result, missing-ingredient, reverse, and
  short transformation-chain modes all derive from the same unambiguous direct
  component recipes. An all/unknown target filter, answer-level known controls,
  and a session-only recipe trail support different study intentions. The trail
  can open in the existing temporary reveal-card workspace and adds no score,
  streak, profile field, or storage key.
- Offline PWA support is ✓ Done: a pure `js/offline-cache.js` policy module owns
  the precache list, tier assignment, and per-type strategies while `sw.js` stays
  a thin Cache API shell. Tier 1 precaches the whole default application
  including the stroke artifact, so Radical Tree works offline unconditionally;
  only the opt-in kuromoji tokenizer is held back behind a deliberate download in
  Profile & Data. Updates are version-stamped and offered through an explicit
  reload prompt so no ephemeral session is destroyed. The application is
  installable to an Android home screen.
- Profile & Data is ✓ its own panel: application-level data management left the
  My Words study tab and now lives at `[data-panel="profile"]`, reached from a
  Settings control in the header. It deliberately has no slot in the bottom tab
  bar, so the mobile bar stays at six columns. My Words keeps Known, Saved deck,
  and Portable Study Packs.
- Back-button routing is ✓ Done: tabs push hash routes, so the Android back
  gesture steps back through views instead of leaving the installed app, and
  views are bookmarkable. `#settings` opens Profile & Data. Full-screen overlays
  are deliberately not routed; they keep their own Close buttons.
- Compound words is ✓ a bounded first experiment: a My Words card reports the
  all-kanji compounds every one of whose characters is already marked known —
  the reverse of the decomposition features. Ranked easiest-first by JLPT, capped
  at 24 visible while the total stays honest, kanji reuse the existing
  `[data-kanji-tree]` doorway, and each word can be saved straight into the
  review deck. No new storage key, tab, or usage event.
- Compound saves reuse the ordinary deck entry shape and carry no sentence
  context, because a word discovered from the known-kanji set has no source
  text behind it. `readableCompoundIndex` holds only the visible rows so saving
  never rescans the vocabulary.
- Kanji and vocabulary are ✓ no longer separate: `wordsContaining()` supplies
  the "Appears in" list shown in the Radical Tree info panel and the Read kanji
  panel, so every existing tree doorway now also reaches vocabulary. Analyze
  frequency-table kanji became Radical Tree and Relationship Map doorways
  instead of an inert ranking.
- Word lookup is ✓ Done: `js/word-browser.js` searches the 10,808 committed
  vocabulary entries by surface, normalized reading, or English meaning, with
  JLPT and readable-state filters. It closes the asymmetry where 6,813 kanji
  were fully browsable while words were reachable only through pasted text.
  Results share one row shape with the compound card, so both save into the
  review deck the same way.
- Data Management Groups A–C are ✓ Done: Profile & Data exports versioned full
  profiles with metadata, previews imports before any write, defaults to a
  repeat-safe merge, and gates replacement behind confirmation. Portable Study
  Packs export current-text, selected-family, or Relations kanji without any
  personal progress and import into an ephemeral family-study session. The
  local dashboard summarizes card readiness, known collections, review activity,
  and profile size; categories clear independently and full reset requires the
  exact typed phrase `RESET KOTOBA LAB`.
- Local Usage Journal Group A is ✓ Done: the opt-in, browser-only journal keeps
  90 days of daily session, visible-active-minute, and fixed coarse-action
  counts. Profile & Data exposes today/overall summaries plus pause and reset;
  no content payload can enter the journal. Group B is ✓ Done: a pure local
  insight engine shows feature rhythm and cautious friction prompts for review
  queues, Analyze-to-Read handoff, exploration-to-practice handoff, and brief
  sessions. Group C is ✓ Done: a previewable/copyable/downloadable Markdown
  report shares aggregate activity, feature rhythm, profile totals, and fixed
  signal labels without exposing the raw journal or study content.
- `IDEA_GARDEN.md` is the durable creative backlog. Radical Alchemy Groups A–C
  and Kanji Constellation Atlas Groups A–D are ✓ Done. Kanji Genealogy and
  Japanese Detective Board remain parked, unapproved ideas. The original list
  order is no longer an implementation queue; continue from observed study
  friction and request approval for every new bounded experiment.

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
- `js/kanji-map.js` — reusable embedded/full-screen relationship canvas,
  evidence detail, navigation history, known-state control, and mobile lanes.
- `js/kanji-study.js` — pure ephemeral family-session state, reveal progress,
  bounded navigation, and shuffle/restart behavior; no DOM or storage.
- `js/kanji-labs.js` — pure phonetic-signal analysis, contrast-set generation,
  question selection, and session scoring; no DOM or storage.
- `js/kanji-alchemy.js` — pure unique two-component recipe generation,
  deterministic daily selection, answers, scoring, and bounded navigation;
  no DOM, storage, fetch, or stroke paths.
- `assets/alchemy/` — optimized original workbench backdrop, code-native SVG
  icon sprite, and public asset provenance. Runtime references stay relative
  so they work beneath the GitHub Pages project path.
- `js/text-journey.js` — pure text-specific route ranking, projected coverage,
  word/context collection, and ephemeral journey navigation; no DOM/storage.
- `js/backup.js` — pure versioned profile serialization, inspection, backward-
  compatible parsing, summary metadata, and repeat-safe merge rules.
- `js/profile-dashboard.js` — pure card/readiness, known/review, and byte-size
  metrics plus category-level and full-profile reset helpers; no DOM/storage.
- `js/usage-journal.js` — opt-in, allowlisted daily usage counters with no
  payload API, 90-day retention, pause/reset controls, and summary helpers.
- `js/usage-insights.js` — pure feature-mix and threshold-based friction prompts
  derived from journal totals plus the current due-card count; no DOM/storage.
- `js/usage-report.js` — pure, deliberately lossy Markdown report and filename;
  output labels are whitelisted and arbitrary caller prose is never emitted.
- `js/study-pack.js` — pure portable kanji-pack schema, sanitization, filenames,
  and conversion into an ephemeral family-study snapshot; no DOM/storage.
- `js/offline-cache.js` — pure precache list, tier assignment, per-type strategy
  selection, and version-stamped cache naming; no DOM, fetch, or Cache API.
- `sw.js` — thin service worker: precache on install, discard stale version
  caches on activate, apply the imported strategies on fetch, and accept only
  `SKIP_WAITING`. Holds no path list of its own.
- `manifest.webmanifest` — installable metadata; every path relative.
- `js/compound-words.js` — pure readable-compound detection, ranking, and
  bounding from the committed JLPT vocabulary and the known-kanji set; no DOM
  or storage.
- `js/routing.js` — pure hash parsing, tab/route translation, and unknown-route
  fallback; no DOM, history, or fetch.
- `index.html` `[data-panel="profile"]` — Profile & Data panel: summary,
  dashboard, reset, usage journal, friction radar, report, offline availability,
  backup actions, and import preview. Reached only from the header control.
- `assets/icons/` — 192/512 any-purpose and 512 full-bleed maskable icons.
- `tools/build-kanjivg.mjs` — pinned KanjiVG generator and `--check` command.
- `data/kanjivg.json` — committed 5.84 MB runtime artifact.
- `data/kanji-families.json` — committed compact radical/direct-component
  reverse index; lazy-loaded only for structural family views.
- `data/kanjivg.manifest.json` — pinned input and artifact checksums used by CI.
- `js/app.js` — retryable lazy loader plus delegated doorway integration.
- `js/kanji-atlas.js` — pure bounded component-family graph/layout, reading-route,
  unknown-study, and challenge helpers plus the ephemeral Atlas interactions.
- `japanese-reader.css` — app-specific styles, including Tree and Relationship
  Map overlays and their responsive layouts.
- `README.md` — concise public overview, local setup, architecture, and license
  boundaries.
- `IDEA_GARDEN.md` — public creative backlog, selected exploration track, first
  experiments, and principles that prevent uncontrolled feature growth.
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
- `kanjitree.js` keeps no dictionary of its own. Vocabulary for the "Appears in"
  list arrives through the injected `wordsFor(char)` option, the same way
  `kanjiInfo` and `isKnown` do, so the overlay stays a renderer.
- Every terse or icon-only control carries a `title` that names the destination
  or the consequence, not the mechanism: "Save 学生 to your Review deck", not
  "Save". `aria-label` stays the short accessible name; `title` is the sighted
  hover explanation, and toggles must swap both with their state.
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

## Desktop layout conventions

- Keep `--layout-reading`, `--layout-data`, and `--layout-visual` as the shared
  width contract. Do not scatter new panel-specific desktop widths through the
  stylesheet.
- A panel goes wide only when its content genuinely needs the room: a dense
  browsing grid or a spatial canvas. Kanji uses the data width; Relations
  overrides that shared limit with the visual width. Everything else — Analyze,
  Read, Review, My Words, and Settings — stays at the reading measure, because
  reading columns, card lists, and tables are all more legible narrow.
- Only panels explicitly marked `data-layout="wide"` may escape the reading
  measure, and there are exactly two. Do not add a third without a content
  reason that survives the test above; "it has a table" is not one, since
  Analyze holds the same table markup at the reading measure.
- Wide workspaces begin above the 1080 px reading measure and must not create
  page overflow. Tablet and phone behavior remains governed by the existing
  responsive rules rather than separate narrow-screen width overrides.

## Offline and installation conventions

- `sw.js` and `manifest.webmanifest` must stay at the repository root. A service
  worker's scope is its own directory, and Pages serves the project from
  `/kotoba-lab/`.
- All precache paths stay relative. An absolute `/data/...` path resolves outside
  the project subpath in production.
- Keep policy in `js/offline-cache.js` and I/O in `sw.js`. The worker must hold
  no path list of its own.
- **Any release that changes a cached file must bump `APP_VERSION`.** The cache
  is named `kotoba-lab:v${APP_VERSION}` and stale caches are deleted on activate,
  so a forgotten bump ships a permanently stale install. `APP_VERSION` appears in
  `js/app.js`, `sw.js`, and `package.json`; `js/sw-routing.test.js` fails if the
  three drift apart.
- Registration failure is silent. An unsupported browser, insecure context, or
  disabled worker must leave the application exactly as it behaves today and must
  never touch `#boot-warning` or the dictionary-failure banner.
- Never auto-reload on update. Offer the reload and let the learner choose, so an
  open Alchemy, Atlas, or study session is never destroyed.
- Cache Storage holds application files only. It is not study data, adds no
  localStorage key, and must never be written into a profile backup or study
  pack.
- Offline availability is derived by querying the cache at render time. Do not
  persist a "downloaded" flag.
- A service worker cannot be exercised by `node --test`, and Electron-based
  review browsers cannot register one at all. `js/sw-routing.test.js` loads the
  real worker with stubbed globals to cover routing, lifecycle, and messaging;
  genuine Cache API behavior still requires manual QA in a real browser.

## Routing conventions

- Hash routes only. Never push a pathname: `/kotoba-lab/kanji` 404s on GitHub
  Pages and would route every tab switch through the worker's navigate handler.
- Keep the tab/route vocabulary split inside `js/routing.js`. `app.js` handles
  only internal tab names; the module is the single place they translate. The
  `profile` tab is reached at `#settings`, and `#profile` is deliberately not a
  valid route so one view never has two URLs.
- An unknown hash resolves to Analyze. A URL is user-editable input, so parsing
  must never throw or leave a blank screen.
- Overlays are **not** routed. Radical Tree, the Relationship Map, and the Read
  info sheet keep their Close buttons, scrim, and Escape. Routing them needs
  sentinel history entries whose consumption rules are easy to get subtly wrong,
  and the info sheet in particular would fire a stray `history.back()` on every
  tab change because `setInfoSheet(false)` runs in the tab-switch path.
- Programmatic `switchTab()` calls create history entries on purpose — arriving
  via an in-app link is navigation. Any new caller must therefore be a response
  to a user action, never a timer or a loop.

## Mobile interface conventions

- At 780px and below, keep the six primary tabs in the fixed bottom bar and
  leave the sticky header for compact branding plus the Settings control. Respect
  safe-area insets and reserve enough main-content padding that the bar never
  covers actions.
- Profile & Data is a headed panel, not a tab. It is reached from the header
  control and must never gain a bottom-bar slot; the bar stays at six columns.
  Its button carries `data-tab` but never the `.tab` class, and `switchTab()`
  selects `[data-tab]` so the header control receives `is-active` and
  `aria-current` through the same path as the real tabs. The control needs an
  explicit `aria-label` because its glyph is `aria-hidden` and its text label is
  `display: none` on phones.
- Anything that changes cards or known state must refresh both `renderMyWords()`
  and `renderProfilePanel()`. They read the same stores but render separately,
  and a missed call shows a stale count rather than failing visibly.
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
- Each result card carries two actions in its corner: a `[data-kanji-known]`
  toggle for marking without opening the card, and the Relationship Map doorway.
  The toggle reuses `kotoba-lab:known-kanji` and the shared refresh path, and
  carries `aria-pressed` plus a Mark/Unmark label because its text does not
  change between states.
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

## Radical Alchemy conventions

- Keep Alchemy inside the Kanji library rather than adding another primary
  tab. Closing returns focus to its doorway; revealed answers reuse the one
  delegated `[data-kanji-tree]` route.
- A formula must have exactly two distinct, single-glyph direct labelled
  KanjiVG components, and its sorted pair must resolve to one dictionary kanji.
  Never ask an ambiguous formula or imply the components are an etymology.
- Today’s Brew is deterministic by local date and normally selects one target
  from each JLPT level N5 through N1. Distractors are dictionary kanji, and the
  correct target must always remain among the four choices.
- Challenge position, choices, answers, and score are session-only. Add no
  storage key, profile field, or content-bearing usage event for the lab.
- Use only `data/kanji-families.json` to prepare questions. Loading the lab must
  not fetch `data/kanjivg.json`; that artifact remains lazy behind Radical Tree.
- Visual feedback must include text and symbols in addition to color. Preserve
  44px phone controls, number-key answers, bounded arrow navigation, Escape,
  focus restoration, and a still `prefers-reduced-motion` path.
- Keep `laboratory-backdrop.webp` atmospheric and text-free. It must never carry
  kanji, component evidence, labels, controls, or readable pseudo-writing; keep
  the optimized deployed file below 150 KB unless a documented visual need
  justifies more.
- Keep functional Alchemy symbols in `alchemy-icons.svg` with `currentColor`
  strokes. Do not replace ingredient glyphs, results, or controls with raster
  artwork. Any added motion must be included in the reduced-motion shutdown.
- Missing Ingredient may hide only one of the verified pair; Reverse Brewing
  must offer complete verified pairs. A transformation chain is valid only when
  each result glyph is one of the next recipe's two direct components.
- Known filtering limits question targets, not the evidence-safe distractor
  pool. Do not silently remove a current question after its known state changes.
- Recipe history lives only on the open Alchemy session. Its temporary study
  handoff deduplicates brewed target kanji and reuses `createKanjiStudySession`;
  leaving the lab or study must not write history or scores anywhere.

## Vocabulary conventions

- Keep vocabulary search pure in `js/word-browser.js`, mirroring the split
  between `kanji-browser.js` and its DOM renderer in `app.js`.
- Reading search normalizes katakana to hiragana and strips separators, the same
  `readingForm()` rule the kanji library uses, so a query typed either way
  matches. English matching applies only to plain-ASCII queries.
- Sort easiest first by JLPT, then shorter words, then **code point** order.
  Never `localeCompare`: collation depends on ICU being present, and the list
  must sort identically in every browser and in Node.
- Results are bounded but the total is always reported honestly, so the page
  never implies it is the whole set.
- "Readable" means every kanji in the word is already marked known. It reuses
  `isReadableCompound()` rather than a second definition.
- Every vocabulary list uses the shared `wordRowMarkup()` so the compound card
  and the lookup stay identical and gain features together.

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
- Relations filters apply before the neighborhood limit so displayed counts
  remain honest. Evidence filters may disable all primary reasons; stroke
  proximity remains supporting-only and cannot survive by itself.
- Keep the embedded canvas legible: mixed structural/reading maps show at most
  four nodes per arc. Additional ranked one-hop results belong in the desktop
  gallery or mobile swipe lanes, not on overlapping canvas coordinates.
- Relations search, filters, selected root, and history are session-only. Reuse
  the existing durable study stores (plus the optional payload-free journal)
  and keep structural data lazy until the tab or another relationship doorway
  is opened.
- Two-hop graphs are capped at 36 visible nodes and depth two. Balance direct
  structural and reading branches when both exist; expanding one branch adds
  context without changing the root. Do not draw redundant cross-branch edges.
- Keep the one-hop Neighborhood view as the default. Desktop networks may use
  zoom controls; phones replace the graph with Structure and Readings swipe
  lanes rather than shrinking the full canvas.

## Kanji Constellation Atlas conventions

- A constellation center is one direct visual component from the selected root
  kanji. Lines mean only “contains this direct component”; never present them as
  etymology, historical descent, or semantic similarity.
- Keep each sky deterministic and capped at 24 visible kanji. Keep the selected
  root visible before applying the cap, then use stable JLPT, stroke, and code
  point order so the same family does not jump between visits.
- Known-star lighting must read only `kotoba-lab:known-kanji`. Unknown stars are
  visually quieter, never hidden or described as unlearned facts.
- Component choice, scroll position, and constellation layout are ephemeral.
  Add no localStorage key, usage payload, or profile field for the experiment.
- Keep Constellation inside the Relations workspace and leave Neighborhood as
  the default. A star doorway returns to the ordinary one-hop Relations view.
- Phones keep the full bounded sky in a touch-pannable viewport rather than
  shrinking nodes until labels or targets become illegible.
- On desktop, Relations may widen independently of the shared reading measure.
  Use the larger Atlas geometry only from 1440 px upward, keep common laptop
  widths free of horizontal scrolling, and preserve the existing phone canvas.
- Atlas focus mode is ephemeral UI state: keep its explicit button keyboard
  reachable, let Escape restore focus to that button, exit when leaving Atlas or
  Relations, and never add it to localStorage, profile export, or usage payloads.
- Selecting a star changes only ephemeral focus. Show its dictionary meaning,
  JLPT level, stroke count, on’yomi, and kun’yomi before offering deliberate
  actions; a star tap must not immediately leave the Atlas.
- Re-rooting stays in the Atlas and preserves the current direct component when
  that component belongs to the new root. Synchronize the Relations seed and
  search field so subsequent Neighborhood and Network views use the same root.
- Known-state control reuses the existing global refresh path. Radical Tree
  close must restore focus to the Atlas doorway that opened it.
- Reading routes use only normalized on’yomi and kun’yomi shared by visible
  stars. Cap the sky at 12 routes and each reading at three edges, prefer the
  smallest visible reading families, and label every route with its exact
  dictionary evidence. Never imply semantic similarity or etymology.
- Solid spokes always mean the direct component; dashed indigo and vermilion
  routes mean shared on’yomi and kun’yomi. Keep the route toggle and 80–120%
  zoom session-only, preserve 44 px phone controls, and keep the whole sky
  touch-pannable at every zoom level.
- Motion may breathe the center, twinkle known stars, or travel along route
  dashes, but it must not move star positions. Disable all Atlas animation and
  transition effects under `prefers-reduced-motion: reduce`.
- Study only the unknown stars in the current bounded sky and snapshot them
  through the existing ephemeral family-session engine. Keep Return to Atlas
  explicit; revealing, order, challenge choice, and challenge progress add no
  persistence. Known-state changes still use the one approved kanji key.
- Atlas packs contain every visible star and reuse the versioned study-pack
  sanitizer, so extra layout, root, known, challenge, and route fields cannot
  escape. Quick challenges are derived only from the selected direct component
  and exact normalized dictionary readings; show explanations and no score.
- The optional journal may count only fixed `atlas.open` and `study.atlas`
  events. Never put a kanji, component, reading, challenge choice, pack title,
  or other payload in an event name or stored journal field.

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

There are exactly five localStorage keys. Radical Tree, profiles, and study
packs add none; the fifth belongs only to the optional local usage journal:

- `kotoba-lab:deck`
- `kotoba-lab:known-words`
- `kotoba-lab:known-kanji`
- `kotoba-lab:review-log`
- `kotoba-lab:usage-journal`

The journal is off by default. It may store only allowlisted event counts,
daily sessions, and visible active minutes for the last 90 days. Never add an
event payload, dynamic event name, pasted text, word, kanji, search, filename,
answer, grade, or individual-action timestamp. Keep it outside profile backups
and study packs so sharing a profile never shares behavioral data.

Usage insights must remain cautious aggregate interpretations. Ignore unknown
events, require a minimum activity sample, cap visible prompts, and always
offer a neutral no-friction state. The current due-card count may be supplied
at render time but must not be copied into the journal. Navigation suggestions
may target only the existing fixed app tabs.

Usage reports are a separate sharing surface, not profile backups. They may
contain only overall activity counts, the six approved feature totals, current
aggregate profile metrics, and whitelisted signal copy. Never export raw event
names, daily keys, journal JSON, last-review dates, or caller-provided labels.
Preview the exact Markdown before sharing. Record `report.export` only after
the copied/downloaded snapshot is built so it never counts itself.

## Profile and study-pack conventions

- Full profiles use the existing `kotoba-lab-backup` format marker. Version 2
  adds app version and derived counts; version 1 remains readable.
- Choosing a profile file must only inspect it. Write the four profile stores only after
  the user chooses safe merge or confirms full replacement.
- Safe merge remains the recommended default: add missing cards/items, keep the
  more recently reviewed schedule, and take the maximum review count per day.
- Study packs use the separate `kotoba-lab-study-pack` marker and contain only
  kanji, meaning, readings, JLPT, and stroke metadata. Never include pasted
  text, sentence context, known state, scheduling, or review history.
- Imported packs are temporary family-study sessions. Do not add another
  storage key for packs, import history, source choice, or progress.
- Dashboard category clearing changes only that collection. Full reset must
  show its scope and require the exact typed phrase before writing empty values
  to all four profile stores and clearing/disabling the usage journal; do not
  rely on a single browser confirmation dialog.
- Keep `APP_VERSION` in `js/app.js` synchronized with `package.json` when the
  profile format or public data-management UI ships. Since the offline cache is
  named from it, `sw.js` must carry the same value and every release that changes
  a cached file must bump all three.

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
alchemy recipe uniqueness/determinism, missing/reverse answers,
transformation-chain continuity, known filtering, and session history,
profile v1/v2 inspection/merge/replace preview and study-pack
privacy/export/import/session handoff,
explode/drill/back, `Esc` focus restoration,
known-state propagation, atomic/missing entries, reduced motion, and clean
offline-first-load failure. The only module script in `index.html` remains
`js/app.js`; its imports define load order.

Offline QA needs a real browser, because a service worker cannot be driven by
`node --test` and Electron-based review browsers refuse to register one at all.
Cover installing to an Android home screen (sharp launcher icon, standalone
window, maskable icon surviving a circular crop), launching in airplane mode,
Radical Tree opening offline on an install that never opened it while online,
the kuromoji download before and after, an update prompt appearing on an
`APP_VERSION` bump without auto-reloading, an interrupted precache leaving the
previous version working, and silent degradation in a browser without module
service worker support.
