function dominantReading(rows) {
  const counts = new Map();
  const displays = new Map();
  for (const row of rows) {
    for (const reading of row._onReadings || []) {
      counts.set(reading.key, (counts.get(reading.key) || 0) + 1);
      displays.set(reading.key, reading.display);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  if (!ranked.length) return null;
  const [key, count] = ranked[0];
  return { key, display: displays.get(key) || key, count };
}

export function buildPhoneticSignals(rows, structureIndex, options = {}) {
  const minReadable = Number.isInteger(options.minReadable) ? options.minReadable : 3;
  const minMatches = Number.isInteger(options.minMatches) ? options.minMatches : 2;
  const minConfidence = Number.isInteger(options.minConfidence) ? options.minConfidence : 50;
  const byComponent = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?._onReadings?.length) continue;
    const components = structureIndex?.byKanji?.get(row.char)?.components || [];
    for (const component of components) {
      if (!byComponent.has(component)) byComponent.set(component, []);
      byComponent.get(component).push(row);
    }
  }

  return [...byComponent.entries()].map(([component, readableRows]) => {
    const dominant = dominantReading(readableRows);
    if (!dominant || readableRows.length < minReadable || dominant.count < minMatches) return null;
    const matches = [];
    const exceptions = [];
    for (const row of readableRows) {
      (row._onReadings.some((reading) => reading.key === dominant.key) ? matches : exceptions).push(row);
    }
    const confidence = Math.round((matches.length / readableRows.length) * 100);
    if (confidence < minConfidence) return null;
    return {
      key: component,
      component,
      label: `${component} → ${dominant.display}`,
      readingKey: dominant.key,
      reading: dominant.display,
      confidence,
      matches,
      exceptions,
      rows: readableRows,
    };
  }).filter(Boolean).sort((a, b) =>
    b.confidence - a.confidence
      || b.matches.length - a.matches.length
      || b.rows.length - a.rows.length
      || a.component.localeCompare(b.component, 'ja'));
}

export function createPhoneticSession(signal) {
  if (!signal?.key || !signal?.rows?.length || !signal.readingKey) return null;
  return {
    kind: 'phonetic',
    key: signal.key,
    label: signal.label,
    component: signal.component,
    readingKey: signal.readingKey,
    reading: signal.reading,
    confidence: signal.confidence,
    rows: [...signal.rows],
    index: 0,
    revealed: false,
    studied: new Set(),
    answers: new Map(),
  };
}

export function phoneticCardMatches(session, row = session?.rows?.[session?.index]) {
  return !!row?._onReadings?.some((reading) => reading.key === session?.readingKey);
}

export function answerPhoneticCard(session, predictsMatch) {
  const row = session?.rows?.[session?.index];
  if (!row) return session;
  const actual = phoneticCardMatches(session, row);
  const answers = new Map(session.answers);
  answers.set(row.char, { guess: !!predictsMatch, actual, correct: !!predictsMatch === actual });
  const studied = new Set(session.studied);
  studied.add(row.char);
  return { ...session, revealed: true, answers, studied };
}

export function phoneticScore(session) {
  const answers = [...(session?.answers?.values() || [])];
  return {
    answered: answers.length,
    correct: answers.filter((answer) => answer.correct).length,
  };
}

function distinctRows(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    row?.char && row.meaning && !seen.has(row.char) && seen.add(row.char));
}

export function buildContrastSets(rows, structureIndex, options = {}) {
  const minSize = Number.isInteger(options.minSize) ? options.minSize : 3;
  const maxSize = Number.isInteger(options.maxSize) ? options.maxSize : 5;
  const byComponent = new Map();

  for (const row of distinctRows(rows)) {
    const components = new Set(structureIndex?.byKanji?.get(row.char)?.components || []);
    for (const component of components) {
      if (component === row.char) continue;
      if (!byComponent.has(component)) byComponent.set(component, []);
      byComponent.get(component).push(row);
    }
  }

  return [...byComponent.entries()].map(([component, members]) => {
    const meaningSeen = new Set();
    const contrastRows = members.filter((row) => {
      const meaningKey = row.meaning.trim().toLocaleLowerCase('en');
      return meaningKey && !meaningSeen.has(meaningKey) && meaningSeen.add(meaningKey);
    }).slice(0, Math.max(minSize, maxSize));
    if (contrastRows.length < minSize) return null;
    return {
      key: component,
      component,
      label: `${component} contrast`,
      rows: contrastRows,
      gradedCount: contrastRows.filter((row) => row.jlpt != null).length,
    };
  }).filter(Boolean).sort((a, b) =>
    b.gradedCount - a.gradedCount
      || b.rows.length - a.rows.length
      || a.component.localeCompare(b.component, 'ja'));
}

export function createContrastSession(contrastSet) {
  if (!contrastSet?.key || contrastSet?.rows?.length < 3) return null;
  return {
    kind: 'contrast',
    key: contrastSet.key,
    label: contrastSet.label,
    component: contrastSet.component,
    rows: [...contrastSet.rows],
    index: 0,
    revealed: false,
    studied: new Set(),
    answers: new Map(),
  };
}

export function contrastQuestion(session) {
  const target = session?.rows?.[session?.index];
  if (!target) return null;
  if (session.index % 2 === 1) {
    const uniqueReading = target._onReadings?.find((reading) =>
      session.rows.filter((row) => row._onReadings?.some((item) => item.key === reading.key)).length === 1);
    if (uniqueReading) {
      return {
        type: 'on-reading',
        clue: uniqueReading.display,
        prompt: `Which kanji has the listed on’yomi ${uniqueReading.display}?`,
        target,
      };
    }
  }
  return {
    type: 'meaning',
    clue: target.meaning,
    prompt: `Which kanji best matches “${target.meaning}”?`,
    target,
  };
}

export function answerContrastCard(session, chosenChar) {
  const question = contrastQuestion(session);
  if (!question || !session.rows.some((row) => row.char === chosenChar)) return session;
  const answers = new Map(session.answers);
  answers.set(question.target.char, {
    chosen: chosenChar,
    correct: chosenChar === question.target.char,
    type: question.type,
  });
  const studied = new Set(session.studied);
  studied.add(question.target.char);
  return { ...session, revealed: true, answers, studied };
}

export function contrastScore(session) {
  const answers = [...(session?.answers?.values() || [])];
  return {
    answered: answers.length,
    correct: answers.filter((answer) => answer.correct).length,
  };
}

export function buildFamilyMix(families, selectedKeys, options = {}) {
  const keys = [...new Set(Array.isArray(selectedKeys) ? selectedKeys : [])].slice(0, 5);
  if (keys.length < 2) return null;
  const selected = keys.map((key) => (Array.isArray(families) ? families : []).find((family) => family.key === key)).filter(Boolean);
  if (selected.length !== keys.length) return null;
  const memberships = new Map();
  for (const family of selected) {
    for (const row of family.rows || []) {
      if (!memberships.has(row.char)) memberships.set(row.char, []);
      memberships.get(row.char).push(family.key);
    }
  }
  const pools = selected.map((family) => ({
    family,
    rows: (family.rows || []).filter((row) => memberships.get(row.char)?.length === 1),
  }));
  if (pools.some((pool) => !pool.rows.length)) return null;
  const maxQuestions = Number.isInteger(options.maxQuestions) ? options.maxQuestions : 20;
  const questions = [];
  let round = 0;
  while (questions.length < maxQuestions) {
    let added = false;
    for (const pool of pools) {
      const row = pool.rows[round];
      if (!row || questions.length >= maxQuestions) continue;
      questions.push({ ...row, mixFamilyKey: pool.family.key, mixFamilyLabel: pool.family.label });
      added = true;
    }
    if (!added) break;
    round += 1;
  }
  return { key: keys.join('|'), label: `${selected.length}-family mix`, families: selected, rows: questions };
}

export function createFamilyMixSession(mix) {
  if (!mix?.rows?.length || mix?.families?.length < 2) return null;
  return {
    kind: 'mix', key: mix.key, label: mix.label, families: mix.families,
    rows: [...mix.rows], index: 0, revealed: false, studied: new Set(), answers: new Map(),
  };
}

export function answerFamilyMix(session, familyKey) {
  const row = session?.rows?.[session?.index];
  if (!row || !session.families.some((family) => family.key === familyKey)) return session;
  const answers = new Map(session.answers);
  answers.set(row.char, { chosen: familyKey, actual: row.mixFamilyKey, correct: familyKey === row.mixFamilyKey });
  const studied = new Set(session.studied);
  studied.add(row.char);
  return { ...session, revealed: true, answers, studied };
}

export function familyMixScore(session) {
  const answers = [...(session?.answers?.values() || [])];
  return { answered: answers.length, correct: answers.filter((answer) => answer.correct).length };
}
