export function makeReport(run, version, rateStats) {
  const counts = {};
  for (const record of run.records) counts[record.state] = (counts[record.state] || 0) + 1;
  return {
    application: 'Wipeditt', version, timestamp: new Date().toISOString(), simulation: run.simulation, source: run.source || 'live',
    operation: run.mode, stopped: run.stopped, elapsedMs: Math.max(0, run.finished - run.started),
    filters: { type: run.options.type, limit: run.options.limit, hasSubredditFilter: !!(run.options.include.length || run.options.exclude.length), hasTextFilter: !!(run.options.contains || run.options.regex), hasDateFilter: run.options.after !== null || run.options.before !== null, hasScoreFilter: run.options.minScore !== null || run.options.maxScore !== null, edited: run.options.edited },
    counts, issues: run.records.filter(r => ['failed', 'skipped', 'uncertain', 'partial'].includes(r.state)).map(({ id, state, code }) => ({ id, state, category: code || 'UNAVAILABLE' })),
    stages: run.records.map(({ id, state, steps }) => ({ id, state, ...(steps ? { steps: { anonymize: steps.anonymize, delete: steps.delete } } : {}) })),
    rateLimit: { ...rateStats }
  };
}
