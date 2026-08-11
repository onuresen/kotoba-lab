// aozora.test.js — run with: npm test  (or: node --test js/aozora.test.js)
//
// cleanAozora is a stack of order-dependent regexes over real-world markup, and
// its failure mode is silent: ruby text left inline shows up as garbage in the
// reading pane and pollutes every frequency count on the Analyze tab. Both
// functions here are pure — decodeBuffer needs only TextDecoder, which node has.

import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBuffer, cleanAozora } from './aozora.js';

// ---- decoding ---------------------------------------------------------------

test('UTF-8 is preferred and decoded as-is', () => {
  const utf8 = new TextEncoder().encode('日本語のテキスト');
  assert.equal(decodeBuffer(utf8), '日本語のテキスト');
});

test('Shift-JIS bytes fall back rather than becoming mojibake', () => {
  // 日本語 in Shift-JIS — invalid UTF-8, which is exactly what triggers the fallback.
  const sjis = new Uint8Array([0x93, 0xFA, 0x96, 0x7B, 0x8C, 0xEA]);
  assert.equal(decodeBuffer(sjis), '日本語');
});

test('an empty buffer decodes to an empty string', () => {
  assert.equal(decodeBuffer(new Uint8Array([])), '');
});

// ---- markup stripping -------------------------------------------------------

test('ruby annotations are stripped, leaving the base text', () => {
  assert.equal(cleanAozora('漢字《かんじ》を読む'), '漢字を読む');
});

test('the ｜ ruby-base delimiter is removed with its ruby', () => {
  assert.equal(cleanAozora('｜親譲《おやゆず》りの無鉄砲'), '親譲りの無鉄砲');
});

test('editor annotations go, in both full-width and half-width forms', () => {
  assert.equal(cleanAozora('本文［＃「本文」に傍点］です'), '本文です');
  assert.equal(cleanAozora('本文[#ここから2字下げ]です'), '本文です');
});

test('a stray gaiji marker left by annotation removal is cleaned up', () => {
  assert.equal(cleanAozora('文字※［＃「くの字点」、1-2-22］'), '文字');
});

test('CRLF is normalised and runs of blank lines collapse to one', () => {
  assert.equal(cleanAozora('一行目\r\n\r\n\r\n\r\n二行目'), '一行目\n\n二行目');
});

// ---- the header/colophon frame ----------------------------------------------

test('the Aozora header block between the first two rules is dropped', () => {
  const file = [
    '吾輩は猫である',
    '夏目漱石',
    '',
    '-------------------------------------------------------',
    '【テキスト中に現れる記号について】',
    '《》：ルビ',
    '-------------------------------------------------------',
    '',
    '吾輩は猫である。名前はまだ無い。',
  ].join('\n');

  const out = cleanAozora(file);
  assert.ok(out.includes('吾輩は猫である。名前はまだ無い。'), 'the prose survives');
  assert.ok(!out.includes('ルビ'), 'the header explanation is gone');
  assert.ok(!out.includes('---'), 'and so are the rule lines');
  assert.ok(out.startsWith('吾輩は猫である\n夏目漱石'), 'the title block above the rules is kept');
});

test('everything from the colophon onward is dropped', () => {
  const file = [
    '本文の最後の行。',
    '',
    '底本：「坊っちゃん」新潮文庫',
    '　　　1950（昭和25）年8月20日発行',
    '入力：石田',
    '校正：かとう',
  ].join('\n');

  const out = cleanAozora(file);
  assert.equal(out, '本文の最後の行。');
  assert.ok(!out.includes('入力'), 'the trailing credits go too, not just the 底本 line');
});

test('底本の親本 also starts the colophon', () => {
  assert.equal(cleanAozora('本文。\n底本の親本：「全集」\n入力：誰か'), '本文。');
});

// ---- realistic end-to-end ---------------------------------------------------

test('a full Aozora-shaped file comes out as clean prose', () => {
  const file = [
    '羅生門',
    '芥川龍之介',
    '',
    '-------------------------------------------------------',
    '【テキスト中に現れる記号について】',
    '｜：ルビの付く文字列の始まりを特定する記号',
    '-------------------------------------------------------',
    '',
    'ある日の暮方の事である。一人の｜下人《げにん》が、羅生門の下で雨やみを待っていた。',
    '［＃ここで字下げ終わり］',
    '広い門の下には、この男のほかに誰もいない。',
    '',
    '底本：「羅生門・鼻」新潮文庫',
    '入力：石田',
  ].join('\n');

  assert.equal(cleanAozora(file), [
    '羅生門',
    '芥川龍之介',
    '',
    'ある日の暮方の事である。一人の下人が、羅生門の下で雨やみを待っていた。',
    '',
    '広い門の下には、この男のほかに誰もいない。',
  ].join('\n'));
});

test('plain text with no Aozora markup passes through untouched', () => {
  const plain = '普通のテキストです。\n二行目もあります。';
  assert.equal(cleanAozora(plain), plain);
  assert.equal(cleanAozora(''), '');
});
