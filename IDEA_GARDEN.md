# Kotoba Lab Idea Garden

This is a durable parking place for imaginative directions that should be
considered gradually, not a promise to build all of them. Each idea should earn
its place through a small experiment and real study use.

## First exploration track

These four directions were selected as the strongest personal favorites on
2026-08-14. The order below is the recommended implementation sequence, based
on shared foundations and increasing scope.

### 1. Radical Alchemy

Combine components to discover kanji, choose a missing component, reverse a
kanji into ingredients, or follow short alchemy chains. This is the smallest
high-impact experiment because it can reuse Radical Tree decomposition,
component coloring, KanjiVG, and existing family-study interactions.

First experiment: one daily five-question `component + component → kanji`
challenge with explainable answers and direct Radical Tree handoff.

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

## Remaining creative seeds

All of these remain worth revisiting after the first exploration track produces
real usage evidence.

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
