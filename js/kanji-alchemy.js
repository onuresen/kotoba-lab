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

function pickDistractors(target, recipes, count, random) {
  const pool = shuffle(recipes.filter((recipe) => recipe.target.char !== target.target.char), random)
    .sort((a, b) => {
      const levelA = a.target.jlpt === target.target.jlpt ? 0 : 1;
      const levelB = b.target.jlpt === target.target.jlpt ? 0 : 1;
      return levelA - levelB || Math.abs(a.target.strokes - target.target.strokes) - Math.abs(b.target.strokes - target.target.strokes);
    });
  return pool.slice(0, count).map((recipe) => recipe.target);
}

export function buildDailyAlchemyChallenge(catalog, structureIndex, options = {}) {
  const date = String(options.date || new Date().toLocaleDateString('en-CA'));
  const count = Math.max(1, Number(options.count) || 5);
  const choiceCount = Math.max(2, Number(options.choiceCount) || 4);
  const recipes = buildAlchemyRecipes(catalog, structureIndex);
  if (recipes.length < Math.max(count, choiceCount)) return null;

  const random = seededRandom(`kotoba-alchemy:${date}`);
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

  const questions = selected.map((recipe, index) => {
    const distractors = pickDistractors(recipe, recipes, choiceCount - 1, random);
    return {
      id: `${date}:${index + 1}:${recipe.target.char}`,
      ingredients: [...recipe.ingredients],
      target: { ...recipe.target },
      choices: shuffle([recipe.target, ...distractors], random).map((choice) => ({ ...choice })),
    };
  });
  return { date, title: 'Today’s Brew', questions };
}

export function createAlchemySession(challenge) {
  if (!challenge?.questions?.length) return null;
  return {
    date: challenge.date,
    title: challenge.title || 'Today’s Brew',
    questions: challenge.questions.map((question) => ({ ...question, ingredients: [...question.ingredients], choices: question.choices.map((choice) => ({ ...choice })) })),
    index: 0,
    answers: Array(challenge.questions.length).fill(null),
  };
}

export function currentAlchemyQuestion(session) {
  return session?.questions?.[session.index] || null;
}

export function answerAlchemyQuestion(session, choice) {
  if (!session || session.answers[session.index]) return session;
  const question = currentAlchemyQuestion(session);
  if (!question?.choices.some((item) => item.char === choice)) return session;
  const answers = [...session.answers];
  answers[session.index] = { choice, correct: choice === question.target.char };
  return { ...session, answers };
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
