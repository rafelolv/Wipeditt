import { AppError, checkAbort, sleep } from '../errors.js';

// Observe only request IDs, method/type, owning WebContents and completion
// status. Never inspect upload data, cookies, request headers or response bodies.
export class NativeWriteTracker {
  constructor({ contentsId, now = Date.now, sleeper = sleep }) { Object.assign(this, { contentsId, now, sleeper }); }
  begin() {
    if (this.active) throw new AppError('BUSY', 'Another native write is still being observed.');
    return this.active = { seen: false, pending: new Set(), completed: 0, failures: [], changedAt: this.now() };
  }
  before(details) {
    const active = this.active;
    if (!active || (details.webContentsId ?? details.webContents?.id) !== this.contentsId || details.method !== 'POST' || !['xhr', 'mainFrame'].includes(details.resourceType)) return;
    active.seen = true; active.pending.add(details.id); active.changedAt = this.now();
  }
  complete(details) {
    const active = this.active;
    if (!active?.pending.delete(details.id)) return;
    active.completed++;
    if (!(details.statusCode >= 200 && details.statusCode < 300)) active.failures.push(details.statusCode);
    active.changedAt = this.now();
  }
  error(details) {
    const active = this.active;
    if (!active?.pending.delete(details.id)) return;
    active.completed++; active.failures.push(null); active.changedAt = this.now();
  }
  async wait(ticket, { signal } = {}) {
    const deadline = this.now() + 30000;
    while (this.active === ticket && this.now() < deadline) {
      checkAbort(signal);
      if (ticket.seen && !ticket.pending.size && this.now() - ticket.changedAt >= 750) {
        if (ticket.failures.length) {
          const status = ticket.completed === 1 ? ticket.failures[0] : null;
          if (status === 429) throw new AppError('RATELIMIT', 'Reddit asked Wipeditt to wait.', { status });
          if (status >= 400 && status < 500) throw new AppError(status === 401 ? 'AUTH' : status === 403 ? 'PERMISSION' : 'REDDIT_REJECTED', 'Reddit rejected the native action.', { status, fatal: status === 401 || status === 403 });
          throw new AppError('UNCERTAIN', 'The native request did not complete reliably.', { fatal: true, reason: 'NATIVE_REQUEST_FAILED' });
        }
        return;
      }
      await this.sleeper(100, signal);
    }
    throw new AppError('UNCERTAIN', 'Native request completion could not be verified. Inspect the original before repeating any action.', { fatal: true, reason: 'NATIVE_REQUEST_UNCONFIRMED' });
  }
  end(ticket) { if (this.active === ticket) this.active = null; }
}
