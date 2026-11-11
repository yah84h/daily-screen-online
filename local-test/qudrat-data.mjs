/** Shared, dependency-free validation for server, browser and tests. */
export function normalizeLeaderboard(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.exams) || input.exams.length > 20)
    throw Error('Invalid leaderboard');
  const clean = (value) =>
    typeof value === 'string'
      ? value
          .replace(/[\u0000-\u001f]/g, ' ')
          .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160)
      : '';
  const exams = [],
    seen = new Set();
  for (const raw of input.exams) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.leaders)) throw Error('Invalid exam');
    const kind = clean(raw.kind);
    if (!kind || seen.has(kind)) continue;
    seen.add(kind);
    const leaders = raw.leaders
      .slice(0, 100)
      .flatMap((row, index) => {
        const name = clean(row?.name),
          rank = Number(row?.rank),
          score = Number(row?.score);
        if (
          !name ||
          !Number.isInteger(rank) ||
          rank < 1 ||
          rank > 1000 ||
          row.score === null ||
          row.score === '' ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > 100000
        )
          return [];
        return [{ name, rank, score, index }];
      })
      .sort((a, b) => a.rank - b.rank || b.score - a.score || a.index - b.index)
      .slice(0, 10)
      .map(({ name, rank, score }) => ({ name, rank, score }));
    // Malformed non-empty results must not erase a previously valid cached board.
    if (raw.leaders.length && !leaders.length) throw Error('Invalid leaders');
    exams.push({
      kind,
      title: clean(raw.title) || 'نتائج الأسبوع',
      kind_label: clean(raw.kind_label) || (kind === 'gat' ? 'قدرات إنجليزي (GAT)' : 'قدرات عربي'),
      leaders,
    });
  }
  const week = Number(input.week),
    updated = Date.parse(input.updated_at);
  return {
    week: Number.isInteger(week) && week >= 1 && week <= 53 ? week : null,
    exams,
    updated_at: Number.isFinite(updated) ? new Date(updated).toISOString() : null,
  };
}
export function leaderboardOptions(value = {}) {
  return {
    refreshSeconds: [30, 60, 120, 300].includes(value?.refreshSeconds) ? value.refreshSeconds : 30,
    layout: value?.layout === 'list' ? 'list' : 'podium',
    exam: ['weekly', 'gat', 'all'].includes(value?.exam) ? value.exam : 'weekly',
    pageSize: [2, 3, 4].includes(value?.pageSize) ? value.pageSize : 3,
  };
}
export function leaderboardPages(data, value = {}) {
  const options = leaderboardOptions(value),
    exams = data.exams.filter((exam) => options.exam === 'all' || exam.kind === options.exam),
    pages = [];
  for (const exam of exams) {
    const top = options.layout === 'podium' ? exam.leaders.slice(0, 3) : [],
      rows = options.layout === 'podium' ? exam.leaders.slice(3) : exam.leaders;
    const count = Math.max(1, Math.ceil(rows.length / options.pageSize));
    for (let index = 0; index < count; index++)
      pages.push({
        exam,
        top,
        rows: rows.slice(index * options.pageSize, (index + 1) * options.pageSize),
        page: index + 1,
        pageCount: count,
      });
  }
  return pages;
}
