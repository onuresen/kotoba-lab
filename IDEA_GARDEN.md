# Kotoba Lab Idea Garden

This is a durable parking place for imaginative directions that should be
considered gradually, not a promise to build all of them. Each idea should earn
its place through a small experiment and real study use.

## First exploration track

These four directions were selected as the strongest personal favorites on
2026-08-14. The order below is the recommended implementation sequence, based
on shared foundations and increasing scope. Actual exploration did not follow
that order: the Atlas was validated before Alchemy. Status, not list position,
is authoritative.

| Direction | Current status | Remaining decision |
|---|---|---|
| Radical Alchemy | ✓ Bounded Groups A–C complete in v10.20.0 | Observe real study use before adding recipes or persistence |
| Kanji Genealogy | Parked idea | Define a directed component → kanji → word → sentence experiment |
| Japanese Detective Board | Parked idea | Test whether a freeform evidence canvas improves study rather than adding novelty |
| Kanji Constellation Atlas | ✓ Bounded Groups A–D complete in v10.15.0 | Refine only from navigation, density, or practice friction |

### 1. Radical Alchemy

Combine components to discover kanji, choose a missing component, reverse a
kanji into ingredients, or follow short alchemy chains. This is the smallest
high-impact experiment because it can reuse Radical Tree decomposition,
component coloring, KanjiVG, and existing family-study interactions.

First experiment: one daily five-question `component + component → kanji`
challenge with explainable answers and direct Radical Tree handoff.

Group A is implemented in v10.18.0 as a doorway inside the Kanji library. The
date-seeded Today’s Brew selects one unambiguous direct-component formula from
each JLPT level, offers four kanji choices, and explains every reveal from the
committed compact KanjiVG index. The alchemy circle and ingredient vessels are
code-native, responsive, and reduced-motion safe. Scores and position remain
session-only, the full stroke artifact stays lazy until Radical Tree opens,
and the wording describes visual structure rather than historical etymology.

Group B is implemented in v10.19.0 as the Alchemical Visual Identity layer.
An original text-free laboratory illustration is committed as a 78 KB WebP;
functional flasks, crucible, formula book, seal, spark, and transmutation
circle remain a crisp code-native SVG sprite. Ingredient bubbles, vessel pours,
ink bloom, seal stamping, and completion sparkle add restrained feedback while
the reduced-motion path is completely still. No meaning, component, kanji, or
control is baked into the generated backdrop.

Group C is implemented in v10.20.0 as Expanded Recipe Studies. Missing
Ingredient asks for one concealed direct component, Reverse Brewing asks for
the complete two-component formula, and Transformation Chain follows a result
only when that kanji becomes a direct ingredient in the next verified recipe.
All modes support an unknown-only target filter, answer-level known controls,
and the same explicit KanjiVG evidence. A session-only recipe trail can open as
an ordinary temporary reveal-card study pass; it disappears when the learner
leaves and adds no score, streak, storage key, or profile field.

### 2. Kanji Genealogy

Show an explainable lineage from component → kanji → word → sentence, with
reading branches and visible exceptions. This is different from the
Relationship Map: it is a directed learning path rather than a neighborhood.

First experiment: choose one direct component and render a bounded three-level
lineage using existing dictionary and current-text data. Avoid etymology claims;
the view describes dataset structure and usage evidence only.

### 3. Japanese Detective Board

Create a freeform investigation canvas where kanji, words, readings,
components, sentences, and relationship clusters can be pinned. Kotoba Lab
draws explainable links between the pinned evidence.

First experiment: an ephemeral board with moveable kanji cards and automatic
relationship connectors. Decide on persistence only after the interaction is
useful; do not add a storage key merely to preserve a prototype.

### 4. Kanji Constellation Atlas

Turn the relationship network into an explorable knowledge sky: kanji become
stars, components become constellations, readings become routes, known kanji
illuminate explored space, and unfamiliar regions remain quiet or misty.

First experiment: a single bounded constellation generated from one selected
component, with known-state lighting and a doorway back to Relations. Build the
full atlas only after navigation, density, and phone performance feel good.

Group A is implemented in v10.12.0 as an experimental third Relations view.
It uses one direct component from the selected root, caps the visible family at
24 deterministic stars, illuminates the existing known-kanji state, and lets a
star return to its ordinary neighborhood. Component choice and Atlas position
remain ephemeral; no new profile or storage format was added.

Group B is implemented in v10.13.0 as the exploration layer. A star now opens
an in-Atlas dictionary panel with readings, level, strokes, component evidence,
and known-state illumination. Explicit actions can make it the new Atlas root,
open its ordinary Relations neighborhood, or enter Radical Tree; tapping the
star itself no longer throws the learner out of the sky. The phone version uses
a compact sticky detail card above the touch-pannable constellation.

Group C is implemented in v10.14.0 as the living-sky layer. The selected
component keeps its solid spokes while bounded dashed on’yomi and kun’yomi
routes reveal reading families among visible stars. A route toggle and
session-only 80–120% zoom support different densities on desktop and phone.
Small route-travel, center-breathing, and known-star-twinkle cues add life
without moving the deterministic star layout, and all motion is disabled for
reduced-motion preferences. The Atlas still adds no profile or storage field.

Group D is implemented in v10.15.0 as the study loop. Unknown visible stars can
open as a temporary constellation study session with an explicit route back to
the same Atlas. Every visible star can also be exported through the existing
private-data-free study-pack format. Small, unscored challenges ask for the
shared direct component or an exact dictionary-reading exception and explain
the evidence after each choice. The opt-in journal adds only fixed
`atlas.open` and `study.atlas` counts, allowing the existing friction radar and
aggregate report to recognize exploration-to-practice handoffs without storing
kanji, components, readings, choices, or a new profile field.

## Remaining creative seeds

Kanji Genealogy and Japanese Detective Board above remain the two unfinished
directions from the selected first track. The additional seeds below are also
parked until real usage evidence identifies a study problem worth solving,
except The False-Friend Museum, whose first bounded exhibit type shipped
directly by owner request rather than from observed friction — see its own
entry for what that covers and what is still parked.

### Kanji Mystery Casebook

Identify a hidden kanji from structural, reading, stroke, JLPT, and vocabulary
clues by investigating through Relations and Radical Tree.

### Parallel Text Portal

Compare carefully authored versions of the same scene across simple,
conversational, literary, formal, and newspaper-like Japanese.

### The False-Friend Museum

Curate similar-looking kanji, deceptive shared components, homophones, and
near-synonym traps as returning comparison exhibits.

The homophones exhibit is implemented in v10.41.0 as a card in the Words tab:
groups of committed multi-character vocabulary sharing one dictionary reading
but not one meaning (取る・執る・捕る・採る, all とる), with a meaning-matching
quiz and the shared word-row shape (known/save) for every member. Similar-
looking kanji is not a separate exhibit here — it is already the existing
Kanji Contrast Lab's shared-component sets. Deceptive shared components and
near-synonym traps remain parked: both would require inventing a visual- or
semantic-closeness judgment the rest of this app deliberately never makes,
so they need a source of real evidence, not just a bounded scope, before
they can follow the same pattern.

### Sentence Archaeology

Peel a sentence through word, particle, kanji-family, literal-structure,
natural-meaning, and substitution layers.

### Knowledge Time Machine

Turn privacy-safe aggregate history into a visual story of how feature use and
study collections evolved, without retaining studied content.

### Living Story Route

Use original episodic fiction whose optional study quests open Radical Tree,
Relations, family practice, and review as parts of the narrative.

### Japanese Weather System

Express local study conditions as a playful daily forecast instead of a
guilt-heavy streak or conventional dashboard warning.

A first bounded experiment is implemented in v10.42.0: a small forecast card
at the top of the Review tab (`js/study-weather.js`, pure and tested)
reframes the same due/fresh/streak numbers the stat row already shows into
one calm sentence with a weather icon — clear skies when caught up, light
showers or steady rain for a normal or large backlog, and fog (never a
"broken streak") when it has been several days or the deck has never been
reviewed at all. It adds no new storage: `reviewLog` gained one read-only
`daysSinceLast()` accessor, and the forecast itself is recomputed on every
Review-tab render rather than persisted. Remaining open question before
going further: whether the same forecast belongs anywhere outside the
Review tab (e.g. on arrival at the app) now that it exists — deliberately
left for observed use to answer.

### Zen Study Room

Offer one distraction-free, explainable activity—sentence, family, mystery, or
short review set—selected from current local needs.

## Second exploration track — unused assets (2026-08-30)

The first track and the seeds above were chosen from what Kotoba Lab could
*become*. This track was chosen from what it already *has* and does not spend.
A review of the repository on 2026-08-30 found three assets already committed,
already paid for, and barely used:

1. **KanjiVG stroke paths.** `data/kanjivg.json` carries every stroke as an
   ordered path plus, through `strokeStart`/`strokeCount`, the stroke range
   belonging to each component. Radical Tree only replays them.
2. **Kuromoji's morphology.** `mapTokens()` in `js/tokenizer-kuromoji.js`
   reads `pos`, `pos_detail_1`, and `basic_form`, uses them for the merge
   pass, and then discards them at the Token boundary. Every grammar-shaped
   feature is currently impossible for that one reason alone.
3. **The browser's own speech synthesis.** No dependency, no service, and
   filterable to `localService` voices, which is the only form that keeps
   `PRIVACY.md` literally true.

The same review found the app is almost entirely a *recognition* trainer:
nothing ever asks the learner to produce a kanji, to conjugate anything, or to
hear a word. The seeds below are grouped by which of those gaps they close.
Ordering below is by expected value, not by planned sequence; as with the
first track, status is authoritative.

| Direction | Current status | Remaining decision |
|---|---|---|
| Context-First Cards | ✓ Shipped in v10.43.0 | Whether cloze deserves its own scheduling, or stays a viewing direction |
| Component Lookup | ✓ Shipped in v10.43.0 | Whether the picker belongs anywhere outside the Kanji tab |
| Writing Lab | ✓ Shipped in v10.44.0 | Whether practice belongs anywhere outside the Radical Tree overlay |
| Grammar X-ray | ✓ Shipped in v10.44.0 | Whether the conjugation label is worth translating, and by what authority |
| Placement | Parked idea | Decide whether a seeded known set is honest enough to write |
| Bookshelf | Parked idea | The only seed here that needs a new storage key — decide if re-measurement earns it |
| Daily Kanji Mystery | Parked idea | Decide whether a shareable score fits an app that has stayed calm |
| A Voice, Locally | Parked idea | Confirm a `localService` ja-JP voice is common enough to build on |
| Type the Reading | Parked idea | Decide what "close enough" means before promising a near-miss note |
| Old Known Kanji | Parked idea | Decide whether known-state may ever be questioned without becoming guilt |

### Context-First Cards

Deck entries already store `sentence`, `sentenceStart`, and `sentenceEnd`, and
`renderStage()` already renders `.srs-context` — but only on the back of the
card, deliberately, so it cannot give a recall answer away. Putting that same
sentence on the *front* with the word blanked turns it into cloze practice
over the learner's own reading, which is a stronger memory hook than either
existing direction and needs no data the deck is not already carrying.

Implemented in v10.43.0 as a third `#srs-direction` option rather than a new
mode, feature, or tab — see the AGENTS.md release notes for what it does and
what it deliberately does not do. Remaining decision: cloze is currently a way
of *viewing* the same card, sharing one schedule with the other two
directions. Whether a clozed card should ever carry its own SM-2 state is
left for observed use; adding it would double every deck entry's schedule and
should not happen on theory alone.

### Component Lookup

The Kanji library can be searched by glyph, reading, or meaning — all three of
which assume the learner can already name the kanji. The one lookup path a
paper-dictionary user expects, *build it out of the parts you can see*, was
missing, even though `data/kanji-families.json` already indexes the direct
components of all 6,392 covered kanji and the app already loads that index for
its structural family views.

Implemented in v10.43.0 as a component picker inside the Kanji toolbar. The
picker is ordered by how many kanji actually use each component and narrows
itself as components are chosen, so a dead end is visible before it is
selected — both facts are read from the index, not judged. Remaining decision:
whether the same picker belongs in Relations or the Atlas root chooser, which
have the same "name the kanji first" assumption; deliberately not built until
someone hits that wall for real.

### Writing Lab

Fade the glyph and let a finger draw it back, grading each stroke against the
committed KanjiVG path. Because the artifact carries a stroke range per
component, feedback can be structural rather than a red cross — *the 木 on the
left is right; stroke 6 belongs to 交 and you drew it before finishing 木* —
which nothing else in this app can currently say and no other browser tool
does offline.

This is the largest gap in Kotoba Lab: the whole application is recognition,
and production is where recognition is revealed to be shallower than it felt.

Implemented in v10.44.0 as a "Practise writing" mode inside the Radical Tree
overlay, exactly as the first experiment described: session-only, no score and
no storage key, grading only order, direction, placement, and count. The
endpoint-only design is what keeps the shape promise literal rather than
merely stated — see the AGENTS.md conventions for why a wrong stroke never
advances and why reversal is checked before placement.

The open question the experiment was meant to answer is now a different one.
Order-only feedback does feel useful, so the idea survives; what is undecided
is *where* it belongs. Practice currently exists only where a learner has
already navigated to one kanji, which is the wrong place to build a habit —
but giving it a tab would fail this file's own first selection principle.
Candidates worth watching real use for: a Review card that asks you to write
the word instead of recall it, and the family-study workspace, which already
walks a set of kanji one at a time. Deliberately not built on theory.

Still parked, and still nearly free: a print stylesheet laying the current
family out as 原稿用紙 practice squares. Print CSS only, no PDF dependency.

### Grammar X-ray

Add nullable `pos`/`lemma` fields to the Token shape. The v1 dictionary
tokenizer leaves them empty, so the swappable-tokenizer contract in
`js/tokenizer.js` survives untouched; the kuromoji path fills them in from
analysis it is already doing. Read can then tint particles as their own layer
and show 食べた ← 食べる on tap, and Analyze can profile verb forms and
particles beside the kanji profile it already draws.

Conjugation is where intermediate readers actually stall, and the app is
currently silent about it.

Implemented in v10.44.0, and deliberately wider than the first experiment
written here, which was the inspect panel alone. The plumbing — four optional
Token fields and one pure module that owns every reading of them — is the
whole cost; once it existed, the particle layer and the Analyze profile were
each a renderer over the same function, and holding them back would have left
the "switch on precision and the text grows a grammar layer" promise unkept
while still paying for the change. Recorded as a widening rather than hidden:
the bounded-experiment principle is about validating a direction cheaply, and
this direction was validated by the plumbing, not by the panel.

The rule the module exists to keep held throughout: it reports IPADIC's
labels, and `conjugated` is a comparison with the analyser's own lemma rather
than a claim about tense. Remaining decision: the inflection label is shown
verbatim (連用タ接続) because translating it is where describing a tagset turns
into teaching grammar. If that is worth doing later it needs a source with
authority — a cited reference grammar — not a hand-written mapping.

### Placement

A new learner has zero known kanji, which means unlock feedback, readable
compounds, personal coverage, the Words tab's own reason to exist, and most of
Achievements all render empty — the best ideas in the application are
invisible at exactly the moment someone decides whether to keep it.

First experiment: roughly fifteen questions binary-searching the JLPT bands
(*do you know this one?* → reveal → yes/no), producing a **proposed** known set
shown as an editable preview before anything is written, through the same
inspect-then-commit shape the backup importer already uses. A cheaper sibling
worth doing first: paste a list from WaniKani, RTK, or an Anki export into
that same preview.

The honesty question comes before the code: a seeded known set is an estimate,
and every coverage number downstream will treat it as fact. Decide whether the
estimate is marked as one, and for how long.

### Bookshelf

Save the texts that were read, with the coverage snapshot from their first
analysis, and re-measure on return: *you could read 61% of this in June;
today, 84%; these nine kanji are what is left.*

Coverage is currently computed and thrown away on every paste. Progress
measured against a real thing the learner wanted to read beats every abstract
streak in the app, and "these nine kanji are what is left" is already exactly
the input `js/text-journey.js` takes.

First experiment: save one text by explicit action only, never automatically —
the Read tab handles material the learner may not want persisted. This is the
only seed in this track that needs a new storage key and a backup-format
bump; it should be built last of the three top picks, and only if the
re-measurement moment feels as good in use as it reads here.

### Daily Kanji Mystery

The parked *Kanji Mystery Casebook* above, sharpened into a loop with an
ending: one date-seeded kanji, clues released one at a time — stroke count,
canonical radical, a direct component, an on'yomi, a word it appears in — and
a guess allowed after any clue. It closes with a spoiler-free result line that
can be pasted anywhere.

Date seeding is a pattern already shipped in Alchemy's Today's Brew, so this
needs no server and no account, and every clue is a committed dictionary fact,
so it can never invent anything. It is also the only idea in this track that
gives a reason to open the app on a day with no appetite for studying.

First experiment: the loop with no score, no streak, and no share string at
all — those are separable, and the *Japanese Weather System* entry above is
this project's own argument for leaving them off. Add the share line only if
the loop is worth returning to without it.

### A Voice, Locally

Speak a word or a review card through `speechSynthesis`, restricted to
`localService` ja-JP voices, with a plain "no Japanese voice installed" state
when there is none. Then one new review direction: hear the reading, recall
the word.

The deck only ever tests eye → meaning. Ear → meaning is a whole missing
modality, and the restriction is the feature, not the limitation: remote
voices leave the device, so gating to local ones is what keeps the privacy
promise free of an asterisk.

First experiment: a speaker button on the Read info panel only. Confirm first
that a local ja-JP voice is actually present on a normal Android phone and a
normal desktop; if it usually is not, this seed dies there rather than
shipping a button that mostly apologises.

### Type the Reading

An optional typed answer in Review: type the kana, checked exactly against the
stored dictionary reading. Recall beats recognition, it is fully
deterministic, and it needs no new data.

First experiment: exact match only, pass/fail, no near-miss note. A
"one mora off" message sounds friendly and is a similarity judgment in
disguise; if it is wanted later, define it as an explicit rule (one kana
substitution, or a long-vowel or sokuon difference) rather than a distance
score.

### Old Known Kanji

Known-state is permanent and never revisited, which quietly inflates every
coverage number the app reports. Decay would answer that and would be against
this project's grain — it is guilt with a timer.

First experiment: an opt-in spot check offering five kanji marked known 90 or
more days ago that have not appeared since, framed the way
`js/study-weather.js` frames a backlog — *a little haze over the old
district* — and reusing `js/srs.js` without giving kanji a permanent schedule.
If it cannot be framed without implying failure, it should not be built.

## Selection principles

- Prefer a memorable study loop over adding another permanent tab.
- Keep data local-first and make any new persistence an explicit decision.
- Reuse Radical Tree, Relations, families, review, and usage insights before
  creating parallel engines.
- Describe structural and reading evidence accurately; never present visual
  decomposition as historical etymology without a suitable source.
- Use original or clearly licensed story content.
- Validate each direction as a bounded experiment on desktop and phone before
  expanding it into a larger world.
