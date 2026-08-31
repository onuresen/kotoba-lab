# Kotoba Lab Idea Garden

A durable parking place for directions worth considering gradually — not a
promise to build them. Each one should earn its place through a small
experiment and real use.

## How this file is organised

It used to be organised by *when an idea was had*: a first exploration track, a
pile of loose seeds, then a second track. That made it an archaeological dig —
to find out whether something was still open you had to read three sections and
cross-reference the version history.

Reorganised on 2026-08-31 by **what brings someone to the application**,
because that is the question an idea has to answer before anything else. The
order of the sections is deliberate: the first one is the emptiest, and that is
the finding.

Implementation records for what shipped are NOT kept here. They live in
`AGENTS.md`, in the release backlog and the per-feature conventions sections;
this file keeps what an idea is *for* and what is still undecided about it.

---

## A. Keeping what you love

**Everything in Kotoba Lab currently assumes you are studying.** Every mark it
lets you make is a progress mark: *known* means "I have learned this", *saved*
means "make me practise this", the deck schedules, the review grades, the
achievements count. There is no way to say **"I like this one"** — and no
reason to open the application on a day you do not want to be improved.

That is the gap this section exists for, and it is close to empty because the
idea only arrived on 2026-08-31. It is listed first because a tool you visit
out of affection gets visited far more often than one you visit out of duty,
and everything else in this file benefits from that.

The shape to avoid is the one the app already has in one place: the
Achievements tab carries XP, eight levels, and streaks, added by explicit owner
sign-off that reversed this file's original "no points, levels, or streak
pressure" rule (the reasoning both ways is kept in `AGENTS.md`'s Vocabulary
conventions). Nothing in this section should reach for those. The distinction
worth holding onto:

> **A collection has no bottom; a checklist does.** A shelf you add to is never
> behind. A percentage complete always is.

So: collection over completion, discovery over score, presence over streak, and
nothing that can accumulate into a number you could fall short of.

### Favorites — a mark that is not a progress mark  ✓ Shipped in v10.46.0

One star, on any kanji or any word, meaning *I like this* — kept completely
apart from known-state and from the review deck. A kanji you cannot read yet
can be a favorite. A word you know perfectly well can be a favorite. Nothing
schedules it, nothing counts it, nothing asks about it later.

This is the keystone of the whole section: a shelf, a keepsake card, and a
personal note all need somewhere to hang, and this is it.

Cheap, too. `createKnownSet(key)` in `js/storage.js` is already generic by key
and is what backs both known-kanji and known-words, so favorites are the same
primitive with a different name — plus the backup format, the local-data
dashboard, and the category reset, all of which already treat known sets as a
kind.

Shipped in v10.46.0, slightly wider than the written first experiment: the
heart is on the Read info panel and the Kanji card as planned, and also on
every surface that draws a word row, because otherwise word favorites would
have had exactly one entry point and no way to undo from the shelf. It is
surfaced in no meter, no achievement, and no journal event, as required.

The open question is settled: **favorites are in profile backups** (v4), by
owner decision on 2026-08-31. They are the only collection in the application
that cannot be re-derived — a known list comes back by studying and a deck
comes back by reading — so losing them to a browser reset was the worse risk.
Merging unions them and never un-keeps.

What to watch now: whether anything ever asks favorites to count toward
something. That request is the failure mode this whole section exists to
resist, and the answer is in the selection principles below.

### The Shelf  ✓ Shipped in v10.46.0

Where favorites live: a place to browse what you kept, arranged so it reads as
a collection rather than a list. Sortable by when you kept it, by stroke count,
by level — never by "progress".

The thing to get right is the absence of a target. No "12 of 100", no next
milestone, no empty slots implying what should fill them. The Achievements tab
deliberately renders locked badges greyed out; this must do the opposite and
show only what is there.

Shipped in v10.46.0 in two forms, on purpose. The cheap reuse test this entry
asked for is there — a **Favorites filter** over the Kanji library's existing
grid, which also intersects with the component picker. And a **Favorites card
in the Deck tab**, which earns its place for a reason the entry had not
noticed: favorites span two types, and no single existing grid can show kanji
and words together. Both halves arrange `kanjiCard()` and `wordRowMarkup()`
rather than inventing a layout, so the bespoke question is still open.

Remaining decision, unchanged and now answerable from use: does browsing the
filtered grid feel good, or does it feel like a search result? Only the second
answer justifies designing a real shelf. Watch also whether the Deck tab is
the right home — it is the "your stuff" tab, but everything else in it is
study data, and the card's copy has to say "nothing here is scheduled" out
loud precisely because of that.

### A kanji that finds you

One button: *show me something*. It draws one kanji, stroke by stroke, with its
meaning and one word it appears in — and then nothing. No question, no answer,
no grading, no next. The calmest interaction the application could contain, and
close to free: Radical Tree already animates strokes, and Relations already has
a **Surprise me** discovery seed to model the selection on.

The difference from that existing button is the intent. "Surprise me" in
Relations is a study entry point — it hands you a neighbourhood to explore.
This hands you nothing to do.

First experiment: on the Kanji tab beside the Daily Mystery, sharing its
collapsed-strip shape. Watch whether it gets pressed twice in a row — that is
the whole signal. A thing pressed once out of curiosity and never again is a
novelty; a thing pressed repeatedly is a mood the application should serve.

### A card you can keep

Export one kanji as an image worth keeping — a phone wallpaper, something to
send to someone, something to print. Stroke paths, meaning, readings, laid out
properly.

This is the most literal reading of "useful while not studying": the
application produces an artefact that leaves it. Everything Kotoba Lab exports
today (Anki TSV, study packs, profile backups, the usage report) is a data
file. Nothing it makes is nice to look at.

Feasible with what is already committed: KanjiVG paths render as SVG, and
`<canvas>` can rasterise an SVG to PNG in-browser with no dependency and no
service.

First experiment: one kanji, one layout, PNG download, from the Radical Tree
overlay where the strokes already are. Deliberately not a template gallery —
one good card beats five configurable ones.

### Why I kept it

A short personal note attached to a favorite. *Saw this on a shop sign in
Kawasaki.* *Like the way it is built.* *My name has this in it.*

This is the idea that turns the application from a record of your performance
into a record of your relationship with the language, which is a different and
longer-lived thing. It is also the heaviest item in this section: free text
means real storage, a real backup-format decision, and a real privacy question
that the rest of the app has never had to ask, since it has never stored a
sentence the user wrote themselves.

Parked deliberately behind Favorites and the Shelf. If nobody stars anything,
this never matters; if the shelf fills up, this is what makes it worth
revisiting.

Two other Japanese-study apps reviewed for comparison (Kanji Study, JA Sensei)
both attach exactly this note to *every* kanji or word, not gated behind
marking one a favorite first. Worth widening the scope to match: a note field
reachable from the Read info panel and the Radical Tree directly, independent
of the ♡ toggle — liking something and having something to say about it are
different acts, and gating the second behind the first would lose notes on a
kanji someone has plenty to say about but, for whatever reason, never stars.

### Your own words for it

Replace or set alongside the dictionary's own meaning with your own, in your
own words — not a note beside the kanji, an editable field in its place.
Kanji Study shows exactly this: a pencil icon sitting right on the Meaning row.

This is a different act from a note (above): a note is commentary kept beside
the dictionary's own answer; this is a personal mnemonic standing in for it,
for the kanji whose dictionary gloss ("eternity; eternal") never sticks the
way your own image of it would.

The honesty question is sharper here than for a note. Every other surface in
this application shows kanjidic's meaning as fact, and several features
(Alchemy's evidence, the Daily Mystery's clues, the Kanji Contrast Lab) depend
on it staying exactly that — a fact, never something a learner silently
overwrote. If this is built, a personal override must stay visibly a personal
override everywhere it appears, and must never leak into any surface that
treats the dictionary meaning as evidence.

First experiment: a small, clearly-labelled "Your words" field beside — never
replacing — the dictionary gloss on the Read info panel only, saved per kanji
under its own storage key. Prove the labelling stays honest there before it
appears anywhere else.

### More than one shelf

Favorites is one collection. Both reference apps let you build several — named,
purpose-built lists ("Business terms", "Chapter 3", "N2 review") added to
straight from a kanji or word's own card.

The natural next step if Favorites gets used the way this whole section hopes
— and a real step up in weight, not a small extension. It needs list creation
and deletion, a picker on every card instead of one heart, and a decision about
what a list means once a learner's sense of it has moved on but its contents
have not. `createKnownSet(key)` stops being reusable as-is the moment there is
more than a fixed handful of keys: a named, learner-created list needs its own
small schema — an id, a label, a member set — not one `localStorage` key per
list invented on the fly.

Deliberately not attempted until Favorites has been used for a while. One
collection with no target was section A's whole thesis; several collections
reopen the question of whether they stay a personal library or start turning
into homework assigned to yourself ("finish the N2 review list"). That risk is
exactly why this waits.

### Ambient strokes

The Radical Tree animation, unattended: kanji drawn one after another, slowly,
with nothing to do. A screensaver made of the data already committed.

The smallest idea here and the least justified — listed because it costs almost
nothing and because "calm" is a claim this project keeps making and has not yet
built anything that is purely calm. If it is built, it should be reachable and
forgettable, never a tab.

---

## B. In the study loop

Deliberate practice: the part of the application that already works, and where
the remaining ideas are refinements rather than new territory.

### Placement

A new profile has zero known kanji, which leaves unlock feedback, readable
compounds, personal coverage, the Words tab's own reason to exist, and most of
Achievements rendering empty — the best ideas in the application are invisible
at exactly the moment someone decides whether to keep it.

First experiment: roughly fifteen questions binary-searching the JLPT bands
(*do you know this one?* → reveal → yes/no), producing a **proposed** known set
shown as an editable preview before anything is written, through the same
inspect-then-commit shape the backup importer already uses. A cheaper sibling
worth doing first: paste a list from WaniKani, RTK, or an Anki export into that
same preview.

The honesty question comes before the code: a seeded known set is an estimate,
and every coverage number downstream will treat it as fact. Decide whether the
estimate is marked as one, and for how long.

Worth being clear about the audience: this is the highest-leverage change in
the file for a *new* user and does nothing for an existing one. It matters when
this stops being a tool for one person.

### Type the Reading

An optional typed answer in Review: type the kana, checked exactly against the
stored dictionary reading. Recall beats recognition, it is fully deterministic,
and it needs no new data. The smallest genuinely useful thing left in this
section.

First experiment: exact match only, pass/fail, no near-miss note. A "one mora
off" message sounds friendly and is a similarity judgment in disguise; if it is
wanted later, define it as an explicit rule (one kana substitution, or a
long-vowel or sokuon difference) rather than a distance score.

### Real sentences for every word

An authored example sentence for a dictionary word, with reading and
translation, shown wherever that word appears — even one never yet met while
reading. JA Sensei shows three per word, each with its own audio.

This is the one gap Context-First Cards (v10.43.0) cannot close: cloze needs a
sentence the reader actually met the word in, so a word never yet encountered
in pasted text has nothing to cloze. A committed example-sentence corpus would
give every one of the 10,808 vocabulary entries a sentence on day one — in
Word Lookup, in the Kanji tab's recommended-words list (v10.47.0), everywhere
a bare word and gloss sit today.

Unlike section E, this needs no invented judgment — a real source exists.
Tatoeba is an open, actively maintained Japanese–English sentence corpus,
individually CC BY 2.0 FR licensed per sentence pair, already the standard
source other dictionary tools use for exactly this. But it is a genuinely new
dataset, not a re-extraction of anything already committed: matching sentences
to this project's specific 10,808 words, keeping only pairs both sides agree
on, and carrying correct per-sentence attribution is real data-engineering
work — closer in shape to the KanjiVG pipeline (`tools/build-kanjivg.mjs`, a
pinned release, a checksum, an `npm run … :check` script) than to a code
change.

First experiment: pick 50 common words, hand-verify Tatoeba's coverage and
translation quality for exactly those, and look honestly at the match rate
before committing to extracting all 10,808. If coverage or quality is poor for
common words, it will not improve for rare ones.

### Counters, for free

A small reference for Japanese counter words (枚, 匹, 冊, 個…) — the thing JLPT
learners reliably get stuck on, and something almost every general
Japanese-course app (JA Sensei included) ships as its own section.

Unlike everything else in this file that touches new data, this needs none: 44
entries already sitting in the committed `data/jlpt-vocab.json` carry a gloss
that literally starts "counter for…" (丁 "counter for sheets, pages, leaves…
counter for blocks of tofu"; 匹 "counter for small animals; counter for rolls
of cloth…"). The list has been inside data this project already ships, unused,
the whole time.

First experiment: a filter mode in the Kanji library or Word Lookup — `kind:
counter` — built entirely from that existing gloss pattern, no new storage and
no new page. Whether it deserves more than a filter is worth deciding only
after a human reads through the 44, not a bigger regex: some "counter for…"
glosses are a secondary sense on a word whose primary sense is something else
entirely (乗 "(nth) power; counter for vehicles"), and those need judgment a
pattern match cannot supply.

### Grade, frequency, and part of speech

Three real dictionary facts Kanji Study shows that Kotoba Lab's own kanji card
does not: Jōyō grade (the Ministry of Education's own 1–6 school-grade
assignment, a different axis from JLPT level), a frequency-of-use rank from a
newspaper corpus, and — for vocabulary — part of speech per word ("noun",
"transitive verb").

None of these are invented, and none need a new license. `data/ATTRIBUTION.md`
says the quiet part outright: the vocabulary build already "stripped
part-of-speech tags" from the source EDICT data for concise display, and
KANJIDIC — the same Kanjium/EDRDG source `kanjidic.json` already comes from —
carries both grade and frequency fields upstream. This project already holds a
license broad enough for exactly this use.

What is actually missing is narrower, and more honest, than "the data doesn't
exist": there is no committed, reproducible build script for `kanjidic.json`
or `jlpt-vocab.json` at all. Unlike KanjiVG, which has
`tools/build-kanjivg.mjs`, a pinned release, and an `npm run kanjivg:check`
script, the vocabulary and kanji dictionary files were built once, outside
this repository, from a copy of the Kanjium database, and only the derived
JSON was ever committed. Adding grade, frequency, or part of speech means
re-acquiring that source (or the KANJIDIC2/JMdict XML it derives from) and
writing the missing pipeline — `tools/build-vocab.mjs`, in the same shape —
not a small code change.

First experiment, once the source is in hand: grade and frequency on the Kanji
library card and the Radical Tree info panel only, sorted by neither — sort
order is where "frequency" quietly turns into an "importance" this project has
never asserted about a kanji, and the component picker's own ordering
principle (order by what can be counted, never by "importance") should hold
here too.

### Browsing without closing the door

Previous/next through the current filtered kanji list without leaving the
Radical Tree overlay — step to the next result in a JLPT band, a search, or a
family, the way Kanji Study's kanji strip stays on screen while the detail
view below it changes.

Today, browsing ten kanji from a search means opening Radical Tree, closing
it, and reopening it nine more times. The Kanji library already computes the
exact filtered-and-sorted list Radical Tree would page through —
`filterKanji()` in `js/kanji-browser.js` — so this is threading an index
through an existing array, not building a second one.

First experiment: scope it to the one launch point that actually has an
ordered list behind it — opening Radical Tree from the Kanji library grid.
Every other doorway into Radical Tree (a word's kanji chip, a Relations node,
the Daily Mystery's answer card) opens one specific kanji with no natural
"next", and should keep behaving exactly as it does now.

### Old known kanji

Known-state is permanent and never revisited, which quietly inflates every
coverage number the application reports. Decay would answer that and is against
this project's grain — it is guilt with a timer.

First experiment: an opt-in spot check offering five kanji marked known 90 or
more days ago that have not appeared since, framed the way `js/study-weather.js`
frames a backlog — *a little haze over the old district* — and reusing
`js/srs.js` without giving kanji a permanent schedule. If it cannot be framed
without implying failure, it should not be built.

### Kanji Genealogy

An explainable lineage from component → kanji → word → sentence, with reading
branches and visible exceptions. Different from the Relationship Map: a
directed learning path rather than a neighbourhood.

First experiment: one direct component, a bounded three-level lineage from
existing dictionary and current-text data. Avoid etymology claims; the view
describes dataset structure and usage evidence only.

Now overlaps more than it did when it was written: Component Lookup walks the
component→kanji edge, the Words tab walks kanji→word, and Context-First Cards
walk word→sentence. What is left that is genuinely new is the *path* — seeing
all four levels at once as one object. Decide whether that is worth a view
before building one.

### Sentence Archaeology

Peel a sentence through word, particle, kanji-family, literal-structure,
natural-meaning, and substitution layers.

The Grammar X-ray (v10.44.0) built the first two layers' worth of data without
meaning to: every token now carries a part of speech and a dictionary form when
the precise tokenizer is on. The remaining layers are the hard ones, and the
literal-meaning and substitution layers would both require inventing a reading
of a sentence that no committed data supports — see section E.

### Zen Study Room

One distraction-free, explainable activity — sentence, family, mystery, or
short review set — chosen from current local needs.

Note for anyone reading the history: the commit titled "Zen Study Room"
(f5b2762) actually shipped the Japanese Weather System forecast card. This seed
is still unbuilt.

Worth re-reading now that there are more activities to choose between than
there were: Alchemy, family study, contrast sets, the Daily Mystery, writing
practice, and Review are all candidates, which makes the "selected from current
local needs" part both more useful and much harder to do honestly.

---

## C. Exploring without a goal

Curiosity with no study intent attached — adjacent to section A, but about
following structure rather than keeping things.

### Japanese Detective Board

A freeform investigation canvas where kanji, words, readings, components,
sentences, and relationship clusters can be pinned, with explainable links
drawn between the pinned evidence.

First experiment: an ephemeral board with moveable kanji cards and automatic
relationship connectors. Decide on persistence only after the interaction is
useful; do not add a storage key merely to preserve a prototype.

### The casebook half of Kanji Mystery

The Daily Mystery (v10.45.0) shipped the *puzzle* half of the original Kanji
Mystery Casebook seed: clues, a guess, an ending. What is still unbuilt is the
*investigation* half — the deduction happening across Relations and Radical
Tree rather than inside one card.

Parked until the daily shows whether anyone wants to investigate rather than
simply guess. That is a real question: guessing is fast and satisfying, and the
casebook version asks for effort the daily deliberately does not.

### A voice, locally

Speak a word or a review card through `speechSynthesis`, restricted to
`localService` ja-JP voices, with a plain "no Japanese voice installed" state
when there is none.

The restriction is the feature, not the limitation: remote voices leave the
device, so gating to local ones keeps `PRIVACY.md` free of an asterisk.

First experiment: a speaker button on the Read info panel only. Confirm first
that a local ja-JP voice is actually present on a normal Android phone and a
normal desktop; if it usually is not, this seed dies there rather than shipping
a button that mostly apologises.

Belongs in two sections at once: hearing a word you like is section A, and a
hear-then-recall review direction is section B. Build the appreciation half
first — it is smaller and it cannot fail in a way that costs anything.

---

## D. Looking back

### Bookshelf

Save the texts that were read, with the coverage snapshot from their first
analysis, and re-measure on return: *you could read 61% of this in June; today,
84%; these nine kanji are what is left.*

Coverage is currently computed and thrown away on every paste. Progress
measured against a real thing someone wanted to read beats every abstract
streak in the application, and "these nine kanji are what is left" is already
exactly the input `js/text-journey.js` takes.

First experiment: save one text by explicit action only, never automatically —
the Read tab handles material the reader may not want persisted. This needs a
new storage key and a backup-format bump, and should be built only if the
re-measurement moment feels as good in use as it reads here.

The strongest remaining idea in the file for an existing user.

### Knowledge Time Machine

Turn privacy-safe aggregate history into a visual story of how feature use and
study collections evolved, without retaining studied content.

Still blocked on the same thing it always was: the usage journal is opt-in and
off by default, keeps 90 days, and stores no content, so there may simply not
be enough history to tell a story with. Check what a real journal contains
before designing anything.

---

## E. Blocked on a source this project does not have

These are not parked for scope. Each one needs *evidence or content Kotoba Lab
does not hold*, and building it anyway would mean inventing a judgment the rest
of the application refuses to make. Grouped together so they stop being
re-litigated one at a time.

- **Parallel Text Portal** — the same scene across simple, conversational,
  literary, formal, and newspaper-like Japanese. Needs authored parallel text;
  there is none, and generating it would be inventing the language it claims to
  compare.
- **Living Story Route** — original episodic fiction whose optional quests open
  Radical Tree, Relations, family practice, and review. Needs original or
  clearly licensed fiction, written by someone.
- **False-Friend Museum: deceptive shared components and near-synonym traps** —
  both need a visual- or semantic-closeness judgment the application never
  makes. The homophones exhibit shipped (v10.41.0) precisely because exact
  reading equality is a fact rather than a judgment; similar-looking kanji is
  already the Kanji Contrast Lab's shared-component sets.
- **Translating IPADIC's inflection labels** — showing 連用タ接続 verbatim is
  describing the analyser; rendering it as "past tense" is teaching grammar.
  Needs a citable reference grammar, not a hand-written mapping.
- **Sentence Archaeology's literal-meaning and substitution layers** — same
  problem: no committed data supports either reading.

If a suitable source ever arrives, these become ordinary bounded experiments.
Until then, listing them here is the answer.

---

## Open follow-ups from what shipped

Questions that only real use can settle. None is a defect.

| From | Question |
|---|---|
| Context-First Cards (v10.43.0) | Should a clozed card ever carry its own SM-2 state, or stay one card viewed three ways? |
| Component Lookup (v10.43.0) | Does the picker belong in Relations or the Atlas root chooser, which share the "name the kanji first" assumption? |
| Writing Lab (v10.44.0) | Practice is only reachable after navigating to one kanji, which is the wrong place to build a habit. Candidates: a Review card that asks you to write the word, and the family-study workspace. |
| Grammar X-ray (v10.44.0) | Is the inflection label worth translating, and by what authority? (See section E.) |
| Daily Mystery (v10.45.0) | Is the share line ever used by someone with no audience for it — and does a second daily crowd Today's Brew rather than reinforce it? |
| Japanese Weather System (v10.42.0) | Does the forecast belong anywhere outside the Review tab, now that it exists? |
| Radical Alchemy (v10.20.0) | Observe real study use before adding recipes or persistence. |
| Kanji Constellation Atlas (v10.15.0) | Refine only from navigation, density, or practice friction. |

## What has shipped from this file

Implementation detail and conventions live in `AGENTS.md`; this is the index.

| Direction | Shipped |
|---|---|
| Favorites + the Shelf | v10.46.0 |
| Kanji Constellation Atlas | Groups A–D, v10.15.0 |
| Radical Alchemy | Groups A–C, v10.18.0–v10.20.0 |
| False-Friend Museum (homophones exhibit) | v10.41.0 |
| Japanese Weather System (Review forecast) | v10.42.0 |
| Context-First Cards | v10.43.0 |
| Component Lookup | v10.43.0 |
| Writing Lab | v10.44.0 |
| Grammar X-ray | v10.44.0 |
| Daily Kanji Mystery (from the Mystery Casebook seed) | v10.45.0 |

## Selection principles

- Prefer a memorable loop over adding another permanent tab.
- Collection over completion; discovery over score; presence over streak.
  Nothing new should be able to make someone *behind*.
- A mark that means "I like this" must never become a mark that means "I have
  achieved this". The moment a favorite affects a number, it is a progress
  mark.
- Keep data local-first and make any new persistence an explicit decision.
- Reuse Radical Tree, Relations, families, review, and usage insights before
  creating parallel engines.
- Describe structural and reading evidence accurately; never present visual
  decomposition as historical etymology, or a dictionary tag as a grammar rule,
  without a suitable source.
- Use original or clearly licensed story content.
- Validate each direction as a bounded experiment on desktop and phone before
  expanding it into a larger world.
