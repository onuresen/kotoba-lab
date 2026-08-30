// writing.js — stroke-order practice: the grading, and nothing else.
//
// Kotoba Lab is otherwise entirely a recognition trainer. Radical Tree has
// always held every stroke of every kanji in order, as committed KanjiVG path
// data, and only ever replayed them. This module is what lets the learner draw
// them back.
//
// WHAT IT GRADES, AND WHAT IT REFUSES TO:
//   Order      — stroke N is graded against expected stroke N, and a wrong
//                stroke never advances, so the sequence is the exercise.
//   Direction  — a stroke drawn end-to-start is reported as reversed.
//   Placement  — where the stroke begins and ends, within a generous tolerance.
//   Count      — the session completes only when every stroke has been drawn.
//
//   NOT shape. Nothing here measures how closely the drawn line follows the
//   curve of the real one. That would be a similarity judgment, and the rest of
//   this application deliberately never makes one (see the phonetic-signal and
//   false-friend notes in AGENTS.md). Stroke order and direction are also the
//   part a learner actually gets wrong, and unlike shape they have one correct
//   answer that KanjiVG states outright.
//
// A stroke, expected or drawn, is just its two endpoints: { start:{x,y},
// end:{x,y} }. Extracting those from an SVG path is the caller's job — the
// overlay does it with getPointAtLength(), which is exact and needs no path
// parser — so everything here stays pure and testable under Node.
//
// Coordinates are KanjiVG's own 109x109 viewBox.

export const VIEW_BOX = 109;

// ~22% of the box. Deliberately generous: this grades which stroke you drew and
// which way round, not penmanship, and a fingertip on a phone is a blunt
// instrument. Tightening it would start failing correct strokes, which teaches
// nothing except that the tool is fussy.
export const DEFAULT_TOLERANCE = 24;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function third(value, size) {
  if (value < size / 3) return 0;
  if (value < (size * 2) / 3) return 1;
  return 2;
}

const ROWS = ['top', 'middle', 'bottom'];
const COLUMNS = ['left', 'centre', 'right'];

/**
 * Where a point sits, in words: "top left", "bottom right", "the centre".
 * A 3x3 reading of the box — enough to say what went wrong without implying
 * the grader measured anything finer than it did.
 */
export function describePoint(point, size = VIEW_BOX) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return 'somewhere else';
  const row = ROWS[third(point.y, size)];
  const column = COLUMNS[third(point.x, size)];
  if (row === 'middle' && column === 'centre') return 'the centre';
  if (row === 'middle') return `the ${column}`;
  if (column === 'centre') return `${row} centre`;
  return `${row} ${column}`;
}

/**
 * Grade one drawn stroke against the one expected here.
 *
 * Reversal is checked first and on relative distance rather than the tolerance,
 * so it is caught even on a stroke short enough that both ends sit inside one
 * tolerance circle — "you drew it backwards" is the single most useful thing
 * this can say, and it must not be swallowed by a near miss on placement.
 */
export function gradeStroke(expected, drawn, { tolerance = DEFAULT_TOLERANCE } = {}) {
  if (!expected || !drawn) return { ok: false, reason: 'missing' };
  const startError = distance(drawn.start, expected.start);
  const reversedError = distance(drawn.start, expected.end);
  if (reversedError < startError && distance(drawn.end, expected.start) < distance(drawn.end, expected.end)) {
    return {
      ok: false,
      reason: 'reversed',
      expectedAt: describePoint(expected.start),
      drawnAt: describePoint(drawn.start),
    };
  }
  if (startError > tolerance) {
    return {
      ok: false,
      reason: 'start',
      expectedAt: describePoint(expected.start),
      drawnAt: describePoint(drawn.start),
    };
  }
  if (distance(drawn.end, expected.end) > tolerance) {
    return {
      ok: false,
      reason: 'end',
      expectedAt: describePoint(expected.end),
      drawnAt: describePoint(drawn.end),
    };
  }
  return { ok: true, reason: null };
}

/** A short sentence for a verdict, phrased as a comparison rather than a score. */
export function explainStroke(verdict, order) {
  if (!verdict || verdict.ok) return `Stroke ${order} — yes.`;
  if (verdict.reason === 'reversed') return `Stroke ${order} runs the other way: it starts at ${verdict.expectedAt}.`;
  if (verdict.reason === 'start') return `Stroke ${order} starts at ${verdict.expectedAt}; yours started at ${verdict.drawnAt}.`;
  if (verdict.reason === 'end') return `Stroke ${order} ends at ${verdict.expectedAt}; yours ended at ${verdict.drawnAt}.`;
  return `Stroke ${order} could not be read.`;
}

export function createWritingSession(strokes, { element = '', tolerance = DEFAULT_TOLERANCE } = {}) {
  const list = (Array.isArray(strokes) ? strokes : []).filter(
    (stroke) => stroke?.start && stroke?.end,
  );
  if (!list.length) return null;
  return {
    element,
    strokes: list,
    tolerance,
    index: 0,
    misses: 0,
    hints: 0,
    // The verdict for every attempt, in order. Session-only: this never
    // reaches storage, a profile, or the usage journal.
    attempts: [],
  };
}

export function currentStroke(session) {
  return session?.strokes?.[session.index] || null;
}

/**
 * Answer with one drawn stroke.
 *
 * A miss does NOT advance. Committing a wrong stroke would leave the drawing
 * itself wrong from that point on, and the exercise is the order — so the
 * learner stays on the same stroke until it is right, or asks for a hint.
 */
export function answerWritingStroke(session, drawn) {
  const expected = currentStroke(session);
  if (!expected) return { session, verdict: null };
  const verdict = gradeStroke(expected, drawn, { tolerance: session.tolerance });
  const attempts = [...session.attempts, { order: session.index + 1, ...verdict }];
  if (!verdict.ok) return { session: { ...session, misses: session.misses + 1, attempts }, verdict };
  return { session: { ...session, index: session.index + 1, attempts }, verdict };
}

/** Give this stroke away and move on; counted, never hidden. */
export function revealWritingStroke(session) {
  if (!currentStroke(session)) return session;
  return {
    ...session,
    index: session.index + 1,
    hints: session.hints + 1,
    attempts: [...session.attempts, { order: session.index + 1, ok: false, reason: 'hint' }],
  };
}

export function undoWritingStroke(session) {
  if (!session || session.index === 0) return session;
  return { ...session, index: session.index - 1 };
}

export function restartWritingSession(session) {
  if (!session) return session;
  return { ...session, index: 0, misses: 0, hints: 0, attempts: [] };
}

export function writingProgress(session) {
  const total = session?.strokes?.length || 0;
  const done = session?.index || 0;
  return {
    done,
    total,
    current: total ? Math.min(done + 1, total) : 0,
    misses: session?.misses || 0,
    hints: session?.hints || 0,
    complete: total > 0 && done >= total,
    // Every stroke right first time and unaided. Reported, never scored: there
    // is no streak, no percentage, and nothing is kept after the overlay closes.
    clean: total > 0 && done >= total && !session.misses && !session.hints,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
