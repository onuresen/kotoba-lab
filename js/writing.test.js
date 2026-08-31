// writing.test.js — run with: npm test
//
// The point of most of these is the boundary between what this module grades
// (order, direction, placement, count) and what it must never grade (shape).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TOLERANCE,
  VIEW_BOX,
  answerWritingStroke,
  createWritingSession,
  currentStroke,
  describePoint,
  explainStroke,
  gradeStroke,
  restartWritingSession,
  revealWritingStroke,
  undoWritingStroke,
  writingProgress,
} from './writing.js';

const at = (x, y) => ({ x, y });
const stroke = (x1, y1, x2, y2) => ({ start: at(x1, y1), end: at(x2, y2) });

// 二 — a top stroke then a longer bottom one, both left to right.
const NI = [stroke(20, 35, 88, 35), stroke(12, 78, 96, 78)];

// ---- describing a point -----------------------------------------------------

test('a point is described by where it sits in the box', () => {
  assert.equal(describePoint(at(10, 10)), 'top left');
  assert.equal(describePoint(at(100, 100)), 'bottom right');
  assert.equal(describePoint(at(54, 54)), 'the centre');
  assert.equal(describePoint(at(10, 54)), 'the left');
  assert.equal(describePoint(at(54, 10)), 'top centre');
  assert.equal(describePoint(at(100, 10)), 'top right');
});

test('a point that is not a point still describes itself safely', () => {
  assert.equal(describePoint(null), 'somewhere else');
  assert.equal(describePoint({ x: NaN, y: 0 }), 'somewhere else');
});

// ---- grading one stroke -----------------------------------------------------

test('a stroke drawn roughly right passes', () => {
  assert.equal(gradeStroke(NI[0], stroke(24, 39, 84, 30)).ok, true);
});

test('shape is deliberately not graded', () => {
  // A wild detour that starts and ends in the right places is accepted: this
  // module grades order and direction, and says so rather than pretending to
  // judge penmanship it cannot judge.
  assert.equal(gradeStroke(NI[0], stroke(20, 35, 88, 35)).ok, true);
});

test('a stroke drawn backwards is called backwards, not misplaced', () => {
  const verdict = gradeStroke(NI[0], stroke(88, 35, 20, 35));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, 'reversed');
  assert.equal(verdict.expectedAt, 'top left');
});

test('reversal is caught even on a stroke shorter than the tolerance', () => {
  // Both endpoints sit inside one tolerance circle, so a placement-only check
  // would happily accept it drawn either way round.
  const tiny = stroke(50, 50, 58, 58);
  assert.equal(gradeStroke(tiny, stroke(58, 58, 50, 50)).reason, 'reversed');
  assert.equal(gradeStroke(tiny, stroke(51, 49, 57, 59)).ok, true);
});

test('starting or ending in the wrong place is reported with both places', () => {
  const start = gradeStroke(NI[0], stroke(90, 95, 95, 90));
  assert.equal(start.reason, 'start');
  assert.equal(start.expectedAt, 'top left');
  assert.equal(start.drawnAt, 'bottom right');

  const end = gradeStroke(NI[0], stroke(20, 35, 30, 100));
  assert.equal(end.reason, 'end');
  assert.equal(end.expectedAt, 'top right');
});

test('the tolerance is configurable and actually applied', () => {
  const nudged = stroke(20 + DEFAULT_TOLERANCE - 2, 35, 88, 35);
  assert.equal(gradeStroke(NI[0], nudged).ok, true);
  assert.equal(gradeStroke(NI[0], nudged, { tolerance: 4 }).ok, false);
});

test('a missing stroke on either side is a verdict, not a crash', () => {
  assert.equal(gradeStroke(null, NI[0]).reason, 'missing');
  assert.equal(gradeStroke(NI[0], null).reason, 'missing');
});

test('every verdict has a sentence naming the stroke', () => {
  assert.match(explainStroke({ ok: true }, 1), /Stroke 1/);
  assert.match(explainStroke(gradeStroke(NI[0], stroke(88, 35, 20, 35)), 2), /other way/);
  assert.match(explainStroke(gradeStroke(NI[0], stroke(95, 95, 99, 90)), 3), /yours started at/);
});

// ---- a session --------------------------------------------------------------

test('a session walks the strokes in order', () => {
  let session = createWritingSession(NI, { element: '二' });
  assert.equal(writingProgress(session).total, 2);
  assert.equal(currentStroke(session), NI[0]);

  ({ session } = answerWritingStroke(session, stroke(21, 36, 86, 34)));
  assert.equal(session.index, 1);
  ({ session } = answerWritingStroke(session, stroke(13, 77, 95, 79)));
  const done = writingProgress(session);
  assert.equal(done.complete, true);
  assert.equal(done.clean, true);
});

test('a wrong stroke never advances — the order is the exercise', () => {
  let session = createWritingSession(NI);
  // The second stroke, drawn first.
  const { session: after, verdict } = answerWritingStroke(session, stroke(12, 78, 96, 78));
  assert.equal(verdict.ok, false);
  assert.equal(after.index, 0);
  assert.equal(after.misses, 1);
  assert.equal(currentStroke(after), NI[0]);
  // And the same stroke, drawn right, still moves on.
  ({ session } = answerWritingStroke(after, stroke(20, 35, 88, 35)));
  assert.equal(session.index, 1);
  assert.equal(session.misses, 1);
});

test('a completed session is not clean if it needed misses or hints', () => {
  let session = createWritingSession(NI);
  ({ session } = answerWritingStroke(session, stroke(90, 90, 95, 95)));
  ({ session } = answerWritingStroke(session, stroke(20, 35, 88, 35)));
  session = revealWritingStroke(session);
  const progress = writingProgress(session);
  assert.equal(progress.complete, true);
  assert.equal(progress.clean, false);
  assert.equal(progress.misses, 1);
  assert.equal(progress.hints, 1);
});

test('every attempt is recorded in order, hints included', () => {
  let session = createWritingSession(NI);
  ({ session } = answerWritingStroke(session, stroke(90, 90, 95, 95)));
  ({ session } = answerWritingStroke(session, stroke(20, 35, 88, 35)));
  session = revealWritingStroke(session);
  assert.deepEqual(session.attempts.map((a) => [a.order, a.ok, a.reason]), [
    [1, false, 'start'], [1, true, null], [2, false, 'hint'],
  ]);
});

test('undo steps back without pretending the miss never happened', () => {
  let session = createWritingSession(NI);
  ({ session } = answerWritingStroke(session, stroke(20, 35, 88, 35)));
  session = undoWritingStroke(session);
  assert.equal(session.index, 0);
  assert.equal(session.attempts.length, 1);
  assert.equal(undoWritingStroke(session).index, 0); // already at the start
});

test('restart clears the score but keeps the strokes', () => {
  let session = createWritingSession(NI, { element: '二' });
  ({ session } = answerWritingStroke(session, stroke(90, 90, 95, 95)));
  session = restartWritingSession(session);
  assert.deepEqual(writingProgress(session), {
    done: 0, total: 2, current: 1, misses: 0, hints: 0, complete: false, clean: false, pct: 0,
  });
  assert.equal(session.element, '二');
});

test('answering past the end is a no-op', () => {
  let session = createWritingSession([NI[0]]);
  ({ session } = answerWritingStroke(session, stroke(20, 35, 88, 35)));
  const { session: again, verdict } = answerWritingStroke(session, stroke(20, 35, 88, 35));
  assert.equal(verdict, null);
  assert.equal(again, session);
  assert.equal(revealWritingStroke(session), session);
});

test('a kanji with no usable strokes has no session', () => {
  assert.equal(createWritingSession([]), null);
  assert.equal(createWritingSession(null), null);
  assert.equal(createWritingSession([{ start: at(1, 1) }]), null); // no end point
  assert.equal(writingProgress(null).total, 0);
});

test('the tolerance is a fraction of KanjiVG own box, not a pixel count', () => {
  assert.equal(VIEW_BOX, 109);
  assert.ok(DEFAULT_TOLERANCE > 0 && DEFAULT_TOLERANCE < VIEW_BOX / 3);
});
