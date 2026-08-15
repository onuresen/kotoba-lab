import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTABLE_TABS,
  isRoutableTab,
  tabToRoute,
  routeToTab,
  parseRoute,
  routeToHash,
} from './routing.js';

test('every application tab is routable', () => {
  assert.deepEqual([...ROUTABLE_TABS].sort(),
    ['analyze', 'kanji', 'mywords', 'profile', 'read', 'relations', 'review']);
});

test('hashes parse in every shape a URL bar can produce', () => {
  assert.equal(parseRoute('#kanji').tab, 'kanji');
  assert.equal(parseRoute('kanji').tab, 'kanji');
  assert.equal(parseRoute('#/kanji').tab, 'kanji');
  assert.equal(parseRoute('#KANJI').tab, 'kanji');
});

test('unknown, empty, and malformed hashes fall back to analyze', () => {
  assert.equal(parseRoute('').tab, 'analyze');
  assert.equal(parseRoute('#').tab, 'analyze');
  assert.equal(parseRoute('#nonsense').tab, 'analyze');
  assert.equal(parseRoute(null).tab, 'analyze');
  assert.equal(parseRoute(undefined).tab, 'analyze');
  assert.equal(parseRoute(42).tab, 'analyze');
});

test('the profile tab is reached only through the settings route', () => {
  assert.equal(parseRoute('#settings').tab, 'profile');
  assert.equal(routeToHash('profile'), '#settings');
  // The internal name must not work as a URL, or two URLs would mean one view.
  assert.equal(parseRoute('#profile').tab, 'analyze');
});

test('route and tab names translate both ways and leave others alone', () => {
  assert.equal(tabToRoute('profile'), 'settings');
  assert.equal(routeToTab('settings'), 'profile');
  assert.equal(tabToRoute('kanji'), 'kanji');
  assert.equal(routeToTab('kanji'), 'kanji');
});

test('hashes round-trip for every routable tab', () => {
  for (const tab of ROUTABLE_TABS) {
    assert.equal(parseRoute(routeToHash(tab)).tab, tab, `round trip failed for ${tab}`);
  }
});

test('isRoutableTab rejects unknown names and non-strings', () => {
  assert.equal(isRoutableTab('kanji'), true);
  assert.equal(isRoutableTab('settings'), false); // a route name, not a tab name
  assert.equal(isRoutableTab('nonsense'), false);
  assert.equal(isRoutableTab(null), false);
  assert.equal(isRoutableTab(7), false);
});

test('routeToHash falls back rather than emitting an unreachable URL', () => {
  assert.equal(routeToHash('nonsense'), '#analyze');
  assert.equal(routeToHash(null), '#analyze');
});
