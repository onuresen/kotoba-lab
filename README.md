# Kotoba Lab

[![Test and deploy Pages](https://github.com/onuresen/kotoba-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/onuresen/kotoba-lab/actions/workflows/pages.yml)

**[Open Kotoba Lab](https://onuresen.github.io/kotoba-lab/)**

Kotoba Lab is a browser-based Japanese reading and kanji study tool. Paste a
text to analyze and read it, browse the kanji library directly, save unfamiliar
words, and review them with built-in spaced repetition.

Everything is processed in your browser. Kotoba Lab has no account system or
application server, and your study data stays in browser storage unless you
export a backup. See [PRIVACY.md](PRIVACY.md) for the details.

## Features

- **Analyze:** kanji and word frequency, JLPT distribution, readability,
  character mix, personal coverage, and Anki-compatible TSV export.
- **Read:** furigana, JLPT-colored kanji, dictionary details, saved words, and
  known-word or known-kanji tracking.
- **Phone-friendly study:** compact branding, a safe-area-aware bottom tab bar,
  swipeable samples and JLPT filters, tap-to-open word details, compact Kanji
  and saved-deck cards, focused Review and family-study workspaces, and a
  compact full-screen Radical Tree plus swipeable relationship lanes.
- **Kanji:** search 6,813 dictionary entries by glyph, reading, or meaning;
  combine JLPT, stroke-count, and known-state filters; then browse ordinary
  cards, JLPT/stroke sections, exact stroke-count families, or kanji that share
  an on’yomi, kun’yomi, canonical radical, or direct visual component. On large
  screens the library expands into a denser five-card workspace.
- **Radical Alchemy:** enter the laboratory from the Kanji library and practice
  result brewing, missing ingredients, reverse recipes, or short transformation
  chains. Every formula comes from an unambiguous pair of direct KanjiVG
  components and can be filtered to unknown kanji. The session-only recipe trail
  can become a temporary reveal-card study pass; known-state and Radical Tree
  controls remain available on each answer. A
  text-free illustrated workbench, crisp SVG laboratory symbols, ingredient
  bubbles, ink blooms, seal reveals, and a still reduced-motion path give the
  lab its own visual identity without putting study information inside images.
- **Family study:** turn any selected kanji family into a focused reveal
  session with progress, previous/next and keyboard navigation, shuffle and
  restart, known-state controls, and direct Radical Tree access.
- **Phonetic Component Lab:** measure dominant on’yomi signals inside direct
  component families, show the supporting evidence and exceptions, and
  practice match-versus-exception predictions without claiming etymology.
- **Kanji Contrast Lab:** study compact sets that share a direct component,
  answer meaning and uniquely identifying on’yomi questions, compare the
  revealed readings, and open any answer in the Radical Tree.
- **Text-to-Study Journey:** turn the current text into a temporary route of
  high-impact unknown kanji, their words and original sentences, projected
  coverage gains, recall steps, and a direct handoff back to rereading.
- **Family Mix Challenge:** choose two to five stroke, reading, radical, or
  component families and identify them in a balanced interleaved session that
  automatically removes ambiguous multi-family answers.
- **Radical Tree:** replay strokes, separate a kanji into colored components,
  and drill into its decomposition using committed KanjiVG data.
- **Kanji Relationship Map:** explore explainable links through shared radicals,
  visual components, and dictionary readings; recenter on neighboring kanji,
  inspect the evidence, and move directly between the map and Radical Tree.
- **Relations workspace:** start from dictionary search, the current text,
  known kanji, or discovery suggestions; then filter connections by evidence,
  JLPT level, learning context, and neighborhood size without leaving the tab.
  Relations expands beyond the reading-column width on larger desktops so its
  visual maps use the available screen without changing the focused text tools.
  Switch from the focused neighborhood to a bounded two-hop network, expand
  individual branches without losing the root, zoom the desktop graph, or use
  clustered swipe lanes on a phone. The experimental Constellation view turns
  one selected direct component into a bounded 24-star family sky: known kanji
  glow, unfamiliar stars stay quiet, and every star opens its normal Relations
  neighborhood. Select a star to inspect its readings and study state first,
  then deliberately mark it known, make it the Atlas root, open its ordinary
  neighborhood, or enter Radical Tree. Phones keep the compact detail card
  visible while the full sky remains touch-pannable. Solid spokes show the
  selected component while bounded dashed routes expose shared on’yomi and
  kun’yomi; routes can be hidden and the sky zooms from 80–120%. Subtle motion
  brings the map to life and switches off for reduced-motion preferences.
  Desktop Atlas focus mode temporarily hides the surrounding discovery and
  filter chrome, keeps the picker, routes, zoom, study tools, and detail panel,
  and exits with Escape without losing the selected component or star.
  Study the currently unknown stars in a temporary session, return directly to
  the same sky, export its visible kanji as a private-data-free study pack, or
  try short shared-component and reading-exception challenges with no score.
- **Review:** study saved words with an SM-2-inspired schedule, interval
  previews, keyboard grading, a due counter, and streak tracking.
- **Adaptive workspace width:** data-heavy Kanji, Relations, and My Words views
  use the available desktop space, while Analyze, Read, and Review retain a
  focused reading measure. Tablet and phone layouts keep their existing flow.
- **Profile & Data:** export the complete local study profile as versioned JSON,
  inspect an import before it writes anything, then merge safely or explicitly
  replace local cards, schedules, known items, and review history. A local-data
  dashboard separates new/due/scheduled cards, known collections, review
  activity, category cleanup, and a typed-confirmation full reset.
- **Optional local usage journal:** learn which parts of Kotoba Lab you really
  use through daily session, visible-minute, and coarse-action totals. It is off
  by default, records no study content, and never sends data anywhere. A local
  friction radar turns those totals into a feature mix and cautious suggestions
  for stalled reading, exploration, or review handoffs. A separate Markdown
  report can be previewed, copied, or downloaded when you want to discuss those
  patterns without sharing the raw journal or study content.
- **Portable Study Packs:** export kanji from the current text, a selected
  family, a Relations network, or the visible Atlas without personal progress; imported packs open
  directly as temporary Kanji study sessions.
- **Text import:** open plain-text and Aozora Bunko files, including Shift-JIS
  decoding and common markup cleanup.
- **Two tokenizers:** use the fast embedded-dictionary tokenizer or opt into the
  more precise vendored kuromoji tokenizer.

The application and its language data are committed to this repository. It
does not call an AI service or send pasted text to a backend. The page requests
web fonts from Google Fonts when online; system-font fallbacks keep the
application usable when those fonts are unavailable.

## Future idea garden

The project keeps its imaginative long-term directions in
[IDEA_GARDEN.md](IDEA_GARDEN.md). Radical Alchemy and Kanji Constellation Atlas
have begun as bounded experiments; Kanji Genealogy and Japanese Detective
Board remain ideas rather than release promises.

## Run locally

Kotoba Lab uses ES modules and fetches its dictionaries from `data/`, so it must
be served over HTTP rather than opened directly with `file://`.

On Windows, double-click `serve.cmd`, or run one of these commands:

```bash
npm start
node serve.mjs
```

The included server has no package dependencies. It starts on port 5506, moves
to the next available port if necessary, and handles the vendored kuromoji
dictionary files with the headers the tokenizer expects.

## Development

The application has no runtime build step and no installed dependencies.

```bash
npm test
```

The Node test suites cover tokenization, analysis, text context, flashcard
export, storage, backup merging, spaced repetition, Aozora cleanup, KanjiVG
decoding, and kanji-library filtering, grouping, and family-study sessions.

To rebuild or validate the committed KanjiVG artifacts:

```bash
npm run kanjivg:build
npm run kanjivg:check
```

These commands use a pinned KanjiVG release. Regular `npm test` verifies the
committed stroke-tree and family-index checksums without requiring a network
connection.

Pushes to `main` are tested and then published to GitHub Pages by
`.github/workflows/pages.yml`. Pull requests run the same tests without
receiving deployment permissions.

## Project structure

```text
index.html               application shell
japanese-reader.css      application-specific presentation
ui-base.css              shared UI primitives used by this repository
palettes/                 Kotoba Lab color palette
js/                      application modules and tests
js/kanji-network.js      bounded two-hop graph builder, layout, and UI
js/kanji-atlas.js        bounded component constellation graph, layout, and UI
js/kanji-alchemy.js      deterministic component recipes and session state
assets/alchemy/           optimized backdrop and code-native SVG icon sprite
js/backup.js             versioned full-profile export, inspection, and merge
js/profile-dashboard.js  local data metrics and category-reset helpers
js/usage-journal.js      opt-in, payload-free local activity counters
js/usage-insights.js     pure feature mix and cautious friction prompts
js/usage-report.js       privacy-safe aggregate Markdown snapshot
js/study-pack.js         private-data-free portable kanji pack format
data/                    dictionaries, samples, KanjiVG data, attribution
tools/                   reproducible data-generation tools
vendor/kuromoji/         vendored tokenizer and dictionary
serve.mjs / serve.cmd    dependency-free local server
```

User state is stored under five `localStorage` keys. The usage journal is
optional, off by default, and deliberately excluded from profile backups:

- `kotoba-lab:deck`
- `kotoba-lab:known-words`
- `kotoba-lab:known-kanji`
- `kotoba-lab:review-log`
- `kotoba-lab:usage-journal`

## Data and licensing

Original Kotoba Lab source code is licensed under the [MIT License](LICENSE).

The language data has separate licenses:

- `data/kanjidic.json` and `data/jlpt-vocab.json` are derived from
  Kanjium/EDRDG material and remain under CC BY-SA 4.0.
- `data/kanjivg.json` and `data/kanji-families.json` are derived from KanjiVG
  and remain under CC BY-SA 3.0.
- `vendor/kuromoji/` contains Apache-2.0-licensed third-party software and its
  dictionary.

See [data/ATTRIBUTION.md](data/ATTRIBUTION.md) and
[vendor/kuromoji/VENDORED.txt](vendor/kuromoji/VENDORED.txt) for complete
attribution and redistribution information.

## Contributing

Bug reports and focused pull requests are welcome. Please run `npm test` before
submitting a change and preserve the browser-only, static architecture unless a
proposal explicitly calls for a different trust model.
