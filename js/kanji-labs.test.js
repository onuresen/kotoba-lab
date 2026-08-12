import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiCatalog, buildKanjiStructureIndex } from './kanji-browser.js';
import {
  answerPhoneticCard,
  buildPhoneticSignals,
  createPhoneticSession,
  phoneticCardMatches,
  phoneticScore,
} from './kanji-labs.js';

const rows = buildKanjiCatalog({
  清: { on: 'セイ、ショウ', meaning: 'pure' },
  晴: { on: 'セイ', meaning: 'clear weather' },
  精: { on: 'セイ、ショウ', meaning: 'refined' },
  情: { on: 'ジョウ、セイ', meaning: 'feeling' },
  請: { on: 'セイ、シン', meaning: 'request' },
  静: { on: 'セイ、ジョウ', meaning: 'quiet' },
  鯖: { on: 'セイ、ショウ', meaning: 'mackerel' },
  猜: { on: 'サイ', meaning: 'envy' },
  池: { on: 'チ', meaning: 'pond' },
});

const structure = buildKanjiStructureIndex({
  elements: ['青', '氵', '日', '米', '忄', '言', '争', '魚', '犭'],
  kanji: {
    清: [[], [1, 0]], 晴: [[], [2, 0]], 精: [[], [3, 0]], 情: [[], [4, 0]],
    請: [[], [5, 0]], 静: [[], [0, 6]], 鯖: [[], [7, 0]], 猜: [[], [8, 0]],
    池: [[], [1]],
  },
});

test('phonetic signals rank a dominant on-reading with visible evidence', () => {
  const signals = buildPhoneticSignals(rows, structure);
  const blue = signals.find((signal) => signal.component === '青');
  assert.equal(blue.label, '青 → セイ');
  assert.equal(blue.confidence, 88);
  assert.deepEqual(blue.matches.map((row) => row.char), ['情', '晴', '清', '精', '請', '静', '鯖']);
  assert.deepEqual(blue.exceptions.map((row) => row.char), ['猜']);
});

test('weak components are excluded until evidence is useful', () => {
  const signals = buildPhoneticSignals(rows, structure);
  assert.equal(signals.some((signal) => signal.component === '氵'), false);
  assert.equal(buildPhoneticSignals(rows, structure, { minReadable: 2, minMatches: 1 }).some((signal) => signal.component === '氵'), true);
});

test('signals below fifty percent are not presented as predictions', () => {
  const noisyRows = buildKanjiCatalog({
    甲: { on: 'コウ' }, 乙: { on: 'オツ' }, 丙: { on: 'ヘイ' }, 丁: { on: 'テイ' }, 戊: { on: 'ボ' },
  });
  const noisyStructure = buildKanjiStructureIndex({
    elements: ['共'], kanji: { 甲: [[], [0]], 乙: [[], [0]], 丙: [[], [0]], 丁: [[], [0]], 戊: [[], [0]] },
  });
  assert.equal(buildPhoneticSignals(noisyRows, noisyStructure, { minMatches: 1 }).length, 0);
  assert.equal(buildPhoneticSignals(noisyRows, noisyStructure, { minMatches: 1, minConfidence: 0 }).length, 1);
});

test('prediction answers score matches and exceptions', () => {
  const signal = buildPhoneticSignals(rows, structure).find((item) => item.component === '青');
  let session = createPhoneticSession({ ...signal, rows: [signal.matches[0], signal.exceptions[0]] });
  assert.equal(phoneticCardMatches(session), true);
  session = answerPhoneticCard(session, true);
  session = { ...session, index: 1, revealed: false };
  assert.equal(phoneticCardMatches(session), false);
  session = answerPhoneticCard(session, true);
  assert.deepEqual(phoneticScore(session), { answered: 2, correct: 1 });
  assert.equal(session.studied.size, 2);
});
