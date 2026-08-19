// false-friends.js — pure homophone-group construction and a small
// meaning-matching quiz question. The first bounded exhibit type of the
// "False-Friend Museum" idea in IDEA_GARDEN.md; no DOM, storage, or fetch.
//
// Every group's evidence is exact: every member shares the identical
// committed dictionary reading. No visual-similarity or semantic-closeness
// claim is made or needed, so the other three exhibit types IDEA_GARDEN.md
// describes stay unbuilt — deceptive shared components and near-synonym
// traps would require inventing a similarity/synonym judgment this app
// otherwise never makes, and similar-looking kanji is already served by the
// existing Kanji Contrast Lab (shared direct visual component).

// Multi-character words only — a bare single-kanji dictionary entry sharing
// an on'yomi with another is already the Kanji library's reading-family
// view; the confusion a "false friend" exhibit is worth showing is between
// actual vocabulary, the classic 取る/執る/捕る/採る kind of trap.
function distinctWords(vocab) {
  const seen = new Set();
  return (Array.isArray(vocab) ? vocab : []).filter((row) =>
    row?.w && row.r && row.g && [...row.w].length >= 2 && !seen.has(row.w) && seen.add(row.w));
}

export function buildHomophoneGroups(vocab, options = {}) {
  const minSize = Number.isInteger(options.minSize) ? options.minSize : 2;
  const maxSize = Number.isInteger(options.maxSize) ? options.maxSize : 4;
  const byReading = new Map();

  for (const row of distinctWords(vocab)) {
    if (!byReading.has(row.r)) byReading.set(row.r, []);
    byReading.get(row.r).push(row);
  }

  return [...byReading.entries()].map(([reading, members]) => {
    const meaningSeen = new Set();
    const rows = members.filter((row) => {
      const meaningKey = row.g.trim().toLocaleLowerCase('en');
      return meaningKey && !meaningSeen.has(meaningKey) && meaningSeen.add(meaningKey);
    }).slice(0, Math.max(minSize, maxSize));
    if (rows.length < minSize) return null;
    return {
      key: reading,
      reading,
      rows,
      gradedCount: rows.filter((row) => row.lvl != null).length,
    };
  }).filter(Boolean).sort((a, b) =>
    b.gradedCount - a.gradedCount
      || b.rows.length - a.rows.length
      || a.reading.localeCompare(b.reading, 'ja'));
}

// One meaning-matching question for an exhibit: "which word means X" among
// every member sharing this group's reading — reading itself can never be
// the clue here, since it is identical for all choices by construction.
export function homophoneQuestion(group, targetIndex = 0) {
  const target = group?.rows?.[targetIndex];
  if (!target) return null;
  const clue = target.g.split(';')[0].trim();
  return {
    clue,
    prompt: `Which word means "${clue}"? (all read ${group.reading})`,
    target,
    choices: group.rows,
  };
}

export function answerHomophoneQuestion(question, chosenSurface) {
  if (!question?.target) return null;
  return { correct: chosenSurface === question.target.w, chosen: chosenSurface, target: question.target.w };
}
