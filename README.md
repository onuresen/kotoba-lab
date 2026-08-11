# Kotoba Lab — Japanese reading & text analysis

A browser tool for studying Japanese text and exploring kanji. Paste anything
Japanese for the **Analyze** and **Read** views, or open the **Kanji** library
directly — then save what you didn't know and drill it on a schedule, without
leaving the page.

- **Analyze** — kanji & word frequency tables, JLPT-level breakdown, a readability
  estimate, character mix, a personal **coverage meter** ("you already know N% of
  the words/kanji in this text"), and one-click **Anki (TSV) flashcard export**
  (word · reading · meaning · level · sentence).
- **Read** — the same text with **furigana**, **JLPT-colored kanji**, and
  tap-any-word / tap-any-kanji to see its reading, **meaning**, and level — plus
  **★ Save** (add to your study deck, **with the sentence you met it in**) and
  **Mark known** (dims it in the text and feeds the coverage meter) on every
  word/kanji.
- **Kanji Radical Tree** — open a kanji from Read, a revealed Review card, or
  My Words; watch its strokes draw, separate it into individually colored
  components in their real glyph positions, and drill down into each part. It
  remains fully offline and reuses the same known-kanji state as coverage.
- **Kanji** — browse all 6,813 dictionary kanji without supplying text. Search
  by glyph, meaning, on'yomi, or kun'yomi; combine JLPT, stroke-count, and
  known-state filters; sort or group the results; and open any card in the same
  Radical Tree used everywhere else.
- **Review** — a built-in **spaced repetition** session over your saved deck:
  show the answer, grade it *Again / Hard / Good / Easy*, and each card comes
  back when it's due. Every button shows the interval it buys you before you
  press it. Keyboard-driven (<kbd>Space</kbd>, <kbd>1</kbd>–<kbd>4</kbd>), with
  a due counter on the tab, an "answered today" tally, and a day streak.
- **My Words** — your saved deck (export anytime, with each card's next due
  date) and known words/kanji, all **persisted locally** (no account, no sync —
  just this browser) — plus **backup & restore** to a single `.json` file, the
  way to move a deck between browsers or get it back after clearing site data.
- **Import** — load a `.txt` file (incl. **Aozora Bunko**: Shift-JIS decoding +
  ruby/annotation cleanup) or paste anything.
- **Two tokenizers** — an instant dictionary segmenter by default, or opt into
  **kuromoji** (vendored, loads once) for precise morphological analysis.

**Static · offline · no AI.** No build step, no keys, no network at runtime — it
runs on a plane.

This consolidates two dead desktop projects — `Japanese-Text-Analysis-Tool` and
`WordFrequency` (both C# / WinForms / native MeCab, Windows-only) — into one
browser tool that keeps the useful analytics and drops the setup chore.

## Run it

**Double-click `serve.cmd`** (Windows). It serves this folder and opens the
browser on it. From a terminal, any of these do the same:

```bash
serve.cmd            # Windows — also takes a port: serve.cmd 8080
npm start            # anywhere Node is installed
node serve.mjs       # the same thing, no npm
```

`serve.mjs` is a ~90-line static server using only `node:http` and `node:fs` —
**no dependencies**, so first run needs no network, same as the app itself. It
picks the next free port if 5506 is taken, and opens the browser once it is
actually listening. `serve.cmd` falls back to `python -m http.server` if Node
isn't installed.

Why any of this is needed: the page uses ES modules and fetches its dictionaries
from `data/`, and **a browser blocks both over `file://`**. Opened straight off
disk it *looks* fine but is inert — no code runs at all, so pasting does nothing
and the tabs don't switch. The page says so itself in that state, via a banner
that lives in the static markup precisely because JS can't warn you when JS is
what's blocked. The fix is always the same: serve it.

Any static server works, with one caveat — `vendor/kuromoji/dict/*.dat.gz` must
be sent **without** a `Content-Encoding: gzip` header. kuromoji gunzips those
itself, so a server that marks them as gzip-encoded makes the browser decompress
them first and the precise tokenizer then fails on already-plain data.
`serve.mjs` handles this; `npx serve` and `python -m http.server` also do.

This folder is **self-contained** — it carries its own `ui-base.css` and
`palettes/washi-sumi.css` (copies of the shared ui-system styles, per
`ui-system/README.md`'s "copy, never link" rule), so it can be moved, zipped, or
published on its own and still look right. Serving the repo root and opening
`/Kotoba-Lab/index.html` works too; nothing here reaches outside the folder.

Double-click **`serve.cmd`**, not `index.html` — the latter is the inert
`file://` page described above.

## How it fits the repo

- **UI:** Tier-A on `ui-system` — local copies of `ui-base.css` and the
  **`washi-sumi`** palette (added to the shelf for this tool: warm washi paper,
  sumi ink, restrained vermilion accent). Registered in `ui-system/targets.json`;
  re-sync with `ui-system/sync.ps1 -Sync` after a canonical change, and don't
  hand-edit the copies.
- The JLPT **N5→N1 color scale** and **furigana/ruby** typography are the only
  domain-specific styles; they live in `japanese-reader.css`, built from the
  ui-system tokens (so they theme-flip), not baked into `ui-base.css`.

## Architecture

```
index.html               five-tab shell (Analyze / Read / Kanji / Review / My Words) + import + tokenizer toggle
serve.cmd                double-click to run the app (Windows) — see "Run it"
serve.mjs                dependency-free static server behind it (node:http only)
package.json             scripts only — the app has no deps and no build step
ui-base.css              copy of the ui-system skeleton (do not hand-edit — re-sync instead)
palettes/washi-sumi.css  copy of the washi-sumi skin
japanese-reader.css      tool layer: JLPT color scale + furigana typography
js/
  script.js              kanji/kana/other character classification (shared)
  tokenizer.js           text → tokens — dictionary longest-match (default)
  tokenizer-kuromoji.js  text → tokens — kuromoji adapter (same contract)
  jlpt.js                level + kanji dictionary lookup (on/kun/strokes/meaning)
  analyze.js             frequency, JLPT distribution, readability, coverage (pure, no DOM)
  read.js                furigana + colored rendering + click-to-inspect + known-state styling
  srs.js                 spaced repetition: grading, intervals, session queue (pure, no DOM)
  storage.js             localStorage: known words/kanji sets + saved deck + review log
  context.js             the sentence a saved word came from (pure, no DOM)
  backup.js              whole-state JSON export/import + merge rules (pure, no DOM)
  flashcards.js          study-word selection + Anki TSV (with meaning)
  aozora.js              .txt import: Shift-JIS decode + Aozora markup cleanup
  kanjivg.js             pure decoder for the compact stroke/component tree data
  kanjitree.js            full-screen SVG overlay, animation, drill-down + focus handling
  kanji-browser.js        pure dictionary search, filtering, sorting, and grouping
  app.js                 load data once, tokenize once, render all five tabs
  *.test.js              node:test suites for the pure modules (see Tests below)
data/
  kanjidic.json          kanji → jlpt/strokes/on/kun/meaning (6,813 kanji)
  jlpt-vocab.json        word → reading + level + gloss (~10.8k words)
  samples.json           a few texts to try instantly (incl. an Aozora excerpt)
  kanjivg.json           generated KanjiVG strokes + component trees (CC BY-SA 3.0)
  kanjivg.manifest.json  pinned source/artifact checksums for offline CI verification
  ATTRIBUTION.md         required credit for the Kanjium/EDRDG data (CC BY-SA 4.0)
tools/
  build-kanjivg.mjs      pinned, dependency-free KanjiVG data generator + drift check
vendor/kuromoji/         vendored kuromoji.js browser build + dict/ (Apache-2.0)
```

### Two tokenizers, one contract

Both tabs are two projections of one tokenizer pass. Everything downstream
consumes only the `Token` shape (`{surface, reading, level, gloss, kind}`), so
the tokenizer is swappable:

- **`tokenizer.js`** (default) — a dictionary longest-match segmenter over the
  embedded vocab. Instant, no binary, no network. Good for frequency, JLPT
  leveling, and furigana on known words, but it has no real morphology (it can
  mis-split `専門家` and read the trailing `家` as "house").
- **`tokenizer-kuromoji.js`** (opt-in) — real morphological analysis via
  **kuromoji.js**, vendored under `vendor/kuromoji/` so it stays offline. Loads a
  ~18 MB dictionary once (lazy, on toggle), then fixes the compound problem,
  drops particles from word frequency, and lemmatizes verbs for cleaner cards.

## Tests

```bash
npm test          # or: node --test "js/*.test.js"
```

**126 tests, no dependencies, no runtime build step** — `node:test` over the ES modules
directly, so the thing under test is exactly the thing the browser loads.
Node 22+ (it expands the `js/*.test.js` glob itself, which is what keeps one
command working in both `cmd.exe` and `sh`). CI runs it on every push touching
this folder — `.github/workflows/kotoba-lab-test.yml`, scoped the same way as
the repo's CDI gate.

Only the **pure** modules are covered. `app.js`, `read.js` and the `download()`
helper touch the DOM, and `tokenizer-kuromoji.js` needs the vendored 18 MB
dictionary — those are verified in the browser instead.

| Suite | What it pins |
|---|---|
| `srs.test.js` | The whole schedule: learning steps, graduation, ease floor (1.3), one-year cap, lapses, learn-ahead, and the queue banding + rotation that stop a failed card being handed straight back. Plus: intervals grow monotonically under repeated *Good*. |
| `analyze.test.js` | That tallies count **occurrences, not uniques**, that ungraded kanji are never given a guessed level, that level buckets + ungraded account for every occurrence, and that coverage weights by frequency. |
| `backup.test.js` | The merge rules — newer study wins, days merge by max, re-import is a no-op, bad files are refused before anything is written. |
| `storage.test.js` | The study streak's date rule (an unstudied *today* doesn't break it until the day is over), and the README's "never throws" promise, by handing it a `localStorage` that fails on every call. |
| `tokenizer.test.js` | The `Token` contract both tabs consume, losslessness (surfaces rejoin into the input), and the **known limitations** of the default segmenter — `専門家` mis-splitting, no lemmatisation — pinned so improving them is a deliberate act with a README update. |
| `context.test.js` | Sentence bounds (including one ending mid-token), and that the offsets survive every trim and window shift — otherwise the card emphasises the wrong slice of its own sentence. |
| `aozora.test.js` | Shift-JIS fallback, and the markup stripping — ruby, `｜` delimiters, `［＃…］` annotations, the header block between the first two rule lines, and the `底本：` colophon — against a realistic file. Leftover ruby would pollute every frequency count on Analyze. |
| `flashcards.test.js` | Study-word selection and TSV shape — **and the data invariant TSV depends on**: it reads `data/` and fails if any shipped gloss ever contains a tab or newline, which would silently corrupt every exported deck (there is no escaping in `toTSV`). |
| `kanjivg.test.js` | Compact decomposition shape, stroke ordering, depth/cycle guards, missing and atomic kanji, radical-form metadata, and the committed artifact checksum. |
| `kanji-browser.test.js` | Text-independent catalog search across meanings and normalized kana, combined JLPT/stroke/known filters, deterministic sorting, and stable grouping. |

### Regenerating KanjiVG data

`data/kanjivg.json` is committed so the app remains offline. Its generator pins
KanjiVG `r20250816` and verifies the downloaded archive before reading it:

```bash
npm run kanjivg:build
npm run kanjivg:check
```

Both commands normally download the pinned build-time input. Pass a previously
downloaded archive with `-- --source path/to/kanjivg-20250816-main.zip` when
working offline. Regular `npm test` verifies the committed artifact against
`data/kanjivg.manifest.json`, so CI needs no network access.

The scheduler passed all 21 of its tests unchanged — nothing in `srs.js` needed
fixing. The suites exist for the next change, not this one.

## Data: a real dictionary, not a seed

`data/kanjidic.json` (**6,813 kanji** — JLPT level, stroke count, on'yomi/kun'yomi,
meaning) and `data/jlpt-vocab.json` (**~10,800 words** — reading, JLPT level,
multi-sense English gloss) are extracted from **Kanjium** (CC BY-SA 4.0), which
is itself built on EDRDG's EDICT/KANJIDIC (the JMdict project) and Jonathan
Waller's JLPT lists. See `data/ATTRIBUTION.md` for the required credit and
exactly what was extracted/changed.

~2,100 kanji and ~5,000 words carry a JLPT level; the rest are genuinely
**ungraded** ("—") in the source data — never assigned a guessed level. Extend
either JSON freely; the app reads whatever is there.

## Cards remember their sentence

A card that reads 専門家 → *"expert"* teaches the gloss, not the word. So
**★ Save** stores the sentence the word was met in, and the review card shows
it on the back with that exact occurrence marked:

> 日本語の**本**を読むのが好きです。

The sentence is only recoverable at save time, while the text that produced the
token is still the one on screen — so it is captured then, not looked up later.
`context.js` walks out from the clicked token to the nearest sentence marks
(`。．！？`, `!?`, newline) and returns the span **plus offsets into it**, which
is what lets the card highlight the right occurrence when the same word appears
twice in one sentence.

Details that matter more than they look:

- Bounds are found in the joined **text**, not at token edges — the tokenizer
  groups runs of the same script, so `。「` is a single token and a sentence can
  end partway through one.
- A runaway sentence is **windowed** to 140 characters around the word with `…`,
  so one unpunctuated paragraph can't bloat every deck entry, the backup file,
  and the review card.
- The sentence appears on the **back only**. On the front it would hand you the
  answer in EN→JP recall mode.
- Cards saved before v7, and words exported straight off the frequency table,
  simply have none — the field is optional everywhere that reads it.

It rides along in the deck entry, so it is carried by **backup & restore** (with
its offsets, dropped if they no longer fit the text) and by **TSV export**, which
gains a fifth column. Every row has five fields whether or not the card has a
sentence: a column count that varied by source would break the field mapping on
Anki import. The sentence is flattened to one line on the way out, because it is
the one exported field that can plausibly contain a newline.

## Scheduling: SM-2 lite

`srs.js` holds the whole schedule and touches no DOM, so it can be reasoned
about (and tested) by calling `schedule(card, grade, now)` with a fixed clock.

A new card walks two **learning steps** — 1 min, 10 min — then graduates to a
1-day interval. After that each *Good* multiplies the interval by the card's
**ease** (starts at 2.5); *Hard* shrinks both ease and growth, *Easy* boosts
both, and *Again* costs 0.2 ease, records a lapse, and drops the card back into
learning. Ease floors at 1.3 and intervals cap at a year. Grade buttons show
the resulting interval **before** you commit to one.

Two details make a session feel right rather than merely correct:

- **Learn-ahead.** A card due in 1 minute still counts as reviewable, so a
  failed card returns in the same sitting instead of ending it.
- **Spacing.** The queue runs *due → new → not-yet-due*, and the card you just
  answered is rotated to the back. Without that, failing a card hands it
  straight back to you, since a 1-minute due time sorts ahead of everything.

## Personal data: localStorage only

Your saved deck, its review scheduling, and known words/kanji live in **this
browser's localStorage** only — `storage.js` reads/writes four keys
(`kotoba-lab:deck`, `kotoba-lab:known-words`, `kotoba-lab:known-kanji`,
`kotoba-lab:review-log`). Each card's schedule rides along inside its deck
entry, so exporting TSV is unaffected and decks saved before v5 simply start as
new cards. There is no account, no
server, no sync between devices; clearing browser data clears it too. If
localStorage is unavailable (private browsing, a sandboxed embed), the app
keeps working for that session, it just won't remember anything afterward — it
never throws.

### Backup & restore: the one file that carries it all

Because that's the *only* copy, **My Words → Backup & restore** writes the whole
of it to one `.json` file: the deck **with each card's `srs` schedule**, both
known-sets, and the review log. The TSV export is not a backup — it carries
`word · reading · meaning · level` and drops the schedule, so it can rebuild a
word list but never the spacing you earned. This is also how you move a deck to
another browser or phone, without a server and without the tool touching the
network.

`backup.js` is pure (no DOM, no storage, no clock but the one you pass), and
every rule in it exists to make restoring safe:

- **Import merges, it never replaces.** Restoring a six-month-old backup cannot
  delete cards you saved yesterday.
- **The more recently *studied* card wins** (by `srs.reviewedAt`, `reps`
  breaking ties). So a stale file can't roll newer progress backwards, and two
  devices converge on whichever actually did the reviewing.
- **Review days merge by max, not sum** — otherwise importing the same file
  twice would inflate your streak.
- **Importing the same backup twice is a no-op**, and reports as one.
- A file that isn't a backup is refused **before anything is written**, with a
  message naming the actual problem (renamed TSV, foreign JSON, newer format
  version). A half-corrupt `srs` block downgrades that one card to "new" rather
  than failing the whole import.

Every one of those rules has a test behind it — see **Tests** below.

## History

Consolidates two dead Windows-only desktop projects — `Japanese-Text-Analysis-Tool`
and `WordFrequency` (C# / WinForms / native MeCab) — into one browser tool.

- **v1:** dictionary tokenizer + JLPT + frequency + readability + furigana +
  colored reading + TSV export.
- **v2:** click-a-word/kanji **meanings**, **Aozora Bunko / .txt import**, and
  the **kuromoji** tokenizer.
- **v3:** swapped the hand-authored seed for a **real dictionary**
  (Kanjium/EDRDG) — every kanji gets on'yomi/kun'yomi/stroke count, and ~10.8k
  words get real multi-sense definitions instead of a ~170-word seed.
- **v4:** a **My Words** tab — save words to a persistent study deck,
  mark words/kanji as already-known (dims them in the Read tab), and a
  coverage meter on Analyze showing how much of a text you already know.
  localStorage only; see above.
- **v5:** a **Review** tab — SM-2-lite spaced repetition over the
  saved deck, so a deck you build while reading is also a deck you can study
  without leaving the tool. Keyboard grading, interval previews, due badge,
  and a study streak.
- **v6:** **backup & restore** — the deck, its scheduling, both known-sets and
  the review log to a single `.json` file and back, merging on import. Closes
  the one-way door: until now a months-old deck could only be destroyed, never
  moved or recovered. Plus the first **test suite**, run in CI.
- **v7:** cards keep the **sentence they were met in** — captured on
  ★ Save, shown on the review card's back with that occurrence marked, and
  carried through backup and TSV export (which gains a fifth column). Turns a
  deck of glosses into a deck of usage. 119 tests.
- **v8:** the **Kanji Radical Tree** — a lazy-loaded, animated
  KanjiVG decomposition overlay available from Read, Review, and My Words.
  Stroke replay, true-position explode/assemble, component drill-down,
  dictionary details, known-kanji integration, reduced motion, keyboard/focus
  handling, and offline failure fallback. 126 tests.
- **v9 (current):** a standalone **Kanji library** over all 6,813 dictionary
  entries, with reading/meaning search, combinable JLPT/stroke/known filters,
  sorting, grouping, bounded result rendering, and the shared Radical Tree as
  every card's detail view. Separated tree components now receive distinct,
  non-semantic washi colors while assembled glyphs remain monochrome. 134 tests.
- **Next candidate:** browse by contained component/radical, including careful
  normalization of variants such as `水 / 氵`. Direct Aozora URL fetch remains
  deferred because a static page needs a cross-origin proxy.
