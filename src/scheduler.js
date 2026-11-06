import { AppError, checkAbort, sleep } from './errors.js';

// Every adapter operation is serialized, including identity checks and verification reads.
export class Scheduler {
  constructor({ interval = 1500, now = Date.now, sleeper = sleep, onWait = () => {} } = {}) {
    this.interval = interval;
    this.now = now;
    this.sleeper = sleeper;
    this.onWait = onWait;
    this.next = 0;
    this.paused = false;
    this.tail = Promise.resolve();
    this.stats = { requests: 0, retries: 0, throttles: 0, waitedMs: 0 };
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  observe(headers) {
    if (!headers?.get) return;
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = Number(headers.get('x-ratelimit-reset'));
    if (remaining !== null && Number(remaining) <= 1 && Number.isFinite(reset) && reset > 0) {
      this.next = Math.max(this.next, this.now() + reset * 1000);
    }
    const retry = headers.get('retry-after');
    if (retry) {
      const seconds = Number(retry);
      const until = Number.isFinite(seconds) ? this.now() + seconds * 1000 : Date.parse(retry);
      if (Number.isFinite(until)) this.next = Math.max(this.next, until);
    }
  }
  async gate(signal) {
    for (;;) {
      checkAbort(signal);
      const remaining = this.next - this.now();
      if (!this.paused && remaining <= 0) return;
      const ms = this.paused ? 100 : Math.min(remaining, 250);
      this.onWait({ reason: this.paused ? 'Paused' : 'Request interval or server cooldown', remaining: Math.max(0, remaining) });
      await this.sleeper(ms, signal);
      this.stats.waitedMs += ms;
    }
  }
  request(task, { signal, write = false } = {}) {
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        await this.gate(signal);
        checkAbort(signal);
        this.stats.requests++;
        try {
          const result = await task();
          this.observe(result?.headers);
          return result?.data ?? result;
        } catch (error) {
          this.observe(error.headers);
          if (Number.isFinite(error.retryAfterMs) && error.retryAfterMs > 0) this.next = Math.max(this.next, this.now() + error.retryAfterMs);
          const status = error.status;
          if (error.code && !['NETWORK', 'TIMEOUT', 'RATELIMIT'].includes(error.code) && !status) throw error;
          if (status === 401 || status === 403) throw new AppError(status === 401 ? 'AUTH' : 'PERMISSION', 'Authorization or permission refused.', { fatal: true });
          const throttle = status === 429 || error.code === 'RATELIMIT';
          if (throttle) this.stats.throttles++;
          const transient = !status || status >= 500;
          // Retrying a submitted write after transport failure could duplicate an operation.
          if (write && !throttle && transient) throw new AppError('UNCERTAIN', 'Write outcome unknown. Verify current state before trying again.');
          if (attempt >= 3 || (!throttle && !transient)) throw error;
          this.stats.retries++;
          this.next = Math.max(this.next, this.now() + (throttle ? 60000 : 1000 * 2 ** attempt));
        } finally {
          this.next = Math.max(this.next, this.now() + this.interval);
        }
      }
    };
    const result = this.tail.then(run);
    this.tail = result.catch(() => {});
    return result;
  }
}
