const KEY = 'wipeditt.checkpoint.v1';
const STATES = new Set(['pending', 'editing', 'anonymized', 'waiting', 'deleted', 'skipped', 'failed', 'uncertain', 'deleting', 'partial']);
export class Checkpoints {
  constructor(storage, now = Date.now) { this.storage = storage; this.now = now; }
  save(records, simulation) {
    // No account, text, subreddit, replacement, filter or credential survives reload.
    const data = { expires: this.now() + 86400000, simulation, records: records.slice(-100000).map(({ id, state, steps }) => ({ id, state, ...(steps ? { steps: Object.fromEntries(['anonymize', 'delete'].map(stage => [stage, ['pending', 'verified', 'failed', 'uncertain', 'skipped', 'not-requested'].includes(steps[stage]) ? steps[stage] : 'uncertain'])) } : {}) })) };
    try { this.storage?.setItem(KEY, JSON.stringify(data)); } catch { return false; }
    return true;
  }
  load() {
    try {
      const data = JSON.parse(this.storage?.getItem(KEY) || 'null');
      if (!data || data.expires < this.now() || !Array.isArray(data.records) || data.records.length > 100000) { this.clear(); return null; }
      data.records = data.records.filter(r => /^t[13]_[a-z0-9]+$/.test(r.id) && STATES.has(r.state)).map(r => ({ id: r.id, ...(r.steps ? { steps: Object.fromEntries(['anonymize', 'delete'].map(stage => [stage, ['verified', 'failed', 'skipped', 'not-requested'].includes(r.steps[stage]) ? r.steps[stage] : 'uncertain'])) } : {}), state: ['editing', 'deleting', 'waiting', 'pending'].includes(r.state) ? 'uncertain' : r.state }));
      return data;
    } catch { this.clear(); return null; }
  }
  clear() { try { this.storage?.removeItem(KEY); } catch { /* Storage may be disabled. */ } }
}
