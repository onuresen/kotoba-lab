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
parked until real usage evidence identifies a study problem worth solving.

### Kanji Mystery Casebook

Identify a hidden kanji from structural, reading, stroke, JLPT, and vocabulary
clues by investigating through Relations and Radical Tree.

### Parallel Text Portal

Compare carefully authored versions of the same scene across simple,
conversational, literary, formal, and newspaper-like Japanese.

### The False-Friend Museum

Curate similar-looking kanji, deceptive shared components, homophones, and
near-synonym traps as returning comparison exhibits.

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

### Zen Study Room

Offer one distraction-free, explainable activity—sentence, family, mystery, or
short review set—selected from current local needs.

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
