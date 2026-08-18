import test from 'node:test';
import assert from 'node:assert/strict';
import { tokensToKana, kanaToRomaji, tokensToRomaji } from './reading-forms.js';

test('tokensToKana substitutes dictionary/kana readings and passes through the rest', () => {
  const tokens = [
    { surface: '私', reading: 'わたし', kind: 'word' },
    { surface: 'は', reading: 'は', kind: 'kana' },
    { surface: '猫', reading: null, kind: 'kanji' }, // dictionary miss — never guessed
    { surface: '？', reading: null, kind: 'other' },
  ];
  assert.equal(tokensToKana(tokens), 'わたしは猫？');
});

test('kanaToRomaji converts plain monographs', () => {
  assert.equal(kanaToRomaji('あいうえお'), 'aiueo');
  assert.equal(kanaToRomaji('わたし'), 'watashi');
});

test('kanaToRomaji converts digraphs (yōon)', () => {
  assert.equal(kanaToRomaji('きょう'), 'kyou');
  assert.equal(kanaToRomaji('しゃしん'), 'shashin');
});

test('kanaToRomaji doubles the following consonant for っ', () => {
  assert.equal(kanaToRomaji('がっこう'), 'gakkou');
  assert.equal(kanaToRomaji('けっこん'), 'kekkon');
  assert.equal(kanaToRomaji('まっちゃ'), 'matcha');
});

test('kanaToRomaji disambiguates ん before a vowel or y with an apostrophe', () => {
  assert.equal(kanaToRomaji('けんい'), "ken'i");
  assert.equal(kanaToRomaji('ほんや'), "hon'ya");
  assert.equal(kanaToRomaji('げんき'), 'genki');
  assert.equal(kanaToRomaji('ほん'), 'hon');
});

test('kanaToRomaji extends the previous vowel for the chōonpu mark', () => {
  assert.equal(kanaToRomaji('コーヒー'), 'koohii');
  assert.equal(kanaToRomaji('スーパー'), 'suupaa');
});

test('kanaToRomaji converts katakana the same way as hiragana', () => {
  assert.equal(kanaToRomaji('アリガトウ'), 'arigatou');
});

test('kanaToRomaji passes through kanji, punctuation, and latin untouched', () => {
  assert.equal(kanaToRomaji('猫、cat！'), '猫、cat！');
});

test('tokensToRomaji chains token→kana→romaji', () => {
  const tokens = [
    { surface: '学校', reading: 'がっこう', kind: 'word' },
    { surface: 'に', reading: 'に', kind: 'kana' },
    { surface: '行く', reading: 'いく', kind: 'word' },
  ];
  assert.equal(tokensToRomaji(tokens), 'gakkou ni iku'.replace(/ /g, ''));
});
