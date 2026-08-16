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
import { serializeBackup, backupFilename, inspectBackup, backupSummary, mergeState, describeMerge } from './backup.js';
import { serializeStudyPack, parseStudyPack, studyPackFilename, studyPackFamily } from './study-pack.js';
import { buildProfileMetrics, clearProfileCategory, emptyProfileState } from './profile-dashboard.js';
import { createUsageJournal } from './usage-journal.js';
import { buildUsageInsights } from './usage-insights.js';
import { buildUsageReport, usageReportFilename } from './usage-report.js';
import { sentenceAt, contextParts } from './context.js';
import {
  buildTextJourney,
  createJourneySession,
  currentJourneyStep,
  moveJourneyStep,
  revealJourneyStep,
} from './text-journey.js';
import { isKanji } from './script.js';
import { cacheNameFor } from './offline-cache.js';
import { parseRoute, routeToHash } from './routing.js';
import { buildReadableCompounds, wordsContaining, isReadableCompound, unlockedBy } from './compound-words.js';
import { searchWords } from './word-browser.js';
import { buildMilestones } from './milestones.js';
import { createKanjiTree } from './kanjitree.js';
import { createKanjiMap } from './kanji-map.js';
import { createKanjiNetworkView } from './kanji-network.js';
import { createKanjiAtlasView } from './kanji-atlas.js';
import { buildKanjiRelationshipIndex, buildKanjiRelationships } from './kanji-relationships.js';
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
  answerFamilyMix,
  answerPhoneticCard,
  buildContrastSets,
  buildFamilyMix,
  buildPhoneticSignals,
  contrastQuestion,
  contrastScore,
  createContrastSession,
  createFamilyMixSession,
  createPhoneticSession,
  familyMixScore,
  phoneticCardMatches,
  phoneticScore,
} from './kanji-labs.js';
import {
  alchemyProgress,
  answerAlchemyQuestion,
  buildAlchemyChallenge,
  createAlchemySession,
  currentAlchemyQuestion,
  moveAlchemyQuestion,
  restartAlchemySession,
} from './kanji-alchemy.js';

import {
  newCard, cardOf, isNew, schedule, preview, formatWait,
  buildQueue, queueStats, GRADES, GRADE_LABELS,
} from './srs.js';

// index.html schedules a delayed fallback for genuine module-load failures.
// Reaching this line proves the module graph is alive; dictionary failures get
// their own accurate message inside boot().
clearTimeout(window.__kotobaBootFallback);
delete window.__kotobaBootFallback;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Plays a brief "leaving" animation on `el` (see .known-chip[data-leaving],
// tr[data-leaving] in japanese-reader.css) before running `after`, which does
// the actual re-render. The underlying toggle/removal has already happened by
// the time this runs, so a slow or reduced-motion browser only delays the
// visual confirmation, never the data change — same contract as the Review
// grade transition below.
function leaveThen(el, after) {
  if (!el || reducedMotion()) { after(); return; }
  el.dataset.leaving = 'true';
  setTimeout(after, 180);
}
const alchemyIcon = (name, className = '') => `<svg class="alchemy-icon ${className}" viewBox="0 0 64 64" aria-hidden="true"><use href="assets/alchemy/alchemy-icons.svg#${name}"></use></svg>`;
const APP_VERSION = '10.28.0';
const TAB_USAGE_EVENTS = Object.freeze({
  analyze: 'tab.analyze', read: 'tab.read', kanji: 'tab.kanji',
  relations: 'tab.relations', review: 'tab.review', mywords: 'tab.mywords',
  profile: 'tab.profile',
});

let jlpt, samples = [];
let vocabList = [];
let dictTokenizer = null;   // instant default (dictionary longest-match)
let kuromojiTokenizer = null; // lazily loaded on demand
let tokenizer = null;       // the active one
let current = null; // { tokens, kStats, wStats }
let kanjiTree = null;
let kanjiVGPromise = null;
let kanjiMap = null;
let kanjiMapPromise = null;
let kanjiRelationshipIndex = null;
let relationsMap = null;
let relationsNetwork = null;
let relationsAtlas = null;
let relationsPromise = null;
let relationsSeed = '';
let relationsView = 'map';
let pendingProfileImport = null;
let pendingStudyPack = null;
let kanjiCatalog = [];
let kanjiStructureIndex = null;
let kanjiStructurePromise = null;
let kanjiStructureError = '';
let kanjiBrowseLimit = 60;
let kanjiBrowseFamily = '';
let kanjiBrowseActiveFamily = null;
let kanjiBrowseFamilies = [];
let kanjiStudySession = null;
let kanjiAlchemyOpen = false;
let kanjiAlchemySession = null;
let kanjiAlchemyReturnFocus = null;
let textJourney = null;
let textJourneySession = null;
let usageReportPreviewOpen = false;
const kanjiBrowseLevels = new Set();

// persisted, personal — survive across sessions in this browser only
const knownWords = createKnownSet('known-words');
const knownKanji = createKnownSet('known-kanji');
const deck = createDeck('deck');
const reviewLog = createReviewLog('review-log');
const usageJournal = createUsageJournal();
const isKnown = { word: (s) => knownWords.has(s), kanji: (c) => knownKanji.has(c) };

// review session state — rebuilt from the deck after every answer
let queue = [];
let revealed = false;
let sessionCount = 0;
let lastAnswered = null; // keeps the card you just graded from reappearing at once
let reviewTransitionTimer = null;
let reviewFlipTimer = null;

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
      onKnownChange: (ch, known) => {
        usageJournal.record('known.change');
        refreshKnownEverywhere();
        knownToast(ch, known);
      },
      onOpenRelationships: (ch, trigger) => openKanjiMap(ch, trigger),
      wordsFor: (ch) => wordsContaining(vocabList, ch, 6),
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
    $('#boot-warning').hidden = false;
    toast('Could not load data files — see the message above.', 'error');
    console.error(err);
    return;
  }
  $('#boot-warning').hidden = true; // scripts and data are both alive
  renderSampleChips();
  wireUi();
  renderKanjiBrowser();
  renderMyWords();
  renderProfilePanel();
  refreshReview();
  if (samples[0]) { $('#input').value = samples[0].text; run({ recordUsage: false }); }
  usageJournal.startSession();
  renderUsageJournal();
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && usageJournal.tickActiveMinute()) renderUsageJournal();
  }, 60_000);
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

function loadKanjiRelationshipIndex() {
  if (kanjiRelationshipIndex) return Promise.resolve(kanjiRelationshipIndex);
  return loadKanjiStructureIndex().then((structureIndex) => {
    kanjiRelationshipIndex ||= buildKanjiRelationshipIndex(kanjiCatalog, structureIndex);
    return kanjiRelationshipIndex;
  });
}

function relationshipMapOptions(extra = {}) {
  return {
    getRelationships: (char) => buildKanjiRelationships(kanjiRelationshipIndex, char),
    isKnown: (char) => knownKanji.has(char),
    toggleKnown: (char) => knownKanji.toggle(char),
    onKnownChange: (_char, known) => {
      usageJournal.record('known.change');
      toast(known ? 'Marked known.' : 'Unmarked.', 'success');
      refreshKnownEverywhere();
    },
    inCurrentText: (char) => Boolean(current?.kStats?.rows?.some((row) => row.ch === char)),
    onOpenTree: openKanjiTree,
    ...extra,
  };
}

function openKanjiTree(char, trigger = document.activeElement) {
  if (!kanjiTree || !char || [...char].length !== 1) return;
  usageJournal.record('tree.open');
  kanjiTree.open(char, trigger);
}

async function loadKanjiMap() {
  if (kanjiMap) return kanjiMap;
  if (!kanjiMapPromise) {
    kanjiMapPromise = loadKanjiRelationshipIndex()
      .then(() => {
        kanjiMap = createKanjiMap(relationshipMapOptions());
        return kanjiMap;
      })
      .catch((error) => {
        kanjiMapPromise = null;
        throw error;
      });
  }
  return kanjiMapPromise;
}

async function openKanjiMap(char, trigger = document.activeElement) {
  if (!char || [...char].length !== 1) return;
  trigger?.setAttribute?.('aria-busy', 'true');
  try {
    const map = await loadKanjiMap();
    map.open(char, trigger);
    usageJournal.record('relations.open');
  } catch (error) {
    console.error(error);
    toast('Could not load the relationship index — try again.', 'error');
  } finally {
    trigger?.removeAttribute?.('aria-busy');
  }
}

function relationSeedButton(item) {
  return `<button type="button" class="relations-seed jlpt-${levelSlug(item.jlpt)}" data-relations-seed="${esc(item.char)}" aria-label="Explore relationships for ${esc(item.char)}, ${esc(item.meaning || 'meaning unavailable')}"><span>${esc(item.char)}</span><small>${esc(item.meaning || 'Meaning unavailable')}</small><i>${levelName(item.jlpt)}</i></button>`;
}

function catalogItems(chars, limit = 8) {
  const byChar = new Map(kanjiCatalog.map((item) => [item.char, item]));
  return [...new Set((chars || []).filter(Boolean))].map((char) => byChar.get(char)).filter(Boolean).slice(0, limit);
}

function renderRelationsSeeds() {
  if (!$('#relations-current')) return;
  const currentItems = catalogItems(current?.kStats?.rows?.map((row) => row.ch), 8);
  const knownItems = catalogItems(knownKanji.all(), 8);
  const discoverItems = catalogItems(['学', '語', '心', '青', '生', '道', '光', '夢'], 8);
  const fill = (selector, rows, empty) => {
    $(selector).innerHTML = rows.length ? rows.map(relationSeedButton).join('') : `<span class="hint">${empty}</span>`;
  };
  fill('#relations-current', currentItems, 'Analyze a text to fill this row.');
  fill('#relations-known', knownItems, 'Mark kanji known to collect them here.');
  fill('#relations-discover', discoverItems, 'No discovery seeds available.');
}

function renderRelationsSearch() {
  const root = $('#relations-search-results');
  const query = $('#relations-search').value.trim();
  if (!query) { root.innerHTML = ''; return []; }
  const rows = filterKanji(kanjiCatalog, { query }).slice(0, 12);
  root.innerHTML = rows.length
    ? `<span class="label">Matches</span><div class="relations-seeds">${rows.map(relationSeedButton).join('')}</div>`
    : '<p class="hint">No dictionary kanji match that search.</p>';
  return rows;
}

function relationsQueryOptions() {
  const kinds = [...document.querySelectorAll('[data-relations-kind]:checked')].map((input) => input.value);
  const level = $('#relations-level').value;
  const state = $('#relations-state').value;
  const limit = Number($('#relations-size').value) || 24;
  return {
    kinds,
    limit,
    readingOnlyLimit: limit,
    includeItem: (item) => {
      const levelKey = item.jlpt == null ? 'ungraded' : String(item.jlpt);
      if (level !== 'all' && level !== levelKey) return false;
      if (state === 'known' && !knownKanji.has(item.char)) return false;
      if (state === 'unknown' && knownKanji.has(item.char)) return false;
      if (state === 'text' && !current?.kStats?.rows?.some((row) => row.ch === item.char)) return false;
      return true;
    },
  };
}

function renderRelationsFilterSummary(map, view = {}) {
  const kinds = relationsQueryOptions().kinds;
  if (!kinds.length) {
    $('#relations-filter-summary').textContent = 'Choose at least one evidence type to reveal connections.';
    return;
  }
  if (!map.neighbors.length) {
    $('#relations-filter-summary').textContent = 'No connections match these filters. Broaden the evidence, level, or learning context.';
    return;
  }
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  const presentation = mobile
    ? 'swipe the Structure and Readings lanes below'
    : `${view.canvasCount || 0} on the canvas${view.extraCount ? ` · ${view.extraCount} in the ranked gallery` : ''}`;
  $('#relations-filter-summary').textContent = `${map.neighbors.length} matching connection${map.neighbors.length === 1 ? '' : 's'} loaded · ${presentation}${map.truncated ? ` · ${map.totalCandidates} candidates before the size limit` : ''}.`;
}

function resetRelationsFilters() {
  document.querySelectorAll('[data-relations-kind]').forEach((input) => { input.checked = true; });
  $('#relations-level').value = 'all';
  $('#relations-state').value = 'all';
  $('#relations-size').value = '24';
  relationsMap?.update();
  relationsNetwork?.update();
  relationsAtlas?.update();
}

async function loadRelationsWorkspace() {
  if (relationsMap) return relationsMap;
  if (!relationsPromise) {
    $('#relations-status').textContent = 'Loading the compact relationship index…';
    relationsPromise = loadKanjiRelationshipIndex()
      .then(() => {
        const host = $('#relations-map-host');
        host.replaceChildren();
        relationsMap = createKanjiMap(relationshipMapOptions({
          mount: host,
          getRelationships: (char) => buildKanjiRelationships(kanjiRelationshipIndex, char, relationsQueryOptions()),
          onNavigate: (char) => {
            relationsSeed = char;
            $('#relations-status').textContent = `Exploring ${char}. Select a connected kanji to make it the new center.`;
          },
          onRender: renderRelationsFilterSummary,
        }));
        const initial = current?.kStats?.rows?.[0]?.ch || knownKanji.all()[0] || '学';
        relationsMap.open(initial, null);
        relationsSeed = initial;
        return relationsMap;
      })
      .catch((error) => {
        relationsPromise = null;
        $('#relations-status').textContent = 'Could not load the relationship index. Reopen this tab to retry.';
        throw error;
      });
  }
  return relationsPromise;
}

async function setRelationsView(view, { focus = true, preserveAtlas = false } = {}) {
  relationsView = ['network', 'atlas'].includes(view) ? view : 'map';
  const map = await loadRelationsWorkspace();
  const mapHost = $('#relations-map-host');
  const networkHost = $('#relations-network-host');
  const atlasHost = $('#relations-atlas-host');
  if (relationsView === 'network' && !relationsNetwork) {
    relationsNetwork = createKanjiNetworkView({
      mount: networkHost,
      getRelationships: (char) => buildKanjiRelationships(kanjiRelationshipIndex, char, relationsQueryOptions()),
      isKnown: (char) => knownKanji.has(char),
      onOpenTree: openKanjiTree,
      onNewRoot: (char) => {
        relationsSeed = char;
        map.open(char, null);
        $('#relations-search').value = char;
        renderRelationsSearch();
        $('#relations-status').textContent = `Exploring ${char} across two relationship hops. Expand a direct branch for more context.`;
      },
    });
  }
  if (relationsView === 'atlas' && !relationsAtlas) {
    relationsAtlas = createKanjiAtlasView({
      mount: atlasHost,
      index: kanjiRelationshipIndex,
      isKnown: (char) => knownKanji.has(char),
      toggleKnown: (char) => knownKanji.toggle(char),
      onKnownChange: (_char, known) => {
        usageJournal.record('known.change');
        toast(known ? 'Star illuminated — marked known.' : 'Star dimmed — unmarked.', 'success');
        refreshKnownEverywhere();
      },
      onOpenTree: openKanjiTree,
      onOpenRelations: (char, trigger) => {
        selectRelationsSeed(char, trigger).then(() => setRelationsView('map'));
      },
      onNewRoot: (char, detail) => {
        relationsSeed = char;
        map.open(char, null);
        relationsNetwork?.open(char);
        $('#relations-search').value = char;
        renderRelationsSearch();
        $('#relations-status').textContent = `${char} is now the Atlas root inside the ${detail.component} direct-component constellation.`;
      },
      onStartStudy: (family) => {
        stopKanjiStudy();
        kanjiBrowseActiveFamily = family;
        kanjiStudySession = createKanjiStudySession(family, 'atlas');
        if (!kanjiStudySession) return;
        usageJournal.record('study.atlas');
        switchTab('kanji');
        renderKanjiStudy('reveal');
        revealKanjiWorkspace();
        toast(`Studying ${family.rows.length} unknown stars from the ${family.key.replace('atlas:', '')} constellation.`, 'success');
      },
      onExportPack: ({ title, source, items }) => {
        const content = serializeStudyPack({ title, source, items }, Date.now(), { appVersion: APP_VERSION });
        download(studyPackFilename(title), content, 'application/json');
        usageJournal.record('pack.export');
        toast(`Exported ${items.length} visible stars as a private-data-free study pack.`, 'success');
      },
      onRender: (graph) => {
        if (!graph) {
          $('#relations-status').textContent = 'This kanji has no shared direct-component family in the compact index.';
          return;
        }
        $('#relations-status').textContent = `Exploring ${graph.component} as a ${graph.stars.length}-star direct-component constellation${graph.truncated ? ` · ${graph.total} family members in total` : ''}.`;
      },
      onFocusChange: (focused) => {
        $('#relations-panel').dataset.atlasFocus = String(focused);
        requestAnimationFrame(() => atlasHost.scrollIntoView({ block: 'start', behavior: 'auto' }));
      },
    });
  }
  if (relationsView !== 'atlas') relationsAtlas?.setFocus(false);
  mapHost.hidden = relationsView !== 'map';
  networkHost.hidden = relationsView !== 'network';
  atlasHost.hidden = relationsView !== 'atlas';
  document.querySelectorAll('[data-relations-view]').forEach((button) => {
    const active = button.dataset.relationsView === relationsView;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const char = relationsSeed || map.currentChar() || '学';
  if (relationsView === 'network') {
    relationsNetwork.open(char);
    $('#relations-status').textContent = `Exploring ${char} across two relationship hops. Expand a direct branch for more context.`;
  } else if (relationsView === 'atlas') {
    usageJournal.record('atlas.open');
    relationsAtlas.open(char, { preserveComponent: preserveAtlas });
  } else {
    map.open(char, null);
    $('#relations-status').textContent = `Exploring ${char}. Select a connected kanji to make it the new center.`;
  }
  if (focus) ({ network: networkHost, atlas: atlasHost, map: mapHost })[relationsView].querySelector('button, select')?.focus();
}

async function selectRelationsSeed(char, trigger = document.activeElement) {
  if (!char || [...char].length !== 1) return;
  trigger?.setAttribute?.('aria-busy', 'true');
  try {
    const map = await loadRelationsWorkspace();
    if (!map.open(char, trigger)) return;
    usageJournal.record('relations.open');
    relationsNetwork?.open(char);
    relationsAtlas?.open(char);
    relationsSeed = char;
    $('#relations-search').value = char;
    renderRelationsSearch();
    if (relationsView === 'network') {
      $('#relations-status').textContent = `Exploring ${char} across two relationship hops. Expand a direct branch for more context.`;
    }
    if (window.matchMedia('(max-width: 780px)').matches) {
      const host = ({ network: $('#relations-network-host'), atlas: $('#relations-atlas-host'), map: $('#relations-map-host') })[relationsView];
      requestAnimationFrame(() => host.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  } catch (error) {
    console.error(error);
    toast('Could not open the Relations workspace — try again.', 'error');
  } finally {
    trigger?.removeAttribute?.('aria-busy');
  }
}

// ---- main pipeline ----------------------------------------------------------
function run({ recordUsage = true } = {}) {
  const text = $('#input').value;
  $('#charcount').textContent = `${[...text].length} chars`;
  if (!text.trim()) { current = null; showEmpty(); return; }
  if (recordUsage) usageJournal.record('analyze.run');

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
  if ($('#relations-panel').classList.contains('is-active')) {
    renderRelationsSeeds();
    relationsMap?.update();
    relationsNetwork?.update();
    relationsAtlas?.update();
  }
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
    // The most frequent kanji in your text are the ones worth studying, so the
    // ranking is a doorway rather than a readout.
    const cell = kind === 'kanji'
      ? `<button type="button" class="freq-kanji jlpt-${levelSlug(lvl)} chip" data-kanji-tree="${head}" title="Open the Radical Tree for ${head}" aria-label="Open radical tree for ${head}">${head}</button><button type="button" class="freq-map" data-kanji-map="${head}" title="Open the Relationship Map for ${head}" aria-label="Open relationship map for ${head}"><span aria-hidden="true">↗</span></button>`
      : `<span class="jlpt-${levelSlug(lvl)} chip">${head}</span>${reading ? `<span class="rd">${reading}</span>` : ''}`;
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td class="jp">${cell}</td>
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

// Kanji study and vocabulary study were separate everywhere else in the app.
// Seeing 学生 next to 学 is what connects "I can draw it" to "I can read it".
function infoWordsMarkup(char) {
  const words = wordsContaining(vocabList, char, 6);
  if (!words.length) return '';
  return `<div class="info-words">
    <span class="label">Appears in</span>
    ${words.map((word) => `<div class="info-word-row">
      <span class="jp jlpt-${levelSlug(word.lvl)} chip">${esc(word.w)}</span>
      ${word.r ? `<span class="rd">${esc(word.r)}</span>` : ''}
      <span class="info-word-gloss">${esc((word.g || '').split(';')[0].trim())}</span>
    </div>`).join('')}
  </div>`;
}

function knownBtn(known) {
  return `<button class="btn btn-ghost act-known" data-known="${known}" title="${known ? 'Unmark this as known' : 'Mark as known — dims it while reading and updates your coverage meter'}">${known ? '✓ Known' : 'Mark known'}</button>`;
}
function saveBtn(saved) {
  return `<button class="btn ${saved ? '' : 'btn-ghost'} act-save" data-saved="${saved}" title="${saved ? 'Remove from your Review deck' : 'Save to your Review deck with its sentence — due for review now'}">${saved ? '★ Saved' : '☆ Save'}</button>`;
}

function setInfoSheet(open) {
  $('.info-card').classList.toggle('is-open', open);
  $('#info-scrim').classList.toggle('is-open', open);
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
      ${infoWordsMarkup(sel.ch)}
      <div class="info-actions">${knownBtn(knownKanji.has(sel.ch))}<button type="button" class="btn btn-ghost" data-kanji-map="${esc(sel.ch)}">Relationship Map</button></div>`;
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
        <div class="chips">${kanjiChars.map((c) => `<span class="info-kpair jlpt-${levelSlug(jlpt.kanjiLevel(c))}"><button type="button" class="k info-kchar" data-k="${esc(c)}" data-kanji-tree="${esc(c)}" title="Open the Radical Tree for ${esc(c)}" aria-label="Open radical tree for ${esc(c)}">${esc(c)}</button><button type="button" class="info-kmap" data-kanji-map="${esc(c)}" title="Open the Relationship Map for ${esc(c)}" aria-label="Open relationship map for ${esc(c)}">↗</button></span>`).join('')}</div>
      </div>` : ''}`;
  }
  if (window.matchMedia('(max-width: 780px)').matches) setInfoSheet(true);
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
    usageJournal.record('known.change');
    if (lastSel.type === 'kanji') knownToast(key, now);
    else toast(now ? 'Marked known.' : 'Unmarked.', 'success');
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
// skipKanjiBrowser is for the one case where the grid is already correct:
// toggling a card's own known button. Rebuilding all 60 cards replays their
// staggered entrance animation, which reads as the whole page flashing.
function refreshKnownEverywhere({ skipKanjiBrowser = false } = {}) {
  if (current) {
    applyKnownClasses($('#reading'), isKnown);
    renderCoverage(current.kStats, current.wStats);
    if (!textJourneySession) {
      textJourney = buildTextJourney(current.kStats.rows, current.tokens, kanjiCatalog, (char) => knownKanji.has(char));
    }
    renderTextJourney();
  }
  renderMyWords();
  renderProfilePanel();
  if (!skipKanjiBrowser) renderKanjiBrowser();
  refreshReview();
  kanjiMap?.update();
  relationsMap?.update();
  relationsNetwork?.update();
  relationsAtlas?.update();
  renderRelationsSeeds();
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
    <div class="journey-stage" data-revealed="${textJourneySession.revealed}">
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
      <button type="button" class="btn btn-ghost" data-kanji-map="${esc(item.char)}">Relationship Map</button>
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
    usageJournal.record('known.change');
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
  return `<div class="kanji-card-wrap jlpt-${levelSlug(item.jlpt)}"><button type="button" class="kanji-card" data-kanji-tree="${esc(item.char)}" data-known="${known}" aria-label="${esc(aria)}">
    <span class="kanji-card-glyph">${esc(item.char)}</span>
    <span class="kanji-card-copy">
      <strong>${esc(item.meaning || 'Meaning unavailable')}</strong>
      <span class="kanji-card-reading">${esc(reading || 'No readings listed')}</span>
      <span class="kanji-card-meta" data-strokes="${item.strokes}">${item.strokes} strokes${known ? ' · ✓ Known' : ''}</span>
    </span>
    <span class="badge" data-status="${item.jlpt == null ? 'archive' : 'reference'}">${level}</span>
  </button><div class="kanji-card-actions"><button type="button" class="kanji-card-known" data-kanji-known="${esc(item.char)}" title="${known ? `Unmark ${esc(item.char)} as known` : `Mark ${esc(item.char)} as known — updates your coverage meter and Words you can now read`}" aria-pressed="${known}" aria-label="${known ? 'Unmark' : 'Mark'} ${esc(item.char)} as known"><span aria-hidden="true">✓</span> Known</button><button type="button" class="kanji-card-map" data-kanji-map="${esc(item.char)}" title="Open the Relationship Map for ${esc(item.char)}" aria-label="Open relationship map for ${esc(item.char)}"><span aria-hidden="true">↗</span> Map</button></div></div>`;
}

function renderFamilyMixSetup(workspace) {
  workspace.innerHTML = `<div class="kanji-study-head"><div><span class="eyebrow">Optional challenge mode</span><h3>Family Mix Challenge</h3></div><button type="button" class="btn btn-ghost" data-kanji-study-action="close">Close</button></div>
    <div class="kanji-study-stage"><div class="kanji-study-prompt"><span class="kanji-study-glyph">混</span><p>Choose 2–5 families. Ambiguous kanji that belong to more than one selected family are excluded.</p></div>
    <div class="kanji-study-answer"><label class="label kanji-mix-picker">Families
      <select id="kanji-mix-families" class="select" multiple size="10" aria-describedby="kanji-mix-help">
        ${kanjiStudySession.families.map((family, index) => `<option value="${esc(family.key)}" ${index < 2 ? 'selected' : ''}>${esc(family.label)} — ${family.rows.length} kanji</option>`).join('')}
      </select></label><p id="kanji-mix-help" class="hint">Use Ctrl or Command to select several families. The challenge is temporary.</p></div></div>
    <div class="kanji-study-actions"><button type="button" class="btn btn-primary" data-kanji-study-action="start-mix">Start mixed challenge</button></div>`;
  workspace.querySelector('#kanji-mix-families')?.focus();
}

function openFamilyMixSetup() {
  if (kanjiBrowseFamilies.length < 2) return;
  kanjiStudySession = { kind: 'mix-setup', families: kanjiBrowseFamilies };
  renderKanjiStudy();
  revealKanjiWorkspace();
}

function revealKanjiWorkspace() {
  if (!window.matchMedia('(max-width: 780px)').matches) return;
  requestAnimationFrame(() => $('#kanji-study-workspace').scrollIntoView({ block: 'start', behavior: 'smooth' }));
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
  if (kanjiStudySession.kind === 'mix-setup') {
    renderFamilyMixSetup(workspace);
    return;
  }

  const item = currentStudyCard(kanjiStudySession);
  const progress = studyProgress(kanjiStudySession);
  const known = knownKanji.has(item.char);
  const knownCount = kanjiStudySession.rows.filter((row) => knownKanji.has(row.char)).length;
  const level = levelName(item.jlpt);
  const phonetic = kanjiStudySession.kind === 'phonetic';
  const contrast = kanjiStudySession.kind === 'contrast';
  const mix = kanjiStudySession.kind === 'mix';
  const atlasStudy = kanjiStudySession.mode === 'atlas';
  const alchemyStudy = kanjiStudySession.mode === 'alchemy';
  const phoneticAnswer = phonetic ? kanjiStudySession.answers.get(item.char) : null;
  const contrastPrompt = contrast ? contrastQuestion(kanjiStudySession) : null;
  const contrastAnswer = contrast ? kanjiStudySession.answers.get(item.char) : null;
  const mixAnswer = mix ? kanjiStudySession.answers.get(item.char) : null;
  const score = phonetic ? phoneticScore(kanjiStudySession) : contrast ? contrastScore(kanjiStudySession) : mix ? familyMixScore(kanjiStudySession) : null;
  const answerResult = phonetic ? phoneticAnswer?.correct : contrast ? contrastAnswer?.correct : mix ? mixAnswer?.correct : null;
  const feedbackState = answerResult === true ? 'correct' : answerResult === false ? 'incorrect' : 'neutral';
  workspace.innerHTML = `
    <div class="kanji-study-head">
      <div><span class="eyebrow">${mix ? 'Family Mix Challenge' : contrast ? 'Contrast Lab' : phonetic ? 'Phonetic Component Lab' : atlasStudy ? 'Constellation study' : alchemyStudy ? 'Alchemy study' : 'Family study'}</span><h3>${esc(kanjiStudySession.label)}</h3></div>
      <button type="button" class="btn btn-ghost" data-kanji-study-action="close">Close study</button>
    </div>
    <div class="kanji-study-status">
      <span>Card ${progress.current.toLocaleString()} of ${progress.total.toLocaleString()}</span>
      <span>${phonetic || contrast || mix ? `${score.correct.toLocaleString()} of ${score.answered.toLocaleString()} ${phonetic ? 'predictions' : mix ? 'families' : 'distinctions'} correct · ` : `${progress.studied.toLocaleString()} studied · `}${knownCount.toLocaleString()} known</span>
    </div>
    <div class="kanji-study-progress" data-complete="${progress.complete}" role="progressbar" aria-label="Family study progress" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.studied}"><span style="width:${progress.pct}%"></span></div>
    <div class="kanji-study-stage" data-revealed="${kanjiStudySession.revealed}" data-feedback="${feedbackState}">
      <div class="kanji-study-prompt">
        <span class="badge" data-status="reference">${esc(mix ? `${kanjiStudySession.families.length} families interleaved` : phonetic || contrast ? `${kanjiStudySession.component} component` : kanjiStudySession.label)}</span>
        <span class="kanji-study-glyph jlpt-${levelSlug(item.jlpt)}">${esc(contrast ? kanjiStudySession.component : item.char)}</span>
        <p>${mix
          ? 'Which selected family does this kanji belong to?'
          : contrast
          ? esc(contrastPrompt.prompt)
          : phonetic
          ? `Prediction: does this kanji use the signal reading ${esc(kanjiStudySession.reading)}?`
          : progress.complete ? 'Family pass complete. Review freely or shuffle and restart.' : 'Recall this kanji’s meaning and readings, then reveal the answer.'}</p>
        ${contrast && !kanjiStudySession.revealed ? `<div class="kanji-contrast-choices" role="group" aria-label="Kanji choices">
          ${kanjiStudySession.rows.map((row) => `<button type="button" class="btn kanji-contrast-choice" data-kanji-study-choice="${esc(row.char)}">${esc(row.char)}</button>`).join('')}
        </div>` : ''}
        ${mix && !kanjiStudySession.revealed ? `<div class="kanji-mix-choices" role="group" aria-label="Family choices">
          ${kanjiStudySession.families.map((family) => `<button type="button" class="btn btn-ghost kanji-mix-choice" data-kanji-mix-choice="${esc(family.key)}">${esc(family.label)}</button>`).join('')}
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
        ${mix ? `<div class="kanji-signal-verdict" data-correct="${mixAnswer?.correct}"><span class="label">Family result</span><strong>${mixAnswer?.correct ? 'Correct' : 'Not quite'} — ${esc(item.mixFamilyLabel)}</strong><p>This kanji appears only in that selected family for this challenge.</p></div>` : ''}
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
        : contrast || mix
          ? ''
        : `<button type="button" class="btn btn-primary" data-kanji-study-action="reveal" ${kanjiStudySession.revealed ? 'disabled' : ''}>${kanjiStudySession.revealed ? 'Revealed' : 'Reveal details'}</button>`}
      <button type="button" class="btn btn-ghost" data-kanji-study-action="next" ${kanjiStudySession.index === progress.total - 1 ? 'disabled' : ''}>Next →</button>
      ${(!contrast && !mix) || kanjiStudySession.revealed ? `<button type="button" class="btn btn-ghost" data-kanji-study-action="known">${known ? '✓ Known' : 'Mark known'}</button>
      <button type="button" class="btn btn-ghost" data-kanji-tree="${esc(item.char)}">Open Radical Tree</button>
      <button type="button" class="btn btn-ghost" data-kanji-map="${esc(item.char)}">Relationship Map</button>` : ''}
      <button type="button" class="btn btn-ghost" data-kanji-study-action="shuffle">Shuffle & restart</button>
      ${atlasStudy ? '<button type="button" class="btn btn-ghost" data-kanji-study-action="return-atlas">Return to Atlas</button>' : ''}
    </div>
    <p class="hint kanji-study-keys">${mix ? 'Interleaved, balanced questions · Ambiguous multi-family members are excluded.' : contrast ? 'Meaning and uniquely identifying on’yomi clues alternate when the set supports them.' : phonetic ? `Signal confidence: ${kanjiStudySession.confidence}% in this filtered family · Pattern evidence, not an etymology claim.` : atlasStudy ? 'Temporary unknown-star pass · Keyboard: ←/→ move · Space reveals · Return to the same Atlas when ready.' : alchemyStudy ? 'Temporary recipe-trail pass · Keyboard: ←/→ move · Space reveals · nothing is saved.' : 'Keyboard: ←/→ move · Space reveals.'}</p>`;
  if (focusAction) (focusAction === 'contrast-choice' || focusAction === 'mix-choice'
    ? workspace.querySelector(focusAction === 'mix-choice' ? '[data-kanji-mix-choice]' : '[data-kanji-study-choice]')
    : workspace.querySelector(`[data-kanji-study-action="${focusAction}"]`))?.focus();
}

function stopKanjiStudy() {
  kanjiStudySession = null;
}

function primaryStudyAction() {
  return kanjiStudySession?.kind === 'phonetic'
    ? 'predict-match'
    : kanjiStudySession?.kind === 'contrast' ? 'contrast-choice' : kanjiStudySession?.kind === 'mix' ? 'mix-choice' : 'reveal';
}

function startKanjiStudy() {
  const mode = $('#kanji-group').value;
  kanjiStudySession = mode === 'phonetic'
    ? createPhoneticSession(kanjiBrowseActiveFamily)
    : mode === 'contrast'
      ? createContrastSession(kanjiBrowseActiveFamily)
      : createKanjiStudySession(kanjiBrowseActiveFamily, mode);
  if (!kanjiStudySession) return;
  usageJournal.record('study.family');
  renderKanjiStudy(primaryStudyAction());
  revealKanjiWorkspace();
}

function onKanjiStudyAction(event) {
  const mixChoice = event.target.closest('[data-kanji-mix-choice]');
  if (mixChoice && kanjiStudySession?.kind === 'mix') {
    kanjiStudySession = answerFamilyMix(kanjiStudySession, mixChoice.dataset.kanjiMixChoice);
    renderKanjiStudy(kanjiStudySession.index < kanjiStudySession.rows.length - 1 ? 'next' : 'shuffle');
    return;
  }
  const choice = event.target.closest('[data-kanji-study-choice]');
  if (choice && kanjiStudySession?.kind === 'contrast') {
    kanjiStudySession = answerContrastCard(kanjiStudySession, choice.dataset.kanjiStudyChoice);
    renderKanjiStudy(kanjiStudySession.index < kanjiStudySession.rows.length - 1 ? 'next' : 'shuffle');
    return;
  }
  const button = event.target.closest('[data-kanji-study-action]');
  if (!button || !kanjiStudySession) return;
  const action = button.dataset.kanjiStudyAction;
  if (action === 'start-mix' && kanjiStudySession.kind === 'mix-setup') {
    const selected = [...$('#kanji-mix-families').selectedOptions].map((option) => option.value);
    if (selected.length < 2 || selected.length > 5) {
      toast('Choose between 2 and 5 families.', 'error');
      return;
    }
    const mix = buildFamilyMix(kanjiStudySession.families, selected);
    if (!mix) {
      toast('Those families have no unambiguous mix. Try another combination.', 'error');
      return;
    }
    kanjiStudySession = createFamilyMixSession(mix);
    renderKanjiStudy('mix-choice');
    revealKanjiWorkspace();
    return;
  }
  if (action === 'close') {
    stopKanjiStudy();
    renderKanjiBrowser();
    $('#kanji-study-start').focus();
    return;
  }
  if (action === 'return-atlas' && kanjiStudySession.mode === 'atlas') {
    stopKanjiStudy();
    renderKanjiStudy();
    switchTab('relations');
    setRelationsView('atlas', { preserveAtlas: true }).catch((error) => {
      console.error(error);
      toast('Could not reopen the Atlas — try the Relations tab.', 'error');
    });
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
    usageJournal.record('known.change');
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
    if (kanjiStudySession.kind === 'contrast' || kanjiStudySession.kind === 'mix') {
      $('#kanji-study-workspace').querySelector(kanjiStudySession.kind === 'mix' ? '[data-kanji-mix-choice]' : '[data-kanji-study-choice]')?.focus();
    } else {
      kanjiStudySession = revealStudyCard(kanjiStudySession);
      renderKanjiStudy('next');
    }
  }
}

function setKanjiAlchemyVisibility(open) {
  $('#kanji-alchemy-workspace').hidden = !open;
  $('#kanji-panel .kanji-toolbar').hidden = open;
  $('#kanji-study-workspace').hidden = true;
  $('#kanji-results-head').hidden = open;
  $('#kanji-results').hidden = open;
  $('#kanji-more').hidden = true;
}

const ALCHEMY_MODE_LABELS = Object.freeze({
  result: 'Today’s Brew', missing: 'Missing Ingredient', reverse: 'Reverse Brewing', chain: 'Transformation Chain',
});

function alchemyChoiceValue(choice) {
  return String(choice?.value ?? choice?.char ?? '');
}

function alchemyQuestionPresentation(question, answer) {
  const revealed = !!answer;
  if (question.mode === 'missing') {
    const ingredients = question.ingredients.map((ingredient, index) => index === question.missingIndex && !revealed ? '？' : ingredient);
    return { ingredients, core: question.target.char, label: 'Supply the missing ingredient', prompt: `Which component completes ${ingredients[0]} ＋ ${ingredients[1]} → ${question.target.char}?` };
  }
  if (question.mode === 'reverse') {
    return { ingredients: revealed ? question.ingredients : ['？', '？'], core: question.target.char, label: 'Choose the recipe', prompt: `Which pair does KanjiVG list directly inside ${question.target.char}?` };
  }
  return {
    ingredients: question.ingredients,
    core: revealed ? question.target.char : '？',
    label: question.mode === 'chain' ? `Chain step ${question.chain.position} of ${question.chain.total}` : 'Choose the result',
    prompt: question.mode === 'chain' ? 'Which kanji continues this visual transformation?' : 'Which kanji contains both visual components?',
  };
}

function renderAlchemyHistory(history) {
  if (!history.length) return '';
  return `<div class="alchemy-history"><div><span class="label">Session recipe trail</span><span>${history.length} attempt${history.length === 1 ? '' : 's'} · disappears when you leave</span></div><ol aria-label="Session recipe history">${history.slice(-8).map((entry) => `<li data-correct="${entry.correct}"><span>${esc(entry.ingredients.join('＋'))}</span><strong>${esc(entry.target.char)}</strong><i aria-hidden="true">${entry.correct ? '✓' : '×'}</i></li>`).join('')}</ol></div>`;
}

function renderKanjiAlchemy(focusTarget = '') {
  const workspace = $('#kanji-alchemy-workspace');
  if (!workspace || !kanjiAlchemyOpen) return;
  setKanjiAlchemyVisibility(true);
  if (!kanjiAlchemySession) {
    workspace.innerHTML = `<div class="alchemy-loading" role="status"><span class="alchemy-loading-seal">${alchemyIcon('crucible')}<i aria-hidden="true">錬</i></span><div><span class="eyebrow">Radical Alchemy</span><h3>Preparing today’s ingredients…</h3><p class="hint">Reading the compact component index. The full stroke-path file stays asleep until you open a Radical Tree.</p></div></div>`;
    return;
  }

  const question = currentAlchemyQuestion(kanjiAlchemySession);
  const answer = kanjiAlchemySession.answers[kanjiAlchemySession.index];
  const progress = alchemyProgress(kanjiAlchemySession);
  const level = levelName(question.target.jlpt);
  const selected = answer?.choice || '';
  const completion = progress.complete && kanjiAlchemySession.index === progress.total - 1;
  const presentation = alchemyQuestionPresentation(question, answer);
  const isKnownTarget = knownKanji.has(question.target.char);
  const choiceState = (value) => !answer ? 'ready' : value === question.answer ? 'correct' : value === selected ? 'incorrect' : 'dimmed';
  workspace.innerHTML = `
    <div class="alchemy-head">
      <div><span class="eyebrow">Radical Alchemy · ${esc(kanjiAlchemySession.date)}</span><h3>${alchemyIcon('book', 'alchemy-head-icon')}${esc(kanjiAlchemySession.title)}</h3></div>
      <button type="button" class="btn btn-ghost" data-alchemy-action="close">Leave lab</button>
    </div>
    <div class="alchemy-modebar" role="toolbar" aria-label="Alchemy study modes">
      <div class="alchemy-modes">${Object.entries(ALCHEMY_MODE_LABELS).map(([mode, label]) => `<button type="button" class="btn ${kanjiAlchemySession.mode === mode ? 'btn-primary' : 'btn-ghost'}" data-alchemy-mode="${mode}" aria-pressed="${kanjiAlchemySession.mode === mode}">${esc(label)}</button>`).join('')}</div>
      <button type="button" class="btn btn-ghost alchemy-filter" data-alchemy-action="filter" aria-pressed="${kanjiAlchemySession.knownFilter === 'unknown'}">${kanjiAlchemySession.knownFilter === 'unknown' ? 'Unknown only' : 'All kanji'}</button>
    </div>
    <div class="alchemy-status">
      <span>Formula ${progress.current} of ${progress.total}</span>
      <span>${progress.correct} correct · ${progress.answered} brewed</span>
    </div>
    <div class="alchemy-progress" data-complete="${progress.complete}" role="progressbar" aria-label="${esc(kanjiAlchemySession.title)} progress" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.answered}"><span style="width:${Math.round(progress.answered / progress.total * 100)}%"></span></div>
    ${question.chain ? `<div class="alchemy-chain" aria-label="Transformation chain">${question.chain.glyphs.map((glyph, index) => `<span data-current="${index + 1 === question.chain.position}">${esc(glyph)}</span>${index < question.chain.glyphs.length - 1 ? '<i aria-hidden="true">→</i>' : ''}`).join('')}</div>` : ''}
    ${completion ? `<div class="alchemy-complete">${alchemyIcon('spark', 'alchemy-complete-icon')}<div><strong>Brew complete — ${progress.correct} / ${progress.total}</strong><p>Inspect formulas, study your trail, or begin another mode. No score is saved.</p></div></div>` : ''}
    <div class="alchemy-stage" data-mode="${question.mode}" data-revealed="${!!answer}" data-result="${answer ? (answer.correct ? 'correct' : 'incorrect') : 'waiting'}">
      <div class="alchemy-apparatus" aria-label="${esc(presentation.ingredients[0])} plus ${esc(presentation.ingredients[1])} produces ${esc(presentation.core)}">
        <div class="alchemy-vessel alchemy-vessel-left">${alchemyIcon('flask', 'alchemy-vessel-icon')}<span class="label">Ingredient I</span><strong>${esc(presentation.ingredients[0])}</strong><span class="alchemy-bubbles" aria-hidden="true"><i></i><i></i><i></i></span></div>
        <div class="alchemy-circle" aria-hidden="true">${alchemyIcon('circle', 'alchemy-circle-icon')}<span class="alchemy-ring"></span><span class="alchemy-core">${esc(presentation.core)}</span></div>
        <div class="alchemy-vessel alchemy-vessel-right">${alchemyIcon('flask', 'alchemy-vessel-icon')}<span class="label">Ingredient II</span><strong>${esc(presentation.ingredients[1])}</strong><span class="alchemy-bubbles" aria-hidden="true"><i></i><i></i><i></i></span></div>
        <span class="alchemy-plus alchemy-plus-left" aria-hidden="true">＋</span><span class="alchemy-plus alchemy-plus-right" aria-hidden="true">→</span>
      </div>
      <div class="alchemy-question">
        <div><span class="label">${esc(presentation.label)}</span><h4>${esc(presentation.prompt)}</h4></div>
        <div class="alchemy-choices" role="group" aria-label="Formula choices">
          ${question.choices.map((choice, index) => { const value = alchemyChoiceValue(choice); return `<button type="button" class="alchemy-choice ${question.mode === 'reverse' ? 'is-formula' : ''} jlpt-${levelSlug(choice.jlpt)}" data-alchemy-choice="${esc(value)}" data-state="${choiceState(value)}" ${answer ? 'disabled' : ''}><span class="alchemy-choice-key">${index + 1}</span><strong>${esc(choice.glyph || value)}</strong><span>${esc(choice.label || 'Visual component')}</span></button>`; }).join('')}
        </div>
        ${answer ? `<div class="alchemy-reveal" data-correct="${answer.correct}">
          <div class="alchemy-verdict">${alchemyIcon(answer.correct ? 'seal' : 'crucible', 'alchemy-verdict-icon')}<div><span class="label">Transmutation result</span><strong>${answer.correct ? 'Formula balanced' : `Not quite — ${esc(question.ingredients.join(' ＋ '))} forms ${esc(question.target.char)}`}</strong></div></div>
          <div class="alchemy-recipe"><span class="alchemy-recipe-glyph jlpt-${levelSlug(question.target.jlpt)}">${esc(question.target.char)}</span><div><strong>${esc(question.target.meaning)}</strong><p>${question.target.strokes} strokes · ${esc(level)}</p><p>On’yomi ${esc(question.target.on || '—')} · Kun’yomi ${esc(question.target.kun || '—')}</p></div></div>
          <p class="alchemy-evidence">KanjiVG lists <strong>${esc(question.ingredients[0])}</strong> and <strong>${esc(question.ingredients[1])}</strong> as the two direct labelled components of <strong>${esc(question.target.char)}</strong>. This describes visual structure, not historical etymology.</p>
        </div>` : '<p class="hint alchemy-hint">Select with the buttons or keys 1–4. Every answer comes from an unambiguous two-component pair in the committed KanjiVG index.</p>'}
      </div>
    </div>
    <div class="alchemy-actions">
      <button type="button" class="btn btn-ghost" data-alchemy-action="previous" ${kanjiAlchemySession.index === 0 ? 'disabled' : ''}>← Previous</button>
      ${answer ? `<button type="button" class="btn btn-ghost" data-alchemy-action="known">${isKnownTarget ? '✓ Known' : 'Mark known'}</button><button type="button" class="btn btn-ghost" data-kanji-tree="${esc(question.target.char)}">Open Radical Tree</button>` : ''}
      ${completion ? '<button type="button" class="btn btn-primary" data-alchemy-action="restart">Brew again</button>' : `<button type="button" class="btn btn-primary" data-alchemy-action="next" ${!answer || kanjiAlchemySession.index === progress.total - 1 ? 'disabled' : ''}>Next formula →</button>`}
    </div>
    ${renderAlchemyHistory(kanjiAlchemySession.history)}
    <div class="alchemy-study-handoff"><div><span class="label">Turn the trail into recall</span><p>Open the kanji you brewed in the existing temporary reveal-card workspace.</p></div><button type="button" class="btn btn-ghost" data-alchemy-action="study-history" ${kanjiAlchemySession.history.length ? '' : 'disabled'}>Study recipe trail</button></div>`;
  if (focusTarget === 'choice') workspace.querySelector('[data-alchemy-choice]')?.focus({ preventScroll: true });
  else if (focusTarget) workspace.querySelector(`[data-alchemy-action="${focusTarget}"], [data-alchemy-mode="${focusTarget}"]`)?.focus({ preventScroll: true });
}

function startAlchemyChallenge(mode, knownFilter, history = []) {
  const challenge = buildAlchemyChallenge(kanjiCatalog, kanjiStructureIndex, {
    mode, knownFilter, knownChars: knownKanji.all(),
  });
  if (!challenge) return false;
  kanjiAlchemySession = createAlchemySession(challenge, history);
  return !!kanjiAlchemySession;
}

async function openKanjiAlchemy(trigger) {
  stopKanjiStudy();
  kanjiAlchemyOpen = true;
  kanjiAlchemySession = null;
  kanjiAlchemyReturnFocus = trigger || $('#kanji-alchemy-open');
  renderKanjiAlchemy();
  requestAnimationFrame(() => $('#kanji-alchemy-workspace').scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(max-width: 780px)').matches ? 'smooth' : 'auto',
  }));
  try {
    const structureIndex = await loadKanjiStructureIndex();
    if (!kanjiAlchemyOpen) return;
    if (!startAlchemyChallenge('result', 'all')) throw new Error('Not enough unambiguous component recipes were found.');
    renderKanjiAlchemy('choice');
  } catch (error) {
    console.error(error);
    closeKanjiAlchemy();
    toast('Could not prepare Radical Alchemy. Please try again.', 'error');
  }
}

function closeKanjiAlchemy() {
  const returnFocus = kanjiAlchemyReturnFocus;
  kanjiAlchemyOpen = false;
  kanjiAlchemySession = null;
  kanjiAlchemyReturnFocus = null;
  setKanjiAlchemyVisibility(false);
  renderKanjiBrowser();
  requestAnimationFrame(() => returnFocus?.focus());
}

function onKanjiAlchemyAction(event) {
  const choice = event.target.closest('[data-alchemy-choice]');
  if (choice && kanjiAlchemySession) {
    kanjiAlchemySession = answerAlchemyQuestion(kanjiAlchemySession, choice.dataset.alchemyChoice);
    const progress = alchemyProgress(kanjiAlchemySession);
    renderKanjiAlchemy(progress.complete ? 'restart' : 'next');
    return;
  }
  const modeButton = event.target.closest('[data-alchemy-mode]');
  if (modeButton && kanjiAlchemySession) {
    const history = kanjiAlchemySession.history;
    if (!startAlchemyChallenge(modeButton.dataset.alchemyMode, kanjiAlchemySession.knownFilter, history)) {
      toast('No evidence-safe recipes match that mode and filter yet.', 'error');
      return;
    }
    renderKanjiAlchemy('choice');
    return;
  }
  const button = event.target.closest('[data-alchemy-action]');
  if (!button || !kanjiAlchemyOpen) return;
  const action = button.dataset.alchemyAction;
  if (action === 'close') { closeKanjiAlchemy(); return; }
  if (!kanjiAlchemySession) return;
  if (action === 'previous' || action === 'next') {
    kanjiAlchemySession = moveAlchemyQuestion(kanjiAlchemySession, action === 'previous' ? -1 : 1);
    renderKanjiAlchemy(kanjiAlchemySession.answers[kanjiAlchemySession.index] ? action : 'choice');
  } else if (action === 'restart') {
    kanjiAlchemySession = restartAlchemySession(kanjiAlchemySession);
    renderKanjiAlchemy('choice');
  } else if (action === 'filter') {
    const history = kanjiAlchemySession.history;
    const knownFilter = kanjiAlchemySession.knownFilter === 'unknown' ? 'all' : 'unknown';
    if (!startAlchemyChallenge(kanjiAlchemySession.mode, knownFilter, history)) {
      toast('No transformation chain matches the unknown-only filter. Try All kanji.', 'error');
      return;
    }
    renderKanjiAlchemy('choice');
  } else if (action === 'known') {
    const question = currentAlchemyQuestion(kanjiAlchemySession);
    const known = knownKanji.toggle(question.target.char);
    usageJournal.record('known.change');
    refreshKnownEverywhere();
    renderKanjiAlchemy('known');
    toast(known ? 'Marked known.' : 'Unmarked.', 'success');
  } else if (action === 'study-history') {
    const seen = new Set();
    const rows = kanjiAlchemySession.history.map((entry) => entry.target).filter((item) => !seen.has(item.char) && seen.add(item.char));
    const session = createKanjiStudySession({ key: 'alchemy-history', label: 'Alchemy recipe trail', rows }, 'alchemy');
    if (!session) return;
    kanjiAlchemyOpen = false;
    kanjiAlchemySession = null;
    kanjiAlchemyReturnFocus = null;
    setKanjiAlchemyVisibility(false);
    kanjiStudySession = session;
    renderKanjiStudy('reveal');
    revealKanjiWorkspace();
  }
}

function onKanjiAlchemyKey(event) {
  if (!kanjiAlchemyOpen || !kanjiAlchemySession || !$('#kanji-panel').classList.contains('is-active') || event.target.closest('input, textarea, select') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-4]$/.test(event.key) && !kanjiAlchemySession.answers[kanjiAlchemySession.index]) {
    const choice = currentAlchemyQuestion(kanjiAlchemySession).choices[Number(event.key) - 1];
    if (!choice) return;
    event.preventDefault();
    kanjiAlchemySession = answerAlchemyQuestion(kanjiAlchemySession, alchemyChoiceValue(choice));
    const progress = alchemyProgress(kanjiAlchemySession);
    renderKanjiAlchemy(progress.complete ? 'restart' : 'next');
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const answered = kanjiAlchemySession.answers[kanjiAlchemySession.index];
    if (event.key === 'ArrowRight' && !answered) return;
    event.preventDefault();
    kanjiAlchemySession = moveAlchemyQuestion(kanjiAlchemySession, event.key === 'ArrowLeft' ? -1 : 1);
    renderKanjiAlchemy(kanjiAlchemySession.answers[kanjiAlchemySession.index] ? (event.key === 'ArrowLeft' ? 'previous' : 'next') : 'choice');
  } else if (event.key === 'Escape' && !document.querySelector('.kt-overlay:not([hidden])')) {
    event.preventDefault();
    closeKanjiAlchemy();
  }
}

function renderKanjiBrowser() {
  if (!kanjiCatalog.length || !$('#kanji-results')) return;
  if (kanjiAlchemyOpen) { renderKanjiAlchemy(); return; }
  setKanjiAlchemyVisibility(false);
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
    kanjiBrowseFamilies = [];
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
    $('#kanji-mix-open').disabled = true;
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
    kanjiBrowseFamilies = families;
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
    kanjiBrowseFamilies = [];
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
  const mixEligible = familyMode && !['phonetic', 'contrast'].includes(groupMode);
  $('#kanji-mix-open').hidden = !mixEligible;
  $('#kanji-mix-open').disabled = !mixEligible || families.length < 2;

  document.querySelectorAll('.kanji-level').forEach((button) => {
    const value = button.dataset.kanjiLevel;
    const active = value === 'all' ? kanjiBrowseLevels.size === 0 : kanjiBrowseLevels.has(value);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const advancedCount = [
    $('#kanji-strokes').value !== 'all',
    $('#kanji-known').value !== 'all',
    $('#kanji-sort').value !== 'jlpt',
    $('#kanji-group').value !== 'none',
  ].filter(Boolean).length;
  $('#kanji-filter-count').hidden = advancedCount === 0;
  $('#kanji-filter-count').textContent = advancedCount;
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
  stage.removeAttribute('data-feedback');
  stage.removeAttribute('aria-busy');
  if (!deck.count()) {
    stage.dataset.reviewState = 'empty';
    stage.innerHTML = emptyState('☆', 'No cards yet',
      'Save words with "☆ Save" in the Read tab — they arrive here due immediately.');
    return;
  }
  if (!queue.length) {
    stage.dataset.reviewState = 'complete';
    const s = queueStats(deck.all());
    const when = s.nextDue ? `Next card in ${formatWait(s.nextDue - Date.now())}.` : 'Nothing scheduled.';
    const done = sessionCount ? ` You answered ${sessionCount} card${sessionCount === 1 ? '' : 's'} this session.` : '';
    stage.innerHTML = emptyState('✓', 'All caught up', when + done);
    return;
  }

  const { entry, card } = queue[0];
  stage.dataset.reviewState = revealed ? 'revealed' : 'prompt';
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
      return `<span class="srs-kpair jlpt-${levelSlug(jlpt.kanjiLevel(c))}"><button type="button" class="srs-kchar" title="${esc(info?.meaning || '')}" data-kanji-tree="${esc(c)}" aria-label="Open radical tree for ${esc(c)}">${esc(c)}
        <i>${esc(info?.meaning ? info.meaning.split(',')[0].trim() : '—')}</i></button><button type="button" class="srs-kmap" data-kanji-map="${esc(c)}" aria-label="Open relationship map for ${esc(c)}">↗</button></span>`;
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

// Turns the review card over like a physical flashcard: 'out' rotates the
// current face edge-on, 'in' brings the freshly rendered face back around.
// Re-setting the same attribute value wouldn't restart the CSS animation, so
// it's cleared and a reflow is forced before the new value is applied.
function flipStage(kind) {
  const stage = $('#srs-stage');
  if (!stage) return;
  stage.removeAttribute('data-flip');
  void stage.offsetWidth;
  stage.dataset.flip = kind;
}

function reveal() {
  if (!queue.length || revealed) return;
  if (reducedMotion()) { revealed = true; renderStage(); return; }
  flipStage('out');
  clearTimeout(reviewFlipTimer);
  reviewFlipTimer = setTimeout(() => {
    revealed = true;
    renderStage();
    flipStage('in');
  }, 160);
}

function answer(grade) {
  if (!queue.length || !revealed) return;
  const { entry, card } = queue[0];
  deck.update(entry.surface, { srs: schedule(card, grade) });
  reviewLog.record(1);
  usageJournal.record('review.answer');
  sessionCount += 1;
  lastAnswered = entry.surface;
  revealed = false;
  // Scheduling is persisted immediately. The brief visual acknowledgement
  // delays only the next render, so closing the page cannot lose an answer.
  const stage = $('#srs-stage');
  stage.dataset.feedback = grade;
  stage.setAttribute('aria-busy', 'true');
  clearTimeout(reviewTransitionTimer);
  const transitionMs = reducedMotion() ? 0 : 240;
  reviewTransitionTimer = setTimeout(() => {
    refreshReview();
    renderMyWords();
    renderProfilePanel();
    if (!reducedMotion()) flipStage('in');
  }, transitionMs);
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

function profileSummaryMarkup(summary) {
  return [
    ['Saved cards', summary.cards],
    ['Known words', summary.knownWords],
    ['Known kanji', summary.knownKanji],
    ['Review days', summary.reviewDays],
  ].map(([label, value]) => `<span><b>${Number(value).toLocaleString()}</b><small>${label}</small></span>`).join('');
}

function renderProfileDashboard(state) {
  const metrics = buildProfileMetrics(state);
  const size = metrics.bytes < 1024 ? `${metrics.bytes} bytes` : `${(metrics.bytes / 1024).toFixed(1)} KB`;
  const lastReview = metrics.lastReview
    ? new Date(`${metrics.lastReview}T00:00:00`).toLocaleDateString()
    : 'No reviews recorded';
  $('#profile-health-detail').textContent = `${size} of local JSON · ${lastReview}${metrics.lastReview ? ' last reviewed' : ''} · ready to export.`;
  const categories = [
    { key: 'deck', glyph: '語', title: 'Saved cards', count: metrics.cards, detail: `${metrics.newCards} new · ${metrics.dueCards} due · ${metrics.scheduledCards} scheduled` },
    { key: 'knownWords', glyph: '言', title: 'Known words', count: metrics.knownWords, detail: 'Personal reading coverage' },
    { key: 'knownKanji', glyph: '漢', title: 'Known kanji', count: metrics.knownKanji, detail: 'Kanji coverage and study context' },
    { key: 'reviewLog', glyph: '復', title: 'Review history', count: metrics.reviewDays, detail: `${metrics.reviewAnswers} answers across ${metrics.reviewDays} days` },
  ];
  $('#profile-categories').innerHTML = categories.map((category) => `<article class="profile-category">
    <span class="profile-category-glyph" aria-hidden="true">${category.glyph}</span>
    <div><h4>${category.title}</h4><p><b>${category.count.toLocaleString()}</b> · ${category.detail}</p></div>
    <button type="button" class="btn btn-ghost" data-profile-clear="${category.key}" ${category.count ? '' : 'disabled'}>Clear</button>
  </article>`).join('');
}

function renderUsageJournal(profileState = currentState()) {
  const root = $('#usage-journal-summary');
  if (!root) return;
  const summary = usageJournal.summary();
  $('#usage-journal-status').textContent = summary.enabled ? 'Recording locally' : 'Paused';
  $('#usage-journal-status').dataset.status = summary.enabled ? 'stable' : 'archive';
  $('#usage-journal-toggle').textContent = summary.enabled ? 'Pause journal' : 'Enable journal';
  $('#usage-journal-toggle').classList.toggle('btn-primary', !summary.enabled);
  $('#usage-journal-clear').disabled = summary.days === 0;
  root.innerHTML = [
    ['Sessions today', summary.today.sessions],
    ['Active minutes today', summary.today.activeMinutes],
    ['Actions today', summary.today.eventCount],
    ['Days kept', summary.days],
  ].map(([label, value]) => `<span><b>${value.toLocaleString()}</b><small>${label}</small></span>`).join('');
  $('#usage-journal-detail').textContent = summary.days
    ? `${summary.sessions.toLocaleString()} session${summary.sessions === 1 ? '' : 's'} · ${summary.activeMinutes.toLocaleString()} active minute${summary.activeMinutes === 1 ? '' : 's'} · ${summary.eventCount.toLocaleString()} coarse action${summary.eventCount === 1 ? '' : 's'} across the last ${summary.days} logged day${summary.days === 1 ? '' : 's'}.`
    : 'No activity has been recorded.';
  const profileMetrics = buildProfileMetrics(profileState);
  const insights = buildUsageInsights(summary, profileMetrics);
  $('#usage-feature-mix').innerHTML = insights.featureMix.map((feature) => `<div class="usage-feature">
    <span class="usage-feature-glyph" aria-hidden="true">${feature.glyph}</span>
    <div><span><strong>${feature.label}</strong><small>${feature.count.toLocaleString()}</small></span><i aria-hidden="true"><b style="--usage-strength:${feature.strength}%"></b></i></div>
  </div>`).join('');
  $('#usage-friction-signals').innerHTML = insights.signals.map((signal) => `<article class="usage-signal" data-tone="${signal.tone}">
    <div><strong>${signal.title}</strong><p>${signal.body}</p></div>
    ${signal.actionTab ? `<button type="button" class="btn btn-ghost" data-usage-tab="${signal.actionTab}">${signal.actionLabel}</button>` : ''}
  </article>`).join('');
  if (usageReportPreviewOpen) {
    $('#usage-report-content').textContent = buildUsageReport({ summary, insights, profile: profileMetrics, appVersion: APP_VERSION });
  }
}

function currentUsageReport(generatedAt = Date.now()) {
  const profile = buildProfileMetrics(currentState());
  const summary = usageJournal.summary();
  const insights = buildUsageInsights(summary, profile);
  return buildUsageReport({ summary, insights, profile, generatedAt, appVersion: APP_VERSION });
}

function setUsageReportPreview(open) {
  usageReportPreviewOpen = open;
  $('#usage-report-preview').hidden = !open;
  $('#usage-report-toggle').textContent = open ? 'Hide preview' : 'Preview report';
  $('#usage-report-toggle').setAttribute('aria-expanded', String(open));
  if (open) {
    $('#usage-report-content').textContent = currentUsageReport();
    $('#usage-report-preview').focus();
  }
}

function recordUsageReportExport(message) {
  usageJournal.record('report.export');
  renderUsageJournal();
  toast(message, 'success');
}

function copyUsageReport() {
  const report = currentUsageReport();
  navigator.clipboard.writeText(report)
    .then(() => recordUsageReportExport('Copied privacy-safe usage report.'))
    .catch(() => toast('Clipboard blocked — download the report instead.', 'error'));
}

function downloadUsageReport() {
  const generatedAt = Date.now();
  const report = currentUsageReport(generatedAt);
  download(usageReportFilename(generatedAt), report, 'text/markdown');
  recordUsageReportExport('Downloaded privacy-safe usage report.');
}

// Capability milestones, recomputed from current profile numbers every render.
// Nothing here is stored: see js/milestones.js for why.
function renderMilestones() {
  const host = $('#profile-milestones');
  if (!host) return;

  const readableWords = buildReadableCompounds(
    vocabList, (char) => knownKanji.has(char), 0,
  ).total;

  const { passed, next } = buildMilestones({
    knownKanji: knownKanji.count(),
    knownWords: knownWords.count(),
    readableWords,
    savedCards: deck.count(),
    reviewDays: Object.keys(reviewLog.all()).length,
  });

  if (!passed.length && !next) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  host.hidden = false;

  // Passed milestones only. A forward line appears just once, and only when the
  // pure module judged it close enough to be encouraging rather than nagging.
  host.innerHTML = `
    ${passed.map((m) => `<span class="milestone">${esc(m.label)}</span>`).join('')}
    ${next ? `<span class="milestone milestone--next">${next.remaining.toLocaleString()} to ${esc(next.label)}</span>` : ''}`;
}

// Profile & Data lives in its own panel, so it renders independently of the
// My Words study collection. Both read the same stores, so anything that
// changes cards or known state must refresh both.
function renderProfilePanel() {
  const rows = deck.all();
  const days = Object.keys(reviewLog.all()).length;
  $('#mw-backup-count').textContent =
    `${rows.length} cards · ${knownWords.count() + knownKanji.count()} known · ${days} day${days === 1 ? '' : 's'} of history`;
  const profileState = currentState();
  $('#profile-summary').innerHTML = profileSummaryMarkup(backupSummary(profileState));
  renderProfileDashboard(profileState);
  renderUsageJournal(profileState);
  renderMilestones();
}

const COMPOUND_LIMIT = 24;
const WORD_LOOKUP_LIMIT = 30;

// One row shape for every vocabulary list, so the compound card and the lookup
// stay visually identical and gain features together. `justUnlocked` marks a
// row that became readable only since the previous render, for the brush
// reveal below — every other row renders exactly as before.
function wordRowMarkup(word, justUnlocked = false) {
  const saved = deck.has(word.w);
  return `<div class="compound-row"${justUnlocked ? ' data-unlocked="true"' : ''}>
      <div class="compound-word jp">${[...word.w].map((char) => (isKanji(char)
        ? `<button type="button" class="compound-kanji" data-kanji-tree="${esc(char)}" title="Open the Radical Tree for ${esc(char)}" aria-label="Open radical tree for ${esc(char)}">${esc(char)}</button>`
        : `<span class="compound-kana">${esc(char)}</span>`)).join('')}</div>
      <div class="compound-meta">
        ${word.r ? `<span class="rd">${esc(word.r)}</span>` : ''}
        <span class="compound-gloss">${esc(word.g)}</span>
      </div>
      <span class="badge" data-status="${word.lvl == null ? 'archive' : 'reference'}">${levelName(word.lvl)}</span>
      <button type="button" class="compound-save" data-compound-save="${esc(word.w)}" title="${saved ? `Remove ${esc(word.w)} from your Review deck` : `Save ${esc(word.w)} to your Review deck — it becomes due immediately`}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(word.w)} ${saved ? 'from' : 'to'} your deck">${saved ? '★ Saved' : '☆ Save'}</button>
    </div>`;
}

// Stays null until the first render, so opening My Words for the first time
// in a session never plays the unlock reveal on words you already knew.
let seenReadableWords = null;

// The reverse of everything else in the app: instead of taking a kanji apart,
// report the words the known kanji already combine into.
function renderReadableCompounds() {
  const host = $('#mw-compounds');
  const count = $('#mw-compound-count');
  if (!host || !count) return;

  const { total, words } = buildReadableCompounds(
    vocabList, (char) => knownKanji.has(char), COMPOUND_LIMIT,
  );

  count.textContent = total
    ? `${total} word${total === 1 ? '' : 's'}${total > words.length ? ` · showing ${words.length}` : ''}`
    : '';

  // A word "unlocks" relative to what was last actually shown here — not the
  // previous render, which commonly happens while this panel is hidden (My
  // Words re-renders on every known-state change everywhere in the app, not
  // just while it's the active tab). So the baseline only advances when the
  // panel is visible; while hidden, newly-readable words keep accumulating
  // in the diff until the learner actually looks.
  const surfaces = new Set(words.map((w) => w.w));
  const justUnlocked = seenReadableWords
    ? new Set([...surfaces].filter((s) => !seenReadableWords.has(s)))
    : new Set();
  const visible = $('#mywords-panel')?.classList.contains('is-active');
  if (visible || seenReadableWords === null) seenReadableWords = surfaces;

  if (!words.length) {
    host.innerHTML = knownKanji.count()
      ? '<p class="hint">No compound words yet from these kanji. Marking a few more known will start unlocking them.</p>'
      : '<p class="hint">Mark kanji "✓ Known" while reading, and the words they combine into will appear here.</p>';
    return;
  }

  host.innerHTML = words.map((w) => wordRowMarkup(w, justUnlocked.has(w.w))).join('');
}

// Updates just the card that was toggled. Mirrors the known-state parts of the
// card template above; if that markup changes, change this with it.
function patchKanjiCardKnown(button, char) {
  const wrap = button.closest('.kanji-card-wrap');
  if (!wrap) return;
  const known = knownKanji.has(char);
  button.setAttribute('aria-pressed', String(known));
  button.setAttribute('aria-label', `${known ? 'Unmark' : 'Mark'} ${char} as known`);
  button.setAttribute('title', known
    ? `Unmark ${char} as known`
    : `Mark ${char} as known — updates your coverage meter and Words you can now read`);
  const card = wrap.querySelector('.kanji-card');
  if (card) card.dataset.known = String(known);
  const meta = wrap.querySelector('.kanji-card-meta');
  if (meta) meta.textContent = `${meta.dataset.strokes} strokes${known ? ' · ✓ Known' : ''}`;
}

// Vocabulary lookup: the counterpart to the Kanji library's search, so a word
// is reachable without waiting for it to turn up in pasted text.
function renderWordLookup() {
  const host = $('#wl-results');
  const count = $('#wl-count');
  if (!host || !count) return;

  const levelValue = $('#wl-level').value;
  const { total, words } = searchWords(vocabList, {
    term: $('#wl-search').value,
    level: levelValue === '' ? null : Number(levelValue),
    readable: $('#wl-readable').value,
    isReadable: (word) => isReadableCompound(word, (char) => knownKanji.has(char)),
    limit: WORD_LOOKUP_LIMIT,
  });

  count.textContent = total
    ? `${total.toLocaleString()} match${total === 1 ? '' : 'es'}${total > words.length ? ` · showing ${words.length}` : ''}`
    : 'No matches';

  // Explicit call, not a bare `.map(wordRowMarkup)`: Array.map's index would
  // otherwise land in the `justUnlocked` parameter and flag every row past
  // the first as newly unlocked.
  host.innerHTML = words.length
    ? words.map((w) => wordRowMarkup(w)).join('')
    : '<p class="hint">No vocabulary matches that search. Try a reading, or part of an English meaning.</p>';
}

function renderMyWords() {
  $('#mw-known-count').textContent = `${knownWords.count()} words · ${knownKanji.count()} kanji`;
  $('#mw-known-words').innerHTML = knownWords.all().length
    ? knownWords.all().map((w) => `<span class="known-chip"><span class="known-chip-label">${esc(w)}</span><button type="button" class="known-rm" data-kind="word" data-key="${esc(w)}" title="Unmark ${esc(w)} as known" aria-label="Unmark known word ${esc(w)}">×</button></span>`).join('')
    : `<span class="hint">None marked yet.</span>`;
  $('#mw-known-kanji').innerHTML = knownKanji.all().length
    ? knownKanji.all().map((c) => `<span class="known-chip jlpt-${levelSlug(jlpt.kanjiLevel(c))}"><button type="button" class="known-kanji-open" data-kanji-tree="${esc(c)}" title="Open the Radical Tree for ${esc(c)}" aria-label="Open radical tree for ${esc(c)}">${esc(c)}</button><button type="button" class="known-kanji-map" data-kanji-map="${esc(c)}" title="Open the Relationship Map for ${esc(c)}" aria-label="Open relationship map for ${esc(c)}">↗</button><button type="button" class="known-rm" data-kind="kanji" data-key="${esc(c)}" title="Unmark ${esc(c)} as known" aria-label="Unmark known kanji ${esc(c)}">×</button></span>`).join('')
    : `<span class="hint">None marked yet.</span>`;

  renderReadableCompounds();
  renderWordLookup();

  const rows = deck.all();
  $('#mw-deck-count').textContent = `${rows.length} card${rows.length === 1 ? '' : 's'}`;
  $('#mw-deck-tbody').innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td class="jp" data-label="Word"><span class="jlpt-${levelSlug(r.level)} chip">${esc(r.surface)}</span>${r.reading ? `<span class="rd">${esc(r.reading)}</span>` : ''}</td>
        <td data-label="Meaning">${esc(r.gloss || '')}${r.sentence ? `<span class="mw-sentence" lang="ja" title="${esc(r.sentence)}">${esc(r.sentence)}</span>` : ''}</td>
        <td data-label="JLPT"><span class="badge" data-status="${r.level == null ? 'archive' : 'reference'}">${levelName(r.level)}</span></td>
        <td data-label="Next">${dueCell(r)}</td>
        <td class="mw-card-action"><button class="btn btn-ghost deck-rm" data-key="${esc(r.surface)}">Remove</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="hint">No saved words yet — tap "☆ Save" on a word in the Read tab.</td></tr>`;
  updateStudyPackSource();
}

function onMyWordsClick(e) {
  const usageAction = e.target.closest('[data-usage-tab]');
  if (usageAction) { switchTab(usageAction.dataset.usageTab); return; }
  const categoryClear = e.target.closest('[data-profile-clear]');
  if (categoryClear) {
    const category = categoryClear.dataset.profileClear;
    const names = { deck: 'saved cards and schedules', knownWords: 'known words', knownKanji: 'known kanji', reviewLog: 'review history' };
    if (!names[category] || !confirm(`Clear ${names[category]} from this browser? Export a profile first if you may need them later.`)) return;
    writeProfileState(clearProfileCategory(currentState(), category));
    toast(`Cleared ${names[category]}.`, 'success');
    return;
  }
  const goReview = e.target.closest('.go-review');
  if (goReview) { e.preventDefault(); switchTab('review'); return; }
  const goProfile = e.target.closest('.go-profile');
  if (goProfile) { e.preventDefault(); switchTab('profile'); return; }
  const knownRemove = e.target.closest('.known-rm');
  if (knownRemove) {
    const set = knownRemove.dataset.kind === 'word' ? knownWords : knownKanji;
    set.toggle(knownRemove.dataset.key);
    usageJournal.record('known.change');
    leaveThen(knownRemove.closest('.known-chip'), () => refreshKnownEverywhere());
    return;
  }
  const rm = e.target.closest('.deck-rm');
  if (rm) {
    deck.remove(rm.dataset.key);
    leaveThen(rm.closest('tr'), () => { renderMyWords(); renderProfilePanel(); refreshReview(); });
  }
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
  if (!state.deck.length && !state.knownWords.length && !state.knownKanji.length && !Object.keys(state.reviewLog).length) {
    toast('Nothing to back up yet — save a word first.', 'error');
    return;
  }
  download(backupFilename(), serializeBackup(state, Date.now(), { appVersion: APP_VERSION }), 'application/json');
  usageJournal.record('profile.export');
  toast(`Profile exported with ${state.deck.length} saved card${state.deck.length === 1 ? '' : 's'}.`, 'success');
}

async function onBackupFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const inspected = inspectBackup(await file.text());
    const merged = mergeState(currentState(), inspected.state);
    pendingProfileImport = { ...inspected, merged, fileName: file.name };
    $('#profile-import-name').textContent = file.name;
    const date = inspected.meta.exportedAt ? new Date(inspected.meta.exportedAt).toLocaleString() : 'Export date unavailable';
    const app = inspected.meta.appVersion ? `Kotoba Lab ${inspected.meta.appVersion}` : `legacy profile format v${inspected.meta.version}`;
    $('#profile-import-meta').textContent = `${date} · ${app}`;
    $('#profile-import-counts').innerHTML = profileSummaryMarkup(inspected.meta.summary);
    $('#profile-import-impact').textContent = describeMerge(merged.stats);
    $('#profile-import-preview').hidden = false;
    $('#profile-import-merge').focus();
  } catch (err) {
    console.error(err);
    pendingProfileImport = null;
    $('#profile-import-preview').hidden = true;
    // inspectBackup's messages are written to be read by the person holding the
    // file — pass them through instead of a generic failure.
    toast(err.message || 'Could not read that profile.', 'error');
  } finally {
    e.target.value = ''; // allow re-importing the same file
  }
}

function closeProfileImport() {
  pendingProfileImport = null;
  $('#profile-import-preview').hidden = true;
}

function writeProfileState(state) {
  deck.replaceAll(state.deck);
  knownWords.replaceAll(state.knownWords);
  knownKanji.replaceAll(state.knownKanji);
  reviewLog.replaceAll(state.reviewLog);
  sessionCount = 0;
  refreshKnownEverywhere();
  refreshReview();
}

function applyProfileImport(mode) {
  if (!pendingProfileImport) return;
  if (mode === 'replace' && !confirm('Replace all local cards, known items, schedules, and review history with this profile? This cannot be undone without another exported profile.')) return;
  const next = mode === 'replace' ? pendingProfileImport.state : pendingProfileImport.merged.state;
  const message = mode === 'replace' ? 'Local profile replaced.' : describeMerge(pendingProfileImport.merged.stats);
  writeProfileState(next);
  closeProfileImport();
  toast(message, 'success');
}

function setProfileResetOpen(open) {
  $('#profile-reset-confirm').hidden = !open;
  $('#profile-reset-phrase').value = '';
  $('#profile-reset-apply').disabled = true;
  if (open) $('#profile-reset-phrase').focus();
  else $('#profile-reset-open').focus();
}

function resetProfileEverything() {
  if ($('#profile-reset-phrase').value !== 'RESET KOTOBA LAB') return;
  writeProfileState(emptyProfileState());
  usageJournal.clear({ disable: true });
  renderUsageJournal();
  closeProfileImport();
  closeStudyPack();
  setProfileResetOpen(false);
  toast('All local Kotoba Lab data was reset.', 'success');
}

// ---- portable study packs --------------------------------------------------
function studyPackSource() {
  const source = $('#study-pack-source').value;
  if (source === 'family') {
    return kanjiBrowseActiveFamily
      ? { source, title: kanjiBrowseActiveFamily.label, items: kanjiBrowseActiveFamily.rows }
      : { source, title: 'Selected kanji family', items: [] };
  }
  if (source === 'relations') {
    const root = relationsNetwork?.currentChar() || relationsMap?.currentChar() || relationsSeed;
    if (!root || !kanjiRelationshipIndex) return { source, title: 'Relations network', items: [] };
    const graphItems = relationsNetwork?.currentChar() === root
      ? relationsNetwork.graph()?.nodes?.map((node) => node.item)
      : null;
    const map = graphItems?.length ? null : buildKanjiRelationships(kanjiRelationshipIndex, root, relationsQueryOptions());
    return {
      source,
      title: `${root} relationship network`,
      items: graphItems?.length ? graphItems : [map?.center, ...(map?.neighbors || []).map((neighbor) => neighbor.item)].filter(Boolean),
    };
  }
  const chars = current?.kStats?.rows?.map((row) => row.ch) || [];
  const wanted = new Set(chars);
  return {
    source: 'text',
    title: 'Kanji from current text',
    items: kanjiCatalog.filter((item) => wanted.has(item.char)),
  };
}

function updateStudyPackSource({ replaceTitle = false } = {}) {
  const select = $('#study-pack-source');
  if (!select) return;
  const availability = {
    text: Boolean(current?.kStats?.rows?.length),
    family: Boolean(kanjiBrowseActiveFamily?.rows?.length),
    relations: Boolean((relationsNetwork?.currentChar() || relationsMap?.currentChar() || relationsSeed) && kanjiRelationshipIndex),
  };
  [...select.options].forEach((option) => { option.disabled = !availability[option.value]; });
  if (!availability[select.value]) select.value = Object.keys(availability).find((key) => availability[key]) || 'text';
  const pack = studyPackSource();
  $('#study-pack-source-status').textContent = pack.items.length
    ? `${pack.items.length.toLocaleString()} kanji ready · dictionary fields only · no personal study data.`
    : 'Open a text, select a Kanji family, or explore Relations to make that source available.';
  const title = $('#study-pack-title');
  if (replaceTitle || !title.value.trim()) title.value = pack.title;
  $('#study-pack-download').disabled = !pack.items.length;
}

function downloadStudyPack() {
  const source = studyPackSource();
  if (!source.items.length) { toast('That study-pack source is not available yet.', 'error'); return; }
  const title = $('#study-pack-title').value.trim() || source.title;
  const content = serializeStudyPack({ title, source: source.source, items: source.items }, Date.now(), { appVersion: APP_VERSION });
  download(studyPackFilename(title), content, 'application/json');
  usageJournal.record('pack.export');
  toast(`Exported ${source.items.length} kanji as a study pack.`, 'success');
}

async function onStudyPackFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    pendingStudyPack = parseStudyPack(await file.text());
    $('#study-pack-preview-title').textContent = pendingStudyPack.title;
    const date = pendingStudyPack.exportedAt ? new Date(pendingStudyPack.exportedAt).toLocaleString() : 'Export date unavailable';
    $('#study-pack-preview-meta').textContent = `${pendingStudyPack.kanji.length.toLocaleString()} kanji · ${date} · source: ${pendingStudyPack.source}`;
    const visible = pendingStudyPack.kanji.slice(0, 80);
    $('#study-pack-glyphs').innerHTML = visible.map((item) => `<span title="${esc(item.meaning || 'Meaning unavailable')}">${esc(item.char)}</span>`).join('')
      + (pendingStudyPack.kanji.length > visible.length ? `<small>+${pendingStudyPack.kanji.length - visible.length} more</small>` : '');
    $('#study-pack-preview').hidden = false;
    $('#study-pack-start').focus();
  } catch (error) {
    console.error(error);
    pendingStudyPack = null;
    $('#study-pack-preview').hidden = true;
    toast(error.message || 'Could not read that study pack.', 'error');
  } finally {
    event.target.value = '';
  }
}

function closeStudyPack() {
  pendingStudyPack = null;
  $('#study-pack-preview').hidden = true;
}

function startStudyPack() {
  const family = studyPackFamily(pendingStudyPack);
  if (!family) return;
  stopKanjiStudy();
  switchTab('kanji');
  kanjiBrowseActiveFamily = family;
  kanjiStudySession = createKanjiStudySession(family, 'study-pack');
  usageJournal.record('study.pack');
  closeStudyPack();
  renderKanjiStudy('reveal');
  revealKanjiWorkspace();
  toast(`Opened “${family.label}” as a temporary study session.`, 'success');
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
  setInfoSheet(false);
  renderTextJourney();
  renderRelationsSeeds();
  relationsMap?.update();
  relationsNetwork?.update();
  relationsAtlas?.update();
}
let currentTab = 'analyze';

// push=false when the change came from the history stack itself, so restoring a
// tab never pushes a duplicate entry.
function switchTab(name, push = true) {
  if (name !== 'relations') relationsAtlas?.setFocus(false);
  // [data-tab] rather than .tab so the header Data control shares the same
  // active-state and aria-current path as the six bottom-bar tabs.
  document.querySelectorAll('[data-tab]').forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle('is-active', active);
    if (active) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
  usageJournal.record(TAB_USAGE_EVENTS[name]);
  // The shared Text box feeds Analyze and Read only. The other tabs are
  // independent workspaces and should open at their own content immediately.
  $('.input-card').hidden = name === 'review' || name === 'kanji' || name === 'relations' || name === 'mywords' || name === 'profile';
  // cards come due while you're on another tab — recheck on arrival
  if (name === 'review') refreshReview();
  if (name === 'kanji') renderKanjiBrowser();
  if (name === 'mywords') renderMyWords();
  if (name === 'profile') renderProfilePanel();
  if (name === 'relations') {
    renderRelationsSeeds();
    loadRelationsWorkspace().catch((error) => console.error(error));
  }
  if (name !== 'read') setInfoSheet(false);
  if (window.matchMedia('(max-width: 780px)').matches) {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }
  // Arriving somewhere is navigation whether the user clicked a tab or followed
  // an in-app link, so both create history. Re-selecting the active tab does not.
  if (push && name !== currentTab) {
    history.pushState({ tab: name }, '', routeToHash(name));
  }
  currentTab = name;
}
// Marking a kanji known is the most consequential action in the app and used to
// be the quietest. Say what it actually bought: the words it just made readable.
// Call after the toggle, so the character already counts as known.
function knownToast(char, known) {
  if (!known) { toast(`${char} unmarked.`, 'success'); return; }
  const { total, words } = unlockedBy(vocabList, char, (c) => knownKanji.has(c), 3);
  if (!total) { toast(`✓ ${char} marked known.`, 'success'); return; }
  const shown = words.map((word) => word.w).join('、');
  const rest = total - words.length;
  toast(`✓ ${char} known — unlocks ${shown}${rest > 0 ? ` and ${rest} more` : ''}`, 'success');
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
  let relationsDebounce;
  $('#input').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(run, 250);
  });
  $('#samples').addEventListener('click', (e) => {
    const b = e.target.closest('.sample'); if (!b) return;
    $('#input').value = samples[Number(b.dataset.i)].text; run();
  });
  $('#clear').addEventListener('click', () => { $('#input').value = ''; run(); $('#input').focus(); });
  document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#info-close').addEventListener('click', () => setInfoSheet(false));
  $('#info-scrim').addEventListener('click', () => setInfoSheet(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setInfoSheet(false);
  });
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
  $('#relations-search').addEventListener('input', () => {
    clearTimeout(relationsDebounce);
    relationsDebounce = setTimeout(renderRelationsSearch, 100);
  });
  $('#relations-search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const rows = renderRelationsSearch();
    const literal = [...$('#relations-search').value.trim()];
    const char = literal.length === 1 && isKanji(literal[0]) ? literal[0] : rows[0]?.char;
    if (char) selectRelationsSeed(char, $('#relations-search-form button[type="submit"]'));
    else toast('Choose a matching kanji first.', 'error');
  });
  $('#relations-panel').addEventListener('click', (event) => {
    const seed = event.target.closest('[data-relations-seed]');
    if (seed) { selectRelationsSeed(seed.dataset.relationsSeed, seed); return; }
    if (event.target.closest('[data-relations-surprise]')) {
      const item = kanjiCatalog[Math.floor(Math.random() * kanjiCatalog.length)];
      if (item) selectRelationsSeed(item.char, event.target.closest('[data-relations-surprise]'));
    }
  });
  $('#relations-filters').addEventListener('change', () => {
    relationsMap?.update();
    relationsNetwork?.update();
    relationsAtlas?.update();
  });
  $('#relations-reset').addEventListener('click', resetRelationsFilters);
  document.querySelectorAll('[data-relations-view]').forEach((button) => button.addEventListener('click', () => {
    setRelationsView(button.dataset.relationsView).catch((error) => {
      console.error(error);
      toast('Could not open that Relations view — try again.', 'error');
    });
  }));
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
  $('#kanji-filter-toggle').addEventListener('click', () => {
    const filters = $('#kanji-advanced-filters');
    const open = filters.classList.toggle('is-open');
    $('#kanji-filter-toggle').setAttribute('aria-expanded', String(open));
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
  $('#kanji-mix-open').addEventListener('click', openFamilyMixSetup);
  $('#kanji-alchemy-open').addEventListener('click', (event) => openKanjiAlchemy(event.currentTarget));
  $('#kanji-alchemy-workspace').addEventListener('click', onKanjiAlchemyAction);
  $('#kanji-study-workspace').addEventListener('click', onKanjiStudyAction);
  $('#text-journey').addEventListener('click', onTextJourneyAction);
  $('#info').addEventListener('click', onInfoAction);
  $('#mywords-panel').addEventListener('click', onMyWordsClick);
  $('#mw-copy').addEventListener('click', () => exportDeck(false));
  $('#mw-download').addEventListener('click', () => exportDeck(true));
  $('#mw-backup-download').addEventListener('click', downloadBackup);
  $('#mw-backup-file').addEventListener('change', onBackupFile);
  $('#profile-import-cancel').addEventListener('click', closeProfileImport);
  $('#profile-import-merge').addEventListener('click', () => applyProfileImport('merge'));
  $('#profile-import-replace').addEventListener('click', () => applyProfileImport('replace'));
  $('#profile-reset-open').addEventListener('click', () => setProfileResetOpen(true));
  $('#profile-reset-cancel').addEventListener('click', () => setProfileResetOpen(false));
  $('#profile-reset-phrase').addEventListener('input', (event) => {
    $('#profile-reset-apply').disabled = event.target.value !== 'RESET KOTOBA LAB';
  });
  $('#profile-reset-apply').addEventListener('click', resetProfileEverything);
  $('#usage-journal-toggle').addEventListener('click', () => {
    const enabled = usageJournal.setEnabled(!usageJournal.isEnabled());
    renderUsageJournal();
    toast(enabled ? 'Local usage journal enabled.' : 'Usage journal paused.', 'success');
  });
  $('#usage-journal-clear').addEventListener('click', () => {
    if (!confirm('Reset the local usage journal? This clears its daily totals but leaves your study profile untouched.')) return;
    usageJournal.clear();
    renderUsageJournal();
    toast('Usage journal reset.', 'success');
  });
  $('#usage-report-toggle').addEventListener('click', () => setUsageReportPreview(!usageReportPreviewOpen));
  $('#usage-report-copy').addEventListener('click', copyUsageReport);
  $('#usage-report-download').addEventListener('click', downloadUsageReport);
  $('#study-pack-source').addEventListener('change', () => updateStudyPackSource({ replaceTitle: true }));
  $('#study-pack-download').addEventListener('click', downloadStudyPack);
  $('#study-pack-file').addEventListener('change', onStudyPackFile);
  $('#study-pack-cancel').addEventListener('click', closeStudyPack);
  $('#study-pack-start').addEventListener('click', startStudyPack);
  let wordLookupDebounce;
  $('#wl-search').addEventListener('input', () => {
    clearTimeout(wordLookupDebounce);
    wordLookupDebounce = setTimeout(renderWordLookup, 200);
  });
  $('#wl-level').addEventListener('change', renderWordLookup);
  $('#wl-readable').addEventListener('change', renderWordLookup);
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
    renderProfilePanel();
    refreshReview();
  });
  $('#review-panel').addEventListener('click', onReviewClick);
  $('#srs-new-limit').addEventListener('change', refreshReview);
  $('#srs-direction').addEventListener('change', renderStage);
  document.addEventListener('keydown', onReviewKey);
  document.addEventListener('keydown', onKanjiStudyKey);
  document.addEventListener('keydown', onKanjiAlchemyKey);
  // One delegated path covers dynamic Read, Review, and My Words markup.
  document.addEventListener('click', (event) => {
    // Save an unlocked compound straight into the review deck. There is no
    // source text here, so the entry carries no sentence context.
    const compoundSave = event.target.closest?.('[data-compound-save]');
    if (compoundSave) {
      const surface = compoundSave.dataset.compoundSave;
      const entry = vocabList.find((row) => row.w === surface);
      if (entry) {
        const now = deck.toggle({
          surface, reading: entry.r || '', gloss: entry.g || '',
          level: Number.isFinite(entry.lvl) ? entry.lvl : null, srs: newCard(),
        });
        toast(now ? 'Saved to deck — due for review now.' : 'Removed from deck.', 'success');
        renderMyWords();
        renderWordLookup();
        renderProfilePanel();
        refreshReview();
      }
      return;
    }
    // Batch marking from the Kanji library: toggle without opening the card.
    const knownToggle = event.target.closest?.('[data-kanji-known]');
    if (knownToggle) {
      const target = knownToggle.dataset.kanjiKnown;
      if (target && [...target].length === 1) {
        knownKanji.toggle(target);
        usageJournal.record('known.change');
        // A known-state filter decides which cards belong in the results, so it
        // still needs the full rebuild. Otherwise the grid is already right.
        const filtered = $('#kanji-known')?.value !== 'all';
        if (!filtered) patchKanjiCardKnown(knownToggle, target);
        refreshKnownEverywhere({ skipKanjiBrowser: !filtered });
        knownToast(target, knownKanji.has(target));
      }
      return;
    }
    const mapDoorway = event.target.closest?.('[data-kanji-map]');
    if (mapDoorway && !mapDoorway.closest('.krm-overlay')) {
      openKanjiMap(mapDoorway.dataset.kanjiMap, mapDoorway);
      return;
    }
    const doorway = event.target.closest?.('[data-kanji-tree]');
    if (!doorway || doorway.closest('.kt-overlay') || !kanjiTree) return;
    const char = doorway.dataset.kanjiTree;
    if (!char || [...char].length !== 1) return;
    openKanjiTree(char, doorway);
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

// ---- offline support --------------------------------------------------------
// Registration is entirely optional. An unsupported browser, an insecure
// context, or disabled workers must leave the application behaving exactly as
// it does without a worker — no banner, no console noise, and no interaction
// with the #boot-warning fallback.

function promptForUpdate(worker) {
  // The toast helper supports only 'success' and 'error'; an update notice is
  // neither, so it uses the neutral default.
  toast('New version ready · reload to update');
  const bar = $('#sw-update');
  if (!bar) return;
  bar.hidden = false;
  $('#sw-update-reload').onclick = () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}

function registerOfflineWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js', { type: 'module' });

      // Ask Android not to evict the cache under storage pressure. A refusal
      // changes nothing and is never surfaced.
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // Reaching "installed" while a worker already controls the page means
          // an update, not a first install.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            promptForUpdate(installing);
          }
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch {
      // Offline support is a bonus, never a requirement.
    }
  });
}

// The browser build plus every dictionary shard kuromoji fetches at runtime.
// cache.addAll needs concrete URLs, so these are listed explicitly.
const KUROMOJI_FILES = [
  './vendor/kuromoji/kuromoji.js',
  './vendor/kuromoji/dict/base.dat.gz',
  './vendor/kuromoji/dict/cc.dat.gz',
  './vendor/kuromoji/dict/check.dat.gz',
  './vendor/kuromoji/dict/tid.dat.gz',
  './vendor/kuromoji/dict/tid_map.dat.gz',
  './vendor/kuromoji/dict/tid_pos.dat.gz',
  './vendor/kuromoji/dict/unk.dat.gz',
  './vendor/kuromoji/dict/unk_char.dat.gz',
  './vendor/kuromoji/dict/unk_compat.dat.gz',
  './vendor/kuromoji/dict/unk_invoke.dat.gz',
  './vendor/kuromoji/dict/unk_map.dat.gz',
  './vendor/kuromoji/dict/unk_pos.dat.gz',
];

const OFFLINE_CORE_SAMPLE = ['./index.html', './data/kanjidic.json', './data/kanjivg.json'];

async function cachedCount(paths) {
  if (!('caches' in window)) return 0;
  try {
    const cache = await caches.open(cacheNameFor(APP_VERSION));
    const found = await Promise.all(paths.map((path) => cache.match(path)));
    return found.filter(Boolean).length;
  } catch {
    return 0;
  }
}

// Availability is read from the cache every time rather than stored, so there
// is no "downloaded" flag to go stale and no sixth localStorage key.
async function renderOfflineStatus() {
  const host = $('#offline-rows');
  const badge = $('#offline-store-status');
  if (!host || !badge) return;

  if (!('caches' in window) || !('serviceWorker' in navigator)) {
    badge.textContent = 'Unavailable';
    badge.dataset.status = 'archive';
    host.innerHTML = '<p class="hint">This browser does not store files for offline use. Kotoba Lab still works normally with a connection.</p>';
    return;
  }

  const core = await cachedCount(OFFLINE_CORE_SAMPLE);
  const kuromoji = await cachedCount(KUROMOJI_FILES);
  const coreReady = core === OFFLINE_CORE_SAMPLE.length;
  const kuromojiReady = kuromoji === KUROMOJI_FILES.length;

  badge.textContent = coreReady ? 'Available offline' : 'Preparing…';
  badge.dataset.status = coreReady ? 'stable' : 'archive';

  host.innerHTML = `
    <div class="offline-row">
      <div><strong>App, dictionaries and stroke data</strong><span class="hint">8.5 MB · includes Radical Tree strokes</span></div>
      <span class="badge" data-status="${coreReady ? 'stable' : 'archive'}">${coreReady ? '✓ Available offline' : 'Preparing…'}</span>
    </div>
    <div class="offline-row">
      <div><strong>Precise tokenizer (optional)</strong><span class="hint">18 MB · only needed for the kuromoji tokenizer</span></div>
      ${kuromojiReady
        ? '<span class="badge" data-status="stable">✓ Available offline</span>'
        : '<button type="button" id="offline-get-kuromoji" class="btn">Download</button>'}
    </div>`;

  const button = $('#offline-get-kuromoji');
  if (button) button.onclick = () => downloadKuromoji(button);
}

async function downloadKuromoji(button) {
  button.disabled = true;
  button.textContent = 'Downloading…';
  try {
    const cache = await caches.open(cacheNameFor(APP_VERSION));
    await cache.addAll(KUROMOJI_FILES);
    toast('Tokenizer available offline', 'success');
  } catch (error) {
    const quota = error && error.name === 'QuotaExceededError';
    toast(quota ? 'Not enough storage for the 18 MB tokenizer' : 'Download failed — try again online', 'error');
  }
  renderOfflineStatus();
}

// ---- routing -----------------------------------------------------------------
// Tabs live in the hash so the back gesture steps back through views instead of
// leaving an installed app. Full-screen overlays keep their own Close buttons
// and are deliberately not routed.

window.addEventListener('popstate', (event) => {
  // state is null after a browser session restore, so fall back to the URL.
  const tab = event.state?.tab || parseRoute(location.hash).tab;
  switchTab(tab, false);
});

function applyInitialRoute() {
  const { tab } = parseRoute(location.hash);
  // Exactly one entry for the entry point, so back from it leaves the app.
  history.replaceState({ tab }, '', routeToHash(tab));
  // boot() already renders Analyze as active; only move if the URL asks for
  // something else, so an ordinary load records no extra usage event.
  if (tab !== 'analyze') switchTab(tab, false);
  currentTab = tab;
}

boot();
applyInitialRoute();
registerOfflineWorker();
renderOfflineStatus();
