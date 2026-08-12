function validRows(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.char && !seen.has(row.char) && seen.add(row.char));
}

export function createKanjiStudySession(family, mode) {
  const rows = validRows(family?.rows);
  if (!family?.key || !rows.length) return null;
  return {
    key: family.key,
    label: family.label || family.key,
    mode: mode || 'family',
    rows,
    index: 0,
    revealed: false,
    studied: new Set(),
  };
}

export function currentStudyCard(session) {
  return session?.rows?.[session.index] || null;
}

export function moveStudyCard(session, step) {
  if (!session?.rows?.length) return session;
  const index = Math.max(0, Math.min(session.rows.length - 1, session.index + Number(step || 0)));
  if (index === session.index) return session;
  return { ...session, index, revealed: false };
}

export function revealStudyCard(session) {
  const card = currentStudyCard(session);
  if (!card || session.revealed) return session;
  const studied = new Set(session.studied);
  studied.add(card.char);
  return { ...session, revealed: true, studied };
}

export function shuffleStudySession(session, random = Math.random) {
  if (!session?.rows?.length) return session;
  const rows = [...session.rows];
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const value = Number(random());
    const j = Math.min(i, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * (i + 1))));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return { ...session, rows, index: 0, revealed: false, studied: new Set() };
}

export function studyProgress(session) {
  const total = session?.rows?.length || 0;
  const studied = session?.studied?.size || 0;
  return {
    current: total ? session.index + 1 : 0,
    total,
    studied,
    pct: total ? Math.round((studied / total) * 100) : 0,
    complete: total > 0 && studied === total,
  };
}
