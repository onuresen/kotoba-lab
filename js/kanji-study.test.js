import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createKanjiStudySession,
  currentStudyCard,
  moveStudyCard,
  revealStudyCard,
  shuffleStudySession,
  studyProgress,
} from './kanji-study.js';

const family = {
  key: '水',
  label: '水 radical',
  rows: [{ char: '水' }, { char: '池' }, { char: '海' }, { char: '池' }],
};

test('a study session snapshots one copy of each family member', () => {
  const session = createKanjiStudySession(family, 'radical');
  assert.equal(session.label, '水 radical');
  assert.equal(session.mode, 'radical');
  assert.deepEqual(session.rows.map((row) => row.char), ['水', '池', '海']);
  assert.equal(currentStudyCard(session).char, '水');
});

test('empty or malformed families do not create a session', () => {
  assert.equal(createKanjiStudySession(null, 'radical'), null);
  assert.equal(createKanjiStudySession({ key: '水', rows: [] }, 'radical'), null);
});

test('revealing records progress once and moving resets the answer', () => {
  let session = createKanjiStudySession(family, 'radical');
  session = revealStudyCard(session);
  session = revealStudyCard(session);
  assert.deepEqual(studyProgress(session), { current: 1, total: 3, studied: 1, pct: 33, complete: false });
  session = moveStudyCard(session, 1);
  assert.equal(currentStudyCard(session).char, '池');
  assert.equal(session.revealed, false);
  assert.equal(session.studied.size, 1);
});

test('movement is clamped to the session boundaries', () => {
  let session = createKanjiStudySession(family, 'radical');
  session = moveStudyCard(session, -5);
  assert.equal(session.index, 0);
  session = moveStudyCard(session, 50);
  assert.equal(session.index, 2);
});

test('shuffle and restart changes order and clears progress', () => {
  let session = revealStudyCard(createKanjiStudySession(family, 'radical'));
  session = shuffleStudySession(session, () => 0);
  assert.deepEqual(session.rows.map((row) => row.char), ['池', '海', '水']);
  assert.equal(session.index, 0);
  assert.equal(session.revealed, false);
  assert.equal(session.studied.size, 0);
});
