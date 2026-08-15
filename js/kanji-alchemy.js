function codePointCount(value) {
  return [...String(value || '')].length;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(rows, random) {
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function choiceValue(choice) {
  return String(choice?.value ?? choice?.char ?? choice ?? '');
}

function cloneQuestion(question) {
  return {
    ...question,
    ingredients: [...question.ingredients],
    target: { ...question.target },
    choices: question.choices.map((choice) => ({ ...choice })),
    ...(question.chain ? { chain: { ...question.chain, glyphs: [...question.chain.glyphs] } } : {}),
  };
}

export const ALCHEMY_MODES = Object.freeze(['result', 'missing', 'reverse', 'chain']);

export function buildAlchemyRecipes(catalog, structureIndex) {
  const grouped = new Map();
  for (const target of Array.isArray(catalog) ? catalog : []) {
    const components = [...new Set(structureIndex?.byKanji?.get(target.char)?.components || [])]
      .filter((component) => component !== target.char && codePointCount(component) === 1);
    if (components.length !== 2 || !target.meaning) continue;
    const ingredients = [...components].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
    const key = ingredients.join('|');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ key, ingredients, target });
  }
  return [...grouped.values()]
    .filter((recipes) => recipes.length === 1)
    .map(([recipe]) => recipe)
    .sort((a, b) => a.target.char.codePointAt(0) - b.target.char.codePointAt(0));
}

export function buildAlchemyChains(recipes, maxLength = 3) {
  const rows = Array.isArray(recipes) ? recipes : [];
  const limit = Math.max(2, Math.min(4, Number(maxLength) || 3));
  const chains = [];
  const seen = new Set();
  for (const start of rows) {
    const chain = [start];
    const used = new Set([start.target.char]);
    while (chain.length < limit) {
      const previous = chain[chain.length - 1];
      const next = rows.find((recipe) => recipe.ingredients.includes(previous.target.char) && !used.has(recipe.target.char));
      if (!next) break;
      chain.push(next);
      used.add(next.target.char);
    }
    if (chain.length < 2) continue;
    const key = chain.map((recipe) => recipe.target.char).join('>');
    if (!seen.has(key)) {
      seen.add(key);
      chains.push(chain);
    }
  }
  return chains;
}

function pickRecipes(recipes, count, random) {
  const selected = [];
  for (const level of [5, 4, 3, 2, 1]) {
    if (selected.length >= count) break;
    const family = recipes.filter((recipe) => recipe.target.jlpt === level);
    if (family.length) selected.push(family[Math.floor(random() * family.length)]);
  }
  for (const recipe of shuffle(recipes, random)) {
    if (selected.length >= count) break;
    if (!selected.some((entry) => entry.target.char === recipe.target.char)) selected.push(recipe);
  }
  return selected;
}

function pickResultChoices(recipe, recipes, choiceCount, random) {
  const pool = shuffle(recipes.filter((entry) => entry.target.char !== recipe.target.char), random)
    .sort((a, b) => {
      const levelA = a.target.jlpt === recipe.target.jlpt ? 0 : 1;
      const levelB = b.target.jlpt === recipe.target.jlpt ? 0 : 1;
      return levelA - levelB || Math.abs(a.target.strokes - recipe.target.strokes) - Math.abs(b.target.strokes - recipe.target.strokes);
    });
  return shuffle([recipe, ...pool.slice(0, choiceCount - 1)], random).map((entry) => ({
    value: entry.target.char,
    glyph: entry.target.char,
    label: entry.target.meaning,
    jlpt: entry.target.jlpt,
  }));
}

function pickMissingChoices(recipe, recipes, missing, choiceCount, random) {
  const components = [...new Set(recipes.flatMap((entry) => entry.ingredients))]
    .filter((component) => component !== missing && !recipe.ingredients.includes(component));
  return shuffle([missing, ...shuffle(components, random).slice(0, choiceCount - 1)], random)
    .map((component) => ({ value: component, glyph: component, label: 'visual component' }));
}

function pickReverseChoices(recipe, recipes, choiceCount, random) {
  const pool = shuffle(recipes.filter((entry) => entry.key !== recipe.key), random);
  return shuffle([recipe, ...pool.slice(0, choiceCount - 1)], random).map((entry) => ({
    value: entry.key,
    glyph: entry.ingredients.join(' ＋ '),
    label: 'direct components',
  }));
}

function makeQuestion(recipe, mode, recipes, choiceCount, random, index, date, extra = {}) {
  const missingIndex = mode === 'missing' ? Math.floor(random() * 2) : -1;
  const missing = missingIndex >= 0 ? recipe.ingredients[missingIndex] : '';
  const choices = mode === 'missing'
    ? pickMissingChoices(recipe, recipes, missing, choiceCount, random)
    : mode === 'reverse'
      ? pickReverseChoices(recipe, recipes, choiceCount, random)
      : pickResultChoices(recipe, recipes, choiceCount, random);
  return {
    id: `${date}:${mode}:${index + 1}:${recipe.target.char}`,
    mode,
    ingredients: [...recipe.ingredients],
    target: { ...recipe.target },
    answer: mode === 'missing' ? missing : mode === 'reverse' ? recipe.key : recipe.target.char,
    choices,
    ...(missingIndex >= 0 ? { missingIndex } : {}),
    ...extra,
  };
}

export function buildAlchemyChallenge(catalog, structureIndex, options = {}) {
  const date = String(options.date || new Date().toLocaleDateString('en-CA'));
  const mode = ALCHEMY_MODES.includes(options.mode) ? options.mode : 'result';
  const count = Math.max(1, Number(options.count) || 5);
  const choiceCount = Math.max(2, Number(options.choiceCount) || 4);
  const known = new Set(Array.isArray(options.knownChars) ? options.knownChars : []);
  const knownFilter = options.knownFilter === 'unknown' || options.knownFilter === 'known' ? options.knownFilter : 'all';
  const recipes = buildAlchemyRecipes(catalog, structureIndex);
  const eligible = recipes.filter((recipe) => knownFilter === 'all'
    || (knownFilter === 'known' ? known.has(recipe.target.char) : !known.has(recipe.target.char)));
  if (!eligible.length || recipes.length < choiceCount) return null;

  const random = seededRandom(`kotoba-alchemy:${date}:${mode}:${knownFilter}`);
  let selected = [];
  let chain = null;
  if (mode === 'chain') {
    const eligibleChars = new Set(eligible.map((recipe) => recipe.target.char));
    const chains = buildAlchemyChains(recipes).filter((entry) => entry.every((recipe) => eligibleChars.has(recipe.target.char)));
    if (!chains.length) return null;
    chain = chains[Math.floor(random() * chains.length)];
    selected = chain.slice(0, count);
  } else {
    selected = pickRecipes(eligible, Math.min(count, eligible.length), random);
  }

  const questions = selected.map((recipe, index) => makeQuestion(
    recipe,
    mode,
    recipes,
    choiceCount,
    random,
    index,
    date,
    chain ? { chain: { position: index + 1, total: selected.length, glyphs: selected.map((entry) => entry.target.char) } } : {},
  ));
  const titles = { result: 'Today’s Brew', missing: 'Missing Ingredient', reverse: 'Reverse Brewing', chain: 'Transformation Chain' };
  return { date, mode, knownFilter, title: titles[mode], questions };
}

export function buildDailyAlchemyChallenge(catalog, structureIndex, options = {}) {
  return buildAlchemyChallenge(catalog, structureIndex, { ...options, mode: 'result' });
}

export function createAlchemySession(challenge, history = []) {
  if (!challenge?.questions?.length) return null;
  return {
    date: challenge.date,
    title: challenge.title || 'Today’s Brew',
    mode: challenge.mode || 'result',
    knownFilter: challenge.knownFilter || 'all',
    questions: challenge.questions.map(cloneQuestion),
    index: 0,
    answers: Array(challenge.questions.length).fill(null),
    history: Array.isArray(history) ? history.map((entry) => ({ ...entry, target: { ...entry.target }, ingredients: [...entry.ingredients] })) : [],
  };
}

export function currentAlchemyQuestion(session) {
  return session?.questions?.[session.index] || null;
}

export function answerAlchemyQuestion(session, choice) {
  if (!session || session.answers[session.index]) return session;
  const question = currentAlchemyQuestion(session);
  const value = String(choice || '');
  if (!question?.choices.some((item) => choiceValue(item) === value)) return session;
  const correct = value === String(question.answer ?? question.target.char);
  const answers = [...session.answers];
  answers[session.index] = { choice: value, correct };
  const history = [...session.history, {
    id: question.id,
    mode: question.mode || session.mode || 'result',
    choice: value,
    correct,
    target: { ...question.target },
    ingredients: [...question.ingredients],
  }];
  return { ...session, answers, history };
}

export function moveAlchemyQuestion(session, delta) {
  if (!session) return session;
  const index = Math.max(0, Math.min(session.questions.length - 1, session.index + delta));
  return index === session.index ? session : { ...session, index };
}

export function restartAlchemySession(session) {
  if (!session) return session;
  return { ...session, index: 0, answers: Array(session.questions.length).fill(null) };
}

export function alchemyProgress(session) {
  if (!session) return { current: 0, total: 0, answered: 0, correct: 0, complete: false };
  const answered = session.answers.filter(Boolean);
  return {
    current: session.index + 1,
    total: session.questions.length,
    answered: answered.length,
    correct: answered.filter((answer) => answer.correct).length,
    complete: answered.length === session.questions.length,
  };
}
