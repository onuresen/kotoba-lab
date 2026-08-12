// app.js — orchestration: load data once, tokenize once, render both tabs.
// The Analyze and Read views are two projections of the SAME tokenizer pass.

import { createTokenizer } from './tokenizer.js';
import { loadKuromojiTokenizer } from './tokenizer-kuromoji.js';
import { createJlpt, LEVELS, levelName, levelSlug } from './jlpt.js';
import { kanjiStats, wordStats, charMix, readability, coverage } from './analyze.js';
import { renderReading, applyKnownClasses } from './read.js';
import { pickStudyWords, toTSV, download } from './flashcards.js';
import { readAozoraFile } from './aozora.js';
import { createKnownSet, createDeck, createReviewLog } from './storage.js';
import { serializeBackup, backupFilename, parseBackup, mergeState, describeMerge } from './backup.js';
import { sentenceAt, contextParts } from './context.js';
import {
  buildTextJourney,
  createJourneySession,
  currentJourneyStep,
  moveJourneyStep,
  revealJourneyStep,
} from './text-journey.js';
import { isKanji } from './script.js';
import { createKanjiTree } from './kanjitree.js';
import {
  buildKanjiCatalog,
  buildKanjiFamilies,
  buildKanjiStructureIndex,
  filterKanji,
  groupKanji,
  isFamilyMode,
  isStructureFamilyMode,
} from './kanji-browser.js';
import {
  createKanjiStudySession,
  currentStudyCard,
  moveStudyCard,
  revealStudyCard,
  shuffleStudySession,
  studyProgress,
} from './kanji-study.js';
import {
  answerContrastCard,
  answerPhoneticCard,
  buildContrastSets,
  buildPhoneticSignals,
  contrastQuestion,
  contrastScore,
  createContrastSession,
  createPhoneticSession,
  phoneticCardMatches,
  phoneticScore,
} from './kanji-labs.js';
import {
  newCard, cardOf, isNew, schedule, preview, formatWait,
  buildQueue, queueStats, GRADES, GRADE_LABELS,
} from './srs.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let jlpt, samples = [];
let vocabList = [];
let dictTokenizer = null;   // instant default (dictionary longest-match)
let kuromojiTokenizer = null; // lazily loaded on demand
let tokenizer = null;       // the active one
let current = null; // { tokens, kStats, wStats }
let kanjiTree = null;
let kanjiVGPromise = null;
let kanjiCatalog = [];
let kanjiStructureIndex = null;
let kanjiStructurePromise = null;
let kanjiStructureError = '';
let kanjiBrowseLimit = 60;
let kanjiBrowseFamily = '';
let kanjiBrowseActiveFamily = null;
let kanjiStudySession = null;
let textJourney = null;
let textJourneySession = null;
const kanjiBrowseLevels = new Set();

// persisted, personal — survive across sessions in this browser only
const knownWords = createKnownSet('known-words');
const knownKanji = createKnownSet('known-kanji');
const deck = createDeck('deck');
const reviewLog = createReviewLog('review-log');
const isKnown = { word: (s) => knownWords.has(s), kanji: (c) => knownKanji.has(c) };

// review session state — rebuilt from the deck after every answer
let queue = [];
let revealed = false;
let sessionCount = 0;
let lastAnswered = null; // keeps the card you just graded from reappearing at once

// ---- data load --------------------------------------------------------------
// Without ui-base.css every design token goes undefined and the app renders in
// unstyled browser defaults — working, but bare, with nothing to say why. Probe
// for a token only that file defines. Module scripts execute after pending
// stylesheets resolve, so by now the CSS has either loaded or failed.
function checkTheme() {
  if (getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim()) return;
  const el = $('#style-warning');
  el.innerHTML = `
    <strong>The stylesheet didn't load — the page is running, but unstyled.</strong>
    <p><code>ui-base.css</code> and <code>palettes/washi-sumi.css</code> are this folder's own
    copies of the shared ui-system styles. If either is missing or unreachable, every design
    token goes undefined and the browser falls back to plain defaults.</p>
    <p>Restore them from <code>ui-system/</code> — <code>ui-base.css</code> next to this page and
    the palette under <code>palettes/</code>.</p>`;
  el.hidden = false;
}

async function boot() {
  checkTheme();
  try {
    const [kanjiData, vocabData, sampleData] = await Promise.all([
      fetch('data/kanjidic.json').then((r) => r.json()),
      fetch('data/jlpt-vocab.json').then((r) => r.json()),
      fetch('data/samples.json').then((r) => r.json()),
    ]);
    jlpt = createJlpt(kanjiData.kanji);
    kanjiCatalog = buildKanjiCatalog(kanjiData.kanji);
    vocabList = vocabData.vocab;
    dictTokenizer = createTokenizer(vocabList);
    tokenizer = dictTokenizer;
    samples = sampleData.samples || [];
    kanjiTree = createKanjiTree({
      loadData: loadKanjiVG,
      kanjiInfo: (ch) => jlpt.kanjiInfo(ch),
      isKnown: (ch) => knownKanji.has(ch),
      toggleKnown: (ch) => knownKanji.toggle(ch),
      onKnownChange: (_ch, known) => {
        toast(known ? 'Marked known.' : 'Unmarked.', 'success');
        refreshKnownEverywhere();
      },
      onError: (message) => toast(message, 'error'),
    });
  } catch (err) {
    // We're running, so the module loaded — this is the data files, not file://.
    $('#input').value = '';
    $('#boot-warning').innerHTML = `
      <strong>Couldn't load the dictionary data.</strong>
      <p><code>data/kanjidic.json</code>, <code>data/jlpt-vocab.json</code> and
      <code>data/samples.json</code> must sit next to this page and be reachable over
      http. Check the browser console for the failing request.</p>`;
    toast('Could not load data files — see the message above.', 'error');
    console.error(err);
    return;
  }
  $('#boot-warning').hidden = true; // scripts and data are both alive
  renderSampleChips();
  wireUi();
  renderKanjiBrowser();
  renderMyWords();
  refreshReview();
  if (samples[0]) { $('#input').value = samples[0].text; run(); }
}

// Lazy and retryable: the 5.84 MB generated asset is fetched only when a
// doorway asks for it. A failed first attempt does not poison later retries.
function loadKanjiVG() {
  if (!kanjiVGPromise) {
    kanjiVGPromise = fetch('data/kanjivg.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load KanjiVG data (HTTP ${response.status}).`);
        return response.json();
      })
      .catch((error) => {
        kanjiVGPromise = null;
        throw error;
      });
  }
  return kanjiVGPromise;
}

// Radical/component browsing needs only a compact membership index. Keep the
// much larger stroke-path artifact lazy until a Radical Tree is actually opened.
function loadKanjiStructureIndex() {
  if (kanjiStructureIndex) return Promise.resolve(kanjiStructureIndex);
  if (!kanjiStructurePromise) {
    kanjiStructurePromise = fetch('data/kanji-families.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load kanji family data (HTTP ${response.status}).`);
        return response.json();
      })
      .then((data) => {
        kanjiStructureIndex = buildKanjiStructureIndex(data);
        kanjiStructureError = '';
        return kanjiStructureIndex;
      })
      .catch((error) => {
        kanjiStructurePromise = null;
        kanjiStructureError = error.message;
        throw error;
      });
  }
  return kanjiStructurePromise;
}

// ---- main pipeline ----------------------------------------------------------
function run() {
  const text = $('#input').value;
  $('#charcount').textContent = `${[...text].length} chars`;
  if (!text.trim()) { current = null; showEmpty(); return; }

  const tokens = tokenizer.tokenize(text);
  const kStats = kanjiStats(text, jlpt);
  const wStats = wordStats(tokens);
  current = { tokens, kStats, wStats };
  textJourneySession = null;
  textJourney = buildTextJourney(kStats.rows, tokens, kanjiCatalog, (char) => knownKanji.has(char));

  renderReadability(readability(text, kStats));
  renderOverview(charMix(text), kStats, wStats);
  renderDist('#kanji-dist', kStats.byLevel, kStats.ungraded, kStats.totalKanji, 'kanji');
  renderCoverage(kStats, wStats);
  renderTextJourney();
  renderTable('#kanji-tbody', kStats.rows.slice(0, 60), 'kanji', kStats.uniqueKanji);
  renderTable('#word-tbody', wStats.rows.slice(0, 60), 'word', wStats.uniqueWords);

  renderReading($('#reading'), tokens, jlpt, showInfo, isKnown);
  $('#info').innerHTML = infoHint();
}

function renderCoverage(kStats, wStats) {
  const w = coverage(wStats.rows, (r) => r.surface, isKnown.word);
  const k = coverage(kStats.rows, (r) => r.ch, isKnown.kanji);
  const bar = (label, c) => `
    <div class="cov-row">
      <span class="cov-label">${label}</span>
      <div class="cov-bar"><span class="cov-fill" style="width:${c.pct}%"></span></div>
      <span class="cov-pct">${c.pct}%</span>
    </div>`;
  $('#coverage').innerHTML = (knownWords.count() || knownKanji.count())
    ? bar('Words you know', w) + bar('Kanji you know', k)
    : `<p class="hint">Mark words/kanji "known" in the Read tab to see how much of a text you already have.</p>`;
}

// ---- Analyze tab renderers --------------------------------------------------
function renderReadability(r) {
  $('#readability').innerHTML = `
    <div class="read-score">
      <div class="score-num">${r.score}<span>/100</span></div>
      <div class="score-band">
        <strong>${esc(r.band.label)}</strong>
        <span class="badge" data-status="reference">${esc(r.band.jlpt)}</span>
      </div>
    </div>
    <div class="read-metrics">
      <div><span>${r.metrics.kanjiRatio}%</span>kanji density</div>
      <div><span>${r.metrics.avgSentenceLen}</span>avg sentence (chars)</div>
      <div><span>${r.metrics.sentences}</span>sentences</div>
      <div><span>${r.metrics.avgKanjiDifficulty}</span>avg kanji rarity /6</div>
    </div>
    <p class="hint">Heuristic estimate from kanji density, sentence length, and kanji rarity — a guide, not an official JLPT verdict.</p>`;
}

function renderOverview(mix, kStats, wStats) {
  const cell = (n, label) => `<div class="stat"><span class="stat-num">${n}</span><span class="stat-label">${label}</span></div>`;
  $('#overview').innerHTML =
    cell(mix.total, 'total chars') +
    cell(kStats.totalKanji, 'kanji') +
    cell(kStats.uniqueKanji, 'unique kanji') +
    cell(mix.kana, 'kana') +
    cell(wStats.uniqueWords, 'unique words');
}

function renderDist(sel, byLevel, ungraded, total, kind) {
  if (!total) { $(sel).innerHTML = ''; return; }
  const segs = LEVELS.map((l) => ({ slug: 'n' + l, name: 'N' + l, n: byLevel[l] }))
    .concat([{ slug: 'ungraded', name: '—', n: ungraded }])
    .filter((s) => s.n > 0);
  const bar = segs.map((s) =>
    `<span class="seg jlpt-${s.slug}" style="flex:${s.n}" title="${s.name}: ${s.n}"></span>`).join('');
  const legend = segs.map((s) =>
    `<span class="lg"><i class="sw jlpt-${s.slug}"></i>${s.name} <b>${Math.round((s.n / total) * 100)}%</b></span>`).join('');
  $(sel).innerHTML = `<div class="dist-bar">${bar}</div><div class="dist-legend">${legend}</div>`;
}

function renderTable(sel, rows, kind, totalUnique) {
  if (!rows.length) { $(sel).innerHTML = `<tr><td colspan="4" class="hint">No ${kind}s found.</td></tr>`; return; }
  $(sel).innerHTML = rows.map((r, i) => {
    const head = kind === 'kanji' ? esc(r.ch) : esc(r.surface);
    const reading = kind === 'word' ? esc(r.reading || '') : '';
    const lvl = r.level;
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td class="jp"><span class="jlpt-${levelSlug(lvl)} chip">${head}</span>${reading ? `<span class="rd">${reading}</span>` : ''}</td>
      <td class="num">${r.n}</td>
      <td><span class="badge" data-status="${lvl == null ? 'archive' : 'reference'}">${levelName(lvl)}</span></td>
    </tr>`;
  }).join('') + (totalUnique > rows.length
    ? `<tr><td colspan="4" class="hint">…and ${totalUnique - rows.length} more unique ${kind}s</td></tr>` : '');
}

// ---- Read tab: info panel ---------------------------------------------------
function infoHint() {
  return `<div class="empty-state"><span class="e-icon">☝</span><div class="e-title">Tap any kanji or word</div><div class="e-sub">Readings and JLPT level appear here.</div></div>`;
}
let lastSel = null; // the currently-inspected kanji/word, for the action buttons

function knownBtn(known) {
  return `<button class="btn btn-ghost act-known" data-known="${known}">${known ? '✓ Known' : 'Mark known'}</button>`;
}
function saveBtn(saved) {
  return `<button class="btn ${saved ? '' : 'btn-ghost'} act-save" data-saved="${saved}">${saved ? '★ Saved' : '☆ Save'}</button>`;
}

function showInfo(sel) {
  lastSel = sel;
  if (sel.type === 'kanji') {
    const info = jlpt.kanjiInfo(sel.ch);
    $('#info').innerHTML = `
      <div class="info-head"><span class="info-glyph jlpt-${levelSlug(sel.level)}">${esc(sel.ch)}</span>
        <span class="badge" data-status="${sel.level == null ? 'archive' : 'reference'}">${levelName(sel.level)}</span></div>
      ${info?.meaning ? `<p class="info-gloss">${esc(info.meaning)}</p>` : ''}
      ${info?.on || info?.kun ? `<div class="info-yomi">
        ${info.on ? `<div><span class="label">On'yomi</span>${esc(info.on)}</div>` : ''}
        ${info.kun ? `<div><span class="label">Kun'yomi</span>${esc(info.kun)}</div>` : ''}
      </div>` : ''}
      ${info?.strokes ? `<p class="hint">${info.strokes} strokes</p>` : ''}
      ${!info ? `<p class="hint">Not in the kanji dictionary (very rare character).</p>` : ''}
      <div class="info-actions">${knownBtn(knownKanji.has(sel.ch))}</div>`;
  } else {
    const kanjiChars = [...new Set([...sel.surface].filter(isKanji))];
    $('#info').innerHTML = `
      <div class="info-head"><span class="info-word">${esc(sel.surface)}</span>
        <span class="badge" data-status="${sel.level == null ? 'archive' : 'reference'}">${levelName(sel.level)}</span></div>
      ${sel.reading ? `<p class="info-reading">${esc(sel.reading)}</p>` : ''}
      ${sel.gloss ? `<p class="info-gloss">${esc(sel.gloss)}</p>` : ''}
      <p class="hint">${sel.level == null
        ? 'Not in the vocab seed — segmented by script run, so no reading/meaning.'
        : 'Dictionary word, JLPT ' + levelName(sel.level) + '.'}</p>
      <div class="info-actions">${knownBtn(knownWords.has(sel.surface))}${saveBtn(deck.has(sel.surface))}</div>
      ${kanjiChars.length ? `<div class="info-kchars">
        <span class="label">Kanji in this word</span>
        <div class="chips">${kanjiChars.map((c) => `<span class="k jlpt-${levelSlug(jlpt.kanjiLevel(c))} info-kchar" data-k="${esc(c)}" data-kanji-tree="${esc(c)}" role="button" tabindex="0" aria-label="Open radical tree for ${esc(c)}">${esc(c)}</span>`).join('')}</div>
      </div>` : ''}`;
  }
}

function onInfoAction(e) {
  const kChar = e.target.closest('.info-kchar');
  if (kChar) {
    // Radical-tree chips are handled by the delegated doorway below. Keeping
    // this panel intact gives the overlay a stable element to restore focus to.
    if (kChar.dataset.kanjiTree) return;
    const ch = kChar.dataset.k;
    showInfo({ type: 'kanji', ch, level: jlpt.kanjiLevel(ch) });
    return;
  }
  const knownEl = e.target.closest('.act-known');
  const saveEl = e.target.closest('.act-save');
  if (!knownEl && !saveEl) return;
  if (!lastSel) return;

  if (knownEl) {
    const isK = lastSel.type === 'kanji' ? knownKanji : knownWords;
    const key = lastSel.type === 'kanji' ? lastSel.ch : lastSel.surface;
    const now = isK.toggle(key);
    toast(now ? 'Marked known.' : 'Unmarked.', 'success');
  } else if (saveEl && lastSel.type === 'word') {
    // The sentence is only recoverable here, while the text that produced this
    // token is still the one on screen — so it is captured at save time, not
    // looked up later.
    const ctx = current && Number.isInteger(lastSel.index)
      ? sentenceAt(current.tokens, lastSel.index)
      : null;
    const now = deck.toggle({
      surface: lastSel.surface, reading: lastSel.reading, gloss: lastSel.gloss,
      level: lastSel.level, srs: newCard(),
      ...(ctx ? { sentence: ctx.text, sentenceStart: ctx.start, sentenceEnd: ctx.end } : {}),
    });
    toast(now
      ? (ctx ? 'Saved with its sentence — due for review now.' : 'Saved to deck — due for review now.')
      : 'Removed from deck.', 'success');
  }
  showInfo(lastSel); // refresh button state
  refreshKnownEverywhere();
}

// Call after any known/saved-state mutation: re-tints the reading view,
// refreshes the coverage meter (from already-computed stats, no re-tokenize),
// and refreshes the My Words tab.
function refreshKnownEverywhere() {
  if (current) {
    applyKnownClasses($('#reading'), isKnown);
    renderCoverage(current.kStats, current.wStats);
    if (!textJourneySession) {
      textJourney = buildTextJourney(current.kStats.rows, current.tokens, kanjiCatalog, (char) => knownKanji.has(char));
    }
    renderTextJourney();
  }
  renderMyWords();
  renderKanjiBrowser();
  refreshReview();
}

function journeyWords(item) {
  return item.words.length
    ? item.words.map((word) => `<li><strong>${esc(word.surface)}</strong>${word.reading ? ` · ${esc(word.reading)}` : ''}${word.gloss ? ` · ${esc(word.gloss)}` : ''}</li>`).join('')
    : '<li>No dictionary word match in this tokenizer pass.</li>';
}

function renderTextJourney(focusAction = '') {
  const root = $('#text-journey-content');
  if (!root) return;
  if (!current || !textJourney) {
    root.innerHTML = '<p class="hint">Paste Japanese text to build a personal study route.</p>';
    return;
  }
  if (!textJourney.route.length) {
    root.innerHTML = `<div class="journey-complete"><strong>Every kanji in this text is already marked known.</strong><button type="button" class="btn btn-primary" data-journey-action="reread">Reread the text</button></div>`;
    return;
  }
  if (!textJourneySession) {
    root.innerHTML = `<div class="journey-overview">
      <div><span class="eyebrow">Temporary route · ${textJourney.route.length} kanji</span><h3>${textJourney.currentPct}% → ${textJourney.projectedPct}% kanji coverage</h3><p class="hint">Ordered by occurrences unlocked in this text. Nothing is stored unless you mark a kanji known.</p></div>
      <div class="journey-route">${textJourney.route.map((item, index) => `<div class="journey-stop"><span>${index + 1}</span><strong>${esc(item.char)}</strong><small>${item.occurrences} occurrence${item.occurrences === 1 ? '' : 's'} · ${item.projectedPct}%</small></div>`).join('')}</div>
      <button type="button" class="btn btn-primary" data-journey-action="start">Start this journey</button>
    </div>`;
    return;
  }
  const item = currentJourneyStep(textJourneySession);
  const final = textJourneySession.index === textJourneySession.route.length - 1;
  const known = knownKanji.has(item.char);
  root.innerHTML = `<div class="journey-head"><div><span class="eyebrow">Step ${textJourneySession.index + 1} of ${textJourneySession.route.length}</span><h3>${esc(item.char)} · unlocks ${item.occurrences} occurrence${item.occurrences === 1 ? '' : 's'}</h3></div><button type="button" class="btn btn-ghost" data-journey-action="close">Close journey</button></div>
    <div class="journey-stage">
      <div class="journey-glyph jlpt-${levelSlug(item.jlpt)}">${esc(item.char)}</div>
      <p>${textJourneySession.revealed ? esc(item.meaning || 'Meaning unavailable') : 'Recall the meaning, readings, and words from your text.'}</p>
      <div class="journey-detail" ${textJourneySession.revealed ? '' : 'hidden'}>
        <div><span class="label">Readings</span><strong>${esc([item.on, item.kun].filter(Boolean).join(' · ') || '—')}</strong></div>
        <div><span class="label">Words in this text</span><ul>${journeyWords(item)}</ul></div>
        ${item.contexts.length ? `<div><span class="label">Original context</span>${item.contexts.map((context) => `<blockquote>${esc(context.text)}</blockquote>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="journey-actions">
      <button type="button" class="btn btn-ghost" data-journey-action="previous" ${textJourneySession.index === 0 ? 'disabled' : ''}>← Previous</button>
      <button type="button" class="btn btn-primary" data-journey-action="reveal" ${textJourneySession.revealed ? 'disabled' : ''}>${textJourneySession.revealed ? 'Revealed' : 'Reveal from text'}</button>
      <button type="button" class="btn btn-ghost" data-journey-action="known">${known ? '✓ Known' : 'Mark known'}</button>
      <button type="button" class="btn btn-ghost" data-kanji-tree="${esc(item.char)}">Open Radical Tree</button>
      ${final && textJourneySession.revealed
        ? '<button type="button" class="btn btn-primary" data-journey-action="reread">Reread text →</button>'
        : `<button type="button" class="btn btn-ghost" data-journey-action="next" ${final ? 'disabled' : ''}>Next →</button>`}
    </div>`;
  if (focusAction) root.querySelector(`[data-journey-action="${focusAction}"]`)?.focus();
}

function onTextJourneyAction(event) {
  const button = event.target.closest('[data-journey-action]');
  if (!button) return;
  const action = button.dataset.journeyAction;
  if (action === 'start') textJourneySession = createJourneySession(textJourney);
  else if (action === 'close') textJourneySession = null;
  else if (action === 'reveal') textJourneySession = revealJourneyStep(textJourneySession);
  else if (action === 'previous' || action === 'next') textJourneySession = moveJourneyStep(textJourneySession, action === 'previous' ? -1 : 1);
  else if (action === 'known') {
    const item = currentJourneyStep(textJourneySession);
    const known = knownKanji.toggle(item.char);
    toast(known ? 'Marked known.' : 'Unmarked.', 'success');
    refreshKnownEverywhere();
    renderTextJourney('known');
    return;
  } else if (action === 'reread') {
    switchTab('read');
    $('#reading').focus?.();
    return;
  }
  renderTextJourney(action === 'start' || action === 'next' || action === 'previous' ? 'reveal' : action === 'reveal' ? (textJourneySession.index === textJourneySession.route.length - 1 ? 'reread' : 'next') : 'start');
}

// ---- Kanji tab -------------------------------------------------------------
function kanjiCard(item) {
  const level = levelName(item.jlpt);
  const reading = [item.on && `On ${item.on}`, item.kun && `Kun ${item.kun}`].filter(Boolean).join(' · ');
  const known = knownKanji.has(item.char);
  const aria = `Open ${item.char} — ${item.meaning || 'meaning unavailable'}, ${level}, ${item.strokes} strokes`;
  return `<button type="button" class="kanji-card jlpt-${levelSlug(item.jlpt)}" data-kanji-tree="${esc(item.char)}" data-known="${known}" aria-label="${esc(aria)}">
    <span class="kanji-card-glyph">${esc(item.char)}</span>
    <span class="kanji-card-copy">
      <strong>${esc(item.meaning || 'Meaning unavailable')}</strong>
      <span class="kanji-card-reading">${esc(reading || 'No readings listed')}</span>
      <span class="kanji-card-meta">${item.strokes} strokes${known ? ' · ✓ Known' : ''}</span>
    </span>
    <span class="badge" data-status="${item.jlpt == null ? 'archive' : 'reference'}">${level}</span>
  </button>`;
}

function renderKanjiStudy(focusAction = '') {
  const workspace = $('#kanji-study-workspace');
  if (!workspace) return;
  const studying = !!kanjiStudySession;
  workspace.hidden = !studying;
  $('#kanji-results-head').hidden = studying;
  $('#kanji-results').hidden = studying;
  if (!studying) return;
  $('#kanji-more').hidden = true;

  const item = currentStudyCard(kanjiStudySession);
  const progress = studyProgress(kanjiStudySession);
  const known = knownKanji.has(item.char);
  const knownCount = kanjiStudySession.rows.filter((row) => knownKanji.has(row.char)).length;
  const level = levelName(item.jlpt);
  const phonetic = kanjiStudySession.kind === 'phonetic';
  const contrast = kanjiStudySession.kind === 'contrast';
  const phoneticAnswer = phonetic ? kanjiStudySession.answers.get(item.char) : null;
  const contrastPrompt = contrast ? contrastQuestion(kanjiStudySession) : null;
  const contrastAnswer = contrast ? kanjiStudySession.answers.get(item.char) : null;
  const score = phonetic ? phoneticScore(kanjiStudySession) : contrast ? contrastScore(kanjiStudySession) : null;
  workspace.innerHTML = `
    <div class="kanji-study-head">
      <div><span class="eyebrow">${contrast ? 'Contrast Lab' : phonetic ? 'Phonetic Component Lab' : 'Family study'}</span><h3>${esc(kanjiStudySession.label)}</h3></div>
      <button type="button" class="btn btn-ghost" data-kanji-study-action="close">Close study</button>
    </div>
    <div class="kanji-study-status">
      <span>Card ${progress.current.toLocaleString()} of ${progress.total.toLocaleString()}</span>
      <span>${phonetic || contrast ? `${score.correct.toLocaleString()} of ${score.answered.toLocaleString()} ${phonetic ? 'predictions' : 'distinctions'} correct · ` : `${progress.studied.toLocaleString()} studied · `}${knownCount.toLocaleString()} known</span>
    </div>
    <div class="kanji-study-progress" role="progressbar" aria-label="Family study progress" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.studied}"><span style="width:${progress.pct}%"></span></div>
    <div class="kanji-study-stage">
      <div class="kanji-study-prompt">
        <span class="badge" data-status="reference">${esc(phonetic || contrast ? `${kanjiStudySession.component} component` : kanjiStudySession.label)}</span>
        <span class="kanji-study-glyph jlpt-${levelSlug(item.jlpt)}">${esc(contrast ? kanjiStudySession.component : item.char)}</span>
        <p>${contrast
          ? esc(contrastPrompt.prompt)
          : phonetic
          ? `Prediction: does this kanji use the signal reading ${esc(kanjiStudySession.reading)}?`
          : progress.complete ? 'Family pass complete. Review freely or shuffle and restart.' : 'Recall this kanji’s meaning and readings, then reveal the answer.'}</p>
        ${contrast && !kanjiStudySession.revealed ? `<div class="kanji-contrast-choices" role="group" aria-label="Kanji choices">
          ${kanjiStudySession.rows.map((row) => `<button type="button" class="btn kanji-contrast-choice" data-kanji-study-choice="${esc(row.char)}">${esc(row.char)}</button>`).join('')}
        </div>` : ''}
      </div>
      <div class="kanji-study-answer" ${kanjiStudySession.revealed ? '' : 'hidden'}>
        ${phonetic ? `<div class="kanji-signal-verdict" data-correct="${phoneticAnswer?.correct}">
          <span class="label">Pattern result</span><strong>${phoneticCardMatches(kanjiStudySession) ? `Yes — includes ${esc(kanjiStudySession.reading)}` : `Exception — different listed reading`}</strong>
          <p>${phoneticAnswer?.correct ? 'Your prediction was correct.' : `Your prediction was ${phoneticAnswer ? 'incorrect' : 'not recorded'}.`}</p>
        </div>` : ''}
        ${contrast ? `<div class="kanji-signal-verdict" data-correct="${contrastAnswer?.correct}">
          <span class="label">Distinction result</span><strong>${contrastAnswer?.correct ? `Correct — ${esc(item.char)}` : `Not quite — the answer is ${esc(item.char)}`}</strong>
          <p>${contrastPrompt.type === 'on-reading' ? `Listed on’yomi: ${esc(contrastPrompt.clue)}` : `Meaning clue: ${esc(contrastPrompt.clue)}`}</p>
        </div>` : ''}
        <div><span class="label">Meaning</span><strong>${esc(item.meaning || 'Meaning unavailable')}</strong></div>
        <div class="kanji-study-readings">
          <p><span class="label">On’yomi</span>${esc(item.on || '—')}</p>
          <p><span class="label">Kun’yomi</span>${esc(item.kun || '—')}</p>
        </div>
        <p class="hint">${item.strokes} strokes · ${esc(level)}</p>
      </div>
    </div>
    <div class="kanji-study-actions">
      <button type="button" class="btn btn-ghost" data-kanji-study-action="previous" ${kanjiStudySession.index === 0 ? 'disabled' : ''}>← Previous</button>
      ${phonetic && !kanjiStudySession.revealed
        ? `<button type="button" class="btn btn-primary" data-kanji-study-action="predict-match">Uses ${esc(kanjiStudySession.reading)}</button>
          <button type="button" class="btn btn-ghost" data-kanji-study-action="predict-exception">Different reading</button>`
        : contrast
          ? ''
        : `<button type="button" class="btn btn-primary" data-kanji-study-action="reveal" ${kanjiStudySession.revealed ? 'disabled' : ''}>${kanjiStudySession.revealed ? 'Revealed' : 'Reveal details'}</button>`}
      <button type="button" class="btn btn-ghost" data-kanji-study-action="next" ${kanjiStudySession.index === progress.total - 1 ? 'disabled' : ''}>Next →</button>
      ${!contrast || kanjiStudySession.revealed ? `<button type="button" class="btn btn-ghost" data-kanji-study-action="known">${known ? '✓ Known' : 'Mark known'}</button>
      <button type="button" class="btn btn-ghost" data-kanji-tree="${esc(item.char)}">Open Radical Tree</button>` : ''}
      <button type="button" class="btn btn-ghost" data-kanji-study-action="shuffle">Shuffle & restart</button>
    </div>
    <p class="hint kanji-study-keys">${contrast ? 'Meaning and uniquely identifying on’yomi clues alternate when the set supports them.' : phonetic ? `Signal confidence: ${kanjiStudySession.confidence}% in this filtered family · Pattern evidence, not an etymology claim.` : 'Keyboard: ←/→ move · Space reveals.'}</p>`;
  if (focusAction) (focusAction === 'contrast-choice'
    ? workspace.querySelector('[data-kanji-study-choice]')
    : workspace.querySelector(`[data-kanji-study-action="${focusAction}"]`))?.focus();
}

function stopKanjiStudy() {
  kanjiStudySession = null;
}

function primaryStudyAction() {
  return kanjiStudySession?.kind === 'phonetic'
    ? 'predict-match'
    : kanjiStudySession?.kind === 'contrast' ? 'contrast-choice' : 'reveal';
}

function startKanjiStudy() {
  const mode = $('#kanji-group').value;
  kanjiStudySession = mode === 'phonetic'
    ? createPhoneticSession(kanjiBrowseActiveFamily)
    : mode === 'contrast'
      ? createContrastSession(kanjiBrowseActiveFamily)
      : createKanjiStudySession(kanjiBrowseActiveFamily, mode);
  if (!kanjiStudySession) return;
  renderKanjiStudy(primaryStudyAction());
}

function onKanjiStudyAction(event) {
  const choice = event.target.closest('[data-kanji-study-choice]');
  if (choice && kanjiStudySession?.kind === 'contrast') {
    kanjiStudySession = answerContrastCard(kanjiStudySession, choice.dataset.kanjiStudyChoice);
    renderKanjiStudy(kanjiStudySession.index < kanjiStudySession.rows.length - 1 ? 'next' : 'shuffle');
    return;
  }
  const button = event.target.closest('[data-kanji-study-action]');
  if (!button || !kanjiStudySession) return;
  const action = button.dataset.kanjiStudyAction;
  if (action === 'close') {
    stopKanjiStudy();
    renderKanjiBrowser();
    $('#kanji-study-start').focus();
    return;
  }
  if (action === 'previous' || action === 'next') {
    kanjiStudySession = moveStudyCard(kanjiStudySession, action === 'previous' ? -1 : 1);
    renderKanjiStudy(primaryStudyAction());
    return;
  }
  if (action === 'reveal') {
    kanjiStudySession = revealStudyCard(kanjiStudySession);
    renderKanjiStudy(kanjiStudySession.index < kanjiStudySession.rows.length - 1 ? 'next' : 'shuffle');
    return;
  }
  if (action === 'predict-match' || action === 'predict-exception') {
    kanjiStudySession = answerPhoneticCard(kanjiStudySession, action === 'predict-match');
    renderKanjiStudy(kanjiStudySession.index < kanjiStudySession.rows.length - 1 ? 'next' : 'shuffle');
    return;
  }
  if (action === 'shuffle') {
    kanjiStudySession = shuffleStudySession(kanjiStudySession);
    renderKanjiStudy(primaryStudyAction());
    toast('Family shuffled. Study progress restarted.', 'success');
    return;
  }
  if (action === 'known') {
    const item = currentStudyCard(kanjiStudySession);
    const known = knownKanji.toggle(item.char);
    toast(known ? 'Marked known.' : 'Unmarked.', 'success');
    refreshKnownEverywhere();
    renderKanjiStudy('known');
  }
}

function onKanjiStudyKey(event) {
  if (!kanjiStudySession || $('#kanji-study-workspace').hidden) return;
  if (event.target.closest('input, textarea, select')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const action = event.key === 'ArrowLeft' ? 'previous' : 'next';
    kanjiStudySession = moveStudyCard(kanjiStudySession, action === 'previous' ? -1 : 1);
    renderKanjiStudy(primaryStudyAction());
  } else if (event.code === 'Space' && !event.target.closest('button')) {
    event.preventDefault();
    if (kanjiStudySession.kind === 'contrast') {
      $('#kanji-study-workspace').querySelector('[data-kanji-study-choice]')?.focus();
    } else {
      kanjiStudySession = revealStudyCard(kanjiStudySession);
      renderKanjiStudy('next');
    }
  }
}

function renderKanjiBrowser() {
  if (!kanjiCatalog.length || !$('#kanji-results')) return;
  const rows = filterKanji(kanjiCatalog, {
    query: $('#kanji-search').value,
    levels: [...kanjiBrowseLevels],
    strokes: $('#kanji-strokes').value,
    known: $('#kanji-known').value,
    sort: $('#kanji-sort').value,
    isKnown: (char) => knownKanji.has(char),
  });
  const groupMode = $('#kanji-group').value;
  const familyMode = isFamilyMode(groupMode);
  const structureMode = isStructureFamilyMode(groupMode);
  const familyTools = $('#kanji-family-tools');
  const familySelect = $('#kanji-family');
  const familyLabel = $('#kanji-family-label');
  let families = [];
  let activeFamily = null;
  let resultRows = rows;
  let allGroups;

  if (structureMode && !kanjiStructureIndex) {
    kanjiBrowseActiveFamily = null;
    familyTools.hidden = false;
    familySelect.disabled = true;
    familySelect.innerHTML = `<option>${kanjiStructureError ? 'Family data unavailable' : 'Loading families…'}</option>`;
    $('#kanji-family-summary').textContent = kanjiStructureError
      ? 'Could not load the offline family index. Choose this view again to retry.'
      : 'Loading the compact offline radical and component index…';
    $('#kanji-result-count').textContent = kanjiStructureError ? 'Family data unavailable' : 'Loading kanji families…';
    $('#kanji-results').innerHTML = `<div class="card empty-state"><span class="e-icon">部</span><div class="e-title">${kanjiStructureError ? 'Could not load kanji families' : 'Preparing structural families'}</div><div class="e-sub">${esc(kanjiStructureError || 'This small index loads only when a structural view is selected.')}</div></div>`;
    $('#kanji-more').hidden = true;
    $('#kanji-study-start').disabled = true;
    renderKanjiStudy();
    return;
  }
  familySelect.disabled = false;

  if (familyMode) {
    familyLabel.textContent = groupMode === 'phonetic' ? 'Signal' : groupMode === 'contrast' ? 'Contrast set' : 'Family';
    families = groupMode === 'phonetic'
      ? buildPhoneticSignals(rows, kanjiStructureIndex)
      : groupMode === 'contrast'
        ? buildContrastSets(rows, kanjiStructureIndex)
        : buildKanjiFamilies(rows, groupMode, kanjiStructureIndex);
    if (!families.some((family) => family.key === kanjiBrowseFamily)) {
      kanjiBrowseFamily = families[0]?.key || '';
    }
    activeFamily = families.find((family) => family.key === kanjiBrowseFamily) || null;
    kanjiBrowseActiveFamily = activeFamily;
    resultRows = activeFamily?.rows || [];
    allGroups = activeFamily ? [activeFamily] : [];
    familyTools.hidden = false;
    familySelect.innerHTML = families.length
      ? families.map((family) => `<option value="${esc(family.key)}">${esc(family.label)} — ${groupMode === 'contrast' ? family.rows.map((row) => row.char).join(' ') : `${family.rows.length.toLocaleString()} kanji${groupMode === 'phonetic' ? ` · ${family.confidence}%` : ''}`}</option>`).join('')
      : '<option value="">No shared families</option>';
    familySelect.value = kanjiBrowseFamily;
    $('#kanji-family-summary').textContent = families.length
      ? groupMode === 'stroke-exact'
        ? `${families.length.toLocaleString()} exact stroke-count families match the current filters.`
        : groupMode === 'radical'
          ? `${families.length.toLocaleString()} radical families match the current filters. Variant shapes are grouped under their canonical radical.`
          : groupMode === 'component'
            ? `${families.length.toLocaleString()} shared direct-component families match the current filters. A kanji may belong to several families.`
            : groupMode === 'phonetic'
              ? `${families.length.toLocaleString()} component reading signals have enough evidence. Confidence measures listed on’yomi consistency, not etymology.`
              : groupMode === 'contrast'
                ? `${families.length.toLocaleString()} compact contrast sets share a direct component. Each set uses distinct meaning clues.`
        : `${families.length.toLocaleString()} shared-reading families match the current filters. A kanji may belong to more than one family.`
      : 'No family has enough matching kanji. Broaden the filters to continue.';
  } else {
    kanjiBrowseActiveFamily = null;
    familyTools.hidden = true;
    familySelect.innerHTML = '';
    $('#kanji-family-summary').textContent = '';
    allGroups = groupKanji(rows, groupMode);
  }

  const perGroup = groupMode === 'none' || familyMode
    ? kanjiBrowseLimit
    : Math.max(12, Math.floor(kanjiBrowseLimit / Math.max(allGroups.length, 1)));
  const visibleGroups = allGroups.map((group) => ({ ...group, totalRows: group.rows.length, rows: group.rows.slice(0, perGroup) }));
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.rows.length, 0);

  $('#kanji-result-count').textContent = familyMode
    ? activeFamily
      ? `Showing ${visibleCount.toLocaleString()} of ${resultRows.length.toLocaleString()} kanji in ${activeFamily.label} · ${families.length.toLocaleString()} ${groupMode === 'phonetic' ? 'signals' : groupMode === 'contrast' ? 'contrast sets' : 'families'}`
      : `No ${groupMode === 'phonetic' ? 'signals' : groupMode === 'contrast' ? 'contrast sets' : 'families'} match · ${rows.length.toLocaleString()} filtered kanji`
    : rows.length
      ? `Showing ${visibleCount.toLocaleString()} of ${rows.length.toLocaleString()} matches · ${kanjiCatalog.length.toLocaleString()} total`
    : `No matches · ${kanjiCatalog.length.toLocaleString()} total`;
  $('#kanji-results').innerHTML = resultRows.length
    ? visibleGroups.map((group) => `<section class="kanji-group">
        ${group.label ? `<div class="ui-section-header"><span class="ui-section-title">${esc(group.label)}</span><span class="ui-section-line"></span><span class="hint">${group.rows.length.toLocaleString()} of ${group.totalRows.toLocaleString()}</span></div>` : ''}
        <div class="kanji-grid">${group.rows.map(kanjiCard).join('')}</div>
      </section>`).join('')
    : `<div class="card empty-state"><span class="e-icon">字</span><div class="e-title">${familyMode ? 'No kanji family matches these filters' : 'No kanji match these filters'}</div><div class="e-sub">Try another reading, meaning, level, or stroke range.</div></div>`;
  $('#kanji-more').hidden = visibleCount >= resultRows.length;
  $('#kanji-study-start').disabled = !kanjiBrowseActiveFamily;
  $('#kanji-study-start').textContent = groupMode === 'phonetic'
    ? 'Practice predictions'
    : groupMode === 'contrast' ? 'Start contrast' : 'Study family';

  document.querySelectorAll('.kanji-level').forEach((button) => {
    const value = button.dataset.kanjiLevel;
    const active = value === 'all' ? kanjiBrowseLevels.size === 0 : kanjiBrowseLevels.has(value);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderKanjiStudy();
}

function resetKanjiBrowser() {
  stopKanjiStudy();
  $('#kanji-search').value = '';
  $('#kanji-strokes').value = 'all';
  $('#kanji-known').value = 'all';
  $('#kanji-sort').value = 'jlpt';
  $('#kanji-group').value = 'none';
  kanjiBrowseFamily = '';
  kanjiBrowseLevels.clear();
  kanjiBrowseLimit = 60;
  renderKanjiBrowser();
  $('#kanji-search').focus();
}

// ---- Review tab: spaced repetition ------------------------------------------
// The queue is derived from the deck, never stored: every answer writes the
// graded card back to storage and rebuilds, so the two can't drift apart.
const newLimit = () => Number($('#srs-new-limit').value) || 20;
const isRecall = (entry) => $('#srs-direction').value === 'recall' && !!entry.gloss;

function refreshReview() {
  queue = buildQueue(deck.all(), { newLimit: newLimit(), lastAnswered });
  if (!queue.length) revealed = false;
  renderReviewStats();
  renderStage();
}

function renderReviewStats() {
  const s = queueStats(deck.all());
  const cell = (n, label) => `<div class="stat"><span class="stat-num">${n}</span><span class="stat-label">${label}</span></div>`;
  $('#srs-stats').innerHTML =
    cell(s.due, 'reviews due') +
    cell(s.fresh, 'new waiting') +
    cell(reviewLog.today(), 'answered today') +
    cell(reviewLog.streak(), 'day streak') +
    cell(s.total, 'cards in deck');

  const waiting = s.due + s.fresh;
  const badge = $('#tab-due');
  badge.textContent = waiting > 99 ? '99+' : waiting;
  badge.hidden = waiting === 0;
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state"><span class="e-icon">${icon}</span><div class="e-title">${title}</div>${sub ? `<div class="e-sub">${sub}</div>` : ''}</div>`;
}

function renderStage() {
  const stage = $('#srs-stage');
  if (!deck.count()) {
    stage.innerHTML = emptyState('☆', 'No cards yet',
      'Save words with "☆ Save" in the Read tab — they arrive here due immediately.');
    return;
  }
  if (!queue.length) {
    const s = queueStats(deck.all());
    const when = s.nextDue ? `Next card in ${formatWait(s.nextDue - Date.now())}.` : 'Nothing scheduled.';
    const done = sessionCount ? ` You answered ${sessionCount} card${sessionCount === 1 ? '' : 's'} this session.` : '';
    stage.innerHTML = emptyState('✓', 'All caught up', when + done);
    return;
  }

  const { entry, card } = queue[0];
  const recall = isRecall(entry);
  const slug = levelSlug(entry.level);
  const word = `<div class="srs-word jlpt-${slug}">${esc(entry.surface)}</div>`;
  const state = isNew(card) ? 'new'
    : card.interval === 0 ? 'learning'
    : `review · ${card.interval}d · ease ${card.ease.toFixed(2)}`;

  const face = recall
    ? `<div class="srs-gloss-front">${esc(entry.gloss)}</div>`
    : word;

  const back = recall
    ? word + (entry.reading ? `<div class="srs-reading">${esc(entry.reading)}</div>` : '')
    : (entry.reading ? `<div class="srs-reading">${esc(entry.reading)}</div>` : '') +
      `<div class="srs-gloss">${esc(entry.gloss || 'No meaning stored for this word.')}</div>`;

  // The sentence this word was saved from, with that exact occurrence marked.
  // Back of the card only: on the front it would give away a recall answer.
  const parts = contextParts({ text: entry.sentence, start: entry.sentenceStart, end: entry.sentenceEnd });
  const contextRow = parts ? `
    <div class="srs-context" lang="ja">${esc(parts.before)}<mark>${esc(parts.word)}</mark>${esc(parts.after)}</div>` : '';

  const kanjiChars = [...new Set([...entry.surface].filter(isKanji))];
  const kanjiRow = kanjiChars.length ? `
    <div class="srs-kanji">${kanjiChars.map((c) => {
      const info = jlpt.kanjiInfo(c);
      return `<span class="srs-kchar jlpt-${levelSlug(jlpt.kanjiLevel(c))}" title="${esc(info?.meaning || '')}" data-kanji-tree="${esc(c)}" role="button" tabindex="0" aria-label="Open radical tree for ${esc(c)}">${esc(c)}
        <i>${esc(info?.meaning ? info.meaning.split(',')[0].trim() : '—')}</i></span>`;
    }).join('')}</div>` : '';

  stage.innerHTML = `
    <div class="srs-meta">
      <span class="badge" data-status="${entry.level == null ? 'archive' : 'reference'}">${levelName(entry.level)}</span>
      <span class="hint">${state}</span>
      <span class="ui-section-line"></span>
      <span class="hint">${queue.length} in queue</span>
    </div>
    <div class="srs-face">
      ${face}
      ${revealed ? `<div class="srs-back">${back}${contextRow}${kanjiRow}</div>` : ''}
    </div>
    ${revealed
      ? `<div class="srs-grades">${GRADES.map((g, i) => `
          <button class="btn ${g === 'good' ? 'btn-primary' : ''} srs-grade" data-grade="${g}">
            <span class="g-key">${i + 1}</span>
            <span class="g-name">${GRADE_LABELS[g]}</span>
            <span class="g-when">${preview(card, g)}</span>
          </button>`).join('')}</div>`
      : `<div class="srs-grades"><button id="srs-show" class="btn btn-primary srs-show">Show answer <span class="g-key">Space</span></button></div>`}`;
}

function reveal() {
  if (!queue.length || revealed) return;
  revealed = true;
  renderStage();
}

function answer(grade) {
  if (!queue.length || !revealed) return;
  const { entry, card } = queue[0];
  deck.update(entry.surface, { srs: schedule(card, grade) });
  reviewLog.record(1);
  sessionCount += 1;
  lastAnswered = entry.surface;
  revealed = false;
  refreshReview();
  renderMyWords();
}

function onReviewClick(e) {
  if (e.target.closest('.srs-show')) { reveal(); return; }
  const grade = e.target.closest('.srs-grade');
  if (grade) answer(grade.dataset.grade);
}

function onReviewKey(e) {
  if (!$('#review-panel').classList.contains('is-active')) return;
  if (e.defaultPrevented || e.target?.closest?.('.kt-overlay, [data-kanji-tree]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target?.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    revealed ? answer('good') : reveal();
    return;
  }
  const i = ['1', '2', '3', '4'].indexOf(e.key);
  if (i >= 0 && revealed) { e.preventDefault(); answer(GRADES[i]); }
}

// ---- My Words tab -------------------------------------------------------------
function dueCell(entry) {
  const card = cardOf(entry);
  if (isNew(card)) return `<span class="hint">new</span>`;
  const delta = card.due - Date.now();
  return delta <= 0
    ? `<span class="due-now">due</span>`
    : `<span class="hint">${formatWait(delta)}</span>`;
}

function renderMyWords() {
  $('#mw-known-count').textContent = `${knownWords.count()} words · ${knownKanji.count()} kanji`;
  $('#mw-known-words').innerHTML = knownWords.all().length
    ? knownWords.all().map((w) => `<span class="known-chip"><span class="known-chip-label">${esc(w)}</span><button type="button" class="known-rm" data-kind="word" data-key="${esc(w)}" aria-label="Unmark known word ${esc(w)}">×</button></span>`).join('')
    : `<span class="hint">None marked yet.</span>`;
  $('#mw-known-kanji').innerHTML = knownKanji.all().length
    ? knownKanji.all().map((c) => `<span class="known-chip jlpt-${levelSlug(jlpt.kanjiLevel(c))}"><button type="button" class="known-kanji-open" data-kanji-tree="${esc(c)}" aria-label="Open radical tree for ${esc(c)}">${esc(c)}</button><button type="button" class="known-rm" data-kind="kanji" data-key="${esc(c)}" aria-label="Unmark known kanji ${esc(c)}">×</button></span>`).join('')
    : `<span class="hint">None marked yet.</span>`;

  const rows = deck.all();
  $('#mw-deck-count').textContent = `${rows.length} card${rows.length === 1 ? '' : 's'}`;
  const days = Object.keys(reviewLog.all()).length;
  $('#mw-backup-count').textContent =
    `${rows.length} cards · ${knownWords.count() + knownKanji.count()} known · ${days} day${days === 1 ? '' : 's'} of history`;
  $('#mw-deck-tbody').innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td class="jp"><span class="jlpt-${levelSlug(r.level)} chip">${esc(r.surface)}</span>${r.reading ? `<span class="rd">${esc(r.reading)}</span>` : ''}</td>
        <td>${esc(r.gloss || '')}${r.sentence ? `<span class="mw-sentence" lang="ja" title="${esc(r.sentence)}">${esc(r.sentence)}</span>` : ''}</td>
        <td><span class="badge" data-status="${r.level == null ? 'archive' : 'reference'}">${levelName(r.level)}</span></td>
        <td>${dueCell(r)}</td>
        <td><button class="btn btn-ghost deck-rm" data-key="${esc(r.surface)}">Remove</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="hint">No saved words yet — tap "☆ Save" on a word in the Read tab.</td></tr>`;
}

function onMyWordsClick(e) {
  const goReview = e.target.closest('.go-review');
  if (goReview) { e.preventDefault(); switchTab('review'); return; }
  const knownRemove = e.target.closest('.known-rm');
  if (knownRemove) {
    const set = knownRemove.dataset.kind === 'word' ? knownWords : knownKanji;
    set.toggle(knownRemove.dataset.key);
    refreshKnownEverywhere();
    return;
  }
  const rm = e.target.closest('.deck-rm');
  if (rm) { deck.remove(rm.dataset.key); renderMyWords(); refreshReview(); }
}

function exportDeck(dl) {
  const rows = deck.all();
  if (!rows.length) { toast('Your deck is empty.', 'error'); return; }
  const tsv = toTSV(rows);
  if (dl) {
    download('kotoba-deck.tsv', tsv);
    toast(`Exported ${rows.length} saved words (TSV).`, 'success');
  } else {
    navigator.clipboard.writeText(tsv)
      .then(() => toast(`Copied ${rows.length} saved words to clipboard.`, 'success'))
      .catch(() => toast('Clipboard blocked — use Download instead.', 'error'));
  }
}

// ---- backup & restore -------------------------------------------------------
// The whole of localStorage in one file, and back. All the rules live in
// backup.js; this is the storage <-> file plumbing around them.
function currentState() {
  return {
    deck: deck.all(),
    knownWords: knownWords.all(),
    knownKanji: knownKanji.all(),
    reviewLog: reviewLog.all(),
  };
}

function downloadBackup() {
  const state = currentState();
  if (!state.deck.length && !state.knownWords.length && !state.knownKanji.length) {
    toast('Nothing to back up yet — save a word first.', 'error');
    return;
  }
  download(backupFilename(), serializeBackup(state), 'application/json');
  toast(`Backed up ${state.deck.length} card${state.deck.length === 1 ? '' : 's'} and their scheduling.`, 'success');
}

async function onBackupFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const incoming = parseBackup(await file.text());
    const { state, stats } = mergeState(currentState(), incoming);
    // Written back only after the parse and merge both succeed, so a bad file
    // leaves the deck exactly as it was.
    deck.replaceAll(state.deck);
    knownWords.replaceAll(state.knownWords);
    knownKanji.replaceAll(state.knownKanji);
    reviewLog.replaceAll(state.reviewLog);
    refreshKnownEverywhere();
    renderMyWords();
    refreshReview();
    toast(describeMerge(stats), 'success');
  } catch (err) {
    console.error(err);
    // parseBackup's messages are written to be read by the person holding the
    // file — pass them through instead of a generic failure.
    toast(err.message || 'Could not read that backup.', 'error');
  } finally {
    e.target.value = ''; // allow re-importing the same file
  }
}

// ---- flashcards -------------------------------------------------------------
function exportFlashcards(dl) {
  if (!current) { toast('Analyze some text first.', 'error'); return; }
  const maxLevel = Number($('#flash-level').value);
  const includeUngraded = $('#flash-ungraded').checked;
  const rows = pickStudyWords(current.wStats.rows, { maxLevel, includeUngraded });
  if (!rows.length) { toast('No matching study words.', 'error'); return; }
  const tsv = toTSV(rows);
  if (dl) {
    download('kotoba-flashcards.tsv', tsv);
    toast(`Exported ${rows.length} words (TSV).`, 'success');
  } else {
    navigator.clipboard.writeText(tsv)
      .then(() => toast(`Copied ${rows.length} words to clipboard.`, 'success'))
      .catch(() => toast('Clipboard blocked — use Download instead.', 'error'));
  }
}

// ---- UI plumbing ------------------------------------------------------------
function renderSampleChips() {
  $('#samples').innerHTML = samples.map((s, i) =>
    `<button class="btn btn-ghost sample" data-i="${i}" title="${esc(s.level)}">${esc(s.title)}</button>`).join('');
}
function showEmpty() {
  textJourney = null;
  textJourneySession = null;
  ['#readability', '#overview', '#kanji-dist'].forEach((s) => ($(s).innerHTML = ''));
  $('#kanji-tbody').innerHTML = $('#word-tbody').innerHTML = '';
  $('#reading').innerHTML = `<div class="empty-state"><span class="e-icon">✍</span><div class="e-title">Paste Japanese text to begin</div></div>`;
  $('#info').innerHTML = infoHint();
  renderTextJourney();
}
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
  // Review is a focus mode: the shared Text box feeds Analyze/Read, not it.
  $('.input-card').hidden = name === 'review' || name === 'kanji';
  // cards come due while you're on another tab — recheck on arrival
  if (name === 'review') refreshReview();
  if (name === 'kanji') renderKanjiBrowser();
}
let toastTimer;
function toast(msg, kind) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'ui-toast is-visible' + (kind ? ' ui-toast--' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'ui-toast'), 2600);
}

function wireUi() {
  let debounce;
  let kanjiDebounce;
  $('#input').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(run, 250);
  });
  $('#samples').addEventListener('click', (e) => {
    const b = e.target.closest('.sample'); if (!b) return;
    $('#input').value = samples[Number(b.dataset.i)].text; run();
  });
  $('#clear').addEventListener('click', () => { $('#input').value = ''; run(); $('#input').focus(); });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#furigana').addEventListener('change', (e) => $('#reading').classList.toggle('no-furigana', !e.target.checked));
  $('#flash-copy').addEventListener('click', () => exportFlashcards(false));
  $('#flash-download').addEventListener('click', () => exportFlashcards(true));
  $('#precise').addEventListener('change', onPreciseToggle);
  $('#import-file').addEventListener('change', onImportFile);
  $('#kanji-search').addEventListener('input', () => {
    stopKanjiStudy();
    clearTimeout(kanjiDebounce);
    kanjiDebounce = setTimeout(() => { kanjiBrowseLimit = 60; renderKanjiBrowser(); }, 120);
  });
  $('#kanji-panel').addEventListener('click', (event) => {
    const level = event.target.closest('.kanji-level');
    if (level) {
      stopKanjiStudy();
      const value = level.dataset.kanjiLevel;
      if (value === 'all') kanjiBrowseLevels.clear();
      else if (kanjiBrowseLevels.has(value)) kanjiBrowseLevels.delete(value);
      else kanjiBrowseLevels.add(value);
      kanjiBrowseLimit = 60;
      renderKanjiBrowser();
    }
  });
  ['#kanji-strokes', '#kanji-known', '#kanji-sort'].forEach((selector) => {
    $(selector).addEventListener('change', () => { stopKanjiStudy(); kanjiBrowseLimit = 60; renderKanjiBrowser(); });
  });
  $('#kanji-group').addEventListener('change', () => {
    stopKanjiStudy();
    kanjiBrowseFamily = '';
    kanjiBrowseLimit = 60;
    renderKanjiBrowser();
    if (isStructureFamilyMode($('#kanji-group').value) && !kanjiStructureIndex) {
      kanjiStructureError = '';
      loadKanjiStructureIndex()
        .then(() => {
          if (isStructureFamilyMode($('#kanji-group').value)) renderKanjiBrowser();
        })
        .catch((error) => {
          console.error(error);
          if (isStructureFamilyMode($('#kanji-group').value)) renderKanjiBrowser();
        });
    }
  });
  $('#kanji-family').addEventListener('change', (event) => {
    stopKanjiStudy();
    kanjiBrowseFamily = event.target.value;
    kanjiBrowseLimit = 60;
    renderKanjiBrowser();
  });
  $('#kanji-more').addEventListener('click', () => { kanjiBrowseLimit += 60; renderKanjiBrowser(); });
  $('#kanji-reset').addEventListener('click', resetKanjiBrowser);
  $('#kanji-study-start').addEventListener('click', startKanjiStudy);
  $('#kanji-study-workspace').addEventListener('click', onKanjiStudyAction);
  $('#text-journey').addEventListener('click', onTextJourneyAction);
  $('#info').addEventListener('click', onInfoAction);
  $('#mywords-panel').addEventListener('click', onMyWordsClick);
  $('#mw-copy').addEventListener('click', () => exportDeck(false));
  $('#mw-download').addEventListener('click', () => exportDeck(true));
  $('#mw-backup-download').addEventListener('click', downloadBackup);
  $('#mw-backup-file').addEventListener('change', onBackupFile);
  $('#mw-clear-known').addEventListener('click', () => {
    if (!confirm('Clear all known words and kanji? Only a backup file can bring them back.')) return;
    knownWords.clear(); knownKanji.clear();
    refreshKnownEverywhere();
  });
  $('#mw-clear-deck').addEventListener('click', () => {
    if (!confirm('Clear your saved deck and its review scheduling? Only a backup file can bring it back.')) return;
    deck.clear();
    sessionCount = 0;
    renderMyWords();
    refreshReview();
  });
  $('#review-panel').addEventListener('click', onReviewClick);
  $('#srs-new-limit').addEventListener('change', refreshReview);
  $('#srs-direction').addEventListener('change', renderStage);
  document.addEventListener('keydown', onReviewKey);
  document.addEventListener('keydown', onKanjiStudyKey);
  // One delegated path covers dynamic Read, Review, and My Words markup.
  document.addEventListener('click', (event) => {
    const doorway = event.target.closest?.('[data-kanji-tree]');
    if (!doorway || doorway.closest('.kt-overlay') || !kanjiTree) return;
    const char = doorway.dataset.kanjiTree;
    if (!char || [...char].length !== 1) return;
    kanjiTree.open(char, doorway);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const doorway = event.target.closest?.('[data-kanji-tree]');
    if (!doorway || doorway.closest('.kt-overlay')) return;
    event.preventDefault();
    doorway.click();
  });
}

// swap between the instant dictionary segmenter and lazy-loaded kuromoji
async function onPreciseToggle(e) {
  const on = e.target.checked;
  const status = $('#precise-status');
  if (!on) { tokenizer = dictTokenizer; status.textContent = ''; run(); return; }
  if (kuromojiTokenizer) { tokenizer = kuromojiTokenizer; status.textContent = 'kuromoji active'; run(); return; }
  e.target.disabled = true;
  status.textContent = 'loading kuromoji dictionary…';
  try {
    kuromojiTokenizer = await loadKuromojiTokenizer(vocabList);
    tokenizer = kuromojiTokenizer;
    status.textContent = 'kuromoji active';
    run();
  } catch (err) {
    console.error(err);
    e.target.checked = false;
    tokenizer = dictTokenizer;
    status.textContent = '';
    toast('Could not load kuromoji — staying on the fast tokenizer.', 'error');
  } finally {
    e.target.disabled = false;
  }
}

// import a .txt file (Aozora Bunko): decode Shift-JIS + strip markup
async function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await readAozoraFile(file);
    $('#input').value = text;
    run();
    toast(`Imported ${file.name} (${[...text].length} chars).`, 'success');
  } catch (err) {
    console.error(err);
    toast('Could not read that file.', 'error');
  } finally {
    e.target.value = ''; // allow re-importing the same file
  }
}

boot();
