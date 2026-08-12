import { sentenceAt } from './context.js';

const pct = (value, total) => total ? Math.round((value / total) * 100) : 0;

export function buildTextJourney(kRows, tokens, catalog, isKnown, options = {}) {
  const limit = Number.isInteger(options.limit) ? options.limit : 6;
  const rows = Array.isArray(kRows) ? kRows : [];
  const allTokens = Array.isArray(tokens) ? tokens : [];
  const byChar = new Map((Array.isArray(catalog) ? catalog : []).map((row) => [row.char, row]));
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  const known = rows.reduce((sum, row) => sum + (isKnown?.(row.ch) ? row.n : 0), 0);

  const route = rows.filter((row) => !isKnown?.(row.ch)).map((row) => {
    const words = [];
    const wordSeen = new Set();
    const contexts = [];
    const contextSeen = new Set();
    allTokens.forEach((token, index) => {
      if (!token?.surface?.includes(row.ch) || !['word', 'kanji'].includes(token.kind)) return;
      if (!wordSeen.has(token.surface)) {
        wordSeen.add(token.surface);
        words.push({ surface: token.surface, reading: token.reading, gloss: token.gloss });
      }
      const context = sentenceAt(allTokens, index);
      if (context?.text && !contextSeen.has(context.text)) {
        contextSeen.add(context.text);
        contexts.push(context);
      }
    });
    return {
      ...byChar.get(row.ch),
      char: row.ch,
      occurrences: row.n,
      words: words.slice(0, 5),
      contexts: contexts.slice(0, 3),
    };
  }).sort((a, b) =>
    b.occurrences - a.occurrences
      || b.words.length - a.words.length
      || a.char.localeCompare(b.char, 'ja'))
    .slice(0, Math.max(0, limit));

  let unlocked = known;
  for (const item of route) {
    unlocked += item.occurrences;
    item.projectedPct = pct(unlocked, total);
  }
  return {
    route,
    totalOccurrences: total,
    knownOccurrences: known,
    currentPct: pct(known, total),
    projectedPct: pct(unlocked, total),
  };
}

export function createJourneySession(journey) {
  if (!journey?.route?.length) return null;
  return { route: [...journey.route], index: 0, revealed: false, visited: new Set() };
}

export function currentJourneyStep(session) {
  return session?.route?.[session.index] || null;
}

export function revealJourneyStep(session) {
  const item = currentJourneyStep(session);
  if (!item) return session;
  const visited = new Set(session.visited);
  visited.add(item.char);
  return { ...session, revealed: true, visited };
}

export function moveJourneyStep(session, step) {
  if (!session?.route?.length) return session;
  const index = Math.max(0, Math.min(session.route.length - 1, session.index + Number(step || 0)));
  return index === session.index ? session : { ...session, index, revealed: false };
}
