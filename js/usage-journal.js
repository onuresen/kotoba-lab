// Opt-in, local-only coarse usage counters. No payload API exists on purpose:
// callers can record approved event names, never text, kanji, queries, or files.

export const USAGE_STORAGE_KEY = 'kotoba-lab:usage-journal';
export const USAGE_JOURNAL_VERSION = 1;
export const USAGE_EVENTS = Object.freeze([
  'tab.analyze', 'tab.read', 'tab.kanji', 'tab.relations', 'tab.review', 'tab.mywords', 'tab.profile',
  'tab.achievements', 'tab.alchemy', 'tab.words', 'tab.insights',
  'analyze.run', 'tree.open', 'relations.open', 'atlas.open', 'study.family', 'study.pack', 'study.atlas',
  'study.falsefriends', 'study.mystery',
  'review.answer', 'profile.export', 'pack.export', 'known.change',
  'report.export',
]);

const ALLOWED_EVENTS = new Set(USAGE_EVENTS);

function emptyState(enabled = false) {
  return { version: USAGE_JOURNAL_VERSION, enabled, days: {} };
}

function dayKey(value) {
  return new Date(value).toLocaleDateString('en-CA');
}

function cleanState(raw, keepDays) {
  const state = emptyState(raw?.enabled === true);
  if (!raw?.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return state;
  const keys = Object.keys(raw.days).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort().slice(-keepDays);
  for (const day of keys) {
    const source = raw.days[day];
    if (!source || typeof source !== 'object') continue;
    const events = {};
    for (const [event, count] of Object.entries(source.events || {})) {
      if (ALLOWED_EVENTS.has(event) && Number.isFinite(count) && count > 0) events[event] = Math.round(count);
    }
    state.days[day] = {
      sessions: Math.max(0, Math.round(Number(source.sessions) || 0)),
      activeMinutes: Math.max(0, Math.round(Number(source.activeMinutes) || 0)),
      events,
    };
  }
  return state;
}

export function createUsageJournal({ storage = globalThis.localStorage, now = () => Date.now(), keepDays = 90 } = {}) {
  let state;
  try {
    state = cleanState(JSON.parse(storage?.getItem(USAGE_STORAGE_KEY) || 'null'), keepDays);
  } catch {
    state = emptyState();
  }
  let sessionRecorded = false;

  const persist = () => {
    try { storage?.setItem(USAGE_STORAGE_KEY, JSON.stringify(state)); } catch { /* session-only fallback */ }
  };
  const today = () => {
    const key = dayKey(now());
    if (!state.days[key]) state.days[key] = { sessions: 0, activeMinutes: 0, events: {} };
    const keys = Object.keys(state.days).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - keepDays))) delete state.days[old];
    return state.days[key];
  };

  function startSession() {
    if (!state.enabled || sessionRecorded) return false;
    today().sessions += 1;
    sessionRecorded = true;
    persist();
    return true;
  }

  function setEnabled(enabled) {
    state.enabled = enabled === true;
    if (state.enabled) startSession();
    persist();
    return state.enabled;
  }

  function record(event) {
    if (!state.enabled || !ALLOWED_EVENTS.has(event)) return false;
    startSession();
    const day = today();
    day.events[event] = (day.events[event] || 0) + 1;
    persist();
    return true;
  }

  function tickActiveMinute() {
    if (!state.enabled) return false;
    startSession();
    today().activeMinutes += 1;
    persist();
    return true;
  }

  function summary() {
    const rows = Object.values(state.days);
    const events = {};
    for (const row of rows) {
      for (const [event, count] of Object.entries(row.events)) events[event] = (events[event] || 0) + count;
    }
    const todayRow = state.days[dayKey(now())] || { sessions: 0, activeMinutes: 0, events: {} };
    return {
      enabled: state.enabled,
      days: rows.length,
      sessions: rows.reduce((sum, row) => sum + row.sessions, 0),
      activeMinutes: rows.reduce((sum, row) => sum + row.activeMinutes, 0),
      eventCount: Object.values(events).reduce((sum, count) => sum + count, 0),
      events,
      today: {
        sessions: todayRow.sessions,
        activeMinutes: todayRow.activeMinutes,
        eventCount: Object.values(todayRow.events).reduce((sum, count) => sum + count, 0),
      },
    };
  }

  function clear({ disable = false } = {}) {
    state = emptyState(disable ? false : state.enabled);
    sessionRecorded = false;
    persist();
  }

  return {
    isEnabled: () => state.enabled,
    setEnabled,
    startSession,
    record,
    tickActiveMinute,
    summary,
    clear,
    all: () => JSON.parse(JSON.stringify(state)),
  };
}
