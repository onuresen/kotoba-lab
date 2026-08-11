# Data attribution

`kanjidic.json` and `jlpt-vocab.json` are derived from the **Kanjium** database
by Uros Ozvatic, licensed under
[**CC BY-SA 4.0**](https://creativecommons.org/licenses/by-sa/4.0/legalcode).
Only the `kanjidict`, `edict`, and `jukugo` tables were used (kanji readings/
meanings/stroke counts, and word readings/meanings/JLPT levels); everything
else in the original database (pitch accent, stroke-order images, radical
data, etc.) was not used.

Per the Kanjium license terms, the required acknowledgement:

> The pitch accent notation, verb particle data, phonetics, homonyms and other
> additions or modifications to EDICT, KANJIDIC or KRADFILE were provided by
> Uros Ozvatic through his free database.

The underlying dictionaries are the property of the **Electronic Dictionary
Research and Development Group (EDRDG)**, led by James William Breen:
[EDICT](http://www.csse.monash.edu.au/~jwb/edict.html) /
[KANJIDIC](http://www.csse.monash.edu.au/~jwb/kanjidic.html), used under the
[EDRDG license](http://www.edrdg.org/edrdg/licence.html). JLPT level data for
words comes from [Jonathan Waller](http://www.tanos.co.uk/).

As CC BY-SA 4.0 material, this derived data (and any further redistribution of
`kanjidic.json` / `jlpt-vocab.json`) remains under the same license.

## KanjiVG

`kanjivg.json` is extracted from **KanjiVG** by Ulrich Apel, release
**r20250816**, and is licensed separately under
[Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
The source project and its full license are available from the
[KanjiVG repository](https://github.com/KanjiVG/kanjivg).

Kotoba Lab extracts the ordered SVG stroke paths and the nested
`kvg:element` component hierarchy. Coordinates are rounded to one decimal place
and the result is packed into a compact JSON representation. This derived
artifact therefore remains under CC BY-SA 3.0; the rest of the dictionary data
described above remains under CC BY-SA 4.0.

## What was changed

- Extracted only: kanji → `{jlpt, strokes, on, kun, meaning}`; word → `{reading,
  meaning, jlpt}`.
- Meanings were cleaned (stripped part-of-speech tags and sense numbers,
  deduplicated, capped to a few senses) for concise display.
- `edict` (base/okurigana forms — verbs, adjectives, single-kanji readings) and
  `jukugo` (multi-kanji compounds) were merged into one word list, deduplicated
  by (surface, reading); `jukugo`'s one-row-per-component-kanji duplication was
  collapsed to one row per word.
- Katakana on-readings were converted to hiragana for consistent furigana
  rendering.
