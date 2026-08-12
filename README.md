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
- **Kanji:** search 6,813 dictionary entries by glyph, reading, or meaning;
  combine JLPT, stroke-count, and known-state filters; then browse ordinary
  cards, JLPT/stroke sections, exact stroke-count families, or kanji that share
  an on’yomi, kun’yomi, canonical radical, or direct visual component.
- **Family study:** turn any selected kanji family into a focused reveal
  session with progress, previous/next and keyboard navigation, shuffle and
  restart, known-state controls, and direct Radical Tree access.
- **Phonetic Component Lab:** measure dominant on’yomi signals inside direct
  component families, show the supporting evidence and exceptions, and
  practice match-versus-exception predictions without claiming etymology.
- **Kanji Contrast Lab:** study compact sets that share a direct component,
  answer meaning and uniquely identifying on’yomi questions, compare the
  revealed readings, and open any answer in the Radical Tree.
- **Radical Tree:** replay strokes, separate a kanji into colored components,
  and drill into its decomposition using committed KanjiVG data.
- **Review:** study saved words with an SM-2-inspired schedule, interval
  previews, keyboard grading, a due counter, and streak tracking.
- **My Words:** manage the local study deck and move it between browsers with a
  JSON backup and restore flow.
- **Text import:** open plain-text and Aozora Bunko files, including Shift-JIS
  decoding and common markup cleanup.
- **Two tokenizers:** use the fast embedded-dictionary tokenizer or opt into the
  more precise vendored kuromoji tokenizer.

The application and its language data are committed to this repository. It
does not call an AI service or send pasted text to a backend. The page requests
web fonts from Google Fonts when online; system-font fallbacks keep the
application usable when those fonts are unavailable.

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
data/                    dictionaries, samples, KanjiVG data, attribution
tools/                   reproducible data-generation tools
vendor/kuromoji/         vendored tokenizer and dictionary
serve.mjs / serve.cmd    dependency-free local server
```

User state is stored under four `localStorage` keys:

- `kotoba-lab:deck`
- `kotoba-lab:known-words`
- `kotoba-lab:known-kanji`
- `kotoba-lab:review-log`

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
