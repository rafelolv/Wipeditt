const KEY = 'wipeditt.checkpoint.v1';
const STATES = new Set(['pending', 'editing', 'anonymized', 'waiting', 'deleted', 'skipped', 'failed', 'uncertain', 'deleting', 'partial']);
export class Checkpoints {
  constructor(storage, now = Date.now) {
    this.storage = storage; this.now = now;
    this.deleted = new Map();
    try {
      const data = JSON.parse(storage?.getItem(KEY) || 'null');
      const entries = data?.deleted || [];
      if (Array.isArray(entries) && entries.length <= 100000) for (const entry of entries) {
        if (Array.isArray(entry) && /^t[13]_[a-z0-9]+$/.test(entry[0]) && Number.isFinite(entry[1]) && entry[1] > now() && entry[1] <= now() + 86400000) this.deleted.set(entry[0], entry[1]);
      }
      // Carry forward positive evidence from older checkpoints, never inferred absence.
      if (data && !Object.hasOwn(data, 'deleted') && data.simulation === false && Number.isFinite(data.expires) && data.expires > now() && data.expires <= now() + 86400000 && Array.isArray(data.records) && data.records.length <= 100000) {
        for (const record of data.records) if (record?.state === 'deleted' && record.steps?.delete === 'verified' && /^t[13]_[a-z0-9]+$/.test(record.id)) this.deleted.set(record.id, data.expires);
      }
    } catch { /* Invalid local history must never affect ownership checks. */ }
  }
  wasDeleted(id, simulation) { return simulation === false && (this.deleted.get(id) || 0) > this.now(); }
  forgetDeleted(id) {
    if (this.deleted.delete(id)) this.persistDeleted();
  }
  persistDeleted() {
    this.deleted = new Map([...this.deleted].filter(([, expires]) => expires > this.now()).slice(-100000));
    try {
      const previous = JSON.parse(this.storage?.getItem(KEY) || 'null');
      this.storage?.setItem(KEY, JSON.stringify({ expires: this.now() + 86400000, simulation: previous?.simulation === true, records: previous?.records || [], deleted: [...this.deleted] }));
    } catch { /* A disabled store only loses this local optimization. */ }
  }
  save(records, simulation) {
    this.deleted = new Map([...this.deleted].filter(([, expires]) => expires > this.now()));
    if (simulation === false) {
      for (const record of records) if (record.state === 'deleted' && record.steps?.delete === 'verified' && /^t[13]_[a-z0-9]+$/.test(record.id) && !this.deleted.has(record.id)) this.deleted.set(record.id, this.now() + 86400000);
      this.deleted = new Map([...this.deleted].filter(([, expires]) => expires > this.now()).slice(-100000));
    }
    // No account, text, subreddit, replacement, filter or credential survives reload.
    const data = { deleted: [...this.deleted], expires: this.now() + 86400000, simulation, records: records.slice(-100000).map(({ id, state, steps }) => ({ id, state, ...(steps ? { steps: Object.fromEntries(['anonymize', 'delete'].map(stage => [stage, ['pending', 'verified', 'failed', 'uncertain', 'skipped', 'not-requested'].includes(steps[stage]) ? steps[stage] : 'uncertain'])) } : {}) })) };
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
  clear() { this.deleted.clear(); try { this.storage?.removeItem(KEY); } catch { /* Storage may be disabled. */ } }
}
