// routing.js — the hash-route vocabulary, kept pure so it can be tested without
// a browser. Two vocabularies meet here and nowhere else:
//
//   tab name   internal, used by switchTab() and data-tab  ... 'profile'
//   route name what the user sees in the URL               ... 'settings'
//
// app.js only ever handles tab names.

export const ROUTABLE_TABS = Object.freeze([
  'analyze', 'read', 'kanji', 'relations', 'review', 'mywords', 'profile', 'achievements', 'alchemy', 'words',
]);

const DEFAULT_TAB = 'analyze';
const TAB_TO_ROUTE = Object.freeze({ profile: 'settings' });
const ROUTE_TO_TAB = Object.freeze({ settings: 'profile' });

export function isRoutableTab(name) {
  return typeof name === 'string' && ROUTABLE_TABS.includes(name);
}

export function tabToRoute(tab) {
  return Object.prototype.hasOwnProperty.call(TAB_TO_ROUTE, tab) ? TAB_TO_ROUTE[tab] : tab;
}

export function routeToTab(route) {
  return Object.prototype.hasOwnProperty.call(ROUTE_TO_TAB, route) ? ROUTE_TO_TAB[route] : route;
}

export function parseRoute(hash) {
  const raw = String(hash ?? '').replace(/^#/, '').replace(/^\//, '').trim().toLowerCase();
  // A tab that has its own route name must not also answer to its internal
  // name, or one view would have two URLs.
  if (Object.prototype.hasOwnProperty.call(TAB_TO_ROUTE, raw)) return { tab: DEFAULT_TAB };
  const tab = routeToTab(raw);
  return { tab: isRoutableTab(tab) ? tab : DEFAULT_TAB };
}

export function routeToHash(tab) {
  return `#${tabToRoute(isRoutableTab(tab) ? tab : DEFAULT_TAB)}`;
}
