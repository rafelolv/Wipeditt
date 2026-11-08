import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// Only the minimized checkpoint schema reaches this private application file.
export class CheckpointStorage {
  constructor(path) { this.path = path; this.pending = null; this.timer = null; }
  getItem() { if (this.pending !== null) return this.pending; try { return readFileSync(this.path, 'utf8'); } catch { return null; } }
  setItem(_key, value) {
    this.pending = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
    this.timer.unref?.();
  }
  removeItem() { this.pending = null; clearTimeout(this.timer); try { unlinkSync(this.path); } catch { /* It may not exist. */ } }
  flush() {
    clearTimeout(this.timer);
    if (this.pending === null) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
      writeFileSync(this.path + '.tmp', this.pending, { mode: 0o600 });
      renameSync(this.path + '.tmp', this.path);
      this.pending = null;
    } catch { /* A checkpoint failure must not cause a write to be replayed. */ }
  }
}
